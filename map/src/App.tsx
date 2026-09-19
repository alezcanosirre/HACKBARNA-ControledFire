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

export default function App() {
  // La cámara es controlada: cada movimiento pasa por clampToArea antes de aplicarse,
  // así el operador no puede salirse de la RMB ni alejarse por debajo de MIN_ZOOM.
  const [viewState, setViewState] = useState<MapViewState>(VIEW_RMB);
  // El acotado necesita saber cuánta pantalla hay. deck.gl lo mide y lo avisa en
  // onResize; se guarda en una ref porque no tiene que provocar re-render por sí mismo.
  const size = useRef({ width: 0, height: 0 });
  // deck.gl mide después del primer render. Sin esta señal, entrar por una URL con
  // foco (`/actual/fire-3`) dejaba el panel abierto y la cámara donde estaba: el
  // efecto de encuadre se ejecutaba con 0x0 y se rendía. Ver onResize.
  const [measured, setMeasured] = useState(false);

  // La selección no es estado de este componente: vive en la URL (UX.md §1). Así
  // recargar no pierde el sitio, el botón de volver y Esc entran por el mismo sitio
  // que el clic, y la demo se puede saltar a un foco concreto si algo falla.
  const route = useRoute();
  // Se selecciona el INCENDIO, no la celda: un foco es un incidente, y todas sus
  // celdas contiguas son la misma cosa.
  const selectedFire = route.page === 'actual' ? route.selection : null;

  // Latido de las celdas con estado. Ver spec.md §4.8.
  const tick = usePulse(STATUS_CELLS.length > 0);

  /**
   * Seleccionar un foco encuadra la cámara sobre él. Es la confirmación de que el clic
   * ha ido donde el operador creía: la pantalla se mueve al sitio.
   *
   * Va en un efecto sobre la ruta y no en el manejador del clic porque la selección
   * puede llegar también del historial o de una URL pegada, y en esos dos casos la
   * cámara tiene que ir igual.
   */
  useEffect(() => {
    const target = selectedFire ? FIRES.find((f) => f.id === selectedFire) : null;
    if (!target) return;

    const { width, height } = size.current;
    // deck.gl todavía no ha medido: encuadrar con 0x0 daría un zoom sin sentido.
    if (!width || !height) return;

    // Actualización funcional: el efecto no depende de viewState, así que su closure
    // llevaría uno viejo.
    setViewState((prev) => ({
      ...focusOn(target.bounds, prev, width, height),
      transitionDuration: FOCUS_MS,
      transitionInterpolator: new FlyToInterpolator(),
    }) as MapViewState);
  }, [selectedFire, measured]);

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
        onClick: ({ object }) => {
          const id = object ? fireOf((object as Cell).cell_id) : null;
          if (id) openSelection(id);
          else clearSelection();
        },
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
    <div className="relative h-full w-full bg-night-900">
      <DeckGL
        viewState={viewState}
        onResize={({ width, height }) => {
          size.current = { width, height };
          if (width && height) setMeasured(true);
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
          if (!object) clearSelection();
        }}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map mapStyle={BASEMAP} reuseMaps />
      </DeckGL>

      {/* Toda la interfaz va en una sola capa flotante encima del mapa. Ver UX.md §2. */}
      <Shell route={route} activeFires={FIRES.length} />
    </div>
  );
}
