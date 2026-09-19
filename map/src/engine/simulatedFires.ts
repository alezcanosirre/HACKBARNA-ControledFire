import {
  SIMULATED_FIRE_CASES,
  type SimulatedFireCase,
} from '../../../api/src/scenario/simulatedFireCases';
import type { Fire, LandCover, FuelLoad, ValueType } from '../mocks/types';
import { QUAD_Z } from '../map/constants';
import { cellSideM, createAnchor, type Anchor2D } from './anchor';

/**
 * SIMULATION, driven by the static cases in api/src/scenario/simulatedFireCases.ts.
 *
 * It used to run the Fire Engine here — `createInitialState` plus a timer sending WAIT
 * — and that is gone on purpose. What SIMULATION shows now is a fixed picture per case,
 * not a propagation: no clock, no ticks, no state. Which means no hook either; this is
 * a module constant computed once at load.
 *
 * What the cases DO give, and the live feed cannot, is a complete incident: a place
 * name, land cover, slope, fuel load and the values at risk with distances and
 * population. Deepfire has none of that (no land-cover and no values-at-risk endpoint),
 * so SIMULATION is the only place the full detail panel has anything to fill it with.
 * That is the point of it — it shows the product, while ACTUAL shows the data.
 *
 * Everything here is invented and says so: these cases are the mock, and they live
 * behind a button labelled SIMULATION precisely so nobody confuses them with ACTUAL.
 */

/**
 * Where each case sits on real ground. The backend cases carry a name and a 20x15 local
 * grid and no geography whatsoever, so putting "Incendio en el Montseny" on the Montseny
 * is a map-side decision, and these three numbers are it.
 */
const CENTERS: Record<string, Anchor2D> = {
  'sim-collserola': { latitude: 41.43, longitude: 2.09 },
  'sim-montseny': { latitude: 41.77, longitude: 2.4 },
  'sim-sant-andreu': { latitude: 41.435, longitude: 2.19 },
};

/** Fallback so a case added later still lands somewhere instead of at (0,0) off Africa. */
const DEFAULT_CENTER: Anchor2D = { latitude: 41.43, longitude: 2.09 };

/**
 * A simulated case is drawn on the SAME grid as everything else: quadkey z15, the
 * reference lattice the map is built on and the one the live Deepfire feed is
 * rasterised onto.
 *
 * This replaces a per-case resolution picked from the hectares each case declared.
 * That was more faithful to the numbers and wrong on screen: the cases came out four to
 * sixteen times smaller than the live cells beside them, sitting between the lattice
 * lines instead of on them, and reading as specks rather than as fires. One grid, one
 * cell size — a square on this map means the same amount of ground wherever it is, and
 * that is worth more than matching a hectare figure that was invented anyway.
 *
 * The figure follows the picture, not the other way round: `area_ha` below is computed
 * from the cells actually painted, so the number in the panel is always the size of
 * what you can see.
 */

export interface SimulatedCell {
  cell_id: string;
  intensity: number;
  fireId: string;
}

export interface SimulatedFire {
  readonly id: string;
  readonly cells: readonly SimulatedCell[];
  readonly bounds: readonly [[number, number], [number, number]];
  /** The case reshaped into the contract the detail panel already speaks (spec §6.2). */
  readonly fire: Fire;
}

/**
 * The cases are camelCase because they are a TS module imported directly, not JSON off
 * an API; `Fire` is snake_case because it is spec §6.2's wire contract. Their own
 * comment says the shapes were kept parallel so adapting would be renaming rather than
 * redesigning — this is that renaming.
 */
function toFire(c: SimulatedFireCase, lat: number, lng: number, areaHa: number): Fire {
  return {
    id: c.id,
    cell_id: c.id,
    place: c.name,
    centroid: [lat, lng],
    detected_at: c.detectedAt,
    confidence: c.confidence,
    source: c.source as Fire['source'],
    // NOT the case's own `burnedAreaHa`: the area of what is actually painted. The two
    // were within a hectare or two of each other anyway, and deriving it means the big
    // number in the panel is always the size of the squares on the map. A figure that
    // contradicts the picture next to it is worse than no figure.
    area_ha: areaHa,
    spread: { direction_deg: c.spread.directionDeg, speed_kmh: c.spread.speedKmh },
    weather: {
      temp_c: c.environment.temperature,
      humidity_pct: c.environment.humidity * 100,
      wind_speed_kmh: c.environment.wind.speed,
      wind_dir_deg: c.environment.wind.direction,
    },
    zone: {
      land_cover: c.zone.landCover as LandCover,
      slope_deg: c.zone.slopeDeg,
      fuel_load: c.zone.fuelLoad as FuelLoad,
    },
    values_at_risk: c.valuesAtRisk.map((v) => ({
      type: v.type as ValueType,
      name: v.name,
      distance_km: v.distanceKm,
      population: v.population,
      downwind: v.downwind,
    })),
  };
}

function build(): SimulatedFire[] {
  return SIMULATED_FIRE_CASES.map((c) => {
    const center = CENTERS[c.id] ?? DEFAULT_CENTER;
    const anchor = createAnchor(center, c.mapWidth, c.mapHeight, QUAD_Z);
    const positions = c.burningCells.map((cell) => cell.position);
    const side = cellSideM(QUAD_Z, center.latitude);
    const areaHa = Math.round((c.burningCells.length * side * side) / 10_000);

    return {
      id: c.id,
      cells: c.burningCells.map((cell) => ({
        cell_id: anchor.cellId(cell.position),
        intensity: cell.intensity,
        fireId: c.id,
      })),
      bounds: anchor.boundsOf(positions),
      fire: toFire(c, center.latitude, center.longitude, areaHa),
    };
  });
}

export const SIMULATED_FIRES: readonly SimulatedFire[] = build();

export const SIMULATED_CELLS: readonly SimulatedCell[] = SIMULATED_FIRES.flatMap((f) => f.cells);

const BY_ID = new Map(SIMULATED_FIRES.map((f) => [f.id, f]));

export const simulatedFireById = (id: string | null): SimulatedFire | null =>
  id ? (BY_ID.get(id) ?? null) : null;

const BY_CELL = new Map(SIMULATED_CELLS.map((c) => [c.cell_id, c.fireId]));

export const simulatedFireIdForCell = (cellId: string): string | null =>
  BY_CELL.get(cellId) ?? null;
