import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { step } from "../engine/step";
import { buildScenario } from "./fixtures";

describe("step", () => {
  it("never mutates the state it received", () => {
    const state = createInitialState(buildScenario());
    const snapshot = JSON.parse(JSON.stringify(state));
    step(state, [{ type: "WAIT", minutes: 5 }]);
    expect(state).toEqual(snapshot);
  });

  it("returns a new object, not the same reference", () => {
    const state = createInitialState(buildScenario());
    const next = step(state, [{ type: "WAIT", minutes: 5 }]);
    expect(next).not.toBe(state);
  });

  it("advances time and mission.elapsedMinutes by a valid WAIT's minutes", () => {
    const state = createInitialState(buildScenario());
    const next = step(state, [{ type: "WAIT", minutes: 12 }]);
    expect(next.time.current).toBe(12);
    expect(next.mission.elapsedMinutes).toBe(12);
  });

  it("logs a factual event for a valid WAIT", () => {
    const state = createInitialState(buildScenario());
    const next = step(state, [{ type: "WAIT", minutes: 5 }]);
    expect(next.events[next.events.length - 1]).toEqual({ time: 5, message: "Esperado 5 minutos." });
  });

  it("drops an invalid WAIT (minutes <= 0) silently: no time change, not recorded", () => {
    const state = createInitialState(buildScenario());
    const next = step(state, [{ type: "WAIT", minutes: 0 }, { type: "WAIT", minutes: -5 }]);
    expect(next.time.current).toBe(0);
    expect(next.executedActions).toHaveLength(0);
    expect(next.events).toHaveLength(0);
  });

  it("only propagates fire in whole 5-minute ticks: leftover minutes still advance the clock", () => {
    const state = createInitialState(buildScenario());
    const next = step(state, [{ type: "WAIT", minutes: 3 }]);
    expect(next.time.current).toBe(3);
    // no tick ran (3 < 5), so nothing new should have ignited
    const burningCount = next.cells.filter((c) => c.status === "BURNING").length;
    expect(burningCount).toBe(1); // still just the original ignition cell
  });

  it("records every processed action in executedActions, across multiple actions", () => {
    const state = createInitialState(buildScenario());
    const next = step(state, [{ type: "WAIT", minutes: 5 }, { type: "WAIT", minutes: 5 }]);
    expect(next.executedActions).toHaveLength(2);
    expect(next.time.current).toBe(10);
  });

  it("keeps mission.status in sync with the real outcome", () => {
    const state = createInitialState(buildScenario());
    expect(state.mission.status).toBe("IN_PROGRESS");
    const next = step(state, [{ type: "WAIT", minutes: 5 }]);
    expect(next.mission.status).toBe("IN_PROGRESS");
  });
});
