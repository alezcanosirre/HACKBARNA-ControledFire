import { polygonToCells } from "h3-js";
import type { MultiPolygonGeometry } from "./geometry";

/**
 * Todas las celdas H3 en resolución `res` que intersectan un MultiPolygon
 * GeoJSON — así de directo se pasa de "el perímetro real del incendio" a
 * "qué celdas del grid están ardiendo", sin comparar geometrías a mano.
 */
export function cellsForMultiPolygon(mp: MultiPolygonGeometry, res: number): Set<string> {
  const cells = new Set<string>();
  for (const polygon of mp.coordinates) {
    // polygonToCells espera number[][][] (anillos de [lng,lat]); nuestros
    // tipos son readonly, hay que copiarlos.
    const rings = polygon.map((ring) => ring.map(([lng, lat]) => [lng, lat]));
    for (const cellId of polygonToCells(rings, res, true)) {
      cells.add(cellId);
    }
  }
  return cells;
}
