import type { CellStatus } from './colors';

/**
 * activeCellIds/riskCellIds ya vienen calculadas por el backend
 * (intersección del perímetro real / la simulación de propagación con el
 * grid H3, ver api/src/live/liveFireState.ts) — aquí solo se combinan en
 * un único mapa de estado. 'active' pisa a 'risk' si una celda cae en las
 * dos listas (no debería pasar, el backend ya las excluye, pero por si acaso).
 */
export function statusFromLiveCells(
  activeCellIds: readonly string[],
  riskCellIds: readonly string[],
): ReadonlyMap<string, CellStatus> {
  const statuses = new Map<string, CellStatus>();
  for (const id of riskCellIds) statuses.set(id, 'risk');
  for (const id of activeCellIds) statuses.set(id, 'active');
  return statuses;
}
