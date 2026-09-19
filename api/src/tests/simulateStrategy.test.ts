import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { simulateStrategy } from "../engine/simulateStrategy";
import { buildScenario } from "./fixtures";
import type { Strategy } from "../types";

describe("simulateStrategy", () => {
  it("previews a strategy's effect without touching the state it was given", () => {
    const scenario = buildScenario({
      initialResources: [
        {
          id: "brigade-1",
          name: "Brigada 1",
          type: "BRIGADE",
          startPosition: { x: 0, y: 0 },
          effectiveness: 0.9,
          arrivalMinutes: 5,
        },
      ],
    });
    const state = createInitialState(scenario);
    const strategy: Strategy = {
      id: "s1",
      title: "Contener el foco",
      reasoning: "Atacar directo mientras la intensidad es baja.",
      actions: [{ type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x: 2, y: 2 } }],
    };

    const preview = simulateStrategy(state, strategy);

    expect(state.events).toHaveLength(0); // original untouched
    expect(preview.cells.find((c) => c.position.x === 2 && c.position.y === 2)!.status).toBe(
      "PROTECTED",
    );
  });

  it("logs the proposal before the actions' own events", () => {
    const state = createInitialState(buildScenario());
    const strategy: Strategy = {
      id: "s1",
      title: "Esperar y observar",
      reasoning: "El viento es calmo por ahora.",
      actions: [{ type: "WAIT", minutes: 5 }],
    };

    const preview = simulateStrategy(state, strategy);

    expect(preview.events.map((e) => e.message)).toEqual([
      "IA propuso: Esperar y observar",
      "Esperado 5 minutos.",
    ]);
  });
});
