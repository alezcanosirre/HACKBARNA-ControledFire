// Ver spec.md §4.7 — los cálidos son SOLO para fuego. Ningún botón ni
// cabecera de la interfaz usa esta gama.
export type CellStatus = 'normal' | 'watch' | 'risk' | 'active' | 'contained';

export type RGBA = [number, number, number, number];

export const STATUS_FILL: Record<CellStatus, RGBA> = {
  normal: [0, 0, 0, 0], // invisible
  watch: [96, 165, 250, 55], // azul frío: vigilado, sin amenaza
  risk: [255, 176, 32, 120],
  active: [236, 56, 28, 205],
  contained: [122, 122, 138, 90], // gris: controlado, ya no es urgente
};

export const STATUS_STROKE: Record<CellStatus, RGBA> = {
  normal: [148, 163, 184, 45],
  watch: [147, 197, 253, 110],
  risk: [255, 196, 92, 170],
  active: [255, 138, 92, 235],
  contained: [160, 160, 175, 130],
};
