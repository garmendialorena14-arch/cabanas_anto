'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  KeyRound,
  QrCode,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/shared/lib/supabase/client';

export default function MfaVerifyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resettingMfa, setResettingMfa] = useState(false);

  const handleResetMfa = async () => {
    setResettingMfa(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Cabañas Anto 2FA - ${new Date().toLocaleTimeString()}`,
      });
      if (enrollError) throw enrollError;

      setFactorId(enrollData.id);
      setQrCodeSvg(enrollData.totp.qr_code);
      setSecret(enrollData.totp.secret);
      setIsEnrolling(true);
      setCode('');
      setSuccessMessage('Nuevo factor generado. Escaneá este nuevo código QR con tu aplicación autenticadora.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al generar nuevo factor 2FA');
    } finally {
      setResettingMfa(false);
    }
  };

  useEffect(() => {
    async function initMfa() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        // Listar factores existentes
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;

        const verifiedFactor = factors?.totp?.find((f) => f.status === 'verified');

        if (verifiedFactor) {
          // Ya tiene 2FA registrado -> solo pedir código
          setFactorId(verifiedFactor.id);
          setIsEnrolling(false);
        } else {
          // No tiene 2FA -> Enrolar nuevo factor
          setIsEnrolling(true);
          const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            friendlyName: `Cabañas Anto 2FA ${Date.now()}`,
          });
          if (enrollError) throw enrollError;

          setFactorId(enrollData.id);
          setQrCodeSvg(enrollData.totp.qr_code);
          setSecret(enrollData.totp.secret);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Error inicializando el segundo factor');
      } finally {
        setLoading(false);
      }
    }

    initMfa();
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length < 6) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      // Desafiar el factor
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Verificar el código de 6 dígitos
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });

      if (verifyError) {
        setErrorMessage('Código de 6 dígitos incorrecto o expirado.');
        setSubmitting(false);
        return;
      }

      setSuccessMessage('¡Segundo factor verificado con éxito!');

      // Consultar rol para redirigir
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const userRole = profile?.role || user?.user_metadata?.role;
      const isDuenoOrAdmin = userRole === 'dueno' || userRole === 'admin';

      // Inicializar sesión de pestaña validada
      const tabSessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`;
      sessionStorage.setItem('saas_tab_session_id', tabSessionId);
      sessionStorage.setItem('saas_tab_session_user', user.id);
      sessionStorage.setItem('saas_tab_session_role', userRole || '');
      sessionStorage.setItem('saas_last_activity', Date.now().toString());

      setTimeout(() => {
        if (isDuenoOrAdmin) {
          router.replace('/admin');
        } else if (userRole === 'recepcion') {
          router.replace('/recepcion');
        } else if (userRole === 'maestranza') {
          router.replace('/maestranza');
        } else if (userRole === 'mantenimiento') {
          router.replace('/mantenimiento');
        } else {
          router.replace('/login?reason=unauthorized');
        }
        router.refresh();
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Fallo al verificar el código');
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.clear();
    try {
      localStorage.setItem('saas_force_logout', Date.now().toString());
    } catch {}
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login?reason=manual');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-stone-400">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm">Verificando configuración de seguridad 2FA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center mx-auto shadow-xl">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-amber-100">
              Autenticación en 2 Pasos (2FA)
            </h1>
            <p className="text-stone-400 text-xs mt-1">
              Seguridad reforzada requerida para Dueño y Recepción (AAL2)
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-stone-800/90 rounded-3xl p-6 sm:p-8 border border-stone-700 shadow-2xl space-y-5 text-stone-200">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-950/60 border border-red-600/50 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {isEnrolling ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs space-y-2">
                <p className="font-bold">Paso 1: Configurar aplicación autenticadora</p>
                <p className="text-stone-300 leading-relaxed">
                  Escaneá el código QR con <strong>Google Authenticator</strong>, <strong>Authy</strong> o la app de tu preferencia.
                </p>
              </div>

              {qrCodeSvg && (
                <div className="p-4 bg-white rounded-2xl flex items-center justify-center max-w-[220px] mx-auto shadow-inner">
                  <div
                    dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                    className="w-full h-auto"
                  />
                </div>
              )}

              {secret && (
                <div className="text-center">
                  <p className="text-[11px] text-stone-400">O ingresá la clave manualmente:</p>
                  <code className="text-xs font-mono text-amber-300 bg-stone-900 px-3 py-1.5 rounded-lg border border-stone-700 inline-block mt-1 select-all">
                    {secret}
                  </code>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-1">
              <KeyRound className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold text-stone-200">Ingresá el código de 6 dígitos</p>
              <p className="text-xs text-stone-400">
                Generado por tu aplicación autenticadora en tu teléfono.
              </p>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2 text-center">
                Código de Verificación
              </label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 rounded-xl bg-stone-900 border border-stone-700 text-amber-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-sm shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando 2FA...</span>
                </>
              ) : (
                <>
                  <span>{isEnrolling ? 'Confirmar y Activar 2FA' : 'Verificar y Continuar'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {!isEnrolling && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleResetMfa}
                disabled={resettingMfa}
                className="text-xs text-amber-400/90 hover:text-amber-300 underline underline-offset-4 inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>
                  {resettingMfa
                    ? 'Restableciendo y generando nuevo QR...'
                    : '¿Reescanear código QR o nuevo dispositivo?'}
                </span>
              </button>
            </div>
          )}

          <div className="pt-2 flex items-center justify-center">
            <button
              onClick={handleLogout}
              className="text-xs text-stone-400 hover:text-red-400 flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cancelar y volver al inicio de sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
