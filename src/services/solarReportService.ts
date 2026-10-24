// ============================================
// Solar Report Service — Sizing, Financials, Cost Breakdown & Projections
// ============================================

import { SOLAR_CONFIG } from '@/data/solarConfig';
import {
  getTariffContext,
  calculateSolarSavings,
  type TariffPlan,
  type SolarSavingsBreakdown,
  type TariffContextInput,
} from '@/services/tariffService';

/** Input for system sizing and report generation. */
export interface SolarReportInput {
  /** Monthly consumption history in kWh (up to 12 values). */
  monthlyConsumptionKwh: number[];
  /** Usable roof area in m². Used to cap the system size if provided. */
  roofAreaM2?: number | null;
  /** W per panel. Used with roofAreaM2 to cap panel count. */
  panelWattage?: number | null;
  /** m² footprint per panel. */
  panelAreaM2?: number | null;
  /** Max panels that fit (from roof tool). If provided, overrides area-based cap. */
  maxPanelsFit?: number | null;
  /** Confirmed bill context passed to getTariffContext. */
  tariffContext?: TariffContextInput;
  /** Sanctioned load in kW — used as a soft cap for system sizing. */
  sanctionedLoadKw?: number | null;
  /** Location-specific annual yield (kWh / kWp / year). Falls back to SOLAR_CONFIG. */
  annualYieldKwhPerKw?: number | null;
}

/** One line in the cost breakdown table. */
export interface CostLineItem {
  label: string;
  amountInr: number;
  sharePercent: number; // 0–100
}

/** Full cost breakdown for the installation. */
export interface CostBreakdown {
  systemKw: number;
  baseCostInr: number;   // pre-GST
  components: CostLineItem[];
  gstInr: number;
  grossCostInr: number;  // baseCostInr + gstInr
  subsidyInr: number;
  netCostInr: number;    // grossCostInr - subsidyInr
  gstRate: number;       // e.g. 0.12
  isIndicative: true;
}

/** One point on the 25-year cumulative savings curve. */
export interface YearlySavingsPoint {
  year: number;              // 1–25
  annualSavingsInr: number;  // savings in this specific year
  cumulativeSavingsInr: number; // cumulative savings up to this year
  cumulativeCostInr: number; // net cost minus cumulative savings (goes negative after breakeven)
}

/** Full solar report output. */
export interface SolarReport {
  systemKw: number;
  annualGenerationKwh: number;
  monthlyAverageGenerationKwh: number;
  monthlyAverageConsumptionKwh: number;
  savings: SolarSavingsBreakdown;
  paybackYears: number; // fractional
  co2OffsetKgPerYear: number;
  costBreakdown: CostBreakdown;
  yearlyProjection: YearlySavingsPoint[];
  planUsed: TariffPlan;
  assumptions: Record<string, string | number>;
}

/**
 * Computes PM Surya Ghar central subsidy based on system size (kW).
 * - Up to 1 kW: ₹30,000
 * - 1 to 2 kW: ₹30,000 to ₹60,000 (linear interpolation)
 * - 2 to 3 kW: ₹60,000 to ₹78,000 (linear interpolation)
 * - ≥ 3 kW: ₹78,000 (capped)
 */
export function computeSubsidy(systemKw: number): number {
  if (systemKw <= 0) return 0;

  if (systemKw <= 1) {
    return Math.round(systemKw * 30000);
  }

  if (systemKw <= 2) {
    const fraction = systemKw - 1;
    return Math.round(30000 + fraction * (60000 - 30000));
  }

  if (systemKw <= 3) {
    const fraction = systemKw - 2;
    return Math.round(60000 + fraction * (78000 - 60000));
  }

  return 78000;
}

/**
 * Computes component cost breakdown, GST, subsidy, and net investment.
 */
