import "./loadEnv";
import { createServer } from "node:http";
import { fetchLiveHotspotsInBcnMetro, type LiveHotspot } from "./deepfireHotspots";

const PORT = Number(process.env.LIVE_SERVER_PORT ?? 3001);
// Satélite, no push: los hotspots no llegan más rápido que el paso del
// satélite sobre la zona (minutos-horas). 2 min es margen razonable para
// que la demo se vea viva sin ametrallar la API — ajustar aquí si se
// confirma un rate limit distinto en la doc de Deepfire.
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 2 * 60_000);

interface Cache {
  data: LiveHotspot[];
  fetchedAt: number;
  lastError: string | null;
}

// undefined = todavía no hemos completado ni un solo ciclo.
let cache: Cache | undefined;

async function pollOnce(): Promise<void> {
  try {
    const data = await fetchLiveHotspotsInBcnMetro();
    cache = { data, fetchedAt: Date.now(), lastError: null };
    console.log(`[live] ${data.length} hotspot(s) en el área BCN`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[live] fetching Deepfire hotspots failed:", message);
    // Se conserva el último dato bueno si lo hay — un fallo puntual de la
    // API no debe dejar el mapa en blanco. Solo se guarda el error si
    // todavía no tenemos ningún dato con el que quedarnos.
    cache = cache ? { ...cache, lastError: message } : { data: [], fetchedAt: Date.now(), lastError: message };
  }
}

// Primer fetch inmediato al arrancar, luego cada POLL_INTERVAL_MS — el
// servidor consulta Deepfire por su cuenta, no en respuesta a peticiones
// del frontend. Varias pestañas del navegador comparten el mismo ciclo.
void pollOnce();
setInterval(pollOnce, POLL_INTERVAL_MS);

const server = createServer((req, res) => {
  // CORS abierto — es un proxy local de solo lectura para el dev server de
  // Vite (localhost:5173), no expone nada que no esté ya en /api/hotspots.
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method !== "GET" || !req.url?.startsWith("/api/hotspots")) {
    res.writeHead(404, { "Content-Type": "application/json" }).end(
      JSON.stringify({ error: "not found" }),
    );
    return;
  }

  if (!cache) {
    res.writeHead(503, { "Content-Type": "application/json" }).end(
      JSON.stringify({ error: "primera consulta a Deepfire todavía en curso" }),
    );
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" }).end(
    JSON.stringify({ hotspots: cache.data, fetchedAt: cache.fetchedAt, error: cache.lastError }),
  );
});

server.listen(PORT, () => {
  console.log(
    `[live] Deepfire hotspots proxy listening on http://localhost:${PORT} ` +
      `(refresco cada ${POLL_INTERVAL_MS / 1000}s)`,
  );
});
