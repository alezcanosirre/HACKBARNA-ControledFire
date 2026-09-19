import { latLngToCell } from "h3-js";
import { fetchActiveClustersInRmb } from "./deepfireClusters";
import { fetchActivePerimetersInRmb, latestPerimeterPerCluster } from "./deepfirePerimeters";
import { fetchLiveHotspotsInRmb, type LiveHotspot } from "./deepfireHotspots";
import { cellsForMultiPolygon } from "./h3FromGeometry";
import { ensureRiskSimulation, getCachedRiskCells } from "./riskCache";
import { RES_ACTIVE } from "./constants";

/**
 * Cuánto hace que se observó algo por última vez para seguir contándolo como
 * "ardiendo ahora".
 *
 * `active = true` NO significa eso: significa que Deepfire no ha cerrado el cluster.
 * El 19 sep los dos clusters del área metropolitana llevaban más de quince horas sin
 * volver a verse y seguían marcados activos, así que el mapa los pintaba del mismo rojo
 * que un frente en marcha. Un incendio que no se ve desde hace medio día no es una
 * emergencia en curso, y pintarlo como tal gasta la única señal fuerte de la pantalla.
 *
 * Seis horas es margen amplio para el paso de un satélite de órbita polar (VIIRS pasa
 * un par de veces al día); MTG, que es geoestacionario, refresca cada diez minutos.
 *
 * Lo que cae fuera de la ventana NO se tira: pasa a `containedCellIds`. Un cluster que
 * Deepfire no ha cerrado pero lleva medio día sin verse no es un frente en marcha ni es
 * nada — es un incendio que ya no reclama medios, que es exactamente lo que el spec
 * llama `contained` (§4.7, gris). Tirarlo dejaría la pantalla en blanco y mentiría
 * igual, solo que por omisión.
 */
const MAX_AGE_MS = Number(process.env.LIVE_MAX_AGE_HOURS ?? 6) * 60 * 60_000;

/** Descarta lo que no se haya observado dentro de la ventana. Sin fecha, fuera. */
function isRecent(isoTimestamp: string | undefined, now: number): boolean {
  if (!isoTimestamp) return false;
  const seen = Date.parse(isoTimestamp);
  return Number.isFinite(seen) && now - seen <= MAX_AGE_MS;
}

export interface LiveFireState {
  readonly activeCellIds: readonly string[]; // res-8, ardiendo AHORA (ACTUAL)
  readonly containedCellIds: readonly string[]; // res-8, activo pero sin ver desde hace horas
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

  // Visto hace poco = frente en marcha. Activo pero sin ver desde hace horas = contenido.
  const liveClusters = clusters.filter((c) => isRecent(c.lastObserved, now));
  const coolingClusters = clusters.filter((c) => !isRecent(c.lastObserved, now));
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

  const activeCells = cellsFor(new Set(liveClusters.map((c) => c.id)));
  const containedCells = cellsFor(new Set(coolingClusters.map((c) => c.id)));
  // Una celda que arde ahora no está contenida, por mucho que la pida otro cluster.
  for (const cellId of activeCells) containedCells.delete(cellId);

  // fire-spread es caro y asíncrono — se dispara sin esperar, y se sirve lo
  // que haya en caché de ciclos anteriores (puede ir vacío la primera vez).
  // Solo para lo que sigue vivo: simular la propagación de un incendio que nadie ve
  // desde hace medio día es gastar una simulación cara en una respuesta sin sentido.
  const riskCells = new Set<string>();
  for (const cluster of liveClusters) {
    ensureRiskSimulation(cluster.id);
    for (const cellId of getCachedRiskCells(cluster.id)) {
      if (!activeCells.has(cellId) && !containedCells.has(cellId)) riskCells.add(cellId);
    }
  }

  return {
    activeCellIds: [...activeCells],
    containedCellIds: [...containedCells],
    riskCellIds: [...riskCells],
    hotspots: allHotspots,
    fetchedAt: now,
  };
}
