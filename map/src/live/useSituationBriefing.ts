import { useEffect, useState } from 'react';

import type { SituationBriefing } from './types';

/**
 * The situation briefing for the whole area: GET /api/live-fires/briefing
 * (api/src/live/situationBriefing.ts) hands every active fire plus the forecast's
 * ignition risk to Nebius server-side and returns one paragraph and up to three
 * concerns. Same shape of hook as useFireActions: the frontend never talks to Nebius
 * directly, only to our own backend, proxied by Vite like /api/live-fires already is.
 *
 * A 200 with `status: "unavailable"` is not an error — it is Nebius (or the key) being
 * unreachable, already handled server-side. A 503 IS one, and it only happens before
 * the first poll cycle has finished.
 *
 * NOTHING here blocks a render. The map, the menu and clicking a fire all work exactly
 * the same whether this has answered, is still thinking, or failed.
 */
/**
 * Two routes, one shape — the same split useFireActions already makes. The live area
 * goes to /api/live-fires/briefing and the exercise to /api/simulated-briefing; on the
 * backend they share prompt, validation and cache, and the model tells them apart by
 * `provenance`. They are separate routes on purpose: one situation comes from Deepfire
 * and the other from a file in this repo, and a scenario must not be able to walk in
 * through the door meant for the real area.
 *
 * `signature` is what decides a re-fetch. For the live area it changes when a fire
 * appears, disappears or is detected again; for the exercise it never changes, because
 * the cases are fixed.
 */
export type BriefingTarget =
  | { readonly kind: 'live'; readonly signature: string }
  | { readonly kind: 'simulated'; readonly signature: string };

async function fetchBriefing(target: BriefingTarget): Promise<SituationBriefing> {
  const res = await fetch(
    target.kind === 'live' ? '/api/live-fires/briefing' : '/api/simulated-briefing',
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `situation-briefing request failed: ${res.status}`);
  }
  return (await res.json()) as SituationBriefing;
}

export function useSituationBriefing(target: BriefingTarget | null): {
  briefing: SituationBriefing | null;
  loading: boolean;
  error: string | null;
} {
  const [briefing, setBriefing] = useState<SituationBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setBriefing(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBriefing(target)
      .then((result) => {
        if (!cancelled) setBriefing(result);
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
    /*
     * Keyed on a signature of the situation, not on the state object: a poll cycle
     * rebuilds that object every 2 min even when nothing moved, and re-fetching on
     * every poll would flicker the panel for no reason. The signature changes when a
     * fire appears, disappears or is detected again, and when the risk zones change —
     * which is exactly when the text would say something different.
     *
     * The previous briefing is deliberately NOT cleared while a new one is in flight:
     * the old text stays readable until the new one lands, instead of the panel
     * dropping back to a skeleton it already grew out of. Switching the simulation on
     * or off DOES change `kind`, and that one has to re-fetch — the exercise and the
     * real area are not the same situation and their texts must never cross over.
     *
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.kind, target?.signature]);

  return { briefing, loading, error };
}
