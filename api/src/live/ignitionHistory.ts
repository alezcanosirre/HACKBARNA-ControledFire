import { latLngToCell } from "h3-js";

import { BBOX_RMB } from "./bbox";
import { RES_ACTIVE } from "./constants";
import { fetchOgcFeatures } from "./ogcClient";
import { cellsForMultiPolygon } from "./h3FromGeometry";
import type { MultiPolygonGeometry, PointGeometry } from "./geometry";

/**
 * Dónde han empezado incendios de verdad, según el histórico de Deepfire.
 *
 * `deepfire:clusters` guarda "current and historical", así que una consulta con
 * `datetime` y sin el filtro `active` devuelve todos los focos que ha habido en la zona
 * — 601 en la RMB desde 2025. Agregados a la rejilla H3 dan una densidad de ignición:
 * base histórica medida, no un modelo inventado.
 *
 * Es lo único de esto que se puede defender sin una validación: "aquí han empezado doce
 * incendios en dos años" es un hecho. Lo que hace con él `ignitionRisk.ts` ya es una
 * heurística, y allí está dicho.
 */

/** Desde cuándo se cuenta. Dos años da estacionalidad sin arrastrar cambios de uso del suelo. */
const SINCE = process.env.IGNITION_HISTORY_SINCE ?? "2024-01-01T00:00:00Z";

// El histórico no cambia en una demo. Se pide una vez y se guarda para el proceso.
let cache: Map<string, number> | null = null;

interface ClusterProperties {
  readonly first_observed: string;
}

interface StaticHeatProperties {
  readonly type: string;
  readonly remarks: string | null;
}

/**
 * Máscara de anomalías térmicas permanentes: incineradoras, industria, reflejos. Disparan
 * detecciones de satélite sin ser fuego. Sin restarlas, un polígono industrial sale como
 * la zona de mayor riesgo del mapa.
 */
async function fetchExcludedCells(): Promise<Set<string>> {
  const body = await fetchOgcFeatures<StaticHeatProperties, MultiPolygonGeometry | { type: "Polygon"; coordinates: MultiPolygonGeometry["coordinates"][number] }>(
    "deepfire:static-heat-sources",
    { bbox: BBOX_RMB.join(","), limit: "1000" },
  );

  const excluded = new Set<string>();
  for (const feature of body.features) {
    // La colección devuelve Polygon, no MultiPolygon: se envuelve para reutilizar el
    // mismo rasterizado que usan los perímetros.
    const geometry =
      feature.geometry.type === "Polygon"
        ? ({ type: "MultiPolygon", coordinates: [feature.geometry.coordinates] } as MultiPolygonGeometry)
        : (feature.geometry as MultiPolygonGeometry);
    for (const cellId of cellsForMultiPolygon(geometry, RES_ACTIVE)) {
      excluded.add(cellId);
    }
  }
  return excluded;
}

/** Ignición histórica por celda H3, ya descontadas las fuentes de calor permanentes. */
export async function fetchIgnitionHistory(): Promise<ReadonlyMap<string, number>> {
  if (cache) return cache;

  const now = new Date().toISOString();
  const [clusters, excluded] = await Promise.all([
    fetchOgcFeatures<ClusterProperties, PointGeometry>("deepfire:clusters", {
      bbox: BBOX_RMB.join(","),
      limit: "5000",
      datetime: `${SINCE}/${now}`,
    }),
    fetchExcludedCells(),
  ]);

  const counts = new Map<string, number>();
  for (const feature of clusters.features) {
    if (feature.geometry?.type !== "Point") continue;
    const [lng, lat] = feature.geometry.coordinates;
    const cellId = latLngToCell(lat, lng, RES_ACTIVE);
    if (excluded.has(cellId)) continue;
    counts.set(cellId, (counts.get(cellId) ?? 0) + 1);
  }

  cache = counts;
  return counts;
}
