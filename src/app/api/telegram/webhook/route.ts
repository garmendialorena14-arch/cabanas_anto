// ======================================================================
// SAAS Cabañas - Telegram Webhook Endpoint
// Route: /api/telegram/webhook
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { processTelegramUpdate } from '@/modules/telegram/botDispatcher';
import { TelegramClient } from '@/modules/telegram/telegramClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Verificación estricta de Secret Token para mayor seguridad
    const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (configuredSecret && secretHeader !== configuredSecret) {
      console.warn('Telegram Webhook: Secret token ausente o inválido recibido.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parsear el body enviado por Telegram
    const update = await req.json();

    // 3. Procesar el evento en el dispatcher
    const result = await processTelegramUpdate(update);

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error('Error procesando Webhook de Telegram:', error);
    // Devolvemos 200 para evitar que Telegram reintente en bucle en caso de error interno
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }
}

export async function GET() {
  try {
    const { token } = await TelegramClient.getActiveToken();
    let botInfo = null;
    let webhookInfo = null;

    if (token) {
      const client = new TelegramClient(token);
      botInfo = await client.getMe();
      webhookInfo = await client.getWebhookInfo();
    }

    return NextResponse.json({
      status: 'active',
      timestamp: new Date().toISOString(),
      has_token: !!token,
      bot: botInfo,
      webhook: webhookInfo,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
