import type { CellRisk, CellState, RiskState, SimulationState } from "../../types";

/** Shared by calculateRisk and calculateRiskByArea, so the formula lives in one place. */
export function fireRiskOf(cell: CellState): number {
  if (cell.status === "BURNING") return cell.intensity;
  if (cell.status === "NORMAL") return Math.min(1, cell.exposure);
  return 0; // BURNED, PROTECTED: no longer a fire risk
}

/**
 * Pure projection from `cells`, recomputed on every step — risk is never
 * independent state, same as fire.activeCells. fireRisk reuses signals the
 * fire module already tracks (intensity while BURNING, accumulated
 * exposure while NORMAL) rather than a separate model. populationRisk and
 * infrastructureRisk are fireRisk gated by what's actually at stake on
 * that cell: a Scenario-marked vulnerable area for population, URBAN
 * terrain for infrastructure. v1 is purely reactive — a vulnerable cell
 * shows no risk until the fire threat is literally on it, no
 * distance-to-fire anticipation yet.
 */
export function calculateRisk(state: SimulationState): RiskState {
  return state.cells.map((cell): CellRisk => {
    const fireRisk = fireRiskOf(cell);
    return {
      position: cell.position,
      fireRisk,
      populationRisk: cell.vulnerableAreaId !== null ? fireRisk : 0,
      infrastructureRisk: cell.terrainType === "URBAN" ? fireRisk : 0,
    };
  });
}
