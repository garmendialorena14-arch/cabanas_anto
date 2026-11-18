// ======================================================================
// SAAS Cabañas - Telegram Local Poller (Para pruebas en desarrollo local)
// Reenvía mensajes de Telegram hacia http://localhost:3000/api/telegram/webhook
// sin necesidad de instalar o pagar túneles externos.
// ======================================================================

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
      if (p.endsWith('Telegram.txt') && content.trim().length > 15) {
        return content.trim();
      }
      const match = content.match(/TELEGRAM_BOT_TOKEN=([^\r\n]+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return '';
}

const token = getToken();
if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN no encontrado.');
  process.exit(1);
}

const TARGET_WEBHOOK = process.env.LOCAL_WEBHOOK_URL || 'http://localhost:3000/api/telegram/webhook';
let offset = 0;

console.log('🤖 Telegram Poller de Desarrollo iniciado');
console.log(`📡 Reenviando mensajes hacia: ${TARGET_WEBHOOK}`);
console.log('Presiona Ctrl+C para detener el poller.\n');

async function pollUpdates() {
  while (true) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          try {
            const hookRes = await fetch(TARGET_WEBHOOK, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(update),
            });
            const hookData = await hookRes.json();
            const fromName = update.message?.from?.first_name || 'Usuario';
            const msgText = update.message?.text || '[Multimedia]';
            console.log(`[${new Date().toLocaleTimeString('es-AR')}] Mensaje de ${fromName}: "${msgText}" -> Procesado por IA/CRM.`);
          } catch (postErr) {
            console.error('Error reenviando a webhook local:', postErr.message);
          }
        }
      } else if (!data.ok) {
        console.warn('Telegram API aviso:', data.description);
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch (err) {
      console.error('Error de red en polling:', err.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

pollUpdates();
