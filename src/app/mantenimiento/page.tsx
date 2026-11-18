'use client';

import React, { useState, useEffect } from 'react';
import InternalPortalHeader from '@/shared/components/InternalPortalHeader';
import SessionSecurityGuard from '@/shared/components/SessionSecurityGuard';
import MaintenanceManagementView from '@/modules/maintenance/components/MaintenanceManagementView';
import { createClient } from '@/shared/lib/supabase/client';
import { Cabin } from '@/shared/types';
import { Wrench, LogOut } from 'lucide-react';

export default function MaintenancePortalPage() {
  const [cabins, setCabins] = useState<Cabin[]>([]);

  useEffect(() => {
    async function loadCabins() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('cabins')
          .select('*')
          .order('cabin_number');
        if (!error && data) {
          setCabins(data);
        }
      } catch (err) {
        console.error('Error cargando cabañas en portal de mantenimiento:', err);
      }
    }

    loadCabins();
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans pb-16">
      <SessionSecurityGuard requiredRole="mantenimiento" />
      <InternalPortalHeader role="mantenimiento" userName="Equipo Técnico & Mantenimiento" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Banner de Portal Técnico con botón de Cerrar Sesión */}
        <div className="bg-stone-900/90 p-6 rounded-3xl border border-stone-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                Portal Técnico Operativo
              </span>
              <span className="text-xs text-stone-400">· Cero Acceso a Datos de Clientes · Sincronización en Tiempo Real</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-amber-100 flex items-center gap-2">
              <Wrench className="w-7 h-7 text-amber-500" />
              Mantenimiento Edilicio, Averías y Pileta
            </h2>
            <p className="text-xs text-stone-400">
              Control de incidencias en cabañas 1 a 12, piscina climatizada, bombas y áreas comunes. Marcá incidencias como en curso o solucionadas en tiempo real.
            </p>
          </div>

          <a
            href="/api/auth/logout"
            className="px-4 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-700/60 text-red-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-all self-start sm:self-center shrink-0 shadow-md"
            title="Cerrar sesión de forma segura"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>Cerrar Sesión</span>
          </a>
        </div>

        {/* Componente Integral de Gestión de Mantenimiento */}
        <MaintenanceManagementView
          userRole="mantenimiento"
          userName="Equipo de Mantenimiento"
          cabins={cabins}
        />
      </main>
    </div>
  );
}
