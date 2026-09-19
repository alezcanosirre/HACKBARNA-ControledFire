import "./loadEnv";
import { createServer } from "node:http";
import { buildLiveFireState, type LiveFireState } from "./liveFireState";
import { getFireActions, isValidClusterId, NotFoundError } from "./fireActions";

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
          fires: [],
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

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  // CORS abierto — es un proxy local para el dev server de Vite (localhost:5173), no
  // expone nada que no esté ya accesible a través de sus propios endpoints.
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/live-fires") {
    if (!cache) {
      sendJson(res, 503, { error: "primera consulta a Deepfire todavía en curso" });
      return;
    }
    sendJson(res, 200, { ...cache.state, error: cache.lastError });
    return;
  }

  // POST /api/live-fires/:id/actions — genera (o sirve de caché) la propuesta de
  // acciones de Nebius para un incendio real. Bajo demanda, no forma parte del ciclo
  // de refresco de arriba: el id llega por la URL, el cuerpo de la petición se ignora
  // porque el servidor ya sabe cómo traer los datos de ese cluster desde Deepfire.
  const actionsMatch = url.pathname.match(/^\/api\/live-fires\/([^/]+)\/actions$/);
  if (req.method === "POST" && actionsMatch) {
    const clusterId = decodeURIComponent(actionsMatch[1]);
    if (!isValidClusterId(clusterId)) {
      sendJson(res, 400, { error: "id de incendio inválido" });
      return;
    }

    getFireActions(clusterId)
      .then((analysis) => sendJson(res, 200, analysis))
      .catch((err) => {
        if (err instanceof NotFoundError) {
          sendJson(res, 404, { error: err.message });
          return;
        }
        const message = err instanceof Error ? err.message : "unknown error";
        console.error(`[live] fire-actions para ${clusterId} falló:`, message);
        sendJson(res, 502, { error: message });
      });
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(
    `[live] Deepfire live-fires proxy listening on http://localhost:${PORT} ` +
      `(refresco cada ${POLL_INTERVAL_MS / 1000}s)`,
  );
});
