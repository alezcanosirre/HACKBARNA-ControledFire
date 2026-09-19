import type { LiveFireSummary } from "./liveFireState";

/**
 * La instantánea que se envía a Nebius como `incident`. Se construye ENTERA a partir de
 * `LiveFireSummary` (el estado que ya tiene el servidor de su último ciclo de sondeo,
 * ver liveFireStore.ts) — nunca se re-consulta Deepfire por cluster al recibir un
 * click, así que lo que ve Nebius es exactamente lo que ya ve el mapa.
 *
 * `null` significa siempre "Deepfire no tiene este dato todavía para este incidente",
 * nunca "cero" ni "no aplica" — mismo criterio que en liveFireState.ts.
 */
export interface IncidentSnapshot {
  readonly incidentId: string;
  /** Primera y última detección de satélite confirmadas para este cluster. */
  readonly firstObservedAt: string; // ISO 8601
  readonly lastObservedAt: string; // ISO 8601
  readonly centroid: { readonly lat: number; readonly lng: number };
  /** De la detección de satélite más reciente — no del incidente en conjunto. */
  readonly detection: {
    readonly latestConfidence: "LOW" | "MEDIUM" | "HIGH" | null;
    readonly latestSource: string | null;
    readonly latestFireRadiativePowerMw: number | null;
  };
  /** Del perímetro estimado por satélite más reciente — null si Deepfire aún no ha
   * calculado uno para este cluster (incidente demasiado nuevo). */
  readonly perimeter: {
    readonly areaHa: number | null;
    readonly perimeterM: number | null;
    readonly hotspotsUsed: number | null;
  };
  /** Nº de celdas H3 que arden ahora mismo, según el último ciclo de sondeo. */
  readonly activeCellCount: number;
  /**
   * El tiempo que hace AHORA sobre el incidente, de met.no (weather.ts) — no de
   * Deepfire, que no da meteo.
   *
   * Sin esto el modelo pedía "información meteorológica local verificada" como dato
   * que falta, y la teníamos en la mano: el mapa ya la enseña en la tarjeta del foco.
   * Es además lo que más cambia una recomendación — 88% de humedad y 5 km/h dicen una
   * cosa y 20% con 40 km/h dicen otra muy distinta, con el mismo perímetro vacío.
   */
  readonly weather: {
    readonly temperatureC: number;
    readonly humidityPct: number;
    readonly windSpeedKmh: number;
    readonly windDirectionDeg: number;
    /** Procedencia y hora: el prompt descarta la meteo que no las traiga. */
    readonly source: string;
    readonly observedAt: string; // ISO 8601
  } | null;
}

export function buildIncidentSnapshot(fire: LiveFireSummary): IncidentSnapshot {
  return {
    incidentId: fire.id,
    firstObservedAt: fire.firstObserved,
    lastObservedAt: fire.lastObserved,
    centroid: fire.centroid,
    detection: {
      latestConfidence: fire.confidence,
      latestSource: fire.source,
      latestFireRadiativePowerMw: fire.fireRadiativePowerMw,
    },
    perimeter: {
      areaHa: fire.areaHa,
      perimeterM: fire.perimeterM,
      hotspotsUsed: fire.nHotspots,
    },
    activeCellCount: fire.cellIds.length,
    weather: fire.weather,
  };
}

/**
 * Rutas válidas de `incident.*` que `evidence[].field` puede citar — todo lo demás se
 * considera una respuesta inválida (ver actionRecommendation.ts). Se listan a mano en
 * vez de derivarlas reflexivamente del objeto: son pocas, fijas, y así no dependen de
 * qué claves tenga JSON.stringify ese día.
 */
export const INCIDENT_FIELD_PATHS: readonly string[] = [
  "incident.incidentId",
  "incident.firstObservedAt",
  "incident.lastObservedAt",
  "incident.centroid",
  "incident.centroid.lat",
  "incident.centroid.lng",
  "incident.detection.latestConfidence",
  "incident.detection.latestSource",
  "incident.detection.latestFireRadiativePowerMw",
  "incident.perimeter.areaHa",
  "incident.perimeter.perimeterM",
  "incident.perimeter.hotspotsUsed",
  "incident.activeCellCount",
  "incident.weather",
  "incident.weather.temperatureC",
  "incident.weather.humidityPct",
  "incident.weather.windSpeedKmh",
  "incident.weather.windDirectionDeg",
  "incident.weather.source",
  "incident.weather.observedAt",
];
