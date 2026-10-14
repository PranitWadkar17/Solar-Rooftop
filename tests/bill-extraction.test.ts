import { extractConsumptionFromText } from '../src/services/billExtractionService';

const parsed = extractConsumptionFromText(`
Electricity Bill
Annual Consumption: 4,800 kWh
Jan 410 kWh
Feb 360 kWh
`);

if (parsed.annualKwh !== 4800) {
  throw new Error('Expected annual consumption to be extracted from the bill summary.');
}

if (parsed.monthlyKwh.length < 2) {
  throw new Error('Expected monthly values to be extracted from bill text.');
}

if (parsed.confidence < 0.7) {
  throw new Error('Expected a confidence score above the minimum threshold.');
}
