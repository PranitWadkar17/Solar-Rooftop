// ============================================
// Building Service — OSM Overpass Building Footprints & Custom Drawing
// Enhanced with data quality validation and multi-source fallback
// ============================================

import type { BuildingFootprint } from '@/types/index.js';
import { calculatePolygonArea } from '@/utils/geoUtils';
import { validateCoordinates } from './geocodingService';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const OVERPASS_FALLBACK = 'https://overpass.kumi.systems/api/interpreter';

// --- Data Quality Assessment ---

export interface BuildingQualityMetrics {
  areaRealistic: boolean;
  geometryValid: boolean;
  dataFreshness: 'recent' | 'outdated' | 'unknown';
  coordinateQuality: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0-100
}

/**
 * Validates building footprint quality and assigns confidence score
 */
function assessBuildingQuality(
  coordinates: [number, number][],
  area: number,
  timestamp?: string
): BuildingQualityMetrics {
  let confidenceScore = 100;
  const issues: string[] = [];

  // 1. Area realism check (2 m² to 100,000 m²)
  const areaRealistic = area >= 2 && area <= 100000;
  if (!areaRealistic) {
    confidenceScore -= 30;
    issues.push(`Unrealistic building area: ${area.toFixed(1)} m²`);
  }

  // 2. Vertex count check (3-1000 vertices)
  const vertexCount = coordinates.length;
  if (vertexCount < 3) {
    confidenceScore -= 40;
    issues.push('Invalid polygon: less than 3 vertices');
  } else if (vertexCount > 1000) {
    confidenceScore -= 20;
    issues.push('Extremely complex polygon may indicate data quality issue');
  }

  // 3. Coordinate quality check
  let coordQualityScore = 0;
  let validCoords = 0;
  for (const [lng, lat] of coordinates) {
    const validation = validateCoordinates(lat, lng);
    if (validation.valid) {
      validCoords++;
      const precision = lng.toString().split('.')[1]?.length || 0;
      if (precision >= 6) coordQualityScore += 2; // ~10cm precision
      else if (precision >= 4) coordQualityScore += 1; // ~10m precision
    }
  }

  const coordQualityPct = validCoords / coordinates.length;
  const coordinateQuality: 'high' | 'medium' | 'low' = 
    coordQualityScore / coordinates.length >= 1.5 ? 'high' :
    coordQualityScore / coordinates.length >= 0.5 ? 'medium' : 'low';

  if (coordQualityPct < 1) {
    confidenceScore -= 50 * (1 - coordQualityPct);
    issues.push('Some coordinates failed validation');
  }

  if (coordinateQuality === 'low') {
    confidenceScore -= 15;
  }

  // 4. Data freshness (if timestamp available)
  let dataFreshness: 'recent' | 'outdated' | 'unknown' = 'unknown';
  if (timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    const ageYears = age / (365.25 * 24 * 60 * 60 * 1000);
    
    if (ageYears < 2) {
      dataFreshness = 'recent';
    } else if (ageYears >= 2) {
      dataFreshness = 'outdated';
      confidenceScore -= Math.min(20, ageYears * 5);
      issues.push(`OSM data is ${ageYears.toFixed(1)} years old`);
    }
  }

  // 5. Geometry validation
  const geometryValid = coordinates.length >= 3 && areaRealistic && coordQualityPct >= 0.8;

  if (issues.length > 0) {
    console.warn('Building quality issues:', issues);
  }

  return {
    areaRealistic,
    geometryValid,
    dataFreshness,
    coordinateQuality,
    confidenceScore: Math.max(0, Math.min(100, Math.round(confidenceScore))),
  };
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  center?: { lat: number; lon: number };
  timestamp?: string;
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

  // Calculate footprint area
  const area = calculatePolygonArea(coordinates);

  // Assess quality
  const quality = assessBuildingQuality(coordinates, area, el.timestamp);

  // Skip buildings with extremely low confidence
  if (quality.confidenceScore < 30) {
    console.warn(`Skipping low-quality building (confidence: ${quality.confidenceScore}%)`);
    return null;
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
      vertexCount: el.geometry.length,
      confidence: quality.confidenceScore,
      dataQuality: quality,
    },
    center,
  };
}

/**
 * Fetches building footprints with automatic fallback and retry logic
 */
