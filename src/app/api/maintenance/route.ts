import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/shared/lib/supabase/server';
import { sendTelegramNotification } from '@/modules/telegram/telegramService';

// Esquemas de validación con Zod
const CreateTicketSchema = z.object({
  cabin_id: z.string().uuid().nullable().optional(),
  area_name: z.string().min(1, 'Área o sector es requerido'),
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  description: z.string().min(3, 'La descripción es requerida'),
  priority: z.enum(['baja', 'media', 'alta', 'urgente']).default('media'),
  cost_estimated_ars: z.number().nullable().optional(),
  reported_by_name: z.string().optional(),
});

const UpdateTicketSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pendiente', 'en_progreso', 'resuelta', 'resuelto', 'cancelada', 'cancelado']),
  resolution_notes: z.string().nullable().optional(),
  cost_actual_ars: z.number().nullable().optional(),
});

const CreatePreventiveSchema = z.object({
  facility: z.enum(['pileta', 'quincho', 'bombas_riego', 'termotanques']).default('pileta'),
  record_date: z.string().optional(),
  ph_level: z.number().min(0).max(14).nullable().optional(),
  chlorine_level: z.number().min(0).max(20).nullable().optional(),
  water_temp_celsius: z.number().min(0).max(60).nullable().optional(),
  filter_status: z.string().nullable().optional(),
  observations: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Obtener tickets con datos de cabañas
    const { data: tickets, error: ticketError } = await supabase
      .from('maintenance_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (ticketError) {
      console.error('Error fetching maintenance tickets:', ticketError);
    }

    // 2. Obtener registros preventivos (Pileta y Áreas)
    const { data: preventives, error: prevError } = await supabase
      .from('preventive_maintenance')
      .select('*')
      .order('record_date', { ascending: false })
      .limit(30);

    if (prevError) {
      console.error('Error fetching preventive maintenance:', prevError);
    }

    return NextResponse.json({
      success: true,
      tickets: tickets || [],
      preventives: preventives || [],
    });
  } catch (error: any) {
    console.error('API /api/maintenance GET error:', error);
    return NextResponse.json(
      { error: 'Error al consultar mantenimiento', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;
    const supabase = await createServerSupabaseClient();

    // Obtener usuario autenticado si existe
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (action === 'create_ticket') {
      const parsed = CreateTicketSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Datos de avería inválidos', details: parsed.error.format() },
          { status: 400 }
        );
      }

      const { cabin_id, area_name, title, description, priority, cost_estimated_ars, reported_by_name } = parsed.data;

      const { data: ticket, error } = await supabase
        .from('maintenance_tickets')
        .insert({
          cabin_id: cabin_id || null,
          area_name,
          title,
          description,
          priority,
          status: 'pendiente',
          cost_estimated_ars: cost_estimated_ars || null,
          reported_by: user?.id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error insertando ticket de mantenimiento:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Notificación Telegram si es prioridad alta o urgente
      if (priority === 'urgente' || priority === 'alta') {
        const msg = `🚨 <b>INCIDENCIA DE MANTENIMIENTO [${priority.toUpperCase()}]</b>\n` +
          `📍 <b>Área / Cabaña:</b> ${area_name}\n` +
          `🔧 <b>Título:</b> ${title}\n` +
          `📝 <b>Detalle:</b> ${description}\n` +
          `👤 <b>Reportado por:</b> ${reported_by_name || user?.email || 'Personal Operativo'}`;
        sendTelegramNotification(msg).catch(console.error);
      }

      return NextResponse.json({ success: true, ticket });
    }

    if (action === 'update_ticket') {
      const parsed = UpdateTicketSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Datos de actualización inválidos', details: parsed.error.format() },
          { status: 400 }
        );
      }

      const { id, status, resolution_notes, cost_actual_ars } = parsed.data;
      const updatePayload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (resolution_notes !== undefined) updatePayload.resolution_notes = resolution_notes;
      if (cost_actual_ars !== undefined) updatePayload.cost_actual_ars = cost_actual_ars;
      if (status === 'resuelta' || status === 'resuelto') {
        updatePayload.resolved_at = new Date().toISOString();
      } else {
        updatePayload.resolved_at = null;
      }

      const { data: updated, error } = await supabase
        .from('maintenance_tickets')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando ticket:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Notificación Telegram cuando se resuelve la avería
      if ((status === 'resuelta' || status === 'resuelto') && updated) {
        const msg = `✅ <b>INCIDENCIA DE MANTENIMIENTO SOLUCIONADA</b>\n` +
          `📍 <b>Área / Cabaña:</b> ${updated.area_name || 'General'}\n` +
          `🔧 <b>Avería:</b> ${updated.title}\n` +
          (updated.resolution_notes ? `📝 <b>Solución:</b> ${updated.resolution_notes}\n` : '') +
          (updated.cost_actual_ars ? `💰 <b>Costo final:</b> $${Number(updated.cost_actual_ars).toLocaleString('es-AR')} ARS\n` : '');
        sendTelegramNotification(msg).catch(console.error);
      }

      return NextResponse.json({ success: true, ticket: updated });
    }

    if (action === 'create_preventive') {
      const parsed = CreatePreventiveSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Datos preventivos inválidos', details: parsed.error.format() },
          { status: 400 }
        );
      }

      const { facility, record_date, ph_level, chlorine_level, water_temp_celsius, filter_status, observations } = parsed.data;

      const { data: record, error } = await supabase
        .from('preventive_maintenance')
        .insert({
          facility,
          record_date: record_date || new Date().toISOString().split('T')[0],
          ph_level: ph_level ?? null,
          chlorine_level: chlorine_level ?? null,
          water_temp_celsius: water_temp_celsius ?? null,
          filter_status: filter_status ?? 'Limpio y en operación',
          observations: observations ?? null,
          performed_by: user?.id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error guardando preventivo:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, record });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/maintenance POST error:', error);
    return NextResponse.json(
      { error: 'Error procesando solicitud de mantenimiento', details: error.message },
      { status: 500 }
    );
  }
}
