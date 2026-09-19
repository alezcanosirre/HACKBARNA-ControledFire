import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { FlyToInterpolator, type MapViewState } from '@deck.gl/core';
import { QuadkeyLayer } from '@deck.gl/geo-layers';
import { BASEMAP, FOCUS_MS, VIEW_RMB } from './map/constants';
import { PRED_CELLS, type Cell } from './map/grid';
import { STATUS_FILL, STATUS_STROKE, pulsed } from './map/colors';
import { usePulse } from './map/pulse';
import { clampToArea, focusOn } from './map/view';
import type { CellState } from '../../api/src/types';
import { SIM_FIRE_ID, useSimulation } from './engine/useSimulation';
import { useLiveFireState } from './live/useLiveFireState';
import { LIVE_FILL, LIVE_STROKE, statusFromLiveCells } from './live/liveFires';
import { quadkeysForH3Cells } from './live/h3ToQuadkey';
import { Shell } from './ui/Shell';
import { clearSelection, openSelection, useRoute } from './ui/route';

/**
 * Framing when a fire is selected. Two corrections over the raw fit:
 *
 * 1. With a fire open, the usable map is NOT the whole window: the two 360px columns
 *    cover the sides. The fit is computed against the corridor in the middle, so the
 *    fire ends up centred and whole between the two cards instead of underneath them.
 * 2. A zoom cap of our own, lower than the map's. A flare-up does not have to fill the
 *    screen: what is needed is to see WHERE it is, and for that the surrounding context
 *    is worth more than the detail of the fire itself.
 */
const PANEL_W = 360;
const PANEL_MARGIN = 16;
const FOCUS_ZOOM_CAP = 12;

/**
 * Data colours for the states the Engine has and src/map/colors.ts does not paint yet
 * (it only covers NORMAL and BURNING). They follow spec.md §4.7: BURNED reuses the
 * `contained` grey, because a burnt-out cell is no longer urgent, and PROTECTED takes
 * the cool `watch` blue — the one piece of good news on the map, and therefore never
 * warm. They live here and not in src/map/, which belongs to the other session.
 */
const BURNED_FILL: [number, number, number, number] = [122, 122, 138, 90];
const BURNED_STROKE: [number, number, number, number] = [160, 160, 175, 130];
const PROTECTED_FILL: [number, number, number, number] = [96, 165, 250, 70];
const PROTECTED_STROKE: [number, number, number, number] = [147, 197, 253, 130];

/**
 * The burning fill, modulated by the Engine's per-cell intensity (0-1). Only the alpha
 * moves: the hue stays the `active` red of spec.md §4.7, so a hot cell and a dying one
 * still read as the same thing at different strengths.
 */
function intensityFill(intensity: number): [number, number, number, number] {
  const [r, g, b, a] = STATUS_FILL.BURNING;
  return [r, g, b, Math.round(a * (0.55 + Math.min(1, Math.max(0, intensity)) * 0.45))];
}

