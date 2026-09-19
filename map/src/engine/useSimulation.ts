import { useEffect, useMemo, useState } from 'react';

import { createInitialState, step } from '../../../api/src/engine';
import { collserolaScenario } from '../../../api/src/scenario/collserola';
import type { CellState, EnvironmentState, SimulationState } from '../../../api/src/types';
import { createAnchor } from './anchor';

/**
 * Drives the Fire Engine from the browser.
 *
 * There is no HTTP here and there does not need to be: `api/` is a pure TypeScript
 * library with no server — its entry points are plain functions, and `map/spec.md` §6.5
 * already allowed for exactly this. Nothing to deploy, no key, no CORS.
 *
 * **The Engine has no clock.** It never advances on its own; that would break its
 * purity. The real-time feel is produced here, by a timer that keeps sending WAIT.
 */

/** Simulated minutes per tick. MUST be a multiple of 5 (api/spec.md): with less, the
 *  clock moves and the fire does not spread, and the leftover is not carried over. */
const SIM_MINUTES_PER_TICK = 5;

/** Real milliseconds per tick. 1 s : 5 sim-minutes — the whole mission in under a minute. */
const REAL_MS_PER_TICK = 1000;

/** One scenario, one fire. `SimulationState.fire` is a single projection, not a list. */
export const SIM_FIRE_ID = collserolaScenario.id;

export interface SimulationView {
  /** Cells the map paints. Only the ones with something to show. */
  readonly burning: readonly CellState[];
  readonly burned: readonly CellState[];
  readonly protectedCells: readonly CellState[];
  /** The Engine's own hectare count. Never derived from cell size — see anchor.ts. */
  readonly burnedAreaHa: number;
  readonly minutes: number;
  readonly onFire: boolean;
  readonly environment: EnvironmentState;
  readonly cellId: (cell: CellState) => string;
  readonly fireBounds: readonly [[number, number], [number, number]];
}

export function useSimulation(): SimulationView {
  const [state, setState] = useState<SimulationState>(() =>
    createInitialState(collserolaScenario),
  );

  const anchor = useMemo(
    () => createAnchor(collserolaScenario.mapWidth, collserolaScenario.mapHeight),
    [],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      // Functional update: the interval is set up once and its closure would otherwise
      // keep simulating from the state it saw on the first render, forever.
      setState((prev) => step(prev, [{ type: 'WAIT', minutes: SIM_MINUTES_PER_TICK }]));
    }, REAL_MS_PER_TICK);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const burning: CellState[] = [];
    const burned: CellState[] = [];
    const protectedCells: CellState[] = [];
    for (const cell of state.cells) {
      if (cell.status === 'BURNING') burning.push(cell);
      else if (cell.status === 'BURNED') burned.push(cell);
      else if (cell.status === 'PROTECTED') protectedCells.push(cell);
    }

    // The fire is framed by what is burning now; once it is out, by the scar it left.
    const extent = burning.length > 0 ? burning : burned;

    return {
      burning,
      burned,
      protectedCells,
      burnedAreaHa: state.fire.burnedAreaHa,
      minutes: state.time.current,
      onFire: burning.length > 0,
      environment: state.environment,
      cellId: (cell: CellState) => anchor.cellId(cell.position),
      fireBounds: anchor.boundsOf(extent.map((c) => c.position)),
    };
  }, [state, anchor]);
}
