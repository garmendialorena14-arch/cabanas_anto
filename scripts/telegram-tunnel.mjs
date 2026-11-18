// ======================================================================
// SAAS Cabañas - Auto-reconnecting Telegram Tunnel & Webhook Registrar
// Mantiene el túnel HTTPS público abierto de forma permanente y registra
// el webhook en Telegram automáticamente.
// ======================================================================

import localtunnel from 'localtunnel';
import fs from 'fs';
import path from 'path';

function getToken() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN.trim();
  const paths = [
    path.join(process.cwd(), 'Telegram.txt'),
    path.join(process.cwd(), '.env.local'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      if (p.endsWith('Telegram.txt') && content.trim().length > 15) return content.trim();
      const match = content.match(/TELEGRAM_BOT_TOKEN=([^\r\n]+)/);
      if (match && match[1]) return match[1].trim();
    }
  }
  return '';
}

const token = getToken();
if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN no encontrado.');
  process.exit(1);
}

const PORT = 3000;
let isReconnecting = false;

async function startTunnel() {
  if (isReconnecting) return;
  isReconnecting = true;

  try {
    console.log(`🔌 Conectando túnel público HTTPS en el puerto ${PORT}...`);
    const tunnel = await localtunnel({ port: PORT });
    isReconnecting = false;

    const webhookUrl = `${tunnel.url}/api/telegram/webhook`;
    console.log(`🌐 Túnel activo: ${tunnel.url}`);
    console.log(`📡 Registrando Webhook en Telegram: ${webhookUrl}`);

    // Registrar en Telegram con secret_token de seguridad
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || 'cabanas_anto_telegram_secret';
    const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query'],
      }),
    });
    const setData = await setRes.json();
    if (setData.ok) {
      console.log('✅ Webhook registrado con éxito en Telegram.');
    } else {
      console.warn('⚠️ Telegram aviso al registrar:', setData.description);
    }

    // Eventos de reconexión automática si el servidor de localtunnel reinicia
    tunnel.on('close', () => {
      console.warn('⚠️ Túnel cerrado. Reconectando en 3 segundos...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('⚠️ Error en túnel:', err.message, '- Reconectando...');
      try { tunnel.close(); } catch {}
      setTimeout(startTunnel, 3000);
    });

    // Mantener proceso Node activo de forma indefinida con heartbeat
    if (!global.__heartbeatInterval) {
      global.__heartbeatInterval = setInterval(async () => {
        try {
          const checkRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
          const checkData = await checkRes.json();
          if (checkData.result?.last_error_message) {
            // Silencioso o log si hubo error
          }
        } catch {}
      }, 30000);
    }

  } catch (err) {
    isReconnecting = false;
    console.error('Error iniciando túnel:', err.message);
    setTimeout(startTunnel, 4000);
  }
}

startTunnel();
