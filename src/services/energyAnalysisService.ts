import type { ElectricityConsumptionProfile, MonthlyConsumption } from '@/types/index.js';
import type { PanelLayout } from '@/types/optimization.js';
import { getTariffContext, calculateSolarSavings } from './tariffService.js';

export interface MonthlyEnergyPoint {
  month: string;
  kwh: number;
}

export interface SystemLosses {
  inverterEfficiency: number; // 0-1 (typically 0.96-0.98)
  dcCableLoss: number; // 0-1 (typically 0.98-0.99)
  acCableLoss: number; // 0-1 (typically 0.99)
  soilingLoss: number; // 0-1 (typically 0.97-0.99)
  temperatureLoss: number; // 0-1 (varies by month, typically 0.90-0.96)
  mismatchLoss: number; // 0-1 (typically 0.98)
  lidLoss: number; // Light Induced Degradation, 0-1 (typically 0.98-0.99)
  availabilityLoss: number; // 0-1 (typically 0.99-0.995)
  agingLoss: number; // First year, 0-1 (typically 0.995-0.998)
  combinedFactor: number; // Product of all losses
}

export interface MonthlyComparisonEntry {
  month: string;
  generationKwh: number;
  consumptionKwh: number;
  deltaKwh: number;
  status: 'surplus' | 'shortfall' | 'balanced';
}

export interface ConsumptionComparison {
  annualGenerationKwh: number;
  annualConsumptionKwh: number | null;
  coverageRatioPct: number | null;
  surplusKwh: number | null;
  shortfallKwh: number | null;
  selfSupplyScore: number | null;
  status: 'surplus' | 'shortfall' | 'balanced' | 'unavailable';
  systemLosses: SystemLosses;
  performanceRatio: number; // PR: actual output / theoretical output
  monthlyGeneration: MonthlyEnergyPoint[];
  monthlyConsumption: MonthlyConsumption[];
  monthlyComparison: MonthlyComparisonEntry[];
  solarSavings?: import('@/services/tariffService.js').SolarSavingsBreakdown | null;
  tariffPlan?: import('@/services/tariffService.js').TariffPlan | null;
}

// Monthly temperature coefficients (assuming moderate climate)
const monthlyTempCoefficients = [
  0.95, 0.94, 0.93, 0.92, 0.90, 0.88, // Jan-Jun (getting hotter)
  0.88, 0.88, 0.90, 0.92, 0.94, 0.95, // Jul-Dec (cooling down)
];

// Monthly soiling coefficients (varies with rain/dust)
const monthlySoilingCoefficients = [
  0.97, 0.97, 0.96, 0.95, 0.94, 0.93, // Jan-Jun (dry season accumulation)
  0.92, 0.95, 0.98, 0.99, 0.98, 0.97, // Jul-Dec (monsoon cleaning)
];

/**
 * Calculates comprehensive system losses for accurate energy prediction
 * Based on NREL SAM and IEC 61724 standards
 */
function calculateSystemLosses(month: number, _panelSpec?: { tempCoeffPmax: number }): SystemLosses {
  // Inverter efficiency (modern inverters: 96-98%)
  const inverterEfficiency = 0.97;
  
  // DC cable losses (1-3% typical for well-designed systems)
  const dcCableLoss = 0.98;
  
  // AC cable losses (0.5-1% typical)
  const acCableLoss = 0.995;
  
  // Soiling losses (seasonal variation, cleaned by rain)
  const soilingLoss = monthlySoilingCoefficients[month];
  
  // Temperature losses (varies significantly by month and climate)
  // Modern panels have tempCoeff around -0.30%/°C to -0.35%/°C
  const temperatureLoss = monthlyTempCoefficients[month];
  
  // Mismatch losses (panel-to-panel variation: 1-3%)
  const mismatchLoss = 0.98;
  
  // Light Induced Degradation (first year stabilization: 1-2%)
  const lidLoss = 0.985;
  
  // System availability (downtime for maintenance: 0.5-1%)
  const availabilityLoss = 0.995;
  
  // Aging loss (first year degradation: 0.25-0.5%)
  const agingLoss = 0.997;
  
  // Combined factor
  const combinedFactor = 
    inverterEfficiency *
    dcCableLoss *
    acCableLoss *
    soilingLoss *
    temperatureLoss *
    mismatchLoss *
    lidLoss *
    availabilityLoss *
    agingLoss;
  
  return {
    inverterEfficiency,
    dcCableLoss,
    acCableLoss,
    soilingLoss,
    temperatureLoss,
    mismatchLoss,
    lidLoss,
    availabilityLoss,
    agingLoss,
    combinedFactor,
  };
}

const monthlyGenerationFactors = [
  0.07, 0.08, 0.1, 0.12, 0.14, 0.16,
  0.17, 0.15, 0.12, 0.09, 0.08, 0.07,
];

function monthKey(index: number): string {
  return `2026-${String(index + 1).padStart(2, '0')}`;
}

