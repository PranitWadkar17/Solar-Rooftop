// ============================================
// Satellite Layer Service — Configurable Imagery Source
// ============================================

export interface TileLayerConfig {
  url: string;
  attribution: string;
  available: boolean;
  maxZoom: number;
  maxNativeZoom?: number;
}

export function getStreetTileConfig(): TileLayerConfig {
  return {
    url: import.meta.env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      import.meta.env.VITE_MAP_ATTRIBUTION ??
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    available: true,
    maxZoom: 22,
    maxNativeZoom: 19,
  };
}

export function getSatelliteTileConfig(): TileLayerConfig {
  const url = import.meta.env.VITE_SATELLITE_TILE_URL;
  const attribution =
    import.meta.env.VITE_SATELLITE_ATTRIBUTION ??
    'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

  if (!url) {
    return {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution,
      available: true,
      maxZoom: 22,
      maxNativeZoom: 19,
    };
  }

  return {
    url,
    attribution,
    available: true,
    maxZoom: 22,
    maxNativeZoom: 19,
  };
}

export function getDefaultMapCenter(): { lat: number; lng: number; zoom: number } {
  return {
    lat: parseFloat(import.meta.env.VITE_DEFAULT_LAT ?? '20'),
    lng: parseFloat(import.meta.env.VITE_DEFAULT_LNG ?? '0'),
    zoom: parseInt(import.meta.env.VITE_DEFAULT_ZOOM ?? '2', 10),
  };
}
