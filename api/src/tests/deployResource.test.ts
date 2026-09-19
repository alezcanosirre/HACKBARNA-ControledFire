import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { step } from "../engine/step";
import { buildScenario } from "./fixtures";
import type { ResourceConfig } from "../types";

const brigade: ResourceConfig = {
  id: "brigade-1",
  name: "Brigada 1",
  type: "BRIGADE",
  startPosition: { x: 0, y: 0 },
  effectiveness: 0.6,
};

describe("DEPLOY_RESOURCE", () => {
  it("reduces a burning target cell's intensity by the resource's effectiveness", () => {
    const scenario = buildScenario({
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 0.9 },
      initialResources: [brigade],
    });
    const state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 2, y: 2 } },
    ]);
    const target = state.cells.find((c) => c.position.x === 2 && c.position.y === 2)!;
    expect(target.intensity).toBeCloseTo(0.3, 5);
    expect(target.status).toBe("BURNING");
  });

  it("marks the cell PROTECTED once intensity is fully extinguished", () => {
    const scenario = buildScenario({
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 0.5 },
      initialResources: [brigade],
    });
    const state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 2, y: 2 } },
    ]);
    const target = state.cells.find((c) => c.position.x === 2 && c.position.y === 2)!;
    expect(target.status).toBe("PROTECTED");
    expect(target.intensity).toBe(0);
  });

  it("puts the resource on cooldown (BUSY) at its new position", () => {
    const scenario = buildScenario({ initialResources: [brigade] });
    const state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 2, y: 2 } },
    ]);
    expect(state.resources[0]).toMatchObject({
      status: "BUSY",
      position: { x: 2, y: 2 },
      busyUntil: 15,
    });
  });

  it("drops a second deployment attempt while the resource is BUSY", () => {
    const scenario = buildScenario({ initialResources: [brigade] });
    let state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 2, y: 2 } },
    ]);
    state = step(state, [
      { type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 1, y: 1 } },
    ]);
    expect(state.resources[0]!.position).toEqual({ x: 2, y: 2 });
    expect(state.executedActions).toHaveLength(1);
  });

  it("recovers a BUSY resource to AVAILABLE once its cooldown elapses", () => {
    const scenario = buildScenario({ initialResources: [brigade] });
    let state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 2, y: 2 } },
    ]);
    state = step(state, [{ type: "WAIT", minutes: 15 }]);
    expect(state.resources[0]).toMatchObject({ status: "AVAILABLE", busyUntil: null });
  });

  it("drops the action entirely for an unknown resourceId (state unchanged)", () => {
    const scenario = buildScenario({ initialResources: [brigade] });
    const before = createInitialState(scenario);
    const after = step(before, [
      { type: "DEPLOY_RESOURCE", resourceId: "nope", target: { x: 0, y: 0 } },
    ]);
    expect(after).toEqual(before);
  });

  it("moves the resource but has no fire effect when the target isn't burning", () => {
    const scenario = buildScenario({ initialResources: [brigade] });
    const state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 4, y: 4 } },
    ]);
    expect(state.cells.find((c) => c.position.x === 4 && c.position.y === 4)!.status).toBe("NORMAL");
    expect(state.resources[0]!.status).toBe("BUSY");
  });
});