export async function findNearbyBuildings(
  lat: number,
  lng: number,
  radiusMeters: number = 150 // Increased from 120m for better coverage
): Promise<BuildingFootprint[]> {
  // Validate input coordinates
  const validation = validateCoordinates(lat, lng);
  if (!validation.valid) {
    console.error('Invalid coordinates for building search:', validation.errors);
    return [];
  }

  const normalizedLat = validation.normalized!.lat;
  const normalizedLng = validation.normalized!.lng;

  // Overpass QL: find buildings within radius, include metadata
  // Prioritize larger buildings (likely main structures, not sheds)
  const query = `
    [out:json][timeout:15];
    (
      way["building"](around:${radiusMeters},${normalizedLat},${normalizedLng});
      relation["building"]["type"="multipolygon"](around:${radiusMeters},${normalizedLat},${normalizedLng});
    );
    out geom meta;
  `;

  const apis = [OVERPASS_API, OVERPASS_FALLBACK];
  let lastError: Error | null = null;

  // Try primary and fallback APIs
  for (let i = 0; i < apis.length; i++) {
    const apiUrl = apis[i];
    try {
      console.log(`Fetching buildings from ${i === 0 ? 'primary' : 'fallback'} Overpass API...`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        throw new Error(`Overpass API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const elements: OverpassElement[] = data.elements ?? [];

      console.log(`Found ${elements.length} building elements from OSM`);

      const buildings = elements
        .map(overpassElementToFootprint)
        .filter((f): f is BuildingFootprint => f !== null);

      // Enhanced sorting: prioritize buildings closest to click point with good confidence
      buildings.sort((a, b) => {
        // Calculate distance from search point (in degrees, rough approximation)
        const distA = Math.hypot(a.center.lat - normalizedLat, a.center.lng - normalizedLng);
        const distB = Math.hypot(b.center.lat - normalizedLat, b.center.lng - normalizedLng);
        
        const confA = a.properties.confidence ?? 50;
        const confB = b.properties.confidence ?? 50;
        
        const areaA = a.properties.area ?? 0;
        const areaB = b.properties.area ?? 0;
        
        // Composite score: distance (70%), confidence (20%), area (10%)
        // Prefer closest buildings with decent size and confidence
        const scoreA = (distA * 0.7) - (confA / 100 * 0.2) - (Math.log(areaA + 1) / 10 * 0.1);
        const scoreB = (distB * 0.7) - (confB / 100 * 0.2) - (Math.log(areaB + 1) / 10 * 0.1);
        
        return scoreA - scoreB; // Lower score = better match
      });

      // Filter out very small buildings (likely sheds/garages) if larger ones exist
      const hasLargeBuildings = buildings.some(b => (b.properties.area ?? 0) > 100);
      const filtered = hasLargeBuildings
        ? buildings.filter(b => (b.properties.area ?? 0) > 25) // Keep only buildings > 25m²
        : buildings; // Keep all if no large buildings found

      console.log(`Returning ${filtered.length} validated buildings (filtered from ${buildings.length})`);
      return filtered;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Overpass API attempt ${i + 1} failed:`, lastError.message);
      
      // Continue to next API if available
      if (i < apis.length - 1) {
        continue;
      }
    }
  }

  // All attempts failed
  console.error('All building footprint fetch attempts failed:', lastError);
  return [];
}

/**
 * Creates a valid BuildingFootprint object from user-drawn coordinates
 * Enhanced with validation and quality assessment
 * @param coordinates Array of [lng, lat] vertices (without needing final duplicate)
 */
export function createCustomFootprint(coordinates: [number, number][]): BuildingFootprint {
  if (coordinates.length < 3) {
    throw new Error('A polygon requires at least 3 points.');
  }

  // Validate all coordinates
  for (const [lng, lat] of coordinates) {
    const validation = validateCoordinates(lat, lng);
    if (!validation.valid) {
      throw new Error(`Invalid coordinate [${lng}, ${lat}]: ${validation.errors.join(', ')}`);
    }
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
  
  // Assess quality
  const quality = assessBuildingQuality(closedCoords, area);
  
  // Warn if quality is low
  if (quality.confidenceScore < 70) {
    console.warn('Custom footprint has quality issues:', quality);
  }

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
      confidence: quality.confidenceScore,
      dataQuality: quality,
    },
    center,
  };
}
