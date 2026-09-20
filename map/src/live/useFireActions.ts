import { useEffect, useState } from 'react';

import type { ActionRecommendation } from './types';

/**
 * The real call: POST /api/live-fires/:id/actions (api/src/live/actionRecommendation.ts)
 * hands the incident's own data to Nebius server-side and returns an ActionRecommendation
 * — the frontend never talks to Nebius directly, only to our own backend, proxied by Vite
 * the same way /api/live-fires already is. A 200 with `status: "unavailable"` is not an
 * error: it is Nebius (or the key) being unreachable, already handled server-side.
 */
/**
 * Two routes, one shape. A real incident goes to /api/live-fires and an exercise case to
 * /api/simulated-fires; on the backend they share prompt, validation and cache, and the
 * model tells them apart by `incident.provenance`. They are separate routes on purpose:
 * one list comes from Deepfire and the other from a file in this repo, and a scenario
 * must not be able to walk in through the door meant for real fires.
 */
export type ActionsTarget =
  | { readonly kind: 'live'; readonly id: string }
  | { readonly kind: 'simulated'; readonly id: string };

async function fetchAnalysisFor(target: ActionsTarget): Promise<ActionRecommendation> {
  const base = target.kind === 'live' ? 'live-fires' : 'simulated-fires';
  const res = await fetch(`/api/${base}/${encodeURIComponent(target.id)}/actions`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `fire-actions request failed: ${res.status}`);
  }
  return (await res.json()) as ActionRecommendation;
}

export function useFireActions(target: ActionsTarget | null): {
  analysis: ActionRecommendation | null;
  loading: boolean;
  error: string | null;
} {
  const [analysis, setAnalysis] = useState<ActionRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setAnalysis(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAnalysisFor(target)
      .then((result) => {
        if (!cancelled) setAnalysis(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the id, not the object: a poll cycle rebuilds the summary every 2 min even
    // when nothing changed, and re-fetching (a paid Nebius call) on every poll would
    // both flicker the panel and burn money for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.kind, target?.id]);

  return { analysis, loading, error };
}
