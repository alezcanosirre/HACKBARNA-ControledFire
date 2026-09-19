import { getDeepfireToken } from "./deepfireAuth";
import type { MultiPolygonGeometry } from "./geometry";

const BASE = "https://api.deepfire.co/v1/fire-spread/simulations";

// Simulación más ligera que el máximo (24h) — es lo que se pinta como
// "riesgo", no hace falta el horizonte completo para eso.
const DURATION_HOURS = Number(process.env.FIRE_SPREAD_DURATION_HOURS ?? 6);
// La doc recomienda cada 10s mientras esté QUEUED.
const POLL_MS = 10_000;
// ~7 min de espera por ciclo antes de rendirnos aquí — el servidor de
// Deepfire puede seguir intentándolo hasta 60 min y marcarlo FAILED él
// mismo, pero no queremos bloquear nuestro propio ciclo de refresco tanto.
const MAX_POLLS = 40;

export type FireSpreadStatus = "QUEUED" | "COMPLETED" | "NO_SPREAD" | "FAILED";

interface FireSpreadResult {
  readonly type: "FeatureCollection";
  readonly features: readonly {
    readonly geometry: MultiPolygonGeometry;
    readonly properties: { readonly hour: number };
  }[];
}

interface FireSpreadSimulation {
  readonly id: string;
  readonly status: FireSpreadStatus;
  readonly result?: FireSpreadResult;
  readonly errorMessage?: string;
}

async function postSimulation(clusterId: string): Promise<string> {
  const token = await getDeepfireToken();
  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ clusterId, durationHours: DURATION_HOURS }),
  });
  if (!res.ok) {
    throw new Error(`fire-spread POST failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function pollSimulation(id: string): Promise<FireSpreadSimulation> {
  const token = await getDeepfireToken();
  const res = await fetch(`${BASE}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`fire-spread poll failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as FireSpreadSimulation;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lanza una simulación de propagación para un cluster y espera a que
 * termine (o a que nos cansemos de esperar). Tarda — quien la llame no
 * debe bloquear el ciclo principal de refresco con esto, ver riskCache.ts.
 */
export async function runFireSpread(clusterId: string): Promise<FireSpreadSimulation> {
  const id = await postSimulation(clusterId);

  for (let i = 0; i < MAX_POLLS; i++) {
    const sim = await pollSimulation(id);
    if (sim.status !== "QUEUED") return sim;
    await sleep(POLL_MS);
  }

  return { id, status: "FAILED", errorMessage: "timed out esperando la simulación (lado cliente)" };
}
