import { polygonToCells, latLngToCell, gridDisk } from 'h3-js';
import { BBOX_CATALUNYA, RES_PRED, RES_ACTIVE, FIRE_HALO_K } from './constants';

/** Lo mínimo que necesita la capa para pintar una celda. */
export interface Cell {
  cell_id: string;
}

/**
 * h3-js v4: polygonToCells(coords, res, isGeoJson).
 * Con isGeoJson = true los pares son [lng, lat]. Con false son [lat, lng].
 * Invertirlos es EL error clásico de H3: no da error, simplemente te devuelve
 * celdas en China. Si la rejilla no aparece sobre Cataluña, mira esto primero.
 */
export function cellsInBbox(
  bbox: [number, number, number, number],
  res: number,
): string[] {
  const [w, s, e, n] = bbox;
  const ring: number[][] = [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ];
  return polygonToCells([ring], res, true);
}

/** Halo de celdas de detalle alrededor de un incendio. k=3 → 37 celdas. */
export function cellsAroundFire(lat: number, lng: number, k = FIRE_HALO_K): string[] {
  return gridDisk(latLngToCell(lat, lng, RES_ACTIVE), k);
}

/**
 * Se calcula UNA VEZ, al cargar el módulo. No en un render, no en un useMemo
 * dentro de un componente que se remonta. 1966 celdas es barato pero no gratis,
 * y recalcularlo en cada movimiento del mapa lo convierte en una presentación
 * de diapositivas.
 */
export const PRED_CELLS: Cell[] = cellsInBbox(BBOX_CATALUNYA, RES_PRED).map(
  (cell_id) => ({ cell_id }),
);
