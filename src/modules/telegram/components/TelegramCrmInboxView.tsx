'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Bot,
  User,
  ShieldAlert,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  Phone,
  Clock,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Conversation, Message, Assistant } from '@/shared/types';
import { createClient } from '@/shared/lib/supabase/client';

interface TelegramCrmInboxViewProps {
  onOpenCreateReservation?: (guestName?: string) => void;
}

export default function TelegramCrmInboxView({ onOpenCreateReservation }: TelegramCrmInboxViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'human_takeover' | 'ai_active'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Cargar lista de conversaciones y asistentes
  useEffect(() => {
    loadConversations();
    loadAssistants();

    // Polling ligero cada 6 segundos para sincronizar nuevos mensajes
    const interval = setInterval(() => {
      loadConversations(true);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  // 2. Cargar mensajes cuando cambia la conversación seleccionada
  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    } else {
      setMessages([]);
    }
  }, [selectedConvId]);

  // Scroll automático hacia el final del chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadAssistants() {
    try {
      const res = await fetch('/api/telegram/assistants');
      const data = await res.json();
      if (data.assistants) setAssistants(data.assistants);
    } catch (err) {
      console.error('Error cargando asistentes:', err);
    }
  }

  async function loadConversations(isSilent = false) {
    if (!isSilent) setLoadingList(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('conversations')
        .select('*, contacts(*), assistants(*)')
        .order('last_message_at', { ascending: false });

      if (data) {
        setConversations(data as any);
        if (!selectedConvId && data.length > 0) {
          setSelectedConvId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error cargando conversaciones:', err);
    } finally {
      if (!isSilent) setLoadingList(false);
    }
  }

  async function loadMessages(conversationId: string, isSilent = false) {
    if (!isSilent) setLoadingChat(true);
    try {
      const res = await fetch(`/api/telegram/messages?conversation_id=${conversationId}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    } finally {
      if (!isSilent) setLoadingChat(false);
    }
  }

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  // Filtrado de conversaciones
  const filteredConversations = conversations.filter((c) => {
    const contactName = c.contact?.full_name?.toLowerCase() || '';
    const username = c.contact?.username?.toLowerCase() || '';
    const extId = c.contact?.external_id || '';
    const query = searchQuery.toLowerCase();

    const matchesSearch = contactName.includes(query) || username.includes(query) || extId.includes(query);

    if (!matchesSearch) return false;
    if (filterMode === 'all') return true;
    return c.status === filterMode;
  });

  // Alternar Control Humano / IA
  async function toggleHumanTakeover() {
    if (!selectedConversation) return;
    setTogglingStatus(true);
    const newStatus = selectedConversation.status === 'ai_active' ? 'human_takeover' : 'ai_active';

    try {
      const res = await fetch('/api/telegram/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConversation.id ? { ...c, status: newStatus } : c))
        );
      }
    } catch (err) {
      console.error('Error alternando control humano:', err);
    } finally {
      setTogglingStatus(false);
    }
  }

  // Cambiar asistente asignado
  async function handleChangeAssistant(newAssistantId: string) {
    if (!selectedConversation) return;

    try {
      const res = await fetch('/api/telegram/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          assistant_id: newAssistantId,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        loadConversations(true);
      }
    } catch (err) {
      console.error('Error cambiando asistente:', err);
    }
  }

  // Enviar mensaje humano a Telegram
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || !selectedConversation) return;

    setSendingMsg(true);
    const textToSend = inputText.trim();
    setInputText('');

    try {
      const res = await fetch('/api/telegram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          content: textToSend,
        }),
      });

      const data = await res.json();
      if (data.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        // Si estaba en ai_active, ahora pasa a human_takeover
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? {
                  ...c,
                  status: 'human_takeover',
                  last_message_preview: textToSend.slice(0, 150),
                  last_message_at: new Date().toISOString(),
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Error al enviar mensaje a Telegram:', err);
      setInputText(textToSend); // restaurar si falló
    } finally {
      setSendingMsg(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[750px]">
      {/* 1. Panel Lateral Izquierdo: Lista de Chats */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-slate-950/60">
        {/* Encabezado Lista */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold text-slate-100 text-sm">Bandeja de Conversaciones</h3>
            </div>
            <button
              onClick={() => loadConversations()}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Refrescar chats"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nombre, usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({conversations.length})
            </button>
            <button
              onClick={() => setFilterMode('human_takeover')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                filterMode === 'human_takeover'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-amber-400 hover:text-amber-300'
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              Control Humano
            </button>
            <button
              onClick={() => setFilterMode('ai_active')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                filterMode === 'ai_active'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <Bot className="w-3 h-3" />
              IA Activa
            </button>
          </div>
        </div>

        {/* Lista de Conversaciones con Scroll */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {loadingList && conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">Cargando conversaciones...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {searchQuery ? 'No se encontraron conversaciones con esa búsqueda.' : 'No hay conversaciones aún.'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const contactName = conv.contact?.full_name || `Huésped ${conv.contact?.external_id}`;
              const timeStr = conv.last_message_at
                ? new Date(conv.last_message_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-l-4 border-sky-500'
                      : 'hover:bg-slate-900/80 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-semibold text-xs text-slate-200 truncate">
                      {contactName}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">{timeStr}</span>
                  </div>

                  <div className="text-[11px] text-slate-400 truncate mb-2">
                    {conv.last_message_preview || 'Sin mensajes aún'}
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    {conv.status === 'human_takeover' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <ShieldAlert className="w-2.5 h-2.5" /> Control Humano
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Bot className="w-2.5 h-2.5" /> IA Respondiendo
                      </span>
                    )}

                    {conv.contact?.username && (
                      <span className="text-slate-500 truncate max-w-[100px]">
                        @{conv.contact.username}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Panel Derecho: Ventana de Chat Activo */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-slate-900/70">
          {/* Header del Chat */}
          <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300 font-bold text-sm">
                {(selectedConversation.contact?.full_name || 'H')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-100 text-sm">
                    {selectedConversation.contact?.full_name || `Huésped Telegram`}
                  </h4>
                  {selectedConversation.contact?.username && (
                    <span className="text-xs text-sky-400">@{selectedConversation.contact.username}</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                  <span>Chat ID: {selectedConversation.contact?.external_id}</span>
                  <span>•</span>
                  <span>Canal: Telegram</span>
                </div>
              </div>
            </div>

            {/* Acciones del Header: Selector Asistente y Botón Control Humano */}
            <div className="flex items-center gap-2.5">
              {/* Selector de Asistente IA */}
              <div className="flex items-center gap-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <select
                  value={selectedConversation.assistant_id || ''}
                  onChange={(e) => handleChangeAssistant(e.target.value)}
                  className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
                >
                  {assistants.map((asst) => (
                    <option key={asst.id} value={asst.id} className="bg-slate-900 text-slate-200">
                      {asst.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón de Control Humano / IA */}
              <button
                onClick={toggleHumanTakeover}
                disabled={togglingStatus}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  selectedConversation.status === 'ai_active'
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
                title={
                  selectedConversation.status === 'ai_active'
                    ? 'Pausar la IA para responder manualmente'
                    : 'Reanudar respuesta automática por IA'
                }
              >
                {selectedConversation.status === 'ai_active' ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    Pausar IA & Tomar Control
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    Reactivar Asistente IA
                  </>
                )}
              </button>

              {/* Botón Rápido Crear Reserva */}
              {onOpenCreateReservation && (
                <button
                  onClick={() =>
                    onOpenCreateReservation(
                      selectedConversation.contact?.full_name || 'Huésped Telegram'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Crear Reserva
                </button>
              )}
            </div>
          </div>

          {/* Banner de Estado de Control */}
          {selectedConversation.status === 'human_takeover' && (
            <div className="bg-amber-950/30 border-b border-amber-800/40 px-4 py-2 text-xs text-amber-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Atención manual activa: El asistente de IA no responderá. Los mensajes que envíes irán directo al Telegram del huésped.
              </span>
              <button
                onClick={toggleHumanTakeover}
                className="underline hover:text-white font-semibold text-[11px]"
              >
                Reactivar IA ahora
              </button>
            </div>
          )}

          {/* Área de Mensajes con Scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingChat ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Cargando historial de chat...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-600" />
                <span>No hay mensajes registrados en este chat.</span>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.sender_type === 'user';
                const isAssistant = msg.sender_type === 'assistant';
                const isHumanAgent = msg.sender_type === 'human_agent';
                const timeStr = new Date(msg.created_at).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                  >
                    <div className="text-[10px] text-slate-500 mb-0.5 px-1 flex items-center gap-1">
                      {isUser && <User className="w-3 h-3 text-slate-400" />}
                      {isAssistant && <Bot className="w-3 h-3 text-emerald-400" />}
                      {isHumanAgent && <User className="w-3 h-3 text-sky-400" />}
                      <span>
                        {isUser
                          ? selectedConversation.contact?.full_name || 'Huésped'
                          : isAssistant
                          ? 'Asistente IA (Anto)'
                          : 'Recepción (Staff)'}
                      </span>
                      <span>• {timeStr}</span>
                    </div>

                    <div
                      className={`max-w-[85%] md:max-w-[70%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                        isUser
                          ? 'bg-slate-800 text-slate-100 rounded-tl-xs border border-slate-700/60'
                          : isAssistant
                          ? 'bg-emerald-950/60 text-emerald-100 rounded-tr-xs border border-emerald-800/40'
                          : 'bg-sky-900/60 text-sky-100 rounded-tr-xs border border-sky-700/50'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Envío de Mensaje a Telegram */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={
                selectedConversation.status === 'human_takeover'
                  ? 'Escribe tu respuesta al huésped en Telegram...'
                  : 'Escribir respuesta (activará Control Humano automáticamente)...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={sendingMsg || !inputText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50 shrink-0"
            >
              {sendingMsg ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Enviar a Telegram
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3">
          <MessageSquare className="w-12 h-12 text-slate-700" />
          <h4 className="text-sm font-semibold text-slate-400">Selecciona una conversación</h4>
          <p className="text-xs text-slate-500 max-w-sm">
            Elige un chat del panel izquierdo para leer mensajes, enviar respuestas directas o gestionar el control humano.
          </p>
        </div>
      )}
    </div>
  );
}
