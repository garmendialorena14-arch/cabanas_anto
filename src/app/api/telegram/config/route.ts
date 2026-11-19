// ======================================================================
// SAAS Cabañas - Configuración del Bot de Telegram (Solo Admin)
// Route: /api/telegram/config
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthRoles } from '@/shared/lib/supabase/authServerHelper';
import { TelegramClient } from '@/modules/telegram/telegramClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAuthRoles(['admin']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const { data: conn } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('channel_type', 'telegram')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const activeToken = conn?.bot_token || process.env.TELEGRAM_BOT_TOKEN || '';
    let botInfo = null;
    let webhookInfo = null;

    if (activeToken) {
      const client = new TelegramClient(activeToken);
      botInfo = await client.getMe();
      webhookInfo = await client.getWebhookInfo();
    }

    return NextResponse.json({
      configured: !!activeToken,
      connection: conn
        ? {
            ...conn,
            bot_token: conn.bot_token ? `${conn.bot_token.slice(0, 6)}...${conn.bot_token.slice(-4)}` : '',
          }
        : null,
      bot: botInfo,
      webhook: webhookInfo,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthRoles(['admin']);
    if (!auth.authorized) return auth.response;
    const supabase = auth.supabase;

    const body = await req.json();
    const { bot_token, owner_chat_id, owner_phone, webhook_url, is_active } = body;

    // Si el usuario no ingresó un nuevo token (o envió las viñetas del placeholder/autofill), reutilizar el existente
    let effectiveToken = (bot_token || '').trim();
    if (!effectiveToken || effectiveToken.includes('•') || effectiveToken.startsWith('*')) {
      const active = await TelegramClient.getActiveToken();
      effectiveToken = active.token;
    }

    if (!effectiveToken) {
      return NextResponse.json({ error: 'Debes ingresar un Bot Token de Telegram válido.' }, { status: 400 });
    }

    // 1. Validar el token contra la API de Telegram
    const client = new TelegramClient(effectiveToken);
    const botMe = await client.getMe();
    if (!botMe) {
      return NextResponse.json(
        { error: 'El Bot Token no es válido o Telegram no respondió. Verifica que lo hayas copiado correctamente de @BotFather.' },
        { status: 400 }
      );
    }

    // 2. Registrar el Webhook si se proveyó una URL
    let webhookResult = null;
    const cleanWebhookUrl = (webhook_url || '').trim();
    if (cleanWebhookUrl) {
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET || 'cabanas_anto_telegram_secret';
      webhookResult = await client.setWebhook(cleanWebhookUrl, secret);
    }

    // 3. Guardar en Supabase channel_connections
    // Desactivar conexiones previas
    await supabase.from('channel_connections').update({ is_active: false }).eq('channel_type', 'telegram');

    const { data: inserted, error: insertErr } = await supabase
      .from('channel_connections')
      .insert({
        channel_type: 'telegram',
        bot_token: effectiveToken,
        bot_username: botMe.username,
        webhook_url: cleanWebhookUrl || null,
        owner_chat_id: owner_chat_id ? owner_chat_id.trim() : null,
        owner_phone: owner_phone ? owner_phone.trim() : null,
        is_active: is_active ?? true,
      })
      .select('*')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      bot: botMe,
      webhook: webhookResult,
      connectionId: inserted.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
