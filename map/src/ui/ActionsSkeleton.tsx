import { SectionLabel, Surface } from './Surface';

/**
 * The actions card while the model is still writing it (UX.md §8).
 *
 * It opens with the structure already built and the gaps in a loading state, because a
 * panel that takes a second to appear feels broken and one that appears empty and fills
 * in does not. Blocks the size of the final content, never a spinner: nothing on this
 * screen spins.
 *
 * The heading says "Analysing…". This is the one place the interface is allowed to admit
 * it is thinking — the action list is the last thing to arrive because a model writes it.
 */

/** A block the size of a line of text. `w` is a Tailwind width class. */
function Line({ w }: { w: string }) {
  return <span className={`block h-3 rounded-sm bg-surface-2 ${w}`} />;
}

function Row() {
  return (
    <li className="flex gap-3 p-4">
      <span className="h-9 w-9 shrink-0 rounded-sm border border-line bg-surface-2" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Line w="w-3/4" />
        <Line w="w-1/2" />
        <div className="mt-1 flex flex-col gap-1.5">
          <Line w="w-full" />
          <Line w="w-5/6" />
        </div>
      </div>
    </li>
  );
}

export function ActionsSkeleton({ title = 'Actions' }: { title?: string }) {
  return (
    <Surface padded={false} busy className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>{title}</SectionLabel>
        {/* The only place allowed to say it is thinking. */}
        <span className="text-meta text-muted">Analysing…</span>
      </header>

      <ul className="divide-y divide-line">
        <Row />
        <Row />
      </ul>

      <footer className="p-4">
        <Line w="w-2/5" />
      </footer>
    </Surface>
  );
}
