import type { SituationBriefing } from '../live/types';
import { clock } from './format';
import { SectionLabel, Surface } from './Surface';

/**
 * The situation briefing for the whole area, in the overview column on the right.
 *
 * Every other AI panel in this interface answers "what do I do about THIS fire", and to
 * read one you must already know which fire to click. This one answers the question
 * before that: a coordinator who has just walked in and needs the picture — everything
 * burning right now plus what the forecast says may start — in ten seconds.
 *
 * It sits under the triage card because the two are one reading in two steps: which
 * fires there are and which to go to first, then the paragraph that says why the
 * afternoon looks the way it does. Both belong to the overview, so both leave when a
 * fire is selected — with a selection open there is only that fire (UX.md §0, rule 2).
 *
 * It replaces BriefingSkeleton in place, so both trace the same shape.
 *
 * `status` decides what shows. "briefed" is the model's text. "quiet" is the no-fires
 * case, written server-side without ever calling Nebius — there is nothing to redact
 * when nothing is burning. "unavailable" means Nebius could not be reached, and the
 * summary says exactly that instead of dressing a failure up as a briefing.
 */
export function BriefingCard({ briefing }: { briefing: SituationBriefing }) {
  const { status, summary, topConcerns } = briefing;

  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Situation</SectionLabel>
        {/*
          Says which of the three this is, because they are not the same claim. Only the
          first one was written by a model, and the interface never lets the other two
          pass for it — same rule RiskCard follows when the heuristic is being served.
        */}
        <span className="text-meta text-muted">
          {status === 'briefed'
            ? 'AI briefing'
            : status === 'quiet'
              ? 'No AI needed'
              : 'Unavailable'}
        </span>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-body text-dim">{summary}</p>

        {/* Capped at three server-side. Same ▸ gutter the actions card's evidence uses:
            on this screen that mark means "and here is what it rests on". */}
        {topConcerns.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {topConcerns.map((concern, i) => (
              <li key={i} className="flex gap-2 text-meta text-muted">
                <span aria-hidden="true">▸</span>
                <span>{concern}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        Just the clock. The footer used to open with "Requires human review", and the
        contract's `requiresHumanReview` is still true — but every card on this screen
        is a proposal for a human to weigh, so stamping it on each one spent a line
        repeating what the product already is. What the line is actually for is the
        time: the poll cycle this was read from, not when the
        text was written — what matters is how old the DATA is, and a cached briefing
        keeps its text while that clock moves on.
      */}
      {status === 'briefed' && (
        <footer className="p-4 text-meta text-muted">{clock(briefing.observedAt)}</footer>
      )}
    </Surface>
  );
}
