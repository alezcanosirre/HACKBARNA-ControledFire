import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Serves the built frontend (`map/dist`) from this same process, so one Render service
 * is the whole deploy — no second host, no CORS, no `vercel.json` rewriting `/api/*` to
 * wherever the backend happens to live. `npm run build` inside `map/` has to have run
 * first; if `dist` doesn't exist (e.g. local dev without building it, where Vite's own
 * dev server serves the frontend instead), this quietly serves nothing and the API
 * routes above it in server.ts keep working exactly as before.
 */
const DIST_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "../../../map/dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/**
 * Returns true if it handled the request. Callers should only reach this after their
 * own `/api/*` routes have all missed — a typo'd API path must still get a proper JSON
 * 404, not the SPA's index.html.
 */
export function serveFrontend(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== "GET" || !existsSync(DIST_DIR)) return false;

  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  const requested = join(DIST_DIR, pathname);

  // A real built asset (JS/CSS/etc.) wins; anything else — /actual, /pred/:id, a
  // reload mid-route — is the client-side router's territory, so it falls back to
  // index.html and React Router takes it from there.
  const filePath =
    existsSync(requested) && statSync(requested).isFile() ? requested : join(DIST_DIR, "index.html");
  if (!existsSync(filePath)) return false;

  res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(res);
  return true;
}
