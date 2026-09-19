import type {
  CellState,
  FireCell,
  Position,
  ResourceState,
  Scenario,
  SimulationState,
} from "../types";
import { calculateRisk } from "./risk/calculateRisk";
import { calculateOutcome, missionStatusFor } from "./calculateOutcome";

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

/**
 * Turns a Scenario (static config) into the SimulationState at time 0.
 * Does not simulate anything: fire has not spread, resources have not
 * acted — risk is computed once, from that untouched initial state.
 */
export function createInitialState(scenario: Scenario): SimulationState {
  const ignitionKeys = new Set(scenario.initialFire.ignitionCells.map(positionKey));
  const vulnerableKeys = new Set(
    scenario.infrastructure.vulnerableAreas.flatMap((area) => area.cells.map(positionKey)),
  );

  const cells: CellState[] = scenario.terrain.map((terrainCell) => {
    const isIgnition = ignitionKeys.has(positionKey(terrainCell.position));
    return {
      position: terrainCell.position,
      remainingFuel: terrainCell.initialFuel,
      status: isIgnition ? "BURNING" : "NORMAL",
      terrainType: terrainCell.type,
      slope: terrainCell.slope,
      intensity: isIgnition ? scenario.initialFire.initialIntensity : 0,
      exposure: 0,
      isVulnerable: vulnerableKeys.has(positionKey(terrainCell.position)),
    };
  });

  const activeCells: FireCell[] = scenario.initialFire.ignitionCells.map((position) => ({
    position,
    intensity: scenario.initialFire.initialIntensity,
  }));

  const resources: ResourceState[] = scenario.initialResources.map((resource) => ({
    id: resource.id,
    type: resource.type,
    position: resource.startPosition,
    status: "AVAILABLE",
    busyUntil: null,
    effectiveness: resource.effectiveness,
  }));

  const state: SimulationState = {
    scenarioId: scenario.id,
    time: { current: 0 },
    environment: scenario.initialEnvironment,
    cells,
    fire: {
      activeCells,
      burnedAreaHa: 0,
    },
    resources,
    risk: [],
    events: [],
    executedActions: [],
    mission: {
      status: "IN_PROGRESS",
      elapsedMinutes: 0,
      timeLimitMinutes: scenario.mission.timeLimitMinutes,
      maxBurnedAreaHa: scenario.mission.maxBurnedAreaHa,
    },
  };

  const withRisk = { ...state, risk: calculateRisk(state) };
  return {
    ...withRisk,
    mission: { ...withRisk.mission, status: missionStatusFor(calculateOutcome(withRisk)) },
  };
}
