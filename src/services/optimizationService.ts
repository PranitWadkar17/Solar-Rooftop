// ============================================
// Optimization Persistence & Synchronization Service
// ============================================

import type { Rooftop } from '@/types/rooftop.js';
import type { SolarAnalysis } from '@/types/solar.js';
import type { PanelLayout } from '@/types/optimization.js';

const STORAGE_PREFIX = 'solarroof-optimization-';

function getStorageKey(assessmentId: string): string {
  return `${STORAGE_PREFIX}${assessmentId}`;
}

export function savePanelLayout(layout: PanelLayout): void {
  try {
    sessionStorage.setItem(getStorageKey(layout.assessmentId), JSON.stringify(layout));
  } catch (e) {
    console.warn('Failed to persist panel layout:', e);
  }
}

export function loadPanelLayout(assessmentId: string): PanelLayout | null {
  try {
    const stored = sessionStorage.getItem(getStorageKey(assessmentId));
    if (!stored) return null;
    return JSON.parse(stored) as PanelLayout;
  } catch {
    return null;
  }
}

export function clearPanelLayout(assessmentId: string): void {
  sessionStorage.removeItem(getStorageKey(assessmentId));
}

/**
 * Checks if the existing saved panel layout was computed on an older version of the rooftop or solar selection.
 */
export function isLayoutOutdated(
  layout: PanelLayout | null,
  rooftop: Rooftop | null,
  solarAnalysis: SolarAnalysis | null,
): boolean {
  if (!layout || !rooftop || !solarAnalysis) return false;
  if (layout.rooftopId !== rooftop.id) return true;
  if (layout.solarAnalysisId !== solarAnalysis.id) return true;
  if (solarAnalysis.selectedArea && layout.selectedAreaId !== solarAnalysis.selectedArea.id) return true;
  return false;
}
