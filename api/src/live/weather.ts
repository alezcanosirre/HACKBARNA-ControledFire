/**
 * Meteo actual, de met.no.
 *
 * Deepfire no da tiempo: sus cuatro colecciones son detección (hotspots, clusters,
 * perímetros y la máscara de falsos positivos). El riesgo de IGNICIÓN necesita
 * temperatura, humedad y viento, así que vienen de fuera.
 *
 * met.no y no Open-Meteo porque Open-Meteo devuelve "Daily API request limit exceeded"
 * desde esta red. met.no es libre, sin clave, y solo exige un User-Agent que identifique
 * a quien llama — el suyo es el contrato, no una formalidad: sin él bloquean.
 *
 * Una llamada por punto, así que se muestrea una rejilla gruesa: el tiempo sinóptico no
 * cambia de un kilómetro al siguiente, y 9 puntos sobre la RMB bastan para la variación
 * que importa (mar contra interior, llano contra sierra).
 *
 * **Se lee la PREVISIÓN, no el momento actual.** PRED habla de las próximas 24 horas, y
 * un riesgo a 24 h calculado con la humedad de ahora sería una etiqueta que miente: a
 * las diez de la noche hay 88% de humedad y mañana a las tres de la tarde no. De la
 * ventana se toma el PEOR momento —mínima humedad, máxima temperatura, máximo viento—,
 * que es lo que decide si un día arde: un incendio empieza en el peor rato, no en el
 * promedio.
 */

const USER_AGENT = "ControlledFire/0.1 hackathon (https://github.com/alezcanosirre/HACKBARNA-ControledFire)";
const FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";

// met.no pide cachear y no repetir llamadas antes de que cambie el dato. Media hora es
// más fino que su propio ritmo de actualización.
const CACHE_MS = Number(process.env.WEATHER_CACHE_MS ?? 30 * 60_000);

/** Horizonte de la previsión, en horas. Es el `horizon_h` que enseña la interfaz. */
export const FORECAST_HOURS = Number(process.env.FORECAST_HOURS ?? 24);

export interface WeatherSample {
  readonly lat: number;
  readonly lng: number;
  /** El peor momento de la ventana, no el actual. Ver la cabecera de este fichero. */
  readonly temperatureC: number;
  readonly humidityPct: number;
  readonly windSpeedKmh: number;
  readonly windDirectionDeg: number;
  /** Cuándo se da ese peor momento, para poder decirlo en la interfaz. */
  readonly worstAt: string;
  readonly horizonHours: number;
  /**
   * El momento actual, aparte del peor de la ventana. Un incendio que arde AHORA se
   * describe con el tiempo que hace ahora; el pico de mañana es para el pronóstico.
   * Dos preguntas distintas sobre la misma serie, y cada tarjeta lee la suya.
   */
  readonly current: {
    readonly temperatureC: number;
    readonly humidityPct: number;
    readonly windSpeedKmh: number;
    readonly windDirectionDeg: number;
  };
}

interface MetNoEntry {
  readonly time: string;
  readonly data: {
    readonly instant: {
      readonly details: {
        readonly air_temperature: number;
        readonly relative_humidity: number;
        readonly wind_speed: number; // m/s
        readonly wind_from_direction: number;
      };
    };
  };
}

interface MetNoResponse {
  readonly properties: { readonly timeseries: readonly MetNoEntry[] };
}

/**
 * De la ventana, el rato que más pesa. No es el mismo instante para cada variable: la
 * mínima de humedad y la máxima de viento pueden caer a horas distintas, y usar las dos
 * es lo correcto — el riesgo lo marca cada factor en su peor momento, no un instante
 * concreto. `worstAt` es la hora de la mínima de humedad, que es la que más manda.
 */
function worstOfWindow(entries: readonly MetNoEntry[]): Omit<WeatherSample, 'lat' | 'lng'> {
  let temperatureC = -Infinity;
  let humidityPct = Infinity;
  let windSpeedKmh = -Infinity;
  let windDirectionDeg = 0;
  let worstAt = entries[0].time;

  for (const entry of entries) {
    const d = entry.data.instant.details;
    if (d.air_temperature > temperatureC) temperatureC = d.air_temperature;
    if (d.wind_speed * 3.6 > windSpeedKmh) {
      windSpeedKmh = d.wind_speed * 3.6;
      windDirectionDeg = d.wind_from_direction;
    }
    if (d.relative_humidity < humidityPct) {
      humidityPct = d.relative_humidity;
      worstAt = entry.time;
    }
  }

  const now = entries[0].data.instant.details;

  return {
    temperatureC,
    humidityPct,
    windSpeedKmh,
    windDirectionDeg,
    worstAt,
    horizonHours: FORECAST_HOURS,
    current: {
      temperatureC: now.air_temperature,
      humidityPct: now.relative_humidity,
      windSpeedKmh: now.wind_speed * 3.6,
      windDirectionDeg: now.wind_from_direction,
    },
  };
}

async function fetchPoint(lat: number, lng: number): Promise<WeatherSample> {
  const url = `${FORECAST_URL}?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`met.no request failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as MetNoResponse;
  const cutoff = Date.now() + FORECAST_HOURS * 60 * 60_000;
  const window = body.properties.timeseries.filter((e) => Date.parse(e.time) <= cutoff);
  if (window.length === 0) throw new Error("met.no devolvió una serie temporal vacía");

  return { lat, lng, ...worstOfWindow(window) };
}

/** Rejilla de muestreo sobre un bbox. `n` puntos por lado. */
function samplePoints(
  bbox: readonly [number, number, number, number],
  n: number,
): Array<[number, number]> {
  const [w, s, e, nth] = bbox;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Centros de celda, no esquinas: una esquina del bbox cae en el mar o fuera.
      points.push([s + ((i + 0.5) * (nth - s)) / n, w + ((j + 0.5) * (e - w)) / n]);
    }
  }
  return points;
}

let cache: { samples: WeatherSample[]; at: number } | null = null;

/** La meteo de la zona, muestreada y cacheada. Lanza si fallan TODOS los puntos. */
export async function fetchWeatherGrid(
  bbox: readonly [number, number, number, number],
  perSide = 3,
): Promise<WeatherSample[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.samples;

  const results = await Promise.allSettled(
    samplePoints(bbox, perSide).map(([lat, lng]) => fetchPoint(lat, lng)),
  );
  const samples = results
    .filter((r): r is PromiseFulfilledResult<WeatherSample> => r.status === "fulfilled")
    .map((r) => r.value);

  // Que falle un punto no invalida la rejilla; que fallen todos sí, y entonces es mejor
  // no publicar un riesgo calculado sobre nada.
  if (samples.length === 0) throw new Error("met.no: fallaron todos los puntos de muestreo");

  cache = { samples, at: Date.now() };
  return samples;
}

/** La muestra más cercana a un punto. Vecino más próximo, que a esta escala sobra. */
export function nearestSample(
  samples: readonly WeatherSample[],
  lat: number,
  lng: number,
): WeatherSample {
  let best = samples[0];
  let bestDistance = Infinity;
  for (const sample of samples) {
    const distance = (sample.lat - lat) ** 2 + (sample.lng - lng) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = sample;
    }
  }
  return best;
}
