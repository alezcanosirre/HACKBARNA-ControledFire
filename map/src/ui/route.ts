import { useSyncExternalStore } from 'react';

/**
 * The state machine of UX.md §1, with the state in the URL so a reload does not lose
 * the operator's place and so the demo can jump straight to a given point if something
 * goes wrong.
 *
 *   /actual            at rest
 *   /actual/:id        fire selected
 *   /pred              at rest
 *   /pred/:id          cell selected
 *
 * What `id` means depends on the page, and that is not sloppiness. On ACTUAL it is the
 * FIRE: the Engine carries a single `fire` projection and the map groups contiguous
 * cells into one incident, so selecting a cell selects the whole thing. On PRED it is
 * the CELL: risk is a per-cell number, there is no incident to group.
 *
 * Hard rule: with a selection open you do NOT change page. It holds by itself here,
 * because the only place to navigate between pages is the menu and the menu does not
 * exist while there is a selection (UX.md §0, rule 2). `go()` enforces it again in
 * case someone types the URL by hand.
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
  const selection = rawSelection ? decodeURIComponent(rawSelection) : null;
  return { page, selection };
}

export function toPath(route: Route): string {
  return route.selection
    ? `/${route.page}/${encodeURIComponent(route.selection)}`
    : `/${route.page}`;
}

// The state is cached: useSyncExternalStore requires getSnapshot to return the SAME
// reference while nothing changes, or React re-renders forever.
let current: Route = typeof window === 'undefined' ? HOME : parse(window.location.pathname);
const listeners = new Set<() => void>();

function publish(next: Route) {
  if (next.page === current.page && next.selection === current.selection) return;
  current = next;
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => publish(parse(window.location.pathname)));
  // Normalises `/` and any odd route to its canonical form without leaving a trace in
  // history: entering the application is not a step to go back from.
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

/** Navigate. With no selection the page changes; with a selection open, it does not. */
export function go(next: Route) {
  const target: Route =
    next.page !== current.page && current.selection !== null ? current : next;
  const path = toPath(target);
  if (path !== window.location.pathname) window.history.pushState(null, '', path);
  publish(target);
}

export const openSelection = (id: string) => go({ page: current.page, selection: id });

/** The back button and `Esc`: they switch the selection off, they are not browser back. */
export const clearSelection = () => go({ page: current.page, selection: null });

export const goToPage = (page: Page) => go({ page, selection: null });
