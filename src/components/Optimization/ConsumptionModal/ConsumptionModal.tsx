import { useState, useMemo, useRef } from 'react';
import { useOptimization } from '@/context/OptimizationContext';
import { formatArea } from '@/utils/geoUtils';
import type { SolarAnalysis } from '@/types/solar.js';
import type { ExtractedBillDetails, ConfirmedBillData } from '@/types/bill.js';
import {
  extractStructuredBillFromImage,
  validateBillImageFile,
  type OcrProgressStatus,
} from '@/services/billExtractionService';
import { unitsForBill } from '@/services/tariffService';
import { BillUploadTab } from './BillUploadTab';
import { BillReviewPanel } from './BillReviewPanel';
import styles from './ConsumptionModal.module.css';

interface ConsumptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  solarAnalysis: SolarAnalysis | null;
}

export function ConsumptionModal({ isOpen, onClose, solarAnalysis }: ConsumptionModalProps) {
  const {
    maxPanelCount,
    maxPotentialAnnualEnergyKwh,
    solarResourceKwhPerKwp,
    panelSpec,
    tariffRateInr,
    tariffPlan,
    setMonthlyBillAmount,
    setConfirmedBillData,
    placeMaxCapacityLayout,
    isPlacing,
    placingMessage,
  } = useOptimization();

  // Mode Selection: 'manual' (default) vs 'upload'
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');

  // Manual Form State (preserved when switching tabs)
  const [billInput, setBillInput] = useState<string>('1000');
  const [error, setError] = useState<string | null>(null);

  // Upload & OCR State
  const [isOcrLoading, setIsOcrLoading] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgressStatus | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractedDetails, setExtractedDetails] = useState<ExtractedBillDetails | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('bill.jpg');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Dynamic calculations based on entered monthly bill amount (₹)
  const dynamicCalc = useMemo(() => {
    const billInr = parseFloat(billInput);
    if (isNaN(billInr) || billInr <= 0) {
      return null;
    }

    // Resolve units via dynamic tariff plan
    const unitsRes = unitsForBill(tariffPlan, billInr, null);
    const monthlyUnits = unitsRes.units;
    const annualKwh = monthlyUnits * 12;
    const rate = unitsRes.effectiveAverageRate;

    const panelKWp = panelSpec.ratedPowerW / 1000;
    const performanceRatio = 0.78;
    const annualEnergyPerPanel = panelKWp * solarResourceKwhPerKwp * performanceRatio;

    // Number of panels required to offset this bill
    const requiredPanels = Math.max(1, Math.ceil(annualKwh / annualEnergyPerPanel));
    const panelsToPlace = Math.min(requiredPanels, maxPanelCount > 0 ? maxPanelCount : requiredPanels);

    const placedCapacityKWp = Math.round(((panelsToPlace * panelSpec.ratedPowerW) / 1000) * 100) / 100;
    const estimatedAnnualEnergyKwh = Math.round(placedCapacityKWp * solarResourceKwhPerKwp * performanceRatio);
    const estimatedMonthlyEnergyKwh = Math.round(estimatedAnnualEnergyKwh / 12);
    const estimatedMonthlySavingsInr = Math.min(billInr, Math.round(estimatedMonthlyEnergyKwh * rate));
    const coverageRatioPct = Math.round((estimatedAnnualEnergyKwh / annualKwh) * 100);
    const canFitAll = requiredPanels <= maxPanelCount;

    return {
      billInr,
      monthlyUnits,
      annualKwh,
      requiredPanels,
      panelsToPlace,
      placedCapacityKWp,
      estimatedAnnualEnergyKwh,
      estimatedMonthlyEnergyKwh,
      estimatedMonthlySavingsInr,
      coverageRatioPct,
      canFitAll,
    };
  }, [billInput, panelSpec, solarResourceKwhPerKwp, maxPanelCount, tariffRateInr]);

  if (!isOpen) return null;

  const handlePlacePanels = () => {
    const value = parseFloat(billInput);
    if (isNaN(value) || value < 1000) {
      setError('Minimum monthly bill is ₹1,000');
      return;
    }
    setError(null);
    setMonthlyBillAmount(value);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handlePlaceMaxCapacity = () => {
    setError(null);
    placeMaxCapacityLayout();
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handlePresetClick = (presetAmount: number) => {
    setBillInput(presetAmount.toString());
    setError(null);
  };

  // OCR Upload Handler
  const handleFileUpload = async (file: File) => {
    const validation = validateBillImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file format.');
      return;
    }

    setUploadError(null);
    setSelectedFileName(file.name);
    setIsOcrLoading(true);
    setExtractedDetails(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const details = await extractStructuredBillFromImage(
        file,
        (status) => setOcrProgress(status),
        controller.signal
      );
      setExtractedDetails(details);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setUploadError('Scanning cancelled.');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to scan bill. Please check image clarity.';
        setUploadError(msg);
      }
    } finally {
      setIsOcrLoading(false);
      setOcrProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancelOcr = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsOcrLoading(false);
    setOcrProgress(null);
  };

  const handleConfirmOcrBill = (confirmedData: ConfirmedBillData) => {
    setConfirmedBillData(confirmedData, selectedFileName);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const selectedAreaSqM = solarAnalysis?.selectedArea?.area ?? 0;
  const peakSunHoursDaily = (solarResourceKwhPerKwp / 365).toFixed(1);

  // Compute non-blocking Sanctioned Load Warning if array KWp exceeds sanctioned load
  let sanctionedLoadWarning: string | null = null;
  if (extractedDetails?.sanctionedLoad.value && dynamicCalc) {
    const loadKw = extractedDetails.sanctionedLoad.value;
    if (dynamicCalc.placedCapacityKWp > loadKw) {
      sanctionedLoadWarning = `Proposed array (${dynamicCalc.placedCapacityKWp} kWp) exceeds your sanctioned load of ${loadKw} kW. Please check your discom net-metering regulations (load enhancement may be required).`;
    }
  }

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="consumption-modal-title">
      <div className={styles.modalCard}>
        {isPlacing ? (
          <div className={styles.placingOverlay}>
            <div className={styles.spinner} />
            <h3 className={styles.placingTitle}>Placing Solar Panels</h3>
            <p className={styles.placingMessage}>{placingMessage}</p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div className={styles.badge}>⚡ Solar Sizing Recommendation</div>
              <h2 id="consumption-modal-title" className={styles.modalTitle}>
                {activeTab === 'manual'
                  ? 'Enter Monthly Electricity Bill'
                  : 'Scan Electricity Bill with AI OCR'}
              </h2>
              <p className={styles.modalSubtitle}>
                {activeTab === 'manual'
                  ? 'Enter your average monthly electricity bill in Rupees (₹). We dynamically calculate your units and place the optimal panels to wipe out your bill.'
                  : 'Upload a photo or scan of your utility bill. We automatically extract your units, load, and 12-month seasonal history directly on your device.'}
              </p>

              {/* Mode Selection Tabs */}
              <div className={styles.tabsContainer} role="tablist" aria-label="Input Method">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'manual'}
                  className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('manual')}
                >
                  <span>✏️ Enter Bill Amount Manually</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'upload'}
                  className={`${styles.tabBtn} ${activeTab === 'upload' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('upload')}
                >
                  <span>📄 Upload Bill Image (OCR)</span>
                  <span className={styles.tabBadge}>Auto Sizing</span>
                </button>
              </div>

              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close dialog"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody}>
              {/* Dynamic Rooftop Recommendation Banner */}
              <div className={styles.recommendationBanner}>
                <div className={styles.recommendationHeader}>
                  <span className={styles.recommendationTitle}>
                    📐 Rooftop Selected Solar Area Capacity
                  </span>
                  <span className={styles.recStatSub}>
                    {peakSunHoursDaily} peak sun hrs/day
                  </span>
                </div>
                <div className={styles.recommendationStats}>
                  <div className={styles.recStatItem}>
                    <span className={styles.recStatLabel}>Selected Roof Area</span>
                    <span className={styles.recStatValue}>{formatArea(selectedAreaSqM).sqMeters}</span>
                    <span className={styles.recStatSub}>{formatArea(selectedAreaSqM).sqFeet}</span>
                  </div>
                  <div className={styles.recStatItem}>
                    <span className={styles.recStatLabel}>Max Panels that Fit</span>
                    <span className={styles.recStatValue}>{maxPanelCount} Panels</span>
                    <span className={styles.recStatSub}>Physical capacity</span>
                  </div>
                  <div className={styles.recStatItem}>
                    <span className={styles.recStatLabel}>Max Potential Energy</span>
                    <span className={styles.recStatValue}>
                      {maxPotentialAnnualEnergyKwh.toLocaleString()} kWh
                    </span>
                    <span className={styles.recStatSub}>
                      ~{Math.round(maxPotentialAnnualEnergyKwh / 12).toLocaleString()} kWh/mo
                    </span>
                  </div>
                </div>
              </div>

              {/* TAB 1: MANUAL ENTRY (Unchanged, 100% backward compatible) */}
              {activeTab === 'manual' && (
                <>
                  {/* Monthly Bill Input */}
                  <div className={styles.inputSection}>
                    <label htmlFor="bill-input" className={styles.inputLabel}>
                      <span>Your Monthly Electricity Bill (₹)</span>
                      <span className={styles.inputMinBadge}>Minimum: ₹1,000 / month</span>
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        id="bill-input"
                        type="number"
                        className={styles.consumptionInput}
                        placeholder="Enter monthly bill (min 1,000)"
                        min="1000"
                        step="100"
                        value={billInput}
                        onChange={(e) => {
                          setBillInput(e.target.value);
                          setError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePlacePanels();
                        }}
                        autoFocus
                      />
                      <span className={styles.inputUnit}>₹ / month</span>
                    </div>

                    {error && (
                      <div className={styles.inputError}>
                        ⚠️ {error}
                      </div>
                    )}

                    {/* Quick Presets */}
                    <div className={styles.presetsRow}>
                      <span className={styles.presetLabel}>Quick Presets:</span>
                      {[1000, 2000, 3000, 5000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`${styles.presetBtn} ${
                            billInput === preset.toString() ? styles.presetBtnActive : ''
                          }`}
                          onClick={() => handlePresetClick(preset)}
                        >
                          ₹{preset.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real-Time Dynamic Placement Calculation Cards */}
                  {dynamicCalc && (
                    <>
                      <div className={styles.calcGrid}>
                        <div className={styles.calcCard}>
                          <span className={styles.calcLabel}>Panels to be Placed</span>
                          <strong className={styles.calcValueHighlight}>
                            {dynamicCalc.panelsToPlace} Panels
                          </strong>
                          <span className={styles.calcSub}>
                            {dynamicCalc.placedCapacityKWp} kWp system ({panelSpec.ratedPowerW}W modules)
                          </span>
                        </div>

                        <div className={styles.calcCard}>
                          <span className={styles.calcLabel}>Est. Monthly Savings</span>
                          <strong className={styles.calcValueGreen}>
                            ₹{dynamicCalc.estimatedMonthlySavingsInr.toLocaleString()} / mo
                          </strong>
                          <span className={styles.calcSub}>
                            ~{dynamicCalc.estimatedMonthlyEnergyKwh.toLocaleString()} units generated/mo
                          </span>
                        </div>
                      </div>

                      {/* Fit Status */}
                      <div className={dynamicCalc.canFitAll ? styles.fitBannerGood : styles.fitBannerWarn}>
                        <span>{dynamicCalc.canFitAll ? '✓' : '⚠️'}</span>
                        <div>
                          {dynamicCalc.canFitAll ? (
                            <>
                              <strong>Roof Area Fits Needed Panels:</strong> Your ₹{dynamicCalc.billInr.toLocaleString()} monthly bill
                              consumes ~{dynamicCalc.monthlyUnits} units/month, which requires{' '}
                              <strong>{dynamicCalc.requiredPanels} panels</strong> ({dynamicCalc.placedCapacityKWp} kWp).
                              Your rooftop can comfortably fit up to {maxPanelCount} panels. Panels will be placed in optimal solar zones.
                            </>
                          ) : (
                            <>
                              <strong>Area Capacity Limit:</strong> Your ₹{dynamicCalc.billInr.toLocaleString()} monthly bill
                              needs {dynamicCalc.requiredPanels} panels, but your selected roof area fits a maximum of{' '}
                              {maxPanelCount} panels. We will place the maximum {maxPanelCount} panels to maximize your savings.
                            </>
                          )}
                        </div>
                      </div>

                      {/* Bill & Energy Breakdown */}
                      <div className={styles.energySummaryBox}>
                        <div className={styles.energyRow}>
                          <span>Current Monthly Electricity Bill</span>
                          <strong>₹{dynamicCalc.billInr.toLocaleString()} / month (~{dynamicCalc.monthlyUnits} units)</strong>
                        </div>
                        <div className={styles.energyRow}>
                          <span>Estimated Solar Generation Value</span>
                          <strong style={{ color: '#4ade80' }}>
                            ₹{dynamicCalc.estimatedMonthlySavingsInr.toLocaleString()} / month (~{dynamicCalc.estimatedMonthlyEnergyKwh} units)
                          </strong>
                        </div>
                        <div className={styles.energyDivider} />
                        <div className={styles.energyRow}>
                          <span>Estimated Net Monthly Bill</span>
                          <strong style={{ color: dynamicCalc.coverageRatioPct >= 100 ? '#4ade80' : '#f59e0b' }}>
                            {dynamicCalc.coverageRatioPct >= 100 ? '₹0 / month (100% bill eliminated)' : `~₹${(dynamicCalc.billInr - dynamicCalc.estimatedMonthlySavingsInr).toLocaleString()} / month (${dynamicCalc.coverageRatioPct}% offset)`}
                          </strong>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* TAB 2: BILL IMAGE UPLOAD & OCR CONFIRMATION */}
              {activeTab === 'upload' && (
                <>
                  {!extractedDetails ? (
                    <BillUploadTab
                      onFileSelected={handleFileUpload}
                      isLoading={isOcrLoading}
                      ocrProgress={ocrProgress}
                      onCancel={handleCancelOcr}
                      error={uploadError}
                    />
                  ) : (
                    <BillReviewPanel
                      extractedDetails={extractedDetails}
                      onConfirm={handleConfirmOcrBill}
                      onReupload={() => setExtractedDetails(null)}
                      onSwitchToManual={() => {
                        setActiveTab('manual');
                        setExtractedDetails(null);
                      }}
                      sanctionedLoadWarning={sanctionedLoadWarning}
                    />
                  )}
                </>
              )}
            </div>

            {/* Modal Footer (Visible in manual tab or upload before scan) */}
            {activeTab === 'manual' && (
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.maxCapacityBtn}
                  onClick={handlePlaceMaxCapacity}
                  title={`Fill all available space with ${maxPanelCount} panels`}
                >
                  Place Max Capacity ({maxPanelCount} Panels)
                </button>

                <button
                  type="button"
                  className={styles.placeBtn}
                  onClick={handlePlacePanels}
                  disabled={!billInput || parseFloat(billInput) < 1000}
                >
                  <span>⚡</span>
                  <span>
                    Place {dynamicCalc?.panelsToPlace ?? 0} Panels on Rooftop
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
