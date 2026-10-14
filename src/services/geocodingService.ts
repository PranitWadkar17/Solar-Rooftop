// ============================================
// Geocoding Service — Provider-Agnostic Abstraction
// Enhanced with coordinate validation and CRS verification
// ============================================

import type { GeocodingResult } from '@/types/index.js';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// --- Coordinate Validation ---

export interface CoordinateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized: { lat: number; lng: number } | null;
}

/**
 * Validates and normalizes geographic coordinates (WGS84)
 * @param lat Latitude in degrees
 * @param lng Longitude in degrees
 */
export function validateCoordinates(lat: number, lng: number): CoordinateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Type validation
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    errors.push('Coordinates must be finite numbers');
    return { valid: false, errors, warnings, normalized: null };
  }

  // Bounds validation (WGS84 valid range)
  if (lat < -90 || lat > 90) {
    errors.push(`Latitude ${lat} is outside valid range [-90, 90]`);
  }

  if (lng < -180 || lng > 180) {
    errors.push(`Longitude ${lng} is outside valid range [-180, 180]`);
  }

  // Precision warnings (suspiciously low precision might indicate data quality issues)
  const latPrecision = lat.toString().split('.')[1]?.length || 0;
  const lngPrecision = lng.toString().split('.')[1]?.length || 0;

  if (latPrecision < 4 || lngPrecision < 4) {
    warnings.push('Low coordinate precision detected (less than ~10m accuracy)');
  }

  // Null Island check (0,0 is often a data error)
  if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) {
    warnings.push('Coordinates near (0,0) - "Null Island" - verify this is intentional');
  }

  // Ocean check approximation (most solar installations are on land)
  const isLikelyOcean = (
    (Math.abs(lat) < 60 && (lng < -160 || lng > 160)) || // Pacific
    (lat > 50 && lat < 80 && lng > -40 && lng < 40) // North Atlantic/Arctic
  );
  
  if (isLikelyOcean) {
    warnings.push('Coordinates appear to be over open ocean - verify location');
  }

  const valid = errors.length === 0;
  const normalized = valid ? { 
    lat: Math.round(lat * 1e8) / 1e8, // 8 decimal places = ~1.1mm precision
    lng: Math.round(lng * 1e8) / 1e8 
  } : null;

  return { valid, errors, warnings, normalized };
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
  type: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
    county?: string;
    house_number?: string;
    neighbourhood?: string;
  };
}

function normalizeNominatimResult(raw: NominatimResult): GeocodingResult | null {
  const addr = raw.address ?? {};
  const lat = parseFloat(raw.lat);
  const lng = parseFloat(raw.lon);

  // Validate coordinates before returning
  const validation = validateCoordinates(lat, lng);
  if (!validation.valid) {
    console.warn('Invalid coordinates in geocoding result:', validation.errors);
    return null;
  }

  // Log warnings for data quality issues
  if (validation.warnings.length > 0) {
    console.warn('Geocoding quality warnings:', validation.warnings);
  }

  return {
    id: String(raw.place_id),
    displayName: raw.display_name,
    latitude: validation.normalized!.lat,
    longitude: validation.normalized!.lng,
    boundingBox: raw.boundingbox
      ? [
          parseFloat(raw.boundingbox[0]),
          parseFloat(raw.boundingbox[1]),
          parseFloat(raw.boundingbox[2]),
          parseFloat(raw.boundingbox[3]),
        ]
      : null,
    addressParts: {
      name: addr.house_number
        ? `${addr.house_number} ${addr.road ?? ''}`.trim()
        : addr.road ?? addr.suburb ?? addr.neighbourhood,
      locality: addr.suburb ?? addr.neighbourhood ?? addr.county,
      city: addr.city ?? addr.town ?? addr.village,
      state: addr.state,
      country: addr.country,
      postcode: addr.postcode,
    },
    type: raw.type,
  };
}

async function searchWithNominatim(query: string, limit: number = 8): Promise<GeocodingResult[]> {
  const url = new URL('/search', NOMINATIM_BASE);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('dedupe', '1');
  // Accept all types to improve search coverage
  url.searchParams.set('polygon_geojson', '0');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SolarRoofIntelligence/1.0',
      },
      signal: AbortSignal.timeout(8000), // 8 second timeout
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status} ${response.statusText}`);
    }

    const data: NominatimResult[] = await response.json();
    
    // Filter and normalize results, removing any with invalid coordinates
    return data
      .map(normalizeNominatimResult)
      .filter((r): r is GeocodingResult => r !== null);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error('Geocoding request timed out. Please check your internet connection.');
      }
      throw new Error(`Geocoding service error: ${error.message}`);
    }
    throw error;
  }
}

// --- Public API ---

/**
 * Full search — triggered by pressing Enter or clicking Search.
 * Uses higher limit for completeness.
 */
export async function searchLocation(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const provider = import.meta.env.VITE_GEOCODING_PROVIDER ?? 'nominatim';

  switch (provider) {
    case 'nominatim':
    default:
      return searchWithNominatim(trimmed, 8);
  }
}

/**
 * Autocomplete suggestions — triggered while typing.
 * Uses smaller limit for fast response.
 */
export async function autocompleteSuggestions(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return []; // Need at least 3 chars for meaningful results

  try {
    const url = new URL('/search', NOMINATIM_BASE);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('dedupe', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SolarRoofIntelligence/1.0',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];

    const data: NominatimResult[] = await response.json();
    return data
      .map(normalizeNominatimResult)
      .filter((r): r is GeocodingResult => r !== null);
  } catch {
    return []; // Silently fail for autocomplete
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  // Validate coordinates first
  const validation = validateCoordinates(lat, lng);
  if (!validation.valid) {
    console.error('Invalid coordinates for reverse geocoding:', validation.errors);
    return null;
  }

  if (validation.warnings.length > 0) {
    console.warn('Reverse geocode coordinate warnings:', validation.warnings);
  }

  try {
    const url = new URL('/reverse', NOMINATIM_BASE);
    url.searchParams.set('lat', String(validation.normalized!.lat));
    url.searchParams.set('lon', String(validation.normalized!.lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18'); // Building-level detail

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SolarRoofIntelligence/1.0',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data: NominatimResult = await response.json();
    if (!data.lat) return null;
    return normalizeNominatimResult(data);
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return null;
  }
}
