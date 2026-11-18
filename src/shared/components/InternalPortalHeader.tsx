'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LogOut,
  User,
  DollarSign,
  Calendar,
  Layers,
  Sparkles,
  Wrench,
  Users,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { createClient } from '@/shared/lib/supabase/client';
import { UserRole } from '@/shared/types';
import { formatARS } from '@/shared/lib/bimonetary';

export default function InternalPortalHeader({
  role,
  userName,
  blueRate = 1285,
}: {
  role: UserRole;
  userName?: string;
  blueRate?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [displayUser, setDisplayUser] = useState<string>(userName || 'Usuario');

  useEffect(() => {
    async function loadUserData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single();

          if (profile?.full_name) {
            setDisplayUser(profile.full_name);
          } else if (user.email) {
            setDisplayUser(user.email);
          }
        }
      } catch {
        // Mantener fallback
      }
    }
    loadUserData();
  }, [userName]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      // 1. Limpieza total de sessionStorage y localStorage de autenticación
      sessionStorage.clear();
      try {
        localStorage.setItem('saas_force_logout', Date.now().toString());
        localStorage.removeItem('saas_tab_session_id');
        localStorage.removeItem('saas_tab_session_user');
        localStorage.removeItem('saas_tab_session_role');
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-') || key.startsWith('saas_')) {
            localStorage.removeItem(key);
          }
        });
      } catch {}

      // 2. Limpieza forzada de cookies cliente
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

      // 3. Cierre de sesión en Supabase Browser Client
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {}

      // 4. Endpoint backend de revocación y reseteo de cookies HTTP
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}
    } catch (err) {
      console.error('Error durante el cierre de sesión:', err);
    } finally {
      // 5. Redirección dura garantizada a la ruta de logout del backend que limpia y redirige a login
      window.location.href = '/api/auth/logout';
    }
  };

  const roleColors: Record<UserRole, { bg: string; text: string; label: string }> = {
    dueno: { bg: 'bg-amber-950/80 border-amber-600/50', text: 'text-amber-300', label: 'Dueño (Admin)' },
    admin: { bg: 'bg-amber-950/80 border-amber-600/50', text: 'text-amber-300', label: 'Dueño (Admin)' },
    recepcion: { bg: 'bg-emerald-950/80 border-emerald-600/50', text: 'text-emerald-300', label: 'Recepción' },
    maestranza: { bg: 'bg-blue-950/80 border-blue-600/50', text: 'text-blue-300', label: 'Maestranza' },
    mantenimiento: { bg: 'bg-purple-950/80 border-purple-600/50', text: 'text-purple-300', label: 'Mantenimiento' },
  };

  const currentBadge = roleColors[role] || roleColors.dueno;

  return (
    <header className="bg-stone-900 border-b border-stone-800 text-stone-200 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-amber-500/40">
            <Image
              src="/images/branding/logo.jpg"
              alt="Logo"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="font-serif text-sm font-bold text-amber-100 flex items-center gap-1.5">
              <span>Cabañas Anto</span>
              <span className="text-[10px] font-sans font-normal text-stone-400">· PMS</span>
            </h1>
            <p className="text-[11px] text-stone-400">
              Gestión Integral & Seguridad RLS Aislada
            </p>
          </div>
        </div>

        {/* Right side: Ticker, User Info & Logout */}
        <div className="flex items-center gap-3">
          {/* Dólar Blue Ticker */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-stone-800/80 border border-stone-700 text-xs">
            <span className="text-amber-400 font-bold">USD Blue:</span>
            <span className="font-mono text-emerald-400 font-semibold">{formatARS(blueRate)}</span>
          </div>

          {/* User Badge con Rol Estricto */}
          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-xl border text-xs font-medium flex items-center gap-1.5 ${currentBadge.bg} ${currentBadge.text}`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{currentBadge.label}</span>
            </div>
            <span className="text-xs text-stone-300 font-medium hidden lg:inline max-w-[180px] truncate" title={displayUser}>
              {displayUser}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Cerrar sesión segura y salir"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-red-200 hover:text-white bg-red-950/70 hover:bg-red-900/80 border border-red-700/60 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span>{loggingOut ? 'Saliendo...' : 'Cerrar Sesión'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
