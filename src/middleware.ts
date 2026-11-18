import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          if (!value) {
            response.cookies.set(name, '', { ...options, maxAge: 0, path: '/' });
          } else {
            // Strict session cookie: no maxAge, no expires
            // Discarded automatically when the browser closes
            const { maxAge, expires, ...sessionCookieOptions } = options || {};
            response.cookies.set(name, value, {
              ...sessionCookieOptions,
              path: sessionCookieOptions.path || '/',
              sameSite: sessionCookieOptions.sameSite || 'lax',
            });
          }
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/recepcion') ||
    pathname.startsWith('/maestranza') ||
    pathname.startsWith('/mantenimiento') ||
    pathname.startsWith('/mfa-verify') ||
    pathname.startsWith('/mfa-enroll');

  // 1. Redirección estricta de no autenticados (incluso en desarrollo local)
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Control para usuarios autenticados
  if (user) {
    let role: string | null = null;
    let isActive = true;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .single();

      if (profile) {
        role = profile.role;
        isActive = profile.is_active;
      }
    } catch {
      // Fallback a metadata si falla la consulta
    }

    if (!role && user.user_metadata?.role) {
      role = user.user_metadata.role;
    }

    // Si la cuenta está desactivada, invalidar y enviar a login
    if (!isActive) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('reason', 'account_disabled');
      const logoutResponse = NextResponse.redirect(url);
      request.cookies.getAll().forEach((c) => {
        logoutResponse.cookies.set(c.name, '', { maxAge: 0, path: '/' });
      });
      return logoutResponse;
    }

    const isDuenoOrAdmin = role === 'dueno' || role === 'admin';
    const isRecepcion = role === 'recepcion';
    const isMaestranza = role === 'maestranza';
    const isMantenimiento = role === 'mantenimiento';

    const roleTarget: Record<string, string> = {
      dueno: '/admin',
      admin: '/admin',
      recepcion: '/recepcion',
      maestranza: '/maestranza',
      mantenimiento: '/mantenimiento',
    };

    const assignedPortal = role ? roleTarget[role] : null;

    if (!assignedPortal) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('reason', 'unauthorized');
      return NextResponse.redirect(url);
    }

    // 3. Regla de 2FA (MFA) Obligatoria para Dueño/Admin y Recepción
    const requires2FA = isDuenoOrAdmin || isRecepcion;
    if (requires2FA) {
      try {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        const currentLevel = aalData?.currentLevel;

        // Si no completó el segundo factor (AAL2)
        if (currentLevel !== 'aal2') {
          if (pathname !== '/mfa-verify' && pathname !== '/mfa-enroll') {
            const url = request.nextUrl.clone();
            url.pathname = '/mfa-verify';
            return NextResponse.redirect(url);
          }
          return response;
        }
      } catch {
        // En caso de error, continuar con precaución
      }
    }

    // Si ya completó 2FA o no lo requiere y visita login o mfa-verify:
    // Excepción crítica: Si el usuario solicitó cerrar sesión (reason=manual, inactivity, tab_closed, logout),
    // NO redirigir de vuelta al portal; limpiar cookies residuales y permitir renderizar la pantalla de login.
    const reason = request.nextUrl.searchParams.get('reason');
    const isExplicitLogout = reason === 'manual' || reason === 'inactivity' || reason === 'tab_closed' || reason === 'logout';

    if (pathname === '/login' && isExplicitLogout) {
      const loginResponse = NextResponse.next({
        request: {
          headers: request.headers,
        },
      });
      request.cookies.getAll().forEach((c) => {
        if (c.name.startsWith('sb-') || c.name.includes('auth') || c.name.includes('token') || c.name.includes('session')) {
          loginResponse.cookies.set(c.name, '', { maxAge: 0, path: '/', expires: new Date(0) });
        }
      });
      return loginResponse;
    }

    if (pathname === '/login' || pathname === '/mfa-verify') {
      const url = request.nextUrl.clone();
      url.pathname = assignedPortal;
      return NextResponse.redirect(url);
    }

    // 4. Control Estricto RBAC (Aislamiento Total de Portales y Roles)
    // No se permite cruzarse entre roles: adm no va a recepcion, recepcion no va a adm, etc.

    // Zona Admin: Solo Dueño y Admin
    if (pathname.startsWith('/admin') && !isDuenoOrAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = assignedPortal;
      return NextResponse.redirect(url);
    }

    // Zona Recepción: Solo Recepción
    if (pathname.startsWith('/recepcion') && !isRecepcion) {
      const url = request.nextUrl.clone();
      url.pathname = assignedPortal;
      return NextResponse.redirect(url);
    }

    // Zona Maestranza: Solo Maestranza
    if (pathname.startsWith('/maestranza') && !isMaestranza) {
      const url = request.nextUrl.clone();
      url.pathname = assignedPortal;
      return NextResponse.redirect(url);
    }

    // Zona Mantenimiento: Solo Mantenimiento
    if (pathname.startsWith('/mantenimiento') && !isMantenimiento) {
      const url = request.nextUrl.clone();
      url.pathname = assignedPortal;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/recepcion/:path*',
    '/maestranza/:path*',
    '/mantenimiento/:path*',
    '/mfa-verify',
    '/mfa-enroll',
    '/login',
  ],
};
