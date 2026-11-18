import { createClient } from '@supabase/supabase-js';

// ADVERTENCIA DE SEGURIDAD (Skill de Auditoría):
// Este cliente utiliza la clave de Service Role con privilegios totales.
// SOLO debe ser importado y ejecutado en el backend confiable (Netlify Functions / Server Actions).
// JAMÁS debe enviarse al navegador ni asignarse a variables NEXT_PUBLIC_*.

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!serviceRoleKey) {
    throw new Error('CRITICAL SECURITY: SUPABASE_SERVICE_ROLE_KEY is not defined in server environment.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
