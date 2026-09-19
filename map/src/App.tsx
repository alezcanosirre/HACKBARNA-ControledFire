import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { FlyToInterpolator, type MapViewState } from '@deck.gl/core';
import { QuadkeyLayer } from '@deck.gl/geo-layers';
import { LineLayer } from '@deck.gl/layers';
import { BASEMAP, FOCUS_MS, VIEW_RMB } from './map/constants';
import {
  FIRES,
  FIRE_OUTLINES,
  PLAIN_CELLS,
  STATUS_CELLS,
  fireOf,
  statusOf,
  type Cell,
} from './map/grid';
import { STATUS_FILL, STATUS_STROKE, pulsed } from './map/colors';
import { usePulse } from './map/pulse';
import { clampToArea, focusOn } from './map/view';
import { Shell } from './ui/Shell';
import { clearSelection, openSelection, useRoute } from './ui/route';

type Outline = (typeof FIRE_OUTLINES)[number];

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
  // contiguous cells are the same thing.
  const selectedFire = route.page === 'actual' ? route.selection : null;

  // Pulse of the cells with a status. See spec.md §4.8.
  const tick = usePulse(STATUS_CELLS.length > 0);

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

    const target = selectedFire ? FIRES.find((f) => f.id === selectedFire) : null;
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
      const framed = focusOn(target.bounds, prev, corridor, height);
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
      // Reference grid: no status, no fill and no picking. It cannot be clicked
      // because there is nothing behind it to show.
      new QuadkeyLayer<Cell>({
        id: 'cells-grid',
        data: PLAIN_CELLS,
        getQuadkey: (d) => d.cell_id,
        getFillColor: STATUS_FILL.NORMAL,
        getLineColor: STATUS_STROKE.NORMAL,
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: false,
      }),
      // The burning cells. The grid is still visible inside the blob: the per-cell
      // stroke is the same grey as the base grid, so the lattice crosses the fire
      // without breaking. What groups the fire is the outer outline of the next layer,
      // not the absence of interior lines.
      new QuadkeyLayer<Cell>({
        id: 'cells-fire',
        data: STATUS_CELLS,
        getQuadkey: (d) => d.cell_id,
        getFillColor: (d) => pulsed(STATUS_FILL[statusOf(d.cell_id)], tick),
        getLineColor: STATUS_STROKE.NORMAL,
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: true,
        onClick: ({ object }) => {
          const id = object ? fireOf((object as Cell).cell_id) : null;
          if (id) openSelection(id);
          else clearSelection();
        },
        updateTriggers: { getFillColor: [tick] },
      }),
      // The fire's outline, not each cell's: only the sides facing outwards.
      new LineLayer<Outline>({
        id: 'fire-outline',
        data: FIRE_OUTLINES,
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getColor: (d) =>
          d.fire_id === selectedFire
            ? [255, 255, 255, 235]
            : pulsed(STATUS_STROKE.BURNING, tick),
        getWidth: (d) => (d.fire_id === selectedFire ? 2.5 : 1.2),
        widthUnits: 'pixels',
        widthMinPixels: 1,
        pickable: false,
        updateTriggers: {
          getColor: [selectedFire, tick],
          getWidth: [selectedFire],
        },
      }),
    ],
    [selectedFire, tick],
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

      {/* The whole interface lives in one floating layer over the map. See UX.md §2. */}
      <Shell route={route} activeFires={FIRES.length} />
    </div>
  );
}
