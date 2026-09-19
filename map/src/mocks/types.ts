/**
 * Contratos de datos de spec.md §6. Se escriben aquí, en map/, y no se importan de
 * ../src: el motor tiene su propio vocabulario y el adaptador de §6.0 es lo único que
 * cambiará cuando se conecten. Mientras tanto la interfaz habla solo este idioma.
 */

/** GeoJSON mínimo. No hay @types/geojson en el proyecto y no merece una dependencia. */
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
   * ¿Está en la trayectoria del viento? Es el campo que convierte «hay un colegio
   * cerca» en «evacuar ese colegio ya», y por eso lleva marca propia en la UI
   * (spec §6.2, UX §5).
   */
  downwind: boolean;
}

/** spec.md §6.2 */
export interface Fire {
  id: string;
  cell_id: string;
  /**
   * DESVIACIÓN de spec §6.2: el contrato no trae topónimo, y UX §5 prohíbe enseñar el
   * cell_id en crudo. Hasta que el backend lo devuelva, el nombre legible vive aquí.
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

/** spec.md §6.4 */
export interface RankedAction {
  action_id: string;
  label: string;
  rank: number; // 1 = primero
  urgency: 'immediate' | 'soon' | 'monitor';
  why: string; // justificación, obligatoria
  resources?: string[];
  eta_min?: number;
  status: 'proposed' | 'accepted' | 'rejected' | 'done';
}

/** spec.md §6.4 */
export interface AIAnalysis {
  target_id: string; // fire_id o cell_id
  summary: string;
  priority_rationale: string;
  actions: RankedAction[];
  model: string; // trazabilidad; se muestra en el pie del panel
  generated_at: string;
}
