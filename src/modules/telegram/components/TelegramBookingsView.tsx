'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Users,
  DollarSign,
  Home,
  ArrowRight,
} from 'lucide-react';
import { Booking, BookingStatus, Cabin } from '@/shared/types';
import { formatARS, formatUSD } from '@/shared/lib/bimonetary';
import { createClient } from '@/shared/lib/supabase/client';

interface TelegramBookingsViewProps {
  onOpenCreateOfficialReservation?: (booking: Booking) => void;
}

export default function TelegramBookingsView({ onOpenCreateOfficialReservation }: TelegramBookingsViewProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal para nueva reserva de Telegram
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCabinName, setNewCabinName] = useState('Cabaña 1');
  const [newCheckIn, setNewCheckIn] = useState('');
  const [newCheckOut, setNewCheckOut] = useState('');
  const [newPax, setNewPax] = useState(2);
  const [newAmount, setNewAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [newGuestName, setNewGuestName] = useState('');
  const [newTelegramId, setNewTelegramId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [savingBooking, setSavingBooking] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram/bookings');
      const data = await res.json();
      if (data.bookings) setBookings(data.bookings);

      const supabase = createClient();
      const { data: cabinData } = await supabase
        .from('cabins')
        .select('*')
        .order('cabin_number', { ascending: true });
      if (cabinData) setCabins(cabinData);
    } catch (err) {
      console.error('Error loading bookings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(bookingId: string, newStatus: BookingStatus) {
    setUpdatingId(bookingId);
    try {
      const res = await fetch('/api/telegram/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookingId, status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
        );
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!newCabinName || !newCheckIn || !newCheckOut) return;

    setSavingBooking(true);
    try {
      // 1. Si se ingresó un telegram ID o nombre, buscar o crear contacto
      let contactId: string | null = null;
      if (newTelegramId || newGuestName) {
        const supabase = createClient();
        const extId = newTelegramId.trim() || `manual_${Date.now()}`;
        const { data: contact } = await supabase
          .from('contacts')
          .upsert(
            {
              external_id: extId,
              full_name: newGuestName.trim() || 'Huésped Telegram',
              channel: 'telegram',
            },
            { onConflict: 'external_id' }
          )
          .select('id')
          .single();

        if (contact) contactId = contact.id;
      }

      const res = await fetch('/api/telegram/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          cabin_name: newCabinName,
          check_in: newCheckIn,
          check_out: newCheckOut,
          guests_count: newPax,
          total_amount: Number(newAmount) || 0,
          currency: newCurrency,
          status: 'pending',
          notes: newNotes,
        }),
      });

      const data = await res.json();
      if (data.ok && data.booking) {
        setBookings((prev) => [data.booking, ...prev]);
        setShowNewModal(false);
        // Reset form
        setNewCheckIn('');
        setNewCheckOut('');
        setNewAmount('');
        setNewGuestName('');
        setNewTelegramId('');
        setNewNotes('');
      }
    } catch (err) {
      console.error('Error creating booking:', err);
    } finally {
      setSavingBooking(false);
    }
  }

  const filteredBookings = bookings.filter((b) => {
    const guest = b.contact?.full_name?.toLowerCase() || '';
    const cabin = b.cabin_name.toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = guest.includes(query) || cabin.includes(query);
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado y Acciones */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl text-white">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-400" />
            Gestión de Reservas desde Telegram
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
              {bookings.length} registradas
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Control de estadías solicitadas o coordinadas mediante el Bot y los Asistentes de IA.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-slate-800"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nueva Reserva Telegram
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por huésped o cabaña..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 rounded-xl font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-amber-400 hover:text-amber-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pendientes
          </button>
          <button
            onClick={() => setStatusFilter('confirmed')}
            className={`px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
              statusFilter === 'confirmed'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirmadas
          </button>
          <button
            onClick={() => setStatusFilter('cancelled')}
            className={`px-3 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
              statusFilter === 'cancelled'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Canceladas
          </button>
        </div>
      </div>

      {/* Tabla / Listado de Bookings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Cabaña</th>
                <th className="py-3 px-4">Huésped / Contacto</th>
                <th className="py-3 px-4">Fechas (In - Out)</th>
                <th className="py-3 px-4">Pasajeros</th>
                <th className="py-3 px-4">Monto Estimado</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    Cargando reservas de Telegram...
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No se encontraron reservas de Telegram.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const isUpdating = updatingId === b.id;
                  const contactName = b.contact?.full_name || 'Huésped no registrado';

                  return (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-100 flex items-center gap-2">
                        <Home className="w-4 h-4 text-sky-400 shrink-0" />
                        {b.cabin_name}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">{contactName}</div>
                        {b.contact?.username && (
                          <div className="text-[10px] text-slate-500">@{b.contact.username}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-200">
                          {b.check_in} → {b.check_out}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-300">
                        {b.guests_count} personas
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {b.currency === 'USD'
                          ? formatUSD(Number(b.total_amount))
                          : formatARS(Number(b.total_amount))}
                      </td>

                      <td className="py-3.5 px-4">
                        {b.status === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Confirmada
                          </span>
                        ) : b.status === 'cancelled' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" /> Cancelada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" /> Pendiente
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-2">
                        {b.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(b.id, 'confirmed')}
                            disabled={isUpdating}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all disabled:opacity-50"
                            title="Confirmar Seña"
                          >
                            Confirmar
                          </button>
                        )}

                        {b.status !== 'cancelled' && (
                          <button
                            onClick={() => handleStatusChange(b.id, 'cancelled')}
                            disabled={isUpdating}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 transition-all disabled:opacity-50"
                            title="Cancelar"
                          >
                            Cancelar
                          </button>
                        )}

                        {onOpenCreateOfficialReservation && (
                          <button
                            onClick={() => onOpenCreateOfficialReservation(b)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 transition-all"
                            title="Pasar al Calendario Oficial"
                          >
                            Al Calendario →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nueva Reserva Telegram */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg text-white space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-400" />
              Nueva Reserva desde Telegram
            </h4>

            <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cabaña</label>
                  <select
                    value={newCabinName}
                    onChange={(e) => setNewCabinName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    {cabins.map((c) => (
                      <option key={c.id} value={`Cabaña ${c.cabin_number}`}>
                        Cabaña {c.cabin_number} - {c.name} ({c.floor})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pasajeros</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={newPax}
                    onChange={(e) => setNewPax(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Check-in</label>
                  <input
                    type="date"
                    required
                    value={newCheckIn}
                    onChange={(e) => setNewCheckIn(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Check-out</label>
                  <input
                    type="date"
                    required
                    value={newCheckOut}
                    onChange={(e) => setNewCheckOut(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nombre Huésped</label>
                  <input
                    type="text"
                    placeholder="Ej: Carlos Gómez"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Telegram Chat ID / Username</label>
                  <input
                    type="text"
                    placeholder="Ej: 987654321 o @carlos"
                    value={newTelegramId}
                    onChange={(e) => setNewTelegramId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Monto Estimado</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Moneda</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Notas / Seña</label>
                <textarea
                  rows={2}
                  placeholder="Detalles de la seña, dieta celíaca, cochera..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBooking}
                  className="px-4 py-2 rounded-xl font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50"
                >
                  {savingBooking ? 'Guardando...' : 'Guardar Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
