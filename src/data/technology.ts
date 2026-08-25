import type { TechCategory } from '../types';

export const techCategories: TechCategory[] = [
  {
    category: 'GIS & Mapping',
    icon: 'gis',
    technologies: ['Leaflet', 'PostGIS', 'GeoPandas', 'GeoJSON'],
  },
  {
    category: 'Computer Vision',
    icon: 'vision',
    technologies: ['PyTorch', 'OpenCV', 'Segmentation Models'],
  },
  {
    category: 'Solar Modelling',
    icon: 'solar',
    technologies: ['PVLib', 'Solar Resource APIs', 'Irradiance Models'],
  },
  {
    category: 'Optimization',
    icon: 'optimization',
    technologies: ['Panel Placement', 'Configuration Search', 'Constraint Solving'],
  },
  {
    category: '3D Visualization',
    icon: 'threed',
    technologies: ['Three.js', 'WebGL', '3D Roof Models'],
  },
  {
    category: 'Platform',
    icon: 'platform',
    technologies: ['React', 'TypeScript', 'Python', 'FastAPI', 'PostgreSQL'],
  },
];