export function computeCostBreakdown(systemKw: number): CostBreakdown {
  const baseCostInr = Math.round(systemKw * SOLAR_CONFIG.costPerKwInr);
  
  // Calculate component line items with exact rounding balance
  const rawComponents = SOLAR_CONFIG.costComponents.map((c) => ({
    label: c.label,
    amountInr: Math.round(baseCostInr * c.share),
    sharePercent: Math.round(c.share * 100),
  }));

  // Ensure sum of components equals baseCostInr exactly
  const compSum = rawComponents.reduce((acc, curr) => acc + curr.amountInr, 0);
  const diff = baseCostInr - compSum;
  if (diff !== 0 && rawComponents.length > 0) {
    rawComponents[0].amountInr += diff;
  }

  const gstInr = Math.round(baseCostInr * SOLAR_CONFIG.gstRate);
  const grossCostInr = baseCostInr + gstInr;
  const subsidyInr = computeSubsidy(systemKw);
  const netCostInr = Math.max(0, grossCostInr - subsidyInr);

  return {
    systemKw,
    baseCostInr,
    components: rawComponents,
    gstInr,
    grossCostInr,
    subsidyInr,
    netCostInr,
    gstRate: SOLAR_CONFIG.gstRate,
    isIndicative: true,
  };
}

