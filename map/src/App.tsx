import { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import type { MapViewState } from '@deck.gl/core';
import { QuadkeyLayer } from '@deck.gl/geo-layers';
import { LineLayer } from '@deck.gl/layers';
import { BASEMAP, VIEW_RMB } from './map/constants';
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
import { clampToArea } from './map/view';

type Outline = (typeof FIRE_OUTLINES)[number];

export default function App() {
  // La cámara es controlada: cada movimiento pasa por clampToArea antes de aplicarse,
  // así el operador no puede salirse de la RMB ni alejarse por debajo de MIN_ZOOM.
  const [viewState, setViewState] = useState<MapViewState>(VIEW_RMB);
  // Se selecciona el INCENDIO, no la celda: un foco es un incidente, y todas sus
  // celdas contiguas son la misma cosa.
  const [selectedFire, setSelectedFire] = useState<string | null>(null);

  // Latido de las celdas con estado. Ver spec.md §4.8.
  const tick = usePulse(STATUS_CELLS.length > 0);

  const fire = useMemo(
    () => FIRES.find((f) => f.id === selectedFire) ?? null,
    [selectedFire],
  );

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
        onClick: ({ object }) =>
          setSelectedFire(object ? fireOf((object as Cell).cell_id) : null),
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
        onViewStateChange={({ viewState: next }) =>
          setViewState(clampToArea(next as MapViewState))
        }
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
