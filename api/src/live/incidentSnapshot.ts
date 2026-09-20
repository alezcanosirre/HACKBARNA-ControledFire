import type { SimulatedFireCase } from "../scenario/simulatedFireCases";
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
  /**
   * De dónde sale este incidente, y por tanto cuánto se puede fiar el modelo de él.
   *
   * "satellite-detection" es un aviso de satélite sin confirmar sobre el terreno;
   * "exercise-scenario" es un caso de ejercicio, donde los datos son firmes por
   * definición y no hay nada que verificar. Sin esta distinción el prompt trata los dos
   * igual y recomienda "verificad el aviso" para un escenario cuyos datos son un
   * supuesto, no una detección.
   */
  readonly provenance: "satellite-detection" | "exercise-scenario";
  /** Topónimo legible. Para un incendio real, el municipio más cercano a su centroide
   * (placeName.ts); para un caso de ejercicio, el que trae escrito. */
  readonly place: string | null;
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
  /** Nº de celdas que arden ahora mismo, según el último ciclo de sondeo. */
  readonly activeCellCount: number;
  /**
   * Terreno, propagación y qué hay cerca. Todo `null` para un incidente real: Deepfire
   * no tiene usos del suelo, ni modelo de combustible, ni un endpoint de valores en
   * riesgo, y las tasas de propagación quedan fuera de su contrato.
   *
   * Un caso de ejercicio sí los trae, y son justo los campos que el modelo lleva
   * pidiendo en `missingData`. Es la diferencia entre "verificad esto" y una prioridad
   * de verdad.
   */
  readonly zone: {
    readonly landCover: string;
    readonly slopeDeg: number;
    readonly fuelLoad: string;
  } | null;
  readonly spread: {
    readonly directionDeg: number;
    readonly speedKmh: number;
  } | null;
  readonly valuesAtRisk: readonly {
    readonly type: string;
    readonly name: string;
    readonly distanceKm: number;
    readonly population: number | null;
    /** ¿Está en la trayectoria del viento? Es lo que convierte cercanía en urgencia. */
    readonly downwind: boolean;
  }[] | null;
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
    provenance: "satellite-detection",
    // Derivado del centroide, no de Deepfire: el municipio más cercano (placeName.ts).
    // Sigue siendo null si el foco cae lejos de cualquiera.
    place: fire.place,
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
    zone: null,
    spread: null,
    valuesAtRisk: null,
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
  "incident.provenance",
  "incident.place",
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
  "incident.zone",
  "incident.zone.landCover",
  "incident.zone.slopeDeg",
  "incident.zone.fuelLoad",
  "incident.spread",
  "incident.spread.directionDeg",
  "incident.spread.speedKmh",
  "incident.valuesAtRisk",
];

/**
 * La instantánea de un caso de ejercicio (api/src/scenario/simulatedFireCases.ts).
 *
 * Mismo contrato que la de un incidente real, con la diferencia que importa: aquí hay
 * terreno, propagación y valores en riesgo, porque el caso los trae escritos. Ese es el
 * motivo de mandar un escenario al modelo — no es que sea más barato, es que con estos
 * campos la recomendación deja de ser "verificad el aviso" y pasa a ordenar prioridades.
 *
 * `provenance: "exercise-scenario"` es lo que le dice al modelo que no tiene nada que
 * confirmar: los datos de un supuesto son firmes por definición.
 */
export function buildSimulatedSnapshot(c: SimulatedFireCase): IncidentSnapshot {
  return {
    incidentId: c.id,
    provenance: "exercise-scenario",
    place: c.name,
    firstObservedAt: c.detectedAt,
    lastObservedAt: c.detectedAt,
    // El caso es una rejilla local sin lat/lng: el ancla geográfica la pone map/, así
    // que aquí el centroide no existe y se declara como tal en vez de inventarlo.
    centroid: { lat: 0, lng: 0 },
    detection: {
      latestConfidence: null,
      latestSource: c.source,
      latestFireRadiativePowerMw: null,
    },
    perimeter: {
      areaHa: c.burnedAreaHa,
      perimeterM: null,
      hotspotsUsed: null,
    },
    activeCellCount: c.burningCells.length,
    weather: {
      temperatureC: c.environment.temperature,
      humidityPct: c.environment.humidity * 100,
      windSpeedKmh: c.environment.wind.speed,
      windDirectionDeg: c.environment.wind.direction,
      source: "exercise scenario",
      observedAt: c.detectedAt,
    },
    zone: {
      landCover: c.zone.landCover,
      slopeDeg: c.zone.slopeDeg,
      fuelLoad: c.zone.fuelLoad,
    },
    spread: {
      directionDeg: c.spread.directionDeg,
      speedKmh: c.spread.speedKmh,
    },
    valuesAtRisk: c.valuesAtRisk.map((v) => ({
      type: v.type,
      name: v.name,
      distanceKm: v.distanceKm,
      population: v.population ?? null,
      downwind: v.downwind,
    })),
  };
}
