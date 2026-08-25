/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_ATTRIBUTION?: string;
  readonly VITE_SATELLITE_TILE_URL?: string;
  readonly VITE_SATELLITE_ATTRIBUTION?: string;
  readonly VITE_GEOCODING_PROVIDER?: string;
  readonly VITE_DEFAULT_LAT?: string;
  readonly VITE_DEFAULT_LNG?: string;
  readonly VITE_DEFAULT_ZOOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
