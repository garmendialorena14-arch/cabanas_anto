'use client';

import React from 'react';
import {
  LogIn,
  LogOut,
  Building2,
  Users,
  Percent,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatARS, formatUSD } from '@/shared/lib/bimonetary';

interface TopKpiCardsProps {
  checkinsTodayCount: number;
  checkinsTodayPax: number;
  checkoutsTodayCount: number;
  checkoutsTodayPax: number;
  occupiedCabinsCount: number;
  totalCabinsCount: number;
  totalPaxToday: number;
  occupancyPercentage: number;
  blueRateSell: number;
  blueRateBuy: number;
  onOpenRateModal: () => void;
  onFilterCheckins?: () => void;
  onFilterCheckouts?: () => void;
}

export default function TopKpiCards({
  checkinsTodayCount,
  checkinsTodayPax,
  checkoutsTodayCount,
  checkoutsTodayPax,
  occupiedCabinsCount,
  totalCabinsCount = 12,
  totalPaxToday,
  occupancyPercentage,
  blueRateSell,
  blueRateBuy,
  onOpenRateModal,
  onFilterCheckins,
  onFilterCheckouts,
}: TopKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 mb-3">
      {/* 1. Ingresos del Día (Check-ins a las 14:00 hs) */}
      <div 
        onClick={onFilterCheckins}
        className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-2.5 shadow-xs hover:shadow-sm transition-all cursor-pointer relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-10 h-10 bg-emerald-500/10 rounded-bl-2xl -mr-1 -mt-1 transition-transform group-hover:scale-110" />
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <LogIn className="w-3.5 h-3.5 text-emerald-600" /> Ingresos Hoy
          </span>
          <span className="text-[9px] font-black px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
            14hs
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-black text-slate-900 dark:text-white">
            {checkinsTodayCount}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            {checkinsTodayCount === 1 ? 'reserva' : 'reservas'}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
          <Users className="w-2.5 h-2.5 text-emerald-600" />
          <span><strong>{checkinsTodayPax}</strong> pax</span>
        </div>
      </div>

      {/* 2. Egresos del Día (Check-outs a las 10:00 am) */}
      <div 
        onClick={onFilterCheckouts}
        className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/40 rounded-xl p-2.5 shadow-xs hover:shadow-sm transition-all cursor-pointer relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-10 h-10 bg-amber-500/10 rounded-bl-2xl -mr-1 -mt-1 transition-transform group-hover:scale-110" />
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5 text-amber-600" /> Egresos Hoy
          </span>
          <span className="text-[9px] font-black px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
            10am
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-black text-slate-900 dark:text-white">
            {checkoutsTodayCount}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            {checkoutsTodayCount === 1 ? 'salida' : 'salidas'}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5 text-amber-600" />
          <span><strong>{checkoutsTodayPax}</strong> pax</span>
        </div>
      </div>

      {/* 3. Cabañas Ocupadas */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Cabañas Ocupadas
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-black text-slate-900 dark:text-white">
            {occupiedCabinsCount}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            de {totalCabinsCount}
          </span>
        </div>
        {/* Barra de progreso visual compacta */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round((occupiedCabinsCount / totalCabinsCount) * 100))}%` }}
          />
        </div>
      </div>

      {/* 4. Pax Totales Alojados */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-blue-500" /> Pax Totales
          </span>
          <span className="text-[9px] text-slate-500 font-medium">en predio</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-black text-slate-900 dark:text-white">
            {totalPaxToday}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            huéspedes
          </span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
          Capacidad activa
        </p>
      </div>

      {/* 5. Porcentaje de Ocupación */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-violet-500" /> Ocupación
          </span>
          <span className={`text-[9px] font-black px-1 py-0.5 rounded ${
            occupancyPercentage >= 75
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            {occupancyPercentage >= 80 ? 'Alta' : 'Media'}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-black text-slate-900 dark:text-white">
            {occupancyPercentage}%
          </span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
          {totalCabinsCount - occupiedCabinsCount} disp.
        </p>
      </div>

      {/* 6. Valor del Dólar Blue */}
      <div 
        onClick={onOpenRateModal}
        className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 rounded-xl p-2.5 shadow-xs hover:shadow-sm transition-all cursor-pointer relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-10 h-10 bg-blue-500/10 rounded-bl-2xl -mr-1 -mt-1 transition-transform group-hover:scale-110" />
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-blue-600" /> Dólar Blue
          </span>
          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center gap-0.5">
            <RefreshCw className="w-2.5 h-2.5" /> Ajustar
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-black text-slate-900 dark:text-white">
            ${blueRateSell.toLocaleString('es-AR')}
          </span>
          <span className="text-[9px] text-slate-500 font-bold uppercase">ARS</span>
        </div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center justify-between">
          <span>Comp: ${blueRateBuy.toLocaleString('es-AR')}</span>
          <span className="text-[9px] text-blue-600 font-semibold underline">Editar</span>
        </div>
      </div>
    </div>
  );
}
