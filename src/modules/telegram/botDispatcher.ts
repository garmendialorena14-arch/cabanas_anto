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
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
    document?: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    contact?: {
      phone_number: string;
      first_name: string;
      last_name?: string;
      user_id?: number;
    };
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

  // Captura automática de teléfono desde Telegram Contact o regex de texto
  let detectedPhone = message.contact?.phone_number?.trim() || null;
  if (!detectedPhone && rawText) {
    const phoneMatch = rawText.match(/(?:(?:\+?54\s*9?)|0)?\s*(?:11|[2368]\d)\s*[\s-]?\d{3,4}[\s-]?\d{4}/);
    if (phoneMatch) {
      detectedPhone = phoneMatch[0].replace(/[\s-]+/g, '');
    }
  }

  if (existingContact) {
    contactId = existingContact.id;
    // Actualizar nombre o teléfono si se capturaron
    const contactUpdates: Record<string, any> = {};
    if (fullName && existingContact.full_name !== fullName) {
      contactUpdates.full_name = fullName;
      contactUpdates.username = from.username;
    }
    if (detectedPhone && !existingContact.phone) {
      contactUpdates.phone = detectedPhone;
    }
    if (Object.keys(contactUpdates).length > 0) {
      contactUpdates.updated_at = new Date().toISOString();
      await supabase.from('contacts').update(contactUpdates).eq('id', contactId);
    }
  } else {
    const { data: newContact, error: contactErr } = await supabase
      .from('contacts')
      .insert({
        external_id: chatId,
        full_name: fullName,
        username: from.username,
        phone: detectedPhone,
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

  // 4. Extracción de Archivo Adjunto (Foto de Comprobante / DNI o Documento)
  let fileId: string | null = null;
  let fileType: 'photo' | 'document' | null = null;
  let fileName: string | null = null;

  if (message.photo && message.photo.length > 0) {
    const largestPhoto = message.photo[message.photo.length - 1];
    fileId = largestPhoto.file_id;
    fileType = 'photo';
  } else if (message.document) {
    fileId = message.document.file_id;
    fileType = 'document';
    fileName = message.document.file_name || 'documento';
  }

  let storedUserContent = rawText;
  if (fileId) {
    const tag = `[MEDIA_ATTACHMENT:file_id=${fileId}&type=${fileType}${fileName ? `&name=${encodeURIComponent(fileName)}` : ''}]`;
    storedUserContent = rawText ? `${rawText}\n\n${tag}` : tag;
  }

  // Registrar mensaje del usuario en la base de datos
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'user',
    content: storedUserContent,
  });

  // 4b. Detección automática de Patente del vehículo
  const plateMatch = rawText.match(/\b([A-Z]{3}\s*\d{3}|[A-Z]{2}\s*\d{3}\s*[A-Z]{2})\b/i);
  if (plateMatch && !isOwner) {
    const detectedPlate = plateMatch[0].replace(/\s+/g, ' ').toUpperCase();
    const { data: activeRes } = await supabase
      .from('reservations')
      .select('id, parking_spot_number, vehicle_license_plate')
      .is('vehicle_license_plate', null)
      .in('status', ['senada', 'confirmada'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRes) {
      await supabase
        .from('reservations')
        .update({ vehicle_license_plate: detectedPlate, updated_at: new Date().toISOString() })
        .eq('id', activeRes.id);

      const plateReply = `🚗 <b>¡Excelente!</b> Registramos la patente <b>${detectedPlate}</b> para tu cochera cubierta asignada (Cochera Nº ${activeRes.parking_spot_number || 'asignada'}).\n\nSi aún no lo hiciste, recuerda enviarnos las fotos del frente y dorso del DNI o Pasaporte para completar tu ficha de registro. ¡Muchas gracias!`;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'assistant',
        content: plateReply,
      });
      await telegram.sendMessage(chatId, plateReply, { parse_mode: 'HTML' });
      return { success: true };
    }
  }

  // 4c. Si el usuario envió una foto o comprobante
  if (fileId && !isOwner) {
    // Verificar si ya tiene una reserva confirmada (en tal caso es foto de DNI)
    const { data: userRes } = await supabase
      .from('reservations')
      .select('id')
      .in('status', ['senada', 'confirmada'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (userRes) {
      const docReply = `🪪 <b>¡Foto / Documento recibido con éxito!</b>\n\nHa quedado adjunta a tu ficha de estadía. Nuestro equipo de recepción la revisará para tener tu registro listo al momento de tu llegada a Cabañas Anto. ¡Muchas gracias!`;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'assistant',
        content: docReply,
      });
      await telegram.sendMessage(chatId, docReply, { parse_mode: 'HTML' });
      return { success: true };
    } else {
      const receiptNotice = `📄 <b>¡Comprobante de seña recibido!</b>\n\nNuestro equipo de recepción está verificando la acreditación bancaria. En instantes te confirmamos con tu voucher y número oficial de reserva.\n\n📌 <b>Para ir completando tu ficha de estadía:</b>\n• Indícanos la <b>patente (dominio)</b> de tu auto para registrar el ingreso a la cochera cubierta.\n• Envíanos por este chat las <b>fotos de frente y dorso del DNI o Pasaporte</b> de los huéspedes.\n• Confírmanos si algún integrante requiere desayuno <b>Sin TACC para celíacos</b> o unidad adaptada para <b>movilidad reducida</b>. ¡Muchas gracias!`;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'assistant',
        content: receiptNotice,
      });
      await telegram.sendMessage(chatId, receiptNotice, { parse_mode: 'HTML' });
      return { success: true };
    }
  }

  // 5. DETECCIÓN DE PALABRAS CLAVE PARA CONTROL HUMANO Y COMANDOS
  const lowerText = rawText.toLowerCase();

  // Reactivar atención automática si el usuario envía /ia o /bot
  if (!isOwner && (lowerText === '/ia' || lowerText === '/bot' || lowerText === '/asistente')) {
    await supabase.from('conversations').update({ status: 'ai_active' }).eq('id', conversationId);
    const reactivatedMsg = '¡Asistente virtual de Cabañas Anto reactivado! ¿En qué puedo ayudarte con tu estadía en Mar Azul?';
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'assistant',
      content: reactivatedMsg,
    });
    await telegram.sendMessage(chatId, reactivatedMsg);
    return { success: true };
  }

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
    const todayStr = new Date().toISOString().split('T')[0];

    // Obtener reservas activas vigentes y futuras para control en vivo de disponibilidad
    const { data: upcomingReservations } = await supabase
      .from('reservations')
      .select('cabin_id, check_in_date, check_out_date, status, cabins(cabin_number, name)')
      .neq('status', 'cancelada')
      .gte('check_out_date', todayStr)
      .order('check_in_date')
      .limit(40);

    const occupiedCalendar = (upcomingReservations || [])
      .map((r: any) => `- Cabaña ${r.cabins?.cabin_number || 'N/A'}: OCUPADA del ${r.check_in_date} al ${r.check_out_date}`)
      .join('\n');

    contextData = `UBICACIÓN CONFIRMADA: Complejo de Cabañas Anto está ubicado en Mar Azul (Partido de Villa Gesell, Costa Atlántica, Provincia de Buenos Aires, Argentina), en medio del bosque de pinos y a 300 metros de la playa.
¡REGLA ABSOLUTA DE UBICACIÓN: SI EL HUÉSPED PREGUNTA SI ESTAMOS EN MAR AZUL, RESPONDE SIEMPRE QUE SÍ, QUE ESTAMOS EN MAR AZUL!
Fecha actual: ${todayStr} (Buenos Aires, Argentina)
Cotización Dólar Blue actual de referencia: $${currentBlue} ARS por USD
Cabañas existentes en el predio (12 unidades):
${(cabinsData || [])
  .map(
    (c) =>
      `- Cabaña ${c.cabin_number} ("${c.name}"): Planta ${c.floor}, Capacidad máx: ${c.max_guests} pax, Tarifa base: USD $${c.base_rate_usd}/noche (Aprox $${Math.round(c.base_rate_usd * currentBlue).toLocaleString('es-AR')} ARS). Adaptada movilidad: ${c.has_accessible_mobility ? 'SÍ' : 'No'}.`
  )
  .join('\n')}

CALENDARIO DE OCUPACIÓN EN VIVO (CABAÑAS NO DISPONIBLES EN ESTAS FECHAS):
${occupiedCalendar || 'Todas las cabañas se encuentran desocupadas actualmente.'}

REGLAS CRÍTICAS DE DISPONIBILIDAD PARA LA IA:
1. NUNCA ofrezcas, prometas o asignes una cabaña en fechas que coincidan o se superpongan con el CALENDARIO DE OCUPACIÓN.
2. Si el huésped consulta por fechas donde una cabaña ya está reservada, verifica qué otras cabañas con la capacidad requerida están DESOCUPADAS y ofrécele esas opciones alternativas.
3. Si el huésped requiere movilidad reducida o planta baja, recuerda que ÚNICAMENTE las Cabañas 1, 2, 3 y 4 (PB) son accesibles y adaptadas. Si una está ocupada, verifica las demás de PB.
Política de Seña: 30% congelando el valor en USD. Saldo restante (70%) se abona al check-in.
Horarios: Check-in 14:00 hs, Check-out 10:00 hs.
Servicios incluidos: Desayuno artesanal (con opción sin TACC previo aviso), cochera cubierta individual, ropa blanca, acceso a pileta y WiFi.
Datos de cuenta para señas: Transferencia bancaria al Alias: CABANAS.ANTO.RESERVAS (Titular: Complejo Cabañas Anto).`;
  } catch (ctxErr) {
    console.warn('Error al armar contextData:', ctxErr);
  }

  // 10. RECOPILAR HISTORIAL DE LA CONVERSACIÓN (Últimos 20 mensajes)
  // El mensaje actual del usuario ya fue insertado en el paso 4, por lo que es el registro más reciente.
  const { data: rawRecentMsgs } = await supabase
    .from('messages')
    .select('sender_type, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Excluir el mensaje actual (índice 0) y revertir para orden cronológico
  const priorMsgs = (rawRecentMsgs || []).slice(1).reverse();
  const history = priorMsgs.map((m) => ({
    role: (m.sender_type === 'user' ? 'user' : 'model') as 'user' | 'model',
    content: m.content || '',
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
