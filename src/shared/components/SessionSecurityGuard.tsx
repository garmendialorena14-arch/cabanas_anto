'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/client';
import { AlertTriangle, LogOut, CheckCircle2 } from 'lucide-react';

export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30; // 30 minutos por defecto

export function getInactivityTimeoutMs(): number {
  if (typeof window === 'undefined') return DEFAULT_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
  const stored = localStorage.getItem('saas_inactivity_timeout_minutes');
  if (stored === null) return DEFAULT_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
  const minutes = Number(stored);
  if (isNaN(minutes)) return DEFAULT_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
  if (minutes <= 0) return 0; // 0 significa desactivado (sin cierre por inactividad)
  return minutes * 60 * 1000;
}

interface SessionSecurityGuardProps {
  requiredRole?: 'admin' | 'recepcion' | 'maestranza' | 'mantenimiento';
  userId?: string;
}

export default function SessionSecurityGuard({ requiredRole }: SessionSecurityGuardProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [timeoutMs, setTimeoutMs] = useState<number>(() => getInactivityTimeoutMs());
  const lastActivityRef = useRef<number>(Date.now());
  const isLoggingOutRef = useRef<boolean>(false);

  // Escuchar cambios dinámicos en la configuración del tiempo de inactividad
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateTimeout = () => {
      setTimeoutMs(getInactivityTimeoutMs());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'saas_inactivity_timeout_minutes') {
        updateTimeout();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('saas_timeout_changed', updateTimeout as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('saas_timeout_changed', updateTimeout as EventListener);
    };
  }, []);

  // 1. Control estricto de Pestaña/Navegador y Control de Roles (RBAC)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supabase = createClient();

    async function verifySessionAndRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.replace('/login');
          return;
        }

        // A. VERIFICACIÓN DE CIERRE DE PESTAÑA / NAVEGADOR
        const activeTabUser = sessionStorage.getItem('saas_tab_session_user');
        const activeTabSessionId = sessionStorage.getItem('saas_tab_session_id');

        if (!activeTabSessionId || activeTabUser !== user.id) {
          isLoggingOutRef.current = true;
          sessionStorage.clear();
          await supabase.auth.signOut();
          router.replace('/login?reason=tab_closed');
          return;
        }

        // B. VERIFICACIÓN DE ROL Y PREVENCIÓN DE CRUCE DE SESIONES (RBAC)
        if (requiredRole) {
          let actualRole = user.user_metadata?.role;
          try {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('role, is_active')
              .eq('id', user.id)
              .single();

            if (profile) {
              actualRole = profile.role;
              if (profile.is_active === false) {
                isLoggingOutRef.current = true;
                sessionStorage.clear();
                await supabase.auth.signOut();
                router.replace('/login?reason=account_disabled');
                return;
              }
            }
          } catch {
            // Continuar con metadata
          }

          const isDuenoOrAdmin = actualRole === 'dueno' || actualRole === 'admin';
          const roleTarget: Record<string, string> = {
            dueno: '/admin',
            admin: '/admin',
            recepcion: '/recepcion',
            maestranza: '/maestranza',
            mantenimiento: '/mantenimiento',
          };

          const assignedPortal = actualRole ? roleTarget[actualRole] : '/login';

          let isAuthorized = false;
          if (requiredRole === 'admin') {
            isAuthorized = isDuenoOrAdmin;
          } else {
            isAuthorized = actualRole === requiredRole;
          }

          if (!isAuthorized) {
            router.replace(assignedPortal);
            return;
          }
        }

        lastActivityRef.current = Date.now();
        sessionStorage.setItem('saas_last_activity', Date.now().toString());
      } catch {
        // Red neutral
      }
    }

    verifySessionAndRole();

    // Sincronización entre pestañas: Si en otra pestaña se cerró sesión, cerrar aquí también
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'saas_force_logout') {
        isLoggingOutRef.current = true;
        sessionStorage.clear();
        router.replace('/login?reason=manual');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [requiredRole, router]);

  // 2. Control dinámico de inactividad de sesión
  const resetActivity = useCallback(() => {
    if (isLoggingOutRef.current) return;
    lastActivityRef.current = Date.now();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('saas_last_activity', Date.now().toString());
    }
    if (showWarning) {
      setShowWarning(false);
    }
  }, [showWarning]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    let throttleTimer: NodeJS.Timeout | null = null;

    const throttledHandler = () => {
      if (!throttleTimer) {
        resetActivity();
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
        }, 1000);
      }
    };

    activityEvents.forEach((ev) => window.addEventListener(ev, throttledHandler, { passive: true }));

    const timerInterval = setInterval(async () => {
      if (isLoggingOutRef.current) return;

      // Si el timeout configurado es 0, no se cierra por inactividad
      if (timeoutMs <= 0) {
        if (showWarning) setShowWarning(false);
        return;
      }

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const warningWindowMs = Math.min(60 * 1000, timeoutMs / 2);

      if (elapsed >= timeoutMs) {
        isLoggingOutRef.current = true;
        clearInterval(timerInterval);
        sessionStorage.clear();
        try {
          localStorage.setItem('saas_force_logout', Date.now().toString());
          await fetch('/api/auth/logout', { method: 'POST' });
          const supabase = createClient();
          await supabase.auth.signOut();
        } catch {}
        window.location.href = '/login?reason=inactivity';
      } else if (elapsed >= timeoutMs - warningWindowMs) {
        setShowWarning(true);
        const remainingSec = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
        setSecondsRemaining(remainingSec);
      } else {
        if (showWarning) setShowWarning(false);
      }
    }, 1000);

    return () => {
      clearInterval(timerInterval);
      activityEvents.forEach((ev) => window.removeEventListener(ev, throttledHandler));
    };
  }, [resetActivity, router, showWarning, timeoutMs]);

  const handleManualLogout = async () => {
    isLoggingOutRef.current = true;
    sessionStorage.clear();
    try {
      localStorage.setItem('saas_force_logout', Date.now().toString());
      await fetch('/api/auth/logout', { method: 'POST' });
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    window.location.href = '/login?reason=manual';
  };

  if (!showWarning) return null;

  const minutesPart = Math.floor(secondsRemaining / 60);
  const secondsPart = secondsRemaining % 60;
  const timeFormatted = `${minutesPart < 10 ? '0' : ''}${minutesPart}:${secondsPart < 10 ? '0' : ''}${secondsPart}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-200 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-serif text-lg font-bold text-stone-900">
            Aviso de Inactividad de Sesión
          </h3>
          <p className="text-xs text-stone-600">
            Por política de seguridad operativa, tu sesión se cerrará automáticamente en:
          </p>
          <div className="text-3xl font-bold font-mono text-amber-700 py-2">
            {timeFormatted}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={resetActivity}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-medium text-xs shadow-md transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            Continuar trabajando
          </button>
          <button
            onClick={handleManualLogout}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 font-medium text-xs transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