function allocatePercents(amounts: number[], total: number): number[] {
  if (total <= 0 || amounts.length === 0) return amounts.map(() => 0);
  const raw = amounts.map((a) => (a / total) * 100);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = 100 - floors.reduce((s, n) => s + n, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (remainder > 0 && order.length > 0) {
    floors[order[idx % order.length].i] += 1;
    remainder -= 1;
    idx += 1;
  }
  return floors;
}

/**
 * Equipment components plus GST, with percentage shares of the GST-inclusive gross total.
 * Shares are integer-allocated so they always sum to 100%.
 */
export function toGrossShareRows(breakdown: CostBreakdown): CostLineItem[] {
  const rows: CostLineItem[] = [
    ...breakdown.components,
    {
      label: `GST (${Math.round(breakdown.gstRate * 100)}%)`,
      amountInr: breakdown.gstInr,
      sharePercent: 0,
    },
  ];
  const percents = allocatePercents(
    rows.map((r) => r.amountInr),
    breakdown.grossCostInr,
  );
  return rows.map((r, i) => ({ ...r, sharePercent: percents[i] }));
}

/**
 * Computes 25-year cumulative savings projection considering:
 * - Electricity tariff escalation rate (+3% / year)
 * - Solar panel degradation rate (-0.5% / year)
 */
export function computeYearlyProjection(
  firstYearSavingsInr: number,
  netCostInr: number
): YearlySavingsPoint[] {
  const points: YearlySavingsPoint[] = [];
  let cumulativeSavings = 0;

  for (let year = 1; year <= SOLAR_CONFIG.projectLifetimeYears; year++) {
    const tFactor = Math.pow(1 + SOLAR_CONFIG.tariffEscalationRate, year - 1);
    const dFactor = Math.pow(1 - SOLAR_CONFIG.panelDegradationRate, year - 1);
    const annualSavings = Math.round(firstYearSavingsInr * tFactor * dFactor);

    cumulativeSavings += annualSavings;
    const cumulativeCost = Math.round(netCostInr - cumulativeSavings);

    points.push({
      year,
      annualSavingsInr: annualSavings,
      cumulativeSavingsInr: cumulativeSavings,
      cumulativeCostInr: cumulativeCost,
    });
  }

  return points;
}

/**
 * Computes fractional payback period in years.
 */
export function computePayback(netCostInr: number, projection: YearlySavingsPoint[]): number {
  if (netCostInr <= 0) return 0;
  if (!projection || projection.length === 0) return SOLAR_CONFIG.projectLifetimeYears;

  for (let i = 0; i < projection.length; i++) {
    const pt = projection[i];
    if (pt.cumulativeCostInr <= 0) {
      if (i === 0) {
        return Math.round((netCostInr / pt.annualSavingsInr) * 10) / 10;
      }
      const prev = projection[i - 1];
      const remainingBeforeYear = prev.cumulativeCostInr;
      const fraction = remainingBeforeYear / pt.annualSavingsInr;
      return Math.round((prev.year + fraction) * 10) / 10;
    }
  }

  return SOLAR_CONFIG.projectLifetimeYears;
}

/**
 * Generates comprehensive solar sizing, financial savings, and payback report.
 */
export function generateSolarReport(input: SolarReportInput): SolarReport {
  const plan = getTariffContext(input.tariffContext);

  // 1. Determine Monthly Consumption Profile
  const rawMonths = input.monthlyConsumptionKwh.filter((k) => k > 0);
  const avgMonthlyKwh =
    rawMonths.length > 0
      ? rawMonths.reduce((a, b) => a + b, 0) / rawMonths.length
      : 250;

  // Pad or repeat to form a standard 12-month profile
  const monthlyConsumption12: number[] = Array.from({ length: 12 }, (_, i) => {
    if (input.monthlyConsumptionKwh[i] !== undefined && input.monthlyConsumptionKwh[i] > 0) {
      return input.monthlyConsumptionKwh[i];
    }
    return Math.round(avgMonthlyKwh);
  });

  const annualConsumptionKwh = monthlyConsumption12.reduce((a, b) => a + b, 0);

  const wattage = input.panelWattage ?? 540;
  const yieldKwhPerKw =
    input.annualYieldKwhPerKw && input.annualYieldKwhPerKw > 0
      ? input.annualYieldKwhPerKw
      : SOLAR_CONFIG.yieldKwhPerKwPerYear;

  // 2. Determine System Sizing from the actual placed array when available.
  // Do not invent a 1 kW floor when no modules fit — keep every report metric
  // consistent with panel count × wattage.
  let panelCount = 0;
  if (input.maxPanelsFit && input.maxPanelsFit > 0) {
    panelCount = input.maxPanelsFit;
  } else if (input.roofAreaM2 && input.roofAreaM2 > 0) {
    const panelFootprint = (input.panelAreaM2 ?? 2.5) * 1.2;
    panelCount = Math.max(0, Math.floor(input.roofAreaM2 / panelFootprint));
  }

  let systemKw: number;
  if (panelCount > 0) {
    systemKw = Math.round(((panelCount * wattage) / 1000) * 100) / 100;
  } else {
    const requiredKw = annualConsumptionKwh / yieldKwhPerKw;
    systemKw = Math.max(0, Math.round(requiredKw * 100) / 100);
  }

  // 3. Generation Estimation
  const annualGenerationKwh = Math.round(systemKw * yieldKwhPerKw);
  const monthlyGenerationKwh = Array.from({ length: 12 }, () =>
    Math.round(annualGenerationKwh / 12)
  );

  // 4. Savings Calculation via Tariff Slabs Engine
  const loadKw =
    input.sanctionedLoadKw ??
    input.tariffContext?.confirmedBillData?.sanctionedLoadKw ??
    Math.max(1, Math.round(systemKw));

  const savings = calculateSolarSavings(
    plan,
    monthlyConsumption12,
    monthlyGenerationKwh,
    loadKw,
    plan.exportCreditRateInr
  );

  // 5. Cost Breakdown & Subsidies
  const costBreakdown = computeCostBreakdown(systemKw);

  // 6. 25-Year Projection & Payback
  const yearlyProjection = computeYearlyProjection(
    savings.annualSavingsInr,
    costBreakdown.netCostInr
  );
  const paybackYears = computePayback(costBreakdown.netCostInr, yearlyProjection);

  // 7. CO2 Offset
  const co2OffsetKgPerYear = Math.round(annualGenerationKwh * SOLAR_CONFIG.co2KgPerKwh);

  const assumptions: Record<string, string | number> = {
    'Annual Solar Yield': `${yieldKwhPerKw} kWh / kWp / year`,
    'Electricity Tariff Escalation': `${SOLAR_CONFIG.tariffEscalationRate * 100}% per year`,
    'Solar Panel Degradation': `${SOLAR_CONFIG.panelDegradationRate * 100}% per year`,
    'GST on Equipment': `${SOLAR_CONFIG.gstRate * 100}%`,
    'PM Surya Ghar Subsidy': `₹${costBreakdown.subsidyInr.toLocaleString()} (for ${systemKw} kW)`,
    'Surplus Export Credit Rate': `₹${(plan.exportCreditRateInr ?? 3.5).toFixed(2)} / kWh`,
    'Grid Emission Factor': `${SOLAR_CONFIG.co2KgPerKwh} kg CO₂ / kWh`,
  };

  return {
    systemKw,
    annualGenerationKwh,
    monthlyAverageGenerationKwh: Math.round(annualGenerationKwh / 12),
    monthlyAverageConsumptionKwh: Math.round(annualConsumptionKwh / 12),
    savings,
    paybackYears,
    co2OffsetKgPerYear,
    costBreakdown,
    yearlyProjection,
    planUsed: plan,
    assumptions,
  };
}
