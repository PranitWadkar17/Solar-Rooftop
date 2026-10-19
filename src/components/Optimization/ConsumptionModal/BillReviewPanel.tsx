import React, { useState } from 'react';
import type { ExtractedBillDetails, ConfirmedBillData } from '@/types/bill';
import { LEGACY_FALLBACK_TARIFF, getTariffContext, averageRate } from '@/services/tariffService.js';
import styles from './BillReviewPanel.module.css';

interface BillReviewPanelProps {
  extractedDetails: ExtractedBillDetails;
  onConfirm: (confirmedData: ConfirmedBillData) => void;
  onReupload: () => void;
  onSwitchToManual: () => void;
  sanctionedLoadWarning?: string | null;
}

export const BillReviewPanel: React.FC<BillReviewPanelProps> = ({
  extractedDetails,
  onConfirm,
  onReupload,
  onSwitchToManual,
  sanctionedLoadWarning,
}) => {
  const initialPlan = getTariffContext({
    discomName: extractedDetails.connection.discomName,
    confirmedBillData: {
      discomName: extractedDetails.connection.discomName,
      effectiveTariffInr: extractedDetails.effectiveTariff.value,
      sanctionedLoadKw: extractedDetails.sanctionedLoad.value,
      tariffCategory: extractedDetails.connection.tariffCategory,
    },
  });

  const defaultUnits = extractedDetails.unitsConsumedKwh.value || 250;
  const initialTariff = extractedDetails.effectiveTariff.value
    ? extractedDetails.effectiveTariff.value
    : averageRate(initialPlan, defaultUnits, extractedDetails.sanctionedLoad.value);

  // Local state for editable confirmation fields
  const [units, setUnits] = useState<string>(
    extractedDetails.unitsConsumedKwh.value ? extractedDetails.unitsConsumedKwh.value.toString() : '250'
  );
  const [totalBill, setTotalBill] = useState<string>(
    extractedDetails.totalAmount.value ? extractedDetails.totalAmount.value.toString() : ''
  );
  const [tariffRate, setTariffRate] = useState<string>(initialTariff.toFixed(1));
  const [sanctionedLoad, setSanctionedLoad] = useState<string>(
    extractedDetails.sanctionedLoad.value ? extractedDetails.sanctionedLoad.value.toString() : '3.0'
  );
  const [includeHistory, setIncludeHistory] = useState<boolean>(
    extractedDetails.consumptionHistory.length >= 3
  );

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.75) {
      return <span className={`${styles.badge} ${styles.badgeHigh}`}>● High Confidence</span>;
    }
    if (confidence >= 0.50) {
      return <span className={`${styles.badge} ${styles.badgeMed}`}>● Medium Confidence</span>;
    }
    return <span className={`${styles.badge} ${styles.badgeLow}`}>⚠️ Verify / Enter Value</span>;
  };

  const handleApply = () => {
    const parsedUnits = parseFloat(units) || 250;
    const parsedBill = parseFloat(totalBill) || null;
    const parsedTariff = parseFloat(tariffRate) || LEGACY_FALLBACK_TARIFF;
    const parsedLoad = parseFloat(sanctionedLoad) || null;

    let monthlyProfile: { month: string; kwh: number }[] = [];
    if (includeHistory && extractedDetails.consumptionHistory.length > 0) {
      monthlyProfile = extractedDetails.consumptionHistory.map(h => ({
        month: h.month,
        kwh: h.kwh,
      }));
    } else {
      monthlyProfile = Array.from({ length: 12 }, (_, i) => ({
        month: `2026-${String(i + 1).padStart(2, '0')}`,
        kwh: Math.round(parsedUnits),
      }));
    }

    const annualKwh = monthlyProfile.reduce((sum, item) => sum + item.kwh, 0);

    const confirmed: ConfirmedBillData = {
      annualKwh,
      monthlyAverageKwh: Math.round(annualKwh / 12),
      unitsConsumedKwh: Math.round(parsedUnits),
      monthlyKwhProfile: monthlyProfile,
      monthlyBillAmountInr: parsedBill,
      effectiveTariffInr: parsedTariff,
      sanctionedLoadKw: parsedLoad,
      consumerNumberMasked: extractedDetails.connection.maskedConsumerNumber,
      discomName: extractedDetails.connection.discomName,
      tariffCategory: extractedDetails.connection.tariffCategory,
      isBimonthly: extractedDetails.billingPeriod.value?.isBimonthly || false,
      warnings: extractedDetails.warnings,
      confirmedAt: new Date().toISOString(),
    };

    onConfirm(confirmed);
  };

  return (
    <div className={styles.reviewContainer}>
      <div className={styles.reviewHeader}>
        <div>
          <h4 className={styles.reviewTitle}>Review & Confirm Extracted Details</h4>
          <p className={styles.reviewSubtitle}>
            Our OCR scanned the parameters below from your bill. Please verify or adjust any highlighted values before sizing your solar array.
          </p>
        </div>
        <div className={styles.headerBadge}>
          {getConfidenceBadge(extractedDetails.overallConfidence)}
        </div>
      </div>

      {/* Discom & Consumer Badge */}
      <div className={styles.metaRow}>
        {extractedDetails.connection.discomName && (
          <span className={styles.metaChip}>
            🏢 Discom: <strong>{extractedDetails.connection.discomName}</strong>
          </span>
        )}
        {extractedDetails.connection.maskedConsumerNumber && (
          <span className={styles.metaChip}>
            🆔 Consumer: <strong>{extractedDetails.connection.maskedConsumerNumber}</strong>
          </span>
        )}
        {extractedDetails.connection.tariffCategory && (
          <span className={styles.metaChip}>
            ⚡ Category: <strong>{extractedDetails.connection.tariffCategory}</strong>
          </span>
        )}
      </div>

      {/* Warnings & Notices */}
      {extractedDetails.warnings.length > 0 && (
        <div className={styles.warningsList}>
          {extractedDetails.warnings.map((w, i) => (
            <div key={i} className={styles.warningItem}>
              <span>⚠️</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {sanctionedLoadWarning && (
        <div className={styles.loadNotice} role="alert">
          <span className={styles.noticeIcon}>ℹ️</span>
          <div>
            <strong>Sanctioned Load Advisory:</strong> {sanctionedLoadWarning}
          </div>
        </div>
      )}

      {/* Editable Fields Grid */}
      <div className={styles.fieldGrid}>
        {/* Monthly Units Consumed */}
        <div className={styles.fieldCard}>
          <div className={styles.fieldHeader}>
            <label htmlFor="review-units" className={styles.fieldLabel}>
              Monthly Units Consumed (kWh) *
            </label>
            {getConfidenceBadge(extractedDetails.unitsConsumedKwh.confidence)}
          </div>
          <div className={styles.inputWrapper}>
            <input
              id="review-units"
              type="number"
              className={styles.fieldInput}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              min="10"
              step="1"
            />
            <span className={styles.inputUnit}>kWh / mo</span>
          </div>
          <span className={styles.fieldHint}>
            Directly sizes your solar PV array. {extractedDetails.unitsConsumedKwh.source === 'derived' && '(Derived from meter readings)'}
          </span>
        </div>

        {/* Total Monthly Bill (₹) */}
        <div className={styles.fieldCard}>
          <div className={styles.fieldHeader}>
            <label htmlFor="review-amount" className={styles.fieldLabel}>
              Bill Amount (₹)
            </label>
            {extractedDetails.totalAmount.confidence > 0 && getConfidenceBadge(extractedDetails.totalAmount.confidence)}
          </div>
          <div className={styles.inputWrapper}>
            <input
              id="review-amount"
              type="number"
              className={styles.fieldInput}
              value={totalBill}
              onChange={(e) => setTotalBill(e.target.value)}
              placeholder="e.g. 2400"
              min="0"
              step="10"
            />
            <span className={styles.inputUnit}>₹ / mo</span>
          </div>
          <span className={styles.fieldHint}>Used to calculate monthly energy bill savings</span>
        </div>

        {/* Effective Tariff (₹/kWh) */}
        <div className={styles.fieldCard}>
          <div className={styles.fieldHeader}>
            <label htmlFor="review-tariff" className={styles.fieldLabel}>
              Effective Tariff Rate (₹/kWh)
            </label>
            <span className={styles.badgeAuto}>Derived</span>
          </div>
          <div className={styles.inputWrapper}>
            <input
              id="review-tariff"
              type="number"
              className={styles.fieldInput}
              value={tariffRate}
              onChange={(e) => setTariffRate(e.target.value)}
              min="1"
              max="25"
              step="0.1"
            />
            <span className={styles.inputUnit}>₹ / unit</span>
          </div>
          <span className={styles.fieldHint}>Energy charges per kilowatt-hour from your bill</span>
        </div>

        {/* Sanctioned Load (kW) */}
        <div className={styles.fieldCard}>
          <div className={styles.fieldHeader}>
            <label htmlFor="review-load" className={styles.fieldLabel}>
              Sanctioned Load (kW)
            </label>
            {extractedDetails.sanctionedLoad.confidence > 0 && getConfidenceBadge(extractedDetails.sanctionedLoad.confidence)}
          </div>
          <div className={styles.inputWrapper}>
            <input
              id="review-load"
              type="number"
              className={styles.fieldInput}
              value={sanctionedLoad}
              onChange={(e) => setSanctionedLoad(e.target.value)}
              min="0.5"
              step="0.5"
            />
            <span className={styles.inputUnit}>kW</span>
          </div>
          <span className={styles.fieldHint}>Check against discom net-metering limit</span>
        </div>
      </div>

      {/* Historical Consumption Option */}
      {extractedDetails.consumptionHistory.length >= 3 && (
        <div className={styles.historyCard}>
          <label className={styles.historyCheckboxLabel}>
            <input
              type="checkbox"
              checked={includeHistory}
              onChange={(e) => setIncludeHistory(e.target.checked)}
              className={styles.checkbox}
            />
            <div>
              <strong>Use {extractedDetails.consumptionHistory.length}-Month Seasonal Profile</strong>
              <p className={styles.historySub}>
                Enables realistic month-by-month solar vs consumption comparison in Results instead of a flat average.
              </p>
            </div>
          </label>
          <div className={styles.historyChips}>
            {extractedDetails.consumptionHistory.slice(0, 6).map((h) => (
              <span key={h.month} className={styles.historyChip}>
                {h.label}: <strong>{h.kwh} u</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Review Actions */}
      <div className={styles.reviewActions}>
        <div className={styles.secondaryActions}>
          <button
            type="button"
            className={styles.textBtn}
            onClick={onReupload}
          >
            ← Upload Different Photo
          </button>
          <button
            type="button"
            className={styles.textBtn}
            onClick={onSwitchToManual}
          >
            Switch to Manual Input
          </button>
        </div>

        <button
          type="button"
          className={styles.confirmBtn}
          onClick={handleApply}
        >
          <span>⚡</span>
          <span>Apply Bill & Place Solar Panels</span>
        </button>
      </div>
    </div>
  );
};
