import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/shared/lib/supabase/server';
import { sendTelegramNotification } from '@/modules/telegram/telegramService';

const LeadSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().min(6, 'Teléfono inválido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  paxCount: z.number().int().min(1).max(10).default(2),
  checkInDate: z.string().optional().or(z.literal('')),
  checkOutDate: z.string().optional().or(z.literal('')),
  cabinId: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  source: z.enum(['web', 'email', 'manual', 'telegram', 'telefono', 'otro']).default('web'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de consulta inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { fullName, phone, email, paxCount, checkInDate, checkOutDate, cabinId, notes, source } = parsed.data;

    const supabase = await createServerSupabaseClient();

    const { data: newLead, error } = await supabase
      .from('leads')
      .insert({
        full_name: fullName,
        contact_phone: phone,
        contact_email: email || null,
        pax_count: paxCount,
        desired_check_in: checkInDate || null,
        desired_check_out: checkOutDate || null,
        cabin_preference_id: cabinId || null,
        source: source || 'web',
        notes: notes || null,
        status: 'nuevo',
      })
      .select('id, full_name, created_at')
      .single();

    if (error) {
      console.error('Error insertando lead en Supabase:', error);
      return NextResponse.json({ error: 'No se pudo guardar la consulta' }, { status: 500 });
    }

    // Enviar notificación a Telegram en segundo plano
    const telegramMessage = `🌲 <b>¡Nueva Consulta de Interesado!</b>\n` +
      `👤 <b>Nombre:</b> ${fullName}\n` +
      `📞 <b>Teléfono:</b> ${phone}\n` +
      (email ? `✉️ <b>Email:</b> ${email}\n` : '') +
      `👥 <b>Pasajeros:</b> ${paxCount}\n` +
      (checkInDate ? `📅 <b>Fechas:</b> ${checkInDate} al ${checkOutDate || 'a definir'}\n` : '') +
      (notes ? `💬 <b>Mensaje:</b> ${notes}\n` : '') +
      `🌐 <b>Origen:</b> ${source.toUpperCase()}`;

    // Despacho asíncrono
    sendTelegramNotification(telegramMessage).catch(console.error);

    return NextResponse.json({ success: true, leadId: newLead.id });
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
