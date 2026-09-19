// Resoluciones H3. Ver spec.md §4.2
export const RES_PRED = 6;      // ~36 km²/celda — riesgo, toda Cataluña
export const RES_ACTIVE = 8;    // ~0,74 km²/celda — detalle del incendio
export const FIRE_HALO_K = 3;   // gridDisk alrededor de un fuego → 37 celdas

// bbox de Cataluña [oeste, sur, este, norte]
export const BBOX_CATALUNYA: [number, number, number, number] = [0.15, 40.52, 3.33, 42.86];

export const BCN_CENTER = { longitude: 2.1686, latitude: 41.3874 };

export const VIEW_CATALUNYA = {
  longitude: 1.74,
  latitude: 41.72,
  zoom: 7.4,
  pitch: 0,
  bearing: 0,
};

export const VIEW_BCN = { ...BCN_CENTER, zoom: 9.2, pitch: 0, bearing: 0 };

// CARTO, sin API key. Ver spec.md §4.5
export const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
