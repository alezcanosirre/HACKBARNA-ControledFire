import { cellToBoundary, cellToLatLng } from 'h3-js';

import { QUAD_Z } from '../map/constants';
import {
  latToTileY,
  lngToTileX,
  pointInPolygon,
  tileCenter,
  tileToQuadkey,
} from '../lib/quadkey';

/**
 * Deepfire speaks H3; this map is drawn on quadkey squares.
 *
 * The backend intersects the real satellite perimeter with an H3 res-8 grid
 * (api/src/live/h3FromGeometry.ts), so what arrives are hexagons. Painting them as
 * hexagons over a square lattice put two different grids on one screen, which reads as
 * a rendering bug rather than as two data sources. So they get rasterised onto our
 * grid here, at the edge, and the rest of the map only ever sees quadkeys.
 *
 * The two resolutions are close enough that this is nearly lossless: an H3 res-8 cell
 * is about 920 m across and a z15 quadkey is 916 m of side. Most hexagons land on one
 * square, a few straddle two.
 *
 * Method: a square belongs to the hexagon if the square's CENTRE falls inside it.
 * Not "if they overlap at all" — with cells this similar in size that would dilate a
 * four-cell fire into ten squares and overstate what is burning. And because a hexagon
 * this small can contain no square centre at all, one that matches nothing falls back
 * to the square holding its own centre, so a detection is never silently dropped.
 */
export function quadkeysForH3Cells(cellIds: readonly string[], z = QUAD_Z): string[] {
  const out = new Set<string>();

  for (const cellId of cellIds) {
    // cellToBoundary gives [lat, lng] pairs; everything here works in [lng, lat].
    const ring = cellToBoundary(cellId).map(([lat, lng]) => [lng, lat] as [number, number]);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [lng, lat] of ring) {
      const x = lngToTileX(lng, z);
      const y = latToTileY(lat, z);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    let matched = false;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointInPolygon(tileCenter(x, y, z), ring)) {
          out.add(tileToQuadkey(x, y, z));
          matched = true;
        }
      }
    }

    if (!matched) {
      const [lat, lng] = cellToLatLng(cellId);
      out.add(tileToQuadkey(lngToTileX(lng, z), latToTileY(lat, z), z));
    }
  }

  return [...out];
}
