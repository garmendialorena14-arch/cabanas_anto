'use client';

import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Filter,
  Calendar,
  Users,
  Phone,
  Mail,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Send,
  Lock,
  Archive,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { Lead } from '@/shared/types';
import { formatUSD } from '@/shared/lib/bimonetary';

interface LeadsManagementViewProps {
  leads: Lead[];
  onOpenCreateReservation: (lead: Lead) => void;
  onUpdateLeadStatus: (leadId: string, status: string) => Promise<void>;
  onAddNewLeadClick: () => void;
}

export default function LeadsManagementView({
  leads,
  onOpenCreateReservation,
  onUpdateLeadStatus,
  onAddNewLeadClick,
}: LeadsManagementViewProps) {
  // Pestaña principal: 'activas' (pendientes) vs 'historial' (reserva realizada / descartado)
  const [activeTab, setActiveTab] = useState<'activas' | 'historial'>('activas');
  const [searchTerm, setSearchTerm] = useState('');
  const [subFilter, setSubFilter] = useState<string>('todos');

  // Clasificación de leads en activas vs historial
  const isLeadArchived = (lead: Lead) =>
    lead.status === 'reserva_realizada' ||
    lead.status === 'reservado' ||
    lead.status === 'descartado';

  const activeLeadsCount = useMemo(
    () => leads.filter((l) => !isLeadArchived(l)).length,
    [leads]
  );

  const historyLeadsCount = useMemo(
    () => leads.filter((l) => isLeadArchived(l)).length,
    [leads]
  );

  // Filtrado según pestaña y búsqueda
  const displayedLeads = useMemo(() => {
    return leads.filter((lead) => {
      const archived = isLeadArchived(lead);
      if (activeTab === 'activas' && archived) return false;
      if (activeTab === 'historial' && !archived) return false;

      // Filtro de búsqueda textual
      const matchesSearch =
        lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.contact_phone && lead.contact_phone.includes(searchTerm)) ||
        (lead.notes && lead.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Subfiltro por estado
      if (subFilter === 'todos') return true;
      if (subFilter === 'reserva_realizada') {
        return lead.status === 'reserva_realizada' || lead.status === 'reservado';
      }
      return lead.status === subFilter;
    });
  }, [leads, activeTab, searchTerm, subFilter]);

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'telegram':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'web':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'telefono':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'mostrador':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'instagram':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'telegram':
        return '✈️ Telegram';
      case 'web':
        return '🌐 Web';
      case 'telefono':
        return '📞 Teléfono';
      case 'mostrador':
        return '🏢 Mostrador';
      case 'instagram':
        return '📸 Instagram';
      default:
        return source;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'nuevo':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'cotizado':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'en_conversacion':
      case 'contactado':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'reserva_realizada':
      case 'reservado':
        return 'bg-emerald-500/25 text-emerald-200 border-emerald-500/40 font-black';
      case 'descartado':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Cabecera Principal con Selector de Pestañas (Activas vs Historial) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            Bandeja de Consultas de Huéspedes
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Canal de ingreso, seguimiento ágil en Telegram/Web y conversión directa a reservas.
          </p>
        </div>

        <button
          onClick={onAddNewLeadClick}
          className="px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all border border-amber-500/30 self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nueva Consulta Manual
        </button>
      </div>

      {/* 2. Pestañas Principales: Activas vs Concretadas / Historial */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('activas');
              setSubFilter('todos');
            }}
            className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === 'activas'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Consultas Activas / En Proceso</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeTab === 'activas'
                  ? 'bg-slate-950 text-amber-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {activeLeadsCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('historial');
              setSubFilter('todos');
            }}
            className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === 'historial'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Concretadas e Historial</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeTab === 'historial'
                  ? 'bg-white text-emerald-900'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {historyLeadsCount}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Buscador y Filtros Secundarios */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono Telegram o notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
          />
        </div>

        {/* Subfiltros según la pestaña */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs">
          {activeTab === 'activas' ? (
            <>
              {['todos', 'nuevo', 'cotizado', 'en_conversacion'].map((st) => (
                <button
                  key={st}
                  onClick={() => setSubFilter(st)}
                  className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all ${
                    subFilter === st
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'en_conversacion' ? 'En Conversación' : st}
                </button>
              ))}
            </>
          ) : (
            <>
              {['todos', 'reserva_realizada', 'descartado'].map((st) => (
                <button
                  key={st}
                  onClick={() => setSubFilter(st)}
                  className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all ${
                    subFilter === st
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'reserva_realizada' ? 'Reservas Realizadas' : st}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 4. Lista / Tarjetas de Consultas */}
      {displayedLeads.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl space-y-2">
          <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">
            {activeTab === 'activas'
              ? 'No hay consultas activas pendientes.'
              : 'No hay consultas en el historial con este filtro.'}
          </p>
          <p className="text-xs text-slate-500">
            {activeTab === 'activas'
              ? 'Todas las consultas fueron procesadas o podés crear una nueva manual.'
              : 'Las consultas que se convierten a reserva o se descartan aparecen acá.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayedLeads.map((lead) => {
            const isConverted =
              lead.status === 'reserva_realizada' || lead.status === 'reservado';
            const isDismissed = lead.status === 'descartado';
            const isLocked = isConverted || isDismissed;

            const cleanPhone = lead.contact_phone?.replace(/[^\d]/g, '');
            // Enlace directo a Telegram
            const telegramLink = cleanPhone
              ? `https://t.me/+${cleanPhone}`
              : null;

            return (
              <div
                key={lead.id}
                className={`border rounded-3xl p-5 shadow-sm space-y-4 transition-all flex flex-col justify-between group ${
                  isConverted
                    ? 'bg-emerald-950/20 border-emerald-900/50 hover:border-emerald-700/60'
                    : isDismissed
                    ? 'bg-slate-950/40 border-slate-900 opacity-70'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700/80'
                }`}
              >
                {/* Cabecera de la consulta */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        {lead.full_name}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${getSourceBadge(
                            lead.source
                          )}`}
                        >
                          {getSourceLabel(lead.source)}
                        </span>
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        {lead.contact_phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-500" /> {lead.contact_phone}
                          </span>
                        )}
                        {lead.contact_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-500" /> {lead.contact_email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Estado del Lead: Si está convertida, bloqueado con candado */}
                    {isConverted ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-black uppercase text-emerald-300">
                        <Lock className="w-3 h-3" /> Reserva Realizada
                      </span>
                    ) : (
                      <select
                        value={lead.status}
                        onChange={(e) => onUpdateLeadStatus(lead.id, e.target.value)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-xl uppercase border outline-none bg-slate-900 cursor-pointer ${getStatusBadge(
                          lead.status
                        )}`}
                      >
                        <option value="nuevo">Nuevo</option>
                        <option value="cotizado">Cotizado</option>
                        <option value="en_conversacion">En Conversación</option>
                        <option value="reserva_realizada">Reserva Realizada (Bloquear)</option>
                        <option value="descartado">Descartado</option>
                      </select>
                    )}
                  </div>

                  {/* Fechas deseadas & Pax */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-xs mt-3">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                        Ingreso deseado
                      </span>
                      <p className="font-bold text-slate-200 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        {lead.desired_check_in || 'A definir'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                        Salida deseada
                      </span>
                      <p className="font-bold text-slate-200 mt-0.5">
                        {lead.desired_check_out || 'A definir'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                        Huéspedes
                      </span>
                      <p className="font-bold text-slate-200 mt-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-400" />
                        {lead.pax_count} pax
                      </p>
                    </div>
                  </div>

                  {/* Alerta de movilidad reducida si aplica */}
                  {lead.has_reduced_mobility && (
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 font-medium flex items-center gap-1.5">
                      <span>
                        ♿ <strong>Movilidad reducida:</strong>{' '}
                        {lead.mobility_notes || 'Requiere Planta Baja adaptada'}
                      </span>
                    </div>
                  )}

                  {/* Notas de la consulta */}
                  {lead.notes && (
                    <p className="text-xs text-slate-300 bg-slate-800/40 p-3 rounded-2xl border border-slate-800 leading-relaxed italic">
                      &quot;{lead.notes}&quot;
                    </p>
                  )}
                </div>

                {/* 5. Acciones: Abrir Telegram + BOTÓN CREAR RESERVA (O Bloqueo si ya fue concretada) */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80 mt-2">
                  {telegramLink && (
                    <a
                      href={telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-bold transition-colors flex items-center gap-1.5 border border-sky-500/20"
                      title="Chatear por Telegram"
                    >
                      <Send className="w-3.5 h-3.5" /> Telegram
                    </a>
                  )}

                  {isConverted ? (
                    <div className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-950/60 border border-emerald-600/30 text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-default">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Reserva Concretada · Ficha Bloqueada</span>
                    </div>
                  ) : isDismissed ? (
                    <div className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800/60 text-slate-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-default">
                      <span>Consulta Archivada / Descartada</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onOpenCreateReservation(lead)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      Crear Reserva
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
