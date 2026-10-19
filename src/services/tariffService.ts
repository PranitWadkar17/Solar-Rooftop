// ============================================
// Tariff Service — Dynamic Tariff Calculation & Slabs Engine
// ============================================

/**
 * Single authoritative legacy fallback constant.
 * The number 8.0 must NOT be scattered anywhere else in the codebase.
 */
export const LEGACY_FALLBACK_TARIFF = 8.0;

export type TariffSource = 'bill_ocr' | 'user_custom' | 'discom_preset' | 'default_estimate';

export type TariffCategory = 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural';

export interface TariffSlab {
  fromUnit: number;
  toUnit: number | null; // null means unbounded top slab
  rate: number;          // ₹/kWh
}

export interface TariffPlan {
  id: string;
  name: string;
  category: TariffCategory;
  source: TariffSource;
  isTelescopic: boolean; // true: progressive slab tiers; false: entire consumption charged at matching slab rate
  slabs: TariffSlab[];
  fixedChargePerKwMonth: number; // ₹/kW/month (if load-based)
  fixedChargePerMonth: number;   // ₹/month (flat if load is absent)
  fuelAdjustmentPerKwh: number;  // ₹/kWh (FPPCA / FAC)
  dutyPercent: number;           // Electricity duty % (e.g. 5% = 0.05)
  otherPerKwh: number;           // Surcharges / wheeling charges per kWh
  exportCreditRateInr?: number;  // ₹/kWh credited for surplus solar net-metered export
  lastVerified?: string;
  isEstimated?: boolean;
}

export interface BillBreakdown {
  units: number;
  loadKw: number;
  energyCharges: number;
  fixedCharges: number;
  fuelAdjustment: number;
  electricityDuty: number;
  otherCharges: number;
  total: number;
  effectiveRatePerKwh: number;
}

export interface UnitsForBillResult {
  units: number;
  lowerBound: number;
  upperBound: number;
  planUsed: TariffPlan;
  effectiveAverageRate: number;
  marginalRate: number;
}

export interface SolarSavingsBreakdown {
  annualBillBeforeSolar: number;
  annualBillAfterSolar: number;
  annualSavingsInr: number;
  monthlySavingsInr: number;
  gridImportKwh: number;
  gridExportKwh: number;
  exportCreditsEarnedInr: number;
  effectiveAverageRateBefore: number;
  effectiveMarginalRateBefore: number;
  planName: string;
  planSource: TariffSource;
}

// Default standard residential telescopic plan
export const GENERIC_RESIDENTIAL_PLAN: TariffPlan = {
  id: 'generic-residential-telescopic',
  name: 'Generic Residential Slabs (Indian Metro Average)',
  category: 'Residential',
  source: 'discom_preset',
  isTelescopic: true,
  slabs: [
    { fromUnit: 0, toUnit: 100, rate: 4.5 },
    { fromUnit: 101, toUnit: 300, rate: 7.5 },
    { fromUnit: 301, toUnit: 500, rate: 10.0 },
    { fromUnit: 501, toUnit: null, rate: 12.0 },
  ],
  fixedChargePerKwMonth: 65,
  fixedChargePerMonth: 120,
  fuelAdjustmentPerKwh: 0.45,
  dutyPercent: 0.06, // 6% state duty
  otherPerKwh: 0.20,
  exportCreditRateInr: 3.5, // Standard solar gross/net export credit
  lastVerified: '2026-01-01',
  isEstimated: true,
};

// Maharashtra MSEDCL Residential (LT-1)
export const MSEDCL_RESIDENTIAL_PLAN: TariffPlan = {
  id: 'msedcl-lt1-residential',
  name: 'Maharashtra MSEDCL (LT-1 Residential)',
  category: 'Residential',
  source: 'discom_preset',
  isTelescopic: true,
  slabs: [
    { fromUnit: 0, toUnit: 100, rate: 5.88 },
    { fromUnit: 101, toUnit: 300, rate: 11.26 },
    { fromUnit: 301, toUnit: 500, rate: 15.72 },
    { fromUnit: 501, toUnit: null, rate: 17.81 },
  ],
  fixedChargePerKwMonth: 128,
  fixedChargePerMonth: 128,
  fuelAdjustmentPerKwh: 0.70,
  dutyPercent: 0.16, // 16% Maharashtra electricity duty
  otherPerKwh: 1.38, // Wheeling charge
  exportCreditRateInr: 3.80,
  lastVerified: '2026-03-01',
};

