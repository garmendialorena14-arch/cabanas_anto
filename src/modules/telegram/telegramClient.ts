// ======================================================================
// SAAS Cabañas - Telegram Client
// Integración con la API oficial de Telegram Bot (BotFather)
// ======================================================================

import { createClient } from '@/shared/lib/supabase/client';

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
}

export class TelegramClient {
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN || '';
  }

  /**
   * Obtiene el token activo desde channel_connections o env
   */
  public static async getActiveToken(): Promise<{ token: string; ownerChatId?: string | null }> {
    if (process.env.TELEGRAM_BOT_TOKEN) {
      return {
        token: process.env.TELEGRAM_BOT_TOKEN,
        ownerChatId: process.env.TELEGRAM_NOTIFICATION_CHAT_ID || null,
      };
    }

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('channel_connections')
        .select('bot_token, owner_chat_id')
        .eq('channel_type', 'telegram')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (data?.bot_token) {
        return { token: data.bot_token, ownerChatId: data.owner_chat_id };
      }
    } catch {
      // Ignorar error si no hay conexión en bd
    }

    return { token: '' };
  }

  private getBaseUrl(): string {
    if (!this.token) {
      throw new Error('Telegram Bot Token no está configurado.');
    }
    return `https://api.telegram.org/bot${this.token}`;
  }

  /**
   * Valida el token y obtiene la info del bot (@username)
   */
  public async getMe(): Promise<TelegramBotInfo | null> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/getMe`);
      const data = await res.json();
      if (data.ok) {
        return data.result as TelegramBotInfo;
      }
      return null;
    } catch (err) {
      console.error('Error en getMe:', err);
      return null;
    }
  }

  /**
   * Envía un mensaje a un chat de Telegram
   */
  public async sendMessage(
    chatId: string | number,
    text: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      reply_to_message_id?: number;
    }
  ): Promise<boolean> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parse_mode || 'HTML',
          reply_to_message_id: options?.reply_to_message_id,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error('Error al enviar mensaje Telegram:', data);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error de red al enviar mensaje Telegram:', err);
      return false;
    }
  }

  /**
   * Registra el webhook en Telegram
   */
  public async setWebhook(url: string, secretToken?: string): Promise<{ ok: boolean; description?: string }> {
    try {
      const body: Record<string, unknown> = {
        url,
        allowed_updates: ['message', 'callback_query'],
      };
      if (secretToken) {
        body.secret_token = secretToken;
      }

      const res = await fetch(`${this.getBaseUrl()}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      return { ok: !!data.ok, description: data.description };
    } catch (err: any) {
      return { ok: false, description: err.message };
    }
  }

  /**
   * Consulta el estado del webhook actual
   */
  public async getWebhookInfo(): Promise<TelegramWebhookInfo | null> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/getWebhookInfo`);
      const data = await res.json();
      if (data.ok) {
        return data.result as TelegramWebhookInfo;
      }
      return null;
    } catch (err) {
      console.error('Error al obtener getWebhookInfo:', err);
      return null;
    }
  }

  /**
   * Elimina el webhook configurado
   */
  public async deleteWebhook(): Promise<boolean> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/deleteWebhook`);
      const data = await res.json();
      return !!data.ok;
    } catch (err) {
      console.error('Error al eliminar webhook:', err);
      return false;
    }
  }
}
