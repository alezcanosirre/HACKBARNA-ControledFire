import type { Action, CellState, ResourceState, SimulationState } from "../../types";

const DEPLOY_COOLDOWN_MINUTES = 15;

function positionKey(position: { x: number; y: number }): string {
  return `${position.x},${position.y}`;
}

/**
 * Applies a DEPLOY_RESOURCE action, or returns null if it's invalid
 * (unknown resourceId, resource not AVAILABLE, or target outside the grid)
 * so the caller can drop it silently, same as an invalid WAIT.
 *
 * Deploying always costs the resource (it moves to `target` and goes BUSY
 * for DEPLOY_COOLDOWN_MINUTES) even if the target isn't currently burning —
 * sending a crew somewhere still takes time whether or not there's fire
 * there. The fire effect only applies when the target cell is BURNING: its
 * intensity drops by the resource's effectiveness, and hitting 0 marks the
 * cell PROTECTED (treated, can't ignite again).
 */
export function deployResource(
  state: SimulationState,
  action: Extract<Action, { type: "DEPLOY_RESOURCE" }>,
): SimulationState | null {
  const resource = state.resources.find((r) => r.id === action.resourceId);
  if (!resource || resource.status !== "AVAILABLE") return null;

  const targetKey = positionKey(action.target);
  const targetCell = state.cells.find((cell) => positionKey(cell.position) === targetKey);
  if (!targetCell) return null;

  const resources: ResourceState[] = state.resources.map((r) =>
    r.id === resource.id
      ? {
          ...r,
          position: action.target,
          status: "BUSY",
          busyUntil: state.time.current + DEPLOY_COOLDOWN_MINUTES,
        }
      : r,
  );

  const cells: CellState[] = state.cells.map((cell) => {
    if (cell.status !== "BURNING" || positionKey(cell.position) !== targetKey) return cell;
    const intensity = Math.max(0, cell.intensity - resource.effectiveness);
    return intensity <= 0 ? { ...cell, intensity: 0, status: "PROTECTED" } : { ...cell, intensity };
  });

  const activeCells = cells
    .filter((cell) => cell.status === "BURNING")
    .map((cell) => ({ position: cell.position, intensity: cell.intensity }));

  return {
    ...state,
    resources,
    cells,
    fire: { ...state.fire, activeCells },
    events: [
      ...state.events,
      {
        time: state.time.current,
        message: `${resource.type} desplegado en (${action.target.x}, ${action.target.y}).`,
      },
    ],
  };
}
