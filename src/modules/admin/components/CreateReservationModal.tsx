'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Users,
  Car,
  CreditCard,
  Building2,
  CheckCircle2,
  Sparkles,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Percent,
  Sliders,
} from 'lucide-react';
import { Cabin, Lead, Reservation, ReservationStatus } from '@/shared/types';
import { formatARS, formatUSD } from '@/shared/lib/bimonetary';

interface CreateReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: Lead | null;
  initialCabinId?: string | null;
  initialCheckIn?: string | null;
  initialCheckOut?: string | null;
  cabins: Cabin[];
  existingReservations: Reservation[];
  currentBlueRate: number;
  onReservationCreated: (newRes: Reservation, fromLeadId?: string) => Promise<boolean>;
}

export default function CreateReservationModal({
  isOpen,
  onClose,
  lead,
  initialCabinId,
  initialCheckIn,
  initialCheckOut,
  cabins,
  existingReservations,
  currentBlueRate,
  onReservationCreated,
}: CreateReservationModalProps) {
  if (!isOpen) return null;

  // Form states
  const [guestName, setGuestName] = useState(lead?.full_name || '');
  const [guestPhone, setGuestPhone] = useState(lead?.contact_phone || '');
  const [guestEmail, setGuestEmail] = useState(lead?.contact_email || '');
  const [guestDni, setGuestDni] = useState('');
  const [checkInDate, setCheckInDate] = useState(
    initialCheckIn || lead?.desired_check_in || '2026-11-18'
  );
  const [checkOutDate, setCheckOutDate] = useState(
    initialCheckOut || lead?.desired_check_out || '2026-11-22'
  );
  const [guestCount, setGuestCount] = useState<number>(lead?.pax_count || 4);
  const [selectedCabinId, setSelectedCabinId] = useState<string>(initialCabinId || '');
  const [reservationStatus, setReservationStatus] = useState<ReservationStatus>('senada');
  const [senaPercentage, setSenaPercentage] = useState<number>(30);
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const [licensePlate, setLicensePlate] = useState('');
  const [hasCeliac, setHasCeliac] = useState(false);
  const [hasMobility, setHasMobility] = useState(lead?.has_reduced_mobility || false);
  const [internalNotes, setInternalNotes] = useState(lead?.notes || '');
  const [bookingChannel, setBookingChannel] = useState<string>(
    lead ? (lead.source === 'telegram' ? 'telegram' : 'consulta_convertida') : 'web_directa'
  );
  const [createdByRole, setCreatedByRole] = useState<string>('administracion');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inicializar o actualizar con datos del lead o props
  useEffect(() => {
    if (lead) {
      setGuestName(lead.full_name || '');
      setGuestPhone(lead.contact_phone || '');
      setGuestEmail(lead.contact_email || '');
      if (lead.desired_check_in) setCheckInDate(lead.desired_check_in);
      if (lead.desired_check_out) setCheckOutDate(lead.desired_check_out);
      if (lead.pax_count) setGuestCount(lead.pax_count);
      setHasMobility(Boolean(lead.has_reduced_mobility));
      if (lead.notes) setInternalNotes(lead.notes);
      setBookingChannel(lead.source === 'telegram' ? 'telegram' : 'consulta_convertida');
    }
  }, [lead]);

  useEffect(() => {
    if (initialCabinId) setSelectedCabinId(initialCabinId);
    if (initialCheckIn) setCheckInDate(initialCheckIn);
    if (initialCheckOut) setCheckOutDate(initialCheckOut);
  }, [initialCabinId, initialCheckIn, initialCheckOut]);

  // Calcular cantidad de noches
  const totalNights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const inDate = new Date(checkInDate);
    const outDate = new Date(checkOutDate);
    const diffTime = outDate.getTime() - inDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  }, [checkInDate, checkOutDate]);

  // Cabañas disponibles en esas fechas
  const availableCabins = useMemo(() => {
    if (!checkInDate || !checkOutDate) return cabins;
    const inDate = new Date(checkInDate);
    const outDate = new Date(checkOutDate);

    return cabins.filter((cabin) => {
      // Verificar si hay reservas superpuestas
      const hasConflict = existingReservations.some((r) => {
        if (r.cabin_id !== cabin.id) return false;
        if (r.status === 'cancelada') return false;
        const rIn = new Date(r.check_in_date);
        const rOut = new Date(r.check_out_date);
        return inDate < rOut && outDate > rIn;
      });
      return !hasConflict;
    });
  }, [cabins, existingReservations, checkInDate, checkOutDate]);

  // Autoseleccionar la mejor cabaña si no hay una seleccionada
  useEffect(() => {
    if (!selectedCabinId && availableCabins.length > 0) {
      if (hasMobility) {
        const accessible = availableCabins.find((c) => c.has_accessible_mobility);
        if (accessible) {
          setSelectedCabinId(accessible.id);
          return;
        }
      }
      const suitable = availableCabins.find((c) => c.max_guests >= guestCount) || availableCabins[0];
      if (suitable) setSelectedCabinId(suitable.id);
    }
  }, [availableCabins, selectedCabinId, hasMobility, guestCount]);

  const selectedCabin = cabins.find((c) => c.id === selectedCabinId);

  // Cálculos bimonetarios automáticos
  const baseCabinRate = selectedCabin?.base_rate_usd || 85;
  const dailyRateUsd = rateOverride !== null && rateOverride > 0 ? rateOverride : baseCabinRate;
  const totalUsd = dailyRateUsd * totalNights;
  const totalArs = totalUsd * currentBlueRate;
  const senaUsdRequired = (totalUsd * senaPercentage) / 100;
  const senaArsRequired = senaUsdRequired * currentBlueRate;
  const balancePendingUsd = totalUsd - senaUsdRequired;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCabin) {
      setErrorMessage('Debes seleccionar una cabaña disponible.');
      return;
    }
    if (!guestName.trim()) {
      setErrorMessage('El nombre y apellido del huésped es obligatorio.');
      return;
    }
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      setErrorMessage('La fecha de check-out debe ser posterior al check-in.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const newReservationData: any = {
        cabin_id: selectedCabin.id,
        guest_name: guestName.trim(),
        guest_dni: guestDni.trim() || 'N/A',
        guest_phone: guestPhone.trim() || 'N/A',
        guest_email: guestEmail.trim() || 'sin_email@gesell.com',
        guest_count: guestCount,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        status: reservationStatus,
        daily_rate_usd: dailyRateUsd,
        total_nights: totalNights,
        total_usd: totalUsd,
        blue_rate_at_booking: currentBlueRate,
        total_ars_at_booking: totalArs,
        sena_percentage: senaPercentage,
        sena_usd_required: senaUsdRequired,
        sena_paid_ars: reservationStatus === 'solicitada' ? 0 : senaArsRequired,
        sena_paid_usd_equiv: reservationStatus === 'solicitada' ? 0 : senaUsdRequired,
        sena_blue_rate: currentBlueRate,
        sena_paid_at: reservationStatus === 'solicitada' ? null : new Date().toISOString(),
        balance_pending_usd: reservationStatus === 'confirmada' ? 0 : balancePendingUsd,
        balance_paid_usd: reservationStatus === 'confirmada' ? totalUsd : 0,
        balance_paid_ars: 0,
        parking_spot_number: selectedCabin.cabin_number,
        vehicle_license_plate: licensePlate.toUpperCase().trim() || null,
        booking_channel: bookingChannel,
        created_by_role: createdByRole,
        origin_lead_id: lead?.id || null,
        breakfast_included: true,
        has_celiac_sin_tacc: hasCeliac,
        has_reduced_mobility: hasMobility,
        internal_notes: internalNotes || (lead ? `Convertida desde consulta ${lead.source}` : 'Carga manual directa'),
      };

      const success = await onReservationCreated(newReservationData, lead?.id);
      if (success) {
        onClose();
      } else {
        setErrorMessage('No se pudo guardar la reserva en la base de datos.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                {lead ? 'Crear Reserva desde Consulta' : 'Carga Manual de Reserva Directa'}
                {lead && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 uppercase">
                    {lead.source}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Check-in 14:00 hs • Check-out 10:00 am • Motor Bimonetario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {errorMessage}
          </div>
        )}

        {/* Formulario Scrolleable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Datos del Huésped */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              1. Datos del Huésped Titular
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Nombre Completo / Apellido *
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ej: Pérez, Santiago"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Teléfono / Telegram *
                </label>
                <input
                  type="text"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+54 9 11 4455-6677"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="huesped@email.com"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  DNI o Pasaporte
                </label>
                <input
                  type="text"
                  value={guestDni}
                  onChange={(e) => setGuestDni(e.target.value)}
                  placeholder="32.456.789"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              {/* Canal de Ingreso */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Canal de Ingreso *
                </label>
                <select
                  value={bookingChannel}
                  onChange={(e) => setBookingChannel(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="telegram">✈️ Telegram Directo</option>
                  <option value="web_directa">🌐 Web Directa</option>
                  <option value="mostrador">🏢 Mostrador / Walk-in</option>
                  <option value="telefono">📞 Teléfono</option>
                  <option value="instagram">📸 Instagram</option>
                  <option value="consulta_convertida">📋 Consulta Previa Convertida</option>
                </select>
              </div>

              {/* Registrado por */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Quién Registra la Reserva *
                </label>
                <select
                  value={createdByRole}
                  onChange={(e) => setCreatedByRole(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="administracion">👑 Administración (Dueño / Admin)</option>
                  <option value="recepcion">📋 Recepción</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Fechas, Pax y Selección de Cabaña */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              2. Fechas de Estadía, Horarios & Capacidad
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Check-in (14:00 hs)
                </label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Check-out (10:00 am)
                </label>
                <input
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Huéspedes (Pax)
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Estado Inicial
                </label>
                <select
                  value={reservationStatus}
                  onChange={(e: any) => setReservationStatus(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                >
                  <option value="senada">Seña Abonada (30%)</option>
                  <option value="confirmada">Confirmada (100%)</option>
                  <option value="solicitada">Solicitada / Bloqueo Provisorio</option>
                </select>
              </div>
            </div>

            {/* Selector de Cabañas Disponibles */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Selecciona Cabaña ({availableCabins.length} libres para este período de {totalNights} noches):
                </label>
                {selectedCabin && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    Cabaña #{selectedCabin.cabin_number} seleccionada
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-44 overflow-y-auto pr-1">
                {availableCabins.map((c) => {
                  const isSelected = selectedCabinId === c.id;
                  const isAccessibleMatch = hasMobility && c.has_accessible_mobility;
                  const isAccessibleMismatch = hasMobility && !c.has_accessible_mobility;

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCabinId(c.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">Cabaña {c.cabin_number}</span>
                        <span className={`text-[10px] px-1.5 rounded font-bold ${
                          c.floor === 'PB' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {c.floor}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>👥 {c.max_guests}p</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">${c.base_rate_usd} USD</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        {c.has_accessible_mobility ? (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                            ♿ Accesible PB
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Estándar</span>
                        )}
                        {isAccessibleMismatch && (
                          <span className="text-[9px] text-rose-500 font-bold">⚠️ No PB</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Operatividad: Cochera, Dieta & Accesibilidad */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              3. Cochera, Vehículo y Necesidades Especiales
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Patente del Vehículo
                </label>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="AA 123 BB"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white uppercase font-mono outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Cochera asignada (Regla 1:1): #{selectedCabin?.cabin_number || '•'}
                </span>
              </div>
              <div className="flex flex-col justify-center space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={hasCeliac}
                    onChange={(e) => setHasCeliac(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  🌾 Desayuno Sin TACC (Canasta sellada en origen)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={hasMobility}
                    onChange={(e) => setHasMobility(e.target.checked)}
                    className="rounded text-blue-500"
                  />
                  ♿ Requiere Accesibilidad / Movilidad Reducida
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Notas Operativas Internas
              </label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Observaciones de la reserva, cuna extra, horario de arribo estimado..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                rows={2}
              />
            </div>
          </div>

          {/* 4. Resumen Bimonetario & Seña */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-400" /> Tarifario Bimonetario
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Seña:</span>
                  <select
                    value={senaPercentage}
                    onChange={(e) => setSenaPercentage(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                  >
                    <option value={30}>30%</option>
                    <option value={50}>50%</option>
                    <option value={100}>100% (Total)</option>
                  </select>
                </div>
                <span className="text-xs text-emerald-400 font-mono">
                  Dólar Blue: ${currentBlueRate} ARS
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] text-slate-400">Total Estadía ({totalNights} noches)</span>
                <p className="text-lg font-black text-white">{formatUSD(totalUsd)}</p>
                <p className="text-xs text-slate-400 font-mono">{formatARS(totalArs)}</p>
              </div>
              <div>
                <span className="text-[11px] text-emerald-400">Seña ({senaPercentage}%)</span>
                <p className="text-lg font-black text-emerald-400">{formatUSD(senaUsdRequired)}</p>
                <p className="text-xs text-slate-400 font-mono">{formatARS(senaArsRequired)}</p>
              </div>
              <div>
                <span className="text-[11px] text-amber-400">Saldo al Check-in</span>
                <p className="text-lg font-black text-amber-400">{formatUSD(balancePendingUsd)}</p>
                <p className="text-xs text-slate-400">En billete o pesos a cotiz. del check-in</p>
              </div>
            </div>
          </div>

          {/* Botón de Confirmación */}
          <button
            type="submit"
            disabled={isSubmitting || !selectedCabin}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              'Guardando Reserva en Sistema...'
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Confirmar Carga de Reserva en {selectedCabin?.name || 'Cabaña'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
