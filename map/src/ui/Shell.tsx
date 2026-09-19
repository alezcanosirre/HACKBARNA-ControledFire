import { useEffect, useState } from 'react';

import { analysisFor } from '../mocks/analysis.mock';
import { fireById } from '../mocks/fires.mock';
import { ActionsCard } from './ActionsCard';
import { FireInfoCard } from './FireInfoCard';
import { Legend } from './Legend';
import { PrioritiesCard } from './PrioritiesCard';
import { MENU_STORAGE_KEY, readCollapsed } from './menuStorage';
import { SideMenu } from './SideMenu';
import { ArrowLeftIcon } from './icons';
import { clearSelection, type Route } from './route';

/** The subset of the Engine's state the detail panel can actually use. */
export interface LiveFire {
  areaHa: number;
  minutes: number;
  burningCells: number;
  weather: { temp_c: number; humidity_pct: number; wind_speed_kmh: number; wind_dir_deg: number };
}

/** DESIGN.md §5. A single motion token for the whole interface. */
const DURATION_MS = 400;

/**
 * The floating layer of UX.md §2. Everything in here is `absolute` over the map, and
 * the container carries `pointer-events-none`: each card takes the clicks that land on
 * it and the rest of the screen is still map. Without this the UI eats the picking in
 * the empty areas, and it looks like a map bug when it is a CSS one.
 *
 *   z-30  back arrow
 *   z-20  side menu / detail cards
 *   z-10  legend
 *   z-0   map (outside this component)
 */
export function Shell({
  route,
  activeFires,
  simulating,
  onToggleSimulation,
  live,
}: {
  route: Route;
  activeFires: number;
  /** Whether the Fire Engine is running. ACTUAL is live data; this is the other source. */
  simulating: boolean;
  onToggleSimulation: () => void;
  /**
   * What the Engine knows, passed straight down to the information card. Everything
   * else in the detail panel is still mocked — the Engine has no place names, no
   * detection source and no population at risk. See FireInfoCard.
   */
  live?: LiveFire;
}) {
  const fire = fireById(route.selection);
  const open = fire !== null;

  /*
   * The legend needs the menu's width too, so it can step aside instead of sitting
   * underneath. That is why this state lives here and not inside SideMenu.
   */
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    try {
      window.localStorage.setItem(MENU_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Private browsing or full storage: the preference is lost and that is all.
    }
  }, [collapsed]);

  /*
   * The detail stays mounted for 400 ms after deselecting so the exit can be seen. If
   * it unmounted at once, the cards would vanish in a blink while the menu slides back
   * in slowly, and the transition would be left half done.
   *
   * On the way out the columns get `inert` and nothing else. NOT `aria-hidden`: the
   * back button holds focus at the moment it is pressed, and hiding a focused element's
   * ancestor from assistive technology is blocked by the browser. `inert` already does
   * both jobs — it removes the subtree from the accessibility tree and drops the focus.
   */
  const [shown, setShown] = useState(fire);
  // Entering is immediate and adjusted during render, not in an effect: waiting for an
  // effect would cost one frame with the panel empty.
  if (fire && fire !== shown) setShown(fire);
  useEffect(() => {
    if (fire) return;
    const timer = window.setTimeout(() => setShown(null), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [fire]);

  // Esc deselects: it is the keyboard shortcut for the back button (UX.md §5 and §11).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const analysis = shown ? analysisFor(shown.id) : null;

  return (
    <div className="pointer-events-none absolute inset-0 text-text">
      <SideMenu
        page={route.page}
        hidden={open}
        activeFires={activeFires}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        simulating={simulating}
        onToggleSimulation={onToggleSimulation}
      />

      {/* Top right, opposite the menu, so neither one has to dodge the other: the
          legend no longer depends on how wide the menu is.
          It withdraws with the menu — while a fire is open there is only that fire
          (UX.md §0, rule 2) — and it leaves to its own side, which is where the actions
          column comes in. */}
      <Legend
        className={`absolute top-4 right-4 z-10 transition-[opacity,transform] ${
          open ? 'pointer-events-none translate-x-8 opacity-0' : 'translate-x-0 opacity-100'
        }`}
      />

      {shown && (
        <>
          {/* Left column, 360px: back at the very top, information underneath. */}
          <div
            inert={!open || undefined}
            className={`absolute top-4 bottom-4 left-4 z-20 flex w-90 flex-col gap-4 overflow-y-auto transition-[opacity,transform] ${
              open ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
            }`}
          >
            <div className="z-30 flex">
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Back to overview"
                className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border border-line bg-surface/92 text-muted backdrop-blur-sm transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              >
                <ArrowLeftIcon />
              </button>
            </div>
            <FireInfoCard fire={shown} live={live} />
          </div>

          {/* Right column, 360px: actions on top, priorities below. */}
          <div
            inert={!open || undefined}
            className={`absolute top-4 right-4 bottom-4 z-20 flex w-90 flex-col gap-4 overflow-y-auto transition-[opacity,transform] ${
              open ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
            }`}
          >
            {analysis && (
              <>
                <ActionsCard analysis={analysis} />
                <PrioritiesCard fire={shown} analysis={analysis} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
