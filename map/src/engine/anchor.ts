import type { Position } from '../../../api/src/types';

/**
 * Anchors the Engine's local {x,y} grid onto real ground.
 *
 * A case is a local grid with no lat/lng (api/src/scenario/simulatedFireCases.ts), so
 * both where it sits and how big its cells are get decided here.
 *
 * The zoom is a parameter rather than a constant so a case is not tied to one scale,
 * but everything draws at z15 today: the reference grid (see simulatedFires.ts). A
 * square means the same ground wherever it is on this map.
 */

/** Side of a quadkey cell in metres, at a given latitude. Mercator, so latitude matters. */
export function cellSideM(z: number, latitude: number): number {
  return (40075016.686 * Math.cos((latitude * Math.PI) / 180)) / 2 ** z;
}

/**
 * Where a case's local grid sits on real ground.
 *
 * The backend cases (api/src/scenario/simulatedFireCases.ts) carry no geography at all
 * — they are a 20x15 local grid and a name. Putting each one where its name says it is
 * belongs here, on the map side, and these are the numbers to replace the day a case
 * ships with real coordinates.
 */
export interface Anchor2D {
  readonly latitude: number;
  readonly longitude: number;
}

function lngToTileX(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function latToTileY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  const merc = Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI;
  return Math.floor(((1 - merc) / 2) * 2 ** z);
}

function tileToQuadkey(x: number, y: number, z: number): string {
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

const tileToLng = (x: number, z: number) => (x / 2 ** z) * 360 - 180;

const tileToLat = (y: number, z: number) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

/**
 * The adapter for one scenario size. Built once per scenario, not per frame: the origin
 * tile is a fixed offset and every conversion after that is an addition.
 */
export function createAnchor(
  center: Anchor2D,
  mapWidth: number,
  mapHeight: number,
  z: number,
  focus?: Position,
) {
  /*
   * `center` names the point on real ground, and `focus` says WHICH local cell lands on
   * it — the fire's own cells when the caller knows them, the middle of the block
   * otherwise.
   *
   * It takes the fire and not just the block because a case's burning cells are rarely
   * at the block's centre, and the difference is kilometres: a 20-wide grid at z15 is
   * ~24 km across, so a fire drawn in the block's corner came out five or six kilometres
   * from the place the case is named after. That is how "Incendio urbano en Sant Andreu"
   * ended up burning on the Collserola hillside above Cerdanyola.
   *
   * Anchoring by TILE and not by float lat/lng keeps the block snapped to the lattice.
   */
  const originX = lngToTileX(center.longitude, z) - (focus?.x ?? Math.floor(mapWidth / 2));
  const originY = latToTileY(center.latitude, z) - (focus?.y ?? Math.floor(mapHeight / 2));

  const cellId = (position: Position): string =>
    tileToQuadkey(originX + position.x, originY + position.y, z);

  /** [[west, south], [east, north]] of the whole simulated block. */
  const bounds: [[number, number], [number, number]] = [
    [tileToLng(originX, z), tileToLat(originY + mapHeight, z)],
    [tileToLng(originX + mapWidth, z), tileToLat(originY, z)],
  ];

  /** Extent of an arbitrary subset of cells, for framing a fire. */
  function boundsOf(positions: readonly Position[]): [[number, number], [number, number]] {
    if (positions.length === 0) return bounds;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const { x, y } of positions) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return [
      [tileToLng(originX + minX, z), tileToLat(originY + maxY + 1, z)],
      [tileToLng(originX + maxX + 1, z), tileToLat(originY + minY, z)],
    ];
  }

  return { cellId, bounds, boundsOf };
}

export type Anchor = ReturnType<typeof createAnchor>;
