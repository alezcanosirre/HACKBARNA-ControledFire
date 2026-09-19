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
