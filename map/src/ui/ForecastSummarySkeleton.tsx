import { SectionLabel, Surface } from './Surface';

/**
 * The forecast summary while its source is still answering (UX.md §8).
 *
 * Same rule as every other skeleton here: the structure is on screen from the FIRST
 * frame with its gaps in a loading state, blocks the size of the final content, never a
 * spinner. The wait is not the same on both sides — the measured forecast rides on the
 * feed the map already polls, so it usually arrives at once, while the exercise fetches
 * and scores its own cells (/api/simulated-risk) and needs a model call to answer.
 * Nothing waits for either: the map, the menu and clicking a cell are live throughout.
 *
 * The shape traced here is ForecastSummaryCard's: header, the paragraph, the footer.
 */

/** A block the size of a line of text. `w` is a Tailwind width class. */
function Line({ w }: { w: string }) {
  return <span className={`block h-3 rounded-sm bg-surface-2 ${w}`} />;
}

export function ForecastSummarySkeleton() {
  return (
    <Surface padded={false} busy className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Situation</SectionLabel>
        {/* The one place this card is allowed to admit it is thinking. Sits where
            "AI briefing" will. */}
        <span className="text-meta text-muted">Reading…</span>
      </header>

      {/* `summary`: 2-4 sentences, the whole body of the card. */}
      <div className="flex flex-col gap-1.5 p-4">
        <Line w="w-full" />
        <Line w="w-full" />
        <Line w="w-11/12" />
        <Line w="w-full" />
        <Line w="w-2/3" />
      </div>

      {/* "Requires human review · HH:MM" */}
      <footer className="p-4">
        <Line w="w-2/5" />
      </footer>
    </Surface>
  );
}
