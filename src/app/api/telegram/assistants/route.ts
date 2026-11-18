// ======================================================================
// SAAS Cabañas - Gestión de Asistentes IA
// Route: /api/telegram/assistants
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthRoles } from '@/shared/lib/supabase/authServerHelper';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const { data: assistants, error } = await supabase
      .from('assistants')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assistants });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const body = await req.json();
    const { id, name, role_description, system_prompt, model, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'id del asistente es obligatorio' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (role_description !== undefined) updates.role_description = role_description;
    if (system_prompt !== undefined) updates.system_prompt = system_prompt;
    if (model !== undefined) updates.model = model;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: updated, error } = await supabase
      .from('assistants')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, assistant: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
