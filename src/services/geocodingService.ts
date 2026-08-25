// ============================================
// Geocoding Service — Provider-Agnostic Abstraction
// ============================================

import type { GeocodingResult } from '@/types/index.js';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

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

function normalizeNominatimResult(raw: NominatimResult): GeocodingResult {
  const addr = raw.address ?? {};
  return {
    id: String(raw.place_id),
    displayName: raw.display_name,
    latitude: parseFloat(raw.lat),
    longitude: parseFloat(raw.lon),
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

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SolarRoofIntelligence/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding request failed: ${response.status}`);
  }

  const data: NominatimResult[] = await response.json();
  return data.map(normalizeNominatimResult);
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
  });

  if (!response.ok) return [];

  const data: NominatimResult[] = await response.json();
  return data.map(normalizeNominatimResult);
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  const url = new URL('/reverse', NOMINATIM_BASE);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SolarRoofIntelligence/1.0',
    },
  });

  if (!response.ok) return null;

  const data: NominatimResult = await response.json();
  if (!data.lat) return null;
  return normalizeNominatimResult(data);
}
