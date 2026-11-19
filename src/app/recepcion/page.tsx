'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import InternalPortalHeader from '@/shared/components/InternalPortalHeader';
import SessionSecurityGuard from '@/shared/components/SessionSecurityGuard';
import { createClient } from '@/shared/lib/supabase/client';
import { formatARS, formatUSD } from '@/shared/lib/bimonetary';
import {
  Lead,
  Reservation,
  ParkingSpot,
  BankAccount,
  Cabin,
  HolidayException,
  ReservationChange,
} from '@/shared/types';
import InteractiveTimelineCalendar from '@/modules/admin/components/InteractiveTimelineCalendar';
import ReservationDetailModal from '@/modules/admin/components/ReservationDetailModal';
import CreateReservationModal from '@/modules/admin/components/CreateReservationModal';
import MaintenanceManagementView from '@/modules/maintenance/components/MaintenanceManagementView';
import ReceptionSidebar, { ReceptionActiveTab } from '@/modules/reception/components/ReceptionSidebar';
import TelegramCrmInboxView from '@/modules/telegram/components/TelegramCrmInboxView';
import TelegramAssistantsView from '@/modules/telegram/components/TelegramAssistantsView';
import TelegramBookingsView from '@/modules/telegram/components/TelegramBookingsView';
import { fetchArgentineHolidays, ARGENTINA_OFFICIAL_HOLIDAYS_FALLBACK } from '@/modules/operations/holidayService';
import {
  Calendar,
  Users,
  Phone,
  Mail,
  Car,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Send,
  Sparkles,
  ArrowRight,
  CreditCard,
  Copy,
  Check,
  Wrench,
  Droplets,
  CalendarDays,
  ShieldCheck,
  Building,
  RefreshCw,
} from 'lucide-react';

