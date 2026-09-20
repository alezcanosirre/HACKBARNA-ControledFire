import { useEffect, useState } from 'react';

import type { IncidentTriage } from './types';

/**
 * The real call: GET /api/live-fires/triage (api/src/live/incidentTriage.ts) hands every
 * incident on screen to Nebius server-side and gets back the order to attend them in. Same
 * shape of hook as useFireActions, and for the same reason: the fetch is a paid model
 * call that takes seconds, so it never sits between the operator and the screen.
 *
 * Nothing here blocks anything. The map, the menu and clicking a fire open are all
 * already painted before this resolves, and while it is in flight the panel shows a
 * skeleton the size of the final rows (ui/TriageSkeleton.tsx) — never a spinner and
 * never a gap.
 *
 * A 200 with `status: "unavailable"` is not an error: it is Nebius (or the key) being
 * unreachable, already handled server-side. `status: "not_applicable"` is not one
 * either — it is the backend saying there are fewer than two incidents, which this hook
 * already knows and does not even ask about.
 */
/**
 * Two routes, one shape — the same split useFireActions makes, for the same reason. A
 * real incident goes to /api/live-fires and an exercise case to /api/simulated-fires; on
 * the backend they share prompt, validation and cache, and the model tells them apart by
 * `provenance`. They are separate routes on purpose: one list comes from Deepfire and the
 * other from a file in this repo, and a scenario must not be able to walk in through the
 * door meant for real fires.
 */
export interface TriageTarget {
  readonly kind: 'live' | 'simulated';
  /** Which incidents are on screen. Two or more, or there is nothing to order. */
  readonly incidentIds: readonly string[];
}

async function fetchTriage(kind: TriageTarget['kind']): Promise<IncidentTriage> {
  const base = kind === 'live' ? 'live-fires' : 'simulated-fires';
  const res = await fetch(`/api/${base}/triage`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `triage request failed: ${res.status}`);
  }
  return (await res.json()) as IncidentTriage;
}

export function useTriage(target: TriageTarget): {
  triage: IncidentTriage | null;
  loading: boolean;
  error: string | null;
} {
  /*
   * The fetch is keyed on WHICH fires are burning, not on the array that carries them.
   * A poll cycle rebuilds that array every 15 s even when nothing changed, and
   * re-fetching on each one would burn a Nebius call for an order that cannot have
   * moved. Sorted, because the order the backend lists them in is Deepfire's and can
   * permute between cycles with no fire having appeared or gone out.
   *
   * When one does appear or go out the key changes by itself, and that is exactly when
   * an old order stops being true. The kind is in the key too: switching SIMULATION on
   * replaces the whole list with a different one, off a different endpoint.
   */
  const key = [target.kind, ...[...target.incidentIds].sort()].join('|');
  // Triage is a comparison. With fewer than two incidents there is nothing to compare,
  // so the request is not made at all — the backend agrees (`not_applicable`), but the
  // cheapest call is the one nobody makes.
  const enabled = target.incidentIds.length >= 2;

  const [triage, setTriage] = useState<IncidentTriage | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  /*
   * A different set of fires means the order in hand is not an order of THESE fires, so
   * it is dropped the moment the key moves — during the render, not in an effect, the
   * same way useLiveFireState drops its cells. An effect would leave one frame showing a
   * ranking that is missing the fire that just broke out, which is the single frame in
   * which this card would be lying. Switching SIMULATION on and off is the loud version
   * of the same thing: real fires ranked over an invented map, for one frame.
   */
  const [shownKey, setShownKey] = useState(key);
  if (key !== shownKey) {
    setShownKey(key);
    setTriage(null);
    setError(null);
    setLoading(enabled);
  }

  const kind = target.kind;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchTriage(kind)
      .then((result) => {
        if (!cancelled) setTriage(result);
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
    // `enabled` and `kind` are both carried by `key`: neither can move without the key
    // moving, so neither is a dependency of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { triage, loading, error };
}
