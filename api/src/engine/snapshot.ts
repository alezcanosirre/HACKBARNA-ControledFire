import type { Snapshot, SimulationState } from "../types";

function deepClone(state: SimulationState): SimulationState {
  return JSON.parse(JSON.stringify(state)) as SimulationState;
}

// No `crypto.randomUUID()`: the `crypto` global isn't typed under this
// package's current lib config (ES2020, no DOM/@types/node), and neither
// is installed yet. A short random id is enough for a snapshot identifier.
function generateSnapshotId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Deep clones `state` (JSON round-trip, per the Snapshot contract's own
 * reasoning: everything in SimulationState is plain data, so this is a
 * true deep clone) so later changes to the live simulation can never leak
 * into a stored snapshot.
 */
export function createSnapshot(state: SimulationState): Snapshot {
  return { id: generateSnapshotId(), state: deepClone(state) };
}

/**
 * Deep clones the snapshot's state again on the way out, so every restore
 * — including restoring the same snapshot more than once to try different
 * actions from the same point — is fully independent of every other one.
 */
export function restoreSnapshot(snapshot: Snapshot): SimulationState {
  return deepClone(snapshot.state);
}
