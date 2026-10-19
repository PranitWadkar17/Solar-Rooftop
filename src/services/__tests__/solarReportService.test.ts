import { describe, it, expect } from 'vitest';
import { normalizeBillText } from '../billParser';
import { computeCostBreakdown, computePayback, computeYearlyProjection, computeSubsidy } from '../solarReportService';
import { SOLAR_CONFIG } from '@/data/solarConfig';

describe('normalizeBillText', () => {
  it('converts Devanagari digits to ASCII', () => {
    expect(normalizeBillText('युनिट: ९३५')).toContain('935');
  });

  it('maps Marathi month जून to jun', () => {
    expect(normalizeBillText('जून-2026 935')).toContain('jun');
  });

  it('maps मे only when followed by a separator and a year', () => {
    const withYear = normalizeBillText('मे-2026 300');
    expect(withYear).toContain('may');

    const withoutYear = normalizeBillText('मे हे आहे');
    expect(withoutYear).not.toContain('may');
  });

  it('converts other Marathi months accurately', () => {
    expect(normalizeBillText('जानेवारी-2026')).toContain('jan');
    expect(normalizeBillText('फेब्रुवारी-2026')).toContain('feb');
    expect(normalizeBillText('ऑक्टोबर-2026')).toContain('oct');
    expect(normalizeBillText('डिसेंबर-2025')).toContain('dec');
  });
});

describe('computeCostBreakdown', () => {
  it('component items sum to exact base cost', () => {
    const bd = computeCostBreakdown(3);
    const componentSum = bd.components.reduce((sum, c) => sum + c.amountInr, 0);
    expect(Math.abs(componentSum - bd.baseCostInr)).toBe(0);
  });

  it('gross cost equals base cost plus GST', () => {
    const bd = computeCostBreakdown(3);
    expect(bd.grossCostInr).toBe(bd.baseCostInr + bd.gstInr);
  });

  it('net cost equals gross cost minus subsidy', () => {
    const bd = computeCostBreakdown(3);
    expect(bd.netCostInr).toBe(bd.grossCostInr - bd.subsidyInr);
  });

  it('correctly calculates subsidy for various kW sizes', () => {
    expect(computeSubsidy(1)).toBe(30000);
    expect(computeSubsidy(2)).toBe(60000);
    expect(computeSubsidy(3)).toBe(78000);
    expect(computeSubsidy(5)).toBe(78000); // capped at 78000
    expect(computeSubsidy(1.5)).toBe(45000); // interpolated
  });
});

describe('computePayback', () => {
  it('returns valid fractional years within project lifetime', () => {
    const projection = computeYearlyProjection(50000, 200000);
    const payback = computePayback(200000, projection);
    expect(payback).toBeGreaterThan(0);
    expect(payback).toBeLessThanOrEqual(SOLAR_CONFIG.projectLifetimeYears);
  });

  it('achieves payback in under 5 years for high savings ratio', () => {
    const projection = computeYearlyProjection(60000, 150000);
    const payback = computePayback(150000, projection);
    expect(payback).toBeLessThan(5);
  });
});
