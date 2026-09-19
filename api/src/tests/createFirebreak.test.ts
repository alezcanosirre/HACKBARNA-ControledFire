import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { step } from "../engine/step";
import { buildScenario } from "./fixtures";

function cellAt(state: ReturnType<typeof createInitialState>, x: number, y: number) {
  return state.cells.find((c) => c.position.x === x && c.position.y === y)!;
}

describe("CREATE_FIREBREAK", () => {
  it("protects every NORMAL target cell, far from any fire", () => {
    const state = step(createInitialState(buildScenario()), [
      {
        type: "CREATE_FIREBREAK",
        target: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      },
    ]);
    expect(cellAt(state, 0, 0).status).toBe("PROTECTED");
    expect(cellAt(state, 0, 1).status).toBe("PROTECTED");
  });

  it("costs 5 minutes per cell in the line", () => {
    const state = step(createInitialState(buildScenario()), [
      { type: "CREATE_FIREBREAK", target: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] },
    ]);
    expect(state.time.current).toBe(15);
    expect(state.mission.elapsedMinutes).toBe(15);
  });

  it("logs how many cells were protected", () => {
    const state = step(createInitialState(buildScenario()), [
      { type: "CREATE_FIREBREAK", target: [{ x: 0, y: 0 }] },
    ]);
    expect(state.events[state.events.length - 1]).toEqual({
      time: 5,
      message: "Línea de contención creada: 1 celdas protegidas.",
    });
  });

  it("drops an empty target silently", () => {
    const before = createInitialState(buildScenario());
    const after = step(before, [{ type: "CREATE_FIREBREAK", target: [] }]);
    expect(after).toEqual(before);
  });

  it("drops a target entirely outside the grid", () => {
    const before = createInitialState(buildScenario());
    const after = step(before, [
      { type: "CREATE_FIREBREAK", target: [{ x: 999, y: 999 }] },
    ]);
    expect(after).toEqual(before);
  });

  it("fails the part of the line the fire reaches before construction finishes", () => {
    // Ignition at (2,2), calm wind, 0.8 intensity, no slope: (3,2) accumulates
    // enough exposure to ignite partway through a 3-cell (15min/3-tick) line,
    // but (4,2) and (0,4) — farther away — don't catch up in time.
    const scenario = buildScenario({
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 0.8 },
    });
    const state = step(createInitialState(scenario), [
      {
        type: "CREATE_FIREBREAK",
        target: [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 0, y: 4 }],
      },
    ]);

    expect(cellAt(state, 3, 2).status).toBe("BURNING"); // fire got here first
    expect(cellAt(state, 4, 2).status).toBe("PROTECTED");
    expect(cellAt(state, 0, 4).status).toBe("PROTECTED");
    expect(state.events[state.events.length - 1]).toEqual({
      time: 15,
      message: "Línea de contención: 2 celdas protegidas, 1 alcanzadas por el fuego antes de terminar.",
    });
  });

  it("cannot protect a cell that is already BURNING at the moment it's requested", () => {
    const scenario = buildScenario({
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 0.8 },
    });
    const state = step(createInitialState(scenario), [
      { type: "CREATE_FIREBREAK", target: [{ x: 2, y: 2 }] },
    ]);
    expect(cellAt(state, 2, 2).status).toBe("BURNING");
  });
});
