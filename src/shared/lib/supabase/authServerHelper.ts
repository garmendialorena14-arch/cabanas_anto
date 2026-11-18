import { createServerSupabaseClient } from './server';
import { NextResponse } from 'next/server';

export type AuthCheckResult =
  | { authorized: true; response: null; user: any; role: string | null; supabase: any }
  | { authorized: false; response: NextResponse; user: any; role: string | null; supabase: any };

/**
 * Verifica autenticación en el servidor para API Routes de Next.js
 * Retorna 401 si no hay sesión, 403 si el rol no tiene permisos.
 */
export async function requireAuthRoles(allowedRoles: string[]): Promise<AuthCheckResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'No autorizado. Se requiere iniciar sesión.' }, { status: 401 }),
      user: null,
      role: null,
      supabase,
    };
  }

  let role: string | null = null;
  let isActive = true;

  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      role = profile.role;
      isActive = profile.is_active ?? true;
    }
  } catch {
    // Continuar con metadata
  }

  if (!role && user.user_metadata?.role) {
    role = user.user_metadata.role;
  }

  if (!isActive) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Cuenta de usuario desactivada.' }, { status: 403 }),
      user: null,
      role: null,
      supabase,
    };
  }

  const isAllowed =
    role && (
      allowedRoles.includes(role) ||
      (allowedRoles.includes('admin') && role === 'dueno')
    );

  if (!isAllowed) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Acceso denegado para tu rol.' }, { status: 403 }),
      user,
      role,
      supabase,
    };
  }

  return {
    authorized: true,
    response: null,
    user,
    role,
    supabase,
  };
}
