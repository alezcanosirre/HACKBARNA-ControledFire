import { getDeepfireToken } from "./deepfireAuth";
import { BBOX_BCN_METRO, isInBbox } from "./bbox";

const HOTSPOTS_URL =
  "https://api.deepfire.co/ogc/features/v1/collections/deepfire:hotspots/items";

/** Confianza de la detección, tal cual la devuelve Deepfire. */
export type HotspotConfidence = "LOW" | "MEDIUM" | "HIGH";

/** Forma reducida que consume el frontend — no el GeoJSON crudo de Deepfire. */
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

interface DeepfireFeature {
  id?: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    id?: string;
    cluster_id: string;
    observed_at: string;
    source: string;
    confidence: HotspotConfidence;
    fire_radiative_power: number | null;
    country: string | null;
    active: boolean;
  };
}

interface DeepfireFeatureCollection {
  type: "FeatureCollection";
  features: DeepfireFeature[];
}

/**
 * Trae los hotspots activos en España desde Deepfire y los recorta al
 * área metropolitana de Barcelona (BBOX_BCN_METRO).
 *
 * El filtro `country = 'ES'` se aplica en el servidor de Deepfire (mismo
 * patrón que su ejemplo "Live detections in one country") para no traer el
 * dataset global; el recorte fino a BCN se hace aquí en cliente porque no
 * está confirmado que `/items` acepte aquí un `bbox=` nativo — si se
 * confirma en la doc ("Filtering"), se puede mover el recorte al filtro
 * CQL2 y ahorrar la llamada de sobra.
 */
export async function fetchLiveHotspotsInBcnMetro(): Promise<LiveHotspot[]> {
  const token = await getDeepfireToken();

  const url = new URL(HOTSPOTS_URL);
  url.searchParams.set("filter-lang", "cql2-text");
  url.searchParams.set("filter", "active = true AND country = 'ES'");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("f", "application/geo+json");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Deepfire hotspots request failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as DeepfireFeatureCollection;

  return body.features
    .filter((f) => f.geometry?.type === "Point")
    .filter((f) => isInBbox(f.geometry.coordinates[0], f.geometry.coordinates[1], BBOX_BCN_METRO))
    .map((f) => ({
      id: f.id ?? f.properties.id ?? crypto.randomUUID(),
      clusterId: f.properties.cluster_id,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      observedAt: f.properties.observed_at,
      source: f.properties.source,
      confidence: f.properties.confidence,
      fireRadiativePowerMw: f.properties.fire_radiative_power,
    }));
}
