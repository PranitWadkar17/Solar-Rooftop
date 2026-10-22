// ============================================
// Energy Prediction & Dynamic Cost Estimation Service
// Real-world, engineering-calibrated solar physics and
// 2025/2026 MNRE / PM Surya Ghar financial economics.
// ============================================

import type { SolarAnalysis } from '@/types/solar.js';
import type { PanelSpecification } from '@/types/optimization.js';

export interface MonthlyGenerationPoint {
  month: string;
  monthIndex: number;
  kwh: number;
  dailyAvgKwh: number;
}

export interface AccurateSolarMetrics {
  activeCapacityKWp: number;
  maxCapacityKWp: number;
  specificYieldKwhPerKwp: number;
  estimatedAnnualGenerationKwh: number;
  maxPotentialAnnualEnergyKwh: number;
  monthlyAverageEnergyKwh: number;
  monthlyRange: {
    minMonthlyKwh: number;
    maxMonthlyKwh: number;
    minMonthName: string;
    maxMonthName: string;
  };
  monthlyBreakdown: MonthlyGenerationPoint[];
  singlePanelDailyKwh: {
    min: number;
    max: number;
    avg: number;
  };
  singlePanelAnnualKwh: {
    min: number;
    max: number;
    avg: number;
  };
}

export interface DynamicCostEstimation {
  systemCapacityKWp: number;
  baseCostPerKwInr: number;
  equipmentBaseCostInr: number;
  gstRate: number;
  gstInr: number;
  grossCostInr: number;
  subsidyInr: number;
  subsidyName: string;
  netCostInr: number;
  monthlySavingsInr: number;
  annualSavingsInr: number;
  paybackYears: number;
  twentyFiveYearSavingsInr: number;
  levelizedCostOfEnergyInrPerKwh: number;
  isEligibleForSubsidy: boolean;
}

/**
 * Calculates accurate solar energy generation taking into account:
 * - Local NASA/MERRA-2 monthly GHI and DNI irradiance
 * - Rooftop tilt angle & orientation factor
 * - Specific panel temperature coefficient derating
 * - Inverter & balance of system (BOS) performance ratio (PR ~0.78 - 0.81)
 * - Shading access from ray-traced solar analysis
 */
