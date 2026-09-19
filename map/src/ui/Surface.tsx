import type { ReactNode } from 'react';

/**
 * La superficie flotante estándar de UX.md §2. Todas las tarjetas de la interfaz son
 * esta caja:
 *
 *   fondo    night-800 al 92% + backdrop-blur   (se intuye el mapa detrás: flota)
 *   borde    1px night-700
 *   radio    5px
 *   sombra   ninguna (DESIGN.md §4)
 *
 * El `backdrop-blur` sustituye a la sombra que el sistema prohíbe: es lo que hace que
 * se lea como algo posado encima del mapa y no como un recorte.
 *
 * `pointer-events-auto` va aquí, no en el contenedor: la capa de UI es transparente a
 * los clics y cada tarjeta se los vuelve a quedar. Sin esto el picking del mapa deja
 * de funcionar en las zonas vacías, y parece un fallo del mapa cuando es de CSS.
 */
export function Surface({
  as: Tag = 'section',
  className = '',
  padded = true,
  children,
}: {
  as?: 'section' | 'aside' | 'nav' | 'div';
  className?: string;
  /** A false para tarjetas que separan sus bloques con línea de 1px a sangre. */
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`pointer-events-auto rounded-md border border-night-700 bg-night-800/92 backdrop-blur-sm ${
        padded ? 'p-4' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Rótulo de sección: `label` en --muted. No se fuerzan las mayúsculas (DESIGN.md §2). */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-label font-medium text-muted">{children}</h2>;
}
