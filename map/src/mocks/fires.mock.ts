import type { Fire } from './types';

/**
 * The demo scenario of spec.md §8. Five fires across the Regió Metropolitana.
 *
 * The `id`s match the ones the map's grouping produces (src/map/grid.ts numbers fires
 * by size, largest first), so clicking a cell brings up its detail with no translation
 * table. The day the backend sends real fires, this file gets deleted whole.
 *
 * The `cell_id`s are z15 quadkeys of the centroid (spec §4.1: nobody stores geometry,
 * geometry is derived from the identifier).
 */
export const FIRES_MOCK: Fire[] = [
  {
    id: 'fire-1',
    cell_id: '120222232113130',
    place: 'Collserola North',
    centroid: [41.4186, 2.0899],
    detected_at: '2026-09-19T14:32:00+02:00',
    confidence: 0.92,
    source: 'VIIRS',
    area_ha: 12.4,
    spread: { direction_deg: 30, speed_kmh: 4 },
    weather: { temp_c: 31, humidity_pct: 18, wind_speed_kmh: 27, wind_dir_deg: 210 },
    zone: { land_cover: 'wui', slope_deg: 12, fuel_load: 'high' },
    values_at_risk: [
      {
        type: 'school',
        name: 'CEIP Sant Jordi',
        distance_km: 1.8,
        population: 420,
        downwind: true,
      },
      {
        type: 'settlement',
        name: 'Vallvidrera village',
        distance_km: 3.1,
        population: 1250,
        downwind: false,
      },
      {
        type: 'care_home',
        name: 'Les Planes care home',
        distance_km: 2.4,
        population: 86,
        downwind: true,
      },
      {
        type: 'infrastructure',
        name: 'BV-1415 road',
        distance_km: 0.9,
        downwind: false,
      },
    ],
  },
  {
    id: 'fire-2',
    cell_id: '120222231033232',
    place: 'Montseny — south slope',
    centroid: [41.7736, 2.4008],
    detected_at: '2026-09-19T13:05:00+02:00',
    confidence: 0.81,
    source: 'MODIS',
    area_ha: 5.2,
    spread: { direction_deg: 95, speed_kmh: 2 },
    weather: { temp_c: 27, humidity_pct: 29, wind_speed_kmh: 14, wind_dir_deg: 275 },
    zone: { land_cover: 'forest', slope_deg: 21, fuel_load: 'extreme' },
    values_at_risk: [
      {
        type: 'settlement',
        name: 'Mas Joan',
        distance_km: 4.6,
        population: 40,
        downwind: true,
      },
      { type: 'infrastructure', name: '220 kV power line', distance_km: 2.2, downwind: true },
    ],
  },
  {
    id: 'fire-3',
    cell_id: '120222232123022',
    place: 'Garraf — Pla de Querol',
    centroid: [41.28, 1.85],
    detected_at: '2026-09-19T15:11:00+02:00',
    confidence: 0.74,
    source: 'camera',
    area_ha: 2.8,
    spread: { direction_deg: 160, speed_kmh: 3 },
    weather: { temp_c: 29, humidity_pct: 22, wind_speed_kmh: 19, wind_dir_deg: 340 },
    zone: { land_cover: 'scrub', slope_deg: 8, fuel_load: 'high' },
    values_at_risk: [
      {
        type: 'settlement',
        name: 'Can Lloses estate',
        distance_km: 2.7,
        population: 310,
        downwind: true,
      },
    ],
  },
  {
    id: 'fire-4',
    cell_id: '120222230231011',
    place: 'Sant Llorenç — inland',
    centroid: [41.64, 1.71],
    detected_at: '2026-09-19T12:48:00+02:00',
    confidence: 0.63,
    source: 'deepfire',
    area_ha: 1.6,
    spread: { direction_deg: 45, speed_kmh: 1 },
    weather: { temp_c: 26, humidity_pct: 34, wind_speed_kmh: 9, wind_dir_deg: 225 },
    zone: { land_cover: 'crop', slope_deg: 3, fuel_load: 'moderate' },
    values_at_risk: [
      { type: 'infrastructure', name: 'Camí de la Serra track', distance_km: 1.2, downwind: false },
    ],
  },
  {
    id: 'fire-5',
    cell_id: '120222231232320',
    place: 'Vallès — Sentmenat flare-up',
    centroid: [41.52, 2.34],
    detected_at: '2026-09-19T15:40:00+02:00',
    confidence: 0.58,
    source: 'manual',
    area_ha: 0.7,
    spread: { direction_deg: 20, speed_kmh: 1 },
    weather: { temp_c: 28, humidity_pct: 31, wind_speed_kmh: 11, wind_dir_deg: 200 },
    zone: { land_cover: 'crop', slope_deg: 2, fuel_load: 'low' },
    values_at_risk: [
      {
        type: 'settlement',
        name: 'Sentmenat',
        distance_km: 3.4,
        population: 9200,
        downwind: false,
      },
    ],
  },
];

const BY_ID = new Map(FIRES_MOCK.map((f) => [f.id, f]));

/** Detail for the selected fire, or null if the map sends an id that is not mocked. */
export function fireById(id: string | null): Fire | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}
