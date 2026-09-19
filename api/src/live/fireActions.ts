import { fetchClusterById } from "./deepfireClusters";
import { fetchHotspotsByCluster } from "./deepfireHotspots";
import { fetchLatestPerimeterByCluster } from "./deepfirePerimeters";
import { callNebiusForJson, nebiusModelId } from "./nebius";
import { toAiAnalysis, type AIAnalysis } from "./aiAnalysis";

// Generado bajo demanda (al abrir el panel), no en el poll de 2 min — es caro. Esta
// caché evita volver a llamar a Nebius si el operador cierra y reabre el mismo
// incendio en los minutos siguientes.
const CACHE_MS = Number(process.env.NEBIUS_CACHE_MS ?? 10 * 60_000);

const cache = new Map<string, { analysis: AIAnalysis; cachedAt: number }>();
const inFlight = new Map<string, Promise<AIAnalysis>>();

// Los tres `fetch*ByCluster` interpolan `clusterId` sin escapar dentro de un filtro
// CQL2 — validar la forma aquí es lo único que evita una inyección si algún día esto
// deja de venir siempre de una URL que nosotros mismos generamos.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidClusterId(clusterId: string): boolean {
  return UUID_RE.test(clusterId);
}

export class NotFoundError extends Error {}

const SYSTEM_PROMPT = `Eres un asesor táctico para coordinadores de emergencias de incendios forestales.
Con los datos reales de un incendio detectado por satélite, propones una lista priorizada de acciones.

Reglas estrictas:
- Responde ÚNICAMENTE con un objeto JSON, sin texto antes ni después, sin bloque de código.
- No inventes datos que no se te han dado: nada de nombres de colegios, poblaciones, cifras de gente evacuada, ni coordenadas nuevas. Si sugieres evacuar, hazlo en términos genéricos ("evacuar la zona inmediata a favor del viento"), nunca inventando un lugar concreto.
- Basa cada "why" únicamente en los datos del incendio que se te dan.
- El campo "status" no lo pongas tú — se añade después.

Formato exacto de salida:
{
  "summary": "2-3 frases sobre el estado del incendio, en español",
  "priority_rationale": "1-2 frases explicando el orden elegido",
  "actions": [
    {
      "action_id": "DEPLOY_RESOURCE:helicopter | DEPLOY_RESOURCE:ground | DEPLOY_RESOURCE:air | DEPLOY_RESOURCE:drone | CREATE_FIREBREAK | EVACUATE_AREA | WAIT",
      "label": "Título corto de la acción",
      "rank": 1,
      "urgency": "immediate | soon | monitor",
      "why": "Justificación basada solo en los datos dados",
      "resources": ["opcional, ej. Helicóptero, Equipo terrestre"],
      "eta_min": 25
    }
  ]
}

Entre 2 y 4 acciones, ordenadas por "rank" ascendente (1 = primera).`;

interface FireContext {
  readonly clusterId: string;
  readonly firstObserved: string;
  readonly lastObserved: string;
  readonly centroid: { readonly lat: number; readonly lng: number };
  readonly areaHa: number | null;
  readonly perimeterM: number | null;
  readonly nHotspotsInPerimeter: number | null;
  readonly hotspotCount: number;
  readonly latestConfidence: string | null;
  readonly latestSource: string | null;
  readonly latestFireRadiativePowerMw: number | null;
}

async function buildFireContext(clusterId: string): Promise<FireContext | null> {
  const [cluster, perimeter, hotspots] = await Promise.all([
    fetchClusterById(clusterId),
    fetchLatestPerimeterByCluster(clusterId),
    fetchHotspotsByCluster(clusterId),
  ]);

  if (!cluster) return null;

  const latest = hotspots.reduce<(typeof hotspots)[number] | null>(
    (best, h) => (!best || h.observedAt > best.observedAt ? h : best),
    null,
  );

  return {
    clusterId,
    firstObserved: cluster.firstObserved,
    lastObserved: cluster.lastObserved,
    centroid: { lat: cluster.lat, lng: cluster.lng },
    areaHa: perimeter?.areaM2 != null ? perimeter.areaM2 / 10_000 : null,
    perimeterM: perimeter?.perimeterM ?? null,
    nHotspotsInPerimeter: perimeter?.nHotspots ?? null,
    hotspotCount: hotspots.length,
    latestConfidence: latest?.confidence ?? null,
    latestSource: latest?.source ?? null,
    latestFireRadiativePowerMw: latest?.fireRadiativePowerMw ?? null,
  };
}

function userPromptFor(ctx: FireContext): string {
  const lines = [
    `cluster_id: ${ctx.clusterId}`,
    `centroide: lat ${ctx.centroid.lat.toFixed(4)}, lng ${ctx.centroid.lng.toFixed(4)}`,
    `primera detección: ${ctx.firstObserved}`,
    `última detección: ${ctx.lastObserved}`,
    `detecciones de satélite acumuladas: ${ctx.hotspotCount}`,
    `confianza de la detección más reciente: ${ctx.latestConfidence ?? "desconocida"}`,
    `fuente de la detección más reciente: ${ctx.latestSource ?? "desconocida"}`,
    `potencia radiativa (FRP) más reciente: ${
      ctx.latestFireRadiativePowerMw != null ? `${ctx.latestFireRadiativePowerMw.toFixed(1)} MW` : "no disponible"
    }`,
    ctx.areaHa != null
      ? `área del perímetro calculado por satélite: ${ctx.areaHa.toFixed(1)} ha`
      : "área del perímetro: todavía no calculada por Deepfire (incendio muy reciente)",
    ctx.perimeterM != null ? `longitud del perímetro: ${ctx.perimeterM.toFixed(0)} m` : null,
    ctx.nHotspotsInPerimeter != null
      ? `detecciones usadas para construir el perímetro: ${ctx.nHotspotsInPerimeter}`
      : null,
  ].filter((l): l is string => l !== null);

  return `Datos del incendio:\n${lines.join("\n")}`;
}

/** No bloquea reintentos duplicados: si ya hay una llamada en curso para este
 * cluster, la comparte en vez de lanzar otra a Nebius. Lanza NotFoundError si el
 * cluster no existe (o ya no está en Deepfire) — el caller decide el código HTTP. */
export async function getFireActions(clusterId: string): Promise<AIAnalysis> {
  const cached = cache.get(clusterId);
  if (cached && Date.now() - cached.cachedAt < CACHE_MS) {
    return cached.analysis;
  }

  const existing = inFlight.get(clusterId);
  if (existing) return existing;

  const promise = (async () => {
    const ctx = await buildFireContext(clusterId);
    if (!ctx) {
      throw new NotFoundError(`Cluster ${clusterId} no encontrado en Deepfire`);
    }

    const raw = await callNebiusForJson(SYSTEM_PROMPT, userPromptFor(ctx));
    const analysis = toAiAnalysis(raw, clusterId, nebiusModelId());
    cache.set(clusterId, { analysis, cachedAt: Date.now() });
    return analysis;
  })();

  inFlight.set(clusterId, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(clusterId);
  }
}
