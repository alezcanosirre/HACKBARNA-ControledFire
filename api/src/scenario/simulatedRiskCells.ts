/**
 * Celdas de riesgo de ignición para el modo SIMULACIÓN, hermanas de
 * simulatedFireCases.ts: mismo criterio, otra pregunta. Allí es dónde arde ahora; aquí
 * es dónde puede empezar a arder en las próximas 24 horas.
 *
 * Existen porque con SIMULACIÓN encendida el feed en vivo se apaga —las dos fuentes no
 * comparten pantalla— y PRED se quedaba sin nada que enseñar. Un pronóstico vacío es
 * correcto cuando de verdad no hay riesgo, pero no es lo que se enseña en una demo.
 *
 * DATO INVENTADO A PROPÓSITO, como en los incendios. La diferencia con el feed real es
 * la misma de siempre: aquí cada celda tiene topónimo, y el real solo coordenadas.
 *
 * Lo que NO se inventa es la puntuación. Estas celdas entran por el mismo camino que
 * las medidas (api/src/live/ignitionAssessment.ts): el modelo las puntúa y escribe su
 * análisis igual que con las reales, con la misma fórmula de referencia debajo.
 */

export interface SimulatedRiskCell {
  readonly id: string;
  readonly place: string;
  readonly lat: number;
  readonly lng: number;
  /**
   * Igniciones históricas en esa celda. Es el eje que dice DÓNDE: sitios donde ya han
   * empezado incendios vuelven a arder, porque la orografía, los usos del suelo y los
   * accesos no cambian de un año para otro.
   */
  readonly ignitionsSince2024: number;
  /** El peor momento de las próximas 24 h, que es el que decide si un día arde. */
  readonly weather: {
    readonly temperatureC: number;
    readonly humidityPct: number;
    readonly windSpeedKmh: number;
    readonly windDirectionDeg: number;
  };
  /**
   * Radio en anillos H3 alrededor del centro (0 = solo esa celda). Un punto de riesgo
   * real es eso, un punto — pero una demo con cinco píxeles sueltos no se lee como "zona
   * de riesgo", se lee como ruido. Las dos peores (Garraf, Collserola) se expanden en un
   * área para que la rampa de color (pred/risk.ts) se vea DENTRO de una zona, no solo
   * entre zonas — rojo en el centro, ámbar en el borde. Las otras tres quedan como punto
   * único a propósito: la variedad (dos manchas grandes + tres puntos) es lo que dice
   * "esto es un mapa de riesgo real", no una fila de zonas idénticas.
   */
  readonly ringRadius: number;
}

/**
 * Cinco celdas repartidas para que el mapa tenga rango, no una mancha uniforme: el
 * Garraf como punto caliente —mucho histórico y poniente seco—, el Montseny con
 * histórico alto pero aire húmedo, y tres intermedias. Si todas puntuaran parecido, la
 * rampa de color no diría nada.
 */
export const SIMULATED_RISK_CELLS: readonly SimulatedRiskCell[] = [
  {
    id: "risk-garraf",
    place: "Garraf — Pla de Querol",
    lat: 41.28,
    lng: 1.85,
    ignitionsSince2024: 21,
    weather: { temperatureC: 33, humidityPct: 16, windSpeedKmh: 38, windDirectionDeg: 250 },
    ringRadius: 2,
  },
  {
    id: "risk-collserola",
    place: "Collserola — Vallvidrera ridge",
    lat: 41.43,
    lng: 2.09,
    ignitionsSince2024: 14,
    weather: { temperatureC: 31, humidityPct: 24, windSpeedKmh: 27, windDirectionDeg: 315 },
    ringRadius: 2,
  },
  {
    id: "risk-montseny",
    place: "Montseny — Coll Formic",
    lat: 41.77,
    lng: 2.4,
    ignitionsSince2024: 17,
    weather: { temperatureC: 26, humidityPct: 52, windSpeedKmh: 12, windDirectionDeg: 20 },
    ringRadius: 0,
  },
  {
    id: "risk-montnegre",
    place: "Montnegre — Sant Martí",
    lat: 41.66,
    lng: 2.58,
    ignitionsSince2024: 8,
    weather: { temperatureC: 29, humidityPct: 34, windSpeedKmh: 22, windDirectionDeg: 200 },
    ringRadius: 0,
  },
  {
    id: "risk-valles",
    place: "Vallès — Sant Llorenç",
    lat: 41.6,
    lng: 2.05,
    ignitionsSince2024: 3,
    weather: { temperatureC: 30, humidityPct: 28, windSpeedKmh: 25, windDirectionDeg: 240 },
    ringRadius: 0,
  },
];

export function simulatedRiskCellById(id: string): SimulatedRiskCell | undefined {
  return SIMULATED_RISK_CELLS.find((c) => c.id === id);
}
