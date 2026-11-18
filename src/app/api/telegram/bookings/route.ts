// ======================================================================
// SAAS Cabañas - Gestión de Bookings (Telegram & CRM)
// Route: /api/telegram/bookings
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthRoles } from '@/shared/lib/supabase/authServerHelper';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*, contacts(*), cabins(*)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings });
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
      contact_id,
      cabin_name,
      cabin_id,
      check_in,
      check_out,
      guests_count,
      total_amount,
      currency,
      status,
      notes,
    } = body;

    if (!cabin_name || !check_in || !check_out) {
      return NextResponse.json({ error: 'cabin_name, check_in y check_out son obligatorios.' }, { status: 400 });
    }

    const { data: newBooking, error } = await supabase
      .from('bookings')
      .insert({
        contact_id: contact_id || null,
        cabin_name,
        cabin_id: cabin_id || null,
        check_in,
        check_out,
        guests_count: guests_count || 2,
        total_amount: total_amount || 0,
        currency: currency || 'ARS',
        status: status || 'pending',
        notes: notes || null,
      })
      .select('*, contacts(*), cabins(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, booking: newBooking });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const body = await req.json();
    const { id, status, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'id de booking es requerido.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const { data: updated, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select('*, contacts(*), cabins(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, booking: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
