import { SectionLabel, Surface } from './Surface';

/**
 * The actions card while the model is still writing it (UX.md §8).
 *
 * It opens with the structure already built and the gaps in a loading state, because a
 * panel that takes a second to appear feels broken and one that appears empty and fills
 * in does not. Blocks the size of the final content, never a spinner: nothing on this
 * screen spins.
 *
 * The shape traced here is LiveActionsCard's, which is the only card this ever stands in
 * for — summary, ONE priority action with its reasoning and evidence, complementary
 * chips, footer. Not ActionsCard's ranked list: the real contract proposes at most one
 * action (api/src/live/actionRecommendation.ts), so a skeleton of stacked rows with
 * icons promised a list that never arrives and made the swap-in jump.
 *
 * The heading says "Analysing…". This is the one place the interface is allowed to admit
 * it is thinking — the action is the last thing to arrive because a model writes it.
 */

/** A block the size of a line of text. `w` is a Tailwind width class. */
function Line({ w, className = '' }: { w: string; className?: string }) {
  return <span className={`block h-3 rounded-sm bg-surface-2 ${w} ${className}`} />;
}

/** A line prefixed by the same ▸ gutter the evidence list uses, so it lands in place. */
function EvidenceLine({ w }: { w: string }) {
  return (
    <div className="flex gap-2">
      <span className="h-3 w-2 shrink-0 rounded-sm bg-surface-2" />
      <Line w={w} />
    </div>
  );
}

export function ActionsSkeleton({ title = 'Actions' }: { title?: string }) {
  return (
    <Surface padded={false} busy className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>{title}</SectionLabel>
        {/* The only place allowed to say it is thinking. Sits where "AI proposal" will. */}
        <span className="text-meta text-muted">Analysing…</span>
      </header>

      <div className="flex flex-col gap-3 p-4">
        {/* `summary`: a short paragraph, always present whatever the status. */}
        <div className="flex flex-col gap-1.5">
          <Line w="w-full" />
          <Line w="w-11/12" />
          <Line w="w-2/3" />
        </div>

        {/* The priority action: title, reasoning, two lines of evidence. */}
        <div className="flex flex-col gap-1.5">
          <Line w="w-3/5" className="h-3.5" />
          <Line w="w-full" />
          <Line w="w-4/5" />
          <div className="mt-1 flex flex-col gap-1.5">
            <EvidenceLine w="w-5/6" />
            <EvidenceLine w="w-2/3" />
          </div>
        </div>

        {/* "Also consider": bare ids rendered as chips, so blocks the size of chips. */}
        <div className="flex flex-col gap-1.5">
          <Line w="w-24" />
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <span className="h-6 w-32 rounded-sm border border-line bg-surface-2" />
            <span className="h-6 w-40 rounded-sm border border-line bg-surface-2" />
          </div>
        </div>
      </div>

      {/* The clock line: "2:14 pm". */}
      <footer className="p-4">
        <Line w="w-2/5" />
      </footer>
    </Surface>
  );
}
