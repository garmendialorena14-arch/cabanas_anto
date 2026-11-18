'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldCheck,
  Calendar,
  Users,
  DollarSign,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Wifi,
  Tv,
  Car,
  Coffee,
  Check,
  Loader2,
  Lock,
} from 'lucide-react';
import { calculateBookingFinancials, formatARS, formatUSD, fetchLiveBlueRate } from '@/shared/lib/bimonetary';

const SAMPLE_CABINS = [
  {
    number: 1,
    name: 'Cabaña El Roble',
    floor: 'PB',
    maxGuests: 4,
    accessible: true,
    rateUsd: 85,
    image: '/images/cabanas/Gemini_Generated_Image.jpeg',
    description: 'Planta baja adaptada con rampa, puertas ensanchadas y baño para movilidad reducida.',
    amenities: ['Accesible', 'WiFi', 'Parrilla', 'Cochera Techada'],
  },
  {
    number: 2,
    name: 'Cabaña Los Pinos',
    floor: 'PB',
    maxGuests: 4,
    accessible: true,
    rateUsd: 85,
    image: '/images/cabanas/Gemini_Generated_Image2.jpeg',
    description: 'Planta baja con acceso directo al parque arbolado y piscina climatizada.',
    amenities: ['Accesible', 'WiFi', 'Parrilla', 'Cochera Techada'],
  },
  {
    number: 5,
    name: 'Cabaña Mirador I (Familiar)',
    floor: 'PA',
    maxGuests: 6,
    accessible: false,
    rateUsd: 120,
    image: '/images/cabanas/Gemini_Generated_Image5.jpeg',
    description: 'Gran capacidad para 6 pasajeros con 2 dormitorios independientes y balcón terraza con asador.',
    amenities: ['6 Pasajeros', 'Balcón Terraza', 'Asador Privado', 'Cochera'],
  },
  {
    number: 8,
    name: 'Cabaña Alborada I',
    floor: 'PA',
    maxGuests: 4,
    accessible: false,
    rateUsd: 95,
    image: '/images/cabanas/Gemini_Generated_Image_3gyxc63gyxc63gyx.jpg',
    description: 'Planta alta con excelente iluminación natural, balcón privado y parrilla.',
    amenities: ['4 Pasajeros', 'Balcón', 'Parrilla', 'Cochera'],
  },
];

