import { gridDisk } from 'h3-js';

import type { LiveHotspot } from './types';

/** Matches api/src/live/constants.ts RES_ACTIVE — the resolution the backend rasterises
 * perimeters/hotspots to before this file ever sees them. */
export const LIVE_H3_RES = 8;

/**
 * The backend still answers with a flat `activeCellIds` list, not one entry per
 * incident (that grouping lives in a teammate's branch, not merged yet). Until it is,
 * clicking a fire needs SOME id to select — so this groups active H3 cells into
 * connected components by adjacency, the same idea as src/map/grid.ts but for the live
 * H3 res-8 grid instead of the mock's quadkeys.
 *
 * This is a stopgap: it has no cluster_id, no real name, no satellite-perimeter area.
 * Once the backend exposes `fires[]` (spec'd in api/src/live/liveFireState.ts's
 * discarded LiveFireSummary), this file goes away and the id becomes the real
 * cluster_id.
 */
export interface LiveFireGroup {
  readonly id: string; // stable within a session: the group's first (sorted) cell id
  readonly cellIds: readonly string[];
}

export function groupActiveFires(activeCellIds: readonly string[]): LiveFireGroup[] {
  const remaining = new Set(activeCellIds);
  const groups: LiveFireGroup[] = [];

  for (const start of activeCellIds) {
    if (!remaining.has(start)) continue;
    const group: string[] = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length > 0) {
      const cell = queue.pop()!;
      group.push(cell);
      for (const neighbor of gridDisk(cell, 1)) {
        if (remaining.has(neighbor)) {
          remaining.delete(neighbor);
          queue.push(neighbor);
        }
      }
    }
    groups.push({ id: [...group].sort()[0], cellIds: group });
  }
  return groups;
}

/** What the info card can show without inventing anything: the group's own hotspots. */
export interface LiveFireDetail extends LiveFireGroup {
  readonly detectedAt: string | null; // most recent observedAt in the group, if any
  readonly source: string | null;
  readonly confidence: LiveHotspot['confidence'] | null;
  readonly fireRadiativePowerMw: number | null;
}

/**
 * Matches hotspots to a group by H3 cell, not by proximity — a hotspot belongs to a
 * fire if its own res-8 cell is one of the fire's cells, same resolution the backend
 * rasterises perimeters to (api/src/live/constants.ts RES_ACTIVE).
 */
export function withHotspotDetail(
  groups: readonly LiveFireGroup[],
  hotspots: readonly LiveHotspot[],
  cellOf: (h: LiveHotspot) => string,
): LiveFireDetail[] {
  return groups.map((group) => {
    const cells = new Set(group.cellIds);
    const own = hotspots.filter((h) => cells.has(cellOf(h)));
    const latest = own.reduce<LiveHotspot | null>(
      (best, h) => (!best || h.observedAt > best.observedAt ? h : best),
      null,
    );
    return {
      ...group,
      detectedAt: latest?.observedAt ?? null,
      source: latest?.source ?? null,
      confidence: latest?.confidence ?? null,
      fireRadiativePowerMw: latest?.fireRadiativePowerMw ?? null,
    };
  });
}
