'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sun,
  Flag,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  AlertCircle,
  Calendar,
  Sparkles,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { HolidayException, SeasonConfig } from '@/shared/types';
import { fetchArgentineHolidays } from '@/modules/operations/holidayService';

export type SettingsTab = 'temporadas' | 'feriados' | 'horarios' | 'seguridad';

interface OperationalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonConfig: SeasonConfig | null;
  holidays: HolidayException[];
  onSaveSeasonConfig: (config: Partial<SeasonConfig>) => Promise<boolean>;
  onAddHoliday: (holiday: Omit<HolidayException, 'id'>) => Promise<boolean>;
  onDeleteHoliday: (id: string) => Promise<boolean>;
  onSyncApiHolidays: () => Promise<boolean>;
  initialTab?: SettingsTab;
}

export default function OperationalSettingsModal({
  isOpen,
  onClose,
  seasonConfig,
  holidays,
  onSaveSeasonConfig,
  onAddHoliday,
  onDeleteHoliday,
  onSyncApiHolidays,
  initialTab = 'temporadas',
}: OperationalSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Season Config State
  const [seasonName, setSeasonName] = useState(seasonConfig?.season_name || 'Temporada de Verano 2026/2027');
  const [seasonStart, setSeasonStart] = useState(seasonConfig?.start_date || '2026-12-01');
  const [seasonEnd, setSeasonEnd] = useState(seasonConfig?.end_date || '2027-03-15');
  const [ratePb, setRatePb] = useState(seasonConfig?.base_daily_usd_pb || 85);
  const [ratePa4, setRatePa4] = useState(seasonConfig?.base_daily_usd_pa_4pax || 95);
  const [ratePa6, setRatePa6] = useState(seasonConfig?.base_daily_usd_pa_6pax || 120);

  // New Holiday State
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayStart, setNewHolidayStart] = useState('');
  const [newHolidayEnd, setNewHolidayEnd] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'fin_de_semana_largo' | 'feriado_nacional' | 'fecha_especial'>('fin_de_semana_largo');
  const [newHolidayMultiplier, setNewHolidayMultiplier] = useState(1.25);
  const [newHolidayMinNights, setNewHolidayMinNights] = useState(3);

  // Security & Session Timeout State
  const [inactivityMinutes, setInactivityMinutes] = useState<number>(30);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saas_inactivity_timeout_minutes');
      if (stored !== null) {
        setInactivityMinutes(Number(stored));
      }
    }
  }, [isOpen]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const ok = await onSaveSeasonConfig({
        season_name: seasonName,
        start_date: seasonStart,
        end_date: seasonEnd,
        base_daily_usd_pb: Number(ratePb),
        base_daily_usd_pa_4pax: Number(ratePa4),
        base_daily_usd_pa_6pax: Number(ratePa6),
      });
      if (ok) {
        setMessage('Configuración de Temporada guardada con éxito.');
        setTimeout(() => setMessage(null), 2500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayName || !newHolidayStart) return;
    setIsSubmitting(true);
    try {
      const ok = await onAddHoliday({
        name: newHolidayName,
        start_date: newHolidayStart,
        end_date: newHolidayEnd || newHolidayStart,
        type: newHolidayType,
        rate_multiplier: Number(newHolidayMultiplier),
        min_nights: Number(newHolidayMinNights),
        is_official_api: false,
      });
      if (ok) {
        setNewHolidayName('');
        setNewHolidayStart('');
        setNewHolidayEnd('');
        setMessage('Fecha especial agregada exitosamente.');
        setTimeout(() => setMessage(null), 2500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncHolidays = async () => {
    setIsSyncing(true);
    try {
      const ok = await onSyncApiHolidays();
      if (ok) {
        setMessage('Feriados y Fines de Semana Largos sincronizados con la API oficial.');
        setTimeout(() => setMessage(null), 3000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('saas_inactivity_timeout_minutes', String(inactivityMinutes));
      window.dispatchEvent(new CustomEvent('saas_timeout_changed', { detail: inactivityMinutes }));
    }
    const label = inactivityMinutes === 0
      ? 'Desactivado (la sesión permanecerá abierta mientras la pestaña esté abierta)'
      : `${inactivityMinutes} minutos de inactividad`;
    setMessage(`Política de sesión actualizada con éxito: ${label}.`);
    setTimeout(() => setMessage(null), 3500);
  };

  const sessionPresets = [
    { label: '15 min', value: 15, desc: 'Bancaria / Máxima seguridad' },
    { label: '30 min', value: 30, desc: 'Recomendado estándar' },
    { label: '1 hora', value: 60, desc: 'Operación hotelera ágil' },
    { label: '2 horas', value: 120, desc: 'Atención prolongada en mostrador' },
    { label: '4 horas', value: 240, desc: 'Medio turno de trabajo' },
    { label: '8 horas', value: 480, desc: 'Turno completo' },
    { label: 'Desactivado', value: 0, desc: 'Sin cierre por inactividad (solo al cerrar pestaña/navegador)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Configuraciones de Operatividad
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Temporada Alta, Fines de Semana Largos, Horarios y Seguridad de Sesión
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

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('temporadas')}
            className={`py-3 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'temporadas'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sun className="w-4 h-4" /> Temporada
          </button>
          <button
            onClick={() => setActiveTab('feriados')}
            className={`py-3 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'feriados'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Flag className="w-4 h-4" /> Feriados ({holidays.length})
          </button>
          <button
            onClick={() => setActiveTab('horarios')}
            className={`py-3 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'horarios'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Horarios
          </button>
          <button
            onClick={() => setActiveTab('seguridad')}
            className={`py-3 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'seguridad'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-500" /> Seguridad & Sesión
          </button>
        </div>

        {/* Alert banner */}
        {message && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {message}
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: TEMPORADA ALTA */}
          {activeTab === 'temporadas' && (
            <form onSubmit={handleSaveSeason} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de la Temporada
                </label>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={seasonStart}
                    onChange={(e) => setSeasonStart(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha de Finalización
                  </label>
                  <input
                    type="date"
                    value={seasonEnd}
                    onChange={(e) => setSeasonEnd(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Tarifas Base USD */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Tarifas Diarias de Referencia (USD)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Planta Baja (4pax Accesible)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-bold">USD</span>
                      <input
                        type="number"
                        value={ratePb}
                        onChange={(e) => setRatePb(Number(e.target.value))}
                        className="w-full pl-11 pr-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Planta Alta (4 Pax)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-bold">USD</span>
                      <input
                        type="number"
                        value={ratePa4}
                        onChange={(e) => setRatePa4(Number(e.target.value))}
                        className="w-full pl-11 pr-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Planta Alta (6 Pax)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-bold">USD</span>
                      <input
                        type="number"
                        value={ratePa6}
                        onChange={(e) => setRatePa6(Number(e.target.value))}
                        className="w-full pl-11 pr-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Guardando...' : 'Guardar Configuración de Temporada'}
              </button>
            </form>
          )}

          {/* TAB 2: FERIADOS Y FINES DE SEMANA LARGOS */}
          {activeTab === 'feriados' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Sincronización Oficial
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Feriados nacionales inamovibles y trasladables oficiales de Argentina
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSyncHolidays}
                  disabled={isSyncing}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar Feriados'}
                </button>
              </div>

              <form onSubmit={handleCreateHoliday} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Agregar Fecha Especial o Fin de Semana Largo
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Nombre / Motivo</label>
                    <input
                      type="text"
                      placeholder="Ej. Carnaval, Semana Santa, etc."
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Tipo de Evento</label>
                    <select
                      value={newHolidayType}
                      onChange={(e: any) => setNewHolidayType(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                    >
                      <option value="fin_de_semana_largo">Fin de Semana Largo</option>
                      <option value="feriado_nacional">Feriado Nacional</option>
                      <option value="fecha_especial">Fecha Especial / Evento Local</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Desde</label>
                    <input
                      type="date"
                      value={newHolidayStart}
                      onChange={(e) => setNewHolidayStart(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Hasta (inclusive)</label>
                    <input
                      type="date"
                      value={newHolidayEnd}
                      onChange={(e) => setNewHolidayEnd(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Multiplicador Tarifario (Ej. 1.25 = +25%)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="3.0"
                      value={newHolidayMultiplier}
                      onChange={(e) => setNewHolidayMultiplier(Number(e.target.value))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Mínimo de Noches</label>
                    <input
                      type="number"
                      min="1"
                      max="14"
                      value={newHolidayMinNights}
                      onChange={(e) => setNewHolidayMinNights(Number(e.target.value))}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-xs uppercase transition-all"
                >
                  Agregar a Calendario
                </button>
              </form>

              {/* Lista actual de Feriados y Fechas Especiales */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Fechas Especiales Configuradas ({holidays.length})
                </span>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {holidays.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{h.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 font-semibold">
                            {h.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {h.start_date} al {h.end_date} • Min. {h.min_nights || 1} noches • Tarifa x{h.rate_multiplier || 1}
                        </p>
                      </div>
                      <button
                        onClick={() => onDeleteHoliday(h.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Eliminar fecha especial"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: POLÍTICAS DE HORARIOS */}
          {activeTab === 'horarios' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Horarios Predeterminados del Complejo
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Hora de Check-in</span>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">14:00 hs</p>
                    <p className="text-[11px] text-slate-500 mt-1">Ingreso de huéspedes y entrega de llaves.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Hora de Check-out</span>
                    <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">10:00 am</p>
                    <p className="text-[11px] text-slate-500 mt-1">Liberación de cabaña y restitución de control remoto / cochera.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 mt-3">
                  <strong>Ventana de Rotación y Limpieza (4 Horas):</strong> Entre las 10:00 am y las 14:00 hs se ejecuta la limpieza profunda, ventilación y recambio de blancos. Si una misma cabaña tiene salida e ingreso el mismo día, el calendario la resalta en <strong>amarillo crema rayado a 45°</strong>.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SEGURIDAD & TIEMPO DE SESIÓN */}
          {activeTab === 'seguridad' && (
            <form onSubmit={handleSaveSecurity} className="space-y-5">
              {/* Card de Configuración de Inactividad */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Tiempo de Inactividad de Sesión
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Define cuántos minutos de inactividad (sin clics, mouse ni teclado en la pantalla) deben transcurrir antes de cerrar la sesión automáticamente.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 uppercase font-semibold block">Configuración Actual</span>
                    <span className="text-lg font-mono font-bold text-amber-500">
                      {inactivityMinutes === 0 ? 'Desactivado' : `${inactivityMinutes} min`}
                    </span>
                  </div>
                </div>

                {/* Presets Rápidos */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Opciones Predefinidas:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {sessionPresets.map((preset) => {
                      const isSelected = inactivityMinutes === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setInactivityMinutes(preset.value)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-bold shadow-sm'
                              : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className="text-xs font-bold">{preset.label}</div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">{preset.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Input Manual de Minutos */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-4">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    O ingresá minutos personalizados:
                  </label>
                  <div className="flex items-center gap-2 max-w-[160px]">
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      step="5"
                      value={inactivityMinutes}
                      onChange={(e) => setInactivityMinutes(Math.max(0, Number(e.target.value)))}
                      className="w-full p-2 text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs text-slate-500 font-medium">min</span>
                  </div>
                </div>
              </div>

              {/* Card Informativa de Políticas de Seguridad Obligatorias */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <ShieldCheck className="w-4 h-4" /> Políticas Activas de Protección y Privacidad
                </span>
                <ul className="space-y-1.5 pl-4 list-disc text-[11px] text-slate-500 dark:text-slate-400">
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">Cierre al cerrar la pestaña o el navegador:</strong> Sin importar los minutos configurados aquí, la sesión SIEMPRE se destruye de inmediato si el usuario cierra la pestaña o la ventana del navegador.
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">Aviso previo de 60 segundos:</strong> Antes de cerrarse por inactividad, aparecerá una ventana modal de advertencia con cuenta regresiva para no perder datos en curso.
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-slate-200">Aislamiento estricto de roles:</strong> Ningún usuario de recepción, maestranza o mantenimiento puede acceder a paneles fuera de su turno y función.
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
              >
                <Save className="w-4 h-4" />
                Guardar Tiempo de Sesión
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
