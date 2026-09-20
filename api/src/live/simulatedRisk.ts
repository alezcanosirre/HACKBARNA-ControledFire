import { cellToLatLng, gridDisk, gridDistance, latLngToCell } from "h3-js";

import { SIMULATED_RISK_CELLS } from "../scenario/simulatedRiskCells";
import { RES_ACTIVE } from "./constants";
import { assessIgnitionRisk, type IgnitionAssessment } from "./ignitionAssessment";
import { RISK_FLOOR, WEIGHTS, clamp01, weatherTerms, type IgnitionRiskCell } from "./ignitionRisk";

/**
 * Cuánto cae el riesgo por anillo de distancia al centro de una zona — 1.0 en el
 * centro, 0.78 en el primer anillo, 0.56 en el segundo. Con `ringRadius: 2` y un
 * centro por encima de ~0.45 esto deja una mancha de hasta 19 celdas antes de que el
 * borde caiga bajo RISK_FLOOR; con un centro más bajo la mancha sale más pequeña sola,
 * que es lo correcto — un foco de riesgo flojo no debería pintar tanto como uno fuerte.
 */
const RING_FALLOFF = 0.22;

/**
 * Las celdas de riesgo de un ejercicio, puestas en la misma forma que las medidas.
 *
 * Lo único propio de aquí es de dónde salen los números; a partir de esta función son
 * `IgnitionRiskCell` indistinguibles de las reales, así que pasan por el mismo modelo,
 * el mismo prompt y la misma fórmula de referencia. Un escenario que se puntuara por su
 * cuenta no serviría para enseñar el producto: enseñaría otro producto.
 *
 * La normalización del histórico se hace DENTRO del propio escenario — la celda con más
 * igniciones del ejercicio es el 1,0 del ejercicio. Compartir la escala con el feed real
 * ataría lo que se ve en la demo a cuántos incendios haya habido esta temporada.
 */
export function buildSimulatedRiskCells(): IgnitionRiskCell[] {
  const maxCount = Math.max(...SIMULATED_RISK_CELLS.map((c) => c.ignitionsSince2024), 1);
  const horizonHours = Number(process.env.FORECAST_HOURS ?? 24);

  const cells: IgnitionRiskCell[] = [];

  for (const c of SIMULATED_RISK_CELLS) {
    const t = weatherTerms(c.weather);
    const weather = WEIGHTS.dryness * t.dryness + WEIGHTS.heat * t.heat + WEIGHTS.wind * t.wind;
    const base = Math.sqrt(c.ignitionsSince2024) / Math.sqrt(maxCount);
    const centerRisk = clamp01(base * (0.4 + 0.6 * weather));
    if (centerRisk < RISK_FLOOR) continue;

    const centerCellId = latLngToCell(c.lat, c.lng, RES_ACTIVE);
    const zoneCellIds = c.ringRadius > 0 ? gridDisk(centerCellId, c.ringRadius) : [centerCellId];

    for (const cellId of zoneCellIds) {
      const ring = gridDistance(centerCellId, cellId);
      // Anillo 0 = riesgo pleno; cada anillo hacia fuera lo reduce — así una zona
      // "grande" se ve más roja en el centro y más ámbar en el borde, la misma rampa
      // de pred/risk.ts pero DENTRO de una sola zona en vez de solo entre zonas.
      const risk = clamp01(centerRisk * (1 - ring * RING_FALLOFF));
      if (risk < RISK_FLOOR) continue;

      const [lat, lng] = ring === 0 ? [c.lat, c.lng] : cellToLatLng(cellId);

      cells.push({
        cell_id: cellId,
        risk,
        lat,
        lng,
        // El topónimo escrito en el caso, no el de la tabla de municipios: un ejercicio
        // nombra sus zonas ("Garraf — Pla de Querol") con más precisión que el municipio
        // más cercano, y todas las celdas de una misma zona comparten el nombre — que es
        // lo que deja agruparlas en una sola fila del top.
        place: c.place,
        horizonHours,
        drivers: [
          {
            factor: "history",
            contribution: base,
            value: `${c.ignitionsSince2024} ignition${c.ignitionsSince2024 === 1 ? "" : "s"} since 2024 near ${c.place}`,
          },
          {
            factor: "fuel_dryness",
            contribution: t.dryness,
            value: `${Math.round(c.weather.humidityPct)}% humidity, lowest`,
          },
          {
            factor: "temperature",
            contribution: t.heat,
            value: `${c.weather.temperatureC.toFixed(0)} °C, peak`,
          },
          {
            factor: "wind_speed",
            contribution: t.wind,
            value: `${c.weather.windSpeedKmh.toFixed(0)} km/h, peak`,
          },
        ],
      });
    }
  }

  return cells.sort((a, b) => b.risk - a.risk);
}

/**
 * Se cachea el resultado entero: el escenario es estático, así que volver a pedirlo al
 * modelo en cada carga de la página sería pagar dos veces por la misma respuesta.
 */
let cached: IgnitionAssessment | null = null;

export async function getSimulatedRiskAssessment(): Promise<IgnitionAssessment> {
  if (cached) return cached;
  cached = await assessIgnitionRisk(buildSimulatedRiskCells());
  return cached;
}
