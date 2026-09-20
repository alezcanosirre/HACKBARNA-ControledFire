import { SectionLabel, Surface } from './Surface';

/**
 * The triage card while the model is still ordering it (UX.md §8).
 *
 * Same rule as ActionsSkeleton: the structure opens complete with its gaps in a loading
 * state, because a panel that takes a second to appear feels broken and one that appears
 * empty and fills in does not. Blocks the size of the final content, never a spinner —
 * nothing on this screen spins.
 *
 * The shape traced here is TriageCard's row for row: rank gutter, the incident's
 * coordinates, and two lines of reason clamped to the same height. It has to be, or the
 * swap-in jumps — which is the one thing a skeleton exists to prevent.
 *
 * It only ever stands in for a list of two or more: with a single incident there is
 * nothing to order and Shell renders none of this (see useTriage).
 */

/** A block the size of a line of text. `w` is a Tailwind width class. */
function Line({ w, className = '' }: { w: string; className?: string }) {
  return <span className={`block h-3 rounded-sm bg-surface-2 ${w} ${className}`} />;
}

/** One row, the exact height of a real one: rank, coordinates, two lines of reason. */
function Row({ reason }: { reason: [string, string] }) {
  return (
    <li className="flex items-start gap-3 p-4">
      {/* Sits where the rank number will, and the same width. */}
      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-sm bg-surface-2" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Line w="w-2/5" className="h-3.5" />
        <Line w={reason[0]} />
        <Line w={reason[1]} />
      </span>
    </li>
  );
}

export function TriageSkeleton() {
  return (
    <Surface padded={false} busy className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Where to go first</SectionLabel>
        {/* Same admission ActionsSkeleton is allowed: the order is last to arrive
            because a model writes it. */}
        <span className="text-meta text-muted">Ordering…</span>
      </header>

      {/*
        Three rows. Two is the minimum this card ever shows and three is the common case
        on a bad afternoon; three rows of grey that resolve into two is a card that
        shrinks by one row, which is a smaller lie than a card that grows by one.
      */}
      <ul>
        <Row reason={['w-full', 'w-3/4']} />
        <Row reason={['w-11/12', 'w-2/3']} />
        <Row reason={['w-full', 'w-1/2']} />
      </ul>

      {/* The clock line: "2:14 pm". */}
      <footer className="p-4">
        <Line w="w-2/5" />
      </footer>
    </Surface>
  );
}
