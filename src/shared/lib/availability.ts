// ======================================================================
// SAAS Cabañas - Motor Central de Disponibilidad y Prevención de Superposiciones
// src/shared/lib/availability.ts
// ======================================================================

export interface CabinOccupancyDetail {
  guest_name: string;
  check_in_date: string;
  check_out_date: string;
}

export interface CabinAvailabilityResult {
  allCabins: any[];
  occupiedCabinIds: string[];
  occupiedDetails: Record<string, CabinOccupancyDetail[]>;
  freeCabins: any[];
  suitableCabins: any[];
  bestCabin: any | null;
  hasAvailability: boolean;
  reason?: string;
}

/**
 * Verifica si dos rangos de fechas de reserva se superponen.
 * En hotelería: Check-in 14:00 hs / Check-out 10:00 hs.
 * Si la reserva A sale el 2026-11-20 y la reserva B entra el 2026-11-20, NO hay superposición.
 * Hay superposición sii: A.check_in < B.check_out AND A.check_out > B.check_in
 */
export function areDatesOverlapping(
  inA: string,
  outA: string,
  inB: string,
  outB: string
): boolean {
  if (!inA || !outA || !inB || !outB) return false;
  return inA < outB && outA > inB;
}

/**
 * Consulta la base de datos Supabase para obtener el estado de ocupación
 * y seleccionar la cabaña óptima 100% libre según fechas, pax y accesibilidad.
 */
export async function checkCabinAvailability(
  supabase: any,
  params: {
    checkInDate: string;
    checkOutDate: string;
    guestCount?: number;
    hasReducedMobility?: boolean;
    preferredCabinId?: string;
    excludeReservationId?: string;
  }
): Promise<CabinAvailabilityResult> {
  const {
    checkInDate,
    checkOutDate,
    guestCount = 2,
    hasReducedMobility = false,
    preferredCabinId,
    excludeReservationId,
  } = params;

  // 1. Obtener todas las cabañas activas del complejo
  const { data: cabins, error: cabErr } = await supabase
    .from('cabins')
    .select('id, cabin_number, name, floor, max_guests, has_accessible_mobility, base_rate_usd, is_active')
    .eq('is_active', true)
    .order('cabin_number');

  if (cabErr || !cabins) {
    throw new Error(cabErr?.message || 'Error al obtener lista de cabañas');
  }

  // 2. Obtener reservas no canceladas que se superpongan con el período solicitado
  let query = supabase
    .from('reservations')
    .select('id, cabin_id, guest_name, check_in_date, check_out_date, status')
    .neq('status', 'cancelada')
    .lt('check_in_date', checkOutDate)
    .gt('check_out_date', checkInDate);

  if (excludeReservationId) {
    query = query.neq('id', excludeReservationId);
  }

  const { data: overlappingRes, error: resErr } = await query;
  if (resErr) {
    throw new Error(resErr.message || 'Error al verificar superposiciones en reservations');
  }

  const occupiedDetails: Record<string, CabinOccupancyDetail[]> = {};
  const occupiedCabinIds = new Set<string>();

  (overlappingRes || []).forEach((r: any) => {
    if (r.cabin_id) {
      occupiedCabinIds.add(r.cabin_id);
      if (!occupiedDetails[r.cabin_id]) {
        occupiedDetails[r.cabin_id] = [];
      }
      occupiedDetails[r.cabin_id].push({
        guest_name: r.guest_name || 'Huésped',
        check_in_date: r.check_in_date,
        check_out_date: r.check_out_date,
      });
    }
  });

  const occupiedCabinIdsArray = Array.from(occupiedCabinIds);

  // 3. Filtrar cabañas desocupadas en ese rango de fechas
  const freeCabins = cabins.filter((c: any) => !occupiedCabinIds.has(c.id));

  // 4. Filtrar por requerimientos del huésped:
  // - Movilidad reducida: OBLIGATORIO c.has_accessible_mobility === true (Planta Baja PB)
  // - Capacidad: c.max_guests >= guestCount
  const suitableCabins = freeCabins.filter((c: any) => {
    if (hasReducedMobility && !c.has_accessible_mobility) return false;
    if (guestCount && c.max_guests < guestCount) return false;
    return true;
  });

  // Ordenar cabañas adecuadas:
  // Preferir la cabaña que mejor se ajuste a la capacidad requerida (para no ocupar una de 6 si vienen 2)
  // y luego por número de cabaña ascendente
  suitableCabins.sort((a: any, b: any) => {
    if (a.max_guests !== b.max_guests) {
      return a.max_guests - b.max_guests;
    }
    return a.cabin_number - b.cabin_number;
  });

  // Si hay una cabaña preferida y está desocupada y es apta, mantenerla
  let bestCabin: any | null = null;
  if (preferredCabinId) {
    const pref = suitableCabins.find((c: any) => c.id === preferredCabinId);
    if (pref) {
      bestCabin = pref;
    }
  }

  if (!bestCabin && suitableCabins.length > 0) {
    bestCabin = suitableCabins[0];
  }

  const hasAvailability = suitableCabins.length > 0;
  let reason: string | undefined = undefined;

  if (!hasAvailability) {
    if (freeCabins.length === 0) {
      reason = `El complejo se encuentra con 100% de ocupación para las fechas del ${checkInDate} al ${checkOutDate}.`;
    } else if (hasReducedMobility && !freeCabins.some((c: any) => c.has_accessible_mobility)) {
      reason = `No hay cabañas accesibles en Planta Baja disponibles para las fechas del ${checkInDate} al ${checkOutDate}. Las unidades en PB (Cabañas 1 a 4) están ocupadas.`;
    } else if (guestCount && !freeCabins.some((c: any) => c.max_guests >= guestCount)) {
      reason = `No hay cabañas disponibles con capacidad para ${guestCount} personas entre el ${checkInDate} y ${checkOutDate}.`;
    } else {
      reason = `No hay cabañas libres que cumplan con los requerimientos para esas fechas.`;
    }
  }

  return {
    allCabins: cabins,
    occupiedCabinIds: occupiedCabinIdsArray,
    occupiedDetails,
    freeCabins,
    suitableCabins,
    bestCabin,
    hasAvailability,
    reason,
  };
}
