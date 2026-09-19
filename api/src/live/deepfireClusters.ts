import { fetchOgcFeatures } from "./ogcClient";
import { BBOX_RMB } from "./bbox";
import type { PointGeometry } from "./geometry";

interface ClusterProperties {
  readonly id?: string;
  readonly first_observed: string;
  readonly last_observed: string;
}

export interface LiveCluster {
  readonly id: string; // uuid crudo — el mismo que cluster_id en hotspots/perímetros
  readonly firstObserved: string;
  readonly lastObserved: string;
  readonly lat: number;
  readonly lng: number;
}

/**
 * `id` en `properties` es el uuid crudo (lo que usan hotspots/perímetros
 * como `cluster_id`); el `id` de nivel Feature viene prefijado
 * ("clusters.<uuid>") y NO sirve para el join — solo se usa como último
 * recurso, quitando el prefijo, si `properties.id` faltara.
 */
function rawClusterId(id: string | undefined, featureId: string | undefined): string {
  if (id) return id;
  if (featureId) return featureId.replace(/^clusters\./, "");
  throw new Error("Deepfire cluster feature sin id");
}

export async function fetchActiveClustersInRmb(): Promise<LiveCluster[]> {
  const body = await fetchOgcFeatures<ClusterProperties, PointGeometry>("deepfire:clusters", {
    bbox: BBOX_RMB.join(","),
    "filter-lang": "cql2-text",
    filter: "active = true",
  });

  return body.features
    .filter((f) => f.geometry?.type === "Point")
    .map((f) => ({
      id: rawClusterId(f.properties.id, f.id),
      firstObserved: f.properties.first_observed,
      lastObserved: f.properties.last_observed,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
}

/** Un cluster concreto por id, sin restringir por bbox ni por `active` — lo pide el
 * endpoint de acciones (POST /api/live-fires/:id/actions), que ya conoce el id exacto
 * porque el operador lo clicó en el mapa. `clusterId` debe validarse como uuid ANTES de
 * llamar a esto (ver isUuid en fireActions.ts): va sin escapar dentro de un filtro CQL2. */
export async function fetchClusterById(clusterId: string): Promise<LiveCluster | null> {
  const body = await fetchOgcFeatures<ClusterProperties, PointGeometry>("deepfire:clusters", {
    "filter-lang": "cql2-text",
    filter: `id = '${clusterId}'`,
    limit: "1",
  });

  const f = body.features.find((f) => f.geometry?.type === "Point");
  if (!f) return null;

  return {
    id: rawClusterId(f.properties.id, f.id),
    firstObserved: f.properties.first_observed,
    lastObserved: f.properties.last_observed,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  };
}
