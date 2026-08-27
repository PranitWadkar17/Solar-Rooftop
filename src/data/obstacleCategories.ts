// ============================================
// Obstacle Categories — Central Configuration
// ============================================

import type { ObstacleCategoryDef } from '@/types/rooftop.js';

export const OBSTACLE_CATEGORIES: ObstacleCategoryDef[] = [
  {
    type: 'tree',
    label: 'Tree',
    icon: '🌳',
    color: '#22c55e',
    defaultHeight: 5,
    defaultClearance: 1.5,
    supportedGeometries: ['point', 'polygon'],
    description: 'Tree or large vegetation that casts shadow on the rooftop.',
  },
  {
    type: 'water_tank',
    label: 'Water Tank',
    icon: '🪣',
    color: '#3b82f6',
    defaultHeight: 1.5,
    defaultClearance: 0.5,
    supportedGeometries: ['rectangle', 'polygon'],
    description: 'Overhead or rooftop water storage tank.',
  },
  {
    type: 'staircase_room',
    label: 'Staircase Room',
    icon: '🚪',
    color: '#8b5cf6',
    defaultHeight: 3,
    defaultClearance: 1.0,
    supportedGeometries: ['rectangle', 'polygon'],
    description: 'Staircase head room or building access structure.',
  },
  {
    type: 'ac_unit',
    label: 'AC Unit',
    icon: '❄️',
    color: '#06b6d4',
    defaultHeight: 0.8,
    defaultClearance: 0.5,
    supportedGeometries: ['point', 'rectangle'],
    description: 'Air conditioning outdoor unit or compressor.',
  },
  {
    type: 'solar_heater',
    label: 'Solar Heater',
    icon: '☀️',
    color: '#f97316',
    defaultHeight: 1.2,
    defaultClearance: 0.5,
    supportedGeometries: ['rectangle', 'polygon'],
    description: 'Existing solar water heater panel/collector.',
  },
  {
    type: 'existing_solar_panel',
    label: 'Existing Solar Panel',
    icon: '⚡',
    color: '#eab308',
    defaultHeight: 0.3,
    defaultClearance: 0.3,
    supportedGeometries: ['rectangle', 'polygon'],
    description: 'Existing photovoltaic solar panel array. Tracked separately from proposed panels.',
  },
  {
    type: 'chimney_vent',
    label: 'Chimney / Vent',
    icon: '🏭',
    color: '#78716c',
    defaultHeight: 1.5,
    defaultClearance: 0.5,
    supportedGeometries: ['point', 'rectangle'],
    description: 'Chimney, exhaust vent, or flue pipe.',
  },
  {
    type: 'equipment',
    label: 'Equipment',
    icon: '⚙️',
    color: '#a855f7',
    defaultHeight: 1.0,
    defaultClearance: 0.5,
    supportedGeometries: ['point', 'rectangle', 'polygon'],
    description: 'General rooftop equipment or machinery.',
  },
  {
    type: 'building_structure',
    label: 'Building Structure',
    icon: '🏗️',
    color: '#64748b',
    defaultHeight: 2.5,
    defaultClearance: 1.0,
    supportedGeometries: ['rectangle', 'polygon'],
    description: 'Structural element like a parapet wall, elevator shaft, or raised platform.',
  },
  {
    type: 'other',
    label: 'Other',
    icon: '📌',
    color: '#94a3b8',
    defaultHeight: null,
    defaultClearance: 0.5,
    supportedGeometries: ['point', 'rectangle', 'polygon'],
    description: 'Any other rooftop obstacle not covered by the above categories.',
  },
];

export function getObstacleCategory(type: string): ObstacleCategoryDef {
  return OBSTACLE_CATEGORIES.find((c) => c.type === type) ?? OBSTACLE_CATEGORIES[OBSTACLE_CATEGORIES.length - 1];
}
