import { useEffect, useState } from 'react';

import type { AIAnalysis, RankedAction } from '../mocks/types';
import type { LiveFireDetail } from './groupFires';

/**
 * Stand-in for the real call: the backend endpoint that hands a live fire's data to
 * Nebius and gets back a ranked action list isn't built yet (see conversation — "de
 * momento solo el frontend, nos conectaremos mediante IA con Nebius"). The shape below
 * IS the real contract (AIAnalysis, spec.md §6.4) so swapping the body of
 * `useFireActions` for a `fetch('/api/live-fires/:id/actions')` later needs no change
 * anywhere else.
 */
function stubAnalysisFor(fire: LiveFireDetail): AIAnalysis {
  const actions: RankedAction[] = [
    {
      action_id: 'DEPLOY_RESOURCE:helicopter',
      label: 'Send a water-bombing helicopter',
      rank: 1,
      urgency: 'immediate',
      why: fire.fireRadiativePowerMw
        ? `Radiative power of ${fire.fireRadiativePowerMw.toFixed(1)} MW on the most recent detection — an active front, not a residual hotspot.`
        : 'Active detection with no radiative-power reading yet — treat as a live front until proven otherwise.',
      resources: ['Water-bombing helicopter'],
      status: 'proposed',
    },
    {
      action_id: 'CREATE_FIREBREAK',
      label: 'Scout the perimeter for a firebreak line',
      rank: 2,
      urgency: 'soon',
      why: `${fire.cellIds.length} adjacent cell(s) confirmed burning — enough ground to plan containment now rather than after it grows further.`,
      resources: ['Ground crew'],
      status: 'proposed',
    },
  ];

  return {
    target_id: fire.id,
    summary: 'Placeholder analysis — no AI call wired yet, see useFireActions.ts.',
    priority_rationale: 'Fixed order until the real model ranks by wind, values at risk and fuel.',
    actions,
    model: 'stub (Nebius integration pending)',
    generated_at: fire.detectedAt ?? new Date(0).toISOString(),
  };
}

const FAKE_LATENCY_MS = 500;

export function useFireActions(fire: LiveFireDetail | null): {
  analysis: AIAnalysis | null;
  loading: boolean;
} {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fire) {
      setAnalysis(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      setAnalysis(stubAnalysisFor(fire));
      setLoading(false);
    }, FAKE_LATENCY_MS);
    return () => window.clearTimeout(timer);
    // Keyed on the id, not the object: a poll cycle rebuilds `fire` every 2 min even
    // when nothing changed, and re-fetching on every poll would flicker the panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire?.id]);

  return { analysis, loading };
}
