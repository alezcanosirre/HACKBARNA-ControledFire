import { QUAD_Z } from '../map/constants';
import { cellToBoundary, cellToLatLng } from 'h3-js';
import { latToTileY, lngToTileX, pointInPolygon, tileCenter, tileToQuadkey } from '../lib/quadkey';
import type { LiveIgnitionRiskCell } from '../live/types';
import type { Prediction } from '../mocks/types';

/**
 * The backend's ignition risk, brought onto this map's grid.
 *
 * Same rasterisation as the live fire cells (live/h3ToQuadkey.ts): Deepfire and the
 * history speak H3, the map is drawn on quadkeys, and the conversion happens at the edge
 * so that from here on there is one grid on screen and not two. The difference is that
 * risk carries a NUMBER per cell, so it travels with it — a square takes the risk of the
 * hexagon it came from, and the highest one wins where two overlap.
 */

export interface RiskQuadkey {
  cell_id: string;
  risk: number;
  /** The H3 cell it came from, so the detail panel can find its drivers. */
  sourceId: string;
}

function quadkeysFor(cellId: string, z = QUAD_Z): string[] {
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

  const out: string[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInPolygon(tileCenter(x, y, z), ring)) out.push(tileToQuadkey(x, y, z));
    }
  }
  if (out.length === 0) {
    const [lat, lng] = cellToLatLng(cellId);
    out.push(tileToQuadkey(lngToTileX(lng, z), latToTileY(lat, z), z));
  }
  return out;
}

export interface LiveRisk {
  cells: RiskQuadkey[];
  predictionFor: (cellId: string | null) => Prediction | null;
}

/**
 * The card's "Analysis" says what this number IS, and it says it plainly: a heuristic
 * over measured history and current weather, not a validated forecast. Writing prose
 * here that sounded like a meteorologist would be dressing a formula up as expertise —
 * the drivers below it already show the method, which is the part worth defending.
 */
const RATIONALE =
  'Heuristic, not a validated forecast: measured ignition history for this cell, ' +
  'weighted by the worst conditions forecast over the window. The factors below are ' +
  'the inputs, with the weight each one carried.';

export function buildLiveRisk(source: readonly LiveIgnitionRiskCell[]): LiveRisk {
  const cells: RiskQuadkey[] = [];
  const byQuadkey = new Map<string, LiveIgnitionRiskCell>();
  const bestRisk = new Map<string, number>();

  for (const cell of source) {
    for (const quadkey of quadkeysFor(cell.cell_id)) {
      if ((bestRisk.get(quadkey) ?? -1) >= cell.risk) continue;
      bestRisk.set(quadkey, cell.risk);
      byQuadkey.set(quadkey, cell);
    }
  }

  for (const [cell_id, risk] of bestRisk) {
    cells.push({ cell_id, risk, sourceId: byQuadkey.get(cell_id)!.cell_id });
  }

  /*
   * Predictions are built once and handed out by reference. Shell keeps the open detail
   * mounted by comparing it with the previous one by identity, so a fresh object per
   * call reads as a new selection on every render — it spins React into
   * "Too many re-renders" the moment a cell is clicked.
   */
  const predictions = new Map<string, Prediction>();
  for (const [cell_id, cell] of byQuadkey) {
    predictions.set(cell_id, {
      cell_id,
      risk_score: bestRisk.get(cell_id)!,
      horizon_h: cell.horizonHours,
      drivers: cell.drivers.map((d) => ({ ...d })),
      rationale: RATIONALE,
      // The backend has no place names and no gazetteer. Coordinates are not the raw
      // cell id that UX §5 forbids, and they are at least something an operator can
      // find on the map. A real toponym is a backend job.
      place: `${cell.lat.toFixed(3)} N, ${cell.lng.toFixed(3)} E`,
    });
  }

  return {
    cells,
    predictionFor: (cellId) => (cellId ? (predictions.get(cellId) ?? null) : null),
  };
}
