import { latLngToCell } from 'h3-js';
import { RES_PRED } from './constants';
import type { CellStatus } from './colors';
import type { LiveHotspot } from '../live/types';

/**
 * Un hotspot real "enciende" la celda res-6 que lo contiene. Es una
 * aproximación deliberadamente burda para el modo ACTUAL a esta resolución
 * (~36 km²/celda) — cuando se pase a pintar el halo de detalle (res 8,
 * `cellsAroundFire`) esto deja de hacer falta.
 */
export function statusFromHotspots(
  hotspots: readonly LiveHotspot[],
): ReadonlyMap<string, CellStatus> {
  const statuses = new Map<string, CellStatus>();
  for (const h of hotspots) {
    const cellId = latLngToCell(h.lat, h.lng, RES_PRED);
    // HIGH confidence pisa a MEDIUM/LOW si dos hotspots caen en la misma celda.
    if (h.confidence === 'HIGH' || !statuses.has(cellId)) {
      statuses.set(cellId, 'active');
    }
  }
  return statuses;
}
