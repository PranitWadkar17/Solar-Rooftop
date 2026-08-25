import type { UseCase } from '../types';

export const useCases: UseCase[] = [
  {
    id: 'homeowners',
    icon: 'home',
    title: 'Homeowners',
    description:
      'Understand rooftop solar potential, expected energy generation, and financial feasibility before committing to an installation.',
  },
  {
    id: 'installers',
    icon: 'installer',
    title: 'Solar Installers',
    description:
      'Accelerate preliminary site assessment, system planning, and client proposals with data-driven rooftop intelligence.',
  },
  {
    id: 'institutions',
    icon: 'institution',
    title: 'Institutions',
    description:
      'Assess schools, hospitals, office complexes, and large buildings for solar deployment at institutional scale.',
  },
  {
    id: 'government',
    icon: 'government',
    title: 'Government & Municipal Bodies',
    description:
      'Identify and prioritize high-potential rooftops across districts for solar adoption planning and policy implementation.',
  },
];
