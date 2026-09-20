import { useEffect, useState } from 'react';

import type { LiveIgnitionRiskCell } from '../live/types';

/**
 * PRED while SIMULATION is running.
 *
 * With the simulation on, polling Deepfire stops — the two sources never share the
 * screen — and PRED had nothing left to paint. These cells are invented
 * (api/src/scenario/simulatedRiskCells.ts) but the same model scores them with the same
 * prompt as the measured ones: the scenario changes where the data comes from, not who
 * judges it.
 *
 * Fetched once and kept: the scenario is static, so re-asking on every page switch would
 * be paying the model twice for the same answer. The backend caches it too.
 */

export interface SimulatedRisk {
  readonly ignitionRisk: readonly LiveIgnitionRiskCell[];
  readonly ignitionAnalysis: {
    readonly summary: string | null;
    readonly model: string | null;
    readonly generatedAt: string;
  };
}

export function useSimulatedRisk(enabled: boolean): SimulatedRisk | null {
  const [data, setData] = useState<SimulatedRisk | null>(null);

  useEffect(() => {
    if (!enabled || data) return;
    let cancelled = false;

    fetch('/api/simulated-risk')
      .then((res) => {
        if (!res.ok) throw new Error(`simulated-risk failed: ${res.status}`);
        return res.json() as Promise<SimulatedRisk>;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err: unknown) => {
        // The forecast staying empty is a visible problem someone can go and fix; a
        // fabricated one is a problem you find out about on stage.
        console.error('simulated risk unavailable:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, data]);

  return enabled ? data : null;
}
