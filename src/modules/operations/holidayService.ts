import { HolidayException } from '@/shared/types';

export interface ArgentineHolidayApiItem {
  motivo: string;
  dia: number;
  mes: number;
  id?: string;
  tipo: string;
  info?: string;
  opcional?: string;
}

// Fallback curado para Argentina 2026 / 2027
export const ARGENTINA_OFFICIAL_HOLIDAYS_FALLBACK: Array<Omit<HolidayException, 'id'>> = [
  {
    name: 'Año Nuevo',
    start_date: '2026-01-01',
    end_date: '2026-01-01',
    type: 'feriado_nacional',
    description: 'Feriado Inamovible Nacional',
    rate_multiplier: 1.30,
    min_nights: 3,
    is_official_api: true,
  },
  {
    name: 'Carnaval (Finde Largo XL)',
    start_date: '2026-02-14',
    end_date: '2026-02-17',
    type: 'fin_de_semana_largo',
    description: 'Feriado de Carnaval - Alta Ocupación',
    rate_multiplier: 1.35,
    min_nights: 4,
    is_official_api: true,
  },
  {
    name: 'Día Nacional de la Memoria por la Verdad y la Justicia',
    start_date: '2026-03-24',
    end_date: '2026-03-24',
    type: 'feriado_nacional',
    description: 'Feriado Inamovible',
    rate_multiplier: 1.15,
    min_nights: 2,
    is_official_api: true,
  },
  {
    name: 'Viernes Santo & Malvinas (Semana Santa XL)',
    start_date: '2026-04-02',
    end_date: '2026-04-05',
    type: 'fin_de_semana_largo',
    description: 'Semana Santa y Día del Veterano de Malvinas',
    rate_multiplier: 1.35,
    min_nights: 4,
    is_official_api: true,
  },
  {
    name: 'Día del Trabajador',
    start_date: '2026-05-01',
    end_date: '2026-05-03',
    type: 'fin_de_semana_largo',
    description: 'Finde largo por Día del Trabajador',
    rate_multiplier: 1.20,
    min_nights: 3,
    is_official_api: true,
  },
  {
    name: 'Revolución de Mayo',
    start_date: '2026-05-25',
    end_date: '2026-05-25',
    type: 'feriado_nacional',
    description: 'Feriado Inamovible',
    rate_multiplier: 1.15,
    min_nights: 2,
    is_official_api: true,
  },
  {
    name: 'Paso a la Inmortalidad de Belgrano (Bandera)',
    start_date: '2026-06-20',
    end_date: '2026-06-21',
    type: 'fin_de_semana_largo',
    description: 'Finde largo invernal',
    rate_multiplier: 1.20,
    min_nights: 2,
    is_official_api: true,
  },
  {
    name: 'Día de la Independencia',
    start_date: '2026-07-09',
    end_date: '2026-07-12',
    type: 'fin_de_semana_largo',
    description: 'Finde largo turístico de julio',
    rate_multiplier: 1.25,
    min_nights: 3,
    is_official_api: true,
  },
  {
    name: 'Paso a la Inmortalidad del Gral. José de San Martín',
    start_date: '2026-08-15',
    end_date: '2026-08-17',
    type: 'fin_de_semana_largo',
    description: 'Finde largo trasladable',
    rate_multiplier: 1.20,
    min_nights: 3,
    is_official_api: true,
  },
  {
    name: 'Día del Respeto a la Diversidad Cultural',
    start_date: '2026-10-10',
    end_date: '2026-10-12',
    type: 'fin_de_semana_largo',
    description: 'Finde largo de primavera',
    rate_multiplier: 1.25,
    min_nights: 3,
    is_official_api: true,
  },
  {
    name: 'Día de la Soberanía Nacional',
    start_date: '2026-11-20',
    end_date: '2026-11-23',
    type: 'fin_de_semana_largo',
    description: 'Finde largo turístico de noviembre',
    rate_multiplier: 1.25,
    min_nights: 3,
    is_official_api: true,
  },
  {
    name: 'Inmaculada Concepción de María',
    start_date: '2026-12-08',
    end_date: '2026-12-08',
    type: 'feriado_nacional',
    description: 'Feriado Inamovible',
    rate_multiplier: 1.15,
    min_nights: 2,
    is_official_api: true,
  },
  {
    name: 'Navidad & Fin de Año',
    start_date: '2026-12-24',
    end_date: '2027-01-02',
    type: 'fin_de_semana_largo',
    description: 'Fiestas y Apertura Oficial Temporada Alta',
    rate_multiplier: 1.35,
    min_nights: 4,
    is_official_api: true,
  },
];

/**
 * Consulta la API pública de feriados de Argentina (nolaborables.com.ar).
 * Si falla o está offline, recurre al dataset oficial curado sin interrumpir la operación.
 */
export async function fetchArgentineHolidays(year: number = 2026): Promise<Array<Omit<HolidayException, 'id'>>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://nolaborables.com.ar/api/v2/feriados/${year}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API respondió status ${response.status}`);
    }

    const data: ArgentineHolidayApiItem[] = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return ARGENTINA_OFFICIAL_HOLIDAYS_FALLBACK;
    }

    return data.map((item) => {
      const monthStr = String(item.mes).padStart(2, '0');
      const dayStr = String(item.dia).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      const isLongWeekend = item.tipo === 'puente' || item.tipo === 'trasladable';

      return {
        name: item.motivo,
        start_date: dateStr,
        end_date: dateStr,
        type: isLongWeekend ? 'fin_de_semana_largo' : 'feriado_nacional',
        description: item.info || `Feriado oficial ${item.tipo}`,
        rate_multiplier: isLongWeekend ? 1.25 : 1.15,
        min_nights: isLongWeekend ? 3 : 1,
        is_official_api: true,
      };
    });
  } catch (error) {
    console.warn('Uso de dataset local curado de feriados por fallback:', error);
    return ARGENTINA_OFFICIAL_HOLIDAYS_FALLBACK;
  }
}
