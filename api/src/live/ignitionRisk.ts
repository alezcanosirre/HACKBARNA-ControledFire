import { cellToLatLng } from "h3-js";

import { BBOX_RMB } from "./bbox";
import { fetchIgnitionHistory } from "./ignitionHistory";
import { fetchWeatherGrid, nearestSample } from "./weather";
import { nearestPlace } from "./placeName";

/**
 * Riesgo de IGNICIÓN por celda: dónde es probable que empiece un incendio, no hacia
 * dónde iría uno que ya arde (eso es `fire-spread`).
 *
 * **Esto es una HEURÍSTICA, no un modelo.** No está validada contra nada y no debe
 * presentarse como una predicción. Lo que hace es combinar dos cosas que sí son
 * medidas:
 *
 *   - DÓNDE: la densidad histórica de igniciones (ignitionHistory.ts). Sitios donde ya
 *     han empezado incendios vuelven a arder: orografía, usos del suelo y accesos no
 *     cambian de un año para otro.
 *   - CUÁNTO: la meteo de ahora (weather.ts). Humedad baja, calor y viento.
 *
 * Multiplicativa y no aditiva a propósito: sin histórico no se declara riesgo por mucho
 * que apriete el calor. Es una decisión conservadora y defendible — solo se señala donde
 * hay evidencia de que puede arder, en vez de pintar media Catalunya en ámbar porque
 * hace un día de verano.
 *
 * Cada término sale como un `driver` con su peso, así que la interfaz enseña el método
 * en vez de un número salido de ninguna parte.
 */

export interface RiskDriver {
  readonly factor: string;
  readonly contribution: number; // 0-1
  readonly value: string; // ya formateado para la interfaz
}

export interface IgnitionRiskCell {
  readonly cell_id: string; // H3 res-8
  readonly risk: number; // 0-1
  readonly drivers: readonly RiskDriver[];
  readonly lat: number;
  readonly lng: number;
  /**
   * Cómo se llama esto. DERIVADO, no medido: el municipio más cercano a la celda
   * (placeName.ts), que por eso viene ya con "near" delante — una celda a tres
   * kilómetros de un pueblo no está EN ese pueblo. `null` si no se pudo nombrar.
   *
   * Existe porque sin él la única forma de decir dónde está una zona era su coordenada,
   * y una lista de cinco zonas ordenadas por riesgo escrita en grados no se lee: para
   * comparar dos sitios hay que poder nombrarlos. Un caso de ejercicio trae el suyo
   * escrito (simulatedRiskCells.ts) y no pasa por la tabla.
   */
  readonly place: string | null;
  /** Horas de previsión que cubre este número. Lo que la interfaz enseña como horizonte. */
  readonly horizonHours: number;
  /**
   * El porqué de esta celda, escrito por el modelo (ignitionAssessment.ts). Vacío cuando
   * se está sirviendo la heurística: no se inventa una frase para tapar el hueco, la
   * interfaz dice de dónde viene el número.
   */
  readonly rationale?: string;
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Por debajo de esto no se pinta nada (spec.md §4.7). */
export const RISK_FLOOR = 0.25;

/** Pesos de la parte meteorológica. Suman 1; son un punto de partida, no una calibración. */
export const WEIGHTS = { dryness: 0.45, heat: 0.3, wind: 0.25 };

/**
 * Los tres términos meteorológicos, exportados porque un escenario de ejercicio los
 * calcula igual (simulatedRiskCells.ts). Misma fórmula para el dato real y para el
 * supuesto: si la base de comparación fuera distinta, el modelo estaría puntuando dos
 * escalas y creyendo que es una.
 */
export function weatherTerms(w: {
  readonly temperatureC: number;
  readonly humidityPct: number;
  readonly windSpeedKmh: number;
}) {
  return {
    // 60% de humedad no seca nada; 15% es combustible listo.
    dryness: clamp01((60 - w.humidityPct) / 45),
    // 18 °C es un día suave; 35 °C es el peor caso de aquí.
    heat: clamp01((w.temperatureC - 18) / 17),
    // Satura a 40 km/h, que es donde el viento deja de ser el factor limitante.
    wind: clamp01(w.windSpeedKmh / 40),
  };
}

export async function buildIgnitionRisk(): Promise<IgnitionRiskCell[]> {
  const [history, samples] = await Promise.all([
    fetchIgnitionHistory(),
    fetchWeatherGrid(BBOX_RMB),
  ]);
  if (history.size === 0) return [];

  // Normalización por raíz: sin ella una celda con veinte igniciones aplasta a todas las
  // demás y el mapa se queda con un punto rojo y nada más. La raíz comprime la cola.
  const maxCount = Math.max(...history.values());
  const norm = (count: number) => Math.sqrt(count) / Math.sqrt(maxCount);

  const cells: IgnitionRiskCell[] = [];

  for (const [cellId, count] of history) {
    const [lat, lng] = cellToLatLng(cellId);
    const w = nearestSample(samples, lat, lng);
    const t = weatherTerms(w);

    const weather = WEIGHTS.dryness * t.dryness + WEIGHTS.heat * t.heat + WEIGHTS.wind * t.wind;
    const base = norm(count);
    // El suelo de 0,4 evita que un día húmedo borre del mapa una zona que arde cada año.
    const risk = clamp01(base * (0.4 + 0.6 * weather));
    if (risk < RISK_FLOOR) continue;

    cells.push({
      cell_id: cellId,
      risk,
      lat,
      lng,
      place: nearestPlace(lat, lng),
      horizonHours: w.horizonHours,
      drivers: [
        {
          factor: "history",
          contribution: base,
          value: `${count} ignition${count === 1 ? "" : "s"} since 2024`,
        },
        // Los valores son el PEOR momento de la ventana, no el de ahora — ver weather.ts.
        {
          factor: "fuel_dryness",
          contribution: t.dryness,
          value: `${Math.round(w.humidityPct)}% humidity, lowest`,
        },
        {
          factor: "temperature",
          contribution: t.heat,
          value: `${w.temperatureC.toFixed(0)} °C, peak`,
        },
        {
          factor: "wind_speed",
          contribution: t.wind,
          value: `${w.windSpeedKmh.toFixed(0)} km/h, peak`,
        },
      ],
    });
  }

  // Mayor primero: si algo hay que recortar aguas abajo, que se recorte lo de menos peso.
  return cells.sort((a, b) => b.risk - a.risk);
}
