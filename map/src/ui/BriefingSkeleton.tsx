import { Surface } from './Surface';

/**
 * The situation briefing while the model is still writing it (UX.md §8).
 *
 * Same rule as ActionsSkeleton: the structure is on screen from the FIRST frame with
 * its gaps in a loading state, because a panel that takes a second to appear feels
 * broken and one that appears empty and fills in does not. Blocks the size of the final
 * content, never a spinner — nothing on this screen spins.
 *
 * The shape traced here is BriefingCard's and nothing else: the summary paragraph,
 * three concern lines behind the same ▸ gutter, and the clock footer.
 */

/** A block the size of a line of text. `w` is a Tailwind width class. */
function Line({ w, className = '' }: { w: string; className?: string }) {
  return <span className={`block h-3 rounded-sm bg-surface-2 ${w} ${className}`} />;
}

/** A line behind the same ▸ gutter the concerns list uses, so it lands in place. */
function ConcernLine({ w }: { w: string }) {
  return (
    <div className="flex gap-2">
      <span className="h-3 w-2 shrink-0 rounded-sm bg-surface-2" />
      <Line w={w} />
    </div>
  );
}

export function BriefingSkeleton() {
  return (
    <Surface padded={false} busy className="divide-y divide-line">
      {/* No header, because the card has none: the blocks start where its text will.
          Nothing announces the wait any more — grey blocks the shape of a paragraph
          already read as one being written. */}
      <div className="flex flex-col gap-3 p-4">
        {/* `summary`: 2-4 sentences, always present whatever the status. */}
        <div className="flex flex-col gap-1.5">
          <Line w="w-full" />
          <Line w="w-full" />
          <Line w="w-11/12" />
          <Line w="w-2/3" />
        </div>

        {/* `topConcerns`: at most three, one line each. */}
        <div className="flex flex-col gap-1.5">
          <ConcernLine w="w-full" />
          <ConcernLine w="w-5/6" />
          <ConcernLine w="w-2/3" />
        </div>
      </div>

      {/* The clock line: "2:14 pm". */}
      <footer className="p-4">
        <Line w="w-2/5" />
      </footer>
    </Surface>
  );
}
