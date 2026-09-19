import { getDeepfireToken } from "./deepfireAuth";

const BASE = "https://api.deepfire.co/ogc/features/v1/collections";

export interface OgcFeature<P, G> {
  readonly id?: string;
  readonly geometry: G;
  readonly properties: P;
}

export interface OgcFeatureCollection<P, G> {
  readonly type: "FeatureCollection";
  readonly features: readonly OgcFeature<P, G>[];
}

/**
 * GET .../collections/{collection}/items — cliente genérico para las tres
 * colecciones OGC Features de Deepfire (hotspots, clusters,
 * satellite-perimeters). `params` va tal cual como query string: se espera
 * `bbox`, `filter`/`filter-lang`, `limit`, etc.
 */
export async function fetchOgcFeatures<P, G>(
  collection: string,
  params: Record<string, string>,
): Promise<OgcFeatureCollection<P, G>> {
  const token = await getDeepfireToken();

  const url = new URL(`${BASE}/${collection}/items`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("f", "application/geo+json");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Deepfire ${collection} request failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as OgcFeatureCollection<P, G>;
}