// Delhi BSES Rajdhani Residential
export const BSES_DELHI_RESIDENTIAL_PLAN: TariffPlan = {
  id: 'bses-delhi-residential',
  name: 'Delhi BSES Rajdhani (Domestic)',
  category: 'Residential',
  source: 'discom_preset',
  isTelescopic: true,
  slabs: [
    { fromUnit: 0, toUnit: 200, rate: 3.00 },
    { fromUnit: 201, toUnit: 400, rate: 4.50 },
    { fromUnit: 401, toUnit: 800, rate: 6.50 },
    { fromUnit: 801, toUnit: 1200, rate: 7.00 },
    { fromUnit: 1201, toUnit: null, rate: 8.00 },
  ],
  fixedChargePerKwMonth: 40,
  fixedChargePerMonth: 80,
  fuelAdjustmentPerKwh: 0.65,
  dutyPercent: 0.05,
  otherPerKwh: 0.38, // Pension trust surcharge
  exportCreditRateInr: 3.11,
  lastVerified: '2026-02-01',
};

// Karnataka BESCOM Residential (LT-2a)
export const BESCOM_RESIDENTIAL_PLAN: TariffPlan = {
  id: 'bescom-karnataka-residential',
  name: 'Karnataka BESCOM (LT-2a Domestic)',
  category: 'Residential',
  source: 'discom_preset',
  isTelescopic: true,
  slabs: [
    { fromUnit: 0, toUnit: 100, rate: 4.75 },
    { fromUnit: 101, toUnit: null, rate: 7.00 },
  ],
  fixedChargePerKwMonth: 110,
  fixedChargePerMonth: 110,
  fuelAdjustmentPerKwh: 0.50,
  dutyPercent: 0.09,
  otherPerKwh: 0.0,
  exportCreditRateInr: 3.56,
  lastVerified: '2026-01-15',
};

// Single-rate flat legacy fallback plan
export const FLAT_FALLBACK_PLAN: TariffPlan = {
  id: 'flat-legacy-fallback',
  name: `Flat Rate (${LEGACY_FALLBACK_TARIFF} ₹/kWh Default Estimate)`,
  category: 'Residential',
  source: 'default_estimate',
  isTelescopic: true,
  slabs: [{ fromUnit: 0, toUnit: null, rate: LEGACY_FALLBACK_TARIFF }],
  fixedChargePerKwMonth: 0,
  fixedChargePerMonth: 0,
  fuelAdjustmentPerKwh: 0,
  dutyPercent: 0,
  otherPerKwh: 0,
  exportCreditRateInr: LEGACY_FALLBACK_TARIFF * 0.5,
  isEstimated: true,
};

export const STANDARD_TARIFF_PLANS: TariffPlan[] = [
  GENERIC_RESIDENTIAL_PLAN,
  MSEDCL_RESIDENTIAL_PLAN,
  BSES_DELHI_RESIDENTIAL_PLAN,
  BESCOM_RESIDENTIAL_PLAN,
  FLAT_FALLBACK_PLAN,
];

export interface TariffContextInput {
  confirmedBillData?: {
    effectiveTariffInr?: number | null;
    sanctionedLoadKw?: number | null;
    tariffCategory?: string | null;
    discomName?: string | null;
    monthlyBillAmountInr?: number | null;
    unitsConsumedKwh?: number | null;
  } | null;
  userSelectedPlan?: TariffPlan | null;
  sanctionedLoadKw?: number | null;
  discomName?: string | null;
}

/**
 * Resolves the appropriate tariff plan based on user inputs using a strict 4-tier priority:
 * 1. Plan from confirmed bill OCR / bill parameters
 * 2. Plan selected or edited by user
 * 3. Generic residential preset
 * 4. LEGACY_FALLBACK_TARIFF
 */
export function getTariffContext(input?: TariffContextInput): TariffPlan {
  if (!input) return GENERIC_RESIDENTIAL_PLAN;

  // Priority 1: User explicitly edited/selected a plan
  if (input.userSelectedPlan) {
    return input.userSelectedPlan;
  }

  // Priority 2: Confirmed bill OCR data with effective tariff
  if (input.confirmedBillData) {
    const bill = input.confirmedBillData;
    const rate = bill.effectiveTariffInr && bill.effectiveTariffInr > 0 ? bill.effectiveTariffInr : null;

    // Check if discom matches a known preset
    if (bill.discomName) {
      const d = bill.discomName.toLowerCase();
      if (d.includes('msedcl') || d.includes('maha')) return MSEDCL_RESIDENTIAL_PLAN;
      if (d.includes('bses') || d.includes('delhi')) return BSES_DELHI_RESIDENTIAL_PLAN;
      if (d.includes('bescom') || d.includes('karnataka')) return BESCOM_RESIDENTIAL_PLAN;
    }

    if (rate !== null) {
      return {
        id: 'bill-ocr-plan',
        name: `Extracted from Bill (${rate.toFixed(2)} ₹/kWh)`,
        category: (bill.tariffCategory as TariffCategory) || 'Residential',
        source: 'bill_ocr',
        isTelescopic: true,
        slabs: [{ fromUnit: 0, toUnit: null, rate }],
        fixedChargePerKwMonth: 50,
        fixedChargePerMonth: 100,
        fuelAdjustmentPerKwh: 0,
        dutyPercent: 0.05,
        otherPerKwh: 0,
        exportCreditRateInr: rate * 0.5,
      };
    }
  }

  // Priority 3: Discom name matching
  if (input.discomName) {
    const d = input.discomName.toLowerCase();
    if (d.includes('msedcl') || d.includes('maha')) return MSEDCL_RESIDENTIAL_PLAN;
    if (d.includes('bses') || d.includes('delhi')) return BSES_DELHI_RESIDENTIAL_PLAN;
    if (d.includes('bescom') || d.includes('karnataka')) return BESCOM_RESIDENTIAL_PLAN;
  }

  // Priority 4: Generic Residential
  return GENERIC_RESIDENTIAL_PLAN;
}

