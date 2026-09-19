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
  arrivalMinutes: 5,
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

  it("puts the resource on cooldown (BUSY) at its new position for arrival + recovery time", () => {
    const scenario = buildScenario({ initialResources: [brigade] });
    const state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 2, y: 2 } },
    ]);
    expect(state.resources[0]).toMatchObject({
      status: "BUSY",
      position: { x: 2, y: 2 },
      busyUntil: 15, // 5min arrival + 10min recovery
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

  it("recovers a BUSY resource to AVAILABLE once arrival + recovery time elapses", () => {
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

  it("keeps propagating fire during arrival time, and applies the effect on arrival, not dispatch", () => {
    // slow helicopter (20min = 4 ticks) sent to the ignition cell: by the
    // time it arrives, the fire has already spread to (3,2) too.
    const heli: ResourceConfig = {
      id: "heli-1",
      name: "Helicóptero 1",
      type: "HELICOPTER",
      startPosition: { x: 0, y: 0 },
      effectiveness: 0.9,
      arrivalMinutes: 20,
    };
    const scenario = buildScenario({
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 1 },
      initialResources: [heli],
    });
    const state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "heli-1", target: { x: 2, y: 2 } },
    ]);
    expect(state.time.current).toBe(20);
    expect(state.cells.find((c) => c.position.x === 3 && c.position.y === 2)!.status).toBe(
      "BURNING",
    ); // fire reached a neighbor while the helicopter was still travelling
  });

  it("can arrive to find its target already burned out — no effect, not an error", () => {
    const heli: ResourceConfig = {
      id: "heli-1",
      name: "Helicóptero 1",
      type: "HELICOPTER",
      startPosition: { x: 0, y: 0 },
      effectiveness: 0.9,
      arrivalMinutes: 25,
    };
    const scenario = buildScenario({
      terrain: [{ position: { x: 0, y: 0 }, type: "FOREST", slope: 0, initialFuel: 0.1 }],
      mapWidth: 1,
      mapHeight: 1,
      initialFire: { ignitionCells: [{ x: 0, y: 0 }], initialIntensity: 1 },
      initialResources: [heli],
    });
    const state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "heli-1", target: { x: 0, y: 0 } },
    ]);
    const target = state.cells[0]!;
    expect(target.status).toBe("BURNED"); // burned out on its own before the heli got there
    expect(state.events[state.events.length - 1]!.message).toContain("sin fuego que combatir");
  });

  it("POLICE evacuates the target cell, dropping populationRisk to 0 without affecting the fire", () => {
    const police: ResourceConfig = {
      id: "police-1",
      name: "Policía 1",
      type: "POLICE",
      startPosition: { x: 0, y: 0 },
      effectiveness: 0,
      arrivalMinutes: 5,
    };
    const scenario = buildScenario({
      infrastructure: {
        vulnerableAreas: [{ id: "town", name: "Town", cells: [{ x: 2, y: 2 }] }],
      },
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 0.7 },
      initialResources: [police],
    });
    const state = step(createInitialState(scenario), [
      { type: "DEPLOY_RESOURCE", resourceId: "police-1", target: { x: 2, y: 2 } },
    ]);
    const target = state.cells.find((c) => c.position.x === 2 && c.position.y === 2)!;
    expect(target.evacuated).toBe(true);
    expect(target.status).toBe("BURNING"); // still on fire — police doesn't fight it
    expect(target.intensity).toBe(0.7); // unaffected
    const risk = state.risk.find((r) => r.position.x === 2 && r.position.y === 2)!;
    expect(risk.populationRisk).toBe(0);
    expect(risk.fireRisk).toBeGreaterThan(0); // infrastructure/fire risk still real
  });

  it("DRONE changes nothing but logs a recon summary event", () => {
    const drone: ResourceConfig = {
      id: "drone-1",
      name: "Dron 1",
      type: "DRONE",
      startPosition: { x: 0, y: 0 },
      effectiveness: 0,
      arrivalMinutes: 0,
    };
    const scenario = buildScenario({ initialResources: [drone] });
    const before = createInitialState(scenario);
    const state = step(before, [
      { type: "DEPLOY_RESOURCE", resourceId: "drone-1", target: { x: 2, y: 2 } },
    ]);
    expect(state.cells).toEqual(before.cells); // no cell changed
    expect(state.events[state.events.length - 1]!.message).toMatch(/^Dron: /);
  });
});
