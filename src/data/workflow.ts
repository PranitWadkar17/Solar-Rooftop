import type { WorkflowStep } from '../types';

export const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    title: 'Pinpoint & Scan',
    description: 'Lock onto any rooftop via GPS or address to ingest high-resolution 3D aerial data.',
    icon: 'locate',
  },
  {
    number: '02',
    title: '3D Segmentation',
    description: 'Neural networks detect roof planes, pitch, orientation, vents, and HVAC obstructions.',
    icon: 'understand',
  },
  {
    number: '03',
    title: 'Sun Raytracing',
    description: 'Simulate annual solar irradiance, tree canopy shadows, and peak irradiance vectors.',
    icon: 'model',
  },
  {
    number: '04',
    title: 'Bill Optimization',
    description: 'Automatically position the ideal panel count tailored to monthly electrical consumption.',
    icon: 'optimize',
  },
  {
    number: '05',
    title: 'Actionable ROI',
    description: 'Get verified solar generation, grid net-metering savings, payback period, and incentives.',
    icon: 'decide',
  },
];
