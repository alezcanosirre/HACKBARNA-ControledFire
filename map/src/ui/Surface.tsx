import type { ReactNode } from 'react';

/**
 * The standard floating surface of UX.md §2. Every card in the interface is this box:
 *
 *   background   surface at 92% + backdrop-blur   (the map shows through: it floats)
 *   border       1px line
 *   radius       5px
 *   shadow       none (DESIGN.md §4)
 *
 * The `backdrop-blur` replaces the shadow the system forbids: it is what makes a card
 * read as something resting on top of the map rather than a hole cut out of it.
 *
 * `pointer-events-auto` belongs here, not on the container: the UI layer is transparent
 * to clicks and each card takes back the ones over it. Without this the map's picking
 * stops working in the empty areas, and it looks like a map bug when it is a CSS one.
 */
export function Surface({
  as: Tag = 'section',
  className = '',
  padded = true,
  children,
}: {
  as?: 'section' | 'aside' | 'nav' | 'div';
  className?: string;
  /** False for cards that separate their blocks with a full-bleed 1px rule. */
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`pointer-events-auto rounded-md border border-line bg-surface/92 backdrop-blur-sm ${
        padded ? 'p-4' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Section label: `label` in --muted. Capitals are never forced (DESIGN.md §2). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-label font-medium text-muted">{children}</h2>;
}
