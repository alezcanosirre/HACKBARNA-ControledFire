import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Carga api/.env a mano — sin dependencia de `dotenv`. Solo `KEY=VALUE` por
 * línea, sin variables anidadas ni comillas complejas; nos vale.
 */
function loadEnvFile(path: string): void {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return; // sin api/.env, se usan las variables de entorno del sistema
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // No solo "la clave existe" — una variable de entorno real vacía ("" o no
    // definida) no cuenta como una anulación deliberada, y no debe bloquear el valor
    // de api/.env. Sin esto, un NEBIUS_API_KEY="" heredado de una sesión de shell
    // anterior deja la clave vacía para siempre aunque .env tenga la real.
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const here = dirname(fileURLToPath(import.meta.url));
loadEnvFile(join(here, "..", "..", ".env")); // api/.env
