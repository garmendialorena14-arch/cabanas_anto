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
  Calendar,
  Sparkles,
  Phone,
  Clock,
  Car,
  Receipt,
  Maximize2,
  X,
  ExternalLink,
  FileText,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Conversation, Message, Assistant, Cabin } from '@/shared/types';
import { createClient } from '@/shared/lib/supabase/client';

interface TelegramCrmInboxViewProps {
  onOpenCreateReservation?: (guestName?: string) => void;
}

export default function TelegramCrmInboxView({ onOpenCreateReservation }: TelegramCrmInboxViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [cabins, setCabins] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'human_takeover' | 'ai_active'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para comprobantes y visualización Lightbox
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Estados para confirmación rápida de reserva
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [confirmingAuto, setConfirmingAuto] = useState(false);
  const [activeReservation, setActiveReservation] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Formulario de Reserva Rápida
  const [bookingGuestName, setBookingGuestName] = useState('');
  const [bookingGuestPhone, setBookingGuestPhone] = useState('');
  const [bookingGuestDni, setBookingGuestDni] = useState('');
  const [bookingCheckIn, setBookingCheckIn] = useState('');
  const [bookingCheckOut, setBookingCheckOut] = useState('');
  const [bookingGuestCount, setBookingGuestCount] = useState(2);
  const [bookingCabinId, setBookingCabinId] = useState('');
  const [bookingTotalUsd, setBookingTotalUsd] = useState(0);
  const [bookingSenaUsd, setBookingSenaUsd] = useState(0);
  const [bookingLicensePlate, setBookingLicensePlate] = useState('');
  const [bookingHasSinTacc, setBookingHasSinTacc] = useState(false);
  const [bookingHasReducedMobility, setBookingHasReducedMobility] = useState(false);
  const [bookingMissingFields, setBookingMissingFields] = useState<string[]>([]);
  const [extractingData, setExtractingData] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Cargar lista de conversaciones, asistentes y cabañas
  useEffect(() => {
    loadConversations();
    loadAssistants();
    loadCabins();

    // Polling ligero cada 6 segundos para sincronizar nuevos mensajes
    const interval = setInterval(() => {
      loadConversations(true);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  // 2. Cargar mensajes y reserva activa cuando cambia la conversación seleccionada
  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
      loadActiveReservation();
    } else {
      setMessages([]);
      setActiveReservation(null);
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

  async function loadCabins() {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('cabins').select('*').order('cabin_number');
      if (data) setCabins(data);
    } catch (err) {
      console.error('Error cargando cabañas:', err);
    }
  }

  async function loadConversations(isSilent = false) {
    if (!isSilent) setLoadingList(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('conversations')
        .select('*, contacts(*), assistants(*)')
        .order('last_message_at', { ascending: false });

      if (data) {
        const normalized = data.map((item: any) => ({
          ...item,
          contact: item.contacts || item.contact,
          assistant: item.assistants || item.assistant,
        }));
        setConversations(normalized);
        if (!selectedConvId && normalized.length > 0) {
          setSelectedConvId(normalized[0].id);
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

  async function loadActiveReservation() {
    try {
      const conv = conversations.find((c) => c.id === selectedConvId);
      if (!conv?.contact) return;

      const supabase = createClient();
      let query = supabase
        .from('reservations')
        .select('*, cabins(*)')
        .in('status', ['senada', 'confirmada', 'checkin'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (conv.contact.phone) {
        query = query.eq('guest_phone', conv.contact.phone);
      } else if (conv.contact.full_name) {
        query = query.ilike('guest_name', `%${conv.contact.full_name}%`);
      }

      const { data } = await query.maybeSingle();
      setActiveReservation(data || null);
    } catch (err) {
      console.warn('Error al verificar reserva activa:', err);
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

  // Enviar mensaje manual a Telegram
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
      setInputText(textToSend);
    } finally {
      setSendingMsg(false);
    }
  }

  // Abrir Modal de Confirmación y Extraer Datos de la Conversación con IA
  async function handleOpenBookingModal() {
    if (!selectedConversation) return;

    setShowConfirmModal(true);
    setExtractingData(true);

    // Valores iniciales de fallback rápido mientras responde la IA
    const contact = selectedConversation.contact;
    const initialName = contact?.full_name && !contact.full_name.startsWith('Huésped ') ? contact.full_name : '';
    setBookingGuestName(initialName);
    setBookingGuestPhone(contact?.phone || '');
    setBookingGuestDni('');
    setBookingGuestCount(2);
    setBookingLicensePlate('');
    setBookingHasSinTacc(false);
    setBookingHasReducedMobility(false);
    setBookingMissingFields([]);

    const now = new Date();
    const defaultIn = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultOut = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setBookingCheckIn(defaultIn);
    setBookingCheckOut(defaultOut);

    const defaultCabin = cabins[0];
    if (defaultCabin) {
      setBookingCabinId(defaultCabin.id);
      const total = Number(defaultCabin.base_rate_usd) * 3;
      setBookingTotalUsd(total);
      setBookingSenaUsd(Math.round(total * 0.3));
    }

    // Extracción inteligente de todos los campos con Gemini AI
    await fetchAiExtraction(selectedConversation.id);
  }

  // Re-extraer datos del chat con IA
  async function handleReExtractWithAi() {
    if (!selectedConversation) return;
    setExtractingData(true);
    await fetchAiExtraction(selectedConversation.id);
  }

  // Llamada al endpoint de extracción inteligente
  async function fetchAiExtraction(convId: string) {
    try {
      const res = await fetch(`/api/telegram/bookings/extract?conversation_id=${convId}`);
      const data = await res.json();
      if (data.ok && data.extracted) {
        const ext = data.extracted;
        if (ext.guest_name) setBookingGuestName(ext.guest_name);
        if (ext.guest_phone) setBookingGuestPhone(ext.guest_phone);
        if (ext.guest_dni) setBookingGuestDni(ext.guest_dni);
        if (ext.check_in_date) setBookingCheckIn(ext.check_in_date);
        if (ext.check_out_date) setBookingCheckOut(ext.check_out_date);
        if (ext.guest_count) setBookingGuestCount(ext.guest_count);
        if (ext.cabin_id) setBookingCabinId(ext.cabin_id);
        if (ext.total_usd) setBookingTotalUsd(ext.total_usd);
        if (ext.sena_usd) setBookingSenaUsd(ext.sena_usd);
        if (ext.vehicle_license_plate) setBookingLicensePlate(ext.vehicle_license_plate);
        if (ext.has_celiac_sin_tacc !== undefined) setBookingHasSinTacc(ext.has_celiac_sin_tacc);
        if (ext.has_reduced_mobility !== undefined) setBookingHasReducedMobility(ext.has_reduced_mobility);
        if (ext.missing_fields) setBookingMissingFields(ext.missing_fields);
      }
    } catch (err) {
      console.warn('Error al extraer datos con IA:', err);
    } finally {
      setExtractingData(false);
    }
  }

  // Confirmar y Crear Reserva en el Panel + Notificar en Telegram
  async function handleConfirmAndCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConversation || !bookingCabinId) return;

    setCreatingBooking(true);
    try {
      const res = await fetch('/api/telegram/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          contact_id: selectedConversation.contact_id,
          cabin_id: bookingCabinId,
          check_in_date: bookingCheckIn,
          check_out_date: bookingCheckOut,
          guest_name: bookingGuestName,
          guest_phone: bookingGuestPhone,
          guest_dni: bookingGuestDni,
          guest_count: bookingGuestCount,
          total_usd: bookingTotalUsd,
          sena_usd: bookingSenaUsd,
          vehicle_license_plate: bookingLicensePlate || null,
          has_celiac_sin_tacc: bookingHasSinTacc,
          has_reduced_mobility: bookingHasReducedMobility,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'No se pudo crear la reserva.');
      }

      setShowConfirmModal(false);
      setToastMessage(`¡Reserva #${data.reservationCode} creada exitosamente y notificada por Telegram!`);
      setTimeout(() => setToastMessage(null), 8000);

      // Recargar mensajes y estado
      loadMessages(selectedConversation.id, true);
      loadActiveReservation();
      loadConversations(true);
    } catch (err: any) {
      console.error('Error creando reserva automática:', err);
      alert(err.message || 'Error al crear la reserva.');
    } finally {
      setCreatingBooking(false);
    }
  }

  // Creación 100% Automática vía IA desde el Comprobante (1 Clic)
  async function handleAutoConfirmBooking() {
    if (!selectedConversation) return;
    setConfirmingAuto(true);
    try {
      const res = await fetch('/api/telegram/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          auto_create: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'No se pudo crear la reserva automática.');
      }

      setToastMessage(`🎉 ¡Reserva #${data.reservationCode} creada automáticamente y confirmada al cliente por Telegram!`);
      setTimeout(() => setToastMessage(null), 8000);

      loadMessages(selectedConversation.id, true);
      loadActiveReservation();
      loadConversations(true);
    } catch (err: any) {
      console.error('Error en creación automática:', err);
      alert(err.message || 'Error al crear la reserva automática.');
    } finally {
      setConfirmingAuto(false);
    }
  }

  // Renderizador de Contenido de Mensajes (Soporte de Fotos de Comprobante / DNI)
  function renderMessageContent(content: string) {
    const mediaRegex = /\[MEDIA_ATTACHMENT:file_id=([^&\]]+)&type=([^&\]]+)(?:&name=([^\]]+))?\]/g;
    const match = mediaRegex.exec(content);

    if (!match) {
      return <span>{content}</span>;
    }

    const fileId = match[1];
    const fileType = match[2];
    const fileName = match[3] ? decodeURIComponent(match[3]) : 'Archivo adjunto';
    const textWithoutMedia = content.replace(mediaRegex, '').trim();

    return (
      <div className="space-y-2">
        {textWithoutMedia && <p>{textWithoutMedia}</p>}
        {fileType === 'photo' ? (
          <div className="space-y-2 max-w-sm">
            <div
              onClick={() => setPreviewImageUrl(`/api/telegram/file?file_id=${fileId}`)}
              className="group relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950/70 cursor-pointer hover:border-sky-500 transition-all shadow-md"
            >
              <img
                src={`/api/telegram/file?file_id=${fileId}`}
                alt="Comprobante / Documentación adjunta"
                className="w-full max-h-56 object-contain bg-slate-950/90 group-hover:scale-102 transition-transform"
                loading="lazy"
              />
              <div className="p-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <Receipt className="w-3.5 h-3.5" /> Comprobante / Foto Adjunta
                </span>
                <span className="text-[10px] text-sky-400 group-hover:underline flex items-center gap-1">
                  <Maximize2 className="w-3 h-3" /> Ver en Grande
                </span>
              </div>
            </div>

            {/* Acciones al lado/debajo de la foto para confirmar seña */}
            {!activeReservation && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenBookingModal();
                  }}
                  className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-700 hover:border-slate-500 shadow-sm"
                  title="Abrir ventana para revisar y editar los datos extraídos por IA antes de confirmar"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>Revisar en Ventana</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAutoConfirmBooking();
                  }}
                  disabled={confirmingAuto}
                  className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all border border-emerald-400/30 disabled:opacity-50"
                  title="Confirmar seña directamente en 1 clic: la IA extrae los datos y emite el Nº de reserva al huésped"
                >
                  {confirmingAuto ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Confirmar (1 Clic)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <a
            href={`/api/telegram/file?file_id=${fileId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs text-sky-300 font-medium transition-colors"
          >
            <FileText className="w-4 h-4 text-sky-400" />
            <span className="truncate max-w-[200px]">{fileName}</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[750px] relative">
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
                <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                  {selectedConversation.contact?.phone ? (
                    <a
                      href={`tel:${selectedConversation.contact.phone}`}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 transition-colors"
                      title="Llamada telefónica directa"
                    >
                      <Phone className="w-3 h-3 text-emerald-400" />
                      {selectedConversation.contact.phone}
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-slate-600" /> Sin teléfono registrado
                    </span>
                  )}
                  <span>•</span>
                  <span>Chat ID: {selectedConversation.contact?.external_id}</span>
                </div>
              </div>
            </div>

            {/* Acciones de Cabecera: Confirmar Seña / Selector Asistente / Control Humano */}
            <div className="flex items-center gap-2">
              {/* Botón Principal: Confirmar Seña y Crear Reserva */}
              <button
                onClick={handleOpenBookingModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-all border border-emerald-500/30"
                title="Confirmar seña y emitir Nº de Reserva al huésped"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmar Seña y Crear Reserva
              </button>

              {/* Botón de Control Humano / IA */}
              <button
                onClick={toggleHumanTakeover}
                disabled={togglingStatus}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
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
                    Pausar IA
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    Reactivar IA
                  </>
                )}
              </button>

              {/* Selector de Asistente IA */}
              <div className="hidden lg:flex items-center gap-1 text-xs bg-slate-950 border border-slate-800 rounded-xl px-2 py-1">
                <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                <select
                  value={selectedConversation.assistant_id || ''}
                  onChange={(e) => handleChangeAssistant(e.target.value)}
                  className="bg-transparent text-slate-300 text-[11px] focus:outline-none cursor-pointer"
                >
                  {assistants.map((asst) => (
                    <option key={asst.id} value={asst.id} className="bg-slate-900 text-slate-200">
                      {asst.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón Alternativo Carga Manual */}
              {onOpenCreateReservation && (
                <button
                  onClick={() =>
                    onOpenCreateReservation(
                      selectedConversation.contact?.full_name || 'Huésped Telegram'
                    )
                  }
                  className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                  title="Carga manual tradicional"
                >
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Manual
                </button>
              )}
            </div>
          </div>

          {/* Banner de Reserva Activa */}
          {activeReservation && (
            <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-4 py-2 text-xs text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Reserva Activa: <b>#ANTO-{activeReservation.id.slice(0, 8).toUpperCase()}</b> • Cabaña{' '}
                  {activeReservation.cabins?.cabin_number || '?'} • {activeReservation.check_in_date} al{' '}
                  {activeReservation.check_out_date} ({activeReservation.total_nights} noches) • Seña:{' '}
                  <b>USD ${activeReservation.sena_paid_usd_equiv || activeReservation.sena_usd_required}</b>
                </span>
                {activeReservation.vehicle_license_plate ? (
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[10px] flex items-center gap-1">
                    <Car className="w-3 h-3 text-sky-400" /> Patente: {activeReservation.vehicle_license_plate}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px]">
                    ⚠️ Patente pendiente
                  </span>
                )}
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Seña Confirmada
              </span>
            </div>
          )}

          {/* Banner de Estado de Control Humano */}
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

          {/* Toast de Confirmación Exitosa */}
          {toastMessage && (
            <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-lg">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {toastMessage}
              </span>
              <button onClick={() => setToastMessage(null)} className="text-white hover:text-slate-200">
                <X className="w-4 h-4" />
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
                      {renderMessageContent(msg.content)}
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
                  : 'Escribir respuesta manual (activará Control Humano)...'
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
            Elige un chat del panel izquierdo para leer mensajes, revisar comprobantes, confirmar señas y gestionar reservas.
          </p>
        </div>
      )}

      {/* 3. Modal Lightbox de Comprobantes e Imágenes en Pantalla Completa */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 flex items-center gap-1.5 text-xs font-semibold bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700"
            >
              <X className="w-4 h-4" /> Cerrar
            </button>
            <img
              src={previewImageUrl}
              alt="Detalle Comprobante de Pago"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-slate-700"
            />
            <div className="mt-3 flex items-center gap-3">
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white border border-slate-600 flex items-center gap-1.5 font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir imagen original
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal de Creación Automática de Reserva desde Chat */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal con indicador de extracción IA */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    Confirmar Seña y Crear Reserva Oficial
                    {extractingData && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-normal text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
                        <Sparkles className="w-3 h-3 text-amber-400" /> Analizando chat con IA...
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Datos sincronizados desde la conversación. Revisa o completa antes de emitir la reserva formal.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleReExtractWithAi}
                  disabled={extractingData}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-sky-300 border border-slate-700 flex items-center gap-1 font-semibold transition-colors disabled:opacity-50"
                  title="Volver a analizar la conversación con Gemini para detectar nuevos datos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${extractingData ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Re-extraer</span>
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Checklist: Control de Datos Obligatorios */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-400" /> Control de Datos Obligatorios:
                </span>
                {bookingMissingFields.length === 0 && bookingGuestName && bookingGuestDni && bookingGuestPhone ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ficha completa para ingreso
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" /> Faltan datos (puedes completarlos abajo)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className={`px-2 py-0.5 rounded-md border font-medium ${bookingGuestName && !bookingGuestName.startsWith('Huésped') ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'}`}>
                  {bookingGuestName && !bookingGuestName.startsWith('Huésped') ? `✓ Titular: ${bookingGuestName}` : '✗ Falta Titular'}
                </span>
                <span className={`px-2 py-0.5 rounded-md border font-medium ${bookingGuestDni ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'}`}>
                  {bookingGuestDni ? `✓ DNI: ${bookingGuestDni}` : '✗ Falta DNI / Pasaporte'}
                </span>
                <span className={`px-2 py-0.5 rounded-md border font-medium ${bookingGuestPhone && bookingGuestPhone !== 'N/A' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'}`}>
                  {bookingGuestPhone && bookingGuestPhone !== 'N/A' ? `✓ Tel: ${bookingGuestPhone}` : '✗ Falta Teléfono'}
                </span>
                <span className={`px-2 py-0.5 rounded-md border font-medium ${bookingLicensePlate ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'}`}>
                  {bookingLicensePlate ? `✓ Patente: ${bookingLicensePlate}` : '⚠️ Patente pendiente'}
                </span>
                <span className={`px-2 py-0.5 rounded-md border font-medium ${bookingHasSinTacc ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {bookingHasSinTacc ? '🌾 Desayuno Sin TACC' : 'Desayuno Tradicional'}
                </span>
                <span className={`px-2 py-0.5 rounded-md border font-medium ${bookingHasReducedMobility ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {bookingHasReducedMobility ? '♿ Cabaña en Planta Baja' : 'Sin movilidad reducida'}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmAndCreateBooking} className="space-y-3.5">
              {/* Fila 1: Titular, Teléfono y DNI */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Titular de la Reserva *
                  </label>
                  <input
                    type="text"
                    value={bookingGuestName}
                    onChange={(e) => setBookingGuestName(e.target.value)}
                    required
                    placeholder="Nombre y Apellido"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Teléfono Celular *
                  </label>
                  <input
                    type="text"
                    value={bookingGuestPhone}
                    onChange={(e) => setBookingGuestPhone(e.target.value)}
                    placeholder="Ej: 11-4455-6677"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    DNI / Pasaporte
                  </label>
                  <input
                    type="text"
                    value={bookingGuestDni}
                    onChange={(e) => setBookingGuestDni(e.target.value)}
                    placeholder="Ej: 32.145.890"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Fila 2: Fechas y Cantidad de Personas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Check-in *
                  </label>
                  <input
                    type="date"
                    value={bookingCheckIn}
                    onChange={(e) => setBookingCheckIn(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Check-out *
                  </label>
                  <input
                    type="date"
                    value={bookingCheckOut}
                    onChange={(e) => setBookingCheckOut(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Personas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={bookingGuestCount}
                    onChange={(e) => setBookingGuestCount(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Fila 3: Cabaña asignada */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Cabaña Asignada (Cochera cubierta asociada) *
                </label>
                <select
                  value={bookingCabinId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setBookingCabinId(cId);
                    const selCabin = cabins.find((c) => c.id === cId);
                    if (selCabin && bookingCheckIn && bookingCheckOut) {
                      const inD = new Date(bookingCheckIn);
                      const outD = new Date(bookingCheckOut);
                      const nights = Math.max(1, Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24)));
                      const total = Number(selCabin.base_rate_usd) * nights;
                      setBookingTotalUsd(total);
                      setBookingSenaUsd(Math.round(total * 0.3));
                    }
                  }}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {cabins.map((c) => (
                    <option key={c.id} value={c.id}>
                      Cabaña {c.cabin_number}: {c.name} ({c.floor}) — Base USD ${c.base_rate_usd}/noche
                      {c.has_accessible_mobility ? ' [Accesible PB]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fila 4: Total USD, Seña USD y Patente */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Total Estadía (USD) *
                  </label>
                  <input
                    type="number"
                    value={bookingTotalUsd}
                    onChange={(e) => {
                      const tot = Number(e.target.value);
                      setBookingTotalUsd(tot);
                      setBookingSenaUsd(Math.round(tot * 0.3));
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                    Seña Verificada (USD) *
                  </label>
                  <input
                    type="number"
                    value={bookingSenaUsd}
                    onChange={(e) => setBookingSenaUsd(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Patente (Cochera Cubierta)
                  </label>
                  <input
                    type="text"
                    value={bookingLicensePlate}
                    onChange={(e) => setBookingLicensePlate(e.target.value.toUpperCase())}
                    placeholder="Ej: AB 123 CD"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>
              </div>

              {/* Fila 5: Opciones Dietarias y Accesibilidad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={bookingHasSinTacc}
                    onChange={(e) => setBookingHasSinTacc(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <span>🌾 Desayuno Sin TACC para celíacos</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={bookingHasReducedMobility}
                    onChange={(e) => setBookingHasReducedMobility(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>♿ Movilidad reducida / Planta baja</span>
                </label>
              </div>

              {/* Resumen de Acciones Automáticas */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-200">
                  ℹ️ Acciones automáticas al confirmar:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Se bloquea la cabaña y cochera cubierta en el calendario oficial.</li>
                  <li>Se registra el cobro de la seña en la caja del sistema.</li>
                  <li>
                    Se envía al cliente en Telegram el <b>Nº de Reserva</b> oficial, condiciones de cancelación y solicitud de fotos de DNI.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingBooking || extractingData}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
                >
                  {creatingBooking ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirmar Seña y Emitir Reserva Oficial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
