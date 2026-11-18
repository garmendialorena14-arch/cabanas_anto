'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Bot,
  Key,
  Globe,
  UserCheck,
  Info,
} from 'lucide-react';

export default function TelegramBotConfigCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [ownerChatId, setOwnerChatId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [botInfo, setBotInfo] = useState<any>(null);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/telegram/config');
      const data = await res.json();
      if (data.connection) {
        setOwnerChatId(data.connection.owner_chat_id || '');
        setWebhookUrl(data.connection.webhook_url || '');
      } else {
        // Sugerir URL por defecto según el navegador
        if (typeof window !== 'undefined') {
          setWebhookUrl(`${window.location.origin}/api/telegram/webhook`);
        }
      }
      setBotInfo(data.bot);
      setWebhookInfo(data.webhook);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Error al cargar la configuración de Telegram.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    const cleanToken = botToken.trim().replace(/[•*]/g, '');
    if (!cleanToken && !botInfo) {
      setStatusMessage({ type: 'error', text: 'Debes ingresar el Bot Token de Telegram.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: cleanToken,
          owner_chat_id: ownerChatId,
          webhook_url: webhookUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setStatusMessage({ type: 'error', text: data.error || 'Error al guardar la configuración.' });
      } else {
        setStatusMessage({
          type: 'success',
          text: `¡Bot @${data.bot.username} conectado exitosamente y Webhook registrado!`,
        });
        setBotInfo(data.bot);
        setBotToken('');
        fetchConfig();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error de conexión.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-6 shadow-xl">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Conexión de Telegram Bot
              {botInfo ? (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Sin Configurar
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Conecta el bot oficial de Cabañas Anto para atención con IA, reservas y control humano.
            </p>
          </div>
        </div>

        <button
          onClick={fetchConfig}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refrescar Estado
        </button>
      </div>

      {/* Alerta de Feedback */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-start gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
              : 'bg-rose-950/40 text-rose-300 border-rose-800/50'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Bot Info Badge si está activo */}
      {botInfo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Bot de Telegram</div>
              <div className="text-sm font-bold text-sky-300">@{botInfo.username}</div>
              <div className="text-[11px] text-slate-400">{botInfo.first_name} (ID: {botInfo.id})</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Estado Webhook</div>
              <div className="text-sm font-semibold text-slate-200">
                {webhookInfo?.url ? 'Registrado y Activo' : 'Sin Webhook registrado'}
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={webhookInfo?.url}>
                {webhookInfo?.url || 'Telegram no tiene URL asignada'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Asistente Propietario</div>
              <div className="text-sm font-semibold text-emerald-300">
                {ownerChatId ? `Chat ID: ${ownerChatId}` : 'No definido'}
              </div>
              <div className="text-[11px] text-slate-400">
                {ownerChatId ? 'Autorizado para /ocupacion y /caja' : 'Cualquiera interactúa como huésped'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de Configuración */}
      <form onSubmit={handleSaveConfig} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-sky-400" />
            Bot Token (Obtenido de @BotFather)
            {botInfo && (
              <span className="ml-auto text-[10px] text-emerald-400 font-normal lowercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Token activo en uso
              </span>
            )}
          </label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={botInfo ? '•••••••••••••••• (dejar en blanco para conservar el actual)' : 'Ej: 7123456789:AAH...'}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            {botInfo
              ? '✅ Ya tienes un token activo configurado. Si no deseas cambiar el token de Telegram, déjalo vacío.'
              : 'Pega aquí el token que te entregó el bot @BotFather al crearlo.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              URL Pública del Webhook
            </label>
            <input
              type="url"
              placeholder="https://tudominio.com/api/telegram/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Debe comenzar con HTTPS. En desarrollo local puedes usar ngrok o localtunnel.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              Telegram Chat ID / Username del Dueño
            </label>
            <input
              type="text"
              placeholder="Ej: 123456789 o @tuusuario"
              value={ownerChatId}
              onChange={(e) => setOwnerChatId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Permite recibir consultas privadas del complejo y ejecutar comandos como /ocupacion o /caja.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Validando y Registrando...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Guardar y Registrar Webhook
              </>
            )}
          </button>
        </div>
      </form>

      {/* Guía Rápida */}
      <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800 text-xs text-slate-400 space-y-2">
        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-sky-400" />
          Pasos rápidos para activar tu bot en Telegram:
        </div>
        <ol className="list-decimal list-inside space-y-1 ml-1">
          <li>
            Abre Telegram y busca <strong className="text-slate-200">@BotFather</strong>. Escribe <code className="text-sky-300">/newbot</code> y sigue las instrucciones para asignarle nombre y usuario.
          </li>
          <li>
            Copia el <strong>HTTP API Token</strong> generado y pégalo en el campo superior.
          </li>
          <li>
            Para conocer tu <strong>Telegram Chat ID</strong>, inicia una conversación con <strong className="text-slate-200">@userinfobot</strong> en Telegram. Copia el número <code className="text-emerald-300">Id</code> y pégalo arriba.
          </li>
          <li>
            Haz clic en <strong>"Guardar y Registrar Webhook"</strong>. ¡Tu bot quedará en línea de inmediato!
          </li>
        </ol>
      </div>
    </div>
  );
}
