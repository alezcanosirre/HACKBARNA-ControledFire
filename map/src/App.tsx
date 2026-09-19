import { useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import type { MapViewState } from '@deck.gl/core';
import { QuadkeyLayer } from '@deck.gl/geo-layers';
import { BASEMAP, VIEW_RMB } from './map/constants';
import { PRED_CELLS, type Cell } from './map/grid';
import { clampToArea } from './map/view';

export default function App() {
  // La cámara es controlada: cada movimiento pasa por clampToArea antes de aplicarse,
  // así el operador no puede salirse de la RMB ni alejarse por debajo de MIN_ZOOM.
  const [viewState, setViewState] = useState<MapViewState>(VIEW_RMB);

  const layers = useMemo(
    () => [
      new QuadkeyLayer<Cell>({
        id: 'cells-pred',
        data: PRED_CELLS,
        getQuadkey: (d) => d.cell_id,
        getFillColor: [0, 0, 0, 0],            // sin relleno: solo el trazo
        getLineColor: [148, 163, 184, 45],     // rejilla base, apenas perceptible
        lineWidthMinPixels: 1,
        filled: true,                          // hace falta para el picking, alfa 0
        stroked: true,
        extruded: false,
        pickable: true,
      }),
    ],
    [],
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
      >
        <Map mapStyle={BASEMAP} reuseMaps />
      </DeckGL>
    </div>
  );
}