/**
 * Computes exact monthly bill breakdown for a given number of units and connected load.
 * Supports telescopic (progressive) and non-telescopic slab architectures.
 */
export function billForUnits(
  plan: TariffPlan,
  unitsPerMonth: number,
  loadKw?: number | null
): BillBreakdown {
  const units = Math.max(0, unitsPerMonth);
  const load = Math.max(1, loadKw ?? (units > 0 ? Math.max(1, Math.round((units / 120) * 10) / 10) : 2));

  // 1. Energy Charges Calculation
  let energyCharges = 0;

  if (plan.isTelescopic) {
    // Progressive slab calculation
    for (const slab of plan.slabs) {
      if (units <= slab.fromUnit) continue;

      const slabLimit = slab.toUnit !== null ? slab.toUnit : Infinity;
      const unitsInThisSlab = Math.min(units, slabLimit) - slab.fromUnit;

      if (unitsInThisSlab > 0) {
        energyCharges += unitsInThisSlab * slab.rate;
      }
    }
  } else {
    // Non-telescopic: all units billed at rate of highest matching tier
    let applicableRate = plan.slabs[0].rate;
    for (const slab of plan.slabs) {
      if (units >= slab.fromUnit) {
        applicableRate = slab.rate;
      }
    }
    energyCharges = units * applicableRate;
  }

  // 2. Fixed / Demand Charges
  const fixedCharges = plan.fixedChargePerKwMonth > 0
    ? plan.fixedChargePerKwMonth * load
    : plan.fixedChargePerMonth;

  // 3. Fuel Adjustment (FPPCA / FAC)
  const fuelAdjustment = units * plan.fuelAdjustmentPerKwh;

  // 4. Other per-kWh surcharges
  const otherCharges = units * plan.otherPerKwh;

  // 5. Electricity Duty (% applied on Energy Charges + Fuel Adjustment)
  const taxableEnergySum = energyCharges + fuelAdjustment;
  const electricityDuty = taxableEnergySum * plan.dutyPercent;

  // Total
  const total = Math.round((energyCharges + fixedCharges + fuelAdjustment + otherCharges + electricityDuty) * 100) / 100;
  const effectiveRate = units > 0 ? Math.round((total / units) * 100) / 100 : 0;

  return {
    units,
    loadKw: load,
    energyCharges: Math.round(energyCharges * 100) / 100,
    fixedCharges: Math.round(fixedCharges * 100) / 100,
    fuelAdjustment: Math.round(fuelAdjustment * 100) / 100,
    electricityDuty: Math.round(electricityDuty * 100) / 100,
    otherCharges: Math.round(otherCharges * 100) / 100,
    total,
    effectiveRatePerKwh: effectiveRate,
  };
}

/**
 * Inverse bill-to-units resolution using binary search over the monotonic bill function.
 * Given a bill amount in INR, accurately derives monthly kWh units and uncertainty bounds.
 */
export function unitsForBill(
  plan: TariffPlan,
  billRupees: number,
  loadKw?: number | null
): UnitsForBillResult {
  const target = Math.max(0, billRupees);
  const load = loadKw ?? 3.0;

  // Check if bill is at or below the base fixed charges
  const zeroUnitBill = billForUnits(plan, 0, load).total;
  if (target <= zeroUnitBill) {
    return {
      units: 0,
      lowerBound: 0,
      upperBound: 5,
      planUsed: plan,
      effectiveAverageRate: plan.slabs[0].rate,
      marginalRate: plan.slabs[0].rate,
    };
  }

  // Binary search bounds (0 to 15,000 units/mo)
  let low = 0;
  let high = 15000;
  let bestUnits = 0;

  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const computed = billForUnits(plan, mid, load).total;

    if (Math.abs(computed - target) < 0.25) {
      bestUnits = mid;
      break;
    }

    if (computed < target) {
      low = mid;
    } else {
      high = mid;
    }
    bestUnits = mid;
  }

  const roundedUnits = Math.round(bestUnits);
  const lowerBound = Math.max(0, Math.round(bestUnits * 0.95));
  const upperBound = Math.round(bestUnits * 1.05);

  const avgRate = averageRate(plan, roundedUnits, load);
  const mRate = marginalRate(plan, roundedUnits, load);

  return {
    units: roundedUnits,
    lowerBound,
    upperBound,
    planUsed: plan,
    effectiveAverageRate: avgRate,
    marginalRate: mRate,
  };
}

