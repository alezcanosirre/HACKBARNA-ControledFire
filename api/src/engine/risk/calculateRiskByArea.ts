import type { AreaRisk, RiskByArea, SimulationState } from "../../types";
import { fireRiskOf } from "./calculateRisk";

/**
 * Aggregates risk per named vulnerable area instead of per cell — the
 * number a "which zone needs attention first" priority list is built
 * from. Each dimension takes the MAX across the area's cells, not an
 * average: one burning cell in a neighborhood is the urgent signal:
 * diluting it against many calm cells in the same area would hide it.
 *
 * Only areaId comes back, not the area's name — the caller already has
 * the Scenario it used to start the simulation, and can look the name up
 * from there. Not computed as part of step()/createInitialState(): like
 * calculateOutcome, it's a derived summary for decision-making, not core
 * simulation state.
 */
export function calculateRiskByArea(state: SimulationState): RiskByArea {
  const byArea = new Map<string, { fireRisk: number; populationRisk: number; infrastructureRisk: number }>();

  for (const cell of state.cells) {
    if (cell.vulnerableAreaId === null) continue;

    const fireRisk = fireRiskOf(cell);
    const infrastructureRisk = cell.terrainType === "URBAN" ? fireRisk : 0;
    const current = byArea.get(cell.vulnerableAreaId) ?? {
      fireRisk: 0,
      populationRisk: 0,
      infrastructureRisk: 0,
    };

    byArea.set(cell.vulnerableAreaId, {
      fireRisk: Math.max(current.fireRisk, fireRisk),
      populationRisk: Math.max(current.populationRisk, fireRisk),
      infrastructureRisk: Math.max(current.infrastructureRisk, infrastructureRisk),
    });
  }

  return Array.from(byArea.entries()).map(
    ([areaId, risk]): AreaRisk => ({ areaId, ...risk }),
  );
}
