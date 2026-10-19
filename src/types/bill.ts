// ============================================
// Bill Processing & OCR Types
// ============================================

export type FieldSource = 'ocr' | 'derived' | 'user';

export type ConfidenceTier = 'high' | 'medium' | 'low';

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ExtractedField<T> {
  value: T | null;
  unit?: string;
  confidence: number; // 0.0 to 1.0
  source: FieldSource;
  rawText: string;
  normalizedText?: string;
  boundingBox?: BoundingBox;
  warning?: string;
}

export interface BillingPeriod {
  startDate: string | null;
  endDate: string | null;
  billingDays: number | null;
  isBimonthly: boolean;
}

export interface MeterReading {
  previous: number | null;
  current: number | null;
  multiplyingFactor: number;
  derivedUnits: number | null;
}

export interface BillCharges {
  totalPayableInr: number | null;
  energyChargesInr: number | null;
  fixedDemandChargesInr: number | null;
  electricityDutyInr: number | null;
  fuelAdjustmentInr: number | null;
  effectiveTariffInrPerKwh: number | null;
}

export interface BillConnectionDetails {
  consumerNumber: string | null;
  maskedConsumerNumber: string | null;
  discomName: string | null;
  tariffCategory: string | null; // residential, commercial, industrial, etc.
  phase: '1-phase' | '3-phase' | 'unknown';
  sanctionedLoadKw: number | null;
  hasExistingSolar: boolean;
}

export interface MonthlyHistoryRecord {
  month: string; // YYYY-MM
  label: string; // e.g. "Jan", "Feb"
  kwh: number;
  confidence: number;
  source: FieldSource;
}

export interface ExtractedBillDetails {
  // Primary Consumption
  unitsConsumedKwh: ExtractedField<number>;
  billingPeriod: ExtractedField<BillingPeriod>;
  meterReading: ExtractedField<MeterReading>;

  // 6 or 12-Month Consumption History
  consumptionHistory: MonthlyHistoryRecord[];
  historyMonthsCount: number;

  // Financial & Tariff
  charges: BillCharges;
  totalAmount: ExtractedField<number>;
  effectiveTariff: ExtractedField<number>;

  // Connection & Sanctioned Load
  connection: BillConnectionDetails;
  sanctionedLoad: ExtractedField<number>;

  // Overall Health & Audit
  overallConfidence: number;
  confidenceTier: ConfidenceTier;
  warnings: string[];
  rawOcrText: string;
  processedImagePreviewUrl?: string; // transient blob URL for confirmation preview
}

export interface ConfirmedBillData {
  annualKwh: number;
  monthlyAverageKwh: number;
  unitsConsumedKwh: number;
  monthlyKwhProfile: { month: string; kwh: number }[]; // 12-month array
  monthlyBillAmountInr: number | null;
  effectiveTariffInr: number;
  sanctionedLoadKw: number | null;
  consumerNumberMasked: string | null;
  discomName: string | null;
  tariffCategory: string | null;
  isBimonthly: boolean;
  warnings: string[];
  confirmedAt: string;
}

export interface DiscomKeywordDictionary {
  discomAliases: string[];
  unitsKeywords: string[];
  loadKeywords: string[];
  amountKeywords: string[];
  periodKeywords: string[];
  readingKeywords: string[];
  consumerKeywords: string[];
}
