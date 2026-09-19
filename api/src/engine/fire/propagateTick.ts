import type { CellState, Position, SimulationState, TerrainType } from "../../types";

const IGNITION_THRESHOLD = 1; // accumulated exposure needed for a NORMAL cell to ignite
const IGNITION_START_INTENSITY = 0.6; // fixed starting intensity for a newly-ignited cell
const FUEL_BURN_RATE = 0.15; // fraction of fuel consumed per tick, scaled by intensity
const WIND_INFLUENCE = 0.6; // max multiplier swing from wind alignment (+/-)
const WIND_SATURATION_SPEED = 40; // km/h at which wind's influence maxes out
const SLOPE_INFLUENCE = 0.5; // max multiplier boost from a steep target cell
const CELL_AREA_HA = 1; // 1 grid cell == 1 hectare (Scenario has no real-world cell size yet)

const TERRAIN_FLAMMABILITY: Record<TerrainType, number> = {
  FOREST: 1,
  GRASS: 1.2,
  URBAN: 0.4,
  ROAD: 0,
  WATER: 0,
};

const NEIGHBOR_OFFSETS: readonly Position[] = [
  { x: 0, y: -1 }, // N
  { x: 1, y: 0 }, // E
  { x: 0, y: 1 }, // S
  { x: -1, y: 0 }, // W
];

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

// Compass bearing -> unit vector, assuming +x = east, +y = south (screen/grid convention).
function directionToVector(degrees: number): Position {
  const radians = (degrees * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

/** How much the wind pushes fire from `from` towards `to`, as a 1 +/- WIND_INFLUENCE multiplier. */
function windMultiplier(
  from: Position,
  to: Position,
  wind: { readonly speed: number; readonly direction: number },
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const dirUnit = { x: dx / length, y: dy / length };

  // wind.direction is where the wind comes FROM, so it blows TOWARDS direction + 180.
  const blowsTowards = directionToVector(wind.direction + 180);
  // Rounded to kill sin/cos floating-point noise (e.g. sin(180deg) isn't
  // exactly 0) that would otherwise break symmetry between e.g. two cells
  // equally crosswind on opposite sides of a burning cell.
  const rawAlignment = dirUnit.x * blowsTowards.x + dirUnit.y * blowsTowards.y;
  const alignment = Math.round(rawAlignment * 1e9) / 1e9; // -1..1

  const speedFactor = Math.min(wind.speed / WIND_SATURATION_SPEED, 1);
  return 1 + WIND_INFLUENCE * speedFactor * alignment;
}

/**
 * Advances the fire by exactly one fixed-size tick. Fully deterministic, no
 * randomness: every NORMAL cell accumulates "exposure" from its burning
 * neighbors (weighted by the neighbor's intensity, the target cell's own
 * terrain/fuel, wind alignment and slope) and ignites once that accumulated
 * exposure crosses IGNITION_THRESHOLD. Exposure never decays.
 *
 * Slope is a single scalar per cell (Scenario has no elevation/gradient), so
 * it's a general flammability booster for the target cell, not a directional
 * "spreads faster uphill" effect.
 */
export function propagateTick(state: SimulationState): SimulationState {
  const cellByKey = new Map<string, CellState>();
  for (const cell of state.cells) {
    cellByKey.set(positionKey(cell.position), cell);
  }

  const exposureGain = new Map<string, number>();

  for (const cell of state.cells) {
    if (cell.status !== "BURNING") continue;

    for (const offset of NEIGHBOR_OFFSETS) {
      const neighborPosition: Position = {
        x: cell.position.x + offset.x,
        y: cell.position.y + offset.y,
      };
      const neighbor = cellByKey.get(positionKey(neighborPosition));
      if (!neighbor || neighbor.status !== "NORMAL") continue;

      const flammability = TERRAIN_FLAMMABILITY[neighbor.terrainType];
      if (flammability <= 0 || neighbor.remainingFuel <= 0) continue;

      const wind = windMultiplier(cell.position, neighbor.position, state.environment.wind);
      const slope = 1 + SLOPE_INFLUENCE * neighbor.slope;
      const contribution = cell.intensity * flammability * neighbor.remainingFuel * wind * slope;

      const key = positionKey(neighbor.position);
      exposureGain.set(key, (exposureGain.get(key) ?? 0) + contribution);
    }
  }

  const cells: CellState[] = state.cells.map((cell) => {
    if (cell.status === "BURNING") {
      const remainingFuel = Math.max(0, cell.remainingFuel - FUEL_BURN_RATE * cell.intensity);
      return {
        ...cell,
        remainingFuel,
        status: remainingFuel <= 0 ? "BURNED" : "BURNING",
        intensity: remainingFuel <= 0 ? 0 : cell.intensity,
      };
    }

    if (cell.status !== "NORMAL") return cell;

    const gain = exposureGain.get(positionKey(cell.position));
    if (gain === undefined) return cell;

    const exposure = cell.exposure + gain;
    if (exposure >= IGNITION_THRESHOLD) {
      return { ...cell, exposure, status: "BURNING", intensity: IGNITION_START_INTENSITY };
    }
    return { ...cell, exposure };
  });

  const activeCells = cells
    .filter((cell) => cell.status === "BURNING")
    .map((cell) => ({ position: cell.position, intensity: cell.intensity }));

  const burnedAreaHa = cells.filter((cell) => cell.status === "BURNED").length * CELL_AREA_HA;

  return {
    ...state,
    cells,
    fire: { activeCells, burnedAreaHa },
  };
}
