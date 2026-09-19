import { useEffect, useState } from 'react';

import type { AIAnalysis } from '../mocks/types';
import type { LiveFireSummary } from './types';

/**
 * The real call: POST /api/live-fires/:id/actions (api/src/live/fireActions.ts) hands
 * the cluster's data to Nebius server-side and returns AIAnalysis (spec.md §6.4) — the
 * frontend never talks to Nebius directly, only to our own backend, proxied by Vite the
 * same way /api/live-fires already is.
 */
async function fetchAnalysisFor(fire: LiveFireSummary): Promise<AIAnalysis> {
  const res = await fetch(`/api/live-fires/${encodeURIComponent(fire.id)}/actions`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `fire-actions request failed: ${res.status}`);
  }
  return (await res.json()) as AIAnalysis;
}

export function useFireActions(fire: LiveFireSummary | null): {
  analysis: AIAnalysis | null;
  loading: boolean;
  error: string | null;
} {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fire) {
      setAnalysis(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAnalysisFor(fire)
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
    // Keyed on the id, not the object: a poll cycle rebuilds `fire` every 2 min even
    // when nothing changed, and re-fetching (a paid Nebius call) on every poll would
    // both flicker the panel and burn money for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire?.id]);

  return { analysis, loading, error };
}
