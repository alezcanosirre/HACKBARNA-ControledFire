import type { AIAnalysis, RankedAction } from '../mocks/types';
import { type Decision, decisionKey } from './decisions';
import { CheckIcon, CrossIcon } from './icons';
import { int, time } from './format';
import { SectionLabel, Surface } from './Surface';

const URGENCY: Record<RankedAction['urgency'], string> = {
  immediate: 'inmediata',
  soon: 'pronto',
  monitor: 'vigilar',
};

/**
 * El panel de acciones, que es el corazón del producto (spec.md §5.4).
 *
 * Tres reglas que no se negocian y que están implementadas literalmente aquí:
 *  - la numeración es prioridad real, no viñeta;
 *  - el porqué está siempre visible, nunca plegado: una acción sin justificación es
 *    una orden ciega y el operador no la sigue;
 *  - Aceptar y Descartar están siempre a la vista, nunca tras un menú. La decisión
 *    humana es el argumento del proyecto.
 */
export function ActionsCard({
  analysis,
  decisions,
  onDecide,
}: {
  analysis: AIAnalysis;
  decisions: Record<string, Decision>;
  onDecide: (actionId: string, status: Decision['status']) => void;
}) {
  const actions = [...analysis.actions].sort((a, b) => a.rank - b.rank);

  return (
    <Surface padded={false} className="divide-y divide-night-700">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Acciones</SectionLabel>
        <span className="text-meta text-muted">propuesta de la IA</span>
      </header>

      {/* El análisis: qué tiene delante el operador y por qué este orden. */}
      <p className="p-4 text-body text-dim">{analysis.summary}</p>

      <ul className="divide-y divide-night-700">
        {actions.map((action) => {
          const decision = decisions[decisionKey(analysis.target_id, action.action_id)];
          return (
            <li key={action.action_id} className="flex gap-3 p-4">
              <span className="w-4 shrink-0 text-label font-medium text-muted tabular-nums">
                {action.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-text">{action.label}</p>
                <p className="mt-1 text-body text-dim">{action.why}</p>
                <p className="mt-1 text-meta text-muted">
                  {URGENCY[action.urgency]}
                  {action.eta_min !== undefined && ` · ${int(action.eta_min)} min`}
                  {action.resources?.length ? ` · ${action.resources.join(', ')}` : ''}
                </p>

                <div className="mt-3">
                  {decision ? (
                    /*
                      El verbo conserva la palabra: Aceptar → Aceptada. Y queda la hora
                      al lado, porque esto es un registro de decisiones.
                    */
                    <p
                      className={`flex items-center gap-2 text-label font-medium ${
                        decision.status === 'accepted' ? 'text-signal' : 'text-muted'
                      }`}
                    >
                      {decision.status === 'accepted' ? <CheckIcon /> : <CrossIcon />}
                      {decision.status === 'accepted' ? 'Aceptada' : 'Descartada'}
                      <span className="text-meta font-normal text-muted">
                        {time(decision.at)}
                      </span>
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onDecide(action.action_id, 'accepted')}
                        className="flex items-center gap-2 rounded-sm bg-primary px-4 py-3 text-label font-medium text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                      >
                        <CheckIcon />
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecide(action.action_id, 'rejected')}
                        className="flex items-center gap-2 rounded-sm border border-night-700 px-4 py-3 text-label font-medium text-muted transition-colors hover:bg-night-700/50 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                      >
                        <CrossIcon />
                        Descartar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Trazabilidad: qué modelo lo ha escrito y cuándo. */}
      <footer className="p-4 text-meta text-muted">
        {analysis.model} · {time(analysis.generated_at)}
      </footer>
    </Surface>
  );
}
