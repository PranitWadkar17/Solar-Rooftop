// ============================================
// Building Service — OSM Overpass Building Footprints & Custom Drawing
// ============================================

import type { BuildingFootprint } from '@/types/index.js';
import { calculatePolygonArea } from '@/utils/geoUtils';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  center?: { lat: number; lon: number };
}

function overpassElementToFootprint(el: OverpassElement): BuildingFootprint | null {
  if (!el.geometry || el.geometry.length < 3) return null;

  const coordinates = el.geometry.map((p) => [p.lon, p.lat] as [number, number]);
  // Close the ring if not already closed
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([...first]);
  }

  // Calculate centroid
  let latSum = 0;
  let lngSum = 0;
  el.geometry.forEach((p) => {
    latSum += p.lat;
    lngSum += p.lon;
  });
  const center = {
    lat: latSum / el.geometry.length,
    lng: lngSum / el.geometry.length,
  };

  // Calculate footprint area
  const area = calculatePolygonArea(coordinates);

  const rawBuilding = el.tags?.building;
  const buildingType = rawBuilding === 'yes' ? 'Building Footprint' : (rawBuilding ? rawBuilding.charAt(0).toUpperCase() + rawBuilding.slice(1) : 'Building');

  return {
    id: `osm-${el.type}-${el.id}`,
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    properties: {
      name: el.tags?.name || (el.tags?.['addr:housenumber'] ? `${el.tags['addr:housenumber']} ${el.tags['addr:street'] || ''}`.trim() : undefined),
      buildingType,
      levels: el.tags?.['building:levels'] ? parseInt(el.tags['building:levels'], 10) : undefined,
      area: Math.round(area),
      isManual: false,
    },
    center,
  };
}

export async function findNearbyBuildings(
  lat: number,
  lng: number,
  radiusMeters: number = 120
): Promise<BuildingFootprint[]> {
  // Overpass QL: find buildings within radius
  const query = `
    [out:json][timeout:12];
    (
      way["building"](around:${radiusMeters},${lat},${lng});
    );
    out geom;
  `;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API failed: ${response.status}`);
    }

    const data = await response.json();
    const elements: OverpassElement[] = data.elements ?? [];

    return elements
      .map(overpassElementToFootprint)
      .filter((f): f is BuildingFootprint => f !== null);
  } catch (error) {
    console.warn('Building footprint fetch failed:', error);
    return [];
  }
}

/**
 * Creates a valid BuildingFootprint object from user-drawn coordinates
 * @param coordinates Array of [lng, lat] vertices (without needing final duplicate)
 */
export function createCustomFootprint(coordinates: [number, number][]): BuildingFootprint {
  if (coordinates.length < 3) {
    throw new Error('A polygon requires at least 3 points.');
  }

  // Ensure closed ring
  const closedCoords: [number, number][] = [...coordinates];
  const first = closedCoords[0];
  const last = closedCoords[closedCoords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closedCoords.push([...first]);
  }

  // Calculate centroid
  let latSum = 0;
  let lngSum = 0;
  coordinates.forEach(([lng, lat]) => {
    latSum += lat;
    lngSum += lng;
  });

  const center = {
    lat: latSum / coordinates.length,
    lng: lngSum / coordinates.length,
  };

  const area = calculatePolygonArea(closedCoords);
  const id = `custom-polygon-${Date.now().toString(36)}`;

  return {
    id,
    geometry: {
      type: 'Polygon',
      coordinates: [closedCoords],
    },
    properties: {
      name: 'Custom Rooftop Boundary',
      buildingType: 'User-Drawn Boundary',
      area: Math.round(area),
      isManual: true,
      vertexCount: coordinates.length,
    },
    center,
  };
}
