import { latLngToCell } from "h3-js";
import { fetchActiveClustersInRmb } from "./deepfireClusters";
import { fetchActivePerimetersInRmb, latestPerimeterPerCluster } from "./deepfirePerimeters";
import { fetchLiveHotspotsInRmb, type HotspotConfidence, type LiveHotspot } from "./deepfireHotspots";
import { cellsForMultiPolygon } from "./h3FromGeometry";
import { ensureRiskSimulation, getCachedRiskCells, getCachedWind, type FireSpreadWind } from "./riskCache";
import { RES_ACTIVE } from "./constants";
import { buildIgnitionRisk, type IgnitionRiskCell } from "./ignitionRisk";
import { assessIgnitionRisk } from "./ignitionAssessment";
import { fetchWeatherGrid, nearestSample, type WeatherSample } from "./weather";
import { BBOX_RMB } from "./bbox";

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
  readonly wind: FireSpreadWind | null; // avg over the fire-spread simulation window, once one has completed
  /**
   * El tiempo que hace AHORA sobre el foco, de met.no (weather.ts). Deepfire no da
   * meteo, y `wind` de arriba solo existe si una simulación de fire-spread ha terminado
   * — que casi nunca es el caso. Esto sí está siempre.
   */
  readonly weather: {
    readonly temperatureC: number;
    readonly humidityPct: number;
    readonly windSpeedKmh: number;
    readonly windDirectionDeg: number;
    readonly source: string;
    readonly observedAt: string; // ISO 8601
  } | null;
}

export interface LiveFireState {
  readonly fires: readonly LiveFireSummary[];
  readonly activeCellIds: readonly string[]; // res-8, ardiendo AHORA (ACTUAL) — union of fires[].cellIds
  readonly riskCellIds: readonly string[]; // res-8, propagación de un foco activo
  /**
   * Riesgo de IGNICIÓN por celda (PRED): dónde puede empezar un incendio. Heurística
   * sobre histórico de igniciones y meteo actual, ver ignitionRisk.ts — no es lo mismo
   * que `riskCellIds`, que es hacia dónde iría un fuego que YA arde.
   */
  readonly ignitionRisk: readonly IgnitionRiskCell[];
  /**
   * Lo que el modelo lee del área en conjunto, y con qué modelo. `summary` en null
   * significa que se está sirviendo la heurística porque la IA no estaba disponible — la
   * interfaz lo dice, no lo disimula.
   */
  readonly ignitionAnalysis: {
    readonly summary: string | null;
    readonly model: string | null;
    readonly generatedAt: string;
  };
  readonly hotspots: readonly LiveHotspot[]; // detalle/respaldo de cada detección
  readonly fetchedAt: number;
}

export async function buildLiveFireState(): Promise<LiveFireState> {
  const [clusters, perimeters, allHotspots, ignition] = await Promise.all([
    fetchActiveClustersInRmb(),
    fetchActivePerimetersInRmb(),
    fetchLiveHotspotsInRmb(),
    // Que falle el riesgo de ignición no puede tumbar el feed de incendios: son dos
    // preguntas distintas y la de "qué arde ahora" es la que no puede faltar.
    // Las celdas se miden aquí y las puntúa el modelo; si el modelo falla, se sirven
    // las de la heurística. Que falle el riesgo no puede tumbar el feed de qué arde.
    buildIgnitionRisk()
      .then((cells) => assessIgnitionRisk(cells))
      .catch((err) => {
        console.error("[live] riesgo de ignición falló:", err instanceof Error ? err.message : err);
        return {
          cells: [] as IgnitionRiskCell[],
          summary: null,
          model: null,
          generatedAt: new Date().toISOString(),
        };
      }),
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

  /*
   * Una sola rejilla de meteo por ciclo, compartida por todos los focos: met.no es una
   * llamada por punto y pedir una por incendio sería gastar cuota para preguntar lo
   * mismo. Si falla, los focos salen con `weather: null` — que no haya tiempo no puede
   * tumbar el feed de qué está ardiendo.
   */
  let weatherGrid: WeatherSample[] = [];
  try {
    weatherGrid = await fetchWeatherGrid(BBOX_RMB);
  } catch (err) {
    console.error("[live] meteo falló:", err instanceof Error ? err.message : err);
  }

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

    const sample = weatherGrid.length > 0 ? nearestSample(weatherGrid, cluster.lat, cluster.lng) : null;
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
      weather: sample ? sample.current : null,
      fireRadiativePowerMw: latestHotspot?.fireRadiativePowerMw ?? null,
      wind: getCachedWind(cluster.id),
    };
  });

  return {
    fires,
    activeCellIds: [...activeCells],
    riskCellIds: [...riskCells],
    ignitionRisk: ignition.cells,
    ignitionAnalysis: {
      summary: ignition.summary,
      model: ignition.model,
      generatedAt: ignition.generatedAt,
    },
    hotspots: allHotspots,
    fetchedAt: now,
  };
}
