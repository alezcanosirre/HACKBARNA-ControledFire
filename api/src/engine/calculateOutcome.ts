import type { MissionStatus, Outcome, SimulationState } from "../types";

/**
 * Pure and derived from `state` alone. Checked in priority order: crossing
 * the burned-area limit is decisive regardless of anything else (per
 * MissionConfig.maxBurnedAreaHa's own contract comment), then a fully
 * contained fire wins, then running out of time loses, then having no
 * usable resources loses.
 *
 * RESOURCES_EXHAUSTED currently never triggers: nothing in the Engine yet
 * puts a resource into EXHAUSTED (no uses-limit/durability mechanic
 * exists), so this branch is dead until that mechanic is built — kept
 * because the Outcome contract requires it.
 */
export function calculateOutcome(state: SimulationState): Outcome {
  if (state.fire.burnedAreaHa > state.mission.maxBurnedAreaHa) {
    return "DEFEAT";
  }

  if (state.fire.activeCells.length === 0) {
    return "VICTORY";
  }

  if (state.mission.elapsedMinutes >= state.mission.timeLimitMinutes) {
    return "TIME_LIMIT_REACHED";
  }

  if (state.resources.length > 0 && state.resources.every((r) => r.status === "EXHAUSTED")) {
    return "RESOURCES_EXHAUSTED";
  }

  return "IN_PROGRESS";
}

/** Maps the granular Outcome down to the coarse status step() keeps on MissionState. */
export function missionStatusFor(outcome: Outcome): MissionStatus {
  if (outcome === "VICTORY") return "SUCCESS";
  if (outcome === "IN_PROGRESS") return "IN_PROGRESS";
  return "FAILED";
}
