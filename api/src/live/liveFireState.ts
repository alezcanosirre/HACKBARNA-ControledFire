import { latLngToCell } from "h3-js";
import { fetchActiveClustersInRmb } from "./deepfireClusters";
import { fetchActivePerimetersInRmb, latestPerimeterPerCluster } from "./deepfirePerimeters";
import { fetchLiveHotspotsInRmb, type HotspotConfidence, type LiveHotspot } from "./deepfireHotspots";
import { cellsForMultiPolygon } from "./h3FromGeometry";
import { ensureRiskSimulation, getCachedRiskCells } from "./riskCache";
import { RES_ACTIVE } from "./constants";

/**
 * One real incident, built entirely from data this same poll cycle already fetched in
 * bulk (clusters/perimeters/hotspots) — no extra per-cluster Deepfire call, unlike
 * fireActions.ts's buildFireContext, which fetches by id on demand for a single click
 * and can afford to. `null` means "Deepfire doesn't have this yet for this cluster"
 * (perimeter not computed), never "zero".
 */
export interface LiveFireSummary {
  readonly id: string; // raw cluster_id — same id fireActions.ts expects
  readonly centroid: { readonly lat: number; readonly lng: number };
  readonly firstObserved: string;
  readonly lastObserved: string;
  readonly cellIds: readonly string[]; // res-8, only this fire's cells
  readonly areaHa: number | null;
  readonly perimeterM: number | null;
  readonly nHotspots: number | null;
  readonly confidence: HotspotConfidence | null; // from its most recent detection
  readonly source: string | null; // from its most recent detection
  readonly fireRadiativePowerMw: number | null; // from its most recent detection
}

export interface LiveFireState {
  readonly fires: readonly LiveFireSummary[];
  readonly activeCellIds: readonly string[]; // res-8, ardiendo AHORA (ACTUAL) — union of fires[].cellIds
  readonly riskCellIds: readonly string[]; // res-8, riesgo próximas horas (PRED)
  readonly hotspots: readonly LiveHotspot[]; // detalle/respaldo de cada detección
  readonly fetchedAt: number;
}

export async function buildLiveFireState(): Promise<LiveFireState> {
  const [clusters, perimeters, allHotspots] = await Promise.all([
    fetchActiveClustersInRmb(),
    fetchActivePerimetersInRmb(),
    fetchLiveHotspotsInRmb(),
  ]);

  const now = Date.now();
  const latestPerimeters = latestPerimeterPerCluster(perimeters);

  /**
   * Celdas de un grupo de clusters. El perímetro de satélite manda; los que todavía no
   * tienen uno calculado caen a sus hotspots, que es una aproximación burda pero deja
   * de ser invisible un incendio recién detectado.
   */
  function cellsFor(ids: ReadonlySet<string>): Set<string> {
    const cells = new Set<string>();
    for (const [clusterId, perimeter] of latestPerimeters) {
      if (!ids.has(clusterId)) continue;
      for (const cellId of cellsForMultiPolygon(perimeter.geometry, RES_ACTIVE)) {
        cells.add(cellId);
      }
    }
    for (const h of allHotspots) {
      if (!ids.has(h.clusterId) || latestPerimeters.has(h.clusterId)) continue;
      cells.add(latLngToCell(h.lat, h.lng, RES_ACTIVE));
    }
    return cells;
  }

  const activeCells = cellsFor(new Set(clusters.map((c) => c.id)));

  const hotspotsByCluster = new Map<string, LiveHotspot[]>();
  for (const h of allHotspots) {
    const list = hotspotsByCluster.get(h.clusterId);
    if (list) list.push(h);
    else hotspotsByCluster.set(h.clusterId, [h]);
  }

  // fire-spread es caro y asíncrono — se dispara sin esperar, y se sirve lo
  // que haya en caché de ciclos anteriores (puede ir vacío la primera vez).
  const riskCells = new Set<string>();
  const fires: LiveFireSummary[] = clusters.map((cluster) => {
    ensureRiskSimulation(cluster.id);
    for (const cellId of getCachedRiskCells(cluster.id)) {
      if (!activeCells.has(cellId)) riskCells.add(cellId);
    }

    const perimeter = latestPerimeters.get(cluster.id);
    const ownHotspots = hotspotsByCluster.get(cluster.id) ?? [];
    const latestHotspot = ownHotspots.reduce<LiveHotspot | null>(
      (best, h) => (!best || h.observedAt > best.observedAt ? h : best),
      null,
    );

    return {
      id: cluster.id,
      centroid: { lat: cluster.lat, lng: cluster.lng },
      firstObserved: cluster.firstObserved,
      lastObserved: cluster.lastObserved,
      cellIds: [...cellsFor(new Set([cluster.id]))],
      areaHa: perimeter?.areaM2 != null ? perimeter.areaM2 / 10_000 : null,
      perimeterM: perimeter?.perimeterM ?? null,
      nHotspots: perimeter?.nHotspots ?? (ownHotspots.length || null),
      confidence: latestHotspot?.confidence ?? null,
      source: latestHotspot?.source ?? null,
      fireRadiativePowerMw: latestHotspot?.fireRadiativePowerMw ?? null,
    };
  });

  return {
    fires,
    activeCellIds: [...activeCells],
    riskCellIds: [...riskCells],
    hotspots: allHotspots,
    fetchedAt: now,
  };
}
