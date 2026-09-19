import type { Action, Outcome, SimulationState } from "../types";

export { createInitialState } from "./createInitialState";

/**
 * Public signatures ONLY for what's not implemented yet — no propagation
 * algorithm, no body. `declare` lets these type-check as the Engine's
 * contract without an implementation; real functions will replace these
 * declarations without anything that already imports from here needing to
 * change.
 */

export declare function step(state: SimulationState, actions: Action[]): SimulationState;

export declare function calculateOutcome(state: SimulationState): Outcome;
