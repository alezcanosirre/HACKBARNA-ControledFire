# api/ — Fire Engine

Backend package: the Fire Engine (`api/src/engine`) and the shared contracts
it's built on (`api/src/types`). Pure TypeScript, no React, no framework —
whatever serverless/API layer wraps it (Vercel functions, etc.) is a thin
adapter around the calls below. The Engine is the only source of truth for
what happens in the simulation; nothing else computes propagation, risk,
victory or defeat.

## Entry points (`api/src/engine`)

```ts
createInitialState(scenario: Scenario): SimulationState
step(state: SimulationState, actions: Action[]): SimulationState
calculateOutcome(state: SimulationState): Outcome
createSnapshot(state: SimulationState): Snapshot
restoreSnapshot(snapshot: Snapshot): SimulationState
simulateStrategy(state: SimulationState, strategy: Strategy): SimulationState
```

Both `createInitialState` and `step` are pure and deterministic: same input
always produces the same output, no hidden state, no `Date.now()`, no RNG.

## Starting a simulation

"Empezar Simulación" in the UI is one call:

```ts
const state = createInitialState(scenario);
```

This sets up the map from the `Scenario` (terrain, initial fire already
`BURNING` on its ignition cells, resources `AVAILABLE`) at `time.current = 0`.
It does not simulate anything by itself — no propagation has run yet.

## Driving time forward

**The Engine has no internal clock or timer.** It never runs on its own —
that would break purity/testability. Time only moves when the caller sends
a `WAIT` action through `step()`. The real-time feel ("the fire keeps
spreading even if I do nothing") is produced by the frontend, not the
Engine: run a timer (`setInterval`, or Phaser's `update()`) that calls
`step()` on a fixed cadence.

**Contract: always send `WAIT` in multiples of 5 simulated minutes.**
Fire propagation advances in fixed 5-minute ticks internally. A `step()`
call with `minutes < 5` still advances `time.current` by that amount, but
triggers **zero** propagation ticks — and the leftover minutes are not
carried over to the next call. So a loop that sends `WAIT: 1` every real
second will move the clock but the fire will never spread. Always request
5, 10, 15... simulated minutes per call.

```ts
// one real-time "tick" of the frontend loop, nothing else happened
state = step(state, [{ type: "WAIT", minutes: 5 }]);

// the user clicked an action mid-tick: send it on its own call instead
state = step(state, [{ type: "DEPLOY_RESOURCE", resourceId: "brigade-1", target: { x, y } }]);
```

Multiple actions can be sent in the same `step()` call (e.g. a `WAIT` plus
a resource deployment); the Engine processes them in array order.

`CREATE_FIREBREAK` also costs time — 5 simulated minutes per cell in the
line — and the fire keeps propagating while it's under construction. If
the fire reaches part of the line before the crew finishes, that stretch
fails (stays whatever it burned to, not retroactively protected); only
cells still `NORMAL` at completion become `PROTECTED`. So a `step()` call
with a long firebreak can, on its own, trigger several propagation ticks —
same as a long `WAIT`.

## Reading the result

`SimulationState.cells` is the single source of truth for the map: each
cell carries `status`, `remainingFuel`, `intensity`, plus the terrain data
(`terrainType`, `slope`) copied in at init time. `SimulationState.fire`
(`activeCells`, `burnedAreaHa`) is a projection the Engine recomputes from
`cells` on every propagation tick — never trust it as independent state,
and never write to either from the UI or the AI.

`SimulationState.events` is an Engine-authored, factual log (e.g. "Esperado
5 minutos.") — safe to render directly or feed to the AI for narration.

## Priorities panel: risk aggregated by zone

`calculateRiskByArea(state)` (not part of `SimulationState`, computed on
demand like `calculateOutcome`) groups `RiskState` by named vulnerable area
instead of by cell — one `{areaId, fireRisk, populationRisk,
infrastructureRisk}` per area, each dimension the MAX across that area's
cells. `areaId` matches `Scenario.infrastructure.vulnerableAreas[].id`; the
caller already has the Scenario it used to start the run, so it looks up
the area's `name` from there rather than the Engine duplicating it.

This gives the **numbers**; it does not decide what to do about them. A
"priority list" like "evacuate this zone first, then close that one" is an
interpretation of these numbers — that's `Strategy`/AI territory, same as
everywhere else: the Engine computes, the AI proposes.

## Strategy vs Review

`Strategy` (already existed) is forward-looking: the AI reads the current
state + `calculateRiskByArea` and proposes what to do next, via
`simulateStrategy()`. `Review` is the mirror, backward-looking: an
after-action critique of a finished (or finishing) run. Like `Strategy`,
the Engine only defines `Review`'s shape — producing one is entirely the
AI's job, from `events`/before-after state; no Engine function builds one.

## Current implementation status

Everything in the original Core roadmap is implemented: `createInitialState`,
`step` (`WAIT`/time, fire propagation, `DEPLOY_RESOURCE`, `CREATE_FIREBREAK`,
fuel consumption, risk, outcome), `calculateOutcome`, snapshots,
`simulateStrategy`, and a Vitest suite (`api/src/tests`, run with `npm test`
inside `api/`) covering all of it plus a dedicated determinism check and a
balance-tested example scenario (`api/src/scenario/collserola.ts`).

Known gaps, not bugs:
- `POLICE`/`DRONE` resources have no mechanic of their own yet — they only
  do whatever `DEPLOY_RESOURCE`'s generic fire-intensity-reduction effect
  does, so give them `effectiveness: 0` in a Scenario until that lands.
- `RESOURCES_EXHAUSTED` in `calculateOutcome` can never actually trigger:
  nothing puts a resource into `EXHAUSTED` (no uses-limit/durability
  mechanic exists).
- Risk is purely reactive (no distance-to-fire anticipation): a vulnerable/
  `URBAN` cell shows risk only once the fire is literally on it.
- A `Scenario`'s local `{x,y}` grid isn't yet anchored to a real lat/lng —
  still an open integration point with `map/`'s quadkey grid.
