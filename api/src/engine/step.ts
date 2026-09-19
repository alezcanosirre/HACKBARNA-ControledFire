import type { Action, SimulationState } from "../types";
import { propagateTick } from "./fire/propagateTick";
import { calculateRisk } from "./risk/calculateRisk";
import { calculateOutcome, missionStatusFor } from "./calculateOutcome";
import { deployResource } from "./resources/deployResource";
import { recoverResources } from "./resources/recoverResources";

const TICK_MINUTES = 5;

/**
 * step() always returns a NEW SimulationState, never mutates the one it
 * received. WAIT runs the fire forward in fixed TICK_MINUTES ticks (a WAIT
 * of 12 minutes runs 2 ticks; the leftover 2 minutes still advance the
 * clock but don't trigger a partial tick), logs a factual event, and
 * recovers any resource whose cooldown has elapsed. DEPLOY_RESOURCE moves
 * a resource to its target and, if the target is BURNING, reduces its
 * intensity. An invalid action (WAIT minutes <= 0, unknown/busy resource,
 * out-of-grid target) is dropped silently rather than throwing — the
 * Engine stays defensive against a malformed action from the UI instead of
 * aborting the whole tick. CREATE_FIREBREAK is still a no-op for now.
 */
export function step(state: SimulationState, actions: Action[]): SimulationState {
  let current = state;
  const executedActions: Action[] = [];

  for (const action of actions) {
    if (action.type === "WAIT") {
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
        resources: recoverResources(current.resources, time),
      };
      executedActions.push(action);
      continue;
    }

    if (action.type === "DEPLOY_RESOURCE") {
      const next = deployResource(current, action);
      if (next === null) continue;
      current = next;
      executedActions.push(action);
      continue;
    }

    executedActions.push(action);
  }

  const result: SimulationState = {
    ...current,
    executedActions: [...current.executedActions, ...executedActions],
  };

  const withRisk = { ...result, risk: calculateRisk(result) };
  return {
    ...withRisk,
    mission: { ...withRisk.mission, status: missionStatusFor(calculateOutcome(withRisk)) },
  };
}
