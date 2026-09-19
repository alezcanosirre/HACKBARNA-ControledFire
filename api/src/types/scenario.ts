import type {
  EnvironmentState,
  Position,
  ResourceId,
  ResourceType,
  TerrainType,
} from "./common";

/**
 * Everything in this file is STATIC input to a run: it describes how a
 * simulation starts, never how it currently stands. The dynamic
 * counterparts (CellState, FireState, ResourceState, MissionState) live in
 * simulation.ts.
 */

export interface TerrainCell {
  readonly position: Position;
  readonly type: TerrainType;
  readonly slope: number; // 0-1
  readonly initialFuel: number; // 0-1
}

export interface VulnerableArea {
  readonly id: string;
  readonly name: string;
  readonly cells: readonly Position[];
}

export interface Infrastructure {
  readonly vulnerableAreas: readonly VulnerableArea[];
}

export interface InitialFireConfig {
  readonly ignitionCells: readonly Position[];
  readonly initialIntensity: number; // 0-1, applied to every ignition cell
}

export interface ResourceConfig {
  readonly id: ResourceId;
  readonly name: string;
  readonly type: ResourceType;
  readonly startPosition: Position;
  readonly effectiveness: number; // 0-1, how much this resource reduces fire when deployed
  // Multiple of 5 (TICK_MINUTES), same reasoning as WAIT/CREATE_FIREBREAK's
  // timing: how long from dispatch until this resource's effect applies.
  // The fire keeps propagating during that time.
  readonly arrivalMinutes: number;
}

export interface MissionConfig {
  readonly timeLimitMinutes: number;
  readonly maxBurnedAreaHa: number; // crossing this is a DEFEAT condition — the Engine decides when
}

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly mapWidth: number; // cells
  readonly mapHeight: number; // cells
  readonly terrain: readonly TerrainCell[]; // length === mapWidth * mapHeight
  readonly infrastructure: Infrastructure;
  readonly initialFire: InitialFireConfig;
  readonly initialEnvironment: EnvironmentState;
  readonly initialResources: readonly ResourceConfig[];
  readonly mission: MissionConfig;
}
