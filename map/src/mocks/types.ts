/**
 * The data contracts of spec.md §6. They are written here, in map/, and not imported
 * from ../src: the engine has its own vocabulary and the §6.0 adapter is the only thing
 * that will change when the two are wired together. Until then the interface speaks
 * only this language.
 */

/** Minimal GeoJSON. There is no @types/geojson here and it is not worth a dependency. */
export interface Polygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export type LandCover = 'urban' | 'wui' | 'forest' | 'scrub' | 'crop' | 'bare';
export type FuelLoad = 'low' | 'moderate' | 'high' | 'extreme';
export type ValueType =
  | 'school'
  | 'hospital'
  | 'care_home'
  | 'settlement'
  | 'infrastructure';

export interface ValueAtRisk {
  type: ValueType;
  name: string;
  distance_km: number;
  population?: number;
  /**
   * Is it in the path of the wind? This is the field that turns "there is a school
   * nearby" into "evacuate that school now", which is why it gets a mark of its own in
   * the UI (spec §6.2, UX §5).
   */
  downwind: boolean;
}

/** spec.md §6.2 */
export interface Fire {
  id: string;
  cell_id: string;
  /**
   * DEVIATION from spec §6.2: the contract carries no place name, and UX §5 forbids
   * showing the raw cell_id. Until the backend returns one, the readable name lives here.
   */
  place: string;
  centroid: [number, number]; // [lat, lng]
  detected_at: string;
  confidence: number; // 0–1
  source: 'VIIRS' | 'MODIS' | 'camera' | 'manual' | 'deepfire';
  area_ha: number;
  perimeter?: Polygon;
  spread: { direction_deg: number; speed_kmh: number };
  weather: {
    temp_c: number;
    humidity_pct: number;
    wind_speed_kmh: number;
    wind_dir_deg: number;
  };
  zone: {
    land_cover: LandCover;
    slope_deg: number;
    fuel_load: FuelLoad;
  };
  values_at_risk: ValueAtRisk[];
}

/** spec.md §6.3 */
export interface RiskDriver {
  factor: string; // 'wind_speed' | 'fuel_dryness' | 'temperature' | ...
  contribution: number; // 0–1, drives the bar
  value: string; // already formatted: "38 km/h SW"
}

/** spec.md §6.3 */
export interface Prediction {
  cell_id: string;
  risk_score: number; // 0–1
  horizon_h: number; // 6 | 12 | 24 | 48
  drivers: RiskDriver[];
  rationale: string;
  /**
   * DEVIATION from spec §6.3, same reason as Fire.place: the contract carries no
   * readable name and UX §5 forbids showing the raw cell id. Until the backend
   * returns one, it lives here.
   */
  place: string;
}

/** spec.md §6.4 */
export interface RankedAction {
  action_id: string;
  label: string;
  rank: number; // 1 = first
  urgency: 'immediate' | 'soon' | 'monitor';
  why: string; // justification, mandatory
  resources?: string[];
  eta_min?: number;
  status: 'proposed' | 'accepted' | 'rejected' | 'done';
}

/** spec.md §6.4 */
export interface AIAnalysis {
  target_id: string; // fire_id or cell_id
  summary: string;
  priority_rationale: string;
  actions: RankedAction[];
  model: string; // traceability; shown in the panel footer
  generated_at: string;
}