export default function ReceptionPortalPage() {
  const [blueRate, setBlueRate] = useState<number>(1285);
  const [activeTab, setActiveTab] = useState<ReceptionActiveTab>('calendar');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Dominio: Cabañas, Reservas, Feriados y Cambios
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [holidays, setHolidays] = useState<HolidayException[]>([]);
  const [changeHistory, setChangeHistory] = useState<ReservationChange[]>([]);

  // Modales de Reserva
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeadForBooking, setSelectedLeadForBooking] = useState<Lead | null>(null);
  const [manualInitialCabin, setManualInitialCabin] = useState<string | null>(null);
  const [manualInitialCheckIn, setManualInitialCheckIn] = useState<string | null>(null);
  const [manualInitialCheckOut, setManualInitialCheckOut] = useState<string | null>(null);

  // Leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Cocheras
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);

  // Cuentas bancarias (para cobro de señas)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Mantenimiento
  const [activeTicketCount, setActiveTicketCount] = useState<number>(0);

  // Manual Lead Modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPax, setManualPax] = useState(2);
  const [manualSource, setManualSource] = useState<'manual' | 'telefono' | 'telegram'>('manual');
  const [manualMobility, setManualMobility] = useState(false);
  const [manualMobilityNotes, setManualMobilityNotes] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  // Función para cargar todos los datos de recepción
  const loadReceptionData = useCallback(async () => {
    const supabase = createClient();

    // 1. Cargar tasa
    const { data: rateData } = await supabase
      .from('exchange_rates')
      .select('sell_rate')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();
    if (rateData?.sell_rate) setBlueRate(Number(rateData.sell_rate));

    // 2. Cargar cabañas 1 a 12
    const { data: cabinData } = await supabase
      .from('cabins')
      .select('*')
      .order('cabin_number', { ascending: true });
    if (cabinData) setCabins(cabinData);

    // 3. Cargar reservas
    const { data: resData } = await supabase
      .from('reservations')
      .select('*')
      .order('check_in_date', { ascending: false });
    if (resData) {
      const enrichedReservations: Reservation[] = resData.map((r: any) => ({
        ...r,
        has_reduced_mobility:
          r.has_reduced_mobility ??
          Boolean(
            r.internal_notes?.toLowerCase().includes('silla de ruedas') ||
              r.internal_notes?.toLowerCase().includes('movilidad') ||
              r.internal_notes?.toLowerCase().includes('rampa')
          ),
      }));
      setReservations(enrichedReservations);
    }

    // 4. Cargar feriados
    const { data: holData } = await supabase
      .from('holiday_exceptions')
      .select('*')
      .order('start_date', { ascending: true });
    if (holData && holData.length > 0) {
      setHolidays(holData);
    } else {
      setHolidays(
        ARGENTINA_OFFICIAL_HOLIDAYS_FALLBACK.map((h, i) => ({
          ...h,
          id: `fallback-hol-${i}`,
        }))
      );
    }

    // 5. Cargar interesados
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (leadsData) setLeads(leadsData);
    setLoadingLeads(false);

    // 6. Cargar cocheras
    const { data: parkData } = await supabase
      .from('parking_spots')
      .select('*')
      .order('spot_number');
    if (parkData) setParkingSpots(parkData);

    // 7. Cargar cuentas bancarias
    const { data: bankData } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('is_active', true)
      .order('currency');
    if (bankData) setBankAccounts(bankData);

    // 8. Contar incidencias abiertas de mantenimiento
    const { data: tickData } = await supabase
      .from('maintenance_tickets')
      .select('id, status')
      .in('status', ['pendiente', 'en_progreso']);
    if (tickData) setActiveTicketCount(tickData.length);
  }, []);

  useEffect(() => {
    loadReceptionData();

    // Sincronización en tiempo real con Supabase (Reservas, Leads y Mantenimiento)
    const supabase = createClient();
    const channel = supabase
      .channel('reception_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        async () => {
          const { data: resData } = await supabase
            .from('reservations')
            .select('*')
            .order('check_in_date', { ascending: false });
          if (resData) {
            setReservations(
              resData.map((r: any) => ({
                ...r,
                has_reduced_mobility:
                  r.has_reduced_mobility ??
                  Boolean(
                    r.internal_notes?.toLowerCase().includes('silla de ruedas') ||
                      r.internal_notes?.toLowerCase().includes('movilidad') ||
                      r.internal_notes?.toLowerCase().includes('rampa')
                  ),
              }))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        async () => {
          const { data: leadsData } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });
          if (leadsData) setLeads(leadsData);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_tickets' },
        async () => {
          const { data: tickData } = await supabase
            .from('maintenance_tickets')
            .select('id, status')
            .in('status', ['pendiente', 'en_progreso']);
          if (tickData) setActiveTicketCount(tickData.length);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadReceptionData]);

  // Recargar reservas y ocupación al cambiar al tab de calendario
  useEffect(() => {
    if (activeTab === 'calendar') {
      loadReceptionData();
    }
  }, [activeTab, loadReceptionData]);

  // Cargar historial de cambios de la reserva seleccionada
  useEffect(() => {
    async function loadReservationChanges() {
      if (!selectedReservation) return;
      const supabase = createClient();
      try {
        const { data } = await supabase
          .from('reservation_changes')
          .select('*')
          .eq('reservation_id', selectedReservation.id)
          .order('created_at', { ascending: false });
        if (data) setChangeHistory(data);
      } catch {
        setChangeHistory([]);
      }
    }
    loadReservationChanges();
  }, [selectedReservation]);

  // KPIs diarios de recepción
  const todayStr = '2026-11-16';
  const receptionKpis = useMemo(() => {
    const checkinsToday = reservations.filter(
      (r) => r.check_in_date === todayStr && r.status !== 'cancelada'
    );
    const checkoutsToday = reservations.filter(
      (r) => r.check_out_date === todayStr && r.status !== 'cancelada'
    );

    const activeOccupied = reservations.filter((r) => {
      if (r.status === 'cancelada') return false;
      return (
        (todayStr >= r.check_in_date && todayStr < r.check_out_date) ||
        (r.check_in_date === todayStr && r.status === 'checkin')
      );
    });

    const occupiedCount = new Set(activeOccupied.map((r) => r.cabin_id)).size;

    return {
      checkins: checkinsToday.length,
      checkouts: checkoutsToday.length,
      occupiedCount,
      freeCabins: Math.max(0, 12 - occupiedCount),
    };
  }, [reservations, todayStr]);

  // Manejador de doble clic en una reserva del calendario
  const handleReservationDoubleClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowReservationModal(true);
  };

  // Abrir modal de carga manual de reserva
  const handleOpenManualBooking = (cabinId?: string | null, dateStr?: string | null) => {
    setSelectedLeadForBooking(null);
    setManualInitialCabin(cabinId || null);
    if (dateStr) {
      setManualInitialCheckIn(dateStr);
      const d = new Date(`${dateStr}T12:00:00`);
      d.setDate(d.getDate() + 3);
      setManualInitialCheckOut(d.toISOString().split('T')[0]);
    } else {
      setManualInitialCheckIn('2026-11-18');
      setManualInitialCheckOut('2026-11-22');
    }
    setShowCreateModal(true);
  };

  // Convertir Lead a Reserva
  const handleConvertLeadToBooking = (lead: Lead) => {
    setSelectedLeadForBooking(lead);
    setManualInitialCabin(lead.cabin_preference_id || null);
    setManualInitialCheckIn(lead.desired_check_in || '2026-11-18');
    setManualInitialCheckOut(lead.desired_check_out || '2026-11-22');
    setShowCreateModal(true);
  };

  // Guardar Reserva creada
  const handleReservationCreated = async (
    newResData: any,
    fromLeadId?: string
  ): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('reservations')
        .insert(newResData)
        .select()
        .single();

      if (error) throw error;

      if (fromLeadId) {
        await supabase
          .from('leads')
          .update({ status: 'reservado', updated_at: new Date().toISOString() })
          .eq('id', fromLeadId);

        setLeads((prev) =>
          prev.map((l) => (l.id === fromLeadId ? { ...l, status: 'reservado' } : l))
        );
      }

      if (data) {
        setReservations((prev) => [data, ...prev]);
        setShowCreateModal(false);
        setSelectedLeadForBooking(null);
        setActiveTab('calendar');
      }

      return true;
    } catch (err) {
      console.error('Error al crear reserva desde recepción:', err);
      alert('Error guardando la reserva en el sistema.');
      return false;
    }
  };

  // Actualizar o Reubicar Reserva con Registro Obligatorio de Auditoría
  const handleUpdateReservation = async (
    updatedFields: Partial<Reservation> & { id: string },
    reason: string,
    changeType: 'reubicacion' | 'fechas' | 'pax' | 'general',
    accessibilityWarningAccepted: boolean = false
  ): Promise<boolean> => {
    try {
      const supabase = createClient();
      const currentRes = reservations.find((r) => r.id === updatedFields.id);
      if (!currentRes) return false;

      const { error: resError } = await supabase
        .from('reservations')
        .update({
          ...updatedFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', updatedFields.id);

      if (resError) throw resError;

      try {
        await supabase.from('reservation_changes').insert({
          reservation_id: updatedFields.id,
          previous_cabin_id: currentRes.cabin_id,
          new_cabin_id: updatedFields.cabin_id || currentRes.cabin_id,
          change_type: changeType,
          reason,
          accessibility_warning_accepted: accessibilityWarningAccepted,
          previous_data: currentRes as any,
          new_data: updatedFields as any,
        });
      } catch (auditErr) {
        console.warn('Registro de auditoría omitido:', auditErr);
      }

      setReservations((prev) =>
        prev.map((r) => (r.id === updatedFields.id ? { ...r, ...updatedFields } : r))
      );

      if (selectedReservation?.id === updatedFields.id) {
        setSelectedReservation((prev) => (prev ? { ...prev, ...updatedFields } : null));
      }

      return true;
    } catch (err) {
      console.error('Error actualizando reserva:', err);
      alert('No se pudo actualizar la reserva.');
      return false;
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatus: any) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      );
    } catch {
      alert('Error actualizando estado del lead');
    }
  };

  const handleCreateManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLead(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('leads')
        .insert({
          full_name: manualName,
          contact_phone: manualPhone,
          contact_email: manualEmail || null,
          pax_count: manualPax,
          source: manualSource,
          has_reduced_mobility: manualMobility,
          mobility_notes: manualMobilityNotes || null,
          notes: manualNotes || null,
          status: 'nuevo',
        })
        .select()
        .single();

      if (error) throw error;

      setLeads([data, ...leads]);
      setShowManualModal(false);
      setManualName('');
      setManualPhone('');
      setManualEmail('');
      setManualMobility(false);
      setManualMobilityNotes('');
      setManualNotes('');
    } catch {
      alert('Error guardando lead manual');
    } finally {
      setSavingLead(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <SessionSecurityGuard requiredRole="recepcion" />

      {/* 1. MENÚ LATERAL IZQUIERDO (ESTÉTICA ADMIN, COLAPSABLE CON SOLAPA) */}
      <ReceptionSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenCreateReservation={() => handleOpenManualBooking()}
        onOpenCreateLead={() => setShowManualModal(true)}
        leadsCount={leads.filter((l) => l.status === 'nuevo').length}
        activeTicketCount={activeTicketCount}
      />

      {/* 2. ÁREA PRINCIPAL CON SCROLL VERTICAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <InternalPortalHeader role="recepcion" userName="Recepcionista de Turno" blueRate={blueRate} />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Banner Superior con KPIs Operativos */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  AAL2 Verificado
                </span>
                <span className="text-xs text-slate-400">• Mostrador de Recepción Central</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Operaciones de Recepción & Cabañas
              </h2>
              <p className="text-xs text-slate-400">
                Calendario de ocupación en tiempo real, pipeline comercial, cocheras cubiertas y reporte técnico de mantenimiento.
              </p>
            </div>

            {/* Mini KPIs de Recepción */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center min-w-[90px]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Check-ins Hoy</span>
                <span className="text-lg font-bold font-mono text-emerald-400">{receptionKpis.checkins}</span>
                <span className="text-[9px] text-slate-500 block">14:00 hs</span>
              </div>

              <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center min-w-[90px]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Check-outs Hoy</span>
                <span className="text-lg font-bold font-mono text-amber-400">{receptionKpis.checkouts}</span>
                <span className="text-[9px] text-slate-500 block">10:00 am</span>
              </div>

              <div className="px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center min-w-[90px]">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Ocupación</span>
                <span className="text-lg font-bold font-mono text-slate-200">
                  {receptionKpis.occupiedCount} <span className="text-xs font-normal text-slate-500">/ 12</span>
                </span>
                <span className="text-[9px] text-emerald-400 block">{receptionKpis.freeCabins} libres</span>
              </div>

              {/* Acciones directas */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleOpenManualBooking()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cargar Reserva</span>
                </button>
                <button
                  onClick={() => setShowManualModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700/60 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cargar Consulta</span>
                </button>
              </div>
            </div>
          </div>



        {/* ============================================================== */}
        {/* TAB 1: CALENDARIO INTERACTIVO (REPLICADO DE ADMINISTRADORES) */}
        {/* ============================================================== */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  Calendario Timeline de Ocupación por Cabaña & Horarios
                </h3>
                <p className="text-xs text-slate-400">
                  Cabañas 1 a 12 en orden ascendente con indicación de accesibilidad ♿ y franjas de rotación (Check-in 14hs / Check-out 10am). Hacé doble clic en una reserva para gestionarla o clickeá en un casillero vacío para reservar.
                </p>
              </div>

              <button
                onClick={() => handleOpenManualBooking()}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow self-start sm:self-auto transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cargar Reserva Manual
              </button>
            </div>

            <InteractiveTimelineCalendar
              cabins={cabins}
              reservations={reservations}
              holidays={holidays}
              onReservationDoubleClick={handleReservationDoubleClick}
              onEmptySlotClick={(cabinId, dateStr) => handleOpenManualBooking(cabinId, dateStr)}
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: MANTENIMIENTO, AVERÍAS & PILETA (REPLICADO Y COMPARTIDO) */}
        {/* ============================================================== */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-purple-400" />
                  Gestión Operativa de Mantenimiento, Averías & Pileta
                </h3>
                <p className="text-xs text-slate-400">
                  Reportá y gestioná incidencias técnicas de cabañas 1 a 12, control químico diario de la piscina climatizada y áreas comunes. Sincronizado en tiempo real con el panel de Administradores.
                </p>
              </div>
            </div>

            <MaintenanceManagementView
              userRole="recepcion"
              userName="Recepcionista de Turno"
              cabins={cabins}
              onTicketCountChange={(count) => setActiveTicketCount(count)}
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: LEADS PIPELINE */}
        {/* ============================================================== */}
        {activeTab === 'leads' && (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100">
                  Pipeline Comercial de Interesados
                </h3>
                <p className="text-xs text-slate-400">
                  Consultas capturadas vía Web, Email, Teléfono o Telegram. Podés convertir cualquier consulta en una reserva con 1 clic.
                </p>
              </div>
              <button
                onClick={() => setShowManualModal(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto shadow transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cargar Interesado Manual
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Interesado</th>
                    <th className="p-3">Contacto</th>
                    <th className="p-3">Movilidad</th>
                    <th className="p-3">Pax</th>
                    <th className="p-3">Canal</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {new Date(l.created_at).toLocaleDateString('es-AR')}
                      </td>
                      <td className="p-3 font-bold text-slate-100">
                        {l.full_name}
                        {l.notes && (
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                            {l.notes}
                          </span>
                        )}
                        {(l.desired_check_in || l.desired_check_out) && (
                          <span className="block text-[10px] text-amber-400/80 font-mono mt-0.5">
                            📅 {l.desired_check_in || '?'} al {l.desired_check_out || '?'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono">
                        <div>{l.contact_phone || '-'}</div>
                        {l.contact_email && (
                          <div className="text-[10px] text-slate-400">{l.contact_email}</div>
                        )}
                      </td>
                      <td className="p-3">
                        {l.has_reduced_mobility ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/60 font-bold text-[10px]">
                            ♿ Movilidad Reducida
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Estándar</span>
                        )}
                      </td>
                      <td className="p-3 font-semibold">{l.pax_count} pax</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-bold border border-slate-700/60">
                          {l.source}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          value={l.status}
                          onChange={(e) => handleUpdateLeadStatus(l.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
                        >
                          <option value="nuevo">🟡 Nuevo</option>
                          <option value="contactado">🔵 Contactado</option>
                          <option value="cotizado">🟣 Cotizado</option>
                          <option value="reservado">🟢 Reservado</option>
                          <option value="descartado">⚪ Descartado</option>
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {l.status !== 'reservado' && (
                            <button
                              onClick={() => handleConvertLeadToBooking(l)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Reservar</span>
                            </button>
                          )}
                          <a
                            href={l.contact_phone?.startsWith('@') ? `https://t.me/${l.contact_phone.replace('@', '')}` : `https://t.me/+${l.contact_phone?.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-[10px] font-bold inline-flex items-center gap-1 transition-colors border border-slate-700/60"
                          >
                            Telegram
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && !loadingLeads && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500">
                        No hay consultas de interesados registradas por el momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: CONTROL DE 12 COCHERAS CUBIERTAS (1:1) */}
        {/* ============================================================== */}
        {activeTab === 'parking' && (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="font-serif text-lg font-bold text-amber-100">
                Control de 12 Cocheras Cubiertas (Regla 1:1)
              </h3>
              <p className="text-xs text-slate-400">
                Cada cabaña tiene su cochera techada exclusiva. Asignación y control de patentes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {parkingSpots.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    p.is_occupied
                      ? 'bg-amber-950/40 border-amber-600/50 text-amber-200'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span className="flex items-center gap-1.5">
                      <Car className="w-4 h-4" />
                      Cochera #{p.spot_number}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        p.is_occupied ? 'bg-amber-600 text-white' : 'bg-emerald-800 text-white'
                      }`}
                    >
                      {p.is_occupied ? 'Ocupada' : 'Disponible'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Cabaña asociada: #{p.spot_number}
                  </p>
                  <div className="mt-2 text-xs font-mono bg-slate-900 px-2 py-1 rounded border border-slate-700">
                    Patente: {p.current_license_plate || 'Sin asignar'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: CUENTAS BANCARIAS OFICIALES */}
        {/* ============================================================== */}
        {activeTab === 'bank' && (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="font-serif text-lg font-bold text-amber-100">
                Cuentas Bancarias Oficiales (Para compartir con el huésped)
              </h3>
              <p className="text-xs text-slate-400">
                Copiá con 1 clic los datos bancarios para pasar al huésped por email, Telegram o mensaje para acreditar la seña.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankAccounts.map((acc) => (
                <div key={acc.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200">
                      {acc.bank_name} ({acc.currency})
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/60">
                      {acc.currency === 'ARS' ? 'Seña en Pesos' : 'Saldo en Dólares'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">CBU: {acc.cbu_cvu}</span>
                      <button
                        onClick={() => copyToClipboard(acc.cbu_cvu, `cbu-${acc.id}`)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                        title="Copiar CBU"
                      >
                        {copiedId === `cbu-${acc.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-bold">Alias: {acc.alias}</span>
                      <button
                        onClick={() => copyToClipboard(acc.alias, `alias-${acc.id}`)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                        title="Copiar Alias"
                      >
                        {copiedId === `alias-${acc.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      Titular: {acc.account_holder} | CUIT: {acc.cuit_cuil}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VISTAS TELEGRAM: CRM & CONTROL HUMANO, RESERVAS & ASISTENTES */}
        {/* ============================================================== */}
        {activeTab === 'telegram_crm' && (
          <div className="space-y-4">
            <TelegramCrmInboxView
              onOpenCreateReservation={(guestName) => {
                setShowCreateModal(true);
              }}
              onReservationCreated={loadReceptionData}
            />
          </div>
        )}

        {activeTab === 'telegram_bookings' && (
          <div className="space-y-4">
            <TelegramBookingsView
              onOpenCreateOfficialReservation={(booking) => {
                setShowCreateModal(true);
              }}
            />
          </div>
        )}

        {activeTab === 'telegram_assistants' && (
          <div className="space-y-4">
            <TelegramAssistantsView isAdmin={false} />
          </div>
        )}
      </main>
    </div>

      {/* ============================================================== */}
      {/* MODAL: DETALLES DE RESERVA & REUBICACIÓN */}
      {/* ============================================================== */}
      <ReservationDetailModal
        isOpen={showReservationModal}
        onClose={() => setShowReservationModal(false)}
        reservation={selectedReservation}
        cabins={cabins}
        allReservations={reservations}
        currentBlueRate={blueRate}
        onUpdateReservation={handleUpdateReservation}
        changeHistory={changeHistory}
      />

      {/* ============================================================== */}
      {/* MODAL: CREAR RESERVA DIRECTA / DESDE LEAD */}
      {/* ============================================================== */}
      <CreateReservationModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedLeadForBooking(null);
          setManualInitialCabin(null);
          setManualInitialCheckIn(null);
          setManualInitialCheckOut(null);
        }}
        lead={selectedLeadForBooking}
        initialCabinId={manualInitialCabin}
        initialCheckIn={manualInitialCheckIn}
        initialCheckOut={manualInitialCheckOut}
        cabins={cabins}
        existingReservations={reservations}
        currentBlueRate={blueRate}
        onReservationCreated={handleReservationCreated}
      />

      {/* ============================================================== */}
      {/* MODAL: REGISTRAR INTERESADO MANUAL */}
      {/* ============================================================== */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-amber-100">
              Registrar Nuevo Interesado
            </h3>
            <form onSubmit={handleCreateManualLead} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:border-amber-500 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    required
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:border-amber-500 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Pasajeros
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={manualPax}
                    onChange={(e) => setManualPax(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:border-amber-500 text-slate-100"
                  />
                </div>
              </div>

              {/* Movilidad Reducida */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualMobility}
                    onChange={(e) => setManualMobility(e.target.checked)}
                    className="rounded border-slate-700 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-200">
                    ♿ Huésped con Movilidad Reducida
                  </span>
                </label>
                {manualMobility && (
                  <input
                    type="text"
                    value={manualMobilityNotes}
                    onChange={(e) => setManualMobilityNotes(e.target.value)}
                    placeholder="Ej: Requiere rampa, silla de ruedas, Cabaña PB 1 a 4"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs focus:outline-none focus:border-amber-500 text-slate-300"
                  />
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Canal de Origen
                </label>
                <select
                  value={manualSource}
                  onChange={(e: any) => setManualSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:border-amber-500 text-slate-100"
                >
                  <option value="manual">Presencial / Mostrador</option>
                  <option value="telefono">Llamada Telefónica</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Notas de Interés
                </label>
                <textarea
                  rows={2}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Fechas tentativas, cabaña deseada..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:border-amber-500 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingLead}
                  className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingLead ? 'Guardando...' : 'Guardar Interesado'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
