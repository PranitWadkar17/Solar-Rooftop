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

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

interface GeoapifyFeature {
  type: 'Feature';
  properties: {
    place_id?: string;
    formatted?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    suburb?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
    lat: number;
    lon: number;
    result_type?: string;
    address_line1?: string;
    address_line2?: string;
    bbox?: [number, number, number, number];
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  bbox?: [number, number, number, number];
}

interface GeoapifyResponse {
  type: 'FeatureCollection';
  features: GeoapifyFeature[];
}

function normalizeGeoapifyResult(feature: GeoapifyFeature): GeocodingResult | null {
  const p = feature.properties;
  if (!p) return null;

  const lat = p.lat ?? feature.geometry?.coordinates?.[1];
  const lng = p.lon ?? feature.geometry?.coordinates?.[0];

  const validation = validateCoordinates(lat, lng);
  if (!validation.valid) return null;

  // GeoJSON bbox is [minLon, minLat, maxLon, maxLat] = [west, south, east, north]
  // GeocodingResult boundingBox format is [south, north, west, east]
  const bbox = p.bbox || feature.bbox;
  let boundingBox: [number, number, number, number] | null = null;
  if (bbox && bbox.length === 4) {
    const [west, south, east, north] = bbox;
    boundingBox = [south, north, west, east];
  }

  const name = p.housenumber && p.street
    ? `${p.housenumber} ${p.street}`
    : p.name || p.street || p.suburb || p.address_line1;

  return {
    id: p.place_id || `geoapify-${lat}-${lng}-${Math.random().toString(36).substring(2, 7)}`,
    displayName: p.formatted || [p.address_line1, p.address_line2].filter(Boolean).join(', ') || p.name || '',
    latitude: validation.normalized!.lat,
    longitude: validation.normalized!.lng,
    boundingBox,
    addressParts: {
      name,
      locality: p.suburb || p.district,
      city: p.city,
      state: p.state,
      country: p.country,
      postcode: p.postcode,
    },
    type: p.result_type,
  };
}

async function searchWithGeoapify(query: string, limit: number = 8): Promise<GeocodingResult[]> {
  const url = new URL('/v1/geocode/search', 'https://api.geoapify.com');
  url.searchParams.set('text', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('apiKey', GEOAPIFY_API_KEY);

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Geoapify request failed: ${response.status} ${response.statusText}`);
  }

  const data: GeoapifyResponse = await response.json();
  return (data.features || [])
    .map(normalizeGeoapifyResult)
    .filter((r): r is GeocodingResult => r !== null);
}

async function autocompleteWithGeoapify(query: string, limit: number = 5): Promise<GeocodingResult[]> {
  const url = new URL('/v1/geocode/autocomplete', 'https://api.geoapify.com');
  url.searchParams.set('text', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('apiKey', GEOAPIFY_API_KEY);

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return [];

  const data: GeoapifyResponse = await response.json();
  return (data.features || [])
    .map(normalizeGeoapifyResult)
    .filter((r): r is GeocodingResult => r !== null);
}

async function reverseGeocodeWithGeoapify(lat: number, lng: number): Promise<GeocodingResult | null> {
  const url = new URL('/v1/geocode/reverse', 'https://api.geoapify.com');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('apiKey', GEOAPIFY_API_KEY);

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return null;

  const data: GeoapifyResponse = await response.json();
  if (!data.features || data.features.length === 0) return null;
  return normalizeGeoapifyResult(data.features[0]);
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

  const provider = import.meta.env.VITE_GEOCODING_PROVIDER ?? (GEOAPIFY_API_KEY ? 'geoapify' : 'nominatim');

  if (provider === 'geoapify' || GEOAPIFY_API_KEY) {
    try {
      const geoapifyResults = await searchWithGeoapify(trimmed, 8);
      if (geoapifyResults.length > 0) {
        return geoapifyResults;
      }
    } catch (err) {
      console.warn('Geoapify search failed, falling back to Nominatim:', err);
    }
  }

  // Fallback to Nominatim if Geoapify returns no results or fails
  return searchWithNominatim(trimmed, 8);
}

/**
 * Autocomplete suggestions — triggered while typing.
 * Uses smaller limit for fast response.
 */
export async function autocompleteSuggestions(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return []; // Need at least 3 chars for meaningful results

  const provider = import.meta.env.VITE_GEOCODING_PROVIDER ?? (GEOAPIFY_API_KEY ? 'geoapify' : 'nominatim');

  if (provider === 'geoapify' || GEOAPIFY_API_KEY) {
    try {
      const geoapifySuggestions = await autocompleteWithGeoapify(trimmed, 5);
      if (geoapifySuggestions.length > 0) {
        return geoapifySuggestions;
      }
    } catch {
      // Fall through to Nominatim autocomplete
    }
  }

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

  const provider = import.meta.env.VITE_GEOCODING_PROVIDER ?? (GEOAPIFY_API_KEY ? 'geoapify' : 'nominatim');

  if (provider === 'geoapify' || GEOAPIFY_API_KEY) {
    try {
      const geoResult = await reverseGeocodeWithGeoapify(
        validation.normalized!.lat,
        validation.normalized!.lng
      );
      if (geoResult) return geoResult;
    } catch {
      // Fall through to Nominatim
    }
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

