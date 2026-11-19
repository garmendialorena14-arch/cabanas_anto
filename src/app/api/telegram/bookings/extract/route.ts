// ======================================================================
// SAAS Cabañas - Extracción Inteligente de Datos de Reserva desde Chat
// Route: /api/telegram/bookings/extract
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthRoles } from '@/shared/lib/supabase/authServerHelper';
import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from '@/modules/ai/geminiClient';
import { checkCabinAvailability } from '@/shared/lib/availability';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const conversationId = req.nextUrl.searchParams.get('conversation_id');
    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id es requerido' }, { status: 400 });
    }

    // 1. Obtener la conversación y el contacto
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('*, contacts(*)')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    // 2. Obtener lista de cabañas del predio y cotización del Dólar Blue
    const { data: cabins } = await supabase
      .from('cabins')
      .select('id, cabin_number, name, floor, max_guests, has_accessible_mobility, base_rate_usd')
      .eq('is_active', true)
      .order('cabin_number');

    const { data: rateData } = await supabase
      .from('exchange_rates')
      .select('sell_rate')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const blueRate = rateData?.sell_rate || 1285;

    // 3. Obtener últimos 30 mensajes para análisis completo
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender_type, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(30);

    const transcript = (msgs || [])
      .reverse()
      .map((m: any) => `${m.sender_type === 'user' ? 'Huésped' : 'Asistente'}: ${m.content}`)
      .join('\n');

    // Valores por defecto
    const today = new Date();
    const defaultCheckIn = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultCheckOut = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const extracted: any = {
      guest_name: conv.contacts?.full_name && !conv.contacts.full_name.startsWith('Huésped ') ? conv.contacts.full_name : '',
      guest_phone: conv.contacts?.phone || '',
      guest_dni: '',
      check_in_date: defaultCheckIn,
      check_out_date: defaultCheckOut,
      guest_count: 2,
      adults_count: 2,
      children_count: 0,
      cabin_id: '',
      cabin_number: 1,
      total_usd: 0,
      sena_usd: 0,
      vehicle_license_plate: '',
      has_celiac_sin_tacc: false,
      has_reduced_mobility: false,
      no_availability: false,
      unavailable_reason: '',
      missing_fields: [] as string[],
      notes: '',
    };

    let requestedCabinNumber: number | null = null;

    const apiKey = getGeminiApiKey();
    if (apiKey && transcript.trim().length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Analiza detalladamente la conversación de chat entre el huésped y el complejo de cabañas para extraer TODOS los datos de la reserva turística en formato JSON estricto.

Lista de Cabañas existentes en el predio:
${(cabins || []).map((c: any) => `- Cabaña ${c.cabin_number} ("${c.name}"): capacidad máx ${c.max_guests} personas, planta ${c.floor}, accesible movilidad reducida: ${c.has_accessible_mobility ? 'SÍ' : 'NO'}, tarifa base: USD ${c.base_rate_usd}/noche`).join('\n')}

Dólar Blue hoy: $${blueRate} ARS/USD.
Fecha actual: ${today.toISOString().split('T')[0]}.

Campos a extraer del chat (si no se menciona o no está seguro, devolver null o valor por defecto según corresponda):
1. guest_name: Nombre y Apellido completo del titular de la reserva.
2. guest_phone: Teléfono o celular de contacto.
3. guest_dni: Número de DNI o Pasaporte del titular o acompañantes.
4. check_in_date: Fecha de ingreso en formato YYYY-MM-DD (ej: si dice 20/11/2026, devolver "2026-11-20").
5. check_out_date: Fecha de salida en formato YYYY-MM-DD (ej: si dice 23/11/2026, devolver "2026-11-23").
6. guest_count: Número total entero de personas (ej: 4).
7. adults_count: Cantidad de adultos enteros (ej: 2).
8. children_count: Cantidad de niños enteros (ej: 2).
9. cabin_number: Número de cabaña mencionada o solicitada (1 a 12), si la hubo.
10. total_usd: Monto total cotizado o acordado en USD (ej: 300).
11. sena_usd: Monto de la seña en USD (ej: 90, habitualmente el 30% del total).
12. vehicle_license_plate: Patente o dominio del vehículo para la cochera cubierta (ej: "AB 123 CD" o "ABC 123").
13. has_celiac_sin_tacc: Booleano true si indicaron celiaquía o necesidad de desayuno Sin TACC; false en caso contrario.
14. has_reduced_mobility: Booleano true si indicaron movilidad reducida o necesidad de planta baja; false si aclararon expresamente que no hay movilidad reducida o no lo mencionaron.
15. notes: Notas especiales, aclaraciones o pedidos del huésped.

Conversación:
${transcript}

Responde ÚNICAMENTE con el objeto JSON válido sin bloques markdown ni explicaciones adicionales.`;

        const aiRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { temperature: 0.1 },
        });

        const rawText = (aiRes.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(rawText);

        if (parsed.guest_name && typeof parsed.guest_name === 'string' && parsed.guest_name.trim()) {
          extracted.guest_name = parsed.guest_name.trim();
        }
        if (parsed.guest_phone && typeof parsed.guest_phone === 'string' && parsed.guest_phone.trim()) {
          extracted.guest_phone = parsed.guest_phone.trim();
        }
        if (parsed.guest_dni && typeof parsed.guest_dni === 'string' && parsed.guest_dni.trim()) {
          extracted.guest_dni = parsed.guest_dni.trim();
        }
        if (parsed.check_in_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.check_in_date)) {
          extracted.check_in_date = parsed.check_in_date;
        }
        if (parsed.check_out_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.check_out_date)) {
          extracted.check_out_date = parsed.check_out_date;
        }
        if (parsed.guest_count && Number(parsed.guest_count) > 0) {
          extracted.guest_count = Number(parsed.guest_count);
        }
        if (parsed.adults_count !== undefined) {
          extracted.adults_count = Number(parsed.adults_count);
        }
        if (parsed.children_count !== undefined) {
          extracted.children_count = Number(parsed.children_count);
        }
        if (parsed.total_usd && Number(parsed.total_usd) > 0) {
          extracted.total_usd = Number(parsed.total_usd);
        }
        if (parsed.sena_usd && Number(parsed.sena_usd) > 0) {
          extracted.sena_usd = Number(parsed.sena_usd);
        } else if (extracted.total_usd > 0) {
          extracted.sena_usd = Math.round(extracted.total_usd * 0.3);
        }
        if (parsed.vehicle_license_plate && typeof parsed.vehicle_license_plate === 'string') {
          extracted.vehicle_license_plate = parsed.vehicle_license_plate.trim().toUpperCase();
        }
        if (parsed.has_celiac_sin_tacc !== undefined) {
          extracted.has_celiac_sin_tacc = Boolean(parsed.has_celiac_sin_tacc);
        }
        if (parsed.has_reduced_mobility !== undefined) {
          extracted.has_reduced_mobility = Boolean(parsed.has_reduced_mobility);
        }
        if (parsed.notes) {
          extracted.notes = parsed.notes.trim();
        }
        if (parsed.cabin_number) {
          requestedCabinNumber = Number(parsed.cabin_number);
        }
      } catch (aiErr) {
        console.warn('Error extrayendo con Gemini:', aiErr);
      }
    }

    // 4. VERIFICACIÓN RIGUROSA DE DISPONIBILIDAD REAL EN LA BASE DE DATOS
    // Se excluyen cabañas ocupadas en ese rango y se verifica accesibilidad PB y capacidad
    const preferredCabin = requestedCabinNumber
      ? (cabins || []).find((c: any) => c.cabin_number === requestedCabinNumber)
      : null;

    const availability = await checkCabinAvailability(supabase, {
      checkInDate: extracted.check_in_date,
      checkOutDate: extracted.check_out_date,
      guestCount: extracted.guest_count,
      hasReducedMobility: extracted.has_reduced_mobility,
      preferredCabinId: preferredCabin?.id,
    });

    if (availability.hasAvailability && availability.bestCabin) {
      extracted.cabin_id = availability.bestCabin.id;
      extracted.cabin_number = availability.bestCabin.cabin_number;
    } else {
      extracted.cabin_id = '';
      extracted.cabin_number = null;
      extracted.no_availability = true;
      extracted.unavailable_reason = availability.reason || 'Sin disponibilidad para esas fechas.';
    }

    // Si total_usd sigue en 0, calcular noches y tarifa base de la cabaña seleccionada
    if (extracted.total_usd === 0 && extracted.cabin_id) {
      const targetCabin = cabins?.find((c: any) => c.id === extracted.cabin_id);
      if (targetCabin) {
        const inD = new Date(extracted.check_in_date);
        const outD = new Date(extracted.check_out_date);
        const nights = Math.max(1, Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24)));
        extracted.total_usd = Number(targetCabin.base_rate_usd) * nights;
        extracted.sena_usd = Math.round(extracted.total_usd * 0.3);
      }
    }

    // 5. Calcular lista de campos obligatorios faltantes
    const missing: string[] = [];
    if (!extracted.guest_name || extracted.guest_name.toLowerCase().includes('huésped')) {
      missing.push('Nombre y Apellido');
    }
    if (!extracted.guest_dni) {
      missing.push('DNI / Pasaporte');
    }
    if (!extracted.guest_phone) {
      missing.push('Teléfono Celular');
    }
    if (!extracted.vehicle_license_plate) {
      missing.push('Patente del Vehículo');
    }
    if (extracted.no_availability) {
      missing.push(`⚠️ ALERTA DE DISPONIBILIDAD: ${extracted.unavailable_reason}`);
    }
    extracted.missing_fields = missing;

    return NextResponse.json({
      ok: true,
      extracted,
      blueRate,
      availability: {
        hasAvailability: availability.hasAvailability,
        reason: availability.reason,
        occupiedCabinIds: availability.occupiedCabinIds,
        occupiedDetails: availability.occupiedDetails,
        freeCabins: availability.freeCabins,
        suitableCabins: availability.suitableCabins,
      },
    });
  } catch (err: any) {
    console.error('Error en /api/telegram/bookings/extract:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
