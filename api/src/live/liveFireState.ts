import { latLngToCell } from "h3-js";
import { fetchActiveClustersInRmb } from "./deepfireClusters";
import { fetchActivePerimetersInRmb, latestPerimeterPerCluster } from "./deepfirePerimeters";
import { fetchLiveHotspotsInRmb, type LiveHotspot } from "./deepfireHotspots";
import { cellsForMultiPolygon } from "./h3FromGeometry";
import { ensureRiskSimulation, getCachedRiskCells } from "./riskCache";
import { RES_ACTIVE } from "./constants";

export interface LiveFireState {
  readonly activeCellIds: readonly string[]; // res-8, ardiendo AHORA (ACTUAL)
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

  // fire-spread es caro y asíncrono — se dispara sin esperar, y se sirve lo
  // que haya en caché de ciclos anteriores (puede ir vacío la primera vez).
  const riskCells = new Set<string>();
  for (const cluster of clusters) {
    ensureRiskSimulation(cluster.id);
    for (const cellId of getCachedRiskCells(cluster.id)) {
      if (!activeCells.has(cellId)) riskCells.add(cellId);
    }
  }

  return {
    activeCellIds: [...activeCells],
    riskCellIds: [...riskCells],
    hotspots: allHotspots,
    fetchedAt: now,
  };
}
