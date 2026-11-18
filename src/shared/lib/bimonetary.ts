// ======================================================================
// SAAS Cabañas - Motor Bimonetario (USD Base / Dólar Blue)
// Reglas estrictas:
// 1. Tarifa base en USD
// 2. La seña (30% a 50%) congela únicamente el porcentaje abonado en USD
//    al valor del Dólar Blue del día de su acreditación bancaria.
// 3. El saldo restante queda expresado en USD billete y se liquida en el check-in:
//    en USD billete o pesificado a la cotización Blue del día del check-in.
// ======================================================================

export interface BimonetaryCalculation {
  dailyRateUsd: number;
  totalNights: number;
  totalUsd: number;
  blueRate: number;
  totalArsEstimate: number;
  senaPercentage: number;
  senaUsdRequired: number;
  senaArsRequired: number;
  balancePendingUsd: number;
}

export function calculateBookingFinancials(
  dailyRateUsd: number,
  totalNights: number,
  blueRate: number,
  senaPercentage: number = 30
): BimonetaryCalculation {
  const safeRateUsd = Math.max(0, dailyRateUsd);
  const safeNights = Math.max(1, totalNights);
  const safeBlueRate = Math.max(1, blueRate);
  const safeSenaPct = Math.min(100, Math.max(10, senaPercentage));

  const totalUsd = safeRateUsd * safeNights;
  const totalArsEstimate = totalUsd * safeBlueRate;

  const senaUsdRequired = Number(((totalUsd * safeSenaPct) / 100).toFixed(2));
  const senaArsRequired = Math.round(senaUsdRequired * safeBlueRate);

  const balancePendingUsd = Number((totalUsd - senaUsdRequired).toFixed(2));

  return {
    dailyRateUsd: safeRateUsd,
    totalNights: safeNights,
    totalUsd,
    blueRate: safeBlueRate,
    totalArsEstimate,
    senaPercentage: safeSenaPct,
    senaUsdRequired,
    senaArsRequired,
    balancePendingUsd,
  };
}

export function pesifyBalance(balanceUsd: number, checkInBlueRate: number): number {
  return Math.round(balanceUsd * checkInBlueRate);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function fetchLiveBlueRate(defaultFallback = 1285): Promise<{ buy: number; sell: number }> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue', {
      next: { revalidate: 300 }, // 5 min cache
    });
    if (!res.ok) throw new Error('Failed to fetch from dolarapi.com');
    const data = await res.json();
    return {
      buy: Number(data.compra) || defaultFallback - 20,
      sell: Number(data.venta) || defaultFallback,
    };
  } catch {
    return {
      buy: defaultFallback - 20,
      sell: defaultFallback,
    };
  }
}
