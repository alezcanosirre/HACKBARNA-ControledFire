import type { AIAnalysis, RankedAction } from '../mocks/types';
import { type Decision, decisionKey } from './decisions';
import { CheckIcon, CrossIcon } from './icons';
import { int, time } from './format';
import { SectionLabel, Surface } from './Surface';

const URGENCY: Record<RankedAction['urgency'], string> = {
  immediate: 'immediate',
  soon: 'soon',
  monitor: 'monitor',
};

/**
 * The actions panel, which is the heart of the product (spec.md §5.4).
 *
 * Three rules that are not up for negotiation, implemented literally here:
 *  - the numbering is real priority, not a bullet;
 *  - the reason is always visible, never folded away: an action without justification
 *    is a blind order and the operator will not follow it;
 *  - Accept and Dismiss are always in sight, never behind a menu. The human decision
 *    is the argument of the whole project.
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
    <Surface padded={false} className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Actions</SectionLabel>
        <span className="text-meta text-muted">AI proposal</span>
      </header>

      {/* The analysis: what the operator is looking at and why this order. */}
      <p className="p-4 text-body text-dim">{analysis.summary}</p>

      <ul className="divide-y divide-line">
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
                      The verb keeps its word: Accept → Accepted. And the time stays
                      beside it, because this is a decision log.
                    */
                    <p
                      className={`flex items-center gap-2 text-label font-medium ${
                        decision.status === 'accepted' ? 'text-signal' : 'text-muted'
                      }`}
                    >
                      {decision.status === 'accepted' ? <CheckIcon /> : <CrossIcon />}
                      {decision.status === 'accepted' ? 'Accepted' : 'Dismissed'}
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
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecide(action.action_id, 'rejected')}
                        className="flex items-center gap-2 rounded-sm border border-line px-4 py-3 text-label font-medium text-muted transition-colors hover:bg-surface-2/60 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                      >
                        <CrossIcon />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Traceability: which model wrote this, and when. */}
      <footer className="p-4 text-meta text-muted">
        {analysis.model} · {time(analysis.generated_at)}
      </footer>
    </Surface>
  );
}
