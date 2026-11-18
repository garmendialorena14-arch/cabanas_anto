'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/shared/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const reason = searchParams.get('reason');
      if (reason === 'inactivity') {
        const stored = localStorage.getItem('saas_inactivity_timeout_minutes');
        const minText = stored && stored !== '0' ? `tras ${stored} minutos` : 'por inactividad';
        setSessionNotice(`Tu sesión se cerró automáticamente ${minText}.`);
      } else if (reason === 'tab_closed') {
        setSessionNotice('Tu sesión se cerró automáticamente al cerrar la pestaña o el navegador por política de seguridad.');
      } else if (reason === 'account_disabled') {
        setSessionNotice('Tu cuenta se encuentra desactivada. Comunícate con la administración.');
      } else if (reason === 'unauthorized') {
        setSessionNotice('Acceso no autorizado o rol sin permisos para este portal.');
      } else if (reason === 'manual') {
        setSessionNotice('Has cerrado sesión de forma segura.');
      }

      if (reason) {
        sessionStorage.clear();
        try {
          const supabase = createClient();
          supabase.auth.signOut().catch(() => {});
        } catch {}
      }
    }
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      // Limpiar cualquier sesión anterior antes de iniciar nueva autenticación
      await supabase.auth.signOut();
      sessionStorage.clear();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        setErrorMessage('Credenciales inválidas. Verifique correo y contraseña.');
        setLoading(false);
        return;
      }

      // Consultar perfil de usuario
      let userRole: string | undefined;
      let isActive = true;

      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, full_name, is_active')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          userRole = profile.role;
          isActive = profile.is_active;
        }
      } catch {
        // Fallback a metadata
      }

      if (!userRole) {
        userRole = data.user.user_metadata?.role as string;
      }

      // Si la cuenta está desactivada
      if (!isActive) {
        await supabase.auth.signOut();
        sessionStorage.clear();
        setErrorMessage('Tu cuenta ha sido desactivada por el administrador.');
        setLoading(false);
        return;
      }

      // Inicializar identificador único de sesión de pestaña
      const tabSessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`;
      sessionStorage.setItem('saas_tab_session_id', tabSessionId);
      sessionStorage.setItem('saas_tab_session_user', data.user.id);
      sessionStorage.setItem('saas_tab_session_role', userRole || '');
      sessionStorage.setItem('saas_last_activity', Date.now().toString());

      const isDuenoOrAdmin = userRole === 'dueno' || userRole === 'admin';
      const isRecepcion = userRole === 'recepcion';

      // Si es dueño/admin o recepción, 2FA OBLIGATORIO (AAL2)
      if (isDuenoOrAdmin || isRecepcion) {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel !== 'aal2') {
          router.replace('/mfa-verify');
          return;
        }
      }

      // Redirección estricta al portal correspondiente
      if (isDuenoOrAdmin) {
        router.replace('/admin');
      } else if (isRecepcion) {
        router.replace('/recepcion');
      } else if (userRole === 'maestranza') {
        router.replace('/maestranza');
      } else if (userRole === 'mantenimiento') {
        router.replace('/mantenimiento');
      } else {
        router.replace('/login?reason=unauthorized');
      }
      router.refresh();
    } catch {
      setErrorMessage('Ocurrió un error al intentar autenticar.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-amber-500/30 shadow-xl mx-auto">
            <Image
              src="/images/branding/logo.jpg"
              alt="Logo Cabañas Anto"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-amber-100">
              Cabañas Anto · Portal Interno
            </h1>
            <p className="text-stone-400 text-xs mt-1">
              Sistema de Gestión Integral con Aislamiento Estricto de Roles & 2FA
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-stone-800/90 rounded-3xl p-6 sm:p-8 border border-stone-700 shadow-2xl space-y-5 text-stone-200">
          <div className="flex items-center justify-between pb-3 border-b border-stone-700 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Acceso Seguro (RBAC Aislado)</span>
            </div>
            <Link href="/" className="text-stone-400 hover:text-white transition-colors">
              Ir a la Web Pública →
            </Link>
          </div>

          {sessionNotice && (
            <div className="p-3 rounded-2xl bg-amber-950/60 border border-amber-600/50 text-amber-300 text-xs flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{sessionNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-950/60 border border-red-600/50 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@cabanasanto.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-sm shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-stone-500">
            Dueño y Recepción requerirán autenticación en 2 pasos (2FA). Las sesiones se cierran al cerrar la pestaña.
          </div>
        </div>
      </div>
    </div>
  );
}
