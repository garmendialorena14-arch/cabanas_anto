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
  ShieldCheck,
} from 'lucide-react';
import { Conversation, Message, Assistant, Cabin } from '@/shared/types';
import { createClient } from '@/shared/lib/supabase/client';

interface TelegramCrmInboxViewProps {
  onOpenCreateReservation?: (guestName?: string) => void;
  onReservationCreated?: () => void;
}

export default function TelegramCrmInboxView({ onOpenCreateReservation, onReservationCreated }: TelegramCrmInboxViewProps) {
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
  const [approvingDni, setApprovingDni] = useState(false);
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
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [occupiedCabinIds, setOccupiedCabinIds] = useState<string[]>([]);
  const [occupiedDetails, setOccupiedDetails] = useState<Record<string, any[]>>({});
  const [hasAvailability, setHasAvailability] = useState(true);
  const [availabilityReason, setAvailabilityReason] = useState<string | null>(null);

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
      if (!conv) return;

      const supabase = createClient();

      // 1. Buscar por contact_id directo de la conversación
      if (conv.contact_id) {
        const { data: byContact } = await supabase
          .from('reservations')
          .select('*, cabins(*)')
          .eq('contact_id', conv.contact_id)
          .in('status', ['senada', 'confirmada', 'checkin'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (byContact) {
          setActiveReservation(byContact);
          return;
        }
      }

      // 2. Fallback: Buscar por teléfono del contacto
      const contact = conv.contact;
      if (contact?.phone) {
        const { data: byPhone } = await supabase
          .from('reservations')
          .select('*, cabins(*)')
          .eq('guest_phone', contact.phone)
          .in('status', ['senada', 'confirmada', 'checkin'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (byPhone) {
          setActiveReservation(byPhone);
          return;
        }
      }

      setActiveReservation(null);
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

  // Dynamic availability checker whenever dates, guest count, or mobility change in the modal
  useEffect(() => {
    if (!showConfirmModal || !bookingCheckIn || !bookingCheckOut) return;

    let isMounted = true;
    const fetchAvail = async () => {
      setCheckingAvailability(true);
      try {
        const res = await fetch(
          `/api/cabins/availability?check_in=${bookingCheckIn}&check_out=${bookingCheckOut}&guest_count=${bookingGuestCount}&has_reduced_mobility=${bookingHasReducedMobility}&preferred_cabin_id=${bookingCabinId}`
        );
        const data = await res.json();
        if (isMounted && data.ok) {
          setOccupiedCabinIds(data.occupiedCabinIds || []);
          setOccupiedDetails(data.occupiedDetails || {});
          setHasAvailability(Boolean(data.hasAvailability));
          setAvailabilityReason(data.reason || null);

          // Si la cabaña seleccionada está ocupada o no es apta, seleccionar la mejor cabaña libre
          if (data.bestCabin) {
            if (!bookingCabinId || (data.occupiedCabinIds || []).includes(bookingCabinId)) {
              setBookingCabinId(data.bestCabin.id);
              const inD = new Date(bookingCheckIn);
              const outD = new Date(bookingCheckOut);
              const nights = Math.max(1, Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24)));
              const total = Number(data.bestCabin.base_rate_usd) * nights;
              setBookingTotalUsd(total);
              setBookingSenaUsd(Math.round(total * 0.3));
            }
          } else if (!data.hasAvailability) {
            setBookingCabinId('');
          }
        }
      } catch (err) {
        console.warn('Error verificando disponibilidad en vivo:', err);
      } finally {
        if (isMounted) setCheckingAvailability(false);
      }
    };

    fetchAvail();

    return () => {
      isMounted = false;
    };
  }, [showConfirmModal, bookingCheckIn, bookingCheckOut, bookingGuestCount, bookingHasReducedMobility]);

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
    setOccupiedCabinIds([]);
    setOccupiedDetails({});
    setHasAvailability(true);
    setAvailabilityReason(null);

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

        if (data.availability) {
          setOccupiedCabinIds(data.availability.occupiedCabinIds || []);
          setOccupiedDetails(data.availability.occupiedDetails || {});
          setHasAvailability(Boolean(data.availability.hasAvailability));
          setAvailabilityReason(data.availability.reason || null);
        }
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

    if (occupiedCabinIds.includes(bookingCabinId)) {
      const occ = occupiedDetails[bookingCabinId]?.[0];
      const who = occ ? `"${occ.guest_name}" (${occ.check_in_date} al ${occ.check_out_date})` : 'otra reserva activa';
      alert(`⚠️ Conflicto de Superposición: Esta cabaña ya está ocupada por ${who}. Por favor selecciona una cabaña libre.`);
      return;
    }

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
          guest_name: (bookingGuestName || '').trim() || 'Huésped Telegram',
          guest_phone: (bookingGuestPhone || '').trim() || 'N/A',
          guest_dni: (bookingGuestDni || '').trim() || 'N/A',
          guest_count: bookingGuestCount,
          total_usd: bookingTotalUsd,
          sena_usd: bookingSenaUsd,
          vehicle_license_plate: bookingLicensePlate ? bookingLicensePlate.trim().toUpperCase() : null,
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
      onReservationCreated?.();
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
        if (data.conflict) {
          alert(`⚠️ No se pudo asignar automáticamente: ${data.error}\n\nSe abrirá la ventana para que puedas revisar las fechas y elegir una cabaña libre.`);
          handleOpenBookingModal();
          return;
        }
        throw new Error(data.error || 'No se pudo crear la reserva automática.');
      }

      setToastMessage(`🎉 ¡Reserva #${data.reservationCode} creada automáticamente y confirmada al cliente por Telegram!`);
      setTimeout(() => setToastMessage(null), 8000);

      loadMessages(selectedConversation.id, true);
      loadActiveReservation();
      loadConversations(true);
      onReservationCreated?.();
    } catch (err: any) {
      console.error('Error en creación automática:', err);
      alert(err.message || 'Error al crear la reserva automática.');
    } finally {
      setConfirmingAuto(false);
    }
  }

  // Aprobar y Dar OK a la Documentación (DNI) de la Reserva Activa
  async function handleApproveDniDocument() {
    if (!activeReservation || !selectedConversation) return;

    setApprovingDni(true);
    try {
      const reservationCode = 'ANTO-' + activeReservation.id.slice(0, 8).toUpperCase();
      const cabinNum = activeReservation.cabins?.cabin_number || 'asignada';
      const approvalText = `🪪 <b>¡Documentación recibida y verificada con éxito!</b>\n\nHemos registrado las fotos de tu DNI / Pasaporte para tu estadía en <b>Cabaña ${cabinNum}</b> (Reserva <code>#${reservationCode}</code>).\n\nTu ficha de registro está 100% completa. ¡Te esperamos en Mar Azul para disfrutar de una excelente estadía! 🌲🌊`;

      // Enviar mensaje al huésped por Telegram
      const res = await fetch('/api/telegram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          content: approvalText,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al validar documentación');
      }

      // Registrar nota en la reserva
      const supabase = createClient();
      await supabase
        .from('reservations')
        .update({
          internal_notes: `${activeReservation.internal_notes || ''} | DNI verificado por recepción`.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeReservation.id);

      setToastMessage(`✓ ¡Documentación de identidad aprobada para la Reserva #${reservationCode}!`);
      setTimeout(() => setToastMessage(null), 8000);

      loadMessages(selectedConversation.id, true);
      loadActiveReservation();
    } catch (err: any) {
      console.error('Error al aprobar DNI:', err);
      alert(err.message || 'Error al aprobar documento.');
    } finally {
      setApprovingDni(false);
    }
  }

  // Renderizador de Contenido de Mensajes (Soporte de Fotos de Comprobante / DNI + IA Visión)
  function renderMessageContent(content: string, msg?: any) {
    const mediaRegex = /\[MEDIA_ATTACHMENT:file_id=([^&\]]+)&type=([^&\]]+)(?:&name=([^\]]+))?\]/g;
    const match = mediaRegex.exec(content);

    if (!match) {
      return <span>{content}</span>;
    }

    const fileId = match[1];
    const fileType = match[2];
    const fileName = match[3] ? decodeURIComponent(match[3]) : 'Archivo adjunto';
    const textWithoutMedia = content.replace(mediaRegex, '').trim();
    const aiEval = msg?.payload?.ai_evaluation;

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

            {/* Tarjeta de Pre-análisis Inteligente de la IA (Visión Multimodal) */}
            {aiEval && (
              <div
                className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                  aiEval.es_valido
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-100'
                    : aiEval.tipo_detectado === 'otro'
                    ? 'bg-rose-950/50 border-rose-500/40 text-rose-100'
                    : 'bg-amber-950/50 border-amber-500/40 text-amber-100'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    {aiEval.tipo_detectado === 'dni_o_pasaporte'
                      ? 'Pre-evaluación IA: DNI / Documento'
                      : aiEval.tipo_detectado === 'comprobante_transferencia'
                      ? 'Pre-evaluación IA: Comprobante de Pago'
                      : 'Pre-evaluación IA: Imagen No Correspondiente'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold border ${
                      aiEval.es_valido
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : aiEval.tipo_detectado === 'otro'
                        ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                        : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    {aiEval.es_valido ? '✓ Validado por IA' : '⚠️ Requiere Atención'}
                  </span>
                </div>

                <p className="text-[11px] leading-tight text-slate-200">
                  {aiEval.motivo}
                </p>

                {aiEval.datos_extraidos?.dni_numero && (
                  <div className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-emerald-300">
                    🪪 <b>DNI detectado:</b> {aiEval.datos_extraidos.dni_numero}
                    {aiEval.datos_extraidos.nombre_apellido ? ` • ${aiEval.datos_extraidos.nombre_apellido}` : ''}
                  </div>
                )}

                {aiEval.datos_extraidos?.monto_ars && (
                  <div className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-emerald-300">
                    💰 <b>Monto seña:</b> ${Number(aiEval.datos_extraidos.monto_ars).toLocaleString('es-AR')} ARS
                    {aiEval.datos_extraidos.destinatario_coincide !== null && (
                      <span className={aiEval.datos_extraidos.destinatario_coincide ? ' text-emerald-400 ml-1.5 font-bold' : ' text-rose-400 ml-1.5 font-bold'}>
                        ({aiEval.datos_extraidos.destinatario_coincide ? '✓ Destinatario: Cabañas Anto' : '⚠️ Destinatario no coincide'})
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-0.5">
                  <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" />
                  <span>Protegido por Ley 25.326 de Protección de Datos Personales (Uso exclusivo: check-in).</span>
                </div>
              </div>
            )}

            {/* Acciones al lado/debajo de la foto (Validación Humana Final) */}
            {!activeReservation ? (
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
                      <span>Validar y Confirmar Seña</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-700/80 space-y-1.5 mt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-sky-300 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-sky-400" /> DNI / Documentación de Huésped
                  </span>
                  <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                    Reserva #{activeReservation.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApproveDniDocument();
                  }}
                  disabled={approvingDni}
                  className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all border border-sky-400/30 disabled:opacity-50"
                  title="Validar el documento de identidad recibido e informar al huésped sin crear otra reserva"
                >
                  {approvingDni ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Aprobando DNI...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-200" />
                      <span>Aprobar DNI y Dar OK al Huésped</span>
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
              {/* Botón Principal o Badge de Reserva Activa */}
              {activeReservation ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-xs" title="Este chat ya tiene una reserva formal confirmada en el sistema">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reserva #{activeReservation.id.slice(0, 8).toUpperCase()} (Cabaña {activeReservation.cabins?.cabin_number || '8'})</span>
                </div>
              ) : (
                <button
                  onClick={handleOpenBookingModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-all border border-emerald-500/30"
                  title="Confirmar seña y emitir Nº de Reserva al huésped"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirmar Seña y Crear Reserva
                </button>
              )}

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
                      {renderMessageContent(msg.content, msg)}
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

              {/* Fila 3: Cabaña asignada y Verificación de Disponibilidad en Vivo */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-400">
                    Cabaña Asignada (Cochera cubierta asociada) *
                  </label>
                  {checkingAvailability && (
                    <span className="text-[10px] text-sky-400 flex items-center gap-1 font-medium">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Verificando disponibilidad...
                    </span>
                  )}
                </div>

                {!hasAvailability && (
                  <div className="mb-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Sin disponibilidad para estas fechas</p>
                      <p className="text-[11px] text-rose-200/90 mt-0.5">
                        {availabilityReason || 'No hay cabañas desocupadas con los requisitos solicitados para este período.'}
                      </p>
                    </div>
                  </div>
                )}

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
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none ${
                    occupiedCabinIds.includes(bookingCabinId)
                      ? 'border-rose-500 text-rose-200'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
                >
                  <option value="" disabled>-- Selecciona una cabaña disponible --</option>
                  {cabins.map((c) => {
                    const isOccupied = occupiedCabinIds.includes(c.id);
                    const occInfo = occupiedDetails[c.id]?.[0];
                    const isMobilityMismatched = bookingHasReducedMobility && !c.has_accessible_mobility;
                    const isCapacityTooSmall = c.max_guests < bookingGuestCount;

                    let statusBadge = '';
                    if (isOccupied) {
                      statusBadge = ` 🚫 [OCUPADA: ${occInfo?.guest_name || 'Reservada'} (${occInfo?.check_in_date || ''} al ${occInfo?.check_out_date || ''})]`;
                    } else if (isMobilityMismatched) {
                      statusBadge = ` ⚠️ [No accesible - Planta Alta]`;
                    } else if (isCapacityTooSmall) {
                      statusBadge = ` ⚠️ [Capacidad máx ${c.max_guests} pax]`;
                    } else {
                      statusBadge = ` ✓ [LIBRE]`;
                    }

                    return (
                      <option
                        key={c.id}
                        value={c.id}
                        disabled={isOccupied || (bookingHasReducedMobility && isMobilityMismatched)}
                        className={isOccupied ? 'text-rose-400 bg-slate-900 font-medium' : 'text-slate-100'}
                      >
                        Cabaña {c.cabin_number}: {c.name} ({c.floor}) — Base USD ${c.base_rate_usd}/noche{statusBadge}
                      </option>
                    );
                  })}
                </select>

                {occupiedCabinIds.includes(bookingCabinId) && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Esta cabaña está ocupada para esas fechas. Por favor elige una de las opciones con marca ✓ [LIBRE].
                  </p>
                )}
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
                  disabled={
                    creatingBooking ||
                    extractingData ||
                    checkingAvailability ||
                    !bookingCabinId ||
                    !hasAvailability ||
                    occupiedCabinIds.includes(bookingCabinId)
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
