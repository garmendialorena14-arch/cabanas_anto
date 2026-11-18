// ======================================================================
// SAAS Cabañas - Telegram Webhook Endpoint
// Route: /api/telegram/webhook
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { processTelegramUpdate } from '@/modules/telegram/botDispatcher';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Verificación de Secret Token
    const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (configuredSecret && secretHeader && secretHeader !== configuredSecret) {
      console.warn('Telegram Webhook: Secret token inválido recibido.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parsear el body enviado por Telegram
    let update: any = null;
    try {
      update = await req.json();
    } catch {
      // Ping o comprobación inicial sin payload
      return NextResponse.json({ ok: true, message: 'Webhook endpoint active' });
    }

    if (!update || (!update.message && !update.callback_query)) {
      return NextResponse.json({ ok: true, message: 'Ignored empty update' });
    }

    // 3. Procesar el evento en el dispatcher
    const result = await processTelegramUpdate(update);

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error('Error procesando Webhook de Telegram:', error);
    // Devolver 200 para evitar reintentos en bucle de Telegram
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    service: 'Cabanas Anto Telegram Webhook',
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