/**
 * Returns average electricity rate in ₹/kWh for a specific consumption level.
 */
export function averageRate(plan: TariffPlan, units: number, loadKw?: number | null): number {
  if (units <= 0) return plan.slabs[0].rate;
  const bill = billForUnits(plan, units, loadKw);
  return Math.round((bill.total / units) * 100) / 100;
}

/**
 * Returns marginal rate (cost of 1 additional unit) in ₹/kWh at current consumption level.
 * Formula: billForUnits(u) - billForUnits(u - 1)
 */
export function marginalRate(plan: TariffPlan, units: number, loadKw?: number | null): number {
  const u = Math.max(1, units);
  const b1 = billForUnits(plan, u, loadKw).total;
  const b0 = billForUnits(plan, u - 1, loadKw).total;
  return Math.round((b1 - b0) * 100) / 100;
}

/**
 * Calculates annual electricity bill by evaluating each of the 12 months individually.
 */
export function annualBill(
  plan: TariffPlan,
  monthlyUnits: number[],
  loadKw?: number | null
): number {
  if (!monthlyUnits || monthlyUnits.length === 0) return 0;
  let sum = 0;
  for (const m of monthlyUnits) {
    sum += billForUnits(plan, m, loadKw).total;
  }
  return Math.round(sum);
}

/**
 * Simulates month-by-month solar savings taking net-metering slabs into account.
 * Crucial: Savings = annualBill(before) - annualBill(after).
 * Never units * flat rate, because fixed charges remain after solar installation.
 */
export function calculateSolarSavings(
  plan: TariffPlan,
  monthlyConsumptionUnits: number[],
  monthlyGenerationUnits: number[],
  loadKw?: number | null,
  exportCreditRate?: number | null
): SolarSavingsBreakdown {
  const count = Math.min(12, Math.max(monthlyConsumptionUnits.length, monthlyGenerationUnits.length));
  const creditRate = exportCreditRate ?? plan.exportCreditRateInr ?? (plan.slabs[0].rate * 0.5);

  let totalBefore = 0;
  let totalAfter = 0;
  let totalImport = 0;
  let totalExport = 0;
  let totalExportCredits = 0;

  for (let i = 0; i < count; i++) {
    const consumed = monthlyConsumptionUnits[i] ?? 0;
    const generated = monthlyGenerationUnits[i] ?? 0;

    // Month Bill Before Solar
    const billBefore = billForUnits(plan, consumed, loadKw);
    totalBefore += billBefore.total;

    // Net Energy Balance
    if (consumed >= generated) {
      // Net Grid Import: Still pay for remaining units + full fixed charges
      const netImport = consumed - generated;
      totalImport += netImport;
      const billAfter = billForUnits(plan, netImport, loadKw);
      totalAfter += billAfter.total;
    } else {
      // Surplus Export: Pay only fixed charges, earn credit for excess units
      const surplus = generated - consumed;
      totalExport += surplus;
      const fixedOnlyBill = billForUnits(plan, 0, loadKw).total;
      const credits = surplus * creditRate;
      totalExportCredits += credits;
      // Net bill after credits (cannot go below zero on monthly cash out)
      const netMonthlyBill = Math.max(0, fixedOnlyBill - credits);
      totalAfter += netMonthlyBill;
    }
  }

  const annualSavings = Math.max(0, Math.round(totalBefore - totalAfter));
  const avgMonthlySavings = Math.round(annualSavings / 12);
  const avgAnnualUnits = monthlyConsumptionUnits.reduce((a, b) => a + b, 0);

  return {
    annualBillBeforeSolar: Math.round(totalBefore),
    annualBillAfterSolar: Math.round(totalAfter),
    annualSavingsInr: annualSavings,
    monthlySavingsInr: avgMonthlySavings,
    gridImportKwh: Math.round(totalImport),
    gridExportKwh: Math.round(totalExport),
    exportCreditsEarnedInr: Math.round(totalExportCredits),
    effectiveAverageRateBefore: averageRate(plan, avgAnnualUnits / 12, loadKw),
    effectiveMarginalRateBefore: marginalRate(plan, avgAnnualUnits / 12, loadKw),
    planName: plan.name,
    planSource: plan.source,
  };
}
