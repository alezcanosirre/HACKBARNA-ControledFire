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
calculateOutcome(state: SimulationState): Outcome // not implemented yet
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

## Reading the result

`SimulationState.cells` is the single source of truth for the map: each
cell carries `status`, `remainingFuel`, `intensity`, plus the terrain data
(`terrainType`, `slope`) copied in at init time. `SimulationState.fire`
(`activeCells`, `burnedAreaHa`) is a projection the Engine recomputes from
`cells` on every propagation tick — never trust it as independent state,
and never write to either from the UI or the AI.

`SimulationState.events` is an Engine-authored, factual log (e.g. "Esperado
5 minutos.") — safe to render directly or feed to the AI for narration.

## Current implementation status

| Piece | Status |
| --- | --- |
| `createInitialState` | done |
| `step` — `WAIT` + time advance | done |
| `step` — fire propagation (wind/slope/fuel/terrain, deterministic, 5-min ticks) | done |
| `step` — `DEPLOY_RESOURCE` / `CREATE_FIREBREAK` | not implemented — actions are accepted but currently no-ops |
| Fuel consumption | done (as part of propagation) |
| Risk (`fireRisk`/`populationRisk`/`infrastructureRisk`) | not implemented — `risk: []` always |
| `calculateOutcome` | not implemented |
| Snapshots | not implemented |
| `simulateStrategy` | not implemented |
| Tests (Vitest) | not set up yet |

Until `DEPLOY_RESOURCE`/`CREATE_FIREBREAK` are implemented, sending them is
harmless — they're recorded in `executedActions` but change nothing.
