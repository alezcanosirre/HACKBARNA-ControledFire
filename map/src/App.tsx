import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { BASEMAP, VIEW_BCN } from './map/constants';
import { PRED_CELLS, type Cell } from './map/grid';
import { STATUS_FILL, STATUS_STROKE } from './map/colors';
import { statusFromLiveCells } from './map/liveFires';
import { useLiveFireState } from './live/useLiveFireState';

export default function App() {
  const { data, error, stale, loading } = useLiveFireState();
  const activeCellIds = data?.activeCellIds ?? [];
  const riskCellIds = data?.riskCellIds ?? [];
  const hotspots = data?.hotspots ?? [];

  const liveStatus = useMemo(
    () => statusFromLiveCells(activeCellIds, riskCellIds),
    [activeCellIds, riskCellIds],
  );

  // Celdas finas (res 8) — solo las que de verdad están ardiendo o en
  // riesgo, no una malla completa. Ver spec.md §4.2: el detalle nunca se
  // genera global, solo alrededor de cada incendio.
  const fireCells = useMemo<Cell[]>(
    () => [...liveStatus.keys()].map((cell_id) => ({ cell_id })),
    [liveStatus],
  );

  const layers = useMemo(
    () => [
      // Rejilla base (res 6), casi invisible — da contexto sobre todo el área.
      new H3HexagonLayer<Cell>({
        id: 'grid-pred',
        data: PRED_CELLS,
        getHexagon: (d) => d.cell_id,
        getFillColor: STATUS_FILL.normal,
        getLineColor: STATUS_STROKE.normal,
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        coverage: 0.94,
        pickable: false,
      }),
      // Celdas de incendio real (res 8), coloreadas por estado.
      new H3HexagonLayer<Cell>({
        id: 'fire-cells',
        data: fireCells,
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
    [fireCells, liveStatus],
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
            {hotspots.length} detección{hotspots.length === 1 ? '' : 'es'} · {activeCellIds.length} celda
            {activeCellIds.length === 1 ? '' : 's'} ardiendo · {riskCellIds.length} en riesgo
            {data?.fetchedAt && (
              <span className="ml-2 text-[#5B6B85]">
                · actualizado {new Date(data.fetchedAt).toLocaleTimeString()}
              </span>
            )}
            {stale && (
              <span className="ml-2 text-[#FFB020]">· último ciclo con error, mostrando dato anterior</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
