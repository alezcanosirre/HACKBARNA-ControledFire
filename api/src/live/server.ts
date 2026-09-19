import "./loadEnv";
import { createServer } from "node:http";
import { buildLiveFireState } from "./liveFireState";
import { getLiveFireStore, setLiveFireError, setLiveFireState } from "./liveFireStore";
import { getActionRecommendation, isValidIncidentId, NotFoundError } from "./actionRecommendation";

const PORT = Number(process.env.LIVE_SERVER_PORT ?? 3001);
// Satélite, no push: clusters/perímetros/hotspots no llegan más rápido que
// el paso del satélite sobre la zona (minutos-horas). 2 min es margen
// razonable para que la demo se vea viva sin ametrallar la API — ajustar
// si se confirma un rate limit distinto en la doc de Deepfire.
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 2 * 60_000);

async function pollOnce(): Promise<void> {
  try {
    const state = await buildLiveFireState();
    setLiveFireState(state);
    console.log(
      `[live] ${state.fires.length} incendio(s), ${state.hotspots.length} detección(es), ` +
        `${state.activeCellIds.length} celda(s) ardiendo, ${state.riskCellIds.length} en riesgo`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[live] refresh failed:", message);
    // Se conserva el último dato bueno si lo hay — un fallo puntual de la
    // API no debe dejar el mapa en blanco.
    setLiveFireError(message, { fires: [], activeCellIds: [], riskCellIds: [], hotspots: [], fetchedAt: Date.now() });
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
    const store = getLiveFireStore();
    if (!store) {
      sendJson(res, 503, { error: "primera consulta a Deepfire todavía en curso" });
      return;
    }
    sendJson(res, 200, { ...store.state, error: store.lastError });
    return;
  }

  // POST /api/live-fires/:id/actions — genera (o sirve de caché) la recomendación de
  // Nebius para un incidente ACTUAL real. Bajo demanda, no forma parte del ciclo de
  // refresco de arriba: el incidente se busca en el estado ya cacheado (nunca se
  // vuelve a consultar Deepfire por su cuenta), y el cuerpo de la petición se ignora.
  const actionsMatch = url.pathname.match(/^\/api\/live-fires\/([^/]+)\/actions$/);
  if (req.method === "POST" && actionsMatch) {
    const incidentId = decodeURIComponent(actionsMatch[1]);
    if (!isValidIncidentId(incidentId)) {
      sendJson(res, 400, { error: "id de incidente inválido" });
      return;
    }

    getActionRecommendation(incidentId)
      .then((recommendation) => sendJson(res, 200, recommendation))
      .catch((err) => {
        if (err instanceof NotFoundError) {
          sendJson(res, 404, { error: err.message });
          return;
        }
        // No debería llegar aquí — actionRecommendation.ts captura sus propios fallos
        // y responde `status: "unavailable"` con 200. Esto es un último resguardo.
        const message = err instanceof Error ? err.message : "unknown error";
        console.error(`[live] fallo inesperado generando recomendación para ${incidentId}:`, message);
        sendJson(res, 500, { error: "unexpected error" });
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
