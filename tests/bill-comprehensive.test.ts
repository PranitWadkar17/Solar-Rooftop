// ============================================
// Comprehensive Bill Extraction & Parsing Unit Tests
// ============================================

import {
  normalizeIndianNumber,
  maskConsumerNumber,
  parseUtilityBillText,
  extractMonthlyHistory,
} from '../src/services/billParser.js';
import { validateAndCrossCheckBill } from '../src/services/billValidation.js';
import { convertBillDataToConsumptionProfile } from '../src/services/billToOptimizationInput.js';
import type { ConfirmedBillData } from '../src/types/bill.js';

console.log('--- Starting Comprehensive Bill Extraction & Validation Tests ---');

// TEST 1: Number Normalization with Indian Commas & OCR Character Confusions
const testNumbers = [
  { raw: '1,23,456.78', expected: 123456.78 },
  { raw: '₹ 4,800.00', expected: 4800 },
  { raw: 'Rs. 2,50O', expected: 2500 }, // 'O' -> '0'
  { raw: 'l,250', expected: 1250 },      // 'l' -> '1'
  { raw: '3,5O0', expected: 3500 },      // 'O' -> '0'
  { raw: 'S50', expected: 550 },         // '$' / 'S' -> '5'
];

for (const t of testNumbers) {
  const result = normalizeIndianNumber(t.raw);
  if (result !== t.expected) {
    throw new Error(`Normalization failed for "${t.raw}". Expected ${t.expected}, got ${result}`);
  }
}
console.log('✓ TEST 1 Passed: Indian number normalization and OCR confusion mapping');

// TEST 2: Consumer Number Privacy Masking
const rawConsumer = '123456789012';
const masked = maskConsumerNumber(rawConsumer);
if (!masked || !masked.endsWith('9012') || !masked.startsWith('••••')) {
  throw new Error(`Consumer masking failed: ${masked}`);
}
console.log('✓ TEST 2 Passed: Privacy masking (masked to ' + masked + ')');

// TEST 3: Synthetic MSEDCL Bill Parsing
const syntheticMsedclBill = `
MAHADISCOM - MAHARASHTRA STATE ELECTRICITY DISTRIBUTION CO. LTD.
Consumer No: 028512345678
Tariff Category: LT-1 Residential 1-Phase
Sanctioned Load: 4.5 kW
Bill Date: 12/03/2026
Bill Period: 10/02/2026 to 10/03/2026
Previous Reading: 14500
Current Reading: 14880
Multiplying Factor: 1.0
Units Consumed: 380 kWh
Energy Charges: ₹ 2,850.00
Net Amount Payable: ₹ 3,420.00

Consumption History:
Oct 25: 340
Nov 25: 310
Dec 25: 290
Jan 26: 300
Feb 26: 350
Mar 26: 380
`;

const parsedMsedcl = parseUtilityBillText(syntheticMsedclBill);

if (parsedMsedcl.unitsConsumedKwh.value !== 380) {
  throw new Error(`Expected unitsConsumed to be 380, got ${parsedMsedcl.unitsConsumedKwh.value}`);
}
if (parsedMsedcl.totalAmount.value !== 3420) {
  throw new Error(`Expected totalAmount to be 3420, got ${parsedMsedcl.totalAmount.value}`);
}
if (parsedMsedcl.sanctionedLoad.value !== 4.5) {
  throw new Error(`Expected sanctionedLoad to be 4.5, got ${parsedMsedcl.sanctionedLoad.value}`);
}
if (parsedMsedcl.connection.discomName !== 'MAHADISCOM' && parsedMsedcl.connection.discomName !== 'MSEDCL') {
  throw new Error(`Expected Discom to be detected, got ${parsedMsedcl.connection.discomName}`);
}
if (parsedMsedcl.consumptionHistory.length < 5) {
  throw new Error(`Expected at least 5 history months, got ${parsedMsedcl.consumptionHistory.length}`);
}
console.log('✓ TEST 3 Passed: Full structural parsing on synthetic MSEDCL bill');

// TEST 4: Cross-Check Validation
const validation = validateAndCrossCheckBill(parsedMsedcl);
if (!validation.isValid) {
  throw new Error('Expected validation to be valid');
}
if (validation.crossChecksPassed.length < 2) {
  throw new Error(`Expected multiple cross-checks to pass, got ${validation.crossChecksPassed.length}`);
}
console.log('✓ TEST 4 Passed: Cross-check rules passed (' + validation.crossChecksPassed.length + ' checks)');

// TEST 5: Bimonthly Bill Detection & Monthly Normalization
const bimonthlyBill = `
TANGEDCO Tamil Nadu Electricity Board
Bi-Monthly Billing Cycle
Units Consumed: 700 kWh
Total Payable: ₹ 4,900
`;
const parsedBimonthly = parseUtilityBillText(bimonthlyBill);
// Should normalize 700 bimonthly units to 350 monthly units
if (parsedBimonthly.unitsConsumedKwh.value !== 350) {
  throw new Error(`Expected bimonthly 700 kWh to be normalized to 350 kWh, got ${parsedBimonthly.unitsConsumedKwh.value}`);
}
console.log('✓ TEST 5 Passed: Bi-monthly bill detection and normalization to monthly units');

// TEST 6: Adapter Output for Optimizer
const confirmedData: ConfirmedBillData = {
  annualKwh: 4560,
  monthlyAverageKwh: 380,
  unitsConsumedKwh: 380,
  monthlyKwhProfile: parsedMsedcl.consumptionHistory.map(h => ({ month: h.month, kwh: h.kwh })),
  monthlyBillAmountInr: 3420,
  effectiveTariffInr: 7.5,
  sanctionedLoadKw: 4.5,
  consumerNumberMasked: '••••••••5678',
  discomName: 'MSEDCL',
  tariffCategory: 'Residential',
  isBimonthly: false,
  warnings: [],
  confirmedAt: new Date().toISOString(),
};

const profile = convertBillDataToConsumptionProfile(confirmedData, 'sample_msedcl.jpg');
if (profile.annualKwh !== 4560) {
  throw new Error(`Adapter annualKwh mismatch: expected 4560, got ${profile.annualKwh}`);
}
if (profile.source !== 'bill_upload') {
  throw new Error(`Adapter source mismatch: expected bill_upload, got ${profile.source}`);
}
if (!profile.billData || profile.billData.discomName !== 'MSEDCL') {
  throw new Error('Adapter did not preserve billData audit metadata');
}
console.log('✓ TEST 6 Passed: Optimizer adapter profile conversion');

// TEST 7: Legacy bill-extraction test contract compatibility
const legacyBillText = `
Electricity Bill
Annual Consumption: 4,800 kWh
Jan 410 kWh
Feb 360 kWh
`;
const historyParsed = extractMonthlyHistory(legacyBillText);
if (historyParsed.length < 2) {
  throw new Error(`Expected at least 2 monthly history entries, got ${historyParsed.length}`);
}
console.log('✓ TEST 7 Passed: Backward compatibility with legacy test patterns');

console.log('---------------------------------------------------------------');
console.log('🎉 ALL 7 TEST SUITES PASSED CLEANLY (Zero Failures)');
console.log('---------------------------------------------------------------');
