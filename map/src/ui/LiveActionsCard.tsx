import type { ActionRecommendation } from '../live/types';
import { clock } from './format';
import { SectionLabel, Surface } from './Surface';

/**
 * Mirrors api/src/live/actionCatalog.ts's titles — only the titles, never the full
 * description/whenToPropose/limitation, which stay server-side prompt material. The
 * backend already resolves `recommendedAction.title` for us; this map exists only to
 * label `complementaryActionIds`, which the contract sends as bare ids ("A02") with no
 * text of their own. Same duplication-on-purpose as the types in live/types.ts.
 */
const ACTION_TITLES: Record<string, string> = {
  A01: 'Verify the alert',
  A02: 'Reconnoitre and assess safety',
  A03: 'Assess exposure of people and infrastructure',
  A04: 'Set the intervention plan and resources',
  A05: 'Keep monitoring and re-assess the plan',
};

/**
 * The actions panel for a real Deepfire detection — a different shape from ActionsCard's
 * on purpose, the same way LiveFireInfoCard departs from FireInfoCard. That one renders a
 * ranked list because the mock `AIAnalysis` contract carries one (spec.md §6.4); the real
 * contract (api/src/live/actionRecommendation.ts) deliberately proposes at most ONE
 * priority action, grounded only in what Deepfire actually gave us, plus optional
 * complementary ids with no invented urgency, ETA or resources attached to them.
 *
 * `status` decides the layout: "recommended" has an action to show, "insufficient_data"
 * says plainly what's missing instead of guessing, and "unavailable" means Nebius (or the
 * key) couldn't be reached — the summary already says so without pretending otherwise.
 */
export function LiveActionsCard({ recommendation }: { recommendation: ActionRecommendation }) {
  // `limitations` is deliberately not destructured: see the note further down.
  const { status, recommendedAction, complementaryActionIds, missingData } =
    recommendation;

  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Actions</SectionLabel>
        <span className="text-meta text-muted">AI proposal</span>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-body text-dim">{recommendation.summary}</p>

        {status === 'recommended' && recommendedAction && (
          <div>
            <p className="text-body font-medium text-text">{recommendedAction.title}</p>
            <p className="mt-1 text-body text-dim">{recommendedAction.reason}</p>
            {recommendedAction.evidence.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {recommendedAction.evidence.map((item, i) => (
                  <li key={i} className="flex gap-2 text-meta text-muted">
                    <span aria-hidden="true">▸</span>
                    <span>{item.explanation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {complementaryActionIds.length > 0 && (
          <div>
            <span className="block text-meta text-muted">Also consider</span>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {complementaryActionIds.map((id) => (
                <li
                  key={id}
                  className="rounded-sm border border-line bg-surface-2 px-2 py-1 text-meta text-dim"
                >
                  {ACTION_TITLES[id] ?? id}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/*
          What is missing, on one line and folded away.

          The model returns three blocks that say the same thing from three angles: the
          reasoning, `missingData`, and `limitations` — all of them variations on "there
          is not enough here". Rendered in full they filled the panel with the product
          apologising, and an operator reading under pressure pays for every repetition.

          So the count goes on one line and the detail opens on demand. `limitations` is
          dropped entirely: it is `missingData` restated in the negative, and whoever
          needs that nuance is not reading a map at 3am.
        */}
        {missingData.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-meta text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
              <span aria-hidden="true" className="inline-block w-3 group-open:rotate-90">
                ▸
              </span>
              {missingData.length} missing data point{missingData.length === 1 ? '' : 's'}
            </summary>
            <ul className="mt-1 flex flex-col gap-1 pl-3">
              {missingData.map((item, i) => (
                <li key={i} className="text-meta text-dim">
                  {item}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* No model attribution here — the contract deliberately never names which
          provider (or whether a fallback) produced this, see actionRecommendation.ts.
          Just the clock: `requiresHumanReview` is still true on the contract, but every
          card here is a proposal for a human to weigh, and saying so on each one spent a
          line repeating what the product already is. */}
      <footer className="p-4 text-meta text-muted">
        {clock(recommendation.generatedAt)}
      </footer>
    </Surface>
  );
}
