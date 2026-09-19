import { fetchOgcFeatures } from "./ogcClient";
import { BBOX_RMB } from "./bbox";
import type { MultiPolygonGeometry } from "./geometry";

interface PerimeterProperties {
  readonly cluster_id: string;
  readonly computed_at: string;
}

export interface LivePerimeter {
  readonly clusterId: string;
  readonly computedAt: string;
  readonly geometry: MultiPolygonGeometry;
}

export async function fetchActivePerimetersInRmb(): Promise<LivePerimeter[]> {
  const body = await fetchOgcFeatures<PerimeterProperties, MultiPolygonGeometry>(
    "deepfire:satellite-perimeters",
    {
      bbox: BBOX_RMB.join(","),
      "filter-lang": "cql2-text",
      filter: "active = true",
    },
  );

  return body.features
    .filter((f) => f.geometry?.type === "MultiPolygon")
    .map((f) => ({
      clusterId: f.properties.cluster_id,
      computedAt: f.properties.computed_at,
      geometry: f.geometry,
    }));
}

/**
 * Hay una fila por snapshot histórico del perímetro (§ "Satellite
 * perimeters": "a cluster gets a new row whenever its perimeter geometry
 * materially changes, and older snapshots are kept") — nos quedamos con la
 * más reciente por cluster para saber qué está ardiendo AHORA.
 */
export function latestPerimeterPerCluster(
  perimeters: readonly LivePerimeter[],
): Map<string, LivePerimeter> {
  const latest = new Map<string, LivePerimeter>();
  for (const p of perimeters) {
    const prev = latest.get(p.clusterId);
    if (!prev || p.computedAt > prev.computedAt) {
      latest.set(p.clusterId, p);
    }
  }
  return latest;
}
