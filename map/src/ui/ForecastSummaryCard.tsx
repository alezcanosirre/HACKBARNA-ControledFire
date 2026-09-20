import type { RiskAnalysis } from './RiskCard';
import { time } from './format';
import { SectionLabel, Surface } from './Surface';

/**
 * The forecast read whole, in PRED's overview column — the same card ACTUAL has for what
 * is burning, for what may start.
 *
 * Every other panel on this page answers "what about THIS cell", and to read one you
 * must already know which cell to click. This one answers the question before that: a
 * coordinator who walks in and needs to know whether the next 24 hours are a quiet
 * afternoon or a bad one.
 *
 * The text is the model's read of the whole risk area — the same `ignitionAnalysis` that
 * already rides in the forecast payload (api/src/live/ignitionAssessment.ts), which up
 * to now was only readable at the bottom of a cell's detail. So it costs no call of its
 * own and it cannot disagree with the numbers the map paints: it was written about them.
 *
 * There is no version of this card without a reading. When the model could not be
 * reached the forecast falls back to the hand-weighted formula, and then this panel does
 * not appear at all — a card whose whole content is an apology for having nothing to say
 * is worse than the space it takes. The map still paints the formula's cells and each
 * cell's own detail still says which of the two scored it (RiskCard), which is where
 * that distinction belongs.
 */
export function ForecastSummaryCard({
  analysis,
}: {
  /** Only ever rendered with a real reading — Shell holds the card back otherwise. */
  analysis: RiskAnalysis & { readonly summary: string };
}) {
  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Situation</SectionLabel>
        <span className="text-meta text-muted">AI briefing</span>
      </header>

      <div className="p-4">
        <p className="text-body text-dim">{analysis.summary}</p>
      </div>

      {/* Same footer as the other AI panels, and for the same reason: a reading for a
          human to weigh, never an instruction. The time is when this forecast was
          produced, which is what says how old the picture is. */}
      <footer className="p-4 text-meta text-muted">
        Requires human review · {time(analysis.generatedAt)}
      </footer>
    </Surface>
  );
}
