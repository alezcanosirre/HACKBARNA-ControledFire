import "./loadEnv";
import { createServer } from "node:http";
import { fetchLiveHotspotsInBcnMetro, type LiveHotspot } from "./deepfireHotspots";

const PORT = Number(process.env.LIVE_SERVER_PORT ?? 3001);
// No sirve una petición nueva a Deepfire más seguida que esto, aunque el
// frontend pida más a menudo — protege el rate limit compartido.
const MIN_REFETCH_MS = Number(process.env.POLL_INTERVAL_MS ?? 30_000);

let cache: { data: LiveHotspot[]; fetchedAt: number } | null = null;
let inFlight: Promise<LiveHotspot[]> | null = null;

async function getHotspots(): Promise<LiveHotspot[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < MIN_REFETCH_MS) {
    return cache.data;
  }
  if (inFlight) return inFlight;

  inFlight = fetchLiveHotspotsInBcnMetro()
    .then((data) => {
      cache = { data, fetchedAt: Date.now() };
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

const server = createServer(async (req, res) => {
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

  try {
    const hotspots = await getHotspots();
    res.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({ hotspots, fetchedAt: cache?.fetchedAt ?? Date.now() }),
    );
  } catch (err) {
    console.error("[live] fetching Deepfire hotspots failed:", err);
    res.writeHead(502, { "Content-Type": "application/json" }).end(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown error" }),
    );
  }
});

server.listen(PORT, () => {
  console.log(`[live] Deepfire hotspots proxy listening on http://localhost:${PORT}`);
});
