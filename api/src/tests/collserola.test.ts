import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { step } from "../engine/step";
import { calculateOutcome } from "../engine/calculateOutcome";
import { collserolaScenario } from "../scenario/collserola";

const FIREFIGHTERS = ["brigade-sant-cugat", "brigade-vallvidrera", "truck-1", "truck-2", "heli-1"];

/**
 * Sends the first AVAILABLE firefighting resource to the hottest burning
 * cell — one resource per step() call. Bundling several DEPLOY_RESOURCE
 * actions in one call would stack their arrival times sequentially rather
 * than resolve them in parallel (see deployResource.ts), so one-at-a-time
 * is both simpler and how this actually plays out.
 */
function respond(state: ReturnType<typeof createInitialState>) {
  const burning = [...state.fire.activeCells].sort((a, b) => b.intensity - a.intensity);
  const target = burning[0]?.position;
  const resourceId = FIREFIGHTERS.find(
    (id) => state.resources.find((r) => r.id === id)?.status === "AVAILABLE",
  );

  return resourceId && target
    ? step(state, [{ type: "DEPLOY_RESOURCE", resourceId, target }])
    : step(state, [{ type: "WAIT", minutes: 5 }]);
}

function runUntilResolved(
  state: ReturnType<typeof createInitialState>,
  respondFromTheStart: boolean,
  maxRounds = 80,
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
      expect(resource.arrivalMinutes).toBeGreaterThanOrEqual(0);
      expect(resource.arrivalMinutes % 5).toBe(0); // multiple of TICK_MINUTES
    }
  });

  it("builds a valid initial state", () => {
    const state = createInitialState(collserolaScenario);
    expect(state.mission.status).toBe("IN_PROGRESS");
    expect(state.fire.activeCells).toHaveLength(1);
  });

  it("is a loss if the player does nothing", () => {
    const state = runUntilResolved(createInitialState(collserolaScenario), false, 60);
    expect(calculateOutcome(state)).not.toBe("VICTORY");
  });

  it("is winnable if the player reacts within ~20min of ignition, one resource at a time", () => {
    let state = createInitialState(collserolaScenario);
    state = step(state, [{ type: "WAIT", minutes: 10 }]);
    state = runUntilResolved(state, true);
    expect(calculateOutcome(state)).toBe("VICTORY");
  });

  it("is a loss if the player waits too long (30min+) before reacting", () => {
    let state = createInitialState(collserolaScenario);
    state = step(state, [{ type: "WAIT", minutes: 30 }]);
    state = runUntilResolved(state, true);
    expect(calculateOutcome(state)).not.toBe("VICTORY");
  });
});
