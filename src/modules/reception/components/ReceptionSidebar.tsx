'use client';

import React from 'react';
import Link from 'next/link';
import {
  Calendar,
  MessageSquare,
  Wrench,
  Car,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Plus,
  LogOut,
  Users,
  Sparkles,
  Send,
  Bot,
} from 'lucide-react';

export type ReceptionActiveTab = 
  | 'calendar' 
  | 'leads' 
  | 'maintenance' 
  | 'parking' 
  | 'bank'
  | 'telegram_crm'
  | 'telegram_bookings'
  | 'telegram_assistants';

interface ReceptionSidebarProps {
  activeTab: ReceptionActiveTab;
  onSelectTab: (tab: ReceptionActiveTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCreateReservation?: () => void;
  onOpenCreateLead?: () => void;
  leadsCount?: number;
  activeTicketCount?: number;
}

interface NavItem {
  id: ReceptionActiveTab;
  label: string;
  icon: any;
  badge?: string | null;
  badgeColor?: string;
  href?: string;
}

export default function ReceptionSidebar({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  onOpenCreateReservation,
  onOpenCreateLead,
  leadsCount,
  activeTicketCount,
}: ReceptionSidebarProps) {
  const mainNavItems: NavItem[] = [
    {
      id: 'calendar',
      label: 'Calendario & Ocupación',
      icon: Calendar,
      badge: null,
    },
    {
      id: 'leads',
      label: 'Consultas & Leads',
      icon: MessageSquare,
      badge: leadsCount && leadsCount > 0 ? `${leadsCount}` : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    },
    {
      id: 'maintenance',
      label: 'Mantenimiento & Pileta',
      icon: Wrench,
      badge: activeTicketCount && activeTicketCount > 0 ? `${activeTicketCount}` : null,
      badgeColor: 'bg-red-500 text-white font-black animate-pulse',
    },
    {
      id: 'parking',
      label: 'Control de 12 Cocheras',
      icon: Car,
      badge: null,
    },
    {
      id: 'bank',
      label: 'Cuentas & Cobro Señas',
      icon: CreditCard,
      badge: null,
    },
  ];

  const telegramNavItems: NavItem[] = [
    {
      id: 'telegram_crm',
      label: 'CRM & Control Humano',
      icon: Send,
    },
    {
      id: 'telegram_bookings',
      label: 'Reservas Telegram',
      icon: Calendar,
    },
    {
      id: 'telegram_assistants',
      label: 'Asistentes de IA',
      icon: Bot,
    },
  ];

  const quickAccessItems = [
    {
      label: 'Maestranza & Limpieza',
      icon: Sparkles,
      href: '/maestranza',
    },
    {
      label: 'Módulo Dueño / Admin',
      icon: ShieldCheck,
      href: '/admin',
    },
  ];

  return (
    <aside
      className={`relative flex flex-col bg-slate-900 text-slate-100 border-r border-slate-800 transition-all duration-300 z-30 select-none flex-shrink-0 ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Solapa lateral para colapsar/expandir (centrada verticalmente, idéntica al admin) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-16 bg-slate-800 hover:bg-amber-500 text-slate-400 hover:text-slate-950 border border-slate-700 hover:border-amber-400 rounded-r-xl flex items-center justify-center shadow-xl transition-all duration-200 z-50 group cursor-pointer focus:outline-none"
        title={isCollapsed ? 'Expandir menú lateral (modo completo)' : 'Colapsar menú lateral (modo compacto)'}
        aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 transition-transform group-hover:scale-125" />
        ) : (
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:scale-125" />
        )}
      </button>

      {/* Header del Sidebar */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80 h-13">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm shadow-xs">
              CA
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-tight text-white leading-tight">
                Cabañas Anto
              </h2>
              <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1">
                <Users className="w-2.5 h-2.5" /> Módulo Recepción
              </span>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="mx-auto w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shadow-xs">
            CA
          </div>
        )}
      </div>

      {/* Botones de Acción Destacada */}
      <div className="px-2.5 pt-2.5 space-y-1.5">
        {!isCollapsed ? (
          <>
            <button
              onClick={onOpenCreateReservation}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Cargar Reserva
            </button>
            {onOpenCreateLead && (
              <button
                onClick={onOpenCreateLead}
                className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-slate-700/80 transition-all cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" /> Cargar Consulta
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onOpenCreateReservation}
              className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center justify-center shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
              title="Cargar Reserva Manual"
            >
              <Plus className="w-4 h-4" />
            </button>
            {onOpenCreateLead && (
              <button
                onClick={onOpenCreateLead}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-black flex items-center justify-center border border-slate-700/80 transition-all cursor-pointer"
                title="Cargar Consulta Manual"
              >
                <Users className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contenido sin scroll innecesario */}
      <div className="flex-1 py-3 px-2.5 space-y-3 overflow-y-auto scrollbar-none">
        {/* Navegación Recepción */}
        <div>
          {!isCollapsed && (
            <p className="px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1.5">
              Navegación Recepción
            </p>
          )}
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer relative ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                  {!isCollapsed && item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        item.badgeColor || 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isCollapsed && item.badge && (
                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-900" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sección: Telegram & Asistentes IA */}
        <div className="pt-2 border-t border-slate-800/80">
          {!isCollapsed && (
            <p className="px-2 text-[10px] font-bold tracking-wider text-sky-400 uppercase mb-1.5 flex items-center gap-1">
              <Send className="w-3 h-3" /> Telegram & IA
            </p>
          )}
          <nav className="space-y-1">
            {telegramNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer relative ${
                    isActive
                      ? 'bg-sky-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-sky-400'}`} />
                  {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Accesos Rápidos Vinculados */}
        <div className="pt-2 border-t border-slate-800/80">
          {!isCollapsed && (
            <p className="px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1.5">
              Accesos Rápidos
            </p>
          )}
          <nav className="space-y-1">
            {quickAccessItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link
                  key={idx}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 ${
                    isCollapsed ? 'justify-center px-0' : ''
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 hover:text-slate-300" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer del Sidebar con info de sistema y botón de Cerrar Sesión */}
      <div className="py-2.5 px-2.5 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        {!isCollapsed && (
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span>In: <strong className="text-slate-200">14:00hs</strong></span>
            <span>Out: <strong className="text-slate-200">10:00am</strong></span>
            <span className="text-slate-500">(4hs limp.)</span>
          </div>
        )}

        <button
          onClick={async () => {
            try {
              sessionStorage.clear();
              try {
                localStorage.setItem('saas_force_logout', Date.now().toString());
                localStorage.removeItem('saas_tab_session_id');
                localStorage.removeItem('saas_tab_session_user');
                localStorage.removeItem('saas_tab_session_role');
              } catch {}
              if (typeof document !== 'undefined') {
                const cookies = document.cookie.split(';');
                for (const cookie of cookies) {
                  const eqPos = cookie.indexOf('=');
                  const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                  if (name.startsWith('sb-') || name.includes('auth') || name.includes('token') || name.includes('session')) {
                    document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;`;
                  }
                }
              }
              await fetch('/api/auth/logout', { method: 'POST' });
            } finally {
              window.location.href = '/login?reason=manual';
            }
          }}
          className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/50 border border-rose-900/40 text-xs font-medium transition-all cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Cerrar sesión segura y salir"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}
