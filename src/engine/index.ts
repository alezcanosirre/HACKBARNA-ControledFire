import type { Action, Outcome, Scenario, SimulationState } from "../types";

/**
 * Public signatures ONLY — no propagation algorithm, no bodies. `declare`
 * lets these type-check as the Engine's contract without requiring an
 * implementation yet; the real functions replace this file later without
 * anything that already imports from here needing to change.
 */

export declare function createInitialState(scenario: Scenario): SimulationState;

export declare function step(state: SimulationState, actions: Action[]): SimulationState;

export declare function calculateOutcome(state: SimulationState): Outcome;
