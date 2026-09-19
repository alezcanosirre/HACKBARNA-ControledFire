import type { Action, CellState, Position, SimulationState } from "../../types";
import { propagateTick } from "../fire/propagateTick";

const MINUTES_PER_CELL = 5; // multiple of TICK_MINUTES, so it always lines up with whole ticks
const TICK_MINUTES = 5;

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

/**
 * Builds a containment line: takes MINUTES_PER_CELL * target.length minutes,
 * during which the fire keeps spreading elsewhere (propagateTick runs for
 * that duration BEFORE the line goes up, not after). Only cells that are
 * still NORMAL once construction finishes become PROTECTED — if the fire
 * reaches part of the line before the crew gets there, that stretch fails;
 * it's not retroactively immune. An empty target, or one where every
 * position is outside the grid, is invalid and dropped, same as other
 * malformed actions.
 */
export function createFirebreak(
  state: SimulationState,
  action: Extract<Action, { type: "CREATE_FIREBREAK" }>,
): SimulationState | null {
  if (action.target.length === 0) return null;

  const cellByKey = new Map(state.cells.map((cell) => [positionKey(cell.position), cell]));
  const targetKeys = action.target.map(positionKey).filter((key) => cellByKey.has(key));
  if (targetKeys.length === 0) return null;

  const minutes = action.target.length * MINUTES_PER_CELL;
  const ticks = Math.floor(minutes / TICK_MINUTES);

  let current = state;
  for (let i = 0; i < ticks; i++) {
    current = propagateTick(current);
  }

  const targetKeySet = new Set(targetKeys);
  let protectedCount = 0;
  const cells: CellState[] = current.cells.map((cell) => {
    if (!targetKeySet.has(positionKey(cell.position)) || cell.status !== "NORMAL") return cell;
    protectedCount++;
    return { ...cell, status: "PROTECTED" };
  });

  const time = current.time.current + minutes;
  const lost = targetKeys.length - protectedCount;

  return {
    ...current,
    cells,
    time: { current: time },
    mission: { ...current.mission, elapsedMinutes: time },
    events: [
      ...current.events,
      {
        time,
        message:
          lost > 0
            ? `Línea de contención: ${protectedCount} celdas protegidas, ${lost} alcanzadas por el fuego antes de terminar.`
            : `Línea de contención creada: ${protectedCount} celdas protegidas.`,
      },
    ],
  };
}
