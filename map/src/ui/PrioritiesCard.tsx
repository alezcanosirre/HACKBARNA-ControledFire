import type { AIAnalysis, Fire } from '../mocks/types';
import { VALUE_TYPE, num } from './format';
import { SectionLabel, Surface } from './Surface';

/**
 * La segunda tarjeta de la derecha, la «Prios» de la pizarra (UX.md §5).
 *
 * No repite la lista de «En riesgo» de la izquierda: aquella enumera lo que hay cerca,
 * esta lo ordena en secuencia de protección. Primero lo que está en la trayectoria del
 * viento, después por distancia. Arriba, el porqué de ese orden, que es el campo
 * `priority_rationale` de spec.md §6.4.
 */
export function PrioritiesCard({ fire, analysis }: { fire: Fire; analysis: AIAnalysis }) {
  const order = [...fire.values_at_risk].sort(
    (a, b) => Number(b.downwind) - Number(a.downwind) || a.distance_km - b.distance_km,
  );

  return (
    <Surface padded={false} className="divide-y divide-night-700">
      <header className="p-4">
        <SectionLabel>Prioridades</SectionLabel>
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
                — {VALUE_TYPE[v.type].toLowerCase()} a {num(v.distance_km)} km
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
