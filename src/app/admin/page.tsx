'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import InternalPortalHeader from '@/shared/components/InternalPortalHeader';
import SessionSecurityGuard from '@/shared/components/SessionSecurityGuard';
import { createClient } from '@/shared/lib/supabase/client';
import { formatARS, formatUSD } from '@/shared/lib/bimonetary';
import {
  Cabin,
  Reservation,
  HolidayException,
  SeasonConfig,
  ReservationChange,
  Supplier,
  BankAccount,
  AuditLog,
  UserProfile,
  Lead,
} from '@/shared/types';
import AdminSidebar, { AdminActiveView } from '@/modules/admin/components/AdminSidebar';
import TopKpiCards from '@/modules/admin/components/TopKpiCards';
import InteractiveTimelineCalendar from '@/modules/admin/components/InteractiveTimelineCalendar';
import ReservationDetailModal from '@/modules/admin/components/ReservationDetailModal';
import OperationalSettingsModal from '@/modules/admin/components/OperationalSettingsModal';
import CreateReservationModal from '@/modules/admin/components/CreateReservationModal';
import LeadsManagementView from '@/modules/admin/components/LeadsManagementView';
import MaintenanceManagementView from '@/modules/maintenance/components/MaintenanceManagementView';
import TelegramBotConfigCard from '@/modules/telegram/components/TelegramBotConfigCard';
import TelegramCrmInboxView from '@/modules/telegram/components/TelegramCrmInboxView';
import TelegramAssistantsView from '@/modules/telegram/components/TelegramAssistantsView';
import TelegramBookingsView from '@/modules/telegram/components/TelegramBookingsView';
import { fetchArgentineHolidays, ARGENTINA_OFFICIAL_HOLIDAYS_FALLBACK } from '@/modules/operations/holidayService';
import {
  CreditCard,
  Building2,
  Users,
  ShieldCheck,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Search,
  MessageSquare,
  Calendar,
  Sparkles,
  X,
  Wrench,
} from 'lucide-react';

