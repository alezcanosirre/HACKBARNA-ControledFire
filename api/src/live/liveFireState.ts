import { latLngToCell } from "h3-js";
import { fetchActiveClustersInBcnMetro } from "./deepfireClusters";
import { fetchActivePerimetersInBcnMetro, latestPerimeterPerCluster } from "./deepfirePerimeters";
import { fetchLiveHotspotsInBcnMetro, type LiveHotspot } from "./deepfireHotspots";
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
  const [clusters, perimeters, hotspots] = await Promise.all([
    fetchActiveClustersInBcnMetro(),
    fetchActivePerimetersInBcnMetro(),
    fetchLiveHotspotsInBcnMetro(),
  ]);

  const latestPerimeters = latestPerimeterPerCluster(perimeters);
  const activeCells = new Set<string>();

  for (const perimeter of latestPerimeters.values()) {
    for (const cellId of cellsForMultiPolygon(perimeter.geometry, RES_ACTIVE)) {
      activeCells.add(cellId);
    }
  }

  // Clusters sin perímetro calculado todavía (demasiado recientes): en vez
  // de dejarlos invisibles, usamos sus hotspots — es la misma aproximación
  // burda de antes, pero solo como fallback puntual, no como método
  // principal.
  for (const h of hotspots) {
    if (latestPerimeters.has(h.clusterId)) continue;
    activeCells.add(latLngToCell(h.lat, h.lng, RES_ACTIVE));
  }

  // fire-spread es caro y asíncrono — se dispara sin esperar, y se sirve lo
  // que haya en caché de ciclos anteriores (puede ir vacío la primera vez).
  const riskCells = new Set<string>();
  for (const cluster of clusters) {
    ensureRiskSimulation(cluster.id);
    for (const cellId of getCachedRiskCells(cluster.id)) {
      if (!activeCells.has(cellId)) riskCells.add(cellId); // lo que ya arde no es "riesgo"
    }
  }

  return {
    activeCellIds: [...activeCells],
    riskCellIds: [...riskCells],
    hotspots,
    fetchedAt: Date.now(),
  };
}
