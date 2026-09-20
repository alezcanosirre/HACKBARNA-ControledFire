import { useEffect, useState } from 'react';

import { analysisFor } from '../mocks/analysis.mock';
import { fireById } from '../mocks/fires.mock';
import type { Fire, Prediction } from '../mocks/types';
import type { LiveFireSummary } from '../live/types';
import { useFireActions } from '../live/useFireActions';
import { ActionsCard } from './ActionsCard';
import { ActionsSkeleton } from './ActionsSkeleton';
import { FireInfoCard } from './FireInfoCard';
import { LiveActionsCard } from './LiveActionsCard';
import { LiveFireInfoCard } from './LiveFireInfoCard';
import { Legend } from './Legend';
import { PrioritiesCard } from './PrioritiesCard';
import { RiskCard, type RiskAnalysis } from './RiskCard';
import { MENU_STORAGE_KEY, readCollapsed } from './menuStorage';
import { SideMenu } from './SideMenu';
import { Surface } from './Surface';
import { ArrowLeftIcon } from './icons';
import { clearSelection, type Route } from './route';

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
  liveFires,
  riskCells = 0,
  livePrediction,
  riskAnalysis,
  simulatedFire,
}: {
  route: Route;
  activeFires: number;
  /** Whether the Fire Engine is running. ACTUAL is live data; this is the other source. */
  simulating: boolean;
  onToggleSimulation: () => void;
  /** Real Deepfire detections clicked on the map — see live/types.ts LiveFireSummary. */
  liveFires?: readonly LiveFireSummary[];
  /** How many cells carry risk on PRED. Drives the empty state, nothing else. */
  riskCells?: number;
  /** Detail for a risk cell, from the backend. Nothing else feeds PRED. */
  livePrediction?: (cellId: string | null) => Prediction | null;
  /** The model's read of the whole risk area, shown under the cell's detail. */
  riskAnalysis?: RiskAnalysis;
  /** A SIMULATION case by id. Static data, so it is a plain lookup, not a hook. */
  simulatedFire?: (id: string | null) => { fire: Fire } | null;
}) {
  /*
   * Three things can be selected, and which one depends on the page. ACTUAL opens a
   * fire — mocked or a real Deepfire detection. PRED opens a cell, because risk is a
   * per-cell number and there is no incident to group (UX.md §7).
   */
  const onPred = route.page === 'pred';
  // A SIMULATION case first: it is the only source with a full incident to show.
  const fire = onPred
    ? null
    : (simulatedFire?.(route.selection)?.fire ?? fireById(route.selection));
  const liveFire =
    onPred || fire ? null : (liveFires?.find((f) => f.id === route.selection) ?? null);
  // No mock fallback: if the heuristic has nothing for this cell, there is nothing to
  // open. PRED only ever shows measured data — see App.tsx.
  const prediction = onPred ? (livePrediction?.(route.selection) ?? null) : null;
  const open = fire !== null || liveFire !== null || prediction !== null;

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
  // Either a mock Fire or a real LiveFireSummary — never both, route.selection matches
  // at most one of the two lookups above. `cellIds` only exists on the live shape, so
  // it doubles as the discriminant below instead of carrying a separate flag.
  const selected = fire ?? liveFire ?? prediction;
  const [shown, setShown] = useState(selected);
  // Entering is immediate and adjusted during render, not in an effect: waiting for an
  // effect would cost one frame with the panel empty.
  if (selected && selected !== shown) setShown(selected);
  useEffect(() => {
    if (selected) return;
    const timer = window.setTimeout(() => setShown(null), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [selected]);

  // `cellIds` only exists on a live detection and `risk_score` only on a prediction, so
  // the shapes discriminate themselves without carrying a separate kind flag.
  const shownIsLive = shown !== null && 'cellIds' in shown;
  const shownIsRisk = shown !== null && 'risk_score' in shown;
  // A SIMULATION case. It shares the mock `Fire` shape with the old demo fires, so the
  // id prefix is what tells them apart — only a case has a route on the backend.
  const shownIsSimulated =
    shown !== null && !shownIsLive && !shownIsRisk && shown.id.startsWith('sim-');

  /*
   * Both a real detection and an exercise case ask the backend for a recommendation, and
   * the case is the one that answers well: it carries terrain, spread and values at risk,
   * which is exactly what the model keeps listing as missing for a real detection. Same
   * prompt and same cache on the other side; the model tells them apart by `provenance`.
   */
  const { analysis: liveRecommendation, loading: liveLoading, error: liveError } = useFireActions(
    shownIsLive
      ? { kind: 'live', id: (shown as LiveFireSummary).id }
      : shownIsSimulated
        ? { kind: 'simulated', id: (shown as Fire).id }
        : null,
  );
  const wantsRecommendation = shownIsLive || shownIsSimulated;

  /*
   * PRED has no actions yet, and it shows none rather than mocked ones. What is left on
   * `analysis` are the old mock demo fires, which nothing selects any more now that
   * SIMULATION reads the cases — it stays for the few of them still reachable by URL.
   */
  const analysis = shown && !wantsRecommendation && !shownIsRisk ? analysisFor(shown.id) : null;

  // Esc deselects: it is the keyboard shortcut for the back button (UX.md §5 and §11).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
        page={route.page}
        className={`absolute top-4 right-4 z-10 transition-[opacity,transform] ${
          open ? 'pointer-events-none translate-x-8 opacity-0' : 'translate-x-0 opacity-100'
        }`}
      />

      {/*
        Never blank. A forecast with nothing above the threshold is good news and has to
        say so — an empty screen reads as a broken feed, which is the opposite message
        (UX.md §4). Sits right under the legend, same column, same side.
      */}
      {onPred && !open && riskCells === 0 && (
        <Surface
          as="aside"
          className={`absolute top-32 right-4 z-10 transition-[opacity,transform] ${
            open ? 'pointer-events-none translate-x-8 opacity-0' : 'translate-x-0 opacity-100'
          }`}
        >
          <p className="text-label text-text">No significant risk</p>
          <p className="mt-1 text-meta text-muted">
            Nothing above 25% in the next 24 h
          </p>
        </Surface>
      )}

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
            {shownIsLive ? (
              <LiveFireInfoCard fire={shown as LiveFireSummary} />
            ) : shownIsRisk ? (
              <RiskCard prediction={shown as Prediction} analysis={riskAnalysis} />
            ) : (
              shown && <FireInfoCard fire={shown as Fire} />
            )}
          </div>

          {/* Right column, 360px: actions on top, priorities below. */}
          <div
            inert={!open || undefined}
            className={`absolute top-4 right-4 bottom-4 z-20 flex w-90 flex-col gap-4 overflow-y-auto transition-[opacity,transform] ${
              open ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
            }`}
          >
            {/*
              The card is there from the first frame, with its gaps in a loading state
              (UX.md §8). It used to be a line of text that appeared where the card would
              later be, which reads as an error message rather than as work in progress.
            */}
            {wantsRecommendation && liveLoading && <ActionsSkeleton />}
            {wantsRecommendation && liveError && (
              <p className="p-4 text-meta text-muted">Could not get AI actions: {liveError}</p>
            )}
            {wantsRecommendation && liveRecommendation && (
              <LiveActionsCard recommendation={liveRecommendation} />
            )}
            {/* The old ranked-list card, for the mock demo fires that predate all of
                this. Real detections and exercise cases both use LiveActionsCard above. */}
            {!wantsRecommendation && analysis && (
              <>
                <ActionsCard
                  analysis={analysis}
                  title={shownIsRisk ? 'Preventive actions' : 'Actions'}
                />
                {/* No priorities card on PRED: with risk there is no front to attack in
                    order (UX.md §7). */}
                {!shownIsRisk && <PrioritiesCard fire={shown as Fire} analysis={analysis} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
