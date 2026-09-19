import type { Position } from '../../../api/src/types';

/**
 * Anchors the Engine's local {x,y} grid onto real ground.
 *
 * `api/spec.md` lists this as the open integration point: a Scenario's Position is a
 * local grid with no lat/lng, and the Engine's `CELL_AREA_HA = 1` means one of its
 * cells is one hectare — 100 m of side. Our reference grid is quadkey z15, ~916 m.
 * Making the Engine coarser would mean rebalancing its scenario, which is tuned at
 * that scale, so the map is the side that adapts: the simulation is painted on
 * quadkey z18 (~115 m at this latitude), the closest level to a hectare.
 *
 * z18 nests exactly inside z15 — 8x8 — so the simulation block lands flush on the
 * reference lattice instead of floating at an angle over it.
 *
 * KNOWN DISCREPANCY: a z18 cell here is 1.31 ha, not 1.00. Which is why the hectares
 * on screen come from `state.fire.burnedAreaHa`, the Engine's own count, and are never
 * derived from cell size. When `api/` makes cell size a Scenario field, this closes.
 */

export const SIM_Z = 18;

/**
 * Where the local (0,0) sits. This one constant moves the whole simulation, and it is
 * the number to replace the moment the backend gives a real one — the scenario says
 * outright that its Collserola is stylised, not GPS.
 *
 * Chosen as the centre of the 20x15 block: the Collserola ridge, between Sant Cugat to
 * the north and Vallvidrera to the south, which is the layout the scenario describes.
 */
export const SIM_CENTER = { latitude: 41.43, longitude: 2.09 };

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
export function createAnchor(mapWidth: number, mapHeight: number) {
  // The centre constant names the middle of the block, so the origin is half a map
  // north-west of it. Anchoring by TILE and not by float lat/lng keeps the block
  // snapped to the lattice.
  const originX = lngToTileX(SIM_CENTER.longitude, SIM_Z) - Math.floor(mapWidth / 2);
  const originY = latToTileY(SIM_CENTER.latitude, SIM_Z) - Math.floor(mapHeight / 2);

  const cellId = (position: Position): string =>
    tileToQuadkey(originX + position.x, originY + position.y, SIM_Z);

  /** [[west, south], [east, north]] of the whole simulated block. */
  const bounds: [[number, number], [number, number]] = [
    [tileToLng(originX, SIM_Z), tileToLat(originY + mapHeight, SIM_Z)],
    [tileToLng(originX + mapWidth, SIM_Z), tileToLat(originY, SIM_Z)],
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
      [tileToLng(originX + minX, SIM_Z), tileToLat(originY + maxY + 1, SIM_Z)],
      [tileToLng(originX + maxX + 1, SIM_Z), tileToLat(originY + minY, SIM_Z)],
    ];
  }

  return { cellId, bounds, boundsOf };
}

export type Anchor = ReturnType<typeof createAnchor>;
