import { useMemo, useRef, useState } from 'react';
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

type Outline = (typeof FIRE_OUTLINES)[number];

export default function App() {
  // La cámara es controlada: cada movimiento pasa por clampToArea antes de aplicarse,
  // así el operador no puede salirse de la RMB ni alejarse por debajo de MIN_ZOOM.
  const [viewState, setViewState] = useState<MapViewState>(VIEW_RMB);
  // El acotado necesita saber cuánta pantalla hay. deck.gl lo mide y lo avisa en
  // onResize; se guarda en una ref porque no tiene que provocar re-render por sí mismo.
  const size = useRef({ width: 0, height: 0 });
  // Se selecciona el INCENDIO, no la celda: un foco es un incidente, y todas sus
  // celdas contiguas son la misma cosa.
  const [selectedFire, setSelectedFire] = useState<string | null>(null);

  // Latido de las celdas con estado. Ver spec.md §4.8.
  const tick = usePulse(STATUS_CELLS.length > 0);

  const fire = useMemo(
    () => FIRES.find((f) => f.id === selectedFire) ?? null,
    [selectedFire],
  );

  /**
   * Seleccionar un foco encuadra la cámara sobre él. Es la confirmación de que el clic
   * ha ido donde el operador creía: la pantalla se mueve al sitio.
   */
  function selectFire(id: string | null) {
    setSelectedFire(id);
    const target = id ? FIRES.find((f) => f.id === id) : null;
    if (!target) return;

    const { width, height } = size.current;
    // Actualización funcional: la capa que llama a esto está memoizada y su closure
    // podría llevar un viewState viejo.
    setViewState((prev) => ({
      ...focusOn(target.bounds, prev, width, height),
      transitionDuration: FOCUS_MS,
      transitionInterpolator: new FlyToInterpolator(),
    }) as MapViewState);
  }

  const layers = useMemo(
    () => [
      // Rejilla de referencia: sin estado, sin relleno y sin picking. No se puede
      // pulsar porque no hay nada detrás que enseñar.
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
      // Las celdas que arden. La rejilla sigue viéndose por dentro de la mancha: el
      // trazo por celda es el mismo gris de la rejilla base, así que la cuadrícula
      // atraviesa el incendio sin romperse. Lo que agrupa el foco es el contorno
      // exterior de la capa siguiente, no la ausencia de líneas interiores.
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
        onClick: ({ object }) => selectFire(object ? fireOf((object as Cell).cell_id) : null),
        updateTriggers: { getFillColor: [tick] },
      }),
      // El contorno del incendio, no el de cada celda: solo los lados que dan afuera.
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
    <div className="h-full w-full bg-[#0C1220]">
      <DeckGL
        viewState={viewState}
        onResize={({ width, height }) => {
          size.current = { width, height };
        }}
        onViewStateChange={({ viewState: next, interactionState }) => {
          // Durante el vuelo no se acota: el destino ya venía acotado, y corregir cada
          // fotograma intermedio rompía la transición a media animación.
          if (interactionState?.inTransition) {
            setViewState(next as MapViewState);
            return;
          }
          // Se descartan las props de transición: si volvieran a entrar en el estado,
          // cada fotograma del vuelo relanzaría el vuelo.
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
        // Pulsar fuera de un incendio deselecciona. La rejilla base no es pickable, así
        // que cualquier clic que no acierte una celda que arde llega aquí sin objeto.
        onClick={({ object }) => {
          if (!object) setSelectedFire(null);
        }}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map mapStyle={BASEMAP} reuseMaps />
      </DeckGL>

      <div className="absolute bottom-4 left-4 rounded border border-[#1D2840] bg-[#131C2E]/90 px-3 py-2 text-xs text-[#8FA3BF]">
        {FIRES.length} focos ·{' '}
        <span className="text-[#E4EBF5]">
          {fire
            ? `foco ${fire.id.split('-')[1]} · ${fire.cells.length} celdas · ${fire.areaKm2.toFixed(0)} km²`
            : 'ninguno seleccionado'}
        </span>
      </div>
    </div>
  );
}
