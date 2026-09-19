import { runFireSpread } from "./deepfireFireSpread";
import { cellsForMultiPolygon } from "./h3FromGeometry";
import { RES_ACTIVE } from "./constants";

// No tiene sentido re-simular la propagación cada 2 min — es una
// simulación pesada (elmfire/forefire), no una consulta. 30 min es un
// punto de partida razonable para una demo, ajustable si hace falta.
const CACHE_MS = Number(process.env.FIRE_SPREAD_CACHE_MS ?? 30 * 60_000);
// Solo pintamos como "riesgo inminente" las primeras N horas simuladas —
// el resto del horizonte (hasta 24h) existe pero no se usa aquí todavía.
const RISK_HOURS = Number(process.env.FIRE_SPREAD_RISK_HOURS ?? 6);

interface CacheEntry {
  readonly cellIds: ReadonlySet<string>;
  readonly updatedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Set<string>();

export function getCachedRiskCells(clusterId: string): ReadonlySet<string> {
  return cache.get(clusterId)?.cellIds ?? new Set();
}

/**
 * No bloquea: si hace falta, dispara la simulación en segundo plano y
 * actualiza la caché cuando termine (puede tardar minutos). El ciclo de
 * refresco principal llama a esto y sigue con lo suyo sin esperar.
 */
export function ensureRiskSimulation(clusterId: string): void {
  const entry = cache.get(clusterId);
  const fresh = entry !== undefined && Date.now() - entry.updatedAt < CACHE_MS;
  if (fresh || inFlight.has(clusterId)) return;

  inFlight.add(clusterId);
  runFireSpread(clusterId)
    .then((sim) => {
      const cellIds = new Set<string>();
      if (sim.status === "COMPLETED" && sim.result) {
        for (const feature of sim.result.features) {
          if (feature.properties.hour > RISK_HOURS) continue;
          for (const cellId of cellsForMultiPolygon(feature.geometry, RES_ACTIVE)) {
            cellIds.add(cellId);
          }
        }
      }
      // NO_SPREAD/FAILED → celdas vacías, pero se cachea igual: es un
      // resultado válido (o al menos uno que no vale la pena reintentar
      // cada 2 min), no un fallo nuestro.
      cache.set(clusterId, { cellIds, updatedAt: Date.now() });
    })
    .catch((err) => {
      console.error(`[live] fire-spread para cluster ${clusterId} falló:`, err);
      // No se cachea el fallo — se reintenta en el próximo ciclo.
    })
    .finally(() => {
      inFlight.delete(clusterId);
    });
}
