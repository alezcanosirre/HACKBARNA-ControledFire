import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { step } from "../engine/step";
import { calculateOutcome } from "../engine/calculateOutcome";
import { collserolaScenario } from "../scenario/collserola";
import type { Position } from "../types";

const FIREFIGHTERS = ["brigade-sant-cugat", "brigade-vallvidrera", "truck-1", "truck-2", "heli-1"];

/** Sends every AVAILABLE firefighting resource to a different burning cell, hottest first. */
function respond(state: ReturnType<typeof createInitialState>) {
  const burning = [...state.fire.activeCells].sort((a, b) => b.intensity - a.intensity);
  const usedTargets = new Set<string>();
  const actions: { type: "DEPLOY_RESOURCE"; resourceId: string; target: Position }[] = [];

  for (const id of FIREFIGHTERS) {
    const resource = state.resources.find((r) => r.id === id);
    if (resource?.status !== "AVAILABLE") continue;
    const target = burning.find((c) => !usedTargets.has(`${c.position.x},${c.position.y}`));
    if (!target) break;
    usedTargets.add(`${target.position.x},${target.position.y}`);
    actions.push({ type: "DEPLOY_RESOURCE", resourceId: id, target: target.position });
  }

  return actions.length > 0 ? step(state, actions) : step(state, [{ type: "WAIT", minutes: 5 }]);
}

function runUntilResolved(
  state: ReturnType<typeof createInitialState>,
  respondFromTheStart: boolean,
  maxRounds = 60,
) {
  let current = state;
  for (let i = 0; i < maxRounds && calculateOutcome(current) === "IN_PROGRESS"; i++) {
    current = respondFromTheStart ? respond(current) : step(current, [{ type: "WAIT", minutes: 5 }]);
  }
  return current;
}

describe("collserolaScenario", () => {
  it("has internally consistent grid data", () => {
    expect(collserolaScenario.terrain).toHaveLength(
      collserolaScenario.mapWidth * collserolaScenario.mapHeight,
    );
    const ignition = collserolaScenario.initialFire.ignitionCells[0]!;
    expect(
      collserolaScenario.terrain.some(
        (c) => c.position.x === ignition.x && c.position.y === ignition.y,
      ),
    ).toBe(true);
    for (const resource of collserolaScenario.initialResources) {
      expect(resource.startPosition.x).toBeGreaterThanOrEqual(0);
      expect(resource.startPosition.x).toBeLessThan(collserolaScenario.mapWidth);
      expect(resource.startPosition.y).toBeGreaterThanOrEqual(0);
      expect(resource.startPosition.y).toBeLessThan(collserolaScenario.mapHeight);
    }
  });

  it("builds a valid initial state", () => {
    const state = createInitialState(collserolaScenario);
    expect(state.mission.status).toBe("IN_PROGRESS");
    expect(state.fire.activeCells).toHaveLength(1);
  });

  it("is a loss if the player does nothing", () => {
    const state = runUntilResolved(createInitialState(collserolaScenario), false);
    expect(calculateOutcome(state)).not.toBe("VICTORY");
  });

  it("is winnable if the player reacts quickly (within ~10min)", () => {
    let state = createInitialState(collserolaScenario);
    state = step(state, [{ type: "WAIT", minutes: 10 }]);
    state = runUntilResolved(state, true);
    expect(calculateOutcome(state)).toBe("VICTORY");
  });
});
