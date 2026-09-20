/**
 * Web Mercator tile maths, shared by everything that has to land some other grid on
 * ours. A quadkey is the identifier of a tile: a base-4 string of length z where each
 * digit picks a quadrant (see src/map/grid.ts for the long version).
 */

export function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  const merc = Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI;
  return Math.floor(((1 - merc) / 2) * 2 ** z);
}

export function tileToQuadkey(x: number, y: number, z: number): string {
  let key = '';
  for (let i = z; i > 0; i--) {
    const mask = 1 << (i - 1);
    let digit = 0;
    if (x & mask) digit += 1;
    if (y & mask) digit += 2;
    key += digit;
  }
  return key;
}

export const tileToLng = (x: number, z: number) => (x / 2 ** z) * 360 - 180;

export const tileToLat = (y: number, z: number) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

/** Centre of a tile, in [lng, lat]. */
export function tileCenter(x: number, y: number, z: number): [number, number] {
  return [tileToLng(x + 0.5, z), tileToLat(y + 0.5, z)];
}

/** The inverse of `tileToQuadkey`: reads the digits back into (x, y). */
export function quadkeyToTile(quadkey: string): [number, number] {
  let x = 0;
  let y = 0;
  for (let i = 0; i < quadkey.length; i++) {
    const mask = 1 << (quadkey.length - i - 1);
    const digit = quadkey.charCodeAt(i) - 48; // '0'.charCodeAt(0)
    if (digit & 1) x |= mask;
    if (digit & 2) y |= mask;
  }
  return [x, y];
}

/**
 * The bounding box of a single quadkey tile, in the [[west, south], [east, north]] shape
 * `focusOn` (src/map/view.ts) expects — the quadkey sibling of `boundsForH3Cells`
 * (live/h3Bounds.ts). A PRED selection is a quadkey (see pred/livePredictions.ts), not
 * an H3 cell, so it cannot go through that one: `cellToBoundary` on a quadkey string is
 * not an error h3-js catches, it just returns nonsense degenerate coordinates, which is
 * what sent the camera all the way out to a Catalonia-wide fit instead of framing the
 * cell.
 */
export function boundsForQuadkey(quadkey: string): [[number, number], [number, number]] {
  const z = quadkey.length;
  const [x, y] = quadkeyToTile(quadkey);
  return [
    [tileToLng(x, z), tileToLat(y + 1, z)],
    [tileToLng(x + 1, z), tileToLat(y, z)],
  ];
}

/** Ray casting. `polygon` is a closed or open ring of [lng, lat]. */
export function pointInPolygon(
  [x, y]: readonly [number, number],
  polygon: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
