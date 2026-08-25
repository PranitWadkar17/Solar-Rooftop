import type { Scenario } from '../types';

export const scenarios: Scenario[] = [
  {
    id: 'remove-obstacle',
    label: 'Remove Obstacle',
    change: 'Relocate rooftop water tank',
    newValue: '9.0 kW',
    delta: '+0.8 kW',
  },
  {
    id: 'change-layout',
    label: 'Change Layout',
    change: 'Optimize panel tilt and spacing',
    newValue: '9.4 kW',
    delta: '+1.2 kW',
  },
  {
    id: 'improve-shading',
    label: 'Improve Shading',
    change: 'Trim nearby tree canopy',
    newValue: '9.8 kW',
    delta: '+1.6 kW',
  },
  {
    id: 'alternate-panel',
    label: 'Use Alternate Panel',
    change: 'Switch to higher-efficiency module',
    newValue: '10.1 kW',
    delta: '+1.9 kW',
  },
];
