import { createBrowserClient, type CookieOptions } from '@supabase/ssr';
import { parse, serialize } from 'cookie';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Check your environment variables.');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        if (typeof document === 'undefined') return [];
        const parsed = parse(document.cookie || '');
        return Object.keys(parsed).map((name) => ({ name, value: parsed[name] }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        if (typeof document === 'undefined') return;
        cookiesToSet.forEach(({ name, value, options }) => {
          if (!value) {
            document.cookie = serialize(name, '', {
              ...options,
              maxAge: 0,
              path: options?.path || '/',
            });
          } else {
            // Strict session cookie: no maxAge, no expires
            // Discarded automatically when the browser closes
            const { maxAge, expires, ...sessionOptions } = options || {};
            document.cookie = serialize(name, value, {
              ...sessionOptions,
              path: sessionOptions.path || '/',
              sameSite: sessionOptions.sameSite || 'lax',
              secure: typeof window !== 'undefined' ? window.location.protocol === 'https:' : false,
            });
          }
        });
      },
    },
  });
}
