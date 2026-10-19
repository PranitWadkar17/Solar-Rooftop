// ============================================
// Indian Utility Bill Validation & Cross-Checking Service
// ============================================

import type { ExtractedBillDetails } from '@/types/bill';

export interface ValidationSummary {
  isValid: boolean;
  warnings: string[];
  crossChecksPassed: string[];
  recommendations: string[];
  adjustedConfidence: number;
}

/**
 * Cross-checks extracted parameters against physical, financial, and electrical constraints
 */
export function validateAndCrossCheckBill(details: ExtractedBillDetails): ValidationSummary {
  const warnings: string[] = [];
  const crossChecksPassed: string[] = [];
  const recommendations: string[] = [];
  let adjustedConfidence = details.overallConfidence;

  const units = details.unitsConsumedKwh.value;
  const amount = details.totalAmount.value;
  const load = details.sanctionedLoad.value;
  const history = details.consumptionHistory;
  const reading = details.meterReading.value;
  const period = details.billingPeriod.value;

  // 1. Sanity Check: Units Range
  if (units !== null) {
    if (units < 15) {
      warnings.push(`Extracted units (${units} kWh) are suspiciously low for a residential bill.`);
      adjustedConfidence -= 0.15;
    } else if (units > 8000) {
      warnings.push(`High consumption detected (${units} kWh). If this is a commercial property, please verify.`);
      recommendations.push('High power demand structure: verify tariff category and connected load.');
    } else {
      crossChecksPassed.push(`Consumption sanity passed: ${units} kWh/mo within typical limits.`);
    }
  } else {
    warnings.push('Units consumed (kWh) could not be detected with high confidence.');
    recommendations.push('Please manually verify or enter your monthly units or bill amount.');
    adjustedConfidence -= 0.30;
  }

  // 2. Cross-check: Meter Reading Delta vs Units Consumed
  if (reading?.derivedUnits && units !== null) {
    const diff = Math.abs(reading.derivedUnits - units);
    const tolerance = Math.max(5, units * 0.05); // 5% tolerance
    if (diff <= tolerance) {
      crossChecksPassed.push(`Meter reading delta matches billed units (${reading.derivedUnits} vs ${units} kWh).`);
      adjustedConfidence += 0.08;
    } else {
      warnings.push(`Meter difference (${reading.derivedUnits} kWh) differs from billed units (${units} kWh).`);
    }
  }

  // 3. Cross-check: Amount vs Units Effective Rate
  if (amount !== null && units !== null && units > 0) {
    const rawRate = amount / units;
    if (rawRate < 2.0) {
      warnings.push(`Derived rate (₹${rawRate.toFixed(1)}/kWh) seems too low. Verify amount or units.`);
      adjustedConfidence -= 0.10;
    } else if (rawRate > 22.0) {
      warnings.push(`Derived rate (₹${rawRate.toFixed(1)}/kWh) seems high. Likely includes heavy arrears or fixed penalties.`);
      recommendations.push('Effective tariff adjusted to residential energy baseline.');
    } else {
      crossChecksPassed.push(`Bill amount and units are coherent (Effective tariff: ~₹${rawRate.toFixed(1)}/kWh).`);
      adjustedConfidence += 0.05;
    }
  }

  // 4. Sanity Check: Sanctioned Load
  if (load !== null) {
    if (load < 0.5 || load > 500) {
      warnings.push(`Sanctioned load (${load} kW) is outside typical range.`);
    } else {
      crossChecksPassed.push(`Sanctioned load verified: ${load} kW.`);
    }
  }

  // 5. Cross-check: Historical Months Coherence
  if (history.length >= 3 && units !== null) {
    const avgHistory = history.reduce((sum, h) => sum + h.kwh, 0) / history.length;
    const deviation = Math.abs(avgHistory - units) / avgHistory;
    if (deviation < 0.6) {
      crossChecksPassed.push(`Current bill is consistent with your ${history.length}-month billing history.`);
      adjustedConfidence += 0.05;
    } else {
      warnings.push(`Current units (${units} kWh) deviate significantly from historical average (~${Math.round(avgHistory)} kWh).`);
    }
  }

  // 6. Billing Cycle Check (Bimonthly)
  if (period?.isBimonthly) {
    warnings.push('Bi-monthly billing cycle detected. Consumption has been normalized to a monthly average.');
  }

  // Clamp adjusted confidence to [0.10, 0.99]
  adjustedConfidence = Math.max(0.10, Math.min(0.99, Math.round(adjustedConfidence * 100) / 100));

  return {
    isValid: units !== null || amount !== null,
    warnings,
    crossChecksPassed,
    recommendations,
    adjustedConfidence,
  };
}
