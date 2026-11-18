// ======================================================================
// SAAS Cabañas - Telegram Bot Service
// Proporciona notificaciones inmediatas al personal y recepción
// sin requerir configuraciones complejas de webhooks de WhatsApp.
// ======================================================================

export async function sendTelegramNotification(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_NOTIFICATION_CHAT_ID;

  if (!token || !chatId) {
    // Si no está configurado en las variables de entorno, salimos de forma silenciosa y segura
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    return res.ok;
  } catch (error) {
    console.error('Error enviando notificación a Telegram:', error);
    return false;
  }
}
