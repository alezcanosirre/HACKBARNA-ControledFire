import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { step } from "../engine/step";
import { buildScenario } from "./fixtures";
import type { Action } from "../types";

/**
 * The one property the whole Engine is built to guarantee: same state +
 * same actions = same result. No Math.random, no Date.now, no hidden
 * state anywhere in the propagation/resource/risk/outcome pipeline.
 */
describe("determinism", () => {
  it("createInitialState(scenario) is the same every time for the same scenario", () => {
    const scenario = buildScenario({
      initialEnvironment: { temperature: 28, humidity: 0.3, wind: { speed: 25, direction: 45 } },
    });
    expect(createInitialState(scenario)).toEqual(createInitialState(scenario));
  });

  it("step(state, actions) gives the same result for the same inputs", () => {
    const state = createInitialState(buildScenario());
    const actions: Action[] = [{ type: "WAIT", minutes: 15 }];
    expect(step(state, actions)).toEqual(step(state, actions));
  });

  it("stays deterministic across a longer chain of mixed actions", () => {
    const scenario = buildScenario({
      initialResources: [
        {
          id: "brigade-1",
          name: "Brigada 1",
          type: "BRIGADE",
          startPosition: { x: 0, y: 0 },
          effectiveness: 0.5,
        },
      ],
      initialEnvironment: { temperature: 32, humidity: 0.15, wind: { speed: 30, direction: 200 } },
    });

    function runChain(): ReturnType<typeof createInitialState> {
      let state = createInitialState(scenario);
      state = step(state, [{ type: "WAIT", minutes: 10 }]);
      state = step(state, [
        { type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 2, y: 3 } },
      ]);
      state = step(state, [{ type: "WAIT", minutes: 20 }]);
      return state;
    }

    expect(runChain()).toEqual(runChain());
  });
});
