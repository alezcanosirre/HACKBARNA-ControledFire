import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { step } from "../engine/step";
import { calculateRiskByArea } from "../engine/risk/calculateRiskByArea";
import { buildScenario } from "./fixtures";

describe("calculateRiskByArea", () => {
  it("returns one entry per named vulnerable area, zero risk when unaffected", () => {
    const scenario = buildScenario({
      infrastructure: {
        vulnerableAreas: [
          { id: "town-a", name: "Town A", cells: [{ x: 0, y: 0 }] },
          { id: "town-b", name: "Town B", cells: [{ x: 4, y: 4 }] },
        ],
      },
    });
    const byArea = calculateRiskByArea(createInitialState(scenario));
    expect(byArea).toHaveLength(2);
    for (const area of byArea) {
      expect(area.fireRisk).toBe(0);
      expect(area.populationRisk).toBe(0);
    }
  });

  it("takes the MAX across an area's cells, not an average", () => {
    const scenario = buildScenario({
      infrastructure: {
        vulnerableAreas: [
          {
            id: "town",
            name: "Town",
            cells: [{ x: 2, y: 2 }, { x: 4, y: 4 }], // one on fire, one calm
          },
        ],
      },
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 0.8 },
    });
    const byArea = calculateRiskByArea(createInitialState(scenario));
    expect(byArea).toEqual([
      { areaId: "town", fireRisk: 0.8, populationRisk: 0.8, infrastructureRisk: 0 },
    ]);
  });

  it("only counts infrastructureRisk for URBAN cells within the area", () => {
    const scenario = buildScenario({
      terrain: buildScenario().terrain.map((cell) =>
        cell.position.x === 2 && cell.position.y === 2 ? { ...cell, type: "URBAN" as const } : cell,
      ),
      infrastructure: {
        vulnerableAreas: [{ id: "town", name: "Town", cells: [{ x: 2, y: 2 }] }],
      },
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 0.7 },
    });
    const byArea = calculateRiskByArea(createInitialState(scenario));
    expect(byArea).toEqual([
      { areaId: "town", fireRisk: 0.7, populationRisk: 0.7, infrastructureRisk: 0.7 },
    ]);
  });

  it("updates as the fire spreads through step()", () => {
    const scenario = buildScenario({
      infrastructure: {
        vulnerableAreas: [{ id: "town", name: "Town", cells: [{ x: 3, y: 2 }] }],
      },
      initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 1 },
    });
    const before = calculateRiskByArea(createInitialState(scenario));
    expect(before[0]!.fireRisk).toBe(0);

    const state = step(createInitialState(scenario), [{ type: "WAIT", minutes: 10 }]);
    const after = calculateRiskByArea(state);
    expect(after[0]!.fireRisk).toBeGreaterThan(0);
  });
});
