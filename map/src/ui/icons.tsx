/**
 * Monochrome icons, always in `currentColor`. No emoji: 🔥 is orange, and warm colours
 * are map data, not interface (DESIGN.md §1, UX.md §0 rule 3). The whiteboards draw
 * them as emoji because they are sketches.
 */

type Props = { className?: string };

const base = 'h-5 w-5 shrink-0';

export function FlameIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10 2.5c.4 2.6-1 3.6-2.2 4.8C6.3 8.7 5.5 10 5.5 11.7a4.5 4.5 0 0 0 9 0c0-2.2-1.2-3.6-2.4-5-.3 1-.9 1.6-1.6 2 .4-2.3-.2-4.4-.5-6.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ForecastIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 15.5 7.5 10l3 3L17 5.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.5 5.5H17V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlayIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M6.5 4.5 15 10l-8.5 5.5V4.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** Back arrow. It doubles as a chevron: rotate it with a class. */
export function ArrowLeftIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M16 10H4.5M9 4.5 3.5 10 9 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Collapse the menu: the bar and the arrow going into it. */
export function CollapseIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M3 4v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 10H7.5M11 6l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExpandIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M17 4v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 10h9.5M9 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className = 'h-4 w-4 shrink-0' }: Props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrossIcon({ className = 'h-4 w-4 shrink-0' }: Props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Mark for whatever sits downwind. Warning triangle, unfilled and never red. */
export function DownwindIcon({ className = 'h-4 w-4 shrink-0' }: Props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M8 2.5 15 14H1L8 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 6.5v3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="11.8" r=".7" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Action types. One glyph per catalogue entry, so a row is recognisable before
// it is read. Geometric and monochrome: the reference design uses colour emoji
// and those are warm, which is map data and never interface (DESIGN.md §1).
// ---------------------------------------------------------------------------

export function ClockIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <circle cx="10" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 7v3.5l2.3 1.4M8 2.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Ground crew: a helmet. Reads as a person without drawing one. */
export function CrewIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M4 12.5a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M2.5 12.5h15M10 6.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6.5 15.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function HelicopterIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M3 4.5h14M10 4.5v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="5" y="7" width="8" height="5.5" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M13 9.75h4M15.5 9.75v4M12 15.5h-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function PlaneIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10 2.5c.9 0 1.5 1.3 1.5 3v2.3l5.5 3.2v1.7L11.5 11v3l2 1.4v1.3L10 16l-3.5.7v-1.3l2-1.4v-3l-5.5 1.7v-1.7L8.5 7.8V5.5c0-1.7.6-3 1.5-3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DroneIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <rect x="7.5" y="7.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.6 7.6 5.8 5.8M12.4 7.6l1.8-1.8M7.6 12.4l-1.8 1.8M12.4 12.4l1.8 1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="4.4" cy="4.4" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="15.6" cy="4.4" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4.4" cy="15.6" r="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="15.6" cy="15.6" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** Evacuation: a doorway and someone leaving through it. */
export function EvacuateIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M11.5 3.5h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9 10H2.5M5.5 6.5 2 10l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Firebreak: the strip of ground cleared so the fire finds nothing to burn. */
export function FirebreakIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M2.5 6.5h15M2.5 13.5h15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d="M4.5 10h2.2M8.9 10h2.2M13.3 10h2.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
