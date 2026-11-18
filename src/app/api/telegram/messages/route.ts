// ======================================================================
// SAAS Cabañas - Gestión de Mensajes y Control Humano CRM
// Route: /api/telegram/messages
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthRoles } from '@/shared/lib/supabase/authServerHelper';
import { TelegramClient } from '@/modules/telegram/telegramClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversation_id');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id es requerido' }, { status: 400 });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Envío de mensaje desde el CRM hacia Telegram (Control Humano)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const body = await req.json();
    const { conversation_id, content } = body;

    if (!conversation_id || !content || typeof content !== 'string') {
      return NextResponse.json({ error: 'conversation_id y content son requeridos.' }, { status: 400 });
    }

    // 1. Obtener la conversación y el chat_id del contacto
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('id, contact_id, status, contacts(external_id, full_name)')
      .eq('id', conversation_id)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 });
    }

    const contact: any = conv.contacts;
    if (!contact?.external_id) {
      return NextResponse.json({ error: 'El contacto no tiene un Telegram Chat ID válido.' }, { status: 400 });
    }

    // 2. Enviar el mensaje a Telegram a través del bot
    const { token } = await TelegramClient.getActiveToken();
    if (!token) {
      return NextResponse.json({ error: 'No hay un Bot Token de Telegram activo configurado.' }, { status: 400 });
    }

    const client = new TelegramClient(token);
    const sent = await client.sendMessage(contact.external_id, content.trim(), { parse_mode: 'HTML' });

    if (!sent) {
      return NextResponse.json({ error: 'Telegram no pudo entregar el mensaje al usuario.' }, { status: 502 });
    }

    // 3. Registrar el mensaje en la tabla messages con sender_type 'human_agent'
    const { data: savedMsg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_type: 'human_agent',
        content: content.trim(),
      })
      .select('*')
      .single();

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    // 4. Actualizar estado y fecha en la conversación
    await supabase
      .from('conversations')
      .update({
        last_message_preview: content.trim().slice(0, 150),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation_id);

    return NextResponse.json({ ok: true, message: savedMsg });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Alternar entre 'ai_active' y 'human_takeover' o cambiar asistente
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin', 'recepcion']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const body = await req.json();
    const { conversation_id, status, assistant_id } = body;

    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id es requerido' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status && ['ai_active', 'human_takeover'].includes(status)) {
      updates.status = status;
    }

    if (assistant_id !== undefined) {
      updates.assistant_id = assistant_id;
    }

    const { data: updated, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversation_id)
      .select('*, contacts(*), assistants(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, conversation: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
