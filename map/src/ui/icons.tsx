/**
 * Iconos monocromos, siempre en `currentColor`. Nada de emoji: 🔥 es naranja y los
 * cálidos son dato del mapa, no interfaz (DESIGN.md §1, UX.md §0 regla 3). Las
 * pizarras los dibujan como emoji porque son bocetos.
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

/** Flecha de volver. También sirve de chevron: se gira con una clase. */
export function ArrowLeftIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M16 10H4.5M9 4.5 3.5 10 9 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Contraer el menú: la barra y la flecha que entra en ella. */
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

/** Marca de lo que está a sotavento. Triángulo de aviso, sin relleno y sin rojo. */
export function DownwindIcon({ className = 'h-4 w-4 shrink-0' }: Props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M8 2.5 15 14H1L8 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 6.5v3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="11.8" r=".7" fill="currentColor" />
    </svg>
  );
}