export function calculateAccurateSolarMetrics(
  activePanelCount: number,
  panelSpec: PanelSpecification,
  solarAnalysis: SolarAnalysis | null,
  maxPanelCount: number,
  tiltDeg: number = 15
): AccurateSolarMetrics {
  const activeCapacityKWp = Math.round(((activePanelCount * panelSpec.ratedPowerW) / 1000) * 100) / 100;
  const maxCapacityKWp = Math.round(((maxPanelCount * panelSpec.ratedPowerW) / 1000) * 100) / 100;

  // Retrieve annual GHI (kWh/m²/year)
  const annualGhi = solarAnalysis?.resourceData?.annualGhi
    ? solarAnalysis.resourceData.annualGhi
    : 1750; // Standard sunny Indian plateau default (e.g. Pune/Nagpur/Ahmedabad)

  // System Performance Factors:
  // 1. Tilt enhancement: 15° South tilt in tropical India gains ~3-4% over flat GHI
  const tiltFactor = 1 + (Math.sin((tiltDeg * Math.PI) / 180) * 0.12);

  // 2. Temperature Derating Factor:
  // Operating cell temperature in India is ~45°C - 50°C (ambient 30-35°C + 20°C irradiance heating)
  // Temp rise above STC (25°C) = 22°C
  const deltaT = 22;
  const tempCoeff = panelSpec.tempCoeffPmax || -0.34;
  const tempDerating = Math.max(0.85, 1 + (deltaT * (tempCoeff / 100))); // e.g. 1 - 0.075 = 0.925

  // 3. Balance of System PR (Inverter 97.5%, DC cable 1.5%, AC cable 1.0%, soiling/dust 2.5%)
  const basePr = 0.81;

  // 4. Ray-traced shading factor from solar analysis
  const shadingAccess = solarAnalysis?.avgSolarAccessPct
    ? Math.max(0.60, solarAnalysis.avgSolarAccessPct / 100)
    : 0.95;

  // 5. Bifacial gain if applicable (e.g., dual glass on light terrace)
  const bifacialGain = panelSpec.technology.toLowerCase().includes('bifacial') ? 1.08 : 1.0;

  // Engineering specific yield (kWh / kWp / year)
  const specificYieldKwhPerKwp = Math.round(
    annualGhi * tiltFactor * basePr * tempDerating * shadingAccess * bifacialGain
  );

  // Installed & Potential Generation
  const estimatedAnnualGenerationKwh = Math.round(activeCapacityKWp * specificYieldKwhPerKwp);
  const maxPotentialAnnualEnergyKwh = Math.round(maxCapacityKWp * specificYieldKwhPerKwp);
  const monthlyAverageEnergyKwh = Math.round(estimatedAnnualGenerationKwh / 12);

  // Real month-by-month solar curve
  const monthlyData = solarAnalysis?.resourceData?.monthlyData;
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let monthlyBreakdown: MonthlyGenerationPoint[] = [];

  if (monthlyData && monthlyData.length === 12) {
    monthlyBreakdown = monthlyData.map((m, idx) => {
      // Monthly GHI kWh/m²/day * days in month
      const monthGhiTotal = m.ghi * monthDays[idx];
      const monthWeight = monthGhiTotal / annualGhi;
      const kwh = Math.round(estimatedAnnualGenerationKwh * monthWeight);
      const dailyAvgKwh = Math.round((kwh / monthDays[idx]) * 10) / 10;
      return {
        month: m.monthName,
        monthIndex: idx,
        kwh,
        dailyAvgKwh,
      };
    });
  } else {
    // Realistic empirical Indian seasonal profile (high Mar-May, dip in Jul-Aug monsoon, stable winter)
    const seasonalWeights = [
      0.082, 0.088, 0.098, 0.102, 0.099, 0.076,
      0.065, 0.068, 0.077, 0.085, 0.081, 0.079,
    ];
    monthlyBreakdown = seasonalWeights.map((weight, idx) => {
      const kwh = Math.round(estimatedAnnualGenerationKwh * weight);
      const dailyAvgKwh = Math.round((kwh / monthDays[idx]) * 10) / 10;
      return {
        month: monthNames[idx],
        monthIndex: idx,
        kwh,
        dailyAvgKwh,
      };
    });
  }

  // Min and Max generation months
  let minMonth = monthlyBreakdown[0];
  let maxMonth = monthlyBreakdown[0];
  for (const item of monthlyBreakdown) {
    if (item.kwh < minMonth.kwh) minMonth = item;
    if (item.kwh > maxMonth.kwh) maxMonth = item;
  }

  // Per-panel metrics (dynamic)
  const panelKWp = panelSpec.ratedPowerW / 1000;
  const panelAnnualAvg = Math.round(panelKWp * specificYieldKwhPerKwp);
  const panelDailyAvg = Math.round((panelAnnualAvg / 365) * 10) / 10;

  // Single panel Min (monsoon/cloudy winter) to Max (peak clear summer)
  const singlePanelDailyKwh = {
    min: Math.round(panelDailyAvg * 0.72 * 10) / 10,
    max: Math.round(panelDailyAvg * 1.30 * 10) / 10,
    avg: panelDailyAvg,
  };

  const singlePanelAnnualKwh = {
    min: Math.round(panelAnnualAvg * 0.88),
    max: Math.round(panelAnnualAvg * 1.14),
    avg: panelAnnualAvg,
  };

  return {
    activeCapacityKWp,
    maxCapacityKWp,
    specificYieldKwhPerKwp,
    estimatedAnnualGenerationKwh,
    maxPotentialAnnualEnergyKwh,
    monthlyAverageEnergyKwh,
    monthlyRange: {
      minMonthlyKwh: minMonth?.kwh ?? Math.round(monthlyAverageEnergyKwh * 0.75),
      maxMonthlyKwh: maxMonth?.kwh ?? Math.round(monthlyAverageEnergyKwh * 1.25),
      minMonthName: minMonth?.month ?? 'Jul',
      maxMonthName: maxMonth?.month ?? 'Apr',
    },
    monthlyBreakdown,
    singlePanelDailyKwh,
    singlePanelAnnualKwh,
  };
}

/**
 * Calculates PM Surya Ghar: Muft Bijli Yojana Central Government Subsidy:
 * Official 2024–2026 MNRE Gazette rules:
 * - 1 kW: ₹30,000
 * - 2 kW: ₹60,000 (linear ₹30,000/kW for first 2 kW)
 * - 3 kW: ₹78,000 (₹60,000 + ₹18,000 for 3rd kW)
 * - >3 kW: Capped at ₹78,000 maximum for residential installations.
 */
export function calculateSuryaGharSubsidy(systemCapacityKWp: number): number {
  if (systemCapacityKWp <= 0) return 0;

  if (systemCapacityKWp <= 1.0) {
    return Math.round(systemCapacityKWp * 30000);
  }

  if (systemCapacityKWp <= 2.0) {
    const fraction = systemCapacityKWp - 1.0;
    return Math.round(30000 + fraction * 30000);
  }

  if (systemCapacityKWp <= 3.0) {
    const fraction = systemCapacityKWp - 2.0;
    return Math.round(60000 + fraction * 18000);
  }

  // Capped at ₹78,000 for residential systems >= 3 kW
  return 78000;
}

