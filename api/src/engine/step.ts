import type { Action, SimulationEvent, SimulationState } from "../types";

/**
 * step() always returns a NEW SimulationState, never mutates the one it
 * received. Only WAIT has real behavior so far: it advances the clock and
 * logs a factual event. A WAIT with minutes <= 0 is invalid and is dropped
 * silently (no time change, not recorded in executedActions) rather than
 * throwing — the Engine stays defensive against a malformed action from
 * the UI instead of aborting the whole tick. Every other action type is
 * still a no-op for now: recorded, no effect, until its own step adds
 * validation and execution.
 */
export function step(state: SimulationState, actions: Action[]): SimulationState {
  let time = state.time.current;
  const events: SimulationEvent[] = [];
  const executedActions: Action[] = [];

  for (const action of actions) {
    if (action.type !== "WAIT") {
      executedActions.push(action);
      continue;
    }

    if (!Number.isFinite(action.minutes) || action.minutes <= 0) {
      continue;
    }

    time += action.minutes;
    events.push({ time, message: `Esperado ${action.minutes} minutos.` });
    executedActions.push(action);
  }

  return {
    ...state,
    time: { current: time },
    events: [...state.events, ...events],
    executedActions: [...state.executedActions, ...executedActions],
    mission: { ...state.mission, elapsedMinutes: time },
  };
}
