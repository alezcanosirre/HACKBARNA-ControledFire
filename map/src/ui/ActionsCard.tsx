import type { ComponentType } from 'react';

import type { AIAnalysis, RankedAction } from '../mocks/types';
import { type Decision, decisionKey } from './decisions';
import {
  CheckIcon,
  ClockIcon,
  CrewIcon,
  CrossIcon,
  DroneIcon,
  EvacuateIcon,
  FirebreakIcon,
  HelicopterIcon,
  PlaneIcon,
} from './icons';
import { int, time } from './format';
import { SectionLabel, Surface } from './Surface';

const URGENCY: Record<RankedAction['urgency'], string> = {
  immediate: 'immediate',
  soon: 'soon',
  monitor: 'monitor',
};

/**
 * Glyph per catalogue entry. `action_id` is the reference to the catalogue (spec §6.4),
 * so it is what decides the icon: when the engine is wired in, its closed `Action`
 * union lands on these same prefixes and the mapping still holds.
 */
const ICONS: Array<[string, ComponentType<{ className?: string }>]> = [
  ['WAIT', ClockIcon],
  ['EVACUATE', EvacuateIcon],
  ['CREATE_FIREBREAK', FirebreakIcon],
  ['DEPLOY_RESOURCE:helicopter', HelicopterIcon],
  ['DEPLOY_RESOURCE:air', PlaneIcon],
  ['DEPLOY_RESOURCE:drone', DroneIcon],
];

function iconFor(actionId: string) {
  // Longest prefix first, so DEPLOY_RESOURCE:drone does not fall through to the
  // generic ground crew.
  const hit = ICONS.find(([prefix]) => actionId.startsWith(prefix));
  return hit ? hit[1] : CrewIcon;
}

/**
 * The actions panel, which is the heart of the product (spec.md §5.4).
 *
 * The row anatomy comes from the design you passed: a glyph tile on the left, the title
 * with a compact meta line underneath, tight rows separated by a 1px rule. Three things
 * were adapted rather than copied:
 *
 *  - The tile glyphs are monochrome, not colour emoji. The reference's emoji are warm,
 *    and warm is map data, never interface (DESIGN.md §1).
 *  - The meta line is not monospaced. DESIGN.md §2 rules it out for small data.
 *  - The reference row carries one verb button. Ours carries two, Accept and Dismiss,
 *    and the reason above them. Those are the two things spec §5.4 will not give up: an
 *    action without justification is a blind order and the operator will not follow it,
 *    and the human decision is the argument of the whole project. They keep the
 *    reference's right-hand alignment, on their own line so they fit in 360px.
 *
 * The rank opens the meta line. The numbering is real priority, not a bullet.
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
          const Icon = iconFor(action.action_id);
          const meta = [
            `Priority ${action.rank}`,
            URGENCY[action.urgency],
            action.eta_min !== undefined ? `${int(action.eta_min)} min` : null,
            action.resources?.length ? action.resources.join(', ') : null,
          ].filter(Boolean);

          return (
            <li key={action.action_id} className="flex gap-3 p-4">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-line bg-surface-2 text-muted"
              >
                <Icon />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-text">{action.label}</p>
                <p className="mt-0.5 text-meta text-muted">{meta.join(' · ')}</p>
                <p className="mt-1.5 text-body text-dim">{action.why}</p>

                <div className="mt-3 flex flex-wrap justify-end gap-2">
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
                    <>
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
                    </>
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
