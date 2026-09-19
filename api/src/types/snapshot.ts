import type { SimulationState } from "./simulation";

/**
 * v1 decision: store the WHOLE SimulationState, not a diff. At hackathon
 * scale a full `JSON.parse(JSON.stringify(state))` is cheap and safe;
 * everything in SimulationState is plain data (no Date/Map/Set/functions),
 * so the copy is a true deep clone with no shared references back to the
 * live state.
 */
export interface Snapshot {
  readonly id: string;
  readonly state: SimulationState;
}
