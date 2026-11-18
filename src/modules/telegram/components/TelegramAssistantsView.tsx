'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Calendar,
  HelpCircle,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { Assistant } from '@/shared/types';

interface TelegramAssistantsViewProps {
  isAdmin?: boolean;
}

export default function TelegramAssistantsView({ isAdmin = true }: TelegramAssistantsViewProps) {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchAssistants();
  }, []);

  async function fetchAssistants() {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram/assistants');
      const data = await res.json();
      if (data.assistants) {
        setAssistants(data.assistants);
        const map: Record<string, string> = {};
        data.assistants.forEach((a: Assistant) => {
          map[a.id] = a.system_prompt;
        });
        setEditedPrompts(map);
      }
    } catch (err) {
      console.error('Error fetching assistants:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePrompt(assistant: Assistant) {
    if (!isAdmin) return;
    setSavingId(assistant.id);
    setFeedback(null);

    const newPrompt = editedPrompts[assistant.id];

    try {
      const res = await fetch('/api/telegram/assistants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: assistant.id,
          system_prompt: newPrompt,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setFeedback({
          id: assistant.id,
          type: 'success',
          text: 'Prompt actualizado correctamente.',
        });
        setAssistants((prev) =>
          prev.map((a) => (a.id === assistant.id ? { ...a, system_prompt: newPrompt } : a))
        );
      } else {
        setFeedback({
          id: assistant.id,
          type: 'error',
          text: data.error || 'Error al guardar.',
        });
      }
    } catch (err: any) {
      setFeedback({
        id: assistant.id,
        type: 'error',
        text: err.message || 'Error de conexión.',
      });
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleActive(assistant: Assistant) {
    if (!isAdmin) return;
    const newStatus = !assistant.is_active;

    try {
      const res = await fetch('/api/telegram/assistants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: assistant.id,
          is_active: newStatus,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setAssistants((prev) =>
          prev.map((a) => (a.id === assistant.id ? { ...a, is_active: newStatus } : a))
        );
      }
    } catch (err) {
      console.error('Error alternando estado del asistente:', err);
    }
  }

  function getAssistantIcon(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes('reserva')) return Calendar;
    if (lower.includes('faq') || lower.includes('consulta')) return HelpCircle;
    if (lower.includes('cobro') || lower.includes('seña')) return CreditCard;
    if (lower.includes('propietario') || lower.includes('privado')) return UserCheck;
    return Bot;
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Panel de Asistentes Especializados (IA)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                Google Gemini 2.5 Flash
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {isAdmin
                ? 'Modifica los system prompts, activa o desactiva asistentes especializados para Telegram.'
                : 'Consulta las instrucciones activas y parámetros que guían a cada asistente virtual.'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchAssistants}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Asistentes
        </button>
      </div>

      {/* Grid de Asistentes */}
      {loading && assistants.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">Cargando asistentes de IA...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {assistants.map((assistant) => {
            const Icon = getAssistantIcon(assistant.name);
            const isSaving = savingId === assistant.id;
            const assistantFeedback = feedback?.id === assistant.id ? feedback : null;
            const isPrivate = assistant.name.toLowerCase().includes('propietario');

            return (
              <div
                key={assistant.id}
                className={`bg-slate-900 border rounded-2xl p-5 text-white flex flex-col justify-between shadow-lg transition-all ${
                  isPrivate
                    ? 'border-indigo-900/60 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  {/* Header de la tarjeta */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                          isPrivate
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                            : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          {assistant.name}
                          {isPrivate && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              Exclusivo Propietario
                            </span>
                          )}
                        </h4>
                        <div className="text-[11px] text-slate-400">
                          Modelo: <code className="text-slate-300 font-mono">{assistant.model}</code>
                        </div>
                      </div>
                    </div>

                    {/* Switch de activación */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {assistant.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(assistant)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            assistant.is_active ? 'bg-emerald-600' : 'bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              assistant.is_active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      ) : (
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            assistant.is_active ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mb-4 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
                    {assistant.role_description || 'Sin descripción de rol'}
                  </p>

                  {/* Editor de System Prompt */}
                  <div className="space-y-1.5 mb-4">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Instrucciones / System Prompt</span>
                      {!isAdmin && <span className="text-[10px] text-slate-500 font-normal">Solo lectura</span>}
                    </label>

                    {isAdmin ? (
                      <textarea
                        rows={7}
                        value={editedPrompts[assistant.id] ?? assistant.system_prompt}
                        onChange={(e) =>
                          setEditedPrompts((prev) => ({ ...prev, [assistant.id]: e.target.value }))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    ) : (
                      <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-mono leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {assistant.system_prompt}
                      </div>
                    )}
                  </div>

                  {/* Feedback Message */}
                  {assistantFeedback && (
                    <div
                      className={`mb-3 p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                        assistantFeedback.type === 'success'
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                          : 'bg-rose-950/40 text-rose-300 border-rose-800/50'
                      }`}
                    >
                      {assistantFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span>{assistantFeedback.text}</span>
                    </div>
                  )}
                </div>

                {/* Botón de Guardado (Solo Admin) */}
                {isAdmin && (
                  <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSavePrompt(assistant)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-md shadow-indigo-600/20"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Guardando Prompt...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          Guardar Prompt
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
