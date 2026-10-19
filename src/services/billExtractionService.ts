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
  const worker = await Tesseract.createWorker('eng', 1, { logger: () => undefined });
  const { data } = await worker.recognize(file);
  await worker.terminate();

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

// Re-export new modules for clean consumer imports
export * from '@/types/bill';
export { preprocessBillImage, validateBillImageFile } from './billImagePreprocessing';
export { parseUtilityBillText } from './billParser';
export { validateAndCrossCheckBill } from './billValidation';
export { convertBillDataToConsumptionProfile } from './billToOptimizationInput';

export interface OcrProgressStatus {
  stage: 'validating' | 'preprocessing' | 'ocr_pass1' | 'ocr_pass2' | 'parsing' | 'validating_data' | 'completed' | 'error';
  progressPct: number;
  message: string;
}

/**
 * High-accuracy multi-pass OCR pipeline:
 * 1. Preprocesses image (EXIF fix, grayscale, contrast stretch, deskew, Otsu binarization).
 * 2. Runs OCR on deskewed grayscale image.
 * 3. If primary text confidence is low or units not found, runs second pass on Otsu binarized canvas.
 * 4. Merges/parses text into structured bill parameters.
 * 5. Cross-checks values and returns validated details for human confirmation.
 */
export async function extractStructuredBillFromImage(
  file: File,
  onProgress?: (status: OcrProgressStatus) => void,
  abortSignal?: AbortSignal
): Promise<import('@/types/bill').ExtractedBillDetails> {
  onProgress?.({
    stage: 'preprocessing',
    progressPct: 15,
    message: 'Analyzing & optimizing bill image clarity (contrast, deskew)...',
  });

  if (abortSignal?.aborted) throw new Error('OCR operation cancelled by user.');

  const { preprocessBillImage } = await import('./billImagePreprocessing');
  const preprocessed = await preprocessBillImage(file);

  onProgress?.({
    stage: 'ocr_pass1',
    progressPct: 35,
    message: 'Recognizing utility bill text (pass 1)...',
  });

  if (abortSignal?.aborted) throw new Error('OCR operation cancelled by user.');

  // Run Pass 1 on enhanced grayscale canvas
  // Load required languages (English, Marathi, optional Hindi) lazily for OCR
  const language = 'eng+mar'; // add '+hin' if Hindi support needed in future
  // Tesseract.js v5+: createWorker handles language loading & initialization internally
  const worker = await Tesseract.createWorker(language, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && m.progress) {
        onProgress?.({
          stage: 'ocr_pass1',
          progressPct: Math.round(35 + m.progress * 35),
          message: `Reading text... (${Math.round(m.progress * 100)}%)`,
        });
      }
    },
  });
  const pass1Result = await worker.recognize(preprocessed.grayscaleCanvas);

  let combinedText = pass1Result.data.text || '';

  // Initial parse of pass 1
  const { parseUtilityBillText } = await import('./billParser');
  let parsed = parseUtilityBillText(combinedText);

  // If units were not detected or confidence is low, run pass 2 on binarized canvas
  if ((!parsed.unitsConsumedKwh.value || parsed.overallConfidence < 0.6) && !abortSignal?.aborted) {
    onProgress?.({
      stage: 'ocr_pass2',
      progressPct: 75,
      message: 'Running high-contrast pass for faint numbers...',
    });

    try {
      const worker2 = await Tesseract.createWorker(language, 1, { logger: () => undefined });
      const pass2Result = await worker2.recognize(preprocessed.binarizedCanvas);
      await worker2.terminate();
      if (pass2Result.data.text) {
        combinedText += '\n' + pass2Result.data.text;
        parsed = parseUtilityBillText(combinedText);
      }
    } catch (e) {
      console.warn('Pass 2 OCR fallback skipped:', e);
    }
  }

  await worker.terminate();

  onProgress?.({
    stage: 'validating_data',
    progressPct: 90,
    message: 'Cross-checking readings, charges, and seasonal profile...',
  });

  const { validateAndCrossCheckBill } = await import('./billValidation');
  const validation = validateAndCrossCheckBill(parsed);

  parsed.overallConfidence = validation.adjustedConfidence;
  parsed.warnings = validation.warnings;
  parsed.processedImagePreviewUrl = preprocessed.previewUrl;

  onProgress?.({
    stage: 'completed',
    progressPct: 100,
    message: 'Extraction ready for review.',
  });

  return parsed;
}

