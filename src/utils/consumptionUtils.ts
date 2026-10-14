// ============================================
// Consumption Utilities — Panel Count Calculation
// ============================================

import type { ElectricityConsumptionProfile } from '@/types/index.js';
import type { PanelSpecification } from '@/types/optimization.js';

/**
 * Calculates the number of solar panels required to meet annual consumption
 * 
 * @param consumption - Electricity consumption profile with annual kWh
 * @param panelSpec - Solar panel specification
 * @param solarResourceKwhPerKwp - Annual solar resource (kWh/kWp), default 1450 for moderate climate
 * @returns Required number of panels, or null if consumption is unavailable
 */
export function calculateRequiredPanelCount(
  consumption: ElectricityConsumptionProfile | null,
  panelSpec: PanelSpecification,
  solarResourceKwhPerKwp: number = 1450
): number | null {
  if (!consumption || consumption.annualKwh === null || consumption.annualKwh <= 0) {
    return null;
  }

  // System losses matching energyAnalysisService
  // These values are averaged across all months for annual calculation
  const systemLosses = {
    inverterEfficiency: 0.97,      // 97% inverter efficiency
    dcCableLoss: 0.98,              // 2% DC cable losses
    acCableLoss: 0.995,             // 0.5% AC cable losses
    soilingLoss: 0.96,              // 4% average soiling (varies by season)
    temperatureLoss: 0.92,          // 8% average temperature losses
    mismatchLoss: 0.98,             // 2% panel mismatch
    lidLoss: 0.985,                 // 1.5% light-induced degradation
    availabilityLoss: 0.995,        // 0.5% downtime
    agingLoss: 0.997,               // 0.3% first-year degradation
  };

  // Combined performance ratio (PR)
  const performanceRatio = 
    systemLosses.inverterEfficiency *
    systemLosses.dcCableLoss *
    systemLosses.acCableLoss *
    systemLosses.soilingLoss *
    systemLosses.temperatureLoss *
    systemLosses.mismatchLoss *
    systemLosses.lidLoss *
    systemLosses.availabilityLoss *
    systemLosses.agingLoss;

  // Calculate annual energy per panel (kWh/year)
  // Formula: Panel kWp × Solar Resource (kWh/kWp) × Performance Ratio
  const panelKWp = panelSpec.ratedPowerW / 1000;
  const annualEnergyPerPanel = panelKWp * solarResourceKwhPerKwp * performanceRatio;

  // Required panels = Annual consumption / Energy per panel
  const requiredPanels = Math.ceil(consumption.annualKwh / annualEnergyPerPanel);

  return requiredPanels;
}

/**
 * Calculates the target system capacity (kWp) needed for consumption
 * 
 * @param consumption - Electricity consumption profile
 * @param solarResourceKwhPerKwp - Annual solar resource (kWh/kWp)
 * @returns Target capacity in kWp, or null if unavailable
 */
export function calculateTargetCapacityKWp(
  consumption: ElectricityConsumptionProfile | null,
  solarResourceKwhPerKwp: number = 1450
): number | null {
  if (!consumption || consumption.annualKwh === null || consumption.annualKwh <= 0) {
    return null;
  }

  // System performance ratio (same as above)
  const performanceRatio = 0.78; // Combined factor from all losses

  // Required capacity = Annual consumption / (Solar resource × PR)
  const targetKWp = consumption.annualKwh / (solarResourceKwhPerKwp * performanceRatio);

  return Math.round(targetKWp * 100) / 100; // Round to 2 decimals
}

/**
 * Validates if the rooftop can fit the required number of panels
 * 
 * @param requiredPanels - Number of panels needed
 * @param availableArea - Available rooftop area in square meters
 * @param panelSpec - Solar panel specification
 * @returns Object with validation result and message
 */
export function validateRooftopCapacity(
  requiredPanels: number,
  availableArea: number,
  panelSpec: PanelSpecification
): { canFit: boolean; message: string; utilizationPct: number } {
  const panelAreaSqM = panelSpec.lengthM * panelSpec.widthM;
  const requiredAreaSqM = requiredPanels * panelAreaSqM;
  
  // Account for spacing, tilt, and clearances (estimate 60% utilization)
  const effectiveRequiredArea = requiredAreaSqM / 0.6;
  
  const canFit = effectiveRequiredArea <= availableArea;
  const utilizationPct = Math.round((effectiveRequiredArea / availableArea) * 100);

  let message = '';
  if (canFit) {
    message = `✓ Rooftop can fit ${requiredPanels} panels (${utilizationPct}% utilization)`;
  } else {
    const maxPossiblePanels = Math.floor((availableArea * 0.6) / panelAreaSqM);
    message = `⚠️ Rooftop too small: fits ${maxPossiblePanels} panels, need ${requiredPanels}`;
  }

  return { canFit, message, utilizationPct };
}
