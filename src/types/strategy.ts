import type { Action } from "./action";

/**
 * What the AI is allowed to produce. Deliberately no field claiming an
 * outcome ("willSucceed", "expectedResult") — a Strategy is only ever a
 * proposal; only the Engine, by actually running `step()` over `actions`,
 * gets to say what happens.
 */
export interface Strategy {
  readonly id: string;
  readonly title: string;
  readonly reasoning: string;
  readonly actions: readonly Action[];
}