export default function App() {
  // The camera is controlled: every movement goes through clampToArea before being
  // applied, so the operator cannot leave the RMB or zoom out below MIN_ZOOM.
  const [viewState, setViewState] = useState<MapViewState>(VIEW_RMB);
  // Clamping needs to know how much screen there is. deck.gl measures it and reports
  // it in onResize; kept in a ref because it should not cause a re-render by itself.
  const size = useRef({ width: 0, height: 0 });
  // deck.gl measures after the first render. Without this signal, entering through a
  // URL with a fire (`/actual/fire-3`) left the panel open and the camera where it was:
  // the framing effect ran with 0x0 and gave up. See onResize.
  const [measured, setMeasured] = useState(false);

  // The selection is not this component's state: it lives in the URL (UX.md §1). That
  // way a reload does not lose the place, the back button and Esc come in through the
  // same door as a click, and the demo can jump to a given fire if something fails.
  const route = useRoute();
  // What gets selected is the FIRE, not the cell: a fire is one incident, and all its
  // contiguous cells are the same thing. The Engine agrees — `SimulationState.fire` is
  // a single projection, not a list — so there is exactly one id to select.
  const selectedFire = route.page === 'actual' ? route.selection : null;

  /*
   * Two sources, and they are not the same kind of thing.
   *
   * ACTUAL shows what is really burning: the Deepfire feed, polled through the local
   * proxy (api/src/live/server.ts, started with `npm run live` inside api/). Its cells
   * are H3 res-8, which is why they get their own layer instead of the quadkey one.
   *
   * SIMULATION runs the Fire Engine. It stays stopped until someone presses the button:
   * invented fire must never appear on a screen whose claim is that its fire is real.
   */
  const live = useLiveFireState();
  const [simulating, setSimulating] = useState(false);
  const sim = useSimulation(simulating);

  /*
   * Deepfire answers in H3; this map is drawn on quadkeys. The conversion happens right
   * here at the edge (see live/h3ToQuadkey.ts) so that from this line on there is one
   * grid on the screen and not two — a hexagon over a square lattice reads as a
   * rendering bug, not as a second data source.
   */
  const liveStatus = useMemo(() => {
    const active = quadkeysForH3Cells(live.data?.activeCellIds ?? []);
    const risk = quadkeysForH3Cells(live.data?.riskCellIds ?? []);
    return statusFromLiveCells(active, risk);
  }, [live.data]);

  // Only the cells that have something to say. The full mesh is never generated at this
  // resolution — see spec.md §4.2: detail exists around a fire, not across the region.
  const liveCells = useMemo(
    () => [...liveStatus.keys()].map((cell_id) => ({ cell_id })),
    [liveStatus],
  );

  // Pulse of the burning cells. See spec.md §4.8.
  const tick = usePulse(sim.onFire);

  // What was selected in the previous render. Needed to tell "I just deselected" from
  // "I arrived with nothing selected": the first has to return to the starting framing
  // and the second is already there.
  const previousFire = useRef<string | null>(selectedFire);

  /**
   * Selecting a fire frames the camera on it. It is the confirmation that the click
   * landed where the operator thought: the screen moves to the place.
   *
   * And deselecting undoes the trip: the camera returns to VIEW_RMB, the same framing
   * the page starts with. Going back has to give the whole screen back, not just close
   * the cards and leave the operator wherever the last fire left them.
   *
   * It lives in an effect on the route and not in the click handler because a selection
   * can also arrive from history or from a pasted URL, and in those two cases the
   * camera has to move just the same.
   */
  useEffect(() => {
    const leaving = previousFire.current;
    previousFire.current = selectedFire;

    const target = selectedFire === SIM_FIRE_ID ? sim.fireBounds : null;
    if (!target) {
      // Arriving with no selection moves nothing: VIEW_RMB is where it starts.
      if (!leaving) return;
      setViewState({
        ...VIEW_RMB,
        transitionDuration: FOCUS_MS,
        transitionInterpolator: new FlyToInterpolator(),
      } as MapViewState);
      return;
    }

    const { width, height } = size.current;
    // deck.gl has not measured yet: framing with 0x0 would give a meaningless zoom.
    if (!width || !height) return;

    // Free width between the two columns. The width/3 floor is for narrow windows,
    // where the cards eat almost everything and the corridor would come out negative.
    const corridor = Math.max(width - 2 * (PANEL_W + 2 * PANEL_MARGIN), width / 3);

    // Functional update: the effect does not depend on viewState, so its closure would
    // be carrying a stale one.
    setViewState((prev) => {
      // focusOn centres on the fire and fits the zoom to whatever width it is given;
      // with the corridor's, the fit comes out a step further than with the full window.
      const framed = focusOn(target, prev, corridor, height);
      // The re-clamp uses the REAL width: focusOn clamped against the corridor, which
      // is not the screen, and would let terrain outside Catalonia show at the sides.
      return {
        ...clampToArea(
          { ...framed, zoom: Math.min(framed.zoom ?? FOCUS_ZOOM_CAP, FOCUS_ZOOM_CAP) },
          width,
          height,
        ),
        transitionDuration: FOCUS_MS,
        transitionInterpolator: new FlyToInterpolator(),
      } as MapViewState;
    });
    // sim.fireBounds is read but deliberately NOT a dependency: it changes on every
    // Engine tick and the camera would chase the fire as it grows, which is unusable.
    // Framing happens when the selection changes, and then the operator is in control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFire, measured]);

  const layers = useMemo(
    () => [
      // Reference grid at z15, the whole working area. No status, no fill, no picking:
      // it is there to give the simulated block a lattice to sit on, nothing else.
      new QuadkeyLayer<Cell>({
        id: 'cells-grid',
        data: PRED_CELLS,
        getQuadkey: (d) => d.cell_id,
        getFillColor: STATUS_FILL.NORMAL,
        getLineColor: STATUS_STROKE.NORMAL,
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: false,
      }),
      // The live Deepfire feed: what is burning right now, and what its spread
      // projection puts at risk. Arrives as H3 res-8 and is rasterised onto this grid
      // before it gets here.
      new QuadkeyLayer<Cell>({
        id: 'live-fire',
        data: liveCells,
        getQuadkey: (d) => d.cell_id,
        getFillColor: (d) => LIVE_FILL[liveStatus.get(d.cell_id) ?? 'risk'],
        getLineColor: (d) => LIVE_STROKE[liveStatus.get(d.cell_id) ?? 'risk'],
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: false,
        updateTriggers: { getFillColor: [liveStatus], getLineColor: [liveStatus] },
      }),
      // The scar: cells the fire has already gone through. Painted under the flames,
      // unlit and not pulsing — it is where the fire HAS been, not where it is.
      new QuadkeyLayer<CellState>({
        id: 'sim-burned',
        data: sim.burned,
        getQuadkey: sim.cellId,
        getFillColor: BURNED_FILL,
        getLineColor: BURNED_STROKE,
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: true,
        onClick: () => openSelection(SIM_FIRE_ID),
      }),
      // The fire itself, straight from the Engine and beating. The only thing on the
      // screen that moves without the operator asking (spec.md §4.8).
      new QuadkeyLayer<CellState>({
        id: 'sim-burning',
        data: sim.burning,
        getQuadkey: sim.cellId,
        // The Engine's per-cell intensity drives the alpha: the head of the front
        // reads hotter than the flanks, which is the shape an operator looks for.
        getFillColor: (d) => pulsed(intensityFill(d.intensity), tick),
        getLineColor: STATUS_STROKE.BURNING,
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: true,
        onClick: () => openSelection(SIM_FIRE_ID),
        updateTriggers: { getFillColor: [tick] },
      }),
      // Firebreaks. Cool grey on purpose: protected ground is the one thing on this
      // map that is good news, and warm is reserved for what burns.
      new QuadkeyLayer<CellState>({
        id: 'sim-protected',
        data: sim.protectedCells,
        getQuadkey: sim.cellId,
        getFillColor: PROTECTED_FILL,
        getLineColor: PROTECTED_STROKE,
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: false,
      }),
    ],
    [sim, tick, liveCells, liveStatus],
  );

  return (
    <div className="relative h-full w-full bg-night-900">
      <DeckGL
        viewState={viewState}
        onResize={({ width, height }) => {
          size.current = { width, height };
          if (width && height) setMeasured(true);
        }}
        onViewStateChange={({ viewState: next, interactionState }) => {
          // No clamping during the flight: the destination came clamped already, and
          // correcting every intermediate frame broke the transition mid-animation.
          if (interactionState?.inTransition) {
            setViewState(next as MapViewState);
            return;
          }
          // The transition props are dropped: if they went back into the state, every
          // frame of the flight would relaunch the flight.
          const { transitionDuration, transitionInterpolator, ...rest } =
            next as MapViewState & Record<string, unknown>;
          void transitionDuration;
          void transitionInterpolator;
          setViewState(
            clampToArea(rest as MapViewState, size.current.width, size.current.height),
          );
        }}
        controller={{ dragRotate: false }}
        layers={layers}
        // Clicking outside a fire deselects. The base grid is not pickable, so any
        // click that misses a burning cell arrives here with no object.
        onClick={({ object }) => {
          if (!object) clearSelection();
        }}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map mapStyle={BASEMAP} reuseMaps />
      </DeckGL>

      {/*
        The whole interface lives in one floating layer over the map (UX.md §2). The
        live figures it needs come from the Engine, not from the mocks: the hectare
        count is `state.fire.burnedAreaHa`, the Engine's own, never derived from cell
        size (see engine/anchor.ts).
      */}
      <Shell
        route={route}
        activeFires={simulating ? (sim.onFire ? 1 : 0) : (live.data?.activeCellIds.length ?? 0)}
        live={simulating ? {
          areaHa: sim.burnedAreaHa,
          minutes: sim.minutes,
          burningCells: sim.burning.length,
          // EnvironmentState maps one to one onto spec §6.2's weather, wind convention
          // included: both count degrees as the direction the wind blows FROM.
          weather: {
            temp_c: sim.environment.temperature,
            humidity_pct: sim.environment.humidity * 100,
            wind_speed_kmh: sim.environment.wind.speed,
            wind_dir_deg: sim.environment.wind.direction,
          },
        } : undefined}
        simulating={simulating}
        onToggleSimulation={() => setSimulating((v) => !v)}
      />
    </div>
  );
}
