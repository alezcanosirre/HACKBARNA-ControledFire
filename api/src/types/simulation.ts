import type {
  CellStatus,
  EnvironmentState,
  MissionStatus,
  Position,
  ResourceId,
  ResourceStatus,
  ResourceType,
  SimMinutes,
  TerrainType,
} from "./common";
import type { Action } from "./action";

/**
 * Everything in this file is DYNAMIC: it changes tick to tick, and only
 * the Fire Engine's `step()` is allowed to produce a new value for it.
 */

export interface CellState {
  readonly position: Position;
  readonly remainingFuel: number; // 0-1
  readonly status: CellStatus;
  // terrainType/slope are static in Scenario but copied here at
  // createInitialState() time so SimulationState is self-contained: step()
  // takes only (state, actions), and a restored Snapshot can keep simulating
  // without also needing the original Scenario around.
  readonly terrainType: TerrainType;
  readonly slope: number; // 0-1
  // intensity/exposure make `cells` the single source of truth for fire
  // propagation: fire.activeCells/burnedAreaHa are always a projection the
  // Engine recomputes from these, never independent state to keep in sync.
  readonly intensity: number; // 0-1, meaningful only while BURNING
  readonly exposure: number; // 0+, accumulated ignition pressure while NORMAL
  // Denormalized from Scenario.infrastructure.vulnerableAreas at
  // createInitialState() time, same reasoning as terrainType/slope — lets
  // risk calculation read only `cells`.
  readonly isVulnerable: boolean;
}

export interface FireCell {
  readonly position: Position;
  readonly intensity: number; // 0-1
  // spreadRate / spreadDirection intentionally omitted: the Engine
  // computes those internally, they are not part of the shared contract yet.
}

export interface FireState {
  readonly activeCells: readonly FireCell[];
  readonly burnedAreaHa: number;
}

export interface CellRisk {
  readonly position: Position;
  readonly fireRisk: number; // 0-1
  readonly populationRisk: number; // 0-1
  readonly infrastructureRisk: number; // 0-1
}

export type RiskState = readonly CellRisk[];

export interface ResourceState {
  readonly id: ResourceId;
  readonly type: ResourceType;
  readonly position: Position;
  readonly status: ResourceStatus;
  readonly busyUntil: SimMinutes | null; // null when not on cooldown
  // effectiveness is static in Scenario but copied here at
  // createInitialState() time, same reasoning as CellState's terrainType/slope.
  readonly effectiveness: number; // 0-1, how much this resource reduces fire when deployed
}

/** Engine-authored, factual log line. The AI reads this; it never writes to it. */
export interface SimulationEvent {
  readonly time: SimMinutes;
  readonly message: string;
}

export interface MissionState {
  readonly status: MissionStatus;
  readonly elapsedMinutes: SimMinutes;
}

export interface SimulationState {
  readonly scenarioId: string;
  readonly time: { readonly current: SimMinutes };
  readonly environment: EnvironmentState;
  readonly cells: readonly CellState[];
  readonly fire: FireState;
  readonly resources: readonly ResourceState[];
  readonly risk: RiskState;
  readonly events: readonly SimulationEvent[];
  readonly executedActions: readonly Action[];
  readonly mission: MissionState;
}
