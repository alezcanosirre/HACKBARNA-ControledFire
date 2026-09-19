/**
 * Shared primitives and vocabulary. Nothing here imports from anywhere
 * else in /types, so scenario.ts, simulation.ts and action.ts can all
 * depend on it without any risk of a circular import between them.
 */

/** A point on the simulation grid, in cell units (not pixels). */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/** The simulation clock advances in whole minutes. */
export type SimMinutes = number;

export type ResourceId = string;

export type ResourceType = "BRIGADE" | "HELICOPTER" | "TRUCK" | "POLICE" | "DRONE";
export type ResourceStatus = "AVAILABLE" | "DEPLOYED" | "BUSY" | "EXHAUSTED";
export type TerrainType = "FOREST" | "GRASS" | "URBAN" | "ROAD" | "WATER";
export type CellStatus = "NORMAL" | "BURNING" | "BURNED" | "PROTECTED";
export type MissionStatus = "IN_PROGRESS" | "SUCCESS" | "FAILED";

/**
 * Same shape describes the Scenario's starting weather and the
 * SimulationState's current weather, so it lives here rather than in
 * scenario.ts or simulation.ts — that would force one of those two files
 * to import from the other for no reason.
 */
export interface EnvironmentState {
  readonly temperature: number; // Celsius
  readonly humidity: number; // 0-1
  readonly wind: {
    readonly speed: number; // km/h
    readonly direction: number; // degrees, 0 = wind from N
  };
}
