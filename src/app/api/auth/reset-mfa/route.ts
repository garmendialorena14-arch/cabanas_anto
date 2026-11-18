import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Contexto de Route Handler
          }
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Comprobar rol administrativo para evitar auto-reseteo no autorizado
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role || user.user_metadata?.role;
    if (role !== 'dueno' && role !== 'admin') {
      return NextResponse.json({ error: 'Operación permitida únicamente a administradores del complejo' }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // Obtener factores existentes para este usuario
    const { data: factors, error: listError } = await adminClient.auth.admin.mfa.listFactors({
      userId: user.id,
    });

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    // Eliminar todos los factores existentes para permitir nuevo enrolamiento con QR
    if (factors?.factors && factors.factors.length > 0) {
      for (const factor of factors.factors) {
        await adminClient.auth.admin.mfa.deleteFactor({
          id: factor.id,
          userId: user.id,
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Factores 2FA restablecidos correctamente' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
