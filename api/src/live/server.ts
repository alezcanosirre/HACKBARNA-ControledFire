import "./loadEnv";
import { createServer } from "node:http";
import { buildLiveFireState } from "./liveFireState";
import { getLiveFireStore, setLiveFireError, setLiveFireState } from "./liveFireStore";
import {
  getActionRecommendation,
  getRecommendationForSnapshot,
  isValidIncidentId,
  NotFoundError,
} from "./actionRecommendation";
import { buildSimulatedSnapshot } from "./incidentSnapshot";
import { simulatedFireCaseById } from "../scenario/simulatedFireCases";
import { getSimulatedRiskAssessment } from "./simulatedRisk";

// `PORT` first: most hosts (Render, Railway, Fly) inject it and expect the app to
// listen there — LIVE_SERVER_PORT stays as the local-dev override.
const PORT = Number(process.env.PORT ?? process.env.LIVE_SERVER_PORT ?? 3001);
// Satélite, no push: clusters/perímetros/hotspots no llegan más rápido que
// el paso del satélite sobre la zona (minutos-horas). 2 min es margen
// razonable para que la demo se vea viva sin ametrallar la API — ajustar
// si se confirma un rate limit distinto en la doc de Deepfire.
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 2 * 60_000);

// Diagnóstico de arranque, nunca la clave en sí — el fallo más habitual de
// POST /api/live-fires/:id/actions es que este proceso arrancó sin ella cargada
// (p.ej. se editó api/.env con el servidor ya corriendo: las variables de entorno
// solo se leen una vez, al arrancar — hay que reiniciar `npm run live`).
console.log(
  process.env.NEBIUS_API_KEY
    ? "[live] Nebius: clave cargada"
    : "[live] Nebius: SIN CLAVE — NEBIUS_API_KEY no está en el entorno de este proceso. " +
        "Si ya la pusiste en api/.env, reinicia `npm run live` (se lee solo al arrancar).",
);

async function pollOnce(): Promise<void> {
  try {
    const state = await buildLiveFireState();
    setLiveFireState(state);
    console.log(
      `[live] ${state.fires.length} incendio(s), ${state.hotspots.length} detección(es), ` +
        `${state.activeCellIds.length} celda(s) ardiendo, ${state.riskCellIds.length} en riesgo, ` +
        `${state.ignitionRisk.length} celda(s) con riesgo de ignición`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[live] refresh failed:", message);
    // Se conserva el último dato bueno si lo hay — un fallo puntual de la
    // API no debe dejar el mapa en blanco.
    setLiveFireError(message, {
      fires: [],
      activeCellIds: [],
      riskCellIds: [],
      ignitionRisk: [],
      ignitionAnalysis: { summary: null, model: null, generatedAt: new Date().toISOString() },
      hotspots: [],
      fetchedAt: Date.now(),
    });
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

  /*
   * POST /api/simulated-fires/:id/actions — lo mismo para un caso de ejercicio.
   *
   * Ruta aparte y no el mismo `:id` porque un escenario no es un incidente real y no
   * debe poder colarse por la puerta de los reales: ahí la lista la manda Deepfire y
   * aquí es un fichero del repositorio. Lo que sí comparten es todo lo de dentro —
   * prompt, validación y caché— y el modelo distingue los dos por `provenance`.
   */
  const simActionsMatch = url.pathname.match(/^\/api\/simulated-fires\/([^/]+)\/actions$/);
  if (req.method === "POST" && simActionsMatch) {
    const caseId = decodeURIComponent(simActionsMatch[1]);
    const simCase = simulatedFireCaseById(caseId);
    if (!simCase) {
      sendJson(res, 404, { error: `Caso simulado ${caseId} no encontrado` });
      return;
    }

    getRecommendationForSnapshot(buildSimulatedSnapshot(simCase))
      .then((recommendation) => sendJson(res, 200, recommendation))
      .catch((err) => {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error(`[live] fallo generando recomendación para el caso ${caseId}:`, message);
        sendJson(res, 500, { error: "unexpected error" });
      });
    return;
  }

  /*
   * GET /api/simulated-risk — el PRED del modo SIMULACIÓN.
   *
   * Con la simulación encendida el sondeo a Deepfire se apaga, así que PRED se quedaba
   * sin nada. Estas celdas son inventadas, pero las puntúa el mismo modelo con el mismo
   * prompt que las medidas: el escenario cambia de dónde salen los datos, no quién los
   * juzga. GET y no POST porque no crea nada y el escenario es el mismo siempre.
   */
  if (req.method === "GET" && url.pathname === "/api/simulated-risk") {
    getSimulatedRiskAssessment()
      .then((assessment) =>
        sendJson(res, 200, {
          ignitionRisk: assessment.cells,
          ignitionAnalysis: {
            summary: assessment.summary,
            model: assessment.model,
            generatedAt: assessment.generatedAt,
          },
        }),
      )
      .catch((err) => {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error("[live] fallo generando el riesgo simulado:", message);
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
