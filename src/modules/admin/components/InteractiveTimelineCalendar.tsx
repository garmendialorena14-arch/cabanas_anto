'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  eachDayOfInterval,
  isSameDay,
  isWeekend,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  Car,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Cabin, Reservation, HolidayException } from '@/shared/types';

export type CalendarScale = 'dias' | 'semana' | 'quincena' | 'mes';

interface InteractiveTimelineCalendarProps {
  cabins: Cabin[];
  reservations: Reservation[];
  holidays: HolidayException[];
  onReservationDoubleClick: (reservation: Reservation) => void;
  onEmptySlotClick?: (cabinId: string, dateStr: string) => void;
  onDateChange?: (date: Date) => void;
}

export default function InteractiveTimelineCalendar({
  cabins,
  reservations,
  holidays,
  onReservationDoubleClick,
  onEmptySlotClick,
}: InteractiveTimelineCalendarProps) {
  // Fecha central actual
  const [currentDate, setCurrentDate] = useState<Date>(new Date('2026-11-16T12:00:00'));
  const [scale, setScale] = useState<CalendarScale>('semana');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Orden ascendente estricto de cabañas 1 a 12
  const sortedCabins = useMemo(() => {
    return [...cabins].sort((a, b) => a.cabin_number - b.cabin_number);
  }, [cabins]);

  // Cantidad de días a mostrar según la escala seleccionada
  const daysCount = useMemo(() => {
    switch (scale) {
      case 'dias':
        return 3;
      case 'semana':
        return 7;
      case 'quincena':
        return 15;
      case 'mes':
        return 30;
      default:
        return 7;
    }
  }, [scale]);

  // Generar lista de días del período
  const periodDays = useMemo(() => {
    const start = scale === 'semana' ? startOfWeek(currentDate, { weekStartsOn: 1 }) : currentDate;
    const end = addDays(start, daysCount - 1);
    return eachDayOfInterval({ start, end });
  }, [currentDate, daysCount, scale]);

  // Navegación temporal
  const handlePrev = () => {
    setCurrentDate((prev) => subDays(prev, daysCount));
  };

  const handleNext = () => {
    setCurrentDate((prev) => addDays(prev, daysCount));
  };

  const handleToday = () => {
    setCurrentDate(new Date('2026-11-16T12:00:00'));
  };

  // Helper para detectar si un día es feriado o fecha especial
  const getHolidayForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return holidays.find((h) => {
      return dayStr >= h.start_date && dayStr <= h.end_date;
    });
  };

  // Estilo de color según el estado de la reserva
  const getReservationStyle = (status: string) => {
    switch (status) {
      case 'checkin':
        // Verde: huésped presente en el predio
        return 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-900/30';
      case 'confirmada':
        // Azul: 100% abonada
        return 'bg-blue-600 border-blue-700 text-white shadow-blue-900/30';
      case 'senada':
        // Ámbar: Seña abonada (saldo pendiente)
        return 'bg-amber-500 border-amber-600 text-slate-950 shadow-amber-900/30';
      case 'checkout':
        // Gris: Finalizada
        return 'bg-slate-500 border-slate-600 text-slate-100 shadow-slate-900/30';
      default:
        return 'bg-indigo-600 border-indigo-700 text-white';
    }
  };

  // Ancho por día en píxeles (Opción B: scroll horizontal continuo fluido)
  const dayColWidth = scale === 'dias' ? 320 : scale === 'semana' ? 200 : scale === 'quincena' ? 140 : 110;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col">
      {/* 1. BARRA SUPERIOR DE CONTROLES DEL CALENDARIO */}
      <div className="p-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900">
        {/* Navegación de Fechas */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-colors shadow-xs"
            title="Período anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-bold text-slate-100 transition-colors shadow-xs"
          >
            Hoy
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-colors shadow-xs"
            title="Período siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="text-sm font-bold text-white capitalize ml-2">
            {format(periodDays[0], "MMMM yyyy", { locale: es })}
            {periodDays[0].getMonth() !== periodDays[periodDays.length - 1].getMonth() &&
              ` / ${format(periodDays[periodDays.length - 1], "MMMM yyyy", { locale: es })}`}
          </span>
        </div>

        {/* Selector de Escalas: Días, Semana, Quincena, Mes */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setScale('dias')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scale === 'dias'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Días (3d)
          </button>
          <button
            onClick={() => setScale('semana')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scale === 'semana'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setScale('quincena')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scale === 'quincena'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Quincena
          </button>
          <button
            onClick={() => setScale('mes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scale === 'mes'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mes
          </button>
        </div>

        {/* Leyenda de Horarios & Estados */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Check-in: 14 hs
          </span>
          <span className="flex items-center gap-1 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Check-out: 10 am
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3.5 h-3.5 rounded border border-amber-300" style={{
              background: 'repeating-linear-gradient(45deg, #fef08a, #fef08a 3px, #fef9c3 3px, #fef9c3 6px)',
            }} />
            Rotación 10 a 14hs
          </span>
        </div>
      </div>

      {/* 2. GRILLA DEL CALENDARIO (TIMELINE CON SCROLL HORIZONTAL Y VERTICAL TIPO EXCEL) */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto max-h-[calc(100vh-270px)] min-h-[460px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 bg-slate-950 relative border-t border-slate-800"
      >
        <div
          className="inline-block min-w-full align-top"
          style={{ width: `${190 + periodDays.length * dayColWidth}px` }}
        >
          {/* CABECERA: COLUMNA CABAÑAS + DÍAS DEL PERÍODO (FIJA EN TOP) */}
          <div className="flex border-b border-slate-800 bg-slate-900 sticky top-0 z-30 shadow-md">
            {/* Esquina superior izquierda fija en Top y en Left */}
            <div className="w-[190px] min-w-[190px] max-w-[190px] flex-shrink-0 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 border-r border-slate-800 bg-slate-900 sticky left-0 z-40 flex items-center justify-between">
              <span>Cabañas</span>
              <span className="text-[10px] text-amber-400 font-mono">1 a 12</span>
            </div>

            {/* Columnas de los días con resaltes de Fines de Semana y Feriados */}
            <div className="flex flex-1">
              {periodDays.map((day) => {
                const dayWeekend = isWeekend(day);
                const holiday = getHolidayForDay(day);
                const isToday = isSameDay(day, new Date('2026-11-16T12:00:00'));

                return (
                  <div
                    key={day.toISOString()}
                    style={{ width: `${dayColWidth}px` }}
                    className={`flex-shrink-0 px-2 py-1.5 text-center border-r border-slate-800 relative select-none transition-colors ${
                      holiday
                        ? 'bg-rose-950/80'
                        : dayWeekend
                        ? 'bg-amber-950/50'
                        : isToday
                        ? 'bg-blue-950/70'
                        : 'bg-slate-900'
                    }`}
                  >
                    {/* Badge de Feriado o Fin de Semana */}
                    {holiday && (
                      <span className="block truncate text-[9px] font-black uppercase text-rose-300 bg-rose-900/80 rounded px-1 mb-0.5">
                        ⭐ {holiday.name}
                      </span>
                    )}
                    {!holiday && dayWeekend && (
                      <span className="block text-[9px] font-bold uppercase text-amber-400 mb-0.5">
                        Finde
                      </span>
                    )}

                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-[11px] font-semibold uppercase text-slate-400">
                        {format(day, 'EEE', { locale: es })}
                      </span>
                      <span
                        className={`text-xs font-black rounded-md w-6 h-6 flex items-center justify-center ${
                          isToday
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-white'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Sub-marcas de Horarios 10am / 14hs */}
                    <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-0.5 px-0.5 border-t border-slate-800/80 pt-0.5">
                      <span title="Horario Check-out: 10:00 hs">10:00</span>
                      <span title="Horario Check-in: 14:00 hs">14:00</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CUERPO: FILAS DE LAS CABAÑAS (1 a 12) */}
          <div className="divide-y divide-slate-800">
            {sortedCabins.map((cabin) => {
              // Obtener reservas activas para esta cabaña en el período
              const cabinReservations = reservations.filter(
                (r) => r.cabin_id === cabin.id && r.status !== 'cancelada'
              );

              return (
                <div key={cabin.id} className="flex hover:bg-slate-900/50 transition-colors">
                  {/* LATERAL IZQUIERDO: DETALLE DE LA CABAÑA (FIJA EN LEFT CON STICKY) */}
                  <div className="w-[190px] min-w-[190px] max-w-[190px] flex-shrink-0 px-2.5 py-1.5 border-r border-slate-800 bg-slate-900 sticky left-0 z-20 flex flex-col justify-center select-none shadow-sm">
                    {/* Fila 1: N° Cabaña + Nombre corto + PB/PA */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black flex items-center justify-center flex-shrink-0">
                          {cabin.cabin_number}
                        </span>
                        <h4 className="text-xs font-bold text-white truncate max-w-[95px]" title={cabin.name}>
                          {cabin.name.replace(/\(.*?\)/g, '').trim()}
                        </h4>
                      </div>

                      {/* Planta PB / PA */}
                      <span
                        className={`text-[9px] font-black px-1 py-0.5 rounded flex-shrink-0 ${
                          cabin.floor === 'PB'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                            : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                        }`}
                      >
                        {cabin.floor}
                      </span>
                    </div>

                    {/* Fila 2: Metadata: Pax, Cochera y Accesibilidad ♿ */}
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5 font-medium">
                        <Users className="w-3 h-3 text-slate-400" /> {cabin.max_guests}p
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 font-mono text-slate-300">
                        <Car className="w-3 h-3 text-slate-400" /> C{cabin.cabin_number}
                      </span>

                      {/* LOGO INTERNACIONAL DE MOVILIDAD REDUCIDA ♿ */}
                      {cabin.has_accessible_mobility && (
                        <span
                          className="ml-auto inline-flex items-center text-[10px] font-black px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40"
                          title="Cabaña adaptada para movilidad reducida (Rampas, baño accesible)"
                        >
                          ♿
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CALENDARIO HORARIO / GANTT DE ESTA CABAÑA */}
                  <div className="flex flex-1 relative h-[68px] bg-slate-950/60">
                    {/* Columnas de fondo para cada día */}
                    {periodDays.map((day) => {
                      const dayWeekend = isWeekend(day);
                      const holiday = getHolidayForDay(day);
                      const dayStr = format(day, 'yyyy-MM-dd');

                      return (
                        <div
                          key={day.toISOString()}
                          onClick={() => onEmptySlotClick && onEmptySlotClick(cabin.id, dayStr)}
                          style={{ width: `${dayColWidth}px` }}
                          title={`+ Clic para crear reserva en ${cabin.name} (Ingreso: ${dayStr} 14hs)`}
                          className={`flex-shrink-0 h-full border-r border-slate-800/60 relative cursor-pointer hover:bg-emerald-500/10 transition-colors group/cell ${
                            holiday
                              ? 'bg-rose-950/20'
                              : dayWeekend
                              ? 'bg-amber-950/15'
                              : 'bg-slate-950'
                          }`}
                        >
                          {/* Línea divisoria suave de las 10:00 y 14:00 hs */}
                          <div
                            className="absolute top-0 bottom-0 border-r border-dashed border-slate-800/60"
                            style={{ left: `${(10 / 24) * 100}%` }}
                          />
                          <div
                            className="absolute top-0 bottom-0 border-r border-dashed border-slate-800/60"
                            style={{ left: `${(14 / 24) * 100}%` }}
                          />
                        </div>
                      );
                    })}

                    {/* RENDERIZADO DE RESERVAS CONTINUAS */}
                    {cabinReservations.map((reservation) => {
                      const resCheckIn = new Date(`${reservation.check_in_date}T14:00:00`);
                      const resCheckOut = new Date(`${reservation.check_out_date}T10:00:00`);
                      const periodStart = periodDays[0];
                      const periodEnd = addDays(periodDays[periodDays.length - 1], 1);

                      // Si está completamente fuera de rango visible, no pintar
                      if (resCheckOut <= periodStart || resCheckIn >= periodEnd) return null;

                      // Calcular posiciones en píxeles
                      const totalPeriodMs = periodEnd.getTime() - periodStart.getTime();
                      const visibleStartMs = Math.max(resCheckIn.getTime(), periodStart.getTime());
                      const visibleEndMs = Math.min(resCheckOut.getTime(), periodEnd.getTime());

                      const leftPx =
                        ((visibleStartMs - periodStart.getTime()) / totalPeriodMs) *
                        (periodDays.length * dayColWidth);
                      const widthPx = Math.max(
                        30,
                        ((visibleEndMs - visibleStartMs) / totalPeriodMs) *
                          (periodDays.length * dayColWidth)
                      );

                      const colorClasses = getReservationStyle(reservation.status);

                      return (
                        <div
                          key={reservation.id}
                          onDoubleClick={() => onReservationDoubleClick(reservation)}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                          }}
                          className={`absolute top-1.5 bottom-1.5 rounded-lg border ${colorClasses} px-2 py-0.5 cursor-pointer shadow-md hover:brightness-110 transition-all z-10 flex flex-col justify-center overflow-hidden select-none group`}
                          title={`Doble clic para abrir ficha: ${reservation.guest_name} (${reservation.check_in_date} 14hs al ${reservation.check_out_date} 10am) • Canal: ${reservation.booking_channel || 'Directa'} • Por: ${reservation.created_by_role || 'Admin'}`}
                        >
                          {/* Fila 1: APELLIDO (Mayúsculas) + Canal + PAX */}
                          <div className="flex items-center justify-between gap-1 leading-tight">
                            <span className="font-black text-xs uppercase truncate tracking-wide flex items-center gap-1">
                              <span>{reservation.guest_name.split(' ').slice(-1)[0] || reservation.guest_name}</span>
                              {reservation.booking_channel === 'telegram' && <span title="Canal: Telegram" className="text-[10px]">✈️</span>}
                              {reservation.booking_channel === 'web_directa' && <span title="Canal: Web Directa" className="text-[10px]">🌐</span>}
                              {reservation.booking_channel === 'mostrador' && <span title="Canal: Mostrador" className="text-[10px]">🏢</span>}
                              {reservation.booking_channel === 'telefono' && <span title="Canal: Teléfono" className="text-[10px]">📞</span>}
                            </span>
                            <span className="text-[10px] font-bold opacity-90 flex-shrink-0">
                              {reservation.guest_count}p
                            </span>
                          </div>

                          {/* Fila 2: Patente + Badges TACC y Discapacidad */}
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] opacity-90 truncate">
                            {reservation.vehicle_license_plate ? (
                              <span className="font-mono bg-black/20 px-1 rounded text-[9px]">
                                {reservation.vehicle_license_plate}
                              </span>
                            ) : null}

                            {reservation.has_celiac_sin_tacc && (
                              <span title="Desayuno Sin TACC" className="text-xs">
                                🌾
                              </span>
                            )}
                            {reservation.has_reduced_mobility && (
                              <span title="Movilidad reducida / silla de ruedas" className="text-xs">
                                ♿
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* FRANJA DE ROTACIÓN: MISMO DÍA EGRESO 10AM E INGRESO 14HS */}
                    {periodDays.map((day) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const departing = cabinReservations.find(
                        (r) => r.check_out_date === dayStr
                      );
                      const arriving = cabinReservations.find(
                        (r) => r.check_in_date === dayStr
                      );

                      // Si coinciden egreso e ingreso el mismo día para esta cabaña
                      if (departing && arriving) {
                        const dayIndex = periodDays.findIndex((d) => isSameDay(d, day));
                        if (dayIndex === -1) return null;

                        const dayLeftPx = dayIndex * dayColWidth;
                        // 10:00 hs = 10/24 del día, 14:00 hs = 14/24 del día -> duración 4 horas = 4/24 del día
                        const slotLeftPx = dayLeftPx + (10 / 24) * dayColWidth;
                        const slotWidthPx = (4 / 24) * dayColWidth;

                        return (
                          <div
                            key={`turnaround-${cabin.id}-${dayStr}`}
                            style={{
                              left: `${slotLeftPx}px`,
                              width: `${slotWidthPx}px`,
                              background:
                                'repeating-linear-gradient(45deg, #fef08a, #fef08a 8px, #fef9c3 8px, #fef9c3 16px)',
                            }}
                            className="absolute top-1.5 bottom-1.5 border border-amber-400/80 rounded-lg flex items-center justify-center text-center shadow-xs z-10 transition-all hover:scale-105"
                            title={`Ventana de limpieza crítica: Egreso a las 10:00 hs y nuevo Ingreso a las 14:00 hs (${dayStr})`}
                          >
                            <span className="text-[9px] font-black text-amber-900 tracking-tighter uppercase px-0.5 truncate bg-amber-200/90 rounded">
                              🧹 Rotación 4h
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FOOTER INFORMATIVO DEL CALENDARIO */}
      <div className="p-3 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Huésped en predio (Check-in)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Confirmada 100%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Seña abonada (Saldo pendiente)
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          💡 <strong>Tip:</strong> Haz <em>doble clic</em> sobre cualquier reserva para reubicar de cabaña, modificar datos o ver el historial de cambios.
        </p>
      </div>
    </div>
  );
}
