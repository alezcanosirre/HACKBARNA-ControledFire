import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { buildScenario } from "./fixtures";

describe("createInitialState", () => {
  it("creates one CellState per terrain cell", () => {
    const scenario = buildScenario();
    const state = createInitialState(scenario);
    expect(state.cells).toHaveLength(scenario.terrain.length);
  });

  it("starts ignition cells BURNING with the scenario's initial intensity", () => {
    const scenario = buildScenario();
    const state = createInitialState(scenario);
    const ignition = state.cells.find((c) => c.position.x === 2 && c.position.y === 2)!;
    expect(ignition.status).toBe("BURNING");
    expect(ignition.intensity).toBe(0.8);
    expect(ignition.exposure).toBe(0);
  });

  it("starts every other cell NORMAL with zero intensity/exposure", () => {
    const scenario = buildScenario();
    const state = createInitialState(scenario);
    const other = state.cells.find((c) => c.position.x === 0 && c.position.y === 0)!;
    expect(other.status).toBe("NORMAL");
    expect(other.intensity).toBe(0);
    expect(other.exposure).toBe(0);
  });

  it("copies terrain/slope onto each cell", () => {
    const scenario = buildScenario({
      terrain: [{ position: { x: 0, y: 0 }, type: "URBAN", slope: 0.4, initialFuel: 0.6 }],
      mapWidth: 1,
      mapHeight: 1,
      initialFire: { ignitionCells: [], initialIntensity: 0 },
    });
    const state = createInitialState(scenario);
    expect(state.cells[0]).toMatchObject({ terrainType: "URBAN", slope: 0.4, remainingFuel: 0.6 });
  });

  it("marks cells inside a vulnerable area as isVulnerable", () => {
    const scenario = buildScenario({
      infrastructure: { vulnerableAreas: [{ id: "town", name: "Town", cells: [{ x: 0, y: 0 }] }] },
    });
    const state = createInitialState(scenario);
    const town = state.cells.find((c) => c.position.x === 0 && c.position.y === 0)!;
    const elsewhere = state.cells.find((c) => c.position.x === 1 && c.position.y === 0)!;
    expect(town.isVulnerable).toBe(true);
    expect(elsewhere.isVulnerable).toBe(false);
  });

  it("copies resources with AVAILABLE status and their effectiveness", () => {
    const scenario = buildScenario({
      initialResources: [
        {
          id: "brigade-1",
          name: "Brigada 1",
          type: "BRIGADE",
          startPosition: { x: 0, y: 0 },
          effectiveness: 0.7,
        },
      ],
    });
    const state = createInitialState(scenario);
    expect(state.resources).toEqual([
      {
        id: "brigade-1",
        type: "BRIGADE",
        position: { x: 0, y: 0 },
        status: "AVAILABLE",
        busyUntil: null,
        effectiveness: 0.7,
      },
    ]);
  });

  it("starts time at 0 and mission IN_PROGRESS with limits copied from the scenario", () => {
    const scenario = buildScenario({ mission: { timeLimitMinutes: 90, maxBurnedAreaHa: 50 } });
    const state = createInitialState(scenario);
    expect(state.time.current).toBe(0);
    expect(state.mission).toEqual({
      status: "IN_PROGRESS",
      elapsedMinutes: 0,
      timeLimitMinutes: 90,
      maxBurnedAreaHa: 50,
    });
  });

  it("computes real initial risk instead of leaving it empty", () => {
    const scenario = buildScenario();
    const state = createInitialState(scenario);
    const ignitionRisk = state.risk.find((r) => r.position.x === 2 && r.position.y === 2)!;
    expect(ignitionRisk.fireRisk).toBe(0.8);
  });

  it("does not simulate anything: fire has not spread yet", () => {
    const scenario = buildScenario();
    const state = createInitialState(scenario);
    expect(state.fire.activeCells).toHaveLength(1);
    expect(state.fire.burnedAreaHa).toBe(0);
    expect(state.events).toHaveLength(0);
  });
});
