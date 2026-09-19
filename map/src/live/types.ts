// Debe reflejar api/src/live/liveFireState.ts + deepfireHotspots.ts — no
// hay path compartido entre los dos proyectos TS (ver map/spec.md §3), así
// que este tipo se duplica a propósito.
export interface LiveHotspot {
  readonly id: string;
  readonly clusterId: string;
  readonly lat: number;
  readonly lng: number;
  readonly observedAt: string;
  readonly source: string;
  readonly confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly fireRadiativePowerMw: number | null;
}

/** One real incident, already grouped and computed server-side (bulk data from the
 * same poll cycle, no extra Deepfire call). `null` means Deepfire doesn't have that
 * yet for this cluster (e.g. no perimeter computed), never "zero". */
export interface LiveFireSummary {
  readonly id: string; // raw cluster_id — what POST /api/live-fires/:id/actions expects
  readonly centroid: { readonly lat: number; readonly lng: number };
  readonly firstObserved: string;
  readonly lastObserved: string;
  readonly cellIds: readonly string[]; // res-8, only this fire's cells
  readonly areaHa: number | null;
  readonly perimeterM: number | null;
  readonly nHotspots: number | null;
  readonly confidence: LiveHotspot['confidence'] | null;
  readonly source: string | null;
  readonly fireRadiativePowerMw: number | null;
  readonly wind: { readonly speedMs: number; readonly directionDeg: number } | null;
  /** El tiempo que hace AHORA sobre el foco, de met.no. Deepfire no da meteo. */
  readonly weather: {
    readonly temperatureC: number;
    readonly humidityPct: number;
    readonly windSpeedKmh: number;
    readonly windDirectionDeg: number;
  } | null;
}

/** Una celda con riesgo de ignición, tal cual la calcula api/src/live/ignitionRisk.ts. */
export interface LiveIgnitionRiskCell {
  readonly cell_id: string; // H3 res-8
  readonly risk: number; // 0-1
  readonly lat: number;
  readonly lng: number;
  readonly horizonHours: number;
  readonly drivers: readonly {
    readonly factor: string;
    readonly contribution: number;
    readonly value: string;
  }[];
}

export interface LiveFireState {
  readonly fires: readonly LiveFireSummary[];
  readonly activeCellIds: readonly string[]; // res-8, ardiendo AHORA
  readonly riskCellIds: readonly string[]; // res-8, propagación de un foco activo
  /** Riesgo de IGNICIÓN (PRED): dónde puede empezar un fuego, no hacia dónde iría uno. */
  readonly ignitionRisk: readonly LiveIgnitionRiskCell[];
  readonly hotspots: readonly LiveHotspot[];
  readonly fetchedAt: number;
  // Del último ciclo de refresco del servidor, si falló — el resto de
  // campos en ese caso son el último dato bueno conocido, no vacío.
  readonly error: string | null;
}
