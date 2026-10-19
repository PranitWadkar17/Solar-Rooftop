// ============================================
// Bill To Optimization Input Adapter
// ============================================

import type { ConfirmedBillData } from '@/types/bill';
import type { ElectricityConsumptionProfile, MonthlyConsumption } from '@/types/index';
import { DEFAULT_TARIFF_RATE_INR } from '@/utils/consumptionUtils';
import { getTariffContext } from './tariffService.js';

/**
 * Converts ConfirmedBillData from the review panel into the exact
 * ElectricityConsumptionProfile consumed by the optimizer and EnergyPage.
 */
export function convertBillDataToConsumptionProfile(
  data: ConfirmedBillData,
  fileName: string = 'bill_upload.jpg'
): ElectricityConsumptionProfile {
  let monthlyKwh: MonthlyConsumption[] = [];

  if (data.monthlyKwhProfile && data.monthlyKwhProfile.length > 0) {
    monthlyKwh = data.monthlyKwhProfile.map(m => ({
      month: m.month,
      kwh: m.kwh,
    }));
  } else {
    // Distribute monthly average across 12 months
    const avg = data.monthlyAverageKwh || Math.round(data.annualKwh / 12);
    monthlyKwh = Array.from({ length: 12 }, (_, i) => ({
      month: `2026-${String(i + 1).padStart(2, '0')}`,
      kwh: avg,
    }));
  }

  const effectiveTariff = data.effectiveTariffInr > 0 ? data.effectiveTariffInr : DEFAULT_TARIFF_RATE_INR;
  const plan = getTariffContext({ confirmedBillData: data });

  return {
    annualKwh: data.annualKwh,
    monthlyKwh,
    source: 'bill_upload',
    confidence: 0.95, // High confidence since user reviewed and confirmed
    billFileName: fileName,
    uploadedAt: data.confirmedAt || new Date().toISOString(),
    monthlyBillAmountInr: data.monthlyBillAmountInr ?? Math.round(data.monthlyAverageKwh * effectiveTariff),
    tariffRateInr: effectiveTariff,
    billData: data,
    tariffPlan: plan,
  };
}
