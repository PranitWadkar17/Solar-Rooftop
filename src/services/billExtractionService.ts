import Tesseract from 'tesseract.js';
import { createConsumptionProfile, sumMonthlyConsumption } from '@/services/consumptionService';
import type { ElectricityConsumptionProfile, MonthlyConsumption } from '@/types/index.js';

export interface ExtractedBillConsumption {
  annualKwh: number | null;
  monthlyKwh: MonthlyConsumption[];
  confidence: number;
  extractedText: string;
}

const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function normalizeNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, '').replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMonthlyValues(text: string): MonthlyConsumption[] {
  const monthPattern = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[^0-9]{0,12}(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/gi;
  const matches = Array.from(text.matchAll(monthPattern));
  const monthlyValues: MonthlyConsumption[] = [];

  for (const match of matches) {
    const month = match[1]?.toLowerCase();
    const value = normalizeNumber(match[2] ?? '');
    if (!month || value === null) continue;
    const index = monthNames.indexOf(month);
    if (index === -1) continue;

    const monthKey = `2026-${String(index + 1).padStart(2, '0')}`;
    monthlyValues.push({ month: monthKey, kwh: value });
  }

  return monthlyValues;
}

export function extractConsumptionFromText(rawText: string): ExtractedBillConsumption {
  const normalized = rawText.replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();

  const annualPatterns = [
    /annual(?:\s+energy)?\s+(?:consumption|usage|total)\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:kwh|units|unit)/i,
    /total\s+(?:consumption|usage|energy)\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:kwh|units|unit)/i,
    /(?:consumption|usage|energy)\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:kwh|units|unit)/i,
  ];

  let annualKwh: number | null = null;
  for (const pattern of annualPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    annualKwh = normalizeNumber(match[1] ?? '');
    if (annualKwh !== null) break;
  }

  const monthlyKwh = extractMonthlyValues(normalized);
  if (annualKwh === null && monthlyKwh.length > 0) {
    annualKwh = sumMonthlyConsumption(monthlyKwh);
  }

  const confidence = Math.min(
    0.96,
    0.4 +
      (annualKwh !== null ? 0.3 : 0) +
      (monthlyKwh.length > 0 ? 0.2 : 0) +
      (normalized.toLowerCase().includes('kwh') ? 0.1 : 0)
  );

  return {
    annualKwh,
    monthlyKwh,
    confidence,
    extractedText: normalized,
  };
}

export async function extractConsumptionFromImage(file: File): Promise<ElectricityConsumptionProfile> {
  const { data } = await Tesseract.recognize(file, 'eng', {
    logger: () => undefined,
  });

  const extraction = extractConsumptionFromText(data.text ?? '');

  return createConsumptionProfile({
    annualKwh: extraction.annualKwh,
    monthlyKwh: extraction.monthlyKwh,
    source: 'bill_upload',
    confidence: extraction.confidence,
    billFileName: file.name,
    uploadedAt: new Date().toISOString(),
  });
}
