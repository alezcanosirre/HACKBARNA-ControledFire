/**
 * Status vocabulary for the live Deepfire feed.
 *
 * It lives here and not in src/map/colors.ts on purpose. That file speaks the Engine's
 * vocabulary — `NORMAL | BURNING`, straight from api/src/types/common.ts — and belongs
 * to the map session. The live feed is a different source with a different vocabulary:
 * a satellite perimeter that is burning now, and a spread projection that is at risk.
 * Forcing both through one enum would make each of them lie about the other.
 *
 * The colours are spec.md §4.7's `active` and `risk`, unchanged.
 */

export type LiveStatus = 'active' | 'risk';

export type RGBA = [number, number, number, number];

export const LIVE_FILL: Record<LiveStatus, RGBA> = {
  risk: [255, 176, 32, 120],
  active: [236, 56, 28, 205],
};

export const LIVE_STROKE: Record<LiveStatus, RGBA> = {
  risk: [255, 196, 92, 170],
  active: [255, 138, 92, 235],
};

/**
 * activeCellIds/riskCellIds already come computed from the backend — the intersection
 * of the real perimeter and the spread simulation with the H3 grid, see
 * api/src/live/liveFireState.ts. Here they are only merged into one status map.
 * 'active' wins over 'risk' if a cell is in both lists (it should not happen, the
 * backend already excludes them, but just in case).
 */
export function statusFromLiveCells(
  activeCellIds: readonly string[],
  riskCellIds: readonly string[],
): ReadonlyMap<string, LiveStatus> {
  const statuses = new Map<string, LiveStatus>();
  for (const id of riskCellIds) statuses.set(id, 'risk');
  for (const id of activeCellIds) statuses.set(id, 'active');
  return statuses;
}
