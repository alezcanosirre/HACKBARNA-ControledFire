import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { BASEMAP, VIEW_BCN } from './map/constants';
import { PRED_CELLS, type Cell } from './map/grid';
import { STATUS_FILL, STATUS_STROKE } from './map/colors';
import { statusFromHotspots } from './map/liveFires';
import { useLiveHotspots } from './live/useLiveHotspots';

export default function App() {
  const { hotspots, fetchedAt, error, loading } = useLiveHotspots();
  const liveStatus = useMemo(() => statusFromHotspots(hotspots), [hotspots]);

  const layers = useMemo(
    () => [
      new H3HexagonLayer<Cell>({
        id: 'cells-pred',
        data: PRED_CELLS,
        getHexagon: (d) => d.cell_id,
        getFillColor: (d) => STATUS_FILL[liveStatus.get(d.cell_id) ?? 'normal'],
        getLineColor: (d) => STATUS_STROKE[liveStatus.get(d.cell_id) ?? 'normal'],
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        coverage: 0.94,
        pickable: false,
        updateTriggers: {
          getFillColor: [liveStatus],
          getLineColor: [liveStatus],
        },
      }),
    ],
    [liveStatus],
  );

  return (
    <div className="h-full w-full bg-[#0C1220]">
      <DeckGL initialViewState={VIEW_BCN} controller={{ dragRotate: false }} layers={layers}>
        <Map mapStyle={BASEMAP} reuseMaps />
      </DeckGL>

      <div className="absolute bottom-4 left-4 rounded border border-[#1D2840] bg-[#131C2E]/90 px-3 py-2 text-xs text-[#8FA3BF]">
        {loading && 'cargando incendios…'}
        {!loading && error && <span className="text-[#EC381C]">error: {error}</span>}
        {!loading && !error && (
          <>
            {hotspots.length} foco{hotspots.length === 1 ? '' : 's'} activo
            {hotspots.length === 1 ? '' : 's'} en el área metropolitana de Barcelona
            {fetchedAt && (
              <span className="ml-2 text-[#5B6B85]">
                · actualizado {new Date(fetchedAt).toLocaleTimeString()}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