export default function PublicLandingPage() {
  const [blueRate, setBlueRate] = useState<number>(1285);
  const [selectedCabin, setSelectedCabin] = useState(SAMPLE_CABINS[0]);
  const [nights, setNights] = useState<number>(5);
  const [senaPct, setSenaPct] = useState<number>(30);
  
  // Lead form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paxCount, setPaxCount] = useState<number>(2);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reducedMobility, setReducedMobility] = useState(false);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchLiveBlueRate().then((rates) => setBlueRate(rates.sell));
  }, []);

  const financials = calculateBookingFinancials(selectedCabin.rateUsd, nights, blueRate, senaPct);

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          paxCount,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          hasReducedMobility: reducedMobility,
          notes: notes || `Interés en: ${selectedCabin.name} (${nights} noches)`,
          source: 'web',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar consulta');

      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo enviar la consulta.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Top Banner Ticker */}
      <div className="bg-stone-900 text-stone-300 text-xs py-2 px-4 border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 text-sky-400 font-semibold">
              <Send className="w-3.5 h-3.5" />
              <span>Mar Azul, Buenos Aires:</span>
            </span>
            <span className="text-stone-300 hidden md:inline">Cabañas en el bosque a pasos del mar</span>
            <span className="text-stone-600 hidden md:inline">·</span>
            <a
              href="https://t.me/CabanasAntoOficial_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 font-medium underline inline-flex items-center gap-1"
            >
              <span>Consultas 24/7 con nuestro Asistente en Telegram (@CabanasAntoOficial_bot)</span>
            </a>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-1 text-stone-400 hover:text-white transition-colors text-[11px] font-medium shrink-0 ml-2"
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span>Portal Personal / Staff</span>
          </Link>
        </div>
      </div>

      {/* Navbar */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-30 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-stone-300 shadow-md">
              <Image
                src="/images/branding/logo.jpg"
                alt="Logo Cabañas Anto"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div>
              <span className="font-serif text-xl sm:text-2xl font-bold text-forest-900 block leading-tight">
                Cabañas Anto
              </span>
              <span className="text-xs text-stone-500 font-medium">
                Complejo Turístico de Bosque y Mar · Mar Azul, Buenos Aires
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/CabanasAntoOficial_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-medium text-xs sm:text-sm transition-all"
            >
              <Send className="w-3.5 h-3.5 text-sky-600" />
              <span>Chatear en Telegram</span>
            </a>
            <a
              href="#cotizador"
              className="px-5 py-2.5 rounded-full bg-forest-800 hover:bg-forest-900 text-white font-medium text-xs sm:text-sm shadow-md transition-all"
            >
              Calcular Estadía
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-[65vh] min-h-[500px] flex items-center justify-center text-white overflow-hidden">
        <Image
          src="/images/branding/complejo-hero.jpg"
          alt="Complejo Cabañas Anto"
          fill
          className="object-cover brightness-50"
          priority
        />
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4 space-y-4">
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            Naturaleza, Bosque y Mar · Mar Azul
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold leading-tight">
            Tu refugio ideal en el bosque y mar de Mar Azul
          </h1>
          <p className="text-stone-200 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            12 cabañas totalmente equipadas, piscina climatizada, parque arbolado, cocheras cubiertas individuales y unidades 100% accesibles en planta baja.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#cabanas"
              className="px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm shadow-lg transition-all"
            >
              Ver Cabañas
            </a>
            <a
              href="#cotizador"
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur-sm text-white font-semibold text-xs sm:text-sm transition-all"
            >
              Calcular Presupuesto
            </a>
            <a
              href="https://t.me/CabanasAntoOficial_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-full bg-sky-600/90 hover:bg-sky-600 border border-sky-400/50 backdrop-blur-sm text-white font-semibold text-xs sm:text-sm shadow-lg transition-all inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Asistente en Telegram</span>
            </a>
          </div>
        </div>
      </section>

      {/* Cabins Showcase */}
      <section id="cabanas" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="font-serif text-3xl font-bold text-forest-950">
            Nuestras Cabañas
          </h2>
          <p className="text-stone-600 text-sm">
            Diseñadas tanto para familias numerosas como para parejas y personas con movilidad reducida.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SAMPLE_CABINS.map((c) => (
            <div
              key={c.number}
              onClick={() => setSelectedCabin(c)}
              className={`rounded-3xl overflow-hidden border cursor-pointer transition-all duration-300 bg-white shadow-sm hover:shadow-xl ${
                selectedCabin.number === c.number
                  ? 'border-forest-600 ring-2 ring-forest-600/30'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div className="relative h-48 w-full">
                <Image
                  src={c.image}
                  alt={c.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-bold">
                  {c.floor === 'PB' ? 'Planta Baja' : 'Planta Alta'}
                </div>
                {c.accessible && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-700 text-white text-[10px] font-bold shadow">
                    ♿ 100% Accesible
                  </div>
                )}
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-stone-900">{c.name}</h3>
                  <p className="text-xs text-stone-500 mt-1 line-clamp-2">{c.description}</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {c.amenities.map((a) => (
                    <span
                      key={a}
                      className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-medium"
                    >
                      {a}
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-500">Tarifa Base:</span>
                  <span className="font-bold text-forest-800 text-sm">{formatUSD(c.rateUsd)} / noche</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bimonetary Calculator & Booking Request */}
      <section id="cotizador" className="py-16 bg-stone-100 border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Calculator Card */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xl space-y-6">
              <div className="border-b border-stone-100 pb-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                  Tarifas y Presupuesto
                </span>
                <h3 className="font-serif text-2xl font-bold text-forest-950">
                  Calculá tu Estadía
                </h3>
                <p className="text-xs text-stone-600">
                  Aboná tu seña por transferencia bancaria en pesos o dólares y asegurá tu lugar. El saldo se cancela cómodamente al ingresar (check-in).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Cabaña Seleccionada
                  </label>
                  <select
                    value={selectedCabin.number}
                    onChange={(e) => {
                      const found = SAMPLE_CABINS.find((c) => c.number === Number(e.target.value));
                      if (found) setSelectedCabin(found);
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-stone-300 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-forest-600"
                  >
                    {SAMPLE_CABINS.map((c) => (
                      <option key={c.number} value={c.number}>
                        {c.name} ({formatUSD(c.rateUsd)}/n)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Noches de Estadía
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={nights}
                    onChange={(e) => setNights(Number(e.target.value))}
                    className="w-full py-2 px-3 rounded-xl border border-stone-300 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-forest-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Porcentaje de Seña
                  </label>
                  <select
                    value={senaPct}
                    onChange={(e) => setSenaPct(Number(e.target.value))}
                    className="w-full py-2 px-3 rounded-xl border border-stone-300 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-forest-600"
                  >
                    <option value={30}>30% de Seña</option>
                    <option value={50}>50% de Seña</option>
                  </select>
                </div>
              </div>

              {/* Breakdown */}
              <div className="p-5 rounded-2xl bg-forest-50/60 border border-forest-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs text-forest-900 pb-2 border-b border-forest-200/50">
                  <span>Total Estadía ({nights} noches):</span>
                  <div className="text-right">
                    <span className="font-bold text-base text-forest-950 block">{formatUSD(financials.totalUsd)}</span>
                    <span className="text-[11px] text-stone-500 font-mono">≈ {formatARS(financials.totalArsEstimate)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="p-3.5 rounded-xl bg-white border border-forest-200 shadow-sm space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                      Seña para Confirmar ({senaPct}%)
                    </span>
                    <span className="text-xl font-bold font-mono text-stone-900 block">
                      {formatARS(financials.senaArsRequired)}
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Abonás por transferencia bancaria y asegurás tu reserva
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-forest-200 shadow-sm space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700 block">
                      Saldo al Check-In ({100 - senaPct}%)
                    </span>
                    <span className="text-xl font-bold font-mono text-stone-900 block">
                      {formatUSD(financials.balancePendingUsd)}
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Abonás al momento del ingreso (en pesos o dólares)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inquiries / Lead Form */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xl space-y-5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">
                  Contacto Directo
                </span>
                <h3 className="font-serif text-2xl font-bold text-forest-950">
                  Solicitar Reserva
                </h3>
                <p className="text-xs text-stone-600 mt-1">
                  Completá tus datos y te enviaremos la confirmación de disponibilidad inmediata.
                </p>
              </div>

              {/* Botón rápido Telegram */}
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600 shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sky-900">¿Buscás respuesta al instante?</div>
                    <div className="text-[11px] text-sky-700">Cotizá y reservá con nuestro Bot de Telegram</div>
                  </div>
                </div>
                <a
                  href="https://t.me/CabanasAntoOficial_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm"
                >
                  Abrir Chat
                </a>
              </div>

              {submitted ? (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-300 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-serif font-bold text-emerald-950 text-lg">
                    ¡Consulta Recibida!
                  </h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Nuestro equipo de recepción revisará las fechas y te responderá a la brevedad por teléfono o email con los datos bancarios para congelar tu seña.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
                  >
                    Enviar otra consulta
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitLead} className="space-y-3.5">
                  {errorMessage && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                      Nombre y Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-1 focus:ring-forest-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                        Teléfono / Telegram *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+54 9 ... o @usuario"
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-1 focus:ring-forest-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                        Pasajeros
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={paxCount}
                        onChange={(e) => setPaxCount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-1 focus:ring-forest-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="juan@email.com"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-1 focus:ring-forest-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                        Check-In
                      </label>
                      <input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-1 focus:ring-forest-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                        Check-Out
                      </label>
                      <input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-1 focus:ring-forest-600"
                      />
                    </div>
                  </div>

                  {/* Movilidad Reducida Checkbox */}
                  <div className="p-3 rounded-xl bg-forest-50 border border-forest-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reducedMobility}
                        onChange={(e) => setReducedMobility(e.target.checked)}
                        className="rounded border-forest-300 text-forest-700 focus:ring-forest-600 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-forest-900">
                        ♿ ¿Viajan personas con movilidad reducida?
                      </span>
                    </label>
                    <p className="text-[10px] text-stone-500 mt-1 pl-6">
                      Te asignaremos prioritariamente una cabaña adaptada en Planta Baja (Cabañas 1 a 4).
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                      Consultas Adicionales / Dietas (Sin TACC)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="¿Requieren cuna o canasta de desayuno para celíacos?"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-1 focus:ring-forest-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full py-3 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-semibold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando consulta...</span>
                      </>
                    ) : (
                      <>
                        <span>Solicitar Cotización Oficial</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-12 px-4 border-t border-stone-800 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-amber-500/30">
              <Image
                src="/images/branding/logo.jpg"
                alt="Logo"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <span className="font-serif font-bold text-stone-200">Cabañas Anto</span>
              <p className="text-[11px] text-stone-400">Mar Azul, Partido de Villa Gesell, Buenos Aires, Argentina</p>
              <p className="text-[10px] text-stone-500 mt-0.5">Atención y reservas 24/7 en Telegram: @CabanasAntoOficial_bot</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-[11px]">
            <span>Seguridad RLS & Supabase Auth</span>
            <Link href="/login" className="text-amber-400 hover:underline">
              Portal del Personal (2FA)
            </Link>
          </div>
        </div>
      </footer>

      {/* Botón Flotante Fijo de Telegram */}
      <a
        href="https://t.me/CabanasAntoOficial_bot"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chatear con el Asistente en Telegram"
        className="fixed bottom-6 right-6 z-40 bg-sky-500 hover:bg-sky-600 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 transition-all transform hover:scale-105 border border-sky-300/40 group"
      >
        <Send className="w-5 h-5 text-white animate-pulse" />
        <span className="text-xs font-bold hidden sm:inline">
          Asistente Virtual 24/7
        </span>
      </a>
    </div>
  );
}
