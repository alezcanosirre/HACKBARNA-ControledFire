import type { Outcome, SimulationState } from "../types";

export { createInitialState } from "./createInitialState";
export { step } from "./step";

/**
 * Public signature ONLY for what's not implemented yet — no body.
 * `declare` lets this type-check as part of the Engine's contract without
 * an implementation; the real function will replace this declaration
 * without anything that already imports from here needing to change.
 */

export declare function calculateOutcome(state: SimulationState): Outcome;
