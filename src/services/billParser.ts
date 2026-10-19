// ============================================
// Indian Utility Bill Structured Text Parser
// ============================================

import type {
  ExtractedBillDetails,
  ExtractedField,
  MonthlyHistoryRecord,
} from '@/types/bill';
import { DISCOM_DICTIONARIES, MONTH_NAMES_MAP } from '@/data/discomDictionaries';

/**
 * Normalizes an Indian currency/number string:
 * - Replaces commas in Indian format (e.g. 1,23,456.78 -> 123456.78)
 * - Resolves common OCR symbol confusions in numeric context (O->0, l/I->1, S->5, B->8)
 */
export function normalizeIndianNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim();

  // Strip currency symbols and abbreviations (do not strip '.' when it is part of a number)
  s = s.replace(/₹/g, '').replace(/\b(?:Rs|INR)\b\.?/gi, '').trim();

  // Fix character confusion only when string looks mostly numeric
  s = s.replace(/,/g, '');
  s = s.replace(/o/gi, '0');
  s = s.replace(/[lI|]/g, '1');
  s = s.replace(/[\$Ss]/g, '5');

  // Convert Devanagari digits (U+0966–U+096F) to ASCII digits
  const devMap: Record<string, string> = {
    "\u0966": "0",
    "\u0967": "1",
    "\u0968": "2",
    "\u0969": "3",
    "\u096A": "4",
    "\u096B": "5",
    "\u096C": "6",
    "\u096D": "7",
    "\u096E": "8",
    "\u096F": "9",
  };
  s = s.replace(/[\u0966-\u096F]/g, (d) => devMap[d] ?? d);

  // Remove any remaining non-numeric chars except dot and minus
  s = s.replace(/[^0-9.-]/g, '');
  if (!s || s === '.' || s === '-') return null;

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalizes raw bill text before processing:
 * 1. Converts Devanagari digits (०-९) to ASCII digits (0-9).
 * 2. Maps Marathi month names to their English 3-letter keys.
 *    Note: "मे" is matched ONLY when followed by a separator and a year (e.g., /मे\s*[-/]\s*20\d{2}/).
 */
export function normalizeBillText(raw: string): string {
  if (!raw) return '';
  let s = raw;

  // 1. Convert Devanagari digits (U+0966–U+096F) to ASCII digits
  const devMap: Record<string, string> = {
    '\u0966': '0',
    '\u0967': '1',
    '\u0968': '2',
    '\u0969': '3',
    '\u096A': '4',
    '\u096B': '5',
    '\u096C': '6',
    '\u096D': '7',
    '\u096E': '8',
    '\u096F': '9',
  };
  s = s.replace(/[\u0966-\u096F]/g, (d) => devMap[d] ?? d);

  // 2. Map Marathi month names (longer / multi-syllable forms first)
  s = s.replace(/(?:जानेवारी|जान)/gu, 'jan');
  s = s.replace(/(?:फेब्रुवारी|फेब्रु)/gu, 'feb');
  s = s.replace(/मार्च/gu, 'mar');
  s = s.replace(/(?:एप्रिल|एप्री)/gu, 'apr');
  // Match "मे" only when followed by a separator and a year, e.g., मे-2026 or मे / 2026
  s = s.replace(/मे(?=\s*[-\/]\s*20\d{2})/gu, 'may');
  s = s.replace(/जून/gu, 'jun');
  s = s.replace(/जुलै/gu, 'jul');
  s = s.replace(/(?:ऑगस्ट|ऑग)/gu, 'aug');
  s = s.replace(/(?:सप्टेंबर|सप्टे)/gu, 'sep');
  s = s.replace(/(?:ऑक्टोबर|ऑक्टो)/gu, 'oct');
  s = s.replace(/(?:नोव्हेंबर|नोव्हे)/gu, 'nov');
  s = s.replace(/(?:डिसेंबर|डिसे)/gu, 'dec');

  return s;
}

