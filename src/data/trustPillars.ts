import type { TrustPillar } from '../types';

export const trustPillars: TrustPillar[] = [
  {
    id: 'explainable-scores',
    icon: 'chart',
    title: 'Explainable Scores',
    description:
      'Every suitability score is broken down by contributing factors — geometry, solar access, shading, obstacles, and economics.',
  },
  {
    id: 'data-confidence',
    icon: 'confidence',
    title: 'Data Confidence',
    description:
      'Assessments include confidence indicators based on imagery quality, data recency, and model reliability for the given location.',
  },
  {
    id: 'imagery-awareness',
    icon: 'imagery',
    title: 'Imagery & Data Awareness',
    description:
      'The platform surfaces the date and resolution of source imagery so users understand the basis of the analysis.',
  },
  {
    id: 'transparent-assumptions',
    icon: 'transparency',
    title: 'Transparent Assumptions',
    description:
      'Key assumptions — panel efficiency, degradation, tariff rates, discount rates — are documented and adjustable.',
  },
  {
    id: 'manual-correction',
    icon: 'edit',
    title: 'Manual Correction',
    description:
      'Users and professionals can override detected boundaries, adjust obstacles, and refine inputs for higher accuracy.',
  },
  {
    id: 'professional-verification',
    icon: 'verify',
    title: 'Professional Verification',
    description:
      'The platform clearly communicates that remote analysis is preliminary and final installation requires physical site inspection.',
  },
];
