'use client';

import React, { useState, useEffect } from 'react';
import InternalPortalHeader from '@/shared/components/InternalPortalHeader';
import SessionSecurityGuard from '@/shared/components/SessionSecurityGuard';
import { createClient } from '@/shared/lib/supabase/client';
import { HousekeepingInventoryItem } from '@/shared/types';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Utensils,
  Sun,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export default function HousekeepingPortalPage() {
  const [activeTab, setActiveTab] = useState<'cleaning' | 'inventory' | 'loans'>('cleaning');
  const [inventory, setInventory] = useState<HousekeepingInventoryItem[]>([]);
  const [operationalReservations, setOperationalReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHousekeepingData() {
      const supabase = createClient();

      // Cargar inventario de maestranza
      const { data: invData } = await supabase
        .from('housekeeping_inventory')
        .select('*')
        .order('category');
      if (invData) setInventory(invData);

      // Cargar vista segura con PII enmascarado
      const { data: opData } = await supabase
        .from('v_operational_reservations')
        .select('*')
        .order('cabin_number');
      if (opData) setOperationalReservations(opData);

      setLoading(false);
    }

    loadHousekeepingData();
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans pb-16">
      <SessionSecurityGuard requiredRole="maestranza" />
      <InternalPortalHeader role="maestranza" userName="Personal de Maestranza & Mucamas" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Banner */}
        <div className="bg-stone-900/90 p-6 rounded-3xl border border-stone-800 shadow-xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
              Vista Operativa Segura
            </span>
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Datos Personales Enmascarados (DNI / Tel)
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-amber-100">
            Hoja de Ruta de Maestranza y Blanquería
          </h2>
          <p className="text-xs text-stone-400">
            Control de recambio de toallas (cada 3 días), insumos de higiene, préstamos de pileta y canastas de desayuno con protocolo <strong>Sin TACC</strong>.
          </p>
        </div>

        {/* Tab Navigator */}
        <div className="flex gap-2 border-b border-stone-800 pb-2">
          <button
            onClick={() => setActiveTab('cleaning')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'cleaning'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            Hoja de Ruta & Desayunos ({operationalReservations.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
            }`}
          >
            Depósito de Toallas & Amenities ({inventory.length})
          </button>
        </div>

        {/* TAB 1: OPERATIONAL CLEANING & BREAKFAST */}
        {activeTab === 'cleaning' && (
          <div className="bg-stone-900 rounded-3xl border border-stone-800 p-6 space-y-4 shadow-xl">
            <div className="border-b border-stone-800 pb-4">
              <h3 className="font-serif text-lg font-bold text-amber-100">
                Cabañas con Huéspedes y Logística del Día
              </h3>
              <p className="text-xs text-stone-400">
                Recambio de toallas de baño programado cada 3 días. Control prioritario de canastas Sin TACC.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {operationalReservations.map((r) => (
                <div
                  key={r.id}
                  className="p-5 rounded-2xl bg-stone-950 border border-stone-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-base text-amber-200">
                      Cabaña #{r.cabin_number} ({r.cabin_floor})
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-stone-800 text-stone-300">
                      {r.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-stone-300">
                    <div>
                      <strong className="text-stone-400">Huésped:</strong> {r.guest_name}
                    </div>
                    <div className="font-mono text-[11px] text-stone-500">
                      DNI: {r.masked_dni} · Tel: {r.masked_phone}
                    </div>
                    <div>
                      <strong className="text-stone-400">Pasajeros:</strong> {r.guest_count} pax
                    </div>
                  </div>

                  {/* Sin TACC Highlight */}
                  {r.has_celiac_sin_tacc ? (
                    <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-600/70 text-amber-300 text-xs flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold block">ALERTA CRÍTICA: CELÍACO / SIN TACC</span>
                        <span className="text-[11px] text-amber-200/80">
                          Entregar canasta sellada en origen. {r.dietary_notes || ''}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-[11px] text-stone-400 flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-stone-500" />
                      <span>Desayuno Artesanal Tradicional</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-xs">
                    <span className="text-stone-400">Recambio Toallas:</span>
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                      Programado Hoy
                    </span>
                  </div>
                </div>
              ))}

              {operationalReservations.length === 0 && (
                <div className="col-span-3 p-8 text-center text-stone-500">
                  No hay reservas activas en este momento.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY */}
        {activeTab === 'inventory' && (
          <div className="bg-stone-900 rounded-3xl border border-stone-800 p-6 space-y-4 shadow-xl">
            <div className="border-b border-stone-800 pb-4">
              <h3 className="font-serif text-lg font-bold text-amber-100">
                Depósito Central de Insumos de Maestranza
              </h3>
              <p className="text-xs text-stone-400">
                Stock disponible y umbrales mínimos de alerta de reposición.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventory.map((item) => {
                const isLow = item.stock_depot <= item.min_alert_threshold;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border ${
                      isLow
                        ? 'bg-amber-950/40 border-amber-600/60'
                        : 'bg-stone-950 border-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase font-bold text-stone-400">
                        {item.category.replace('_', ' ')}
                      </span>
                      {isLow && (
                        <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Reponer Stock
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-stone-100">{item.item_name}</h4>

                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-bold font-mono text-white">
                          {item.stock_depot}
                        </span>
                        <span className="text-xs text-stone-400 ml-1">{item.unit}</span>
                      </div>
                      <span className="text-[11px] text-stone-500">
                        Mínimo: {item.min_alert_threshold}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
