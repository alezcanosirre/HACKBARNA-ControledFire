import type { AIAnalysis, Fire } from '../mocks/types';
import { VALUE_TYPE, num } from './format';
import { SectionLabel, Surface } from './Surface';

/**
 * The second card on the right, the "Prios" from the whiteboard (UX.md §5).
 *
 * It does not repeat the "At risk" list on the left: that one enumerates what is
 * nearby, this one orders it into a protection sequence. Downwind first, then by
 * distance. On top, why that order — the `priority_rationale` field of spec.md §6.4.
 */
export function PrioritiesCard({ fire, analysis }: { fire: Fire; analysis: AIAnalysis }) {
  const order = [...fire.values_at_risk].sort(
    (a, b) => Number(b.downwind) - Number(a.downwind) || a.distance_km - b.distance_km,
  );

  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="p-4">
        <SectionLabel>Priorities</SectionLabel>
      </header>
      <p className="p-4 text-body text-dim">{analysis.priority_rationale}</p>
      <ul className="flex flex-col gap-2 p-4">
        {order.map((v) => (
          <li key={v.name} className="flex gap-2 text-label">
            <span aria-hidden="true" className="text-muted">
              ▸
            </span>
            <span className="min-w-0">
              <span className={v.downwind ? 'text-text' : 'text-dim'}>{v.name}</span>
              <span className="text-meta text-muted">
                {' '}
                — {VALUE_TYPE[v.type].toLowerCase()} at {num(v.distance_km)} km
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
