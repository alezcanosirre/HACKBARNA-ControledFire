import type { Action, SimulationState } from "../types";
import { propagateTick } from "./fire/propagateTick";

const TICK_MINUTES = 5;

/**
 * step() always returns a NEW SimulationState, never mutates the one it
 * received. Only WAIT has real behavior so far: it runs the fire forward in
 * fixed TICK_MINUTES ticks (a WAIT of 12 minutes runs 2 ticks; the leftover
 * 2 minutes still advance the clock but don't trigger a partial tick), then
 * logs a factual event. A WAIT with minutes <= 0 is invalid and is dropped
 * silently (no time change, not recorded in executedActions) rather than
 * throwing — the Engine stays defensive against a malformed action from
 * the UI instead of aborting the whole tick. Every other action type is
 * still a no-op for now: recorded, no effect, until its own step adds
 * validation and execution.
 */
export function step(state: SimulationState, actions: Action[]): SimulationState {
  let current = state;
  const executedActions: Action[] = [];

  for (const action of actions) {
    if (action.type !== "WAIT") {
      executedActions.push(action);
      continue;
    }

    if (!Number.isFinite(action.minutes) || action.minutes <= 0) {
      continue;
    }

    const ticks = Math.floor(action.minutes / TICK_MINUTES);
    for (let i = 0; i < ticks; i++) {
      current = propagateTick(current);
    }

    const time = current.time.current + action.minutes;
    current = {
      ...current,
      time: { current: time },
      events: [...current.events, { time, message: `Esperado ${action.minutes} minutos.` }],
      mission: { ...current.mission, elapsedMinutes: time },
    };
    executedActions.push(action);
  }

  return {
    ...current,
    executedActions: [...current.executedActions, ...executedActions],
  };
}
