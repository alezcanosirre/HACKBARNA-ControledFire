import { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import type { MapViewState } from '@deck.gl/core';
import { QuadkeyLayer } from '@deck.gl/geo-layers';
import { BASEMAP, VIEW_RMB } from './map/constants';
import { PLAIN_CELLS, STATUS_CELLS, statusOf, type Cell } from './map/grid';
import { STATUS_FILL, STATUS_STROKE } from './map/colors';
import { clampToArea } from './map/view';

export default function App() {
  // La cámara es controlada: cada movimiento pasa por clampToArea antes de aplicarse,
  // así el operador no puede salirse de la RMB ni alejarse por debajo de MIN_ZOOM.
  const [viewState, setViewState] = useState<MapViewState>(VIEW_RMB);
  const [selected, setSelected] = useState<Cell | null>(null);

  const layers = useMemo(
    () => [
      // Rejilla de referencia: sin estado, sin relleno y sin picking. No se puede
      // pulsar porque no hay nada detrás que enseñar.
      new QuadkeyLayer<Cell>({
        id: 'cells-grid',
        data: PLAIN_CELLS,
        getQuadkey: (d) => d.cell_id,
        getFillColor: STATUS_FILL.normal,
        getLineColor: STATUS_STROKE.normal,
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: false,
      }),
      // Las celdas con estado: las únicas que se pintan y las únicas pulsables.
      new QuadkeyLayer<Cell>({
        id: 'cells-status',
        data: STATUS_CELLS,
        getQuadkey: (d) => d.cell_id,
        getFillColor: (d) =>
          d.cell_id === selected?.cell_id
            ? [96, 165, 250, 90]
            : STATUS_FILL[statusOf(d.cell_id)],
        getLineColor: (d) =>
          d.cell_id === selected?.cell_id
            ? [147, 197, 253, 220]
            : STATUS_STROKE[statusOf(d.cell_id)],
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        pickable: true,
        onClick: ({ object }) => setSelected((object as Cell) ?? null),
        // deck.gl memoiza los accesores: sin esto el estado cambia, React re-renderiza
        // y la pantalla no se entera. Desde fuera parece que el clic no funciona.
        updateTriggers: {
          getFillColor: [selected?.cell_id],
          getLineColor: [selected?.cell_id],
        },
      }),
    ],
    [selected],
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
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map mapStyle={BASEMAP} reuseMaps />
      </DeckGL>

      <div className="absolute bottom-4 left-4 rounded border border-[#1D2840] bg-[#131C2E]/90 px-3 py-2 text-xs text-[#8FA3BF]">
        {PLAIN_CELLS.length + STATUS_CELLS.length} celdas ·{' '}
        <span className="text-[#E4EBF5]">{selected?.cell_id ?? 'ninguna seleccionada'}</span>
      </div>
    </div>
  );
}
