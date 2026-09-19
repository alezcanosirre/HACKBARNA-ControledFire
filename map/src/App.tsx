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
import {
  SIMULATED_CELLS,
  SIMULATED_FIRES,
  simulatedFireById,
  type SimulatedCell,
} from './engine/simulatedFires';
import { useLiveFireState } from './live/useLiveFireState';
import { LIVE_FILL, LIVE_STROKE, statusFromLiveCells } from './live/liveFires';
import { quadkeysForH3Cells } from './live/h3ToQuadkey';
import { Shell } from './ui/Shell';
import { clearSelection, openSelection, useRoute } from './ui/route';
import { buildLiveRisk } from './pred/livePredictions';
import { riskFill, riskStroke } from './pred/risk';

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
 * The selected fire's outline. White and thicker, drawn over whatever colour the cell
 * already has, so the one you clicked is unmistakable among the others.
 *
 * It is the only white on the map, and that is deliberate: warm means fire and cool
 * means data, so "the thing you are looking at" needed a third channel that is neither.
 * This used to exist as a separate outline layer and was lost when the layers were
 * rewritten around the live feed — clicking a fire opened the panel and left no mark on
 * the map, which makes you doubt you clicked the right one.
 */
const SELECTED_STROKE: [number, number, number, number] = [255, 255, 255, 235];
const SELECTED_WIDTH = 3;


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
  // PRED paints risk instead of fire. Same grid, same camera: only the data changes.
  const onPred = route.page === 'pred';


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
  const [simulating, setSimulating] = useState(false);
  // With SIMULATION on nothing is asked of Deepfire: see useLiveFireState.
  const live = useLiveFireState(!simulating);

  /*
   * Ignition risk: where a fire may START, which is a different question from where an
   * existing one would spread. It comes from the backend heuristic (api/src/live/
   * ignitionRisk.ts) over measured ignition history and current weather.
   *
   * NO FALLBACK TO A MOCK. Everything PRED paints is measured: the ignition history is
   * Deepfire's, the weather is met.no's. What is ours is the formula that combines them,
   * and the card says so. If the proxy is down PRED shows its empty state — a blank
   * forecast is a problem you can see and fix, an invented one is a problem you find out
   * about on stage.
   */
  const liveRisk = useMemo(
    () => buildLiveRisk(live.data?.ignitionRisk ?? []),
    [live.data],
  );
  const riskCells = liveRisk.cells;

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

  // One incident per Deepfire cluster, computed server-side (api/src/live/liveFireState.ts).
  const liveFires = useMemo(() => live.data?.fires ?? [], [live.data]);

  /*
   * `quadkeyToFireId` maps each rasterised square back to whichever fire it came from,
   * since the picked object on click is a quadkey, not an H3 cell.
   */
  const quadkeyToFireId = useMemo(() => {
    // `Map` here is the JS built-in, not the react-map-gl component imported above —
    // globalThis avoids the name collision.
    const map = new globalThis.Map<string, string>();
    for (const fire of liveFires) {
      for (const quadkey of quadkeysForH3Cells(fire.cellIds)) map.set(quadkey, fire.id);
    }
    return map;
  }, [liveFires]);

  // Only the cells that have something to say. The full mesh is never generated at this
  // resolution — see spec.md §4.2: detail exists around a fire, not across the region.
  const liveCells = useMemo(
    () => [...liveStatus.keys()].map((cell_id) => ({ cell_id })),
    [liveStatus],
  );

  // Pulse of the burning cells. See spec.md §4.8.
  const tick = usePulse(simulating);

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

    const target = simulatedFireById(selectedFire)?.bounds ?? null;
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
      /*
       * PRED. Changing page does not move a single piece of interface (UX.md §10): the
       * reference grid stays exactly where it is and only the data on it changes, which
       * is what makes ACTUAL and PRED read as two readings of the same place rather
       * than two places.
       *
       * Risk is continuous, so it is interpolated instead of bucketed (spec.md §4.7),
       * and nothing beats here — the pulse belongs to real fire, and a risk is not an
       * emergency (UX.md §6).
       *
       * Every cell here is the backend's ignition-risk heuristic over measured data.
       * Nothing is mocked: see the note where `liveRisk` is built.
       */
      new QuadkeyLayer<{ cell_id: string; risk: number }>({
        id: 'pred-risk',
        data: onPred ? riskCells : [],
        getQuadkey: (d) => d.cell_id,
        getFillColor: (d) => riskFill(d.risk),
        getLineColor: (d) =>
          d.cell_id === route.selection ? SELECTED_STROKE : riskStroke(d.risk),
        getLineWidth: (d) => (d.cell_id === route.selection ? SELECTED_WIDTH : 1),
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: true,
        onClick: ({ object }) => {
          if (object) openSelection(object.cell_id);
        },
        updateTriggers: {
          getFillColor: [onPred, riskCells],
          getLineColor: [onPred, riskCells, route.selection],
          getLineWidth: [route.selection],
        },
      }),
      // The live Deepfire feed: what is burning right now, and what its spread
      // projection puts at risk. Arrives as H3 res-8 and is rasterised onto this grid
      // before it gets here.
      new QuadkeyLayer<Cell>({
        id: 'live-fire',
        data: onPred ? [] : liveCells,
        getQuadkey: (d) => d.cell_id,
        getFillColor: (d) => LIVE_FILL[liveStatus.get(d.cell_id) ?? 'risk'],
        getLineColor: (d) =>
          quadkeyToFireId.get(d.cell_id) === selectedFire
            ? SELECTED_STROKE
            : LIVE_STROKE[liveStatus.get(d.cell_id) ?? 'risk'],
        getLineWidth: (d) =>
          quadkeyToFireId.get(d.cell_id) === selectedFire ? SELECTED_WIDTH : 1,
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        // Only an ACTIVE cell opens the detail panel — a risk-only square has no
        // fire yet, nothing to click into. quadkeyToFireId only has entries for
        // active cells (see groupActiveFires above), so a risk square's lookup
        // misses and onClick below does nothing.
        pickable: true,
        onClick: ({ object }: { object?: Cell }) => {
          const fireId = object && quadkeyToFireId.get(object.cell_id);
          if (fireId) openSelection(fireId);
        },
        updateTriggers: {
          getFillColor: [liveStatus],
          getLineColor: [liveStatus, selectedFire],
          getLineWidth: [selectedFire],
          onClick: [quadkeyToFireId],
        },
      }),
      /*
       * SIMULATION. Three fixed cases from api/src/scenario/simulatedFireCases.ts — a
       * picture of what burns, not a propagation: there is no clock behind this any
       * more. They only appear while the button is on, which is the whole line between
       * what is really burning and what is being shown (see SideMenu).
       *
       * They still beat, because on this screen a beating cell means fire (spec §4.8)
       * and these are fires. What they are not is real, and the button says so.
       */
      new QuadkeyLayer<SimulatedCell>({
        id: 'sim-burning',
        data: simulating && !onPred ? SIMULATED_CELLS : [],
        getQuadkey: (d) => d.cell_id,
        // Per-cell intensity drives the alpha: the head of the front reads hotter than
        // the flanks, which is the shape an operator looks for.
        getFillColor: (d) => pulsed(intensityFill(d.intensity), tick),
        getLineColor: (d) =>
          d.fireId === selectedFire ? SELECTED_STROKE : STATUS_STROKE.BURNING,
        getLineWidth: (d) => (d.fireId === selectedFire ? SELECTED_WIDTH : 1),
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: true,
        onClick: ({ object }: { object?: SimulatedCell }) => {
          if (object) openSelection(object.fireId);
        },
        updateTriggers: {
          getFillColor: [tick],
          getLineColor: [selectedFire],
          getLineWidth: [selectedFire],
          data: [simulating, onPred],
        },
      }),
    ],
    [simulating, tick, liveCells, liveStatus, quadkeyToFireId, onPred, riskCells, selectedFire, route.selection],
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
        `live` prop that used to carry the Engine's running figures is gone with the
        Engine: a simulated case is a fixed picture, so its numbers travel inside the
        case itself and the detail panel reads them straight from there.
      */}
      <Shell
        route={route}
        activeFires={
          simulating ? SIMULATED_FIRES.length : (live.data?.fires?.length ?? 0)
        }
        liveFires={liveFires}
        riskCells={riskCells.length}
        livePrediction={liveRisk.predictionFor}
        simulatedFire={simulatedFireById}
        simulating={simulating}
        onToggleSimulation={() => setSimulating((v) => !v)}
      />
    </div>
  );
}