/**
 * Calculates dynamic turnkey EPC installation cost, GST, government subsidy,
 * payback duration, and 25-year cumulative return.
 * 100% dynamic based on system capacity, module technology, and electricity bill.
 */
export function calculateDynamicCostEstimation(
  systemCapacityKWp: number,
  panelSpec: PanelSpecification,
  monthlyBillInr: number,
  tariffRateInr: number,
  monthlyGeneratedUnits: number
): DynamicCostEstimation {
  if (systemCapacityKWp <= 0) {
    return {
      systemCapacityKWp: 0,
      baseCostPerKwInr: 55000,
      equipmentBaseCostInr: 0,
      gstRate: 0.12,
      gstInr: 0,
      grossCostInr: 0,
      subsidyInr: 0,
      subsidyName: 'PM Surya Ghar: Muft Bijli Yojana',
      netCostInr: 0,
      monthlySavingsInr: 0,
      annualSavingsInr: 0,
      paybackYears: 0,
      twentyFiveYearSavingsInr: 0,
      levelizedCostOfEnergyInrPerKwh: 0,
      isEligibleForSubsidy: false,
    };
  }

  // Realistic Indian Market Turnkey EPC Cost per kW Curve (2025/2026 benchmark):
  // Smaller systems have higher fixed BOS & installation overheads per kW.
  let baseRatePerKw = 52000;

  if (systemCapacityKWp <= 1.5) {
    baseRatePerKw = 62000;
  } else if (systemCapacityKWp <= 2.5) {
    baseRatePerKw = 56000;
  } else if (systemCapacityKWp <= 3.5) {
    baseRatePerKw = 51000;
  } else if (systemCapacityKWp <= 5.0) {
    baseRatePerKw = 47000;
  } else if (systemCapacityKWp <= 10.0) {
    baseRatePerKw = 43000;
  } else {
    baseRatePerKw = 39000;
  }

  // Technology modifier: N-Type TOPCon Dual-Glass Bifacial carries a small premium (+4%)
  if (panelSpec.technology.toLowerCase().includes('topcon') || panelSpec.technology.toLowerCase().includes('bifacial')) {
    baseRatePerKw = Math.round(baseRatePerKw * 1.04);
  }

  const equipmentBaseCostInr = Math.round(systemCapacityKWp * baseRatePerKw);
  const gstRate = 0.12; // 12% standard GST on EPC solar power plants
  const gstInr = Math.round(equipmentBaseCostInr * gstRate);
  const grossCostInr = equipmentBaseCostInr + gstInr;

  // Central Subsidy
  const subsidyInr = calculateSuryaGharSubsidy(systemCapacityKWp);
  const netCostInr = Math.max(0, grossCostInr - subsidyInr);

  // Financial Savings
  const monthlySavingsInr = Math.min(
    monthlyBillInr,
    Math.round(monthlyGeneratedUnits * tariffRateInr)
  );
  const annualSavingsInr = monthlySavingsInr * 12;

  // Simple Payback (years)
  const paybackYears =
    annualSavingsInr > 0
      ? Math.round((netCostInr / annualSavingsInr) * 10) / 10
      : 0;

  // 25-Year Cumulative Savings:
  // Degradation: 0.5%/year on panels
  // Tariff inflation: 3%/year electricity price increase
  let cumulativeGrossSavings = 0;
  for (let year = 1; year <= 25; year++) {
    const degradationMultiplier = 1 - (year - 1) * 0.005;
    const inflationMultiplier = Math.pow(1.03, year - 1);
    const yearSavings = annualSavingsInr * degradationMultiplier * inflationMultiplier;
    cumulativeGrossSavings += yearSavings;
  }

  const twentyFiveYearSavingsInr = Math.round(cumulativeGrossSavings - netCostInr);

  // Levelized Cost of Electricity (LCOE) in ₹/kWh:
  // Net Cost divided by 25-year total generation
  const totalLifetimeGenerationKwh = monthlyGeneratedUnits * 12 * 25 * 0.94; // with average degradation
  const levelizedCostOfEnergyInrPerKwh =
    totalLifetimeGenerationKwh > 0
      ? Math.round((netCostInr / totalLifetimeGenerationKwh) * 100) / 100
      : 2.45;

  return {
    systemCapacityKWp,
    baseCostPerKwInr: baseRatePerKw,
    equipmentBaseCostInr,
    gstRate,
    gstInr,
    grossCostInr,
    subsidyInr,
    subsidyName: 'PM Surya Ghar: Muft Bijli Yojana (Central Subsidy)',
    netCostInr,
    monthlySavingsInr,
    annualSavingsInr,
    paybackYears,
    twentyFiveYearSavingsInr,
    levelizedCostOfEnergyInrPerKwh,
    isEligibleForSubsidy: subsidyInr > 0,
  };
}
