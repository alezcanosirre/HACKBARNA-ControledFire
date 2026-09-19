import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { step } from "../engine/step";
import { buildScenario } from "./fixtures";

function cellAt(state: ReturnType<typeof createInitialState>, x: number, y: number) {
  return state.cells.find((c) => c.position.x === x && c.position.y === y)!;
}

describe("propagateTick (via step/WAIT)", () => {
  it("spreads fire downwind faster than upwind", () => {
    const scenario = buildScenario({
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 1 },
      // wind FROM north -> blows south -> downwind is +y
      initialEnvironment: { temperature: 30, humidity: 0.2, wind: { speed: 40, direction: 0 } },
    });
    const state = step(createInitialState(scenario), [{ type: "WAIT", minutes: 5 }]);

    expect(cellAt(state, 2, 3).status).toBe("BURNING"); // south, downwind
    expect(cellAt(state, 2, 1).status).toBe("NORMAL"); // north, upwind
  });

  it("treats crosswind neighbors symmetrically", () => {
    const scenario = buildScenario({
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 1 },
      initialEnvironment: { temperature: 30, humidity: 0.2, wind: { speed: 40, direction: 0 } },
    });
    const state = step(createInitialState(scenario), [{ type: "WAIT", minutes: 15 }]);

    expect(cellAt(state, 4, 2).status).toBe(cellAt(state, 0, 2).status);
  });

  it("consumes fuel on burning cells each tick", () => {
    const state = step(createInitialState(buildScenario()), [{ type: "WAIT", minutes: 5 }]);
    const ignition = cellAt(state, 2, 2);
    expect(ignition.remainingFuel).toBeLessThan(1);
    expect(ignition.status).toBe("BURNING");
  });

  it("burns out to BURNED once fuel is exhausted", () => {
    const scenario = buildScenario({
      terrain: [{ position: { x: 0, y: 0 }, type: "FOREST", slope: 0, initialFuel: 0.1 }],
      mapWidth: 1,
      mapHeight: 1,
      initialFire: { ignitionCells: [{ x: 0, y: 0 }], initialIntensity: 1 },
    });
    const state = step(createInitialState(scenario), [{ type: "WAIT", minutes: 5 }]);
    expect(cellAt(state, 0, 0).status).toBe("BURNED");
    expect(state.fire.activeCells).toHaveLength(0);
    expect(state.fire.burnedAreaHa).toBe(1);
  });

  it("never ignites non-flammable terrain (WATER)", () => {
    const scenario = buildScenario({
      terrain: buildScenario().terrain.map((cell) =>
        cell.position.x === 3 && cell.position.y === 2 ? { ...cell, type: "WATER" as const } : cell,
      ),
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 1 },
    });
    const state = step(createInitialState(scenario), [{ type: "WAIT", minutes: 25 }]);
    expect(cellAt(state, 3, 2).status).toBe("NORMAL");
  });

  it("fire.activeCells is always a projection of BURNING cells, never stale", () => {
    const state = step(createInitialState(buildScenario()), [{ type: "WAIT", minutes: 5 }]);
    const burningPositions = state.cells
      .filter((c) => c.status === "BURNING")
      .map((c) => c.position);
    expect(state.fire.activeCells.map((c) => c.position)).toEqual(burningPositions);
  });
});
