import { buildConsumptionComparison } from '../src/services/energyAnalysisService';

const comparison = buildConsumptionComparison(
  {
    systemCapacityKWp: 5,
  } as any,
  {
    annualKwh: 4800,
    monthlyKwh: [
      { month: '2026-01', kwh: 400 },
      { month: '2026-02', kwh: 350 },
    ],
    source: 'bill_upload',
    confidence: 0.92,
    billFileName: 'bill.png',
    uploadedAt: '2026-10-13T00:00:00.000Z',
  }
);

if (comparison.annualGenerationKwh <= 0) {
  throw new Error('Expected annual generation to be estimated from the installed system capacity.');
}

if (comparison.annualConsumptionKwh !== 4800) {
  throw new Error('Expected annual consumption to be taken from the uploaded bill profile.');
}

if (comparison.status === 'unavailable') {
  throw new Error('Expected a comparison status when consumption data exists.');
}

if (comparison.selfSupplyScore === null || comparison.selfSupplyScore <= 0) {
  throw new Error('Expected a positive self-supply score when consumption data exists.');
}

if (comparison.monthlyComparison.length === 0) {
  throw new Error('Expected monthly generation-vs-use comparison data.');
}
