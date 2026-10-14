import type { ElectricityConsumptionProfile, MonthlyConsumption } from '@/types/index.js';

export function sumMonthlyConsumption(monthlyKwh: MonthlyConsumption[] = []): number {
  return monthlyKwh.reduce((total, item) => total + (Number.isFinite(item.kwh) ? item.kwh : 0), 0);
}

export function createConsumptionProfile(
  input: Partial<ElectricityConsumptionProfile> & Pick<ElectricityConsumptionProfile, 'monthlyKwh' | 'source'>
): ElectricityConsumptionProfile {
  const annualKwh = input.annualKwh ?? sumMonthlyConsumption(input.monthlyKwh);

  return {
    annualKwh,
    monthlyKwh: input.monthlyKwh,
    source: input.source,
    confidence: input.confidence ?? null,
    billFileName: input.billFileName ?? null,
    uploadedAt: input.uploadedAt ?? null,
  };
}
