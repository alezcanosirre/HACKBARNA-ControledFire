import "./loadEnv";
import { createServer } from "node:http";
import { buildLiveFireState, type LiveFireState } from "./liveFireState";

const PORT = Number(process.env.LIVE_SERVER_PORT ?? 3001);
// Satélite, no push: clusters/perímetros/hotspots no llegan más rápido que
// el paso del satélite sobre la zona (minutos-horas). 2 min es margen
// razonable para que la demo se vea viva sin ametrallar la API — ajustar
// si se confirma un rate limit distinto en la doc de Deepfire.
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 2 * 60_000);

interface Cache {
  state: LiveFireState;
  lastError: string | null;
}

// undefined = todavía no hemos completado ni un solo ciclo.
let cache: Cache | undefined;

async function pollOnce(): Promise<void> {
  try {
    const state = await buildLiveFireState();
    cache = { state, lastError: null };
    console.log(
      `[live] ${state.hotspots.length} detección(es), ${state.activeCellIds.length} celda(s) ardiendo, ` +
        `${state.riskCellIds.length} en riesgo`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[live] refresh failed:", message);
    // Se conserva el último dato bueno si lo hay — un fallo puntual de la
    // API no debe dejar el mapa en blanco.
    cache = cache
      ? { ...cache, lastError: message }
      : {
        state: {
          activeCellIds: [],
          riskCellIds: [],
          hotspots: [],
          fetchedAt: Date.now(),
        },
        lastError: message,
      };
  }
}

// Primer fetch inmediato al arrancar, luego cada POLL_INTERVAL_MS — el
// servidor consulta Deepfire por su cuenta, no en respuesta a peticiones
// del frontend. Varias pestañas del navegador comparten el mismo ciclo.
void pollOnce();
setInterval(pollOnce, POLL_INTERVAL_MS);

const server = createServer((req, res) => {
  // CORS abierto — es un proxy local de solo lectura para el dev server de
  // Vite (localhost:5173), no expone nada que no esté ya en /api/live-fires.
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method !== "GET" || !req.url?.startsWith("/api/live-fires")) {
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
    JSON.stringify({ ...cache.state, error: cache.lastError }),
  );
});

server.listen(PORT, () => {
  console.log(
    `[live] Deepfire live-fires proxy listening on http://localhost:${PORT} ` +
      `(refresco cada ${POLL_INTERVAL_MS / 1000}s)`,
  );
});
