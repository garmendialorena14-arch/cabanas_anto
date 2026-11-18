// ======================================================================
// SAAS Cabañas - Gestión y Creación Automática de Reservas desde Telegram
// Route: /api/telegram/bookings
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthRoles } from '@/shared/lib/supabase/authServerHelper';
import { TelegramClient } from '@/modules/telegram/telegramClient';
import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from '@/modules/ai/geminiClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const contactId = req.nextUrl.searchParams.get('contact_id');
    const guestPhone = req.nextUrl.searchParams.get('phone');

    let query = supabase
      .from('reservations')
      .select('*, cabins(*)')
      .order('created_at', { ascending: false });

    if (contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone, full_name')
        .eq('id', contactId)
        .maybeSingle();

      if (contact?.phone) {
        query = query.eq('guest_phone', contact.phone);
      } else if (contact?.full_name) {
        query = query.ilike('guest_name', `%${contact.full_name}%`);
      }
    } else if (guestPhone) {
      query = query.eq('guest_phone', guestPhone);
    }

    const { data: reservations, error } = await query.limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reservations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const body = await req.json();
    const {
      auto_create,
      conversation_id,
      notes,
    } = body;

    let {
      contact_id,
      cabin_id,
      check_in_date,
      check_out_date,
      guest_name,
      guest_phone,
      guest_count,
      total_usd,
      sena_usd,
      vehicle_license_plate,
    } = body;

    // ==================================================================
    // MODO AUTOMÁTICO VÍA IA: Extraer datos directamente de la conversación
    // ==================================================================
    if (auto_create && conversation_id) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('*, contacts(*)')
        .eq('id', conversation_id)
        .single();

      if (conv) {
        contact_id = conv.contact_id;
        guest_name = guest_name || conv.contacts?.full_name || 'Huésped Telegram';
        guest_phone = guest_phone || conv.contacts?.phone || '';
      }

      // Obtener últimos mensajes de la conversación
      const { data: convMsgs } = await supabase
        .from('messages')
        .select('sender_type, content, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(20);

      const transcript = (convMsgs || [])
        .reverse()
        .map((m: any) => `${m.sender_type === 'user' ? 'Huésped' : 'Asistente'}: ${m.content}`)
        .join('\n');

      const apiKey = getGeminiApiKey();
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `Analiza la conversación entre el huésped y el complejo de cabañas para extraer los datos de la reserva en formato JSON estricto.
Campos a extraer:
- check_in_date (YYYY-MM-DD)
- check_out_date (YYYY-MM-DD)
- guest_count (número de personas entero, ej 4)
- total_usd (número del total en USD acordado o cotizado, ej 300)
- sena_usd (número de la seña en USD, ej 90)
- cabin_number (número de cabaña 1 a 12 adecuada para esa cantidad de personas, ej 1)
- guest_name (nombre completo del titular si está disponible)
- guest_phone (teléfono si fue mencionado)

Conversación:
${transcript}

Responde ÚNICAMENTE con el objeto JSON válido sin formato markdown ni explicaciones:`;

          const aiRes = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 0.1 },
          });

          const rawJson = (aiRes.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(rawJson);

          if (parsed.check_in_date) check_in_date = parsed.check_in_date;
          if (parsed.check_out_date) check_out_date = parsed.check_out_date;
          if (parsed.guest_count) guest_count = Number(parsed.guest_count);
          if (parsed.total_usd) total_usd = Number(parsed.total_usd);
          if (parsed.sena_usd) sena_usd = Number(parsed.sena_usd);
          if (parsed.guest_name && !guest_name) guest_name = parsed.guest_name;
          if (parsed.guest_phone && !guest_phone) guest_phone = parsed.guest_phone;

          // Asignar cabaña según número sugerido
          if (parsed.cabin_number) {
            const { data: matchedCabin } = await supabase
              .from('cabins')
              .select('id')
              .eq('cabin_number', Number(parsed.cabin_number))
              .maybeSingle();

            if (matchedCabin) cabin_id = matchedCabin.id;
          }
        } catch (aiErr) {
          console.warn('Extracción con IA falló, usando datos por defecto:', aiErr);
        }
      }
    }

    // Fallbacks si falta algún campo
    if (!cabin_id) {
      const targetPax = Number(guest_count) || 4;
      const { data: fallbackCabin } = await supabase
        .from('cabins')
        .select('id')
        .gte('max_guests', targetPax)
        .order('cabin_number')
        .limit(1)
        .single();

      cabin_id = fallbackCabin?.id;
    }

    if (!check_in_date) {
      const now = new Date();
      check_in_date = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    if (!check_out_date) {
      const inDate = new Date(check_in_date);
      check_out_date = new Date(inDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    // 1. Obtener Cabaña
    const { data: cabin, error: cabinErr } = await supabase
      .from('cabins')
      .select('*')
      .eq('id', cabin_id)
      .single();

    if (cabinErr || !cabin) {
      return NextResponse.json({ error: 'Cabaña no encontrada.' }, { status: 404 });
    }

    // 2. Obtener cotización Dólar Blue
    const { data: rateData } = await supabase
      .from('exchange_rates')
      .select('sell_rate')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const blueRate = rateData?.sell_rate || 1285;

    // 3. Cálculos bimonetarios y noches
    const inDate = new Date(check_in_date);
    const outDate = new Date(check_out_date);
    const diffTime = Math.abs(outDate.getTime() - inDate.getTime());
    const totalNights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

    const numTotalUsd = Number(total_usd) || Number(cabin.base_rate_usd) * totalNights;
    const numSenaUsd = Number(sena_usd) || Math.round(numTotalUsd * 0.3);
    const senaPaidArs = Math.round(numSenaUsd * blueRate);
    const totalArsBooking = Math.round(numTotalUsd * blueRate);
    const balancePendingUsd = Math.max(0, numTotalUsd - numSenaUsd);

    // 4. Crear Reserva en la tabla reservations
    const { data: newReservation, error: resErr } = await supabase
      .from('reservations')
      .insert({
        cabin_id: cabin.id,
        guest_name: (guest_name || 'Huésped Telegram').trim(),
        guest_phone: (guest_phone || '').trim() || null,
        guest_count: Number(guest_count) || 2,
        check_in_date,
        check_out_date,
        status: 'senada',
        total_nights: totalNights,
        daily_rate_usd: Math.round(numTotalUsd / totalNights),
        total_usd: numTotalUsd,
        blue_rate_at_booking: blueRate,
        total_ars_at_booking: totalArsBooking,
        sena_percentage: Math.round((numSenaUsd / numTotalUsd) * 100) || 30,
        sena_usd_required: numSenaUsd,
        sena_paid_usd_equiv: numSenaUsd,
        sena_paid_ars: senaPaidArs,
        sena_paid_at: new Date().toISOString(),
        balance_pending_usd: balancePendingUsd,
        parking_spot_number: cabin.cabin_number,
        vehicle_license_plate: vehicle_license_plate ? vehicle_license_plate.trim().toUpperCase() : null,
        booking_channel: 'telegram',
        breakfast_included: true,
        has_reduced_mobility: Boolean(cabin.has_accessible_mobility),
        internal_notes: notes || 'Confirmada automáticamente desde CRM de Telegram',
      })
      .select('*')
      .single();

    if (resErr || !newReservation) {
      console.error('Error insertando reservacion:', resErr);
      return NextResponse.json({ error: resErr?.message || 'Error al crear reserva' }, { status: 500 });
    }

    const reservationCode = 'ANTO-' + newReservation.id.slice(0, 8).toUpperCase();

    // 5. Registrar el cobro de la seña en la caja (payments)
    try {
      await supabase.from('payments').insert({
        reservation_id: newReservation.id,
        concept: 'sena',
        payment_method: 'transferencia_ars',
        amount_usd: numSenaUsd,
        amount_ars: senaPaidArs,
        applied_blue_rate: blueRate,
        payment_reference: `Seña #${reservationCode}`,
        notes: `Cobro de seña verificado por recepción para reserva ${reservationCode}`,
      });
    } catch (payErr) {
      console.warn('Error registrando pago en payments:', payErr);
    }

    // 6. Actualizar teléfono en el contacto si no lo tenía
    if (contact_id && guest_phone) {
      await supabase
        .from('contacts')
        .update({ phone: guest_phone.trim(), updated_at: new Date().toISOString() })
        .eq('id', contact_id);
    }

    // 7. Notificar al huésped por Telegram con su Número Oficial de Reserva
    let telegramSent = false;
    if (contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('external_id')
        .eq('id', contact_id)
        .single();

      if (contact?.external_id) {
        const { token } = await TelegramClient.getActiveToken();
        if (token) {
          const client = new TelegramClient(token);
          const confirmationText = `🎉 <b>¡Seña confirmada con éxito!</b> Hemos verificado la acreditación bancaria y tu estadía en Complejo Cabañas Anto está formalmente registrada.

📋 <b>Número de Reserva:</b> <code>#${reservationCode}</code>
🏡 <b>Cabaña:</b> Cabaña ${cabin.cabin_number} (${cabin.name}) - Planta ${cabin.floor}
📅 <b>Fechas:</b> ${check_in_date} al ${check_out_date} (${totalNights} noches)
👥 <b>Huéspedes:</b> ${guest_count || 2} personas
💰 <b>Seña acreditada:</b> USD $${numSenaUsd} ($${senaPaidArs.toLocaleString('es-AR')} ARS)
💵 <b>Saldo al Check-in:</b> USD $${balancePendingUsd} (o en Pesos ARS según cotización Dólar Blue del día)
🚗 <b>Cochera cubierta asignada:</b> Cochera Nº ${cabin.cabin_number}

📌 <b>Datos para tu ficha de estadía:</b>
1. Por favor indícanos la <b>patente (dominio)</b> de tu vehículo para el acceso a la cochera.
2. Envíanos por este chat las <b>fotos del frente y dorso del DNI o Pasaporte</b> de los integrantes.

📌 <b>Condiciones de Reserva y Cancelación:</b>
• <b>Check-in:</b> 14:00 hs | <b>Check-out:</b> 10:00 hs.
• <b>Cancelación con 15 días o más de anticipación al Check-in:</b> la seña queda como crédito disponible a tu favor para ser utilizado en otra fecha durante los próximos 12 meses.
• <b>Cancelación con menos de 15 días o No-Show:</b> la seña no es reembolsable.

¡Te esperamos en Mar Azul para disfrutar de una estadía inolvidable en el bosque y el mar! 🌲🌊`;

          telegramSent = await client.sendMessage(contact.external_id, confirmationText, { parse_mode: 'HTML' });

          // Registrar el mensaje en el historial del CRM
          if (conversation_id) {
            await supabase.from('messages').insert({
              conversation_id,
              sender_type: 'assistant',
              content: confirmationText,
            });

            await supabase
              .from('conversations')
              .update({
                last_message_preview: `[Reserva #${reservationCode} Confirmada]`,
                last_message_at: new Date().toISOString(),
              })
              .eq('id', conversation_id);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      reservation: newReservation,
      reservationCode,
      telegramSent,
    });
  } catch (err: any) {
    console.error('Error en POST /api/telegram/bookings:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
