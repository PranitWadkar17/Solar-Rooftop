import type { Capability } from '../types';

export const capabilities: Capability[] = [
  {
    id: 'rooftop-intelligence',
    icon: 'rooftop',
    title: 'Rooftop Intelligence',
    description:
      'Extract roof geometry, boundaries, orientation, and tilt from satellite and aerial imagery to build a digital rooftop profile.',
    accent: 'blue',
  },
  {
    id: 'obstacle-detection',
    icon: 'obstacle',
    title: 'AI Obstacle Detection',
    description:
      'Identify water tanks, HVAC units, stairheads, antennas, and other rooftop obstacles that reduce usable panel area.',
    accent: 'solar',
  },
  {
    id: 'solar-shadow',
    icon: 'sun',
    title: 'Solar & Shadow Analysis',
    description:
      'Model solar irradiance and shadow patterns across the rooftop surface accounting for time-of-day and seasonal variation.',
    accent: 'solar',
  },
  {
    id: 'panel-optimization',
    icon: 'panels',
    title: 'Panel Optimization',
    description:
      'Evaluate panel placement configurations to maximize energy capture while respecting setback rules and structural constraints.',
    accent: 'green',
  },
  {
    id: 'energy-simulation',
    icon: 'energy',
    title: 'Energy Simulation',
    description:
      'Estimate annual energy generation based on panel layout, local solar resource data, and system efficiency parameters.',
    accent: 'solar',
  },
  {
    id: 'consumption-sizing',
    icon: 'meter',
    title: 'Consumption-Aware Sizing',
    description:
      'Right-size the solar system based on electricity consumption patterns, net metering policies, and self-consumption targets.',
    accent: 'blue',
  },
  {
    id: 'financial-analysis',
    icon: 'finance',
    title: 'Financial Analysis',
    description:
      'Project costs, savings, payback period, and return on investment using location-specific tariffs and applicable incentive structures.',
    accent: 'green',
  },
  {
    id: 'policy-context',
    icon: 'policy',
    title: 'India Policy Context',
    description:
      'Incorporate state-level net metering regulations, DISCOM requirements, and subsidy frameworks into the assessment workflow.',
    accent: 'blue',
  },
  {
    id: 'explainable-suitability',
    icon: 'explain',
    title: 'Explainable Suitability',
    description:
      'Provide transparent, factor-level scoring that explains why a rooftop is or is not suitable — not just a binary verdict.',
    accent: 'green',
  },
  {
    id: 'what-if',
    icon: 'whatif',
    title: 'What-If Simulation',
    description:
      'Explore how changes to obstacles, panel layout, shading, or equipment affect system capacity and financial outcomes.',
    accent: 'solar',
  },
];
