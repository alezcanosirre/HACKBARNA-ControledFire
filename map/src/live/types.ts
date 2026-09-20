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
  /** Dónde está esto, en palabras: "Sant Celoni". DERIVADO del centroide contra una
   * tabla de capitales municipales (api/src/live/placeName.ts), no un dato de Deepfire:
   * es el municipio más cercano, no la ubicación confirmada. */
  readonly place: string | null;
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
    readonly source: string;
    readonly observedAt: string;
  } | null;
}

/** Una celda con riesgo de ignición, tal cual la calcula api/src/live/ignitionRisk.ts. */
export interface LiveIgnitionRiskCell {
  readonly cell_id: string; // H3 res-8
  readonly risk: number; // 0-1
  readonly lat: number;
  readonly lng: number;
  /** El municipio más cercano ("near X"), o el topónimo escrito en el caso si es un
   * ejercicio. DERIVADO, no medido — ver api/src/live/ignitionRisk.ts. */
  readonly place: string | null;
  readonly horizonHours: number;
  /** El porqué de esta celda, del modelo. Vacío cuando se sirve la heurística. */
  readonly rationale?: string;
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
  /** La lectura del área en conjunto. `summary` en null = se está sirviendo la heurística. */
  readonly ignitionAnalysis: {
    readonly summary: string | null;
    readonly model: string | null;
    readonly generatedAt: string;
  };
  readonly hotspots: readonly LiveHotspot[];
  readonly fetchedAt: number;
  // Del último ciclo de refresco del servidor, si falló — el resto de
  // campos en ese caso son el último dato bueno conocido, no vacío.
  readonly error: string | null;
}

// Debe reflejar api/src/live/actionRecommendation.ts — misma razón de la
// duplicación que arriba, no hay path compartido entre los dos proyectos TS.
// El backend siempre resuelve `recommendedAction.title` desde su catálogo, así
// que aquí nunca hay que inventar un título: viene ya resuelto.
export type RecommendationStatus = 'recommended' | 'insufficient_data' | 'unavailable';

export interface EvidenceItem {
  readonly field: string;
  readonly explanation: string;
}

export interface RecommendedAction {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
  readonly evidence: readonly EvidenceItem[];
}

/** Respuesta de POST /api/live-fires/:id/actions. A diferencia de la vieja AIAnalysis
 * (mocks/types.ts), nunca hay una lista rankeada: como mucho una acción prioritaria,
 * más ids complementarios sin texto propio (ver LIVE_ACTION_TITLES en LiveActionsCard). */
export interface ActionRecommendation {
  readonly incidentId: string;
  readonly mode: 'ACTUAL';
  readonly status: RecommendationStatus;
  readonly generatedAt: string;
  readonly incidentUpdatedAt: string | null;
  readonly catalogVersion: string;
  readonly summary: string;
  readonly recommendedAction: RecommendedAction | null;
  readonly complementaryActionIds: readonly string[];
  readonly missingData: readonly string[];
  readonly limitations: readonly string[];
  readonly requiresHumanReview: true;
}

// Debe reflejar api/src/live/incidentTriage.ts — misma duplicación a propósito que el
// resto de este fichero.
//
// `not_applicable` no es un fallo: es que hay menos de dos incendios activos y ordenar
// uno solo no significa nada. El backend lo responde sin llamar al modelo siquiera.
export type TriageStatus = 'ranked' | 'unavailable' | 'not_applicable';

export interface TriageEntry {
  readonly incidentId: string;
  /** 1 = atiéndelo primero. Lo pone el servidor por posición, no el modelo. */
  readonly rank: number;
  readonly reason: string;
}

/** Respuesta de GET /api/live-fires/triage: en qué orden atender los focos activos. Es
 * una pregunta distinta de la de ActionRecommendation, que mira dentro de UN incidente
 * y no compara con los demás. */
export interface IncidentTriage {
  readonly generatedAt: string;
  readonly status: TriageStatus;
  readonly order: readonly TriageEntry[];
  /** Qué modelo ordenó esto. `null` cuando no ordenó ninguno. */
  readonly model: string | null;
}

// Debe reflejar api/src/live/situationBriefing.ts — misma razón de la duplicación que
// arriba, no hay path compartido entre los dos proyectos TS.
export type BriefingStatus = 'briefed' | 'quiet' | 'unavailable';

/**
 * Respuesta de GET /api/live-fires/briefing: el parte del ÁREA COMPLETA, no de un
 * incidente. Combina todos los incendios activos con el riesgo de ignición del
 * forecast en un solo texto. `status` dice de dónde sale: "briefed" lo ha escrito el
 * modelo, "quiet" es el caso sin incendios (no se llama a Nebius siquiera) y
 * "unavailable" es Nebius caído — nunca un parte a medias disfrazado de parte.
 */
export interface SituationBriefing {
  readonly status: BriefingStatus;
  readonly generatedAt: string;
  readonly observedAt: string;
  readonly activeFires: number;
  readonly riskZones: number;
  readonly summary: string;
  readonly topConcerns: readonly string[];
  readonly requiresHumanReview: true;
}
