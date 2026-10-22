import { describe, it, expect } from 'vitest';
import {
  calculateAccurateSolarMetrics,
  calculateDynamicCostEstimation,
  calculateSuryaGharSubsidy,
} from '../energyPredictionService';
import { MANUFACTURER_PROFILES } from '@/data/panelLibrary';
import type { SolarAnalysis } from '@/types/solar.js';

describe('Energy Prediction & Dynamic Cost Estimation Service', () => {
  const tataProfile = MANUFACTURER_PROFILES.find((m) => m.id === 'tata')!;
  const vikramProfile = MANUFACTURER_PROFILES.find((m) => m.id === 'vikram')!;
  const adaniProfile = MANUFACTURER_PROFILES.find((m) => m.id === 'adani')!;

  const mockSolarAnalysis: SolarAnalysis = {
    id: 'solar-test',
    assessmentId: 'assess-123',
    rooftopId: 'roof-123',
    rooftopVersionTimestamp: '2026-10-23',
    status: 'completed',
    analyzedAt: '2026-10-23',
    resourceData: {
      provider: 'NASA POWER',
      dataset: 'MERRA-2',
      retrievedAt: '2026-10-23',
      latitude: 18.52,
      longitude: 73.85,
      annualGhi: 1800,
      annualDni: 1700,
      annualDhi: 700,
      peakSunHoursDaily: 4.93,
      monthlyData: [
        { month: 1, monthName: 'Jan', ghi: 4.5, dni: 4.8, dhi: 1.2, avgTempC: 22 },
        { month: 2, monthName: 'Feb', ghi: 5.2, dni: 5.4, dhi: 1.3, avgTempC: 24 },
        { month: 3, monthName: 'Mar', ghi: 6.0, dni: 6.2, dhi: 1.5, avgTempC: 28 },
        { month: 4, monthName: 'Apr', ghi: 6.5, dni: 6.6, dhi: 1.6, avgTempC: 32 },
        { month: 5, monthName: 'May', ghi: 6.3, dni: 6.1, dhi: 1.8, avgTempC: 34 },
        { month: 6, monthName: 'Jun', ghi: 4.2, dni: 3.5, dhi: 2.1, avgTempC: 29 },
        { month: 7, monthName: 'Jul', ghi: 3.2, dni: 2.2, dhi: 2.2, avgTempC: 26 },
        { month: 8, monthName: 'Aug', ghi: 3.4, dni: 2.4, dhi: 2.1, avgTempC: 26 },
        { month: 9, monthName: 'Sep', ghi: 4.5, dni: 4.2, dhi: 1.8, avgTempC: 27 },
        { month: 10, monthName: 'Oct', ghi: 5.1, dni: 5.2, dhi: 1.5, avgTempC: 27 },
        { month: 11, monthName: 'Nov', ghi: 4.7, dni: 5.0, dhi: 1.3, avgTempC: 24 },
        { month: 12, monthName: 'Dec', ghi: 4.3, dni: 4.6, dhi: 1.2, avgTempC: 21 },
      ],
      resolution: '0.5 deg',
      isFallback: false,
    },
    zones: [],
    selectedArea: null,
    sectionMetrics: [],
    shadingBreakdown: {
      trees: { areaM2: 0, percentage: 0 },
      parapets: { areaM2: 0, percentage: 0 },
      structures: { areaM2: 0, percentage: 0 },
      totalShadedAreaM2: 0,
      totalUnshadedAreaM2: 50,
    },
    avgSolarAccessPct: 95,
    avgShadingImpactPct: 5,
    peakSunHoursAnnual: 4.93,
    grossRoofAreaSqM: 60,
    physicalUsableAreaSqM: 50,
    solarEffectiveAreaSqM: 48,
    overallClassification: 'HIGH',
    confidenceScore: 'HIGH',
    confidenceFactors: {
      solarDataAvailable: true,
      roofGeometryAccurate: true,
      obstacleHeightsKnown: true,
      terrainEvaluated: false,
    },
    assumptions: {} as any,
    updatedAt: '2026-10-23',
  };

  describe('PM Surya Ghar Subsidy Calculations', () => {
    it('returns 0 for 0 kW', () => {
      expect(calculateSuryaGharSubsidy(0)).toBe(0);
    });

    it('returns ₹30,000 for 1 kW system', () => {
      expect(calculateSuryaGharSubsidy(1.0)).toBe(30000);
    });

    it('returns ₹60,000 for 2 kW system', () => {
      expect(calculateSuryaGharSubsidy(2.0)).toBe(60000);
    });

    it('returns ₹78,000 for 3 kW system', () => {
      expect(calculateSuryaGharSubsidy(3.0)).toBe(78000);
    });

    it('caps residential subsidy at ₹78,000 for systems > 3 kW', () => {
      expect(calculateSuryaGharSubsidy(5.0)).toBe(78000);
      expect(calculateSuryaGharSubsidy(10.0)).toBe(78000);
    });
  });

  describe('Accurate Solar Metrics Prediction', () => {
    it('calculates dynamic generation and seasonal ranges for Tata Power 545W panel', () => {
      const model = tataProfile.models.find((p) => p.ratedPowerW === 545)!;
      const metrics = calculateAccurateSolarMetrics(6, model, mockSolarAnalysis, 14, 15);

      expect(metrics.activeCapacityKWp).toBe(3.27); // 6 * 545 / 1000 = 3.27 kWp
      expect(metrics.maxCapacityKWp).toBe(7.63); // 14 * 545 / 1000 = 7.63 kWp
      expect(metrics.estimatedAnnualGenerationKwh).toBeGreaterThan(4000);
      expect(metrics.maxPotentialAnnualEnergyKwh).toBeGreaterThan(metrics.estimatedAnnualGenerationKwh);

      // Monthly breakdown should have 12 months with distinct seasonal differences
      expect(metrics.monthlyBreakdown).toHaveLength(12);
      expect(metrics.monthlyRange.minMonthlyKwh).toBeLessThan(metrics.monthlyRange.maxMonthlyKwh);
      expect(metrics.monthlyRange.minMonthName).toBe('Jul'); // Monsoon dip in July
      expect(['Apr', 'May']).toContain(metrics.monthlyRange.maxMonthName); // Summer peak
    });

    it('calculates min to max ranges for single panels', () => {
      const model = vikramProfile.models[0];
      const metrics = calculateAccurateSolarMetrics(4, model, mockSolarAnalysis, 10, 15);

      expect(metrics.singlePanelDailyKwh.min).toBeLessThan(metrics.singlePanelDailyKwh.max);
      expect(metrics.singlePanelAnnualKwh.min).toBeLessThan(metrics.singlePanelAnnualKwh.max);
    });
  });

  describe('Dynamic Financial & Cost Estimation', () => {
    it('predicts real EPC cost, GST, net cost, and payback dynamically', () => {
      const model = adaniProfile.models[1]; // 545W
      const cost = calculateDynamicCostEstimation(3.27, model, 3000, 8.5, 410);

      expect(cost.grossCostInr).toBe(cost.equipmentBaseCostInr + cost.gstInr);
      expect(cost.subsidyInr).toBe(78000); // 3.27 kW qualifies for max ₹78k
      expect(cost.netCostInr).toBe(cost.grossCostInr - cost.subsidyInr);
      expect(cost.paybackYears).toBeGreaterThan(1);
      expect(cost.paybackYears).toBeLessThan(6);
      expect(cost.twentyFiveYearSavingsInr).toBeGreaterThan(500000);
    });
  });
});
