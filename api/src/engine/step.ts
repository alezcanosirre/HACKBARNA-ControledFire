import type { Action, SimulationState } from "../types";

/**
 * Minimal skeleton: just records which actions were submitted this tick.
 * No action has any effect yet, no time advances, no fire spreads — those
 * arrive in later steps. This establishes the one rule every future
 * addition builds on: step() always returns a NEW SimulationState, never
 * mutates the one it received.
 */
export function step(state: SimulationState, actions: Action[]): SimulationState {
  return {
    ...state,
    executedActions: [...state.executedActions, ...actions],
  };
}
