// ============================================
// Panel Hardware Library — Photovoltaic Modules
// ============================================

import type { PanelSpecification } from '@/types/optimization.js';

export const DEFAULT_PANEL_LIBRARY: PanelSpecification[] = [
  {
    id: 'panel-ja-555w',
    manufacturer: 'JA Solar',
    model: 'DeepBlue 4.0 Pro Bifacial',
    ratedPowerW: 555,
    lengthM: 2.278,
    widthM: 1.134,
    efficiencyPct: 21.5,
    technology: 'N-Type TOPCon Bifacial',
    tempCoeffPmax: -0.30,
    isDemo: false,
    source: 'Verified Manufacturer Datasheet',
  },
  {
    id: 'panel-longi-580w',
    manufacturer: 'LONGi Solar',
    model: 'Hi-MO 6 Explorer',
    ratedPowerW: 580,
    lengthM: 2.278,
    widthM: 1.134,
    efficiencyPct: 22.5,
    technology: 'HPBC Monocrystalline',
    tempCoeffPmax: -0.29,
    isDemo: false,
    source: 'Verified Manufacturer Datasheet',
  },
  {
    id: 'panel-sunpower-430w',
    manufacturer: 'SunPower / Maxeon',
    model: 'Maxeon 6 Black Premium',
    ratedPowerW: 430,
    lengthM: 1.812,
    widthM: 1.032,
    efficiencyPct: 22.8,
    technology: 'N-Type Maxeon IBC',
    tempCoeffPmax: -0.27,
    isDemo: false,
    source: 'Verified Manufacturer Datasheet',
  },
  {
    id: 'panel-canadian-660w',
    manufacturer: 'Canadian Solar',
    model: 'HiKu7 Commercial High-Power',
    ratedPowerW: 660,
    lengthM: 2.384,
    widthM: 1.303,
    efficiencyPct: 21.2,
    technology: 'Dual-Cell PERC Bifacial',
    tempCoeffPmax: -0.34,
    isDemo: false,
    source: 'Verified Manufacturer Datasheet',
  },
  {
    id: 'panel-trina-440w',
    manufacturer: 'Trina Solar',
    model: 'Vertex S+ Compact Roof',
    ratedPowerW: 440,
    lengthM: 1.762,
    widthM: 1.134,
    efficiencyPct: 22.0,
    technology: 'N-Type Dual-Glass TOPCon',
    tempCoeffPmax: -0.30,
    isDemo: false,
    source: 'Verified Manufacturer Datasheet',
  },
];

export function getPanelById(id: string): PanelSpecification {
  return (
    DEFAULT_PANEL_LIBRARY.find((p) => p.id === id) ?? DEFAULT_PANEL_LIBRARY[0]
  );
}
