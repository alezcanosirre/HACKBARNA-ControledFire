// DESVIACIÓN respecto a PLAN-MAPA.md y spec.md §4.2, que describen H3 sobre Cataluña:
//  - el área de trabajo es la Regió Metropolitana de Barcelona, no Cataluña;
//  - la rejilla es de CUADRADOS (quadkey de Web Mercator), no de hexágonos H3.
// Un quadkey es cuadrado en la proyección, así que se ve cuadrado en pantalla; las
// celdas S2 son cuadradas sobre la esfera y a 41,5° de latitud salen deformadas.

// Nivel de zoom del quadkey. z15 a esta latitud → celdas de ~916 m de lado, ~0,84 km².
// Es el grano más parecido al que había con H3 res 8 (~0,71 km²).
export const QUAD_Z = 15;

export const FIRE_HALO_K = 3;   // halo alrededor de un fuego → (2k+1)² = 49 celdas

// bbox de la Regió Metropolitana de Barcelona [oeste, sur, este, norte].
// Cubre los 164 municipios de la RMB más Collserola, Garraf, Montseny y Montnegre.
// A quadkey z15 → 96 x 86 = 8256 celdas.
export const BBOX_RMB: [number, number, number, number] = [1.55, 41.15, 2.6, 41.85];

// bbox de Cataluña [oeste, sur, este, norte]. Definido en spec.md §4.3; hoy no se usa,
// el mapa está acotado a la RMB.
export const BBOX_CATALUNYA: [number, number, number, number] = [0.15, 40.52, 3.33, 42.86];

export const BCN_CENTER = { longitude: 2.1686, latitude: 41.3874 };

// Límites de cámara. Ver clampToArea() en view.ts.
// deck.gl usa un mundo de 512 px por nivel: el bbox de la RMB cabe entero en pantalla
// a z ≈ 9.14 (limitado por el alto). MIN_ZOOM = 9 deja ver toda el área de trabajo con
// un margen pequeño; por debajo solo se añadiría terreno de fuera.
export const MIN_ZOOM = 9;
export const MAX_ZOOM = 16;

export const VIEW_RMB = {
  longitude: 2.075,   // centro del bbox
  latitude: 41.5,
  zoom: 10,
  pitch: 0,
  bearing: 0,
};

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
