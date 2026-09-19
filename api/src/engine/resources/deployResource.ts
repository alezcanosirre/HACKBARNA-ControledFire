import type { Action, CellState, SimulationState } from "../../types";
import { propagateTick } from "../fire/propagateTick";
import { recoverResources } from "./recoverResources";

const TICK_MINUTES = 5;
const RECOVERY_MINUTES = 10; // time to reset/refuel/regroup once the intervention is done

function positionKey(position: { x: number; y: number }): string {
  return `${position.x},${position.y}`;
}

function reconSummary(state: SimulationState): string {
  const active = state.fire.activeCells;
  const avgIntensity =
    active.length === 0 ? 0 : active.reduce((sum, c) => sum + c.intensity, 0) / active.length;
  return `Dron: ${active.length} celdas activas, intensidad media ${avgIntensity.toFixed(2)}, ${state.fire.burnedAreaHa}ha quemadas.`;
}

/**
 * Applies a DEPLOY_RESOURCE action, or returns null if it's invalid
 * (unknown resourceId, resource not AVAILABLE, or target outside the grid)
 * so the caller can drop it silently, same as an invalid WAIT.
 *
 * Deploying always costs the resource: it moves to `target` and goes BUSY
 * immediately, for arrivalMinutes + RECOVERY_MINUTES — even if the target
 * isn't currently burning, sending a crew somewhere still takes time. Fire
 * keeps propagating during arrivalMinutes (same tick mechanism as WAIT/
 * CREATE_FIREBREAK), and the resource's effect is applied using the state
 * AS IT EXISTS ON ARRIVAL, not as it was at dispatch — a slow resource can
 * arrive to find its target already burned out or extinguished by someone
 * else, same "race against the fire" as a firebreak under construction.
 *
 * The effect itself depends on the resource's type (switch, not a lookup
 * table: `resource.type satisfies never` in the default case means a
 * future ResourceType addition fails to compile here until it's handled):
 * - BRIGADE/HELICOPTER/TRUCK: firefighting — reduces the target cell's
 *   intensity by effectiveness if it's still BURNING on arrival; hitting 0
 *   marks it PROTECTED.
 * - POLICE: evacuation — marks the target cell `evacuated`, dropping its
 *   populationRisk to 0 regardless of fireRisk. No effect on the fire
 *   itself, and not gated on the cell's status — evacuating ahead of the
 *   fire is the point.
 * - DRONE: reconnaissance — no state change at all, just a richer
 *   SimulationEvent summarizing current fire stats. There's no hidden-
 *   information model in this Engine (the UI/AI always sees the full
 *   state), so there's nothing to actually "reveal" — this is a narrative
 *   convenience, not a new visibility mechanic.
 */
export function deployResource(
  state: SimulationState,
  action: Extract<Action, { type: "DEPLOY_RESOURCE" }>,
): SimulationState | null {
  const resource = state.resources.find((r) => r.id === action.resourceId);
  if (!resource || resource.status !== "AVAILABLE") return null;

  const targetKey = positionKey(action.target);
  if (!state.cells.some((cell) => positionKey(cell.position) === targetKey)) return null;

  const dispatchTime = state.time.current;
  const busyUntil = dispatchTime + resource.arrivalMinutes + RECOVERY_MINUTES;

  let current: SimulationState = {
    ...state,
    resources: state.resources.map((r) =>
      r.id === resource.id
        ? { ...r, position: action.target, status: "BUSY", busyUntil }
        : r,
    ),
  };

  const ticks = Math.floor(resource.arrivalMinutes / TICK_MINUTES);
  for (let i = 0; i < ticks; i++) {
    current = propagateTick(current);
  }

  const time = current.time.current + resource.arrivalMinutes;
  current = {
    ...current,
    time: { current: time },
    mission: { ...current.mission, elapsedMinutes: time },
    resources: recoverResources(current.resources, time),
  };

  let cells: readonly CellState[] = current.cells;
  let message: string;

  switch (resource.type) {
    case "BRIGADE":
    case "HELICOPTER":
    case "TRUCK": {
      const target = current.cells.find((c) => positionKey(c.position) === targetKey)!;
      if (target.status === "BURNING") {
        const intensity = Math.max(0, target.intensity - resource.effectiveness);
        cells = current.cells.map((c) =>
          positionKey(c.position) !== targetKey
            ? c
            : intensity <= 0
              ? { ...c, intensity: 0, status: "PROTECTED" }
              : { ...c, intensity },
        );
        message =
          intensity <= 0
            ? `${resource.type} llegó y extinguió el fuego en (${action.target.x}, ${action.target.y}).`
            : `${resource.type} llegó y redujo el fuego en (${action.target.x}, ${action.target.y}).`;
      } else {
        message = `${resource.type} llegó a (${action.target.x}, ${action.target.y}), sin fuego que combatir.`;
      }
      break;
    }

    case "POLICE": {
      cells = current.cells.map((c) =>
        positionKey(c.position) === targetKey ? { ...c, evacuated: true } : c,
      );
      message = `Policía evacuó (${action.target.x}, ${action.target.y}).`;
      break;
    }

    case "DRONE": {
      message = reconSummary(current);
      break;
    }

    default: {
      return resource.type satisfies never;
    }
  }

  const activeCells = cells
    .filter((cell) => cell.status === "BURNING")
    .map((cell) => ({ position: cell.position, intensity: cell.intensity }));

  return {
    ...current,
    cells,
    fire: { ...current.fire, activeCells },
    events: [...current.events, { time, message }],
  };
}