/**
 * Masks consumer ID for privacy: retains only last 4 digits (e.g. "•••••••1234")
 */
export function maskConsumerNumber(raw: string | null): string | null {
  if (!raw) return null;
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length <= 4) return raw;
  const last4 = digitsOnly.slice(-4);
  return '•'.repeat(Math.max(4, digitsOnly.length - 4)) + last4;
}

/**
 * Parses dates in dd/mm/yyyy, dd-mm-yyyy, dd-MMM-yyyy formats
 */
function parseBillDate(raw: string): string | null {
  const match = raw.match(/(\d{1,2})[\/\-.]([a-zA-Z]{3}|\d{1,2})[\/\-.](\d{2,4})/);
  if (!match) return null;

  const day = match[1].padStart(2, '0');
  let month = match[2];
  let year = match[3];
  if (year.length === 2) year = `20${year}`;

  if (isNaN(Number(month))) {
    const mNum = MONTH_NAMES_MAP[month.toLowerCase()];
    if (mNum) month = String(mNum).padStart(2, '0');
    else return null;
  } else {
    month = month.padStart(2, '0');
  }

  return `${year}-${month}-${day}`;
}

/**
 * Extracts 6-12 month consumption history table
 */
export function extractMonthlyHistory(text: string): MonthlyHistoryRecord[] {
  const records: MonthlyHistoryRecord[] = [];
  const lines = normalizeBillText(text).split('\n');

  const monthRegex = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s:.\-\/]+(?:['`]?(\d{2,4}))?[\s:.\-=]*([0-9,OIlS]{2,6}(?:\.\d+)?)\b/gi;

  for (const line of lines) {
    let match: RegExpExecArray | null;
    while ((match = monthRegex.exec(line)) !== null) {
      const monthPrefix = match[1].toLowerCase();
      const mNum = MONTH_NAMES_MAP[monthPrefix];
      if (!mNum) continue;

      const rawVal = match[3];
      const val = normalizeIndianNumber(rawVal);
      if (val === null || val <= 0 || val > 15000) continue; // Plausible single month range

      const yearStr = match[2] ? (match[2].length === 2 ? `20${match[2]}` : match[2]) : '2026';
      const monthKey = `${yearStr}-${String(mNum).padStart(2, '0')}`;

      // Avoid duplicates
      if (!records.some(r => r.month === monthKey)) {
        records.push({
          month: monthKey,
          label: monthPrefix.toUpperCase(),
          kwh: Math.round(val),
          confidence: 0.85,
          source: 'ocr',
        });
      }
    }
  }

  return records.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Full structural parser for utility bills
 */
export function parseUtilityBillText(rawText: string): ExtractedBillDetails {
  const normalized = normalizeBillText(rawText.replace(/\r/g, ' ').trim());
  const lower = normalized.toLowerCase();
  const dict = DISCOM_DICTIONARIES.general;

  // 1. Detect Discom / Provider
  let detectedDiscom: string | null = null;
  for (const alias of dict.discomAliases) {
    if (lower.includes(alias)) {
      detectedDiscom = alias.toUpperCase();
      break;
    }
  }

  // 2. Units Consumed
  let unitsConsumed: ExtractedField<number> = {
    value: null,
    unit: 'kWh',
    confidence: 0,
    source: 'ocr',
    rawText: '',
  };

  // Patterns ordered most-specific → least-specific.
  // Marathi MSEDCL column headers are checked first to avoid false positives
  // from bar-chart axis tick labels (250 / 500 / 750) that Tesseract reads
  // earlier in the OCR text stream than the actual meter-reading table.
  const unitsPatterns: RegExp[] = [
    // FIX 1a — Marathi: एकूण वापर (Net/Total Units) — highest priority for MSEDCL bills
    /(?:एकूण\s*वापर|एकूण\s*युनिट)[\s:=]*([0-9,]{1,7}(?:\.\d+)?)/u,
    // FIX 1b — Marathi: युनिट column header followed by a numeric value
    /युनिट[\s:=]+([0-9,]{2,6})/u,
    // English structured keywords
    /(?:units\s+consumed|units\s+billed|total\s+consumption|net\s+units|billed\s+units|consumption\s*\(kwh\)|energy\s+consumed|total\s+kwh)[\s:=]*([0-9,OIlS]{1,7}(?:\.\d+)?)/i,
    // Generic fallbacks — LAST RESORT (prone to chart-axis pollution)
    /(\d[\d,]*)\s*(?:units|kwh|unit)\s*(?:consumed|billed)?/i,
    /(?:units|kwh)[\s:=]+([0-9,OIlS]{2,6})/i,
  ];

  for (const pat of unitsPatterns) {
    const m = normalized.match(pat);
    if (m && m[1]) {
      const parsed = normalizeIndianNumber(m[1]);
      if (parsed !== null && parsed > 5 && parsed < 200000) {
        // FIX 4: Skip bar-chart axis tick numbers — isolated round multiples of 250
        // below 1000 (e.g. 250, 500, 750 from MSEDCL horizontal bar chart x-axis).
        if (parsed < 1000 && parsed % 250 === 0) continue;

        unitsConsumed = {
          value: Math.round(parsed),
          unit: 'kWh',
          confidence: 0.90,
          source: 'ocr',
          rawText: m[0],
        };
        break;
      }
    }
  }

  // 3. Billing Period & Bimonthly Detection
  const periodMatch = normalized.match(/(?:bill(?:ing)?\s+period|period|bill\s+duration)[\s:=]*([0-9\/\-.a-zA-Z\s]+(?:to|-)[\s0-9\/\-.a-zA-Z]+)/i);
  let isBimonthly = false;
  let billingDays: number | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;

  if (periodMatch && periodMatch[1]) {
    const rawPeriod = periodMatch[1];
    const parts = rawPeriod.split(/\bto\b|-/i);
    if (parts.length >= 2) {
      startDate = parseBillDate(parts[0].trim());
      endDate = parseBillDate(parts[1].trim());
      if (startDate && endDate) {
        const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
        billingDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (billingDays > 45 && billingDays < 75) {
          isBimonthly = true;
        }
      }
    }
  }

  // Also check explicit "bimonthly" keyword
  if (lower.includes('bi-monthly') || lower.includes('bimonthly') || lower.includes('2 months')) {
    isBimonthly = true;
  }

  // 4. Current & Previous Readings
  // FIX 2: Extended patterns include Marathi labels used by MSEDCL:
  //   चालू रिडिंग = Current Reading  |  मागील रिडिंग = Previous Reading  |  गुणक अवयव = Multiplying Factor
  const prevReadingMatch = normalized.match(
    /(?:previous|past|मागील)[^0-9]{0,25}([0-9]{4,7}(?:\.[0-9]+)?)/iu
  );
  const currReadingMatch = normalized.match(
    /(?:current|present|चालू)[^0-9]{0,25}([0-9]{4,7}(?:\.[0-9]+)?)/iu
  );
  const mfMatch = normalized.match(
    /(?:multiplying\s+factor|mf|गुणक)[\s:=]*([0-9]+(?:\.[0-9]+)?)/iu
  );

  const prevReading = prevReadingMatch ? normalizeIndianNumber(prevReadingMatch[1]) : null;
  const currReading = currReadingMatch ? normalizeIndianNumber(currReadingMatch[1]) : null;
  const mf = mfMatch ? parseFloat(mfMatch[1]) || 1.0 : 1.0;
  let derivedUnits: number | null = null;

  if (currReading !== null && prevReading !== null && currReading >= prevReading) {
    derivedUnits = Math.round((currReading - prevReading) * mf);
    // FIX 3: Use derived reading when (a) units not found at all, or
    // (b) OCR matched a suspicious value with low confidence (e.g. a chart axis
    // tick that slipped through the % 250 guard due to image noise).
    // Confidence threshold < 0.75 intentionally below the normal 0.90 OCR match.
    if (derivedUnits > 0 && (unitsConsumed.value === null || unitsConsumed.confidence < 0.75)) {
      unitsConsumed = {
        value: derivedUnits,
        unit: 'kWh',
        confidence: 0.88,
        source: 'derived',
        rawText: `Current: ${currReading}, Previous: ${prevReading}, MF: ${mf}`,
      };
    }
  }

  // 5. Total Payable Amount (₹)
  let totalAmount: ExtractedField<number> = {
    value: null,
    unit: 'INR',
    confidence: 0,
    source: 'ocr',
    rawText: '',
  };

  const amountPatterns = [
    /(?:net\s+payable|total\s+payable|amount\s+payable|total\s+bill\s+amount|bill\s+amount|net\s+amount)[\s:=₹Rs\.]*([0-9,OIlS]{2,8}(?:\.\d{2})?)/i,
    /(?:total\s+due|payable\s+amount)[\s:=₹Rs\.]*([0-9,OIlS]{2,8}(?:\.\d{2})?)/i,
    /[₹Rs]\.?\s*([0-9,]{2,8}(?:\.\d{2})?)/i,
  ];

  for (const pat of amountPatterns) {
    const m = normalized.match(pat);
    if (m && m[1]) {
      const parsed = normalizeIndianNumber(m[1]);
      if (parsed !== null && parsed >= 50 && parsed < 2000000) {
        totalAmount = {
          value: Math.round(parsed),
          unit: 'INR',
          confidence: 0.88,
          source: 'ocr',
          rawText: m[0],
        };
        break;
      }
    }
  }

  // 6. Energy Charges & Derived Tariff
  const energyChargesMatch = normalized.match(/(?:energy\s+charges|wheeling\s+charges)[\s:=₹Rs\.]*([0-9,OIlS]{2,8}(?:\.\d{2})?)/i);
  const energyChargesInr = energyChargesMatch ? normalizeIndianNumber(energyChargesMatch[1]) : null;

  let effectiveTariffInr: number | null = null;
  if (unitsConsumed.value && unitsConsumed.value > 0) {
    if (energyChargesInr && energyChargesInr > 0) {
      effectiveTariffInr = Math.round((energyChargesInr / unitsConsumed.value) * 100) / 100;
    } else if (totalAmount.value && totalAmount.value > 0) {
      // Approximate tariff factoring out standard ~20% fixed charges
      effectiveTariffInr = Math.round(((totalAmount.value * 0.82) / unitsConsumed.value) * 100) / 100;
    }
  }

  // 7. Sanctioned / Connected Load (kW)
  let sanctionedLoad: ExtractedField<number> = {
    value: null,
    unit: 'kW',
    confidence: 0,
    source: 'ocr',
    rawText: '',
  };

  const loadPatterns = [
    /(?:sanctioned\s+load|connected\s+load|contract\s+demand|contract\s+load|sanc\s+load|conn\s+load)[\s:=]*([0-9,OIlS]{1,5}(?:\.\d+)?)\s*(?:kw|kva|hp)?/i,
    /(\d+(?:\.\d+)?)\s*(?:kw|kva)\s*(?:sanctioned|connected)/i,
  ];

  for (const pat of loadPatterns) {
    const m = normalized.match(pat);
    if (m && m[1]) {
      const parsed = normalizeIndianNumber(m[1]);
      if (parsed !== null && parsed > 0.1 && parsed <= 500) {
        sanctionedLoad = {
          value: Math.round(parsed * 10) / 10,
          unit: 'kW',
          confidence: 0.85,
          source: 'ocr',
          rawText: m[0],
        };
        break;
      }
    }
  }

  // 8. Consumer Number (Masked)
  const consumerMatch = normalized.match(/(?:consumer\s+no|consumer\s+number|ca\s+no|k\s+no|account\s+no|customer\s+id)[\s:=]*([a-zA-Z0-9\-\/]{6,20})/i);
  const consumerNumber = consumerMatch ? consumerMatch[1].trim() : null;
  const maskedConsumerNumber = maskConsumerNumber(consumerNumber);

  // 9. Tariff Category & Phase
  let tariffCategory: string | null = null;
  if (lower.includes('residential') || lower.includes('domestic') || lower.includes('lt-1') || lower.includes('lt-i')) {
    tariffCategory = 'Residential';
  } else if (lower.includes('commercial') || lower.includes('lt-2') || lower.includes('lt-ii') || lower.includes('non-domestic')) {
    tariffCategory = 'Commercial';
  } else if (lower.includes('industrial')) {
    tariffCategory = 'Industrial';
  }

  let phase: '1-phase' | '3-phase' | 'unknown' = 'unknown';
  if (lower.includes('3-phase') || lower.includes('3 phase') || lower.includes('three phase')) {
    phase = '3-phase';
  } else if (lower.includes('1-phase') || lower.includes('1 phase') || lower.includes('single phase')) {
    phase = '1-phase';
  }

  const hasExistingSolar = lower.includes('solar') || lower.includes('net meter') || lower.includes('prosumer');

  // 10. Historical monthly consumption records
  const consumptionHistory = extractMonthlyHistory(normalized);

  // If bimonthly was detected and unitsConsumed exists, convert to average monthly
  if (isBimonthly && unitsConsumed.value !== null) {
    unitsConsumed = {
      ...unitsConsumed,
      value: Math.round(unitsConsumed.value / 2),
      warning: 'Bill is bi-monthly (2-month cycle). Units converted to monthly average.',
    };
  }

  // Overall confidence calculation
  let confScore = 0.40;
  if (unitsConsumed.value !== null) confScore += 0.30;
  if (totalAmount.value !== null) confScore += 0.15;
  if (consumptionHistory.length >= 3) confScore += 0.10;
  if (sanctionedLoad.value !== null) confScore += 0.05;

  const finalConfidence = Math.min(0.98, Math.round(confScore * 100) / 100);
  const confidenceTier = finalConfidence >= 0.75 ? 'high' : finalConfidence >= 0.50 ? 'medium' : 'low';

  return {
    unitsConsumedKwh: unitsConsumed,
    billingPeriod: {
      value: { startDate, endDate, billingDays, isBimonthly },
      confidence: billingDays ? 0.8 : 0.4,
      source: 'ocr',
      rawText: periodMatch ? periodMatch[0] : '',
    },
    meterReading: {
      value: { previous: prevReading, current: currReading, multiplyingFactor: mf, derivedUnits },
      confidence: derivedUnits !== null ? 0.85 : 0.3,
      source: 'ocr',
      rawText: '',
    },
    consumptionHistory,
    historyMonthsCount: consumptionHistory.length,
    charges: {
      totalPayableInr: totalAmount.value,
      energyChargesInr,
      fixedDemandChargesInr: null,
      electricityDutyInr: null,
      fuelAdjustmentInr: null,
      effectiveTariffInrPerKwh: effectiveTariffInr,
    },
    totalAmount,
    effectiveTariff: {
      value: effectiveTariffInr,
      unit: '₹/kWh',
      confidence: effectiveTariffInr ? 0.8 : 0.4,
      source: effectiveTariffInr ? 'derived' : 'ocr',
      rawText: '',
    },
    connection: {
      consumerNumber,
      maskedConsumerNumber,
      discomName: detectedDiscom,
      tariffCategory,
      phase,
      sanctionedLoadKw: sanctionedLoad.value,
      hasExistingSolar,
    },
    sanctionedLoad,
    overallConfidence: finalConfidence,
    confidenceTier,
    warnings: [],
    rawOcrText: normalized,
  };
}
