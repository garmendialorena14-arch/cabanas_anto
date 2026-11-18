'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  Plus,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Building,
  Check,
  X,
  Thermometer,
  Activity,
  Layers,
  FileText,
  DollarSign,
  AlertCircle,
  Home,
  Sliders,
} from 'lucide-react';
import { Cabin, MaintenanceTicket, MaintenancePriority, MaintenanceStatus, PreventiveMaintenance } from '@/shared/types';
import { createClient } from '@/shared/lib/supabase/client';
import { formatARS } from '@/shared/lib/bimonetary';

interface MaintenanceManagementViewProps {
  userRole?: 'admin' | 'dueno' | 'recepcion' | 'mantenimiento';
  userName?: string;
  cabins?: Cabin[];
  onTicketCountChange?: (count: number) => void;
}

export default function MaintenanceManagementView({
  userRole = 'recepcion',
  userName = 'Personal',
  cabins = [],
  onTicketCountChange,
}: MaintenanceManagementViewProps) {
  // Tabs internas
  const [subTab, setSubTab] = useState<'tickets' | 'pool' | 'cabins_grid'>('tickets');

  // Datos
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [preventives, setPreventives] = useState<PreventiveMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros de Tickets
  const [searchFilter, setSearchFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todas');
  const [priorityFilter, setPriorityFilter] = useState('todas');

  // Modal Nueva Incidencia
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketScope, setTicketScope] = useState<'cabin' | 'common'>('cabin');
  const [selectedCabinId, setSelectedCabinId] = useState<string>('');
  const [customArea, setCustomArea] = useState('Sector Pileta Climatizada');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketPriority, setTicketPriority] = useState<MaintenancePriority>('media');
  const [ticketCostEst, setTicketCostEst] = useState<string>('');
  const [savingTicket, setSavingTicket] = useState(false);

  // Modal Control de Pileta / Preventivo
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [poolFacility, setPoolFacility] = useState<'pileta' | 'quincho' | 'bombas_riego' | 'termotanques'>('pileta');
  const [poolPh, setPoolPh] = useState<string>('7.4');
  const [poolChlorine, setPoolChlorine] = useState<string>('1.5');
  const [poolTemp, setPoolTemp] = useState<string>('31.5');
  const [poolFilterStatus, setPoolFilterStatus] = useState<string>('Limpio y en operación normal');
  const [poolNotes, setPoolNotes] = useState<string>('');
  const [savingPool, setSavingPool] = useState(false);

  // Modal Gestionar / Resolver Ticket
  const [ticketToManage, setTicketToManage] = useState<MaintenanceTicket | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<MaintenanceStatus>('en_progreso');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionCostActual, setResolutionCostActual] = useState('');
  const [updatingTicket, setUpdatingTicket] = useState(false);

  // Cabañas ordenadas 1 a 12
  const sortedCabins = useMemo(() => {
    return [...cabins].sort((a, b) => a.cabin_number - b.cabin_number);
  }, [cabins]);

  // Función principal para cargar datos
  const loadData = useCallback(async () => {
    try {
      // Intentar vía API route optimizado primero
      const res = await fetch('/api/maintenance');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setTickets(json.tickets || []);
          setPreventives(json.preventives || []);
          if (onTicketCountChange) {
            const pending = (json.tickets || []).filter(
              (t: MaintenanceTicket) => t.status === 'pendiente' || t.status === 'en_progreso'
            ).length;
            onTicketCountChange(pending);
          }
          return;
        }
      }

      // Fallback a cliente Supabase
      const supabase = createClient();
      const { data: tickData } = await supabase
        .from('maintenance_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (tickData) {
        setTickets(tickData);
        if (onTicketCountChange) {
          const pending = tickData.filter(
            (t) => t.status === 'pendiente' || t.status === 'en_progreso'
          ).length;
          onTicketCountChange(pending);
        }
      }

      const { data: prevData } = await supabase
        .from('preventive_maintenance')
        .select('*')
        .order('record_date', { ascending: false })
        .limit(20);
      if (prevData) setPreventives(prevData);
    } catch (err) {
      console.error('Error cargando incidencias de mantenimiento:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onTicketCountChange]);

  useEffect(() => {
    loadData();

    // Sincronización en tiempo real vía Supabase Realtime Channel
    const supabase = createClient();
    const channel = supabase
      .channel('maintenance_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_tickets' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'preventive_maintenance' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // 1. Guardar Incidencia / Avería
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTicket(true);

    let areaFinal = '';
    let cabinIdFinal: string | null = null;

    if (ticketScope === 'cabin') {
      const c = cabins.find((cab) => cab.id === selectedCabinId);
      areaFinal = c ? `Cabaña #${c.cabin_number} (${c.name})` : 'Cabaña';
      cabinIdFinal = selectedCabinId || null;
    } else {
      areaFinal = customArea;
      cabinIdFinal = null;
    }

    try {
      const payload = {
        action: 'create_ticket',
        cabin_id: cabinIdFinal,
        area_name: areaFinal,
        title: ticketTitle,
        description: ticketDesc,
        priority: ticketPriority,
        cost_estimated_ars: ticketCostEst ? parseFloat(ticketCostEst) : null,
        reported_by_name: userName,
      };

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Error al registrar la incidencia');
      }

      const result = await res.json();
      if (result.ticket) {
        setTickets((prev) => [result.ticket, ...prev]);
      } else {
        await loadData();
      }

      setShowTicketModal(false);
      setTicketTitle('');
      setTicketDesc('');
      setTicketCostEst('');
      setSelectedCabinId('');
    } catch (err: any) {
      alert(err.message || 'Error guardando incidencia');
    } finally {
      setSavingTicket(false);
    }
  };

  // 2. Guardar Control Preventivo / Pileta
  const handleCreatePreventive = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPool(true);

    try {
      const payload = {
        action: 'create_preventive',
        facility: poolFacility,
        ph_level: poolPh ? parseFloat(poolPh) : null,
        chlorine_level: poolChlorine ? parseFloat(poolChlorine) : null,
        water_temp_celsius: poolTemp ? parseFloat(poolTemp) : null,
        filter_status: poolFilterStatus,
        observations: poolNotes || null,
        record_date: new Date().toISOString().split('T')[0],
      };

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Error al guardar registro preventivo');
      }

      const result = await res.json();
      if (result.record) {
        setPreventives((prev) => [result.record, ...prev]);
      } else {
        await loadData();
      }

      setShowPoolModal(false);
      setPoolNotes('');
    } catch (err: any) {
      alert(err.message || 'Error guardando registro preventivo');
    } finally {
      setSavingPool(false);
    }
  };

  // Abrir modal para gestionar / resolver incidencia
  const handleOpenManageTicket = (ticket: MaintenanceTicket, defaultStatus?: MaintenanceStatus) => {
    setTicketToManage(ticket);
    setResolutionStatus(defaultStatus || ticket.status);
    setResolutionNotes(ticket.resolution_notes || '');
    setResolutionCostActual(ticket.cost_actual_ars ? ticket.cost_actual_ars.toString() : '');
  };

  // Cambio rápido de estado con 1 clic (ej: poner en progreso)
  const handleQuickStatusChange = async (ticket: MaintenanceTicket, newStatus: MaintenanceStatus) => {
    try {
      const payload = {
        action: 'update_ticket',
        id: ticket.id,
        status: newStatus,
        resolution_notes: ticket.resolution_notes || null,
        cost_actual_ars: ticket.cost_actual_ars || null,
      };

      let success = false;
      let updatedTicket: MaintenanceTicket | null = null;

      try {
        const res = await fetch('/api/maintenance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.ticket) {
            updatedTicket = result.ticket;
            success = true;
          }
        }
      } catch (err) {
        console.warn('API error, falling back to direct Supabase client', err);
      }

      if (!success) {
        const supabase = createClient();
        const updateData: Record<string, any> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
          resolved_at: (newStatus === 'resuelta' || newStatus === 'resuelto') ? new Date().toISOString() : null,
        };

        const { data, error } = await supabase
          .from('maintenance_tickets')
          .update(updateData)
          .eq('id', ticket.id)
          .select()
          .single();

        if (error) throw error;
        updatedTicket = data;
        success = true;
      }

      if (updatedTicket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === updatedTicket!.id ? updatedTicket! : t))
        );
      } else {
        await loadData();
      }
    } catch (err: any) {
      alert('Error al actualizar estado: ' + (err.message || 'Error desconocido'));
    }
  };

  // 3. Actualizar Estado de Incidencia (Modal de Resolución)
  const handleUpdateTicketStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketToManage) return;

    setUpdatingTicket(true);
    try {
      const payload = {
        action: 'update_ticket',
        id: ticketToManage.id,
        status: resolutionStatus,
        resolution_notes: resolutionNotes || null,
        cost_actual_ars: resolutionCostActual ? parseFloat(resolutionCostActual) : null,
      };

      let success = false;
      let updatedTicket: MaintenanceTicket | null = null;

      try {
        const res = await fetch('/api/maintenance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const result = await res.json();
          if (result.ticket) {
            updatedTicket = result.ticket;
            success = true;
          }
        }
      } catch (apiErr) {
        console.warn('API /api/maintenance falló, usando Supabase Client fallback:', apiErr);
      }

      // Fallback directo a cliente Supabase si falla la API
      if (!success) {
        const supabase = createClient();
        const updateData: Record<string, any> = {
          status: resolutionStatus,
          resolution_notes: resolutionNotes || null,
          cost_actual_ars: resolutionCostActual ? parseFloat(resolutionCostActual) : null,
          updated_at: new Date().toISOString(),
          resolved_at: (resolutionStatus === 'resuelta' || resolutionStatus === 'resuelto') ? new Date().toISOString() : null,
        };

        const { data, error } = await supabase
          .from('maintenance_tickets')
          .update(updateData)
          .eq('id', ticketToManage.id)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }
        updatedTicket = data;
        success = true;
      }

      if (updatedTicket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === updatedTicket!.id ? updatedTicket! : t))
        );
      } else {
        await loadData();
      }

      setTicketToManage(null);
      setResolutionNotes('');
      setResolutionCostActual('');
    } catch (err: any) {
      alert(err.message || 'Error actualizando ticket');
    } finally {
      setUpdatingTicket(false);
    }
  };

  // Abrir reporte rápido para una cabaña específica
  const handleOpenReportForCabin = (cabin: Cabin) => {
    setTicketScope('cabin');
    setSelectedCabinId(cabin.id);
    setTicketPriority('media');
    setTicketTitle(`Avería en Cabaña #${cabin.cabin_number}`);
    setShowTicketModal(true);
  };

  // Helpers de compatibilidad de estados
  const isTicketResolved = (status: MaintenanceStatus) => status === 'resuelta' || status === 'resuelto';
  const isTicketCancelled = (status: MaintenanceStatus) => status === 'cancelada' || status === 'cancelado';

  // Filtros aplicados
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Búsqueda de texto
      if (searchFilter) {
        const query = searchFilter.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(query);
        const matchesDesc = t.description?.toLowerCase().includes(query);
        const matchesArea = t.area_name?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesArea) return false;
      }

      // Filtro de área / cabaña
      if (areaFilter !== 'todas') {
        if (areaFilter.startsWith('cabin:')) {
          const cId = areaFilter.replace('cabin:', '');
          if (t.cabin_id !== cId) return false;
        } else if (areaFilter === 'pileta') {
          if (!t.area_name?.toLowerCase().includes('pileta')) return false;
        } else if (areaFilter === 'comunes') {
          if (t.cabin_id !== null) return false;
        }
      }

      // Filtro de estado
      if (statusFilter !== 'todas') {
        if (statusFilter === 'resuelta' && !isTicketResolved(t.status)) return false;
        if (statusFilter === 'cancelada' && !isTicketCancelled(t.status)) return false;
        if (statusFilter !== 'resuelta' && statusFilter !== 'cancelada' && t.status !== statusFilter) return false;
      }

      // Filtro de prioridad
      if (priorityFilter !== 'todas' && t.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [tickets, searchFilter, areaFilter, statusFilter, priorityFilter]);

  // Métricas superiores en tiempo real
  const kpis = useMemo(() => {
    const pendingCount = tickets.filter((t) => t.status === 'pendiente').length;
    const inProgressCount = tickets.filter((t) => t.status === 'en_progreso').length;
    const urgentCount = tickets.filter(
      (t) => t.priority === 'urgente' && !isTicketResolved(t.status) && !isTicketCancelled(t.status)
    ).length;

    // Cabañas con tickets activos
    const activeTicketCabins = new Set(
      tickets
        .filter((t) => t.cabin_id && !isTicketResolved(t.status) && !isTicketCancelled(t.status))
        .map((t) => t.cabin_id)
    );

    // Último preventivo de pileta
    const latestPool = preventives.find((p) => p.facility === 'pileta') || preventives[0];

    return {
      pendingCount,
      inProgressCount,
      urgentCount,
      affectedCabinsCount: activeTicketCabins.size,
      latestPool,
    };
  }, [tickets, preventives]);

  // Estilos de prioridad
  const priorityBadge = (p: MaintenancePriority) => {
    switch (p) {
      case 'urgente':
        return (
          <span className="px-2 py-0.5 rounded-md bg-red-950/80 text-red-300 border border-red-700 font-bold text-[10px] inline-flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-red-400" /> 🚨 URGENTE
          </span>
        );
      case 'alta':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-700 font-bold text-[10px]">
            ALTA
          </span>
        );
      case 'media':
        return (
          <span className="px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-300 border border-blue-700 font-medium text-[10px]">
            MEDIA
          </span>
        );
      case 'baja':
        return (
          <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700 text-[10px]">
            BAJA
          </span>
        );
    }
  };

  const statusBadge = (s: MaintenanceStatus) => {
    switch (s) {
      case 'pendiente':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold text-[10px] flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> Pendiente
          </span>
        );
      case 'en_progreso':
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30 font-semibold text-[10px] flex items-center gap-1">
            <Wrench className="w-2.5 h-2.5" /> En Progreso
          </span>
        );
      case 'resuelta':
      case 'resuelto':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold text-[10px] flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" /> Resuelta
          </span>
        );
      case 'cancelada':
      case 'cancelado':
        return (
          <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 text-[10px]">
            Cancelada
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 text-[10px]">
            {s}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER & KPI CARDS DE MANTENIMIENTO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Urgencias */}
        <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Averías Urgentes
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${kpis.urgentCount > 0 ? 'text-red-400' : 'text-stone-300'}`}>
                {kpis.urgentCount}
              </span>
              <span className="text-xs text-stone-500">
                {kpis.urgentCount > 0 ? 'Requieren atención' : 'Sin alertas'}
              </span>
            </div>
          </div>
          <div className={`p-3 rounded-2xl ${kpis.urgentCount > 0 ? 'bg-red-950/80 text-red-400 border border-red-800' : 'bg-stone-800 text-stone-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Activas / En Proceso */}
        <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Incidencias Abiertas
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-amber-300">
                {kpis.pendingCount + kpis.inProgressCount}
              </span>
              <span className="text-xs text-stone-500">
                ({kpis.pendingCount} pend. · {kpis.inProgressCount} en curso)
              </span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-amber-950/50 text-amber-400 border border-amber-800/50">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Control Químico Pileta */}
        <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Piscina Climatizada
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold font-mono text-emerald-400">
                pH {kpis.latestPool?.ph_level ?? '7.4'} · Cl {kpis.latestPool?.chlorine_level ?? '1.5'}
              </span>
            </div>
            <span className="text-[11px] text-stone-400">
              Temp: {kpis.latestPool?.water_temp_celsius ?? '31.5'} °C
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-950/50 text-emerald-400 border border-emerald-800/50">
            <Droplets className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Cabañas Afectadas */}
        <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Cabañas en Revisión
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-stone-200">
                {kpis.affectedCabinsCount} <span className="text-sm font-normal text-stone-500">de 12</span>
              </span>
            </div>
            <span className="text-[11px] text-emerald-400">
              {12 - kpis.affectedCabinsCount} Cabañas 100% operativas
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-stone-800 text-stone-400">
            <Building className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. SUB-BARRA DE NAVEGACIÓN Y ACCIONES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900/80 p-4 rounded-3xl border border-stone-800 shadow-md">
        {/* Selector de sub-vistas */}
        <div className="flex items-center gap-1.5 bg-stone-950 p-1.5 rounded-2xl border border-stone-800">
          <button
            onClick={() => setSubTab('tickets')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'tickets'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Incidencias & Averías ({tickets.length})</span>
          </button>
          <button
            onClick={() => setSubTab('pool')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'pool'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Control Pileta & Preventivo ({preventives.length})</span>
          </button>
          <button
            onClick={() => setSubTab('cabins_grid')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'cabins_grid'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Por Cabaña (1 a 12)</span>
          </button>
        </div>

        {/* Botones de acción directa */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            onClick={() => setShowPoolModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition-all"
          >
            <Droplets className="w-4 h-4" />
            <span>Cargar Control Pileta</span>
          </button>

          <button
            onClick={() => {
              setTicketScope('cabin');
              setSelectedCabinId(cabins[0]?.id || '');
              setShowTicketModal(true);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Reportar Incidencia</span>
          </button>
        </div>
      </div>

      {/* 3. CONTENIDO DE LA SUB-PESTAÑA SELECCIONADA */}

      {/* SUB-TAB 1: LISTADO DE INCIDENCIAS & FILTROS */}
      {subTab === 'tickets' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex flex-wrap items-center gap-3">
            {/* Input búsqueda */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                placeholder="Buscar por avería, síntoma o área..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Filtro de Cabaña / Área */}
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-300 focus:outline-none"
            >
              <option value="todas">Todas las Cabañas y Áreas</option>
              <option value="pileta">Solo Pileta & Piscina</option>
              <option value="comunes">Solo Áreas Comunes</option>
              <optgroup label="Cabañas 1 a 12">
                {sortedCabins.map((c) => (
                  <option key={c.id} value={`cabin:${c.id}`}>
                    Cabaña #{c.cabin_number} - {c.name}
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Filtro de Estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-300 focus:outline-none"
            >
              <option value="todas">Todos los Estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="en_progreso">En Progreso</option>
              <option value="resuelta">Resueltas</option>
            </select>

            {/* Filtro de Prioridad */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-300 focus:outline-none"
            >
              <option value="todas">Todas las Prioridades</option>
              <option value="urgente">🚨 Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {/* Grilla de Tickets */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((t) => {
              const linkedCabin = cabins.find((c) => c.id === t.cabin_id);

              return (
                <div
                  key={t.id}
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 shadow-lg ${
                    t.priority === 'urgente' && !isTicketResolved(t.status)
                      ? 'bg-red-950/20 border-red-800/60 shadow-red-950/20'
                      : isTicketResolved(t.status)
                      ? 'bg-stone-900/40 border-stone-800/60 opacity-80'
                      : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header de la tarjeta */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {priorityBadge(t.priority)}
                        <span className="px-2 py-0.5 rounded-md bg-stone-950 text-stone-300 border border-stone-800 text-[10px] font-bold">
                          {linkedCabin ? `Cabaña #${linkedCabin.cabin_number}` : t.area_name || 'Área Común'}
                        </span>
                      </div>
                      {statusBadge(t.status)}
                    </div>

                    {/* Título y descripción */}
                    <div>
                      <h4 className="font-bold text-sm text-stone-100">{t.title}</h4>
                      <p className="text-xs text-stone-400 mt-1 line-clamp-3">{t.description}</p>
                    </div>

                    {/* Resolución registrada si ya está resuelta */}
                    {t.resolution_notes && (
                      <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-[11px] text-emerald-200 space-y-1">
                        <div className="flex items-center justify-between text-emerald-400 font-bold">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Solución registrada:
                          </span>
                          {t.resolved_at && (
                            <span className="text-[10px] text-emerald-400/80 font-normal">
                              {new Date(t.resolved_at).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          )}
                        </div>
                        <p className="text-stone-300 whitespace-pre-wrap">{t.resolution_notes}</p>
                        {t.cost_actual_ars && (
                          <div className="pt-1 text-[10px] font-mono text-emerald-300 border-t border-emerald-900/40">
                            Costo real: {formatARS(t.cost_actual_ars)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer & Acciones Directas de Carga de Solución */}
                  <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-stone-500">
                      {new Date(t.created_at).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {isTicketResolved(t.status) ? (
                        <>
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Solucionada
                          </span>
                          <button
                            onClick={() => handleOpenManageTicket(t)}
                            className="px-2.5 py-1 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Editar detalles o reabrir avería"
                          >
                            <Sliders className="w-3 h-3 text-amber-400" />
                            <span>Reabrir / Editar</span>
                          </button>
                        </>
                      ) : (
                        <>
                          {t.status === 'pendiente' && (
                            <button
                              onClick={() => handleQuickStatusChange(t, 'en_progreso')}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-950/70 hover:bg-blue-900 border border-blue-700/60 text-blue-300 text-xs font-bold flex items-center gap-1 transition-colors"
                              title="Poner en progreso (reparación iniciada)"
                            >
                              <Wrench className="w-3 h-3 text-blue-400" />
                              <span>En Curso</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenManageTicket(t, 'resuelta')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
                            title="Cargar solución y marcar como solucionada"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Cargar Solución</span>
                          </button>

                          <button
                            onClick={() => handleOpenManageTicket(t)}
                            className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
                            title="Opciones completas de la avería"
                          >
                            <Sliders className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTickets.length === 0 && !loading && (
              <div className="col-span-full p-12 text-center bg-stone-900/50 rounded-3xl border border-stone-800 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-stone-200">No hay incidencias que coincidan</h4>
                <p className="text-xs text-stone-400 max-w-sm mx-auto">
                  Todas las cabañas y áreas comunes se encuentran en condiciones óptimas según los filtros actuales.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CONTROL QUÍMICO PILETA & PREVENTIVOS */}
      {subTab === 'pool' && (
        <div className="space-y-6">
          {/* Panel de Sensores Químicos / Medidores */}
          <div className="bg-stone-900 border border-stone-800 p-6 rounded-3xl shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-amber-100 flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-cyan-400" /> Control Químico de Piscina Climatizada
                </h3>
                <p className="text-xs text-stone-400">
                  Monitoreo diario de pH, cloro libre, temperatura del agua y estado del sistema de filtrado.
                </p>
              </div>

              <button
                onClick={() => setShowPoolModal(true)}
                className="px-4 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow self-start sm:self-auto transition-all"
              >
                <Plus className="w-4 h-4" /> Registrar Nueva Medición
              </button>
            </div>

            {/* Medidores en Tarjetas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* pH */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center space-y-1">
                <span className="text-xs text-stone-400 font-bold uppercase">pH Medido</span>
                <div className="text-3xl font-bold font-mono text-emerald-400">
                  {kpis.latestPool?.ph_level ?? '7.4'}
                </div>
                <div className="text-[10px] text-stone-500">
                  Rango ideal: 7.2 a 7.6 · {((kpis.latestPool?.ph_level ?? 7.4) >= 7.2 && (kpis.latestPool?.ph_level ?? 7.4) <= 7.6) ? '✅ Óptimo' : '⚠️ Fuera de rango'}
                </div>
              </div>

              {/* Cloro */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center space-y-1">
                <span className="text-xs text-stone-400 font-bold uppercase">Cloro Libre</span>
                <div className="text-3xl font-bold font-mono text-cyan-400">
                  {kpis.latestPool?.chlorine_level ?? '1.5'} <span className="text-sm">ppm</span>
                </div>
                <div className="text-[10px] text-stone-500">
                  Rango ideal: 1.0 a 2.0 ppm · Adecuado
                </div>
              </div>

              {/* Temperatura */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center space-y-1">
                <span className="text-xs text-stone-400 font-bold uppercase">Temperatura Agua</span>
                <div className="text-3xl font-bold font-mono text-amber-400">
                  {kpis.latestPool?.water_temp_celsius ?? '31.5'} <span className="text-sm">°C</span>
                </div>
                <div className="text-[10px] text-stone-500">
                  Rango climatizada: 30°C a 32°C · Confortable
                </div>
              </div>

              {/* Filtro */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center space-y-1">
                <span className="text-xs text-stone-400 font-bold uppercase">Sistema de Filtrado</span>
                <div className="text-sm font-bold text-emerald-400 mt-2">
                  {kpis.latestPool?.filter_status || 'Limpio y Operativo'}
                </div>
                <div className="text-[10px] text-stone-500">Bomba y skimmers activos</div>
              </div>
            </div>
          </div>

          {/* Historial de Mediciones */}
          <div className="bg-stone-900 border border-stone-800 p-6 rounded-3xl shadow-xl space-y-4">
            <h4 className="font-bold text-sm text-stone-200">Historial Reciente de Mantenimientos Preventivos</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Instalación</th>
                    <th className="p-3">pH</th>
                    <th className="p-3">Cloro</th>
                    <th className="p-3">Temp</th>
                    <th className="p-3">Estado Filtro</th>
                    <th className="p-3">Observaciones / Tratamiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {preventives.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-850 transition-colors">
                      <td className="p-3 font-mono text-stone-400">
                        {p.record_date}
                      </td>
                      <td className="p-3 font-bold text-stone-200 uppercase text-[11px]">
                        {p.facility}
                      </td>
                      <td className="p-3 font-mono text-emerald-400 font-bold">
                        {p.ph_level ?? '-'}
                      </td>
                      <td className="p-3 font-mono text-cyan-400 font-bold">
                        {p.chlorine_level ? `${p.chlorine_level} ppm` : '-'}
                      </td>
                      <td className="p-3 font-mono text-amber-400 font-bold">
                        {p.water_temp_celsius ? `${p.water_temp_celsius} °C` : '-'}
                      </td>
                      <td className="p-3 text-[11px] text-stone-300">
                        {p.filter_status || '-'}
                      </td>
                      <td className="p-3 text-stone-400 text-[11px]">
                        {p.observations || 'Sin observaciones'}
                      </td>
                    </tr>
                  ))}
                  {preventives.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-stone-500">
                        No hay registros preventivos cargados aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ESTADO TÉCNICO POR CABAÑA (1 A 12) */}
      {subTab === 'cabins_grid' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-base font-bold text-amber-100">
                Monitoreo Técnico por Cabaña (1 a 12)
              </h3>
              <p className="text-xs text-stone-400">
                Clickeá en cualquier cabaña para reportar de inmediato una incidencia técnica o avería puntual.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedCabins.map((cabin) => {
              const cabinTickets = tickets.filter(
                (t) => t.cabin_id === cabin.id && !isTicketResolved(t.status) && !isTicketCancelled(t.status)
              );
              const hasUrgent = cabinTickets.some((t) => t.priority === 'urgente');

              return (
                <div
                  key={cabin.id}
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-3 ${
                    hasUrgent
                      ? 'bg-red-950/30 border-red-700/80'
                      : cabinTickets.length > 0
                      ? 'bg-amber-950/20 border-amber-700/50'
                      : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-stone-100 flex items-center gap-1.5">
                        <Home className="w-4 h-4 text-amber-400" /> Cabaña #{cabin.cabin_number}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          hasUrgent
                            ? 'bg-red-600 text-white animate-pulse'
                            : cabinTickets.length > 0
                            ? 'bg-amber-600 text-slate-950'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {hasUrgent
                          ? '🚨 Avería Urgente'
                          : cabinTickets.length > 0
                          ? `${cabinTickets.length} Incidencia${cabinTickets.length > 1 ? 's' : ''}`
                          : 'Operativa'}
                      </span>
                    </div>

                    <p className="text-xs text-stone-400">
                      {cabin.name} · Planta {cabin.floor}
                      {cabin.has_accessible_mobility && ' · ♿ Accesible'}
                    </p>

                    {/* Lista rápida de problemas abiertos */}
                    {cabinTickets.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {cabinTickets.map((ct) => (
                          <div
                            key={ct.id}
                            className="p-2 rounded-xl bg-stone-950/80 border border-stone-800 text-[11px] flex items-center justify-between text-stone-300 gap-1.5 hover:border-stone-700 transition-colors"
                          >
                            <span className="truncate flex-1 font-medium">{ct.title}</span>
                            <button
                              onClick={() => handleOpenManageTicket(ct, 'resuelta')}
                              className="px-2 py-0.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/40 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all"
                              title="Cargar solución de esta avería"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Solucionar</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenReportForCabin(cabin)}
                    className="w-full py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Reportar Avería en #{cabin.cabin_number}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. MODAL: NUEVA INCIDENCIA / AVERÍA */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-serif text-lg font-bold text-amber-100 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" /> Reportar Incidencia / Avería Técnica
              </h3>
              <button
                onClick={() => setShowTicketModal(false)}
                className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              {/* Selección de Ámbito: Cabaña o Área Común */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-stone-950 border border-stone-800">
                <button
                  type="button"
                  onClick={() => setTicketScope('cabin')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    ticketScope === 'cabin'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Cabaña Específica (1 a 12)
                </button>
                <button
                  type="button"
                  onClick={() => setTicketScope('common')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    ticketScope === 'common'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Pileta & Áreas Comunes
                </button>
              </div>

              {ticketScope === 'cabin' ? (
                <div>
                  <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                    Seleccionar Cabaña *
                  </label>
                  <select
                    required
                    value={selectedCabinId}
                    onChange={(e) => setSelectedCabinId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-200"
                  >
                    <option value="">-- Elegir Cabaña 1 a 12 --</option>
                    {sortedCabins.map((c) => (
                      <option key={c.id} value={c.id}>
                        Cabaña #{c.cabin_number} - {c.name} (Planta {c.floor})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                    Área o Sector Común *
                  </label>
                  <select
                    value={customArea}
                    onChange={(e) => setCustomArea(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-200"
                  >
                    <option value="Sector Pileta Climatizada">Sector Pileta Climatizada & Jacuzzi</option>
                    <option value="Quincho & Parrillas">Quincho & Sector Parrillas</option>
                    <option value="Bombas & Riego Presurizado">Bombas de Agua & Riego Presurizado</option>
                    <option value="Termotanques Centrales">Termotanques Centrales & Calderas</option>
                    <option value="Portón de Acceso & Estacionamiento">Portón de Acceso & Cocheras</option>
                    <option value="Parque & Iluminación del Predio">Parque & Iluminación del Predio</option>
                    <option value="Otro / General">Otro / Instalaciones Generales</option>
                  </select>
                </div>
              )}

              {/* Título de la avería */}
              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                  Título de la Avería o Problema *
                </label>
                <input
                  type="text"
                  required
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  placeholder="Ej: Falla en bomba de recirculación / Aire gotea"
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-100"
                />
              </div>

              {/* Prioridad */}
              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                  Nivel de Prioridad *
                </label>
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value as MaintenancePriority)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-200"
                >
                  <option value="baja">Baja - Mantenimiento preventivo / Estético</option>
                  <option value="media">Media - Desperfecto menor, no inhabilita uso</option>
                  <option value="alta">Alta - Requiere reparación en las próximas horas</option>
                  <option value="urgente">🚨 Urgente - Interrumpe la estadía o seguridad del huésped</option>
                </select>
              </div>

              {/* Detalle */}
              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                  Detalle y Síntomas Observados *
                </label>
                <textarea
                  required
                  rows={3}
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  placeholder="Describí con precisión el problema o repuesto necesario..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-200"
                />
              </div>

              {/* Costo estimado opcional */}
              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                  Costo Estimado ARS (Opcional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={ticketCostEst}
                  onChange={(e) => setTicketCostEst(e.target.value)}
                  placeholder="Ej: 45000"
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-200 font-mono"
                />
              </div>

              {/* Botones */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingTicket}
                  className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all disabled:opacity-50"
                >
                  {savingTicket ? 'Registrando...' : 'Registrar Incidencia'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="py-2.5 rounded-xl border border-stone-700 hover:bg-stone-800 text-stone-400 text-xs transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: CARGAR CONTROL PREVENTIVO DE PILETA & ÁREAS */}
      {showPoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-serif text-lg font-bold text-amber-100 flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-400" /> Control Diario de Piscina & Preventivos
              </h3>
              <button
                onClick={() => setShowPoolModal(false)}
                className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePreventive} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                  Instalación / Sector *
                </label>
                <select
                  value={poolFacility}
                  onChange={(e: any) => setPoolFacility(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-200"
                >
                  <option value="pileta">Piscina Climatizada & Jacuzzi</option>
                  <option value="quincho">Quincho & Parrillas</option>
                  <option value="bombas_riego">Bombas de Riego & Presurizador</option>
                  <option value="termotanques">Termotanques & Calderas</option>
                </select>
              </div>

              {poolFacility === 'pileta' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                      pH (7.2 - 7.6)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={poolPh}
                      onChange={(e) => setPoolPh(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-cyan-500 text-emerald-400 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                      Cloro (ppm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={poolChlorine}
                      onChange={(e) => setPoolChlorine(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-cyan-500 text-cyan-400 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                      Temp (°C)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={poolTemp}
                      onChange={(e) => setPoolTemp(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-cyan-500 text-amber-400 font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                  Estado del Filtro / Equipamiento
                </label>
                <select
                  value={poolFilterStatus}
                  onChange={(e) => setPoolFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-200"
                >
                  <option value="Limpio y en operación normal">Limpio y en operación normal</option>
                  <option value="Retrolavado realizado hoy">Retrolavado realizado hoy</option>
                  <option value="Requiere retrolavado / mantenimiento">Requiere retrolavado / mantenimiento</option>
                  <option value="Bomba apagada preventivamente">Bomba apagada preventivamente</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                  Tratamiento Realizado / Observaciones
                </label>
                <textarea
                  rows={2}
                  value={poolNotes}
                  onChange={(e) => setPoolNotes(e.target.value)}
                  placeholder="Ej: Se aspiró fondo, colocaron 2 pastillas de cloro triple acción y clarificador..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-cyan-500 text-stone-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingPool}
                  className="py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow transition-all disabled:opacity-50"
                >
                  {savingPool ? 'Guardando...' : 'Guardar Control'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPoolModal(false)}
                  className="py-2.5 rounded-xl border border-stone-700 hover:bg-stone-800 text-stone-400 text-xs transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: GESTIONAR O RESOLVER TICKET */}
      {ticketToManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-stone-900 border border-stone-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                  {resolutionStatus === 'resuelta' ? 'Cargar Solución de Avería' : 'Actualizar Estado de Avería'}
                </span>
                <h3 className="font-serif text-base font-bold text-amber-100">
                  {ticketToManage.title}
                </h3>
                <span className="text-xs text-stone-400">
                  Sector: {ticketToManage.area_name || 'Instalaciones Generales'}
                </span>
              </div>
              <button
                onClick={() => setTicketToManage(null)}
                className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTicketStatus} className="space-y-4">
              {/* Selector Visual de Estado */}
              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-2">
                  ¿Cuál es el estado de la avería? *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolutionStatus('resuelta')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                      resolutionStatus === 'resuelta'
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${resolutionStatus === 'resuelta' ? 'text-emerald-400' : 'text-stone-500'}`} />
                    <div>
                      <div className="font-bold text-xs text-white">Solucionada / Resuelta</div>
                      <div className="text-[10px] text-stone-400">Reparación finalizada</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolutionStatus('en_progreso')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                      resolutionStatus === 'en_progreso'
                        ? 'bg-blue-950/70 border-blue-500 text-blue-200 ring-2 ring-blue-500/30'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <Wrench className={`w-5 h-5 shrink-0 ${resolutionStatus === 'en_progreso' ? 'text-blue-400' : 'text-stone-500'}`} />
                    <div>
                      <div className="font-bold text-xs text-white">En Progreso</div>
                      <div className="text-[10px] text-stone-400">Técnico trabajando</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolutionStatus('pendiente')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                      resolutionStatus === 'pendiente'
                        ? 'bg-amber-950/70 border-amber-500 text-amber-200 ring-2 ring-amber-500/30'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <Clock className={`w-5 h-5 shrink-0 ${resolutionStatus === 'pendiente' ? 'text-amber-400' : 'text-stone-500'}`} />
                    <div>
                      <div className="font-bold text-xs text-white">Pendiente</div>
                      <div className="text-[10px] text-stone-400">Esperando atención</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolutionStatus('cancelada')}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                      resolutionStatus === 'cancelada'
                        ? 'bg-stone-800 border-stone-500 text-stone-200 ring-2 ring-stone-500/30'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <X className={`w-5 h-5 shrink-0 ${resolutionStatus === 'cancelada' ? 'text-stone-300' : 'text-stone-500'}`} />
                    <div>
                      <div className="font-bold text-xs text-white">Cancelada</div>
                      <div className="text-[10px] text-stone-400">Desestimada</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Detalle del trabajo realizado */}
              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                  {resolutionStatus === 'resuelta'
                    ? '¿Cómo se solucionó el problema? *'
                    : 'Notas de Avance o Diagnóstico'}
                </label>
                <textarea
                  rows={3}
                  required={resolutionStatus === 'resuelta'}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder={
                    resolutionStatus === 'resuelta'
                      ? 'Describí la solución aplicada (ej: Se cambió la manguera y se purgó la bomba, quedó funcionando 100%)...'
                      : 'Detallá avance del trabajo, repuestos encargados o visitas de técnicos...'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-200"
                />
              </div>

              {/* Costo final real */}
              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase mb-1">
                  Costo Final Real ARS (Repuestos / Mano de Obra - Opcional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={resolutionCostActual}
                  onChange={(e) => setResolutionCostActual(e.target.value)}
                  placeholder="Ej: 35000"
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-sm focus:outline-none focus:border-amber-500 text-stone-200 font-mono"
                />
              </div>

              {/* Botones de acción */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  disabled={updatingTicket}
                  className={`py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                    resolutionStatus === 'resuelta'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {updatingTicket
                      ? 'Guardando...'
                      : resolutionStatus === 'resuelta'
                      ? 'Confirmar como Solucionada'
                      : 'Guardar Estado'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTicketToManage(null)}
                  className="py-2.5 rounded-xl border border-stone-700 hover:bg-stone-800 text-stone-400 text-xs transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
