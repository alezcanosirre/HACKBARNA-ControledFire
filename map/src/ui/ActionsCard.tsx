import type { ComponentType } from 'react';

import type { AIAnalysis, RankedAction } from '../mocks/types';
import {
  ClockIcon,
  CrewIcon,
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
 * The actions panel on the ACTUAL page.
 *
 * It only shows information. There is no Accept or Dismiss here: the firefighter
 * decides on the ground and the screen does not ask them to sign anything. What this
 * card owes them is the ranked list, the reason behind each entry and who wrote it —
 * enough to judge, nothing that pretends to command.
 *
 * That is a deliberate departure from spec.md §5.4, which asks for the two buttons and
 * a decision log. Your call, taken after seeing it on screen. DESIGN.md §7 and UX.md §5
 * are updated; spec.md is not, because that file belongs to the other session.
 *
 * The row anatomy comes from the design you passed: a glyph tile on the left, the title
 * with a compact meta line underneath, tight rows separated by a 1px rule. Two things
 * were adapted rather than copied:
 *
 *  - The tile glyphs are monochrome, not colour emoji. The reference's emoji are warm,
 *    and warm is map data, never interface (DESIGN.md §1).
 *  - The meta line is not monospaced. DESIGN.md §2 rules it out for small data.
 *
 * The rank opens the meta line. The numbering is real priority, not a bullet.
 */
export function ActionsCard({ analysis }: { analysis: AIAnalysis }) {
  const actions = [...analysis.actions].sort((a, b) => a.rank - b.rank);

  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Actions</SectionLabel>
        <span className="text-meta text-muted">AI proposal</span>
      </header>

      {/*
        `analysis.summary` is deliberately not rendered. It restated in prose what the
        information card on the left already states as data — wind, humidity, who is
        downwind — and saying it twice in the same screen buys nothing. The field stays
        in the contract (spec §6.4) because the model still produces it and something
        else may want it; what does not stay is the paragraph.
      */}
      <ul className="divide-y divide-line">
        {actions.map((action) => {
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
                {/*
                  The reason stays, and stays unfolded. Without the buttons it is no
                  longer the argument for a decision made here, it is the whole point of
                  the row: it is what lets whoever is on the ground judge the proposal.
                */}
                <p className="mt-1.5 text-body text-dim">{action.why}</p>
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
