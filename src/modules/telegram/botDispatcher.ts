// ======================================================================
// SAAS Cabañas - Telegram Bot Dispatcher
// Orquestador de Eventos, Clasificación de Asistentes, Control Humano
// y Asistente Privado del Propietario
// ======================================================================

import { createClient } from '@/shared/lib/supabase/client';
import { TelegramClient } from './telegramClient';
import { generateAssistantResponse } from '../ai/geminiClient';
import { formatARS, formatUSD } from '@/shared/lib/bimonetary';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
    caption?: string;
    photo?: any[];
    document?: any;
  };
}

export async function processTelegramUpdate(update: TelegramUpdate): Promise<{ success: boolean; reason?: string }> {
  if (!update.message) {
    return { success: true, reason: 'No message in update' };
  }

  const message = update.message;
  const chatId = message.chat.id.toString();
  const rawText = (message.text || message.caption || '').trim();
  const from = message.from;
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || `Huésped ${chatId}`;

  const supabase = createClient();

  // 1. Obtener conexión activa de Telegram
  const { data: channelData } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('channel_type', 'telegram')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  const botToken = channelData?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('No hay bot_token configurado en Telegram');
    return { success: false, reason: 'Bot token missing' };
  }

  const telegram = new TelegramClient(botToken);
  const authorizedOwnerId = channelData?.owner_chat_id || process.env.TELEGRAM_NOTIFICATION_CHAT_ID;
  const isOwner = Boolean(
    authorizedOwnerId && (
      chatId === authorizedOwnerId ||
      from.id.toString() === authorizedOwnerId ||
      (from.username && `@${from.username.toLowerCase()}` === authorizedOwnerId.toLowerCase())
    )
  );

  // 2. Buscar o crear el Contacto
  let contactId: string;
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, full_name, phone')
    .eq('external_id', chatId)
    .maybeSingle();

  if (existingContact) {
    contactId = existingContact.id;
    // Actualizar nombre si cambió
    if (fullName && existingContact.full_name !== fullName) {
      await supabase.from('contacts').update({ full_name: fullName, username: from.username }).eq('id', contactId);
    }
  } else {
    const { data: newContact, error: contactErr } = await supabase
      .from('contacts')
      .insert({
        external_id: chatId,
        full_name: fullName,
        username: from.username,
        channel: 'telegram',
      })
      .select('id')
      .single();

    if (contactErr || !newContact) {
      console.error('Error creando contacto:', contactErr);
      return { success: false, reason: 'Failed to create contact' };
    }
    contactId = newContact.id;
  }

  // 3. Buscar o crear la Conversación
  let conversationId: string;
  let conversationStatus: 'ai_active' | 'human_takeover' = 'ai_active';
  let assistantId: string | null = null;

  const { data: existingConv } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contactId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
    conversationStatus = existingConv.status as 'ai_active' | 'human_takeover';
    assistantId = existingConv.assistant_id;
  } else {
    // Si es el propietario, buscar el asistente privado; si no, el de reservas
    const assistantTarget = isOwner ? 'Asistente Privado del Propietario' : 'Reservas y Disponibilidad';
    const { data: defaultAssistant } = await supabase
      .from('assistants')
      .select('id')
      .ilike('name', `%${assistantTarget}%`)
      .limit(1)
      .maybeSingle();

    assistantId = defaultAssistant?.id || null;

    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        contact_id: contactId,
        assistant_id: assistantId,
        status: 'ai_active',
        last_message_preview: rawText.slice(0, 150),
        last_message_at: new Date().toISOString(),
      })
      .select('id, status')
      .single();

    if (convErr || !newConv) {
      console.error('Error creando conversación:', convErr);
      return { success: false, reason: 'Failed to create conversation' };
    }
    conversationId = newConv.id;
    conversationStatus = newConv.status as any;
  }

  // 4. Registrar mensaje del usuario en la base de datos
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'user',
    content: rawText || (message.photo ? '[Foto/Comprobante enviado]' : '[Archivo adjunto]'),
  });

  // Si no hay texto (por ejemplo el usuario mandó un comprobante/foto)
  if (!rawText && (message.photo || message.document)) {
    const receiptNotice = 'Hemos recibido tu comprobante/archivo. El equipo de recepción lo revisará para confirmar tu operación.';
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'assistant',
      content: receiptNotice,
    });
    await telegram.sendMessage(chatId, receiptNotice);
    return { success: true };
  }

  // 5. DETECCIÓN DE PALABRAS CLAVE PARA CONTROL HUMANO (Pregunta 5 acordada)
  const lowerText = rawText.toLowerCase();
  const humanKeywords = ['humano', 'persona', 'recepción', 'recepcion', 'hablar con alguien', 'asesor', 'operador'];
  const wantsHuman = humanKeywords.some((kw) => lowerText.includes(kw));

  if (!isOwner && wantsHuman) {
    // Pasar a human_takeover
    await supabase
      .from('conversations')
      .update({
        status: 'human_takeover',
        last_message_preview: `[Control Humano Solicitado] ${rawText.slice(0, 100)}`,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    const takeoverReply = 'Un momento por favor. He pausado la atención automática y transferí este chat al equipo de recepción de Cabañas Anto. En breve un asesor te responderá directamente por aquí.';
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'assistant',
      content: takeoverReply,
    });
    await telegram.sendMessage(chatId, takeoverReply);
    return { success: true };
  }

  // 6. Si la conversación está en control humano, NO responde la IA
  if (!isOwner && conversationStatus === 'human_takeover') {
    // Solo actualizar timestamp y preview para que recepción lo vea arriba en el inbox
    await supabase
      .from('conversations')
      .update({
        last_message_preview: rawText.slice(0, 150),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
    return { success: true };
  }

  // 7. CASO ESPECIAL: ASISTENTE PRIVADO DEL PROPIETARIO
  if (isOwner) {
    // Comandos directos rápidos
    if (lowerText === '/ocupacion' || lowerText.includes('ocupacion') || lowerText.includes('ocupación')) {
      const todayDate = new Date().toISOString().split('T')[0];
      const { data: allCabins } = await supabase.from('cabins').select('cabin_number, name').order('cabin_number');
      const { data: todayRes } = await supabase
        .from('reservations')
        .select('cabin_id, guest_name, check_in_date, check_out_date, status')
        .lte('check_in_date', todayDate)
        .gt('check_out_date', todayDate)
        .neq('status', 'cancelada');

      const occupiedCabinIds = new Set((todayRes || []).map((r) => r.cabin_id));
      const total = allCabins?.length || 12;
      const occupiedCount = occupiedCabinIds.size;
      const freeCount = total - occupiedCount;

      let reply = `<b>📊 Ocupación del Día (${todayDate}):</b>\n`;
      reply += `• Total cabañas: ${total}\n`;
      reply += `• Ocupadas: <b>${occupiedCount}</b>\n`;
      reply += `• Libres: <b>${freeCount}</b>\n\n`;

      if (todayRes && todayRes.length > 0) {
        reply += '<b>Huéspedes en complejo:</b>\n';
        for (const res of todayRes) {
          const cabin = allCabins?.find((c) => (c as any).id === res.cabin_id);
          reply += `• Cabaña ${cabin?.cabin_number || '?'}: ${res.guest_name} (${res.status})\n`;
        }
      } else {
        reply += '<i>No hay reservas activas registradas para hoy.</i>';
      }

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'assistant',
        content: reply,
      });
      await telegram.sendMessage(chatId, reply, { parse_mode: 'HTML' });
      return { success: true };
    }

    if (lowerText === '/caja' || lowerText.includes('caja') || lowerText.includes('arqueo')) {
      const { data: payments } = await supabase
        .from('payments')
        .select('amount_ars, amount_usd, concept')
        .order('created_at', { ascending: false })
        .limit(20);

      const totalArs = (payments || []).reduce((acc, p) => acc + Number(p.amount_ars || 0), 0);
      const totalUsd = (payments || []).reduce((acc, p) => acc + Number(p.amount_usd || 0), 0);

      let reply = `<b>💰 Estado de Caja y Cobros Recientes:</b>\n`;
      reply += `• Recaudación registrada ARS: <b>${formatARS(totalArs)}</b>\n`;
      reply += `• Recaudación registrada USD: <b>${formatUSD(totalUsd)}</b>\n`;
      reply += `• Movimientos computados: ${payments?.length || 0}\n`;

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'assistant',
        content: reply,
      });
      await telegram.sendMessage(chatId, reply, { parse_mode: 'HTML' });
      return { success: true };
    }
  }

  // 8. OBTENER ASISTENTE ACTIVO Y SU SYSTEM PROMPT
  let systemPrompt = '';
  let model = 'gemini-2.5-flash';

  if (assistantId) {
    const { data: asst } = await supabase
      .from('assistants')
      .select('system_prompt, model, name')
      .eq('id', assistantId)
      .single();

    if (asst) {
      systemPrompt = asst.system_prompt;
      model = asst.model || 'gemini-2.5-flash';
    }
  }

  if (!systemPrompt) {
    // Asistente fallback por defecto
    const targetName = isOwner ? 'Asistente Privado del Propietario' : 'Reservas y Disponibilidad';
    const { data: fbAsst } = await supabase
      .from('assistants')
      .select('system_prompt, model')
      .ilike('name', `%${targetName}%`)
      .limit(1)
      .maybeSingle();

    systemPrompt = fbAsst?.system_prompt || 'Eres el asistente del complejo de cabañas Anto.';
    model = fbAsst?.model || 'gemini-2.5-flash';
  }

  // 9. RECOPILAR CONTEXTO VIVO DEL COMPLEJO
  let contextData = '';
  try {
    const { data: cabinsData } = await supabase
      .from('cabins')
      .select('cabin_number, name, floor, max_guests, has_accessible_mobility, base_rate_usd')
      .eq('is_active', true)
      .order('cabin_number');

    const { data: rateData } = await supabase
      .from('exchange_rates')
      .select('sell_rate, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentBlue = rateData?.sell_rate || 1285;

    contextData = `Fecha actual: ${new Date().toISOString().split('T')[0]} (Buenos Aires, Argentina)
Cotización Dólar Blue actual: $${currentBlue} ARS por USD
Cabañas disponibles en el predio (12 unidades):
${(cabinsData || [])
  .map(
    (c) =>
      `- Cabaña ${c.cabin_number} ("${c.name}"): Planta ${c.floor}, Capacidad máx: ${c.max_guests} pax, Tarifa base: USD $${c.base_rate_usd}/noche (Aprox $${Math.round(c.base_rate_usd * currentBlue).toLocaleString('es-AR')} ARS). Adaptada movilidad: ${c.has_accessible_mobility ? 'SÍ' : 'No'}.`
  )
  .join('\n')}
Política de Seña: 30% congelando el valor en USD. Check-in 14:00, Check-out 10:00. Incluye desayuno artesanal (opción Sin TACC) y cochera cubierta.`;
  } catch (ctxErr) {
    console.warn('Error al armar contextData:', ctxErr);
  }

  // 10. RECOPILAR HISTORIAL DE LA CONVERSACIÓN
  const { data: recentMsgs } = await supabase
    .from('messages')
    .select('sender_type, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(8);

  const history = (recentMsgs || []).slice(0, -1).map((m) => ({
    role: (m.sender_type === 'user' ? 'user' : 'model') as 'user' | 'model',
    content: m.content,
  }));

  // 11. GENERAR RESPUESTA CON GEMINI
  const aiReply = await generateAssistantResponse({
    systemPrompt,
    userMessage: rawText,
    conversationHistory: history,
    model,
    contextData,
  });

  // 12. GUARDAR RESPUESTA Y ENVIAR AL HUÉSPED
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'assistant',
    content: aiReply,
  });

  await supabase
    .from('conversations')
    .update({
      last_message_preview: aiReply.slice(0, 150),
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  await telegram.sendMessage(chatId, aiReply);

  return { success: true };
}
