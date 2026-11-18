import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

function clearSupabaseCookies(cookieStore: any, response: NextResponse) {
  const allCookies = cookieStore.getAll();
  allCookies.forEach((c: { name: string; value: string }) => {
    if (
      c.name.startsWith('sb-') ||
      c.name.includes('auth') ||
      c.name.includes('token') ||
      c.name.includes('session')
    ) {
      response.cookies.set(c.name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
    }
  });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const response = NextResponse.json({ success: true });
  clearSupabaseCookies(cookieStore, response);

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
            cookiesToSet.forEach(({ name, options }) => {
              response.cookies.set(name, '', {
                ...options,
                path: '/',
                maxAge: 0,
                expires: new Date(0),
              });
            });
          },
        },
      });
      await supabase.auth.signOut();
    } catch {
      // Continuar para garantizar que el cliente se desloguee
    }
  }

  return response;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const loginUrl = new URL('/login?reason=manual', request.url);
  const response = NextResponse.redirect(loginUrl);
  clearSupabaseCookies(cookieStore, response);

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
            cookiesToSet.forEach(({ name, options }) => {
              response.cookies.set(name, '', {
                ...options,
                path: '/',
                maxAge: 0,
                expires: new Date(0),
              });
            });
          },
        },
      });
      await supabase.auth.signOut();
    } catch {
      // Continuar para garantizar que el cliente se desloguee
    }
  }

  return response;
}
