'use client';

import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Calendar,
  Users,
  MessageSquare,
  Sparkles,
  Wrench,
  CreditCard,
  Sun,
  Flag,
  Clock,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Settings,
  Plus,
  LogOut,
  Send,
  Bot,
  Key,
} from 'lucide-react';

export type AdminActiveView = 
  | 'dashboard' 
  | 'calendar' 
  | 'leads'
  | 'reception' 
  | 'housekeeping' 
  | 'maintenance' 
  | 'bank' 
  | 'season_config' 
  | 'holidays' 
  | 'schedules'
  | 'security_session'
  | 'telegram_crm'
  | 'telegram_bookings'
  | 'telegram_assistants'
  | 'telegram_bot';

interface AdminSidebarProps {
  activeView: AdminActiveView;
  onSelectView: (view: AdminActiveView) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenHolidayModal?: () => void;
  onOpenSeasonModal?: () => void;
  onOpenCreateReservation?: () => void;
  leadsCount?: number;
}

interface NavItem {
  id: AdminActiveView;
  label: string;
  icon: any;
  badge?: string | null;
  href?: string;
}

export default function AdminSidebar({
  activeView,
  onSelectView,
  isCollapsed,
  onToggleCollapse,
  onOpenHolidayModal,
  onOpenSeasonModal,
  onOpenCreateReservation,
  leadsCount,
}: AdminSidebarProps) {
  const mainNavItems: NavItem[] = [
    {
      id: 'dashboard' as AdminActiveView,
      label: 'Panel General',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'calendar' as AdminActiveView,
      label: 'Calendario & Ocupación',
      icon: Calendar,
    },
    {
      id: 'leads' as AdminActiveView,
      label: 'Consultas & Leads',
      icon: MessageSquare,
    },
    {
      id: 'reception' as AdminActiveView,
      label: 'Recepción & Leads',
      icon: Users,
      href: '/recepcion',
    },
    {
      id: 'housekeeping' as AdminActiveView,
      label: 'Maestranza & Limpieza',
      icon: Sparkles,
      href: '/maestranza',
    },
    {
      id: 'maintenance' as AdminActiveView,
      label: 'Mantenimiento & Pileta',
      icon: Wrench,
    },
    {
      id: 'bank' as AdminActiveView,
      label: 'Cuentas & Cobros',
      icon: CreditCard,
    },
  ];

  const telegramNavItems: NavItem[] = [
    {
      id: 'telegram_crm' as AdminActiveView,
      label: 'CRM & Control Humano',
      icon: Send,
    },
    {
      id: 'telegram_bookings' as AdminActiveView,
      label: 'Reservas Telegram',
      icon: Calendar,
    },
    {
      id: 'telegram_assistants' as AdminActiveView,
      label: 'Asistentes de IA',
      icon: Bot,
    },
    {
      id: 'telegram_bot' as AdminActiveView,
      label: 'Configuración Bot',
      icon: Key,
    },
  ];

  const operationalSettingsItems = [
    {
      id: 'season_config' as AdminActiveView,
      label: 'Temporada Alta & Tarifas',
      icon: Sun,
      action: onOpenSeasonModal,
    },
    {
      id: 'holidays' as AdminActiveView,
      label: 'Feriados & Findes Largos',
      icon: Flag,
      action: onOpenHolidayModal,
    },
    {
      id: 'schedules' as AdminActiveView,
      label: 'Horarios Operativos',
      icon: Clock,
    },
    {
      id: 'security_session' as AdminActiveView,
      label: 'Seguridad & Sesión',
      icon: ShieldCheck,
    },
  ];

  return (
    <aside
      className={`relative flex flex-col bg-slate-900 text-slate-100 border-r border-slate-800 transition-all duration-300 z-30 select-none ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Pestaña / Tirador lateral para colapsar/expandir (centrada verticalmente) */}
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

      {/* Header del Sidebar (Sin botón superior, cabecera limpia y compacta) */}
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
                <ShieldCheck className="w-2.5 h-2.5" /> Módulo Dueño
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

      {/* Botón Acción Destacada: Cargar Reserva Manual */}
      <div className="px-2.5 pt-2">
        {!isCollapsed ? (
          <button
            onClick={onOpenCreateReservation}
            className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Cargar Reserva
          </button>
        ) : (
          <button
            onClick={onOpenCreateReservation}
            className="w-8 h-8 mx-auto rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center justify-center shadow-sm shadow-emerald-500/20 transition-all"
            title="Cargar Reserva Manual"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Contenido sin scroll innecesario */}
      <div className="flex-1 py-2 px-2.5 space-y-3 overflow-y-auto scrollbar-none">
        {/* Sección: Navegación Principal */}
        <div>
          {!isCollapsed && (
            <p className="px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
              Navegación SaaS
            </p>
          )}
          <nav className="space-y-0.5">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sección: Telegram & Asistentes IA */}
        <div className="pt-2 border-t border-slate-800/80">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 mb-1">
              <p className="text-[10px] font-bold tracking-wider text-sky-400 uppercase flex items-center gap-1">
                <Send className="w-3 h-3" /> Telegram & IA
              </p>
            </div>
          )}
          <nav className="space-y-0.5">
            {telegramNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                    isActive
                      ? 'bg-sky-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-sky-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sección: Configuraciones de Operatividad */}
        <div className="pt-2 border-t border-slate-800/80">
          {!isCollapsed && (
            <div className="flex items-center justify-between px-2 mb-1">
              <p className="text-[10px] font-bold tracking-wider text-amber-400/90 uppercase flex items-center gap-1">
                <Settings className="w-3 h-3" /> Operatividad
              </p>
            </div>
          )}
          <nav className="space-y-0.5">
            {operationalSettingsItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action) {
                      item.action();
                    } else {
                      onSelectView(item.id);
                    }
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 text-amber-400/90 flex-shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer del Sidebar con info de sistema y botón de Cerrar Sesión */}
      <div className="py-2 px-2.5 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        {!isCollapsed && (
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span>In: <strong className="text-slate-200">14:00hs</strong></span>
            <span>Out: <strong className="text-slate-200">10:00am</strong></span>
            <span className="text-slate-500">(4hs limpieza)</span>
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
          className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/50 border border-rose-900/40 text-xs font-medium transition-all ${
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
