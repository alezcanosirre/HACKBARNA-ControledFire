import { useSyncExternalStore } from 'react';

/**
 * La máquina de estados de UX.md §1, con el estado en la URL para que recargar no
 * pierda el sitio y para poder saltar la demo a un punto concreto si algo falla.
 *
 *   /actual            reposo
 *   /actual/:id        celda seleccionada
 *   /pred              reposo
 *
 * `id` es el identificador del FOCO, no el de la celda: el mapa agrupa las celdas
 * contiguas en un incidente (src/map/grid.ts) y seleccionar una celda selecciona su
 * foco entero. UX.md §1 lo escribe como `:cellId`; el concepto es el mismo, lo que
 * se abre es el incidente.
 *
 * Regla dura: con una selección abierta NO se cambia de página. Aquí se cumple sola
 * porque el único sitio desde el que se navega entre páginas es el menú, y el menú no
 * existe mientras hay selección (UX.md §0, regla 2). `go()` la vuelve a imponer por si
 * alguien escribe la URL a mano.
 */

export type Page = 'actual' | 'pred';

export interface Route {
  readonly page: Page;
  readonly selection: string | null;
}

const HOME: Route = { page: 'actual', selection: null };

function parse(pathname: string): Route {
  const [rawPage, rawSelection] = pathname.replace(/^\/+|\/+$/g, '').split('/');
  const page: Page = rawPage === 'pred' ? 'pred' : 'actual';
  // La selección solo tiene panel en ACTUAL (UX.md §5). La de PRED es §7 y todavía
  // no está construida, así que una URL /pred/algo se lee como PRED en reposo.
  const selection = page === 'actual' && rawSelection ? decodeURIComponent(rawSelection) : null;
  return { page, selection };
}

export function toPath(route: Route): string {
  return route.selection
    ? `/${route.page}/${encodeURIComponent(route.selection)}`
    : `/${route.page}`;
}

// El estado se cachea: useSyncExternalStore exige que getSnapshot devuelva la MISMA
// referencia mientras nada cambie, o React vuelve a renderizar sin parar.
let current: Route = typeof window === 'undefined' ? HOME : parse(window.location.pathname);
const listeners = new Set<() => void>();

function publish(next: Route) {
  if (next.page === current.page && next.selection === current.selection) return;
  current = next;
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => publish(parse(window.location.pathname)));
  // Normaliza `/` y cualquier ruta rara a su forma canónica sin dejar rastro en el
  // historial: entrar en la aplicación no es un paso atrás.
  const canonical = toPath(current);
  if (window.location.pathname !== canonical) {
    window.history.replaceState(null, '', canonical);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => HOME,
  );
}

/** Navega. Sin selección se cambia de página; con selección abierta, no. */
export function go(next: Route) {
  const target: Route =
    next.page !== current.page && current.selection !== null ? current : next;
  const path = toPath(target);
  if (path !== window.location.pathname) window.history.pushState(null, '', path);
  publish(target);
}

export function openSelection(id: string) {
  // Solo ACTUAL tiene panel de detalle (UX.md §5). En PRED es §7 y no está construida.
  if (current.page !== 'actual') return;
  go({ page: 'actual', selection: id });
}

/** El botón de volver y `Esc`: apagan la selección, no son el «atrás» del navegador. */
export const clearSelection = () => go({ page: current.page, selection: null });

export const goToPage = (page: Page) => go({ page, selection: null });
