import { Map } from 'react-map-gl/maplibre';
import { BASEMAP, VIEW_CATALUNYA } from './map/constants';
import { PRED_CELLS } from './map/grid';
console.log('celdas res 6:', PRED_CELLS.length, PRED_CELLS[0]);

export default function App() {
  return (
    <div className="h-full w-full bg-[#0C1220]">
      <Map
        initialViewState={VIEW_CATALUNYA}
        mapStyle={BASEMAP}
        style={{ width: '100%', height: '100%' }}
        dragRotate={false}
        reuseMaps
      />
    </div>
  );
}
