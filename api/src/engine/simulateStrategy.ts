import type { SimulationState, Strategy } from "../types";
import { step } from "./step";

/**
 * Runs a Strategy's actions through step() and returns the resulting
 * state — a preview, not a commitment. Nothing here writes back anywhere
 * or marks the strategy as "adopted": the caller decides whether to keep
 * the returned state as the real one or discard it. Logs "IA propuso:
 * <title>" before running the actions, so the preview shows why those
 * particular effects happened, alongside whatever events step() itself
 * logs while applying them (e.g. a WAIT's "Esperado N minutos.").
 */
export function simulateStrategy(state: SimulationState, strategy: Strategy): SimulationState {
  const proposed: SimulationState = {
    ...state,
    events: [
      ...state.events,
      { time: state.time.current, message: `IA propuso: ${strategy.title}` },
    ],
  };
  return step(proposed, [...strategy.actions]);
}
