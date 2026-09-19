import { describe, expect, it } from "vitest";
import { createInitialState } from "../engine/createInitialState";
import { step } from "../engine/step";
import { createSnapshot, restoreSnapshot } from "../engine/snapshot";
import { buildScenario } from "./fixtures";

describe("snapshots", () => {
  it("deep-clones state: the snapshot is not the same object", () => {
    const state = createInitialState(buildScenario());
    const snap = createSnapshot(state);
    expect(snap.state).not.toBe(state);
    expect(snap.state).toEqual(state);
  });

  it("restores exactly the state at the moment it was taken, unaffected by later steps", () => {
    let state = createInitialState(buildScenario());
    state = step(state, [{ type: "WAIT", minutes: 5 }]);
    const snap = createSnapshot(state);

    const later = step(state, [{ type: "WAIT", minutes: 10 }]);
    const restored = restoreSnapshot(snap);

    expect(restored).toEqual(snap.state);
    expect(restored).not.toEqual(later);
    expect(restored.time.current).toBe(5);
  });

  it("gives independent objects on repeated restores of the same snapshot (safe to branch)", () => {
    const state = createInitialState(buildScenario());
    const snap = createSnapshot(state);

    const branchA = step(restoreSnapshot(snap), [{ type: "WAIT", minutes: 5 }]);
    const branchB = step(restoreSnapshot(snap), [{ type: "WAIT", minutes: 20 }]);

    expect(branchA.time.current).toBe(5);
    expect(branchB.time.current).toBe(20);
    expect(restoreSnapshot(snap)).toEqual(snap.state); // the snapshot itself stayed untouched
  });

  it("assigns each snapshot a unique id", () => {
    const state = createInitialState(buildScenario());
    const a = createSnapshot(state);
    const b = createSnapshot(state);
    expect(a.id).not.toBe(b.id);
  });
});
