'use client';

import React, { useState } from 'react';
import {
  X,
  Calendar,
  Users,
  Car,
  CreditCard,
  Building2,
  AlertTriangle,
  History,
  CheckCircle2,
  ArrowRightLeft,
  Edit3,
  Phone,
  Mail,
  ShieldAlert,
  Save,
  Clock,
} from 'lucide-react';
import { Cabin, Reservation, ReservationChange } from '@/shared/types';
import { formatARS, formatUSD } from '@/shared/lib/bimonetary';

interface ReservationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  cabins: Cabin[];
  allReservations: Reservation[];
  currentBlueRate: number;
  onUpdateReservation: (
    updated: Partial<Reservation> & { id: string },
    reason: string,
    changeType: 'reubicacion' | 'fechas' | 'pax' | 'general',
    accessibilityWarningAccepted?: boolean
  ) => Promise<boolean>;
  changeHistory: ReservationChange[];
}

export default function ReservationDetailModal({
  isOpen,
  onClose,
  reservation,
  cabins,
  allReservations,
  currentBlueRate,
  onUpdateReservation,
  changeHistory,
}: ReservationDetailModalProps) {
  if (!isOpen || !reservation) return null;

  const currentCabin = cabins.find((c) => c.id === reservation.cabin_id);

  const [activeTab, setActiveTab] = useState<'detalle' | 'reubicar' | 'editar' | 'historial'>('detalle');

  // Form states para edición
  const [guestName, setGuestName] = useState(reservation.guest_name || '');
  const [guestPhone, setGuestPhone] = useState(reservation.guest_phone || '');
  const [guestCount, setGuestCount] = useState(reservation.guest_count);
  const [licensePlate, setLicensePlate] = useState(reservation.vehicle_license_plate || '');
  const [hasCeliac, setHasCeliac] = useState(reservation.has_celiac_sin_tacc);
  const [hasMobility, setHasMobility] = useState(reservation.has_reduced_mobility);
  const [internalNotes, setInternalNotes] = useState(reservation.internal_notes || '');

  // Reubicación
  const [targetCabinId, setTargetCabinId] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');
  const [showAccessibilityAlert, setShowAccessibilityAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Algoritmo de Sugerencia Inteligente de Cabañas Disponibles
  const checkInDate = new Date(reservation.check_in_date);
  const checkOutDate = new Date(reservation.check_out_date);

  const availableCabins = cabins
    .filter((c) => {
      if (c.id === reservation.cabin_id) return false; // Excluir la actual
      // Verificar si está ocupada en ese rango
      const hasOverlap = allReservations.some((r) => {
        if (r.id === reservation.id) return false;
        if (r.cabin_id !== c.id) return false;
        if (r.status === 'cancelada') return false;

        const rIn = new Date(r.check_in_date);
        const rOut = new Date(r.check_out_date);
        return checkInDate < rOut && checkOutDate > rIn;
      });
      return !hasOverlap;
    })
    .sort((a, b) => {
      // Prioridad 1: Si requiere movilidad reducida, priorizar PB accesible
      if (hasMobility) {
        if (a.has_accessible_mobility && !b.has_accessible_mobility) return -1;
        if (!a.has_accessible_mobility && b.has_accessible_mobility) return 1;
      }
      // Prioridad 2: Capacidad más cercana a la cantidad de huéspedes
      const diffA = Math.abs(a.max_guests - guestCount);
      const diffB = Math.abs(b.max_guests - guestCount);
      if (diffA !== diffB) return diffA - diffB;
      // Prioridad 3: Orden numérico
      return a.cabin_number - b.cabin_number;
    });

  const selectedTargetCabin = cabins.find((c) => c.id === targetCabinId);

  // Manejar intento de Reubicación
  const handleInitiateReallocation = () => {
    if (!targetCabinId) {
      alert('Por favor selecciona una cabaña destino.');
      return;
    }
    if (!changeReason.trim()) {
      alert('Es obligatorio ingresar el motivo de la reubicación.');
      return;
    }

    // Comprobar si el pasajero tiene movilidad reducida y la cabaña destino no es accesible
    if (hasMobility && selectedTargetCabin && !selectedTargetCabin.has_accessible_mobility) {
      setShowAccessibilityAlert(true);
      return;
    }

    executeReallocation(false);
  };

  const executeReallocation = async (accessibilityAccepted: boolean) => {
    if (!selectedTargetCabin) return;
    setIsSubmitting(true);
    try {
      const ok = await onUpdateReservation(
        {
          id: reservation.id,
          cabin_id: selectedTargetCabin.id,
          parking_spot_number: selectedTargetCabin.cabin_number,
        },
        changeReason,
        'reubicacion',
        accessibilityAccepted
      );

      if (ok) {
        setActionSuccess(`Reubicación a ${selectedTargetCabin.name} completada con éxito.`);
        setShowAccessibilityAlert(false);
        setChangeReason('');
        setTimeout(() => {
          setActionSuccess(null);
          onClose();
        }, 1500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar Edición General
  const handleSaveGeneralEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeReason.trim()) {
      alert('Es obligatorio indicar el motivo de la modificación.');
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await onUpdateReservation(
        {
          id: reservation.id,
          guest_name: guestName,
          guest_phone: guestPhone,
          guest_count: guestCount,
          vehicle_license_plate: licensePlate.toUpperCase(),
          has_celiac_sin_tacc: hasCeliac,
          has_reduced_mobility: hasMobility,
          internal_notes: internalNotes,
        },
        changeReason,
        'general'
      );

      if (ok) {
        setActionSuccess('Ficha de reserva actualizada correctamente.');
        setChangeReason('');
        setTimeout(() => {
          setActionSuccess(null);
          setActiveTab('detalle');
        }, 1200);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-lg">
              {currentCabin?.cabin_number || '•'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                {reservation.guest_name}
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                  reservation.status === 'checkin'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                    : reservation.status === 'confirmada'
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                }`}>
                  {reservation.status}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentCabin?.name} • Cochera #{currentCabin?.cabin_number}
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

        {/* Tabs de Navegación del Modal */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 text-sm font-medium">
          <button
            onClick={() => setActiveTab('detalle')}
            className={`py-3 px-4 border-b-2 transition-all ${
              activeTab === 'detalle'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Ficha Detallada
          </button>
          <button
            onClick={() => setActiveTab('reubicar')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'reubicar'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" /> Reubicar Cabaña
          </button>
          <button
            onClick={() => setActiveTab('editar')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'editar'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-4 h-4" /> Modificar Datos
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'historial'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" /> Historial de Cambios
          </button>
        </div>

        {/* Feedback de Éxito */}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {actionSuccess}
          </div>
        )}

        {/* Contenido scrolleable de pestañas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: DETALLE */}
          {activeTab === 'detalle' && (
            <div className="space-y-6">
              {/* Trazabilidad: Canal de Ingreso y Operador Creador */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Canal de Ingreso:
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/20">
                    {reservation.booking_channel === 'telegram'
                      ? '✈️ Telegram'
                      : reservation.booking_channel === 'web_directa'
                      ? '🌐 Web Directa'
                      : reservation.booking_channel === 'mostrador'
                      ? '🏢 Mostrador / Walk-in'
                      : reservation.booking_channel === 'telefono'
                      ? '📞 Teléfono'
                      : reservation.booking_channel === 'instagram'
                      ? '📸 Instagram'
                      : reservation.booking_channel === 'consulta_convertida'
                      ? '📋 Consulta Convertida'
                      : reservation.booking_channel || '🌐 Web Directa'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Creado por:
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/20">
                    {reservation.created_by_role === 'recepcion'
                      ? '📋 Recepción'
                      : '👑 Administración (Dueño / Admin)'}
                  </span>
                </div>
              </div>

              {/* Fechas y Horarios clave */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Check-in</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {reservation.check_in_date}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-medium">14:00 hs</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Check-out</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {reservation.check_out_date}
                  </p>
                  <span className="text-[10px] text-amber-600 font-medium">10:00 am</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Estadía</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {reservation.total_nights} noches
                  </p>
                  <span className="text-[10px] text-slate-500">{reservation.guest_count} huéspedes</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Vehículo</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 font-mono">
                    {reservation.vehicle_license_plate || 'Sin patente'}
                  </p>
                  <span className="text-[10px] text-slate-500">Cochera #{currentCabin?.cabin_number}</span>
                </div>
              </div>

              {/* Badges de Accesibilidad y Salud */}
              <div className="flex flex-wrap gap-2">
                {reservation.has_celiac_sin_tacc && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-500/20">
                    🌾 Desayuno Sin TACC / Celíaco
                  </span>
                )}
                {reservation.has_reduced_mobility && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-500/20">
                    ♿ Requiere Accesibilidad / Movilidad Reducida
                  </span>
                )}
                {currentCabin?.floor === 'PB' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-500/20">
                    Planta Baja (PB)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                    Planta Alta (PA)
                  </span>
                )}
              </div>

              {/* Estado Financiero Bimonetario */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-amber-400" /> Resumen Financiero
                  </span>
                  <span className="text-xs text-amber-400 font-mono">
                    Dólar al reservar: ${reservation.blue_rate_at_booking} ARS
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-[11px] text-slate-400">Total Reserva</span>
                    <p className="text-base font-bold text-white">{formatUSD(reservation.total_usd)}</p>
                    <p className="text-xs text-slate-400 font-mono">{formatARS(reservation.total_ars_at_booking)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-400">Seña Abonada ({reservation.sena_percentage}%)</span>
                    <p className="text-base font-bold text-emerald-400">{formatUSD(reservation.sena_paid_usd_equiv)}</p>
                    <p className="text-xs text-slate-400 font-mono">{formatARS(reservation.sena_paid_ars)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-400">Saldo Pendiente</span>
                    <p className="text-base font-bold text-amber-400">{formatUSD(reservation.balance_pending_usd)}</p>
                    <p className="text-xs text-slate-400">
                      ≈ {formatARS(reservation.balance_pending_usd * currentBlueRate)} (a cotiz. hoy)
                    </p>
                  </div>
                </div>
              </div>

              {/* Notas Internas */}
              {reservation.internal_notes && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <strong className="block text-slate-900 dark:text-white mb-1">Notas Operativas:</strong>
                  {reservation.internal_notes}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REUBICAR CABAÑA */}
          {activeTab === 'reubicar' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
                <strong>Reubicación asistida:</strong> El sistema analiza disponibilidad en el rango ({reservation.check_in_date} al {reservation.check_out_date}) y prioriza cabañas con capacidad adecuada y condiciones de accesibilidad.
              </div>

              {/* Cabaña actual */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                <span>Cabaña actual: <strong>{currentCabin?.name}</strong></span>
                <span className="font-semibold text-slate-500">Capacidad: {currentCabin?.max_guests} pax ({currentCabin?.floor})</span>
              </div>

              {/* Lista de sugerencias */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Selecciona la Cabaña Destino:
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {availableCabins.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-3 text-center">
                      No hay otras cabañas 100% disponibles para este rango de fechas.
                    </p>
                  ) : (
                    availableCabins.map((c) => {
                      const isSelected = targetCabinId === c.id;
                      const isAccessibleMismatch = hasMobility && !c.has_accessible_mobility;

                      return (
                        <div
                          key={c.id}
                          onClick={() => setTargetCabinId(c.id)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 font-bold flex items-center justify-center text-slate-800 dark:text-white">
                              {c.cabin_number}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span>{c.floor === 'PB' ? 'Planta Baja' : 'Planta Alta'}</span>
                                <span>•</span>
                                <span>Hasta {c.max_guests} pax</span>
                                {c.has_accessible_mobility && (
                                  <span className="text-blue-600 font-semibold flex items-center gap-0.5">
                                    ♿ Accesible PB
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isAccessibleMismatch && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              ⚠️ No Accesible (PA)
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Motivo OBLIGATORIO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo de la Reubicación <span className="text-rose-500">* (Obligatorio para auditoría)</span>
                </label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Ej: Pedido del huésped por cercanía al parque, avería en cabaña origen, optimización de pax..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  rows={2}
                  required
                />
              </div>

              {/* Botón de acción */}
              <button
                type="button"
                onClick={handleInitiateReallocation}
                disabled={isSubmitting || !targetCabinId}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-md shadow-amber-500/20"
              >
                {isSubmitting ? 'Procesando Reubicación...' : 'Confirmar Reubicación de Cabaña'}
              </button>
            </div>
          )}

          {/* TAB 3: MODIFICAR DATOS GENERALES */}
          {activeTab === 'editar' && (
            <form onSubmit={handleSaveGeneralEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre / Apellido de Reserva
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cantidad de Pax
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Patente del Vehículo
                  </label>
                  <input
                    type="text"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    placeholder="Ej: AA 123 BB"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 uppercase font-mono"
                  />
                </div>
              </div>

              {/* Switches de accesibilidad y dieta */}
              <div className="flex items-center gap-6 py-2 border-y border-slate-200 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={hasCeliac}
                    onChange={(e) => setHasCeliac(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500"
                  />
                  🌾 Desayuno Sin TACC
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={hasMobility}
                    onChange={(e) => setHasMobility(e.target.checked)}
                    className="rounded text-blue-500 focus:ring-blue-500"
                  />
                  ♿ Movilidad Reducida
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones Operativas Internas
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  rows={2}
                />
              </div>

              {/* Motivo OBLIGATORIO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo de la Modificación <span className="text-rose-500">* (Obligatorio)</span>
                </label>
                <input
                  type="text"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Motivo del cambio de datos para el registro de auditoría"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando Cambios...' : 'Guardar Modificaciones'}
              </button>
            </form>
          )}

          {/* TAB 4: HISTORIAL DE MODIFICACIONES */}
          {activeTab === 'historial' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Registro inmutable de movimientos, reubicaciones y modificaciones de esta reserva.
              </p>
              {changeHistory.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  Esta reserva no presenta modificaciones registradas hasta el momento.
                </div>
              ) : (
                changeHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white uppercase flex items-center gap-1">
                        {item.change_type === 'reubicacion' && <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" />}
                        {item.change_type}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(item.created_at).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">
                      <strong>Motivo:</strong> {item.reason}
                    </p>
                    {item.accessibility_warning_accepted && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 font-semibold">
                        ⚠️ Alerta de accesibilidad aceptada expresamente
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ALERTA PREVENTIVA INMEDIATA DE ACCESIBILIDAD (MODAL ENCADENADO) */}
        {showAccessibilityAlert && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="text-center">
                <h4 className="text-base font-black text-rose-600 dark:text-rose-400">
                  ⚠️ Alerta Preventiva de Accesibilidad
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                  El huésped <strong>{reservation.guest_name}</strong> tiene registrada <strong>movilidad reducida</strong>, y la <strong>{selectedTargetCabin?.name}</strong> está ubicada en <strong>Planta Alta (PA)</strong> sin acceso adaptado internacional ♿.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300 text-center font-medium">
                ¿Confirma expresamente la reubicación a una habitación NO adaptada? Este movimiento quedará registrado en el historial de auditoría.
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccessibilityAlert(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => executeReallocation(true)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-600/20"
                >
                  Confirmar de todos modos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
