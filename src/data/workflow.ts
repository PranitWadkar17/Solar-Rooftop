import type { WorkflowStep } from '../types';

export const workflowSteps: WorkflowStep[] = [
  {
    number: '01',
    title: 'Locate',
    description: 'Find the rooftop using address, coordinates, or interactive map selection.',
    icon: 'locate',
  },
  {
    number: '02',
    title: 'Understand',
    description: 'Analyze roof geometry, detect obstacles, and assess the surrounding environment.',
    icon: 'understand',
  },
  {
    number: '03',
    title: 'Model',
    description: 'Calculate solar exposure, shadow patterns, and usable rooftop area throughout the year.',
    icon: 'model',
  },
  {
    number: '04',
    title: 'Optimize',
    description: 'Evaluate panel configurations, placement strategies, and energy capture potential.',
    icon: 'optimize',
  },
  {
    number: '05',
    title: 'Decide',
    description: 'Understand suitability, economics, constraints, and improvement opportunities.',
    icon: 'decide',
  },
];
