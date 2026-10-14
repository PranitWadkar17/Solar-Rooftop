import { createConsumptionProfile, sumMonthlyConsumption } from '../src/services/consumptionService';

const profile = createConsumptionProfile({
  annualKwh: 4800,
  monthlyKwh: [
    { month: '2026-01', kwh: 400 },
    { month: '2026-02', kwh: 350 },
  ],
  source: 'bill_upload',
  confidence: 0.92,
  billFileName: 'electricity-bill.png',
  uploadedAt: '2026-10-13T00:00:00.000Z',
});

if (profile.annualKwh !== 4800) {
  throw new Error('Expected annualKwh to be preserved.');
}

if (sumMonthlyConsumption(profile.monthlyKwh) !== 750) {
  throw new Error('Expected monthly sum to match the provided values.');
}

if (profile.source !== 'bill_upload') {
  throw new Error('Expected bill upload source to be tracked.');
}
