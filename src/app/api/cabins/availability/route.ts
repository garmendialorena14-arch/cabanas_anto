// ======================================================================
// SAAS Cabañas - Consulta Dinámica de Disponibilidad y Superposiciones
// Route: /api/cabins/availability
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthRoles } from '@/shared/lib/supabase/authServerHelper';
import { checkCabinAvailability } from '@/shared/lib/availability';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const checkIn = req.nextUrl.searchParams.get('check_in');
    const checkOut = req.nextUrl.searchParams.get('check_out');
    const guestCount = Number(req.nextUrl.searchParams.get('guest_count')) || 2;
    const hasReducedMobility = req.nextUrl.searchParams.get('has_reduced_mobility') === 'true';
    const preferredCabinId = req.nextUrl.searchParams.get('preferred_cabin_id') || undefined;
    const excludeId = req.nextUrl.searchParams.get('exclude_id') || undefined;

    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: 'check_in y check_out son requeridos (YYYY-MM-DD)' }, { status: 400 });
    }

    const availability = await checkCabinAvailability(supabase, {
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guestCount,
      hasReducedMobility,
      preferredCabinId,
      excludeReservationId: excludeId,
    });

    return NextResponse.json({
      ok: true,
      ...availability,
    });
  } catch (err: any) {
    console.error('Error en /api/cabins/availability:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
