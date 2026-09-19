import { fetchOgcFeatures } from "./ogcClient";
import { BBOX_BCN_METRO } from "./bbox";
import type { PointGeometry } from "./geometry";

export type HotspotConfidence = "LOW" | "MEDIUM" | "HIGH";

interface HotspotProperties {
  readonly id?: string;
  readonly cluster_id: string;
  readonly observed_at: string;
  readonly source: string;
  readonly confidence: HotspotConfidence;
  readonly fire_radiative_power: number | null;
}

/** Forma reducida que consume el resto del backend — no el GeoJSON crudo. */
export interface LiveHotspot {
  readonly id: string;
  readonly clusterId: string;
  readonly lat: number;
  readonly lng: number;
  readonly observedAt: string;
  readonly source: string;
  readonly confidence: HotspotConfidence;
  readonly fireRadiativePowerMw: number | null;
}

export async function fetchLiveHotspotsInBcnMetro(): Promise<LiveHotspot[]> {
  const body = await fetchOgcFeatures<HotspotProperties, PointGeometry>("deepfire:hotspots", {
    bbox: BBOX_BCN_METRO.join(","),
    "filter-lang": "cql2-text",
    filter: "active = true",
  });

  return body.features
    .filter((f) => f.geometry?.type === "Point")
    .map((f) => ({
      id: f.properties.id ?? f.id ?? crypto.randomUUID(),
      clusterId: f.properties.cluster_id,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      observedAt: f.properties.observed_at,
      source: f.properties.source,
      confidence: f.properties.confidence,
      fireRadiativePowerMw: f.properties.fire_radiative_power,
    }));
}