export default function AdminDashboardPage() {
  // Sidebar states
  const [activeView, setActiveView] = useState<AdminActiveView>('calendar');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Exchange rate
  const [blueRate, setBlueRate] = useState<number>(1285);
  const [blueBuyRate, setBlueBuyRate] = useState<number>(1265);
  const [showRateModal, setShowRateModal] = useState(false);
  const [newRateInput, setNewRateInput] = useState<string>('1285');
  const [updatingRate, setUpdatingRate] = useState(false);
  const [rateSuccess, setRateSuccess] = useState<string | null>(null);

  // Core domain data
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [holidays, setHolidays] = useState<HolidayException[]>([]);
  const [seasonConfig, setSeasonConfig] = useState<SeasonConfig | null>(null);
  const [changeHistory, setChangeHistory] = useState<ReservationChange[]>([]);

  // Modals
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'temporadas' | 'feriados' | 'horarios' | 'seguridad'>('temporadas');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeadForBooking, setSelectedLeadForBooking] = useState<Lead | null>(null);
  const [manualInitialCabin, setManualInitialCabin] = useState<string | null>(null);
  const [manualInitialCheckIn, setManualInitialCheckIn] = useState<string | null>(null);
  const [manualInitialCheckOut, setManualInitialCheckOut] = useState<string | null>(null);

  // New lead manual modal
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadSource, setNewLeadSource] = useState<
    'telegram' | 'web' | 'telefono' | 'mostrador' | 'instagram'
  >('telegram');
  const [newLeadCheckIn, setNewLeadCheckIn] = useState('');
  const [newLeadCheckOut, setNewLeadCheckOut] = useState('');
  const [newLeadPax, setNewLeadPax] = useState(4);
  const [newLeadMobility, setNewLeadMobility] = useState(false);
  const [newLeadNotes, setNewLeadNotes] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  // Secondary data for other views
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // New bank account modal
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankCurrency, setBankCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [bankName, setBankName] = useState('');
  const [bankAccountType, setBankAccountType] = useState('Caja de Ahorro');
  const [bankCbu, setBankCbu] = useState('');
  const [bankAlias, setBankAlias] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankCuit, setBankCuit] = useState('');
  const [bankNotes, setBankNotes] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  // Fecha operativa actual del sistema (16 de Noviembre de 2026)
  const todayStr = '2026-11-16';

  // 1. Cargar datos principales
  const loadAdminData = useCallback(async () => {
    try {
      const supabase = createClient();

      // Cargar tasa
      const { data: rateData } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (rateData?.sell_rate) {
        setBlueRate(Number(rateData.sell_rate));
        setBlueBuyRate(Number(rateData.buy_rate || rateData.sell_rate - 20));
        setNewRateInput(String(rateData.sell_rate));
      }

      // Cargar cabañas (1 a 12)
      const { data: cabinData } = await supabase
        .from('cabins')
        .select('*')
        .order('cabin_number', { ascending: true });
      if (cabinData) setCabins(cabinData);

      // Cargar reservas con mapeo robusto de accesibilidad
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

      // Cargar consultas / leads
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (leadsData) setLeads(leadsData);

      // Cargar configuración de temporada
      const { data: seasonData } = await supabase
        .from('season_config')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();
      if (seasonData) setSeasonConfig(seasonData);

      // Cargar feriados / fechas especiales
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

      // Cargar cuentas bancarias
      const { data: bankData } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('currency');
      if (bankData) setBankAccounts(bankData);

      // Cargar proveedores
      const { data: supData } = await supabase
        .from('suppliers')
        .select('*')
        .order('business_name');
      if (supData) setSuppliers(supData);

      // Cargar logs de auditoría
      const { data: logData } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (logData) setAuditLogs(logData);

      // Cargar perfiles de usuarios
      const { data: profData } = await supabase
        .from('user_profiles')
        .select('*')
        .order('role');
      if (profData) setUsers(profData);
    } catch (err) {
      console.error('Error cargando datos de admin:', err);
    }
  }, []);

  useEffect(() => {
    loadAdminData();

    // Sincronización en tiempo real (Reservas y Consultas sincronizadas con Recepción)
    const supabase = createClient();
    const channel = supabase
      .channel('admin_reservations_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        async () => {
          const { data: resData } = await supabase
            .from('reservations')
            .select('*')
            .order('check_in_date', { ascending: false });
          if (resData) {
            const enriched: Reservation[] = resData.map((r: any) => ({
              ...r,
              has_reduced_mobility:
                r.has_reduced_mobility ??
                Boolean(
                  r.internal_notes?.toLowerCase().includes('silla de ruedas') ||
                    r.internal_notes?.toLowerCase().includes('movilidad') ||
                    r.internal_notes?.toLowerCase().includes('rampa')
                ),
            }));
            setReservations(enriched);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAdminData]);

  // Recargar datos operativos al cambiar a la vista de calendario
  useEffect(() => {
    if (activeView === 'calendar') {
      loadAdminData();
    }
  }, [activeView, loadAdminData]);

  // 2. Cargar historial de auditoría al seleccionar una reserva
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

  // 3. Cálculos Dinámicos de Indicadores Superiores (KPIs en tiempo real)
  const kpiMetrics = useMemo(() => {
    // Ingresos Hoy (Check-ins a las 14hs)
    const checkinsToday = reservations.filter(
      (r) => r.check_in_date === todayStr && r.status !== 'cancelada'
    );
    const checkinsCount = checkinsToday.length;
    const checkinsPax = checkinsToday.reduce((acc, r) => acc + (r.guest_count || 0), 0);

    // Egresos Hoy (Check-outs a las 10am)
    const checkoutsToday = reservations.filter(
      (r) => r.check_out_date === todayStr && r.status !== 'cancelada'
    );
    const checkoutsCount = checkoutsToday.length;
    const checkoutsPax = checkoutsToday.reduce((acc, r) => acc + (r.guest_count || 0), 0);

    // Cabañas Ocupadas en el día
    const activeOccupied = reservations.filter((r) => {
      if (r.status === 'cancelada') return false;
      return (
        (todayStr >= r.check_in_date && todayStr < r.check_out_date) ||
        (r.check_in_date === todayStr && r.status === 'checkin')
      );
    });

    const distinctOccupiedCabins = new Set(activeOccupied.map((r) => r.cabin_id)).size;
    const totalPax = activeOccupied.reduce((acc, r) => acc + (r.guest_count || 0), 0);
    const occupancy = Math.min(100, Math.round((distinctOccupiedCabins / 12) * 100));

    return {
      checkinsCount,
      checkinsPax,
      checkoutsCount,
      checkoutsPax,
      occupiedCabins: distinctOccupiedCabins,
      totalPax,
      occupancy,
    };
  }, [reservations, todayStr]);

  // 4. Manejador de doble clic en una reserva del calendario
  const handleReservationDoubleClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowReservationModal(true);
  };

  // 4b. Abrir modal para Carga Manual Directa de Reserva
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

  // 5. Crear Reserva desde Consulta (Lead) o Directa
  const handleReservationCreated = async (
    newResData: any,
    fromLeadId?: string
  ): Promise<boolean> => {
    try {
      const supabase = createClient();
      const sanitizedResData = {
        ...newResData,
        guest_dni: (newResData.guest_dni || '').trim() || 'N/A',
        guest_phone: (newResData.guest_phone || '').trim() || 'N/A',
        guest_email: (newResData.guest_email || '').trim() || 'contacto@cabanasanto.com',
      };
      const { data, error } = await supabase
        .from('reservations')
        .insert(sanitizedResData)
        .select()
        .single();

      if (error) {
        console.error('Error insertando reserva en Supabase:', error);
        alert(`Error al guardar reserva en base de datos: ${error.message || 'Error desconocido'}`);
        return false;
      }

      // Si viene de un lead, actualizar estado a reserva_realizada y bloquear/vincular la reserva
      if (fromLeadId) {
        await supabase
          .from('leads')
          .update({
            status: 'reserva_realizada',
            converted_reservation_id: data.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', fromLeadId);

        setLeads((prev) =>
          prev.map((l) =>
            l.id === fromLeadId
              ? {
                  ...l,
                  status: 'reserva_realizada' as any,
                  converted_reservation_id: data.id,
                }
              : l
          )
        );
      }

      if (data) {
        const enriched: Reservation = {
          ...data,
          has_reduced_mobility: data.has_reduced_mobility ?? Boolean(newResData.has_reduced_mobility),
        };
        setReservations((prev) => [enriched, ...prev]);
        setShowCreateModal(false);
        setSelectedLeadForBooking(null);
        // Cambiar a la vista calendario para ver la reserva inmediatamente
        setActiveView('calendar');
      }

      return true;
    } catch (err: any) {
      console.error('Error al crear reserva:', err);
      alert(`Error guardando la reserva en el sistema: ${err?.message || 'Error general'}`);
      return false;
    }
  };

  // 6. Actualizar estado de Consulta
  const handleUpdateLeadStatus = async (leadId: string, status: string) => {
    try {
      const supabase = createClient();
      await supabase
        .from('leads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: status as any } : l))
      );
    } catch (e) {
      console.error(e);
    }
  };

  // 7. Crear Consulta Manual
  const handleCreateManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLead(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('leads')
        .insert({
          full_name: newLeadName,
          contact_phone: newLeadPhone || null,
          contact_email: newLeadEmail || null,
          source: newLeadSource,
          desired_check_in: newLeadCheckIn || null,
          desired_check_out: newLeadCheckOut || null,
          pax_count: newLeadPax,
          has_reduced_mobility: newLeadMobility,
          notes: newLeadNotes || null,
          status: 'nuevo',
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setLeads([data, ...leads]);

      setShowNewLeadModal(false);
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadEmail('');
      setNewLeadCheckIn('');
      setNewLeadCheckOut('');
      setNewLeadNotes('');
      setNewLeadMobility(false);
    } catch (err) {
      alert('Error guardando la consulta.');
    } finally {
      setSavingLead(false);
    }
  };

  // 8. Actualizar o Reubicar Reserva con Registro Obligatorio de Auditoría
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
          previous_data: currentRes,
          new_data: { ...currentRes, ...updatedFields },
        });
      } catch (e) {
        console.warn('Registro de reservation_changes:', e);
      }

      setReservations((prev) =>
        prev.map((r) => (r.id === updatedFields.id ? { ...r, ...updatedFields } : r))
      );

      if (selectedReservation && selectedReservation.id === updatedFields.id) {
        setSelectedReservation({ ...selectedReservation, ...updatedFields });
      }

      return true;
    } catch (error) {
      console.error('Error al actualizar reserva:', error);
      alert('Hubo un error al guardar las modificaciones.');
      return false;
    }
  };

  // 9. Configuración de Temporada
  const handleSaveSeasonConfig = async (config: Partial<SeasonConfig>): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('season_config')
        .update({
          ...config,
          updated_at: new Date().toISOString(),
        })
        .eq('is_active', true);

      if (error) throw error;
      if (seasonConfig) {
        setSeasonConfig({ ...seasonConfig, ...config });
      }
      return true;
    } catch (e) {
      console.error(e);
      alert('Error guardando la temporada.');
      return false;
    }
  };

  // 10. Feriados y Fechas Especiales
  const handleAddHoliday = async (newHol: Omit<HolidayException, 'id'>): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('holiday_exceptions')
        .insert({
          name: newHol.name,
          start_date: newHol.start_date,
          end_date: newHol.end_date,
          type: newHol.type,
          description: newHol.description || null,
        })
        .select()
        .single();

      if (error) {
        const localHol = { ...newHol, id: `local-${Date.now()}` };
        setHolidays((prev) => [...prev, localHol]);
        return true;
      }

      if (data) setHolidays((prev) => [...prev, data]);
      return true;
    } catch {
      return false;
    }
  };

  const handleDeleteHoliday = async (id: string): Promise<boolean> => {
    try {
      const supabase = createClient();
      await supabase.from('holiday_exceptions').delete().eq('id', id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  const handleSyncApiHolidays = async (): Promise<boolean> => {
    try {
      const apiHolidays = await fetchArgentineHolidays(2026);
      const supabase = createClient();

      for (const hol of apiHolidays.slice(0, 8)) {
        await supabase
          .from('holiday_exceptions')
          .insert({
            name: hol.name,
            start_date: hol.start_date,
            end_date: hol.end_date,
            type: hol.type,
            description: hol.description,
          })
          .select();
      }

      const { data } = await supabase.from('holiday_exceptions').select('*');
      if (data && data.length > 0) {
        setHolidays(data);
      } else {
        setHolidays(
          apiHolidays.map((h, i) => ({
            ...h,
            id: `api-synced-${i}`,
          }))
        );
      }

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // 11. Actualizar Cotización Dólar Blue
  const handleUpdateExchangeRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingRate(true);
    setRateSuccess(null);

    const parsedRate = parseFloat(newRateInput);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      alert('Cotización inválida');
      setUpdatingRate(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.from('exchange_rates').insert({
        currency_pair: 'USD_ARS_BLUE',
        buy_rate: parsedRate - 20,
        sell_rate: parsedRate,
        source: 'manual_override_dueno',
        is_manual_override: true,
      });

      if (error) throw error;

      setBlueRate(parsedRate);
      setBlueBuyRate(parsedRate - 20);
      setRateSuccess('Cotización oficial actualizada en todo el complejo');
      setTimeout(() => {
        setRateSuccess(null);
        setShowRateModal(false);
      }, 1500);
    } catch {
      alert('Error guardando la cotización');
    } finally {
      setUpdatingRate(false);
    }
  };

  // 12. Crear Cuenta Bancaria
  const handleCreateBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          currency: bankCurrency,
          bank_name: bankName,
          account_type: bankAccountType,
          cbu_cvu: bankCbu,
          alias: bankAlias.toUpperCase(),
          account_holder: bankHolder,
          cuit_cuil: bankCuit,
          notes: bankNotes || null,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setBankAccounts([...bankAccounts, data]);
      setShowBankModal(false);
      setBankName('');
      setBankCbu('');
      setBankAlias('');
      setBankHolder('');
      setBankCuit('');
      setBankNotes('');
    } catch {
      alert('Error guardando la cuenta bancaria');
    } finally {
      setSavingBank(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <SessionSecurityGuard requiredRole="admin" />

      {/* 1. MENÚ LATERAL (SIDEBAR DE NAVEGACIÓN & OPERATIVIDAD) */}
      <AdminSidebar
        activeView={activeView}
        onSelectView={(view) => {
          if (view === 'season_config' || view === 'holidays' || view === 'schedules' || view === 'security_session') {
            if (view === 'security_session') setSettingsInitialTab('seguridad');
            else if (view === 'holidays') setSettingsInitialTab('feriados');
            else if (view === 'schedules') setSettingsInitialTab('horarios');
            else setSettingsInitialTab('temporadas');
            setShowSettingsModal(true);
          } else {
            setActiveView(view);
          }
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenHolidayModal={() => {
          setSettingsInitialTab('feriados');
          setShowSettingsModal(true);
        }}
        onOpenSeasonModal={() => {
          setSettingsInitialTab('temporadas');
          setShowSettingsModal(true);
        }}
        onOpenCreateReservation={() => handleOpenManualBooking()}
        leadsCount={leads.filter((l) => l.status === 'nuevo').length}
      />

      {/* 2. ÁREA PRINCIPAL CON SCROLL VERTICAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <InternalPortalHeader role="dueno" userName="Dueño / Propietario" blueRate={blueRate} />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Welcome Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold border border-amber-500/20">
                  Panel Dueño / Administrador
                </span>
                <span className="text-xs text-slate-400">• Villa Gesell, Argentina</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                Control Operativo & Calendario de Disponibilidad
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Supervisión de las 12 cabañas por horas, check-in 14 hs, check-out 10 am y conversión de consultas.
              </p>
            </div>

            {/* Acciones Rápidas */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <button
                onClick={() => handleOpenManualBooking()}
                className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" /> Cargar Reserva Manual
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all border border-slate-700"
              >
                Operatividad
              </button>
            </div>
          </div>

          {/* 3. BARRA SUPERIOR DE INDICADORES (KPI CARDS EN TIEMPO REAL) */}
          <TopKpiCards
            checkinsTodayCount={kpiMetrics.checkinsCount}
            checkinsTodayPax={kpiMetrics.checkinsPax}
            checkoutsTodayCount={kpiMetrics.checkoutsCount}
            checkoutsTodayPax={kpiMetrics.checkoutsPax}
            occupiedCabinsCount={kpiMetrics.occupiedCabins}
            totalCabinsCount={12}
            totalPaxToday={kpiMetrics.totalPax}
            occupancyPercentage={kpiMetrics.occupancy}
            blueRateSell={blueRate}
            blueRateBuy={blueBuyRate}
            onOpenRateModal={() => setShowRateModal(true)}
          />

          {/* 4. VISTA ACTIVA: CONSULTAS & LEADS */}
          {activeView === 'leads' && (
            <LeadsManagementView
              leads={leads}
              onOpenCreateReservation={(lead) => {
                setSelectedLeadForBooking(lead);
                setShowCreateModal(true);
              }}
              onUpdateLeadStatus={handleUpdateLeadStatus}
              onAddNewLeadClick={() => setShowNewLeadModal(true)}
            />
          )}

          {/* VISTA ACTIVA: CALENDARIO DE OCUPACIÓN TIMELINE */}
          {activeView === 'calendar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-500" />
                    Calendario de Cabañas & Ocupación Horaria
                  </h2>
                  <p className="text-xs text-slate-400">
                    Cabañas 1 a 12 en orden ascendente con indicación de accesibilidad ♿ y franjas de rotación.
                  </p>
                </div>

                <button
                  onClick={() => handleOpenManualBooking()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
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

          {/* VISTA SECUNDARIA: DASHBOARD RESUMEN */}
          {activeView === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resumen de Cuentas */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-500" /> Cuentas Bancarias Oficiales
                    </h3>
                    <button
                      onClick={() => setShowBankModal(true)}
                      className="text-xs text-amber-400 hover:underline font-bold"
                    >
                      + Nueva Cuenta
                    </button>
                  </div>
                  <div className="space-y-2">
                    {bankAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-white">{acc.bank_name}</span>
                          <p className="text-slate-400 font-mono text-[11px]">Alias: {acc.alias}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                          {acc.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proveedores Activos */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" /> Proveedores Homologados
                  </h3>
                  <div className="space-y-2">
                    {suppliers.slice(0, 4).map((sup) => (
                      <div
                        key={sup.id}
                        className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-white">{sup.business_name}</span>
                          <p className="text-slate-400 text-[11px]">{sup.category}</p>
                        </div>
                        <span className="text-[11px] text-slate-300 font-mono">{sup.phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Logs de Auditoría */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Registro Inmutable de Auditoría
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] flex items-center justify-between"
                    >
                      <span className="font-bold text-slate-300 uppercase">
                        {log.action} • {log.entity}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {new Date(log.created_at).toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VISTA SECUNDARIA: CUENTAS BANCARIAS */}
          {activeView === 'bank' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Cuentas Bancarias Bimonetarias</h3>
                  <p className="text-xs text-slate-400">
                    Cuentas activas para recepción de señas y liquidación de saldos en ARS y USD billete.
                  </p>
                </div>
                <button
                  onClick={() => setShowBankModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  + Agregar Cuenta
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bankAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">{acc.bank_name}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold">
                        {acc.currency}
                      </span>
                    </div>
                    <p className="text-slate-300">
                      <strong>Titular:</strong> {acc.account_holder} ({acc.cuit_cuil})
                    </p>
                    <p className="text-slate-300 font-mono">
                      <strong>CBU/CVU:</strong> {acc.cbu_cvu}
                    </p>
                    <p className="text-slate-300 font-mono">
                      <strong>Alias:</strong> {acc.alias}
                    </p>
                    {acc.notes && <p className="text-slate-500 italic text-[11px]">{acc.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VISTA MANTENIMIENTO, INCIDENCIAS & CONTROL DE PILETA */}
          {activeView === 'maintenance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-amber-500" />
                    Gestión Integral de Mantenimiento & Control de Pileta
                  </h2>
                  <p className="text-xs text-slate-400">
                    Carga y seguimiento de incidencias en cabañas 1 a 12, piscina climatizada y áreas comunes. Sincronizado en tiempo real con Recepción.
                  </p>
                </div>
              </div>

              <MaintenanceManagementView
                userRole="admin"
                userName="Administración Central"
                cabins={cabins}
              />
            </div>
          )}

          {/* VISTAS DE TELEGRAM, CRM, ASISTENTES IA & CONFIGURACIÓN */}
          {activeView === 'telegram_crm' && (
            <div className="space-y-4">
              <TelegramCrmInboxView
                onReservationCreated={loadAdminData}
                onOpenCreateReservation={(guestName) => {
                  setSelectedLeadForBooking({
                    id: `tg_${Date.now()}`,
                    full_name: guestName || 'Huésped Telegram',
                    source: 'telegram',
                    pax_count: 2,
                    has_reduced_mobility: false,
                    status: 'nuevo',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                  setShowCreateModal(true);
                }}
              />
            </div>
          )}

          {activeView === 'telegram_bookings' && (
            <div className="space-y-4">
              <TelegramBookingsView
                onOpenCreateOfficialReservation={(booking) => {
                  setSelectedLeadForBooking({
                    id: booking.id,
                    full_name: booking.contact?.full_name || 'Huésped Telegram',
                    source: 'telegram',
                    desired_check_in: booking.check_in,
                    desired_check_out: booking.check_out,
                    pax_count: booking.guests_count,
                    has_reduced_mobility: false,
                    status: 'en_conversacion',
                    created_at: booking.created_at,
                    updated_at: booking.updated_at,
                    notes: booking.notes,
                  });
                  setManualInitialCheckIn(booking.check_in);
                  setManualInitialCheckOut(booking.check_out);
                  setShowCreateModal(true);
                }}
              />
            </div>
          )}

          {activeView === 'telegram_assistants' && (
            <div className="space-y-4">
              <TelegramAssistantsView isAdmin={true} />
            </div>
          )}

          {activeView === 'telegram_bot' && (
            <div className="space-y-4">
              <TelegramBotConfigCard />
            </div>
          )}
        </main>
      </div>

      {/* 5. MODAL: CREAR RESERVA DIRECTA / DESDE CONSULTA */}
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

      {/* 6. MODAL: NUEVA CONSULTA MANUAL */}
      {showNewLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500" /> Nueva Consulta de Huésped
              </h4>
              <button
                onClick={() => setShowNewLeadModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualLead} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  placeholder="Ej: Marcelo Castro"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Teléfono / Telegram</label>
                  <input
                    type="text"
                    placeholder="+54 9 11 ..."
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Canal de Origen</label>
                  <select
                    value={newLeadSource}
                    onChange={(e: any) => setNewLeadSource(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none"
                  >
                    <option value="telegram">✈️ Telegram</option>
                    <option value="web">🌐 Web Oficial</option>
                    <option value="mostrador">🏢 Mostrador / Presencial</option>
                    <option value="telefono">📞 Teléfono</option>
                    <option value="instagram">📸 Instagram</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Ingreso Deseado</label>
                  <input
                    type="date"
                    value={newLeadCheckIn}
                    onChange={(e) => setNewLeadCheckIn(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Salida Deseada</label>
                  <input
                    type="date"
                    value={newLeadCheckOut}
                    onChange={(e) => setNewLeadCheckOut(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Pax</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={newLeadPax}
                    onChange={(e) => setNewLeadPax(Number(e.target.value))}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300 py-1">
                  <input
                    type="checkbox"
                    checked={newLeadMobility}
                    onChange={(e) => setNewLeadMobility(e.target.checked)}
                    className="rounded text-blue-500"
                  />
                  ♿ Requiere Accesibilidad / Movilidad Reducida
                </label>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Notas de la Consulta</label>
                <textarea
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  placeholder="Detalles sobre lo consultado, presupuesto, requerimientos de pileta o desayuno..."
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-amber-500"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewLeadModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider"
                >
                  {savingLead ? 'Guardando...' : 'Crear Consulta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: FICHA DETALLADA DE RESERVA, REUBICACIÓN Y AUDITORÍA */}
      <ReservationDetailModal
        isOpen={showReservationModal}
        onClose={() => {
          setShowReservationModal(false);
          setSelectedReservation(null);
        }}
        reservation={selectedReservation}
        cabins={cabins}
        allReservations={reservations}
        currentBlueRate={blueRate}
        onUpdateReservation={handleUpdateReservation}
        changeHistory={changeHistory}
      />

      {/* 8. MODAL: CONFIGURACIONES DE OPERATIVIDAD */}
      <OperationalSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        seasonConfig={seasonConfig}
        holidays={holidays}
        onSaveSeasonConfig={handleSaveSeasonConfig}
        onAddHoliday={handleAddHoliday}
        onDeleteHoliday={handleDeleteHoliday}
        onSyncApiHolidays={handleSyncApiHolidays}
        initialTab={settingsInitialTab}
      />

      {/* 9. MODAL: AJUSTE RÁPIDO DE COTIZACIÓN DÓLAR BLUE */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-white">Fijar Cotización Dólar Blue</h4>
            <p className="text-xs text-slate-400">
              Esta tasa se aplicará de inmediato al cálculo de señas y conversión de saldos en el complejo.
            </p>
            <form onSubmit={handleUpdateExchangeRate} className="space-y-4">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-amber-400 font-bold">$</span>
                <input
                  type="number"
                  step="any"
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm outline-none focus:border-amber-500"
                  required
                />
              </div>
              {rateSuccess && (
                <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {rateSuccess}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRateModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updatingRate}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                >
                  {updatingRate ? 'Actualizando...' : 'Guardar Tasa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. MODAL: NUEVA CUENTA BANCARIA */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-white">Alta de Cuenta Bancaria</h4>
            <form onSubmit={handleCreateBankAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Moneda</label>
                  <select
                    value={bankCurrency}
                    onChange={(e: any) => setBankCurrency(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  >
                    <option value="ARS">ARS (Pesos)</option>
                    <option value="USD">USD (Dólares)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Tipo de Cuenta</label>
                  <input
                    type="text"
                    value={bankAccountType}
                    onChange={(e) => setBankAccountType(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Nombre del Banco</label>
                <input
                  type="text"
                  placeholder="Ej: Banco Galicia"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">CBU / CVU</label>
                  <input
                    type="text"
                    value={bankCbu}
                    onChange={(e) => setBankCbu(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Alias</label>
                  <input
                    type="text"
                    value={bankAlias}
                    onChange={(e) => setBankAlias(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white uppercase font-mono"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Titular</label>
                  <input
                    type="text"
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">CUIT / CUIL</label>
                  <input
                    type="text"
                    value={bankCuit}
                    onChange={(e) => setBankCuit(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Notas Operativas</label>
                <input
                  type="text"
                  value={bankNotes}
                  onChange={(e) => setBankNotes(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBank}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                >
                  {savingBank ? 'Guardando...' : 'Guardar Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
