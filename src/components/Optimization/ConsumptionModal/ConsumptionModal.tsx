import { useState, useMemo, useRef, useEffect } from 'react';
import { useOptimization } from '@/context/OptimizationContext';
import { formatArea } from '@/utils/geoUtils';
import type { SolarAnalysis } from '@/types/solar.js';
import type { ExtractedBillDetails, ConfirmedBillData } from '@/types/bill.js';
import type { PanelSpecification, ManufacturerProfile } from '@/types/optimization.js';
import { MANUFACTURER_PROFILES } from '@/data/panelLibrary';
import {
  calculateAccurateSolarMetrics,
  calculateDynamicCostEstimation,
} from '@/services/energyPredictionService';
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
    panelSpec,
    constraints,
    tariffPlan,
    consumption,
    setMonthlyBillAmount,
    setConfirmedBillData,
    placeMaxCapacityLayout,
    isPlacing,
    placingMessage,
  } = useOptimization();

  // Mode Selection: 'manual' (default) vs 'upload'
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');

  // Manual Form State
  const [billInput, setBillInput] = useState<string>(() => {
    return consumption?.monthlyBillAmountInr ? consumption.monthlyBillAmountInr.toString() : '2000';
  });
  const [error, setError] = useState<string | null>(null);

  // Selected Manufacturer & Panel Spec State
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<'tata' | 'vikram' | 'adani'>(() => {
    const currentMfg = panelSpec.manufacturer.toLowerCase();
    if (currentMfg.includes('tata')) return 'tata';
    if (currentMfg.includes('vikram')) return 'vikram';
    if (currentMfg.includes('adani')) return 'adani';
    return 'tata';
  });

  const activeManufacturer: ManufacturerProfile = useMemo(() => {
    return MANUFACTURER_PROFILES.find((m) => m.id === selectedManufacturerId) ?? MANUFACTURER_PROFILES[0];
  }, [selectedManufacturerId]);

  const [selectedPanelId, setSelectedPanelId] = useState<string>(() => {
    return panelSpec.id || MANUFACTURER_PROFILES[0].models[1].id;
  });

  // Keep modal state in sync whenever it is opened or active panelSpec changes
  useEffect(() => {
    if (isOpen) {
      if (consumption?.monthlyBillAmountInr) {
        setBillInput(consumption.monthlyBillAmountInr.toString());
      }
      const currentMfg = panelSpec.manufacturer.toLowerCase();
      if (currentMfg.includes('tata')) setSelectedManufacturerId('tata');
      else if (currentMfg.includes('vikram')) setSelectedManufacturerId('vikram');
      else if (currentMfg.includes('adani')) setSelectedManufacturerId('adani');

      if (panelSpec.id) {
        setSelectedPanelId(panelSpec.id);
      }
    }
  }, [isOpen, consumption?.monthlyBillAmountInr, panelSpec]);

  const activePanelSpec: PanelSpecification = useMemo(() => {
    const found = activeManufacturer.models.find((p) => p.id === selectedPanelId);
    return found ?? activeManufacturer.models[1] ?? activeManufacturer.models[0];
  }, [activeManufacturer, selectedPanelId]);

  // Upload & OCR State
  const [isOcrLoading, setIsOcrLoading] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgressStatus | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractedDetails, setExtractedDetails] = useState<ExtractedBillDetails | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('bill.jpg');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Dynamic calculations based on entered monthly bill amount (₹) & chosen panel
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

    // Use selected active panel's rated power and accurate solar physics
    const panelKWp = activePanelSpec.ratedPowerW / 1000;
    const annualGhi = solarAnalysis?.resourceData?.annualGhi ?? 1750;
    const tiltDeg = constraints.tiltDeg ?? 15;
    const tiltFactor = 1 + (Math.sin((tiltDeg * Math.PI) / 180) * 0.12);
    const tempDerating = Math.max(0.85, 1 + (22 * ((activePanelSpec.tempCoeffPmax || -0.34) / 100)));
    const shadingAccess = solarAnalysis?.avgSolarAccessPct ? Math.max(0.60, solarAnalysis.avgSolarAccessPct / 100) : 0.95;
    const bifacialGain = activePanelSpec.technology.toLowerCase().includes('bifacial') ? 1.08 : 1.0;
    const specificYieldKwhPerKwp = Math.round(annualGhi * tiltFactor * 0.81 * tempDerating * shadingAccess * bifacialGain);

    const annualEnergyPerPanel = panelKWp * specificYieldKwhPerKwp;

    // Calculate how many of these panels fit on the roof using the active panel's dimensions
    const selectedAreaSqM = solarAnalysis?.selectedArea?.area ?? 50;
    const panelAreaSqM = activePanelSpec.lengthM * activePanelSpec.widthM;
    const maxEstimatedPanelsForThisModel = Math.max(
      1,
      Math.floor((selectedAreaSqM * 0.72) / (panelAreaSqM * 1.35))
    );
    const effectiveMaxPanels = maxPanelCount > 0 ? maxPanelCount : maxEstimatedPanelsForThisModel;

    // Number of panels required to offset this bill
    const requiredPanels = Math.max(1, Math.ceil(annualKwh / Math.max(1, annualEnergyPerPanel)));
    const panelsToPlace = Math.min(requiredPanels, effectiveMaxPanels);

    const placedCapacityKWp = Math.round(((panelsToPlace * activePanelSpec.ratedPowerW) / 1000) * 100) / 100;
    const estimatedAnnualEnergyKwh = Math.round(placedCapacityKWp * specificYieldKwhPerKwp);
    const estimatedMonthlyEnergyKwh = Math.round(estimatedAnnualEnergyKwh / 12);
    const estimatedMonthlySavingsInr = Math.min(billInr, Math.round(estimatedMonthlyEnergyKwh * rate));
    const coverageRatioPct = Math.round((estimatedAnnualEnergyKwh / annualKwh) * 100);
    const canFitAll = requiredPanels <= effectiveMaxPanels;

    // Dynamic Financial Cost & Subsidy Estimation
    const costEstimation = calculateDynamicCostEstimation(
      placedCapacityKWp,
      activePanelSpec,
      billInr,
      rate,
      estimatedMonthlyEnergyKwh
    );

    // Generation metrics
    const metrics = calculateAccurateSolarMetrics(
      panelsToPlace,
      activePanelSpec,
      solarAnalysis,
      effectiveMaxPanels,
      tiltDeg
    );

    return {
      billInr,
      monthlyUnits,
      annualKwh,
      requiredPanels,
      panelsToPlace,
      effectiveMaxPanels,
      placedCapacityKWp,
      estimatedAnnualEnergyKwh,
      estimatedMonthlyEnergyKwh,
      estimatedMonthlySavingsInr,
      coverageRatioPct,
      canFitAll,
      costEstimation,
      metrics,
    };
  }, [billInput, activePanelSpec, solarAnalysis, maxPanelCount, constraints.tiltDeg, tariffPlan]);

  if (!isOpen) return null;

  const handleManufacturerChange = (mfgId: 'tata' | 'vikram' | 'adani') => {
    setSelectedManufacturerId(mfgId);
    const mfg = MANUFACTURER_PROFILES.find((m) => m.id === mfgId);
    if (mfg && mfg.models.length > 0) {
      // Default to the flagship high-output model (index 1)
      setSelectedPanelId(mfg.models[1]?.id ?? mfg.models[0].id);
    }
  };

  const handlePlacePanels = () => {
    const value = parseFloat(billInput);
    if (isNaN(value) || value < 1000) {
      setError('Minimum monthly bill is ₹1,000');
      return;
    }
    setError(null);
    setMonthlyBillAmount(value, activePanelSpec);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handlePlaceMaxCapacity = () => {
    setError(null);
    placeMaxCapacityLayout(activePanelSpec);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handlePresetClick = (presetAmount: number) => {
    setBillInput(presetAmount.toString());
    setError(null);
  };

  // OCR Upload Handlers
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
    setConfirmedBillData(confirmedData, selectedFileName, activePanelSpec);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const selectedAreaSqM = solarAnalysis?.selectedArea?.area ?? 0;
  const peakSunHoursDaily = (
    solarAnalysis?.peakSunHoursAnnual
      ? solarAnalysis.peakSunHoursAnnual
      : (solarAnalysis?.resourceData?.peakSunHoursDaily ?? 4.8)
  ).toFixed(1);

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
              <div className={styles.badge}>⚡ Solar Rooftop Sizing & Engineering Studio</div>
              <h2 id="consumption-modal-title" className={styles.modalTitle}>
                {activeTab === 'manual'
                  ? 'Electricity Bill & Panel Manufacturer Selection'
                  : 'Scan Electricity Bill with AI OCR'}
              </h2>
              <p className={styles.modalSubtitle}>
                {activeTab === 'manual'
                  ? 'Enter your monthly electricity bill, choose your preferred Tier-1 Indian PV manufacturer and panel size, and preview 100% dynamic cost & generation predictions.'
                  : 'Upload a photo or scan of your utility bill to automatically extract units, sanctioned load, and 12-month consumption history.'}
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
                  <span>✏️ Enter Bill & Select Manufacturer</span>
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
              {/* Dynamic Rooftop Capacity Banner */}
              <div className={styles.recommendationBanner}>
                <div className={styles.recommendationHeader}>
                  <span className={styles.recommendationTitle}>
                    📐 Rooftop Usable Solar Installation Scope
                  </span>
                  <span className={styles.recStatSub}>
                    {peakSunHoursDaily} peak sun hrs/day ({solarAnalysis?.resourceData?.annualGhi ?? 1750} kWh/m²/yr GHI)
                  </span>
                </div>
                <div className={styles.recommendationStats}>
                  <div className={styles.recStatItem}>
                    <span className={styles.recStatLabel}>Selected Roof Area</span>
                    <span className={styles.recStatValue}>{formatArea(selectedAreaSqM).sqMeters}</span>
                    <span className={styles.recStatSub}>{formatArea(selectedAreaSqM).sqFeet}</span>
                  </div>
                  <div className={styles.recStatItem}>
                    <span className={styles.recStatLabel}>Max Panels ({activePanelSpec.ratedPowerW}W)</span>
                    <span className={styles.recStatValue}>{dynamicCalc?.effectiveMaxPanels ?? maxPanelCount} Panels</span>
                    <span className={styles.recStatSub}>Physical roof capacity</span>
                  </div>
                  <div className={styles.recStatItem}>
                    <span className={styles.recStatLabel}>Max Potential Energy</span>
                    <span className={styles.recStatValue}>
                      {(dynamicCalc?.metrics.maxPotentialAnnualEnergyKwh ?? 0).toLocaleString()} kWh
                    </span>
                    <span className={styles.recStatSub}>
                      ~{Math.round((dynamicCalc?.metrics.maxPotentialAnnualEnergyKwh ?? 0) / 12).toLocaleString()} kWh/mo max
                    </span>
                  </div>
                </div>
              </div>

              {/* TAB 1: MANUAL BILL ENTRY & MANUFACTURER/PANEL SELECTION */}
              {activeTab === 'manual' && (
                <>
                  {/* Step 1: Monthly Bill Input */}
                  <div className={styles.inputSection}>
                    <label htmlFor="bill-input" className={styles.inputLabel}>
                      <span>1. Your Monthly Electricity Bill (₹)</span>
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

                  {/* Step 2: Manufacturer Selection Prompt */}
                  <div className={styles.mfgSelectionSection}>
                    <div className={styles.sectionHeader}>
                      <label className={styles.inputLabel}>
                        <span>2. Which PV Module Manufacturer Would You Prefer to Install?</span>
                        <span className={styles.mfgSubnote}>India Tier-1 ALMM Approved</span>
                      </label>
                      <p className={styles.sectionHelpText}>
                        Select your preferred manufacturer to see detailed technical advantages, certified warranties, and available panel form factors.
                      </p>
                    </div>

                    {/* 3 Manufacturer Cards */}
                    <div className={styles.mfgGrid} role="radiogroup" aria-label="Select Solar Manufacturer">
                      {MANUFACTURER_PROFILES.map((mfg) => {
                        const isSelected = selectedManufacturerId === mfg.id;
                        return (
                          <div
                            key={mfg.id}
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={0}
                            className={`${styles.mfgCard} ${isSelected ? styles.mfgCardActive : ''}`}
                            onClick={() => handleManufacturerChange(mfg.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                handleManufacturerChange(mfg.id);
                              }
                            }}
                          >
                            <div className={styles.mfgCardHeader}>
                              <span className={styles.mfgBadge}>{mfg.badge}</span>
                              {isSelected && <span className={styles.selectedCheck}>✓ Selected</span>}
                            </div>
                            <h4 className={styles.mfgBrandName}>{mfg.brandName}</h4>
                            <p className={styles.mfgTagline}>{mfg.tagline}</p>
                            <div className={styles.mfgFeatures}>
                              {mfg.bestIn.slice(0, 2).map((item, i) => (
                                <div key={i} className={styles.mfgFeatureItem}>
                                  <span className={styles.featureDot}>•</span>
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Detailed Manufacturer Info & Suitability Guide */}
                  {activeManufacturer && (
                    <div className={styles.mfgDetailsCard}>
                      <div className={styles.mfgDetailsHeader}>
                        <div>
                          <span className={styles.detailsEyebrow}>Manufacturer Engineering Profile</span>
                          <h3 className={styles.detailsTitle}>{activeManufacturer.brandName}</h3>
                        </div>
                        <div className={styles.certPills}>
                          {activeManufacturer.certifications.map((cert) => (
                            <span key={cert} className={styles.certPill}>{cert}</span>
                          ))}
                        </div>
                      </div>

                      <p className={styles.mfgOverviewText}>{activeManufacturer.overview}</p>

                      <div className={styles.mfgInsightsGrid}>
                        {/* What it is Best In */}
                        <div className={styles.insightBox}>
                          <span className={styles.insightTitle}>🌟 What It Is Best In:</span>
                          <ul className={styles.insightList}>
                            {activeManufacturer.bestIn.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Best Suited For */}
                        <div className={styles.insightBox}>
                          <span className={styles.insightTitle}>🏡 Best Suited For:</span>
                          <ul className={styles.insightList}>
                            {activeManufacturer.suitedFor.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className={styles.whenToUseBanner}>
                        <strong>💡 When to Choose {activeManufacturer.brandName}:</strong>
                        <span>{activeManufacturer.whenToUse}</span>
                      </div>

                      <div className={styles.warrantyFooter}>
                        <span>🛡️ <strong>Warranty Assurance:</strong> {activeManufacturer.warrantyHighlight}</span>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Available Shapes & Sizes from this Manufacturer */}
                  <div className={styles.panelSizeSection}>
                    <div className={styles.sectionHeader}>
                      <label className={styles.inputLabel}>
                        <span>3. Select Panel Size & Shape ({activeManufacturer.brandName})</span>
                        <span className={styles.mfgSubnote}>Exact Dimensions Placed on Roof</span>
                      </label>
                      <p className={styles.sectionHelpText}>
                        Each module size produces a dynamic generation range depending on your location's seasonal sunshine.
                      </p>
                    </div>

                    <div className={styles.modelGrid}>
                      {activeManufacturer.models.map((model) => {
                        const isChosen = activePanelSpec.id === model.id;
                        const panelArea = (model.lengthM * model.widthM).toFixed(2);
                        const dailyMin = model.dailyMinMaxKwh?.min ?? 1.8;
                        const dailyMax = model.dailyMinMaxKwh?.max ?? 2.8;
                        const annualMin = model.annualMinMaxKwh?.min ?? 650;
                        const annualMax = model.annualMinMaxKwh?.max ?? 880;

                        return (
                          <div
                            key={model.id}
                            className={`${styles.modelCard} ${isChosen ? styles.modelCardActive : ''}`}
                            onClick={() => setSelectedPanelId(model.id)}
                          >
                            <div className={styles.modelHeader}>
                              <div>
                                <span className={styles.modelSeries}>{model.seriesName ?? model.technology}</span>
                                <h5 className={styles.modelName}>{model.model}</h5>
                              </div>
                              <span className={styles.wattageTag}>{model.ratedPowerW} W</span>
                            </div>

                            {/* Dimensions & Form Factor */}
                            <div className={styles.dimensionRow}>
                              <span className={styles.dimIcon}>📐</span>
                              <div>
                                <strong>{model.lengthM}m × {model.widthM}m</strong> ({panelArea} m² / {(parseFloat(panelArea) * 10.764).toFixed(1)} sq ft)
                                <span className={styles.dimSub}>Thickness: {model.thicknessMm ?? 35}mm • Weight: {model.weightKg ?? 25}kg</span>
                              </div>
                            </div>

                            {/* Dynamic Energy Generation Range (Min - Max) */}
                            <div className={styles.energyRangeBox}>
                              <div className={styles.energyRangeHeader}>
                                <span>⚡ Energy Output Range:</span>
                                <span className={styles.dynamicPill}>Dynamic (Min – Max)</span>
                              </div>
                              <div className={styles.energyRangeGrid}>
                                <div>
                                  <span className={styles.rangeLabel}>Daily Output:</span>
                                  <strong className={styles.rangeValue}>{dailyMin} – {dailyMax} kWh / day</strong>
                                </div>
                                <div>
                                  <span className={styles.rangeLabel}>Annual Output:</span>
                                  <strong className={styles.rangeValue}>{annualMin} – {annualMax} kWh / yr</strong>
                                </div>
                              </div>
                            </div>

                            {/* Requirements & Specs */}
                            <div className={styles.specMiniGrid}>
                              <div>Efficiency: <strong>{model.efficiencyPct}%</strong></div>
                              <div>Temp Coeff: <strong>{model.tempCoeffPmax}%/°C</strong></div>
                              <div>Roof Load: <strong>{model.roofLoadBearingKgPerSqM ?? '18-22 kg/m²'}</strong></div>
                              <div>Wind Rating: <strong>Up to {model.windSpeedRatingKmh ?? 180} km/h</strong></div>
                            </div>

                            <div className={styles.modelSuitsLine}>
                              <span>✓ <em>{model.bestIn}</em></span>
                            </div>

                            <button
                              type="button"
                              className={`${styles.selectModelBtn} ${isChosen ? styles.selectModelBtnActive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPanelId(model.id);
                              }}
                            >
                              {isChosen ? '✓ Selected for Roof Layout' : 'Select This Size'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 5: Real-Time Dynamic Placement & Estimation Cost Prediction */}
                  {dynamicCalc && (
                    <div className={styles.placementAndCostCard}>
                      <div className={styles.calcHeader}>
                        <span className={styles.calcSectionTitle}>
                          4. Dynamic System Sizing & Real Financial Cost Estimation
                        </span>
                        <span className={styles.costBadge}>100% Dynamic Prediction</span>
                      </div>

                      {/* Array Sizing Grid */}
                      <div className={styles.calcGrid}>
                        <div className={styles.calcCard}>
                          <span className={styles.calcLabel}>Optimal Modules to Place</span>
                          <strong className={styles.calcValueHighlight}>
                            {dynamicCalc.panelsToPlace} Panels
                          </strong>
                          <span className={styles.calcSub}>
                            {dynamicCalc.placedCapacityKWp} kWp system ({activePanelSpec.ratedPowerW}W modules)
                          </span>
                        </div>

                        <div className={styles.calcCard}>
                          <span className={styles.calcLabel}>Est. Monthly Bill Savings</span>
                          <strong className={styles.calcValueGreen}>
                            ₹{dynamicCalc.estimatedMonthlySavingsInr.toLocaleString()} / mo
                          </strong>
                          <span className={styles.calcSub}>
                            ~{dynamicCalc.estimatedMonthlyEnergyKwh.toLocaleString()} units generated/mo
                          </span>
                        </div>

                        <div className={styles.calcCard}>
                          <span className={styles.calcLabel}>Est. Annual Generation</span>
                          <strong className={styles.calcValue}>
                            {dynamicCalc.estimatedAnnualEnergyKwh.toLocaleString()} kWh / yr
                          </strong>
                          <span className={styles.calcSub}>
                            Seasonal: {dynamicCalc.metrics.monthlyRange.minMonthlyKwh} ({dynamicCalc.metrics.monthlyRange.minMonthName}) – {dynamicCalc.metrics.monthlyRange.maxMonthlyKwh} ({dynamicCalc.metrics.monthlyRange.maxMonthName}) units/mo
                          </span>
                        </div>
                      </div>

                      {/* Fit Status Banner */}
                      <div className={dynamicCalc.canFitAll ? styles.fitBannerGood : styles.fitBannerWarn}>
                        <span className={styles.fitIconLarge}>{dynamicCalc.canFitAll ? '✓' : '⚠️'}</span>
                        <div>
                          {dynamicCalc.canFitAll ? (
                            <>
                              <strong>Roof Area Fits Needed Panels:</strong> Your ₹{dynamicCalc.billInr.toLocaleString()} monthly bill
                              consumes ~{dynamicCalc.monthlyUnits} units/month, requiring{' '}
                              <strong>{dynamicCalc.panelsToPlace} × {activePanelSpec.model} modules</strong> ({dynamicCalc.placedCapacityKWp} kWp).
                              Your roof can comfortably fit up to {dynamicCalc.effectiveMaxPanels} panels of this {activePanelSpec.lengthM}m × {activePanelSpec.widthM}m size.
                            </>
                          ) : (
                            <>
                              <strong>Area Capacity Reached:</strong> Your ₹{dynamicCalc.billInr.toLocaleString()} monthly bill
                              needs {dynamicCalc.requiredPanels} panels, but your selected roof area fits a maximum of{' '}
                              {dynamicCalc.effectiveMaxPanels} panels of this {activePanelSpec.lengthM}m × {activePanelSpec.widthM}m size.
                              We will place the maximum {dynamicCalc.effectiveMaxPanels} panels to maximize your savings.
                            </>
                          )}
                        </div>
                      </div>

                      {/* DYNAMIC FINANCIAL COST & PM SURYA GHAR SUBSIDY PREDICTION */}
                      <div className={styles.financialCostBox}>
                        <div className={styles.financialHeader}>
                          <span className={styles.financialTitle}>
                            💰 Real Turnkey Installation Cost & Subsidy Prediction
                          </span>
                          <span className={styles.financialSub}>
                            Calibrated to 2025/2026 Indian EPC market rates & PM Surya Ghar guidelines
                          </span>
                        </div>

                        <div className={styles.costTable}>
                          <div className={styles.costRow}>
                            <span>Base EPC System Cost ({dynamicCalc.placedCapacityKWp} kWp @ ~₹{dynamicCalc.costEstimation.baseCostPerKwInr.toLocaleString()}/kW)</span>
                            <strong>₹{dynamicCalc.costEstimation.equipmentBaseCostInr.toLocaleString()}</strong>
                          </div>
                          <div className={styles.costRow}>
                            <span>GST on EPC Solar Plant (12%)</span>
                            <strong>+ ₹{dynamicCalc.costEstimation.gstInr.toLocaleString()}</strong>
                          </div>
                          <div className={styles.costRow}>
                            <span>Gross Turnkey Project Cost (Pre-Subsidy)</span>
                            <strong style={{ color: '#f8fafc' }}>₹{dynamicCalc.costEstimation.grossCostInr.toLocaleString()}</strong>
                          </div>
                          <div className={`${styles.costRow} ${styles.subsidyRow}`}>
                            <span>
                              <strong>🎁 PM Surya Ghar Muft Bijli Yojana Central Subsidy</strong>
                              <span className={styles.subsidyHint}>({dynamicCalc.placedCapacityKWp} kW system)</span>
                            </span>
                            <strong className={styles.subsidyGreen}>- ₹{dynamicCalc.costEstimation.subsidyInr.toLocaleString()}</strong>
                          </div>

                          <div className={styles.costDivider} />

                          <div className={`${styles.costRow} ${styles.netCostRow}`}>
                            <span>
                              <strong>Net Investment (Customer Out-of-Pocket)</strong>
                              <span className={styles.netCostHint}>After Direct Central DBT Subsidy</span>
                            </span>
                            <strong className={styles.netCostValue}>
                              ₹{dynamicCalc.costEstimation.netCostInr.toLocaleString()}
                            </strong>
                          </div>
                        </div>

                        {/* Financial ROI Highlights */}
                        <div className={styles.roiBanner}>
                          <div className={styles.roiItem}>
                            <span className={styles.roiLabel}>Simple Payback Period</span>
                            <strong className={styles.roiHighlight}>{dynamicCalc.costEstimation.paybackYears} Years</strong>
                            <span className={styles.roiSub}>Free power for next 21+ yrs</span>
                          </div>
                          <div className={styles.roiItem}>
                            <span className={styles.roiLabel}>25-Year Cumulative Savings</span>
                            <strong className={styles.roiGreen}>₹{dynamicCalc.costEstimation.twentyFiveYearSavingsInr.toLocaleString()}</strong>
                            <span className={styles.roiSub}>Includes 3% tariff inflation</span>
                          </div>
                          <div className={styles.roiItem}>
                            <span className={styles.roiLabel}>Levelized Cost of Solar</span>
                            <strong className={styles.roiHighlight}>₹{dynamicCalc.costEstimation.levelizedCostOfEnergyInrPerKwh} / unit</strong>
                            <span className={styles.roiSub}>vs grid ~₹8.50 / unit</span>
                          </div>
                        </div>
                      </div>
                    </div>
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

            {/* Modal Footer */}
            {activeTab === 'manual' && (
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.maxCapacityBtn}
                  onClick={handlePlaceMaxCapacity}
                  title={`Fill all available space with ${dynamicCalc?.effectiveMaxPanels ?? maxPanelCount} panels`}
                >
                  Place Max Capacity ({dynamicCalc?.effectiveMaxPanels ?? maxPanelCount} Panels)
                </button>

                <button
                  type="button"
                  className={styles.placeBtn}
                  onClick={handlePlacePanels}
                  disabled={!billInput || parseFloat(billInput) < 1000}
                >
                  <span>⚡</span>
                  <span>
                    Place {dynamicCalc?.panelsToPlace ?? 0} × {activeManufacturer.brandName} Panels ({dynamicCalc?.placedCapacityKWp ?? 0} kWp) on Rooftop
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