export function buildConsumptionComparison(
  layout: Pick<PanelLayout, 'systemCapacityKWp' | 'panelSpec'> | null,
  consumption: ElectricityConsumptionProfile | null,
  solarResourceKwhPerKwp?: number, // Annual kWh/kWp from solar analysis
): ConsumptionComparison {
  const annualConsumptionKwh = consumption?.annualKwh ?? null;
  
  // Enhanced calculation with realistic performance ratio
  // Base: 1450 kWh/kWp/year (moderate climate assumption)
  // Actual varies: 900-1900 kWh/kWp depending on location
  const baseKwhPerKwp = solarResourceKwhPerKwp ?? 1450;
  
  // Calculate month-by-month generation with losses
  const monthlyGeneration: MonthlyEnergyPoint[] = monthlyGenerationFactors.map((factor, index) => {
    const losses = calculateSystemLosses(index, layout?.panelSpec);
    const grossMonthlyKwh = (layout?.systemCapacityKWp ?? 0) * baseKwhPerKwp * factor;
    const netMonthlyKwh = Math.round(grossMonthlyKwh * losses.combinedFactor);
    
    return {
      month: monthKey(index),
      kwh: netMonthlyKwh,
    };
  });
  
  const annualGenerationKwh = monthlyGeneration.reduce((sum, m) => sum + m.kwh, 0);
  
  // Calculate actual Performance Ratio
  const grossAnnualKwh = (layout?.systemCapacityKWp ?? 0) * baseKwhPerKwp;
  const performanceRatio = grossAnnualKwh > 0 ? annualGenerationKwh / grossAnnualKwh : 0;
  
  // Get average system losses for reporting
  const avgLosses = calculateSystemLosses(6); // Mid-year average

  const monthlyConsumption = consumption?.monthlyKwh && consumption.monthlyKwh.length > 0
    ? consumption.monthlyKwh
    : (annualConsumptionKwh !== null ? Array.from({ length: 12 }, (_, index) => ({
        month: monthKey(index),
        kwh: Math.round(annualConsumptionKwh / 12),
      })) : []);

  const monthlyMap = new Map(monthlyConsumption.map((item) => [item.month, item.kwh]));
  const monthlyComparison = monthlyGeneration.map((generationItem) => {
    const consumptionKwh = monthlyMap.get(generationItem.month) ?? 0;
    const deltaKwh = generationItem.kwh - consumptionKwh;
    let status: MonthlyComparisonEntry['status'] = 'balanced';
    if (deltaKwh > 0) status = 'surplus';
    else if (deltaKwh < 0) status = 'shortfall';

    return {
      month: generationItem.month,
      generationKwh: generationItem.kwh,
      consumptionKwh,
      deltaKwh,
      status,
    };
  });

  if (!consumption || annualConsumptionKwh === null) {
    return {
      annualGenerationKwh,
      annualConsumptionKwh: null,
      coverageRatioPct: null,
      surplusKwh: null,
      shortfallKwh: null,
      selfSupplyScore: null,
      status: 'unavailable',
      systemLosses: avgLosses,
      performanceRatio: Math.round(performanceRatio * 1000) / 1000,
      monthlyGeneration,
      monthlyConsumption,
      monthlyComparison,
    };
  }

  const coverageRatioPct = (annualGenerationKwh / annualConsumptionKwh) * 100;
  const surplusKwh = Math.max(0, annualGenerationKwh - annualConsumptionKwh);
  const shortfallKwh = Math.max(0, annualConsumptionKwh - annualGenerationKwh);
  const selfSupplyScore = Math.min(100, Math.max(0, coverageRatioPct));

  let status: ConsumptionComparison['status'] = 'balanced';
  if (annualGenerationKwh > annualConsumptionKwh) status = 'surplus';
  else if (annualGenerationKwh < annualConsumptionKwh) status = 'shortfall';

  // Compute month-by-month financial solar savings if tariffPlan is available
  const plan = consumption.tariffPlan || getTariffContext({ confirmedBillData: consumption.billData });
  const loadKw = consumption.billData?.sanctionedLoadKw ?? 3.0;

  const monthlyConsumedUnits = monthlyComparison.map((m) => m.consumptionKwh);
  const monthlyGeneratedUnits = monthlyComparison.map((m) => m.generationKwh);
  const solarSavings = calculateSolarSavings(plan, monthlyConsumedUnits, monthlyGeneratedUnits, loadKw);

  return {
    annualGenerationKwh,
    annualConsumptionKwh,
    coverageRatioPct,
    surplusKwh,
    shortfallKwh,
    selfSupplyScore,
    status,
    systemLosses: avgLosses,
    performanceRatio: Math.round(performanceRatio * 1000) / 1000,
    monthlyGeneration,
    monthlyConsumption,
    monthlyComparison,
    solarSavings,
    tariffPlan: plan,
  };
}
