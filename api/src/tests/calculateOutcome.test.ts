import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { calculateOutcome } from "../engine/calculateOutcome";
import { step } from "../engine/step";
import { buildScenario } from "./fixtures";

describe("calculateOutcome", () => {
  it("is IN_PROGRESS for a fresh scenario", () => {
    const state = createInitialState(buildScenario());
    expect(calculateOutcome(state)).toBe("IN_PROGRESS");
  });

  it("is DEFEAT once burnedAreaHa crosses maxBurnedAreaHa", () => {
    const scenario = buildScenario({ mission: { timeLimitMinutes: 120, maxBurnedAreaHa: 0 } });
    let state = createInitialState(scenario);
    for (let i = 0; i < 10 && calculateOutcome(state) === "IN_PROGRESS"; i++) {
      state = step(state, [{ type: "WAIT", minutes: 5 }]);
    }
    expect(calculateOutcome(state)).toBe("DEFEAT");
    expect(state.mission.status).toBe("FAILED");
  });

  it("is VICTORY once the fire is fully contained", () => {
    const scenario = buildScenario({
      mapWidth: 1,
      mapHeight: 1,
      terrain: [{ position: { x: 0, y: 0 }, type: "FOREST", slope: 0, initialFuel: 0.1 }],
      initialFire: { ignitionCells: [{ x: 0, y: 0 }], initialIntensity: 1 },
    });
    let state = createInitialState(scenario);
    for (let i = 0; i < 5 && calculateOutcome(state) === "IN_PROGRESS"; i++) {
      state = step(state, [{ type: "WAIT", minutes: 5 }]);
    }
    expect(calculateOutcome(state)).toBe("VICTORY");
    expect(state.mission.status).toBe("SUCCESS");
  });

  it("is TIME_LIMIT_REACHED once elapsed time hits the limit with fire still active", () => {
    const scenario = buildScenario({ mission: { timeLimitMinutes: 5, maxBurnedAreaHa: 100 } });
    const state = step(createInitialState(scenario), [{ type: "WAIT", minutes: 5 }]);
    expect(calculateOutcome(state)).toBe("TIME_LIMIT_REACHED");
    expect(state.mission.status).toBe("FAILED");
  });
});
