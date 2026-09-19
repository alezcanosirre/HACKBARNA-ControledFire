/**
 * Cliente mínimo para Nebius Token Factory (map/spec.md la nombra como proveedor de IA
 * del hackathon). Su API de chat es compatible con el formato de OpenAI — un solo
 * endpoint, sin SDK propio necesario para esto.
 *
 * LIMITACIÓN CONOCIDA: no se ha podido verificar contra la documentación real de
 * Nebius ni contra una llamada real (la red de este entorno de desarrollo tiene
 * bloqueado api.studio.nebius.ai) si el modelo configurado soporta salida
 * estructurada (`response_format`). Se pide de todas formas — si el proveedor la
 * ignora o la rechaza, se reintenta sin ella; la validación real pasa siempre por
 * actionRecommendation.ts en el servidor, nunca se confía en que el formato pedido
 * sea el que realmente llegó.
 */
const BASE_URL = (process.env.NEBIUS_BASE_URL ?? "https://api.studio.nebius.ai/v1").replace(/\/$/, "");
const MODEL = process.env.NEBIUS_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct";
const TIMEOUT_MS = Number(process.env.NEBIUS_TIMEOUT_MS ?? 20_000);

export class NebiusTimeoutError extends Error {}
export class NebiusConfigError extends Error {}
export class NebiusRequestError extends Error {}

/**
 * El modelo a veces envuelve el JSON en ```json ... ``` pese a que se le pida que no
 * lo haga — se extrae de forma tolerante en vez de exigir un `JSON.parse` exacto sobre
 * todo el contenido.
 */
function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new NebiusRequestError(`No se encontró JSON en la respuesta de Nebius: ${content.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  useJsonObjectFormat: boolean,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        ...(useJsonObjectFormat ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new NebiusTimeoutError(`Nebius no respondió en ${TIMEOUT_MS}ms`);
    }
    throw new NebiusRequestError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

/** Llama a chat/completions con un system+user prompt y devuelve el JSON ya parseado. */
export async function callNebiusForJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) {
    throw new NebiusConfigError("Falta NEBIUS_API_KEY. Copia api/.env.example a api/.env y rellénala.");
  }

  let res = await chatCompletion(systemPrompt, userPrompt, apiKey, true);
  // Algunos despliegues OpenAI-compatibles rechazan un response_format que no
  // reconocen en vez de ignorarlo — un solo reintento sin él antes de darse por
  // vencido, no un backoff en bucle.
  if (!res.ok && res.status === 400) {
    res = await chatCompletion(systemPrompt, userPrompt, apiKey, false);
  }

  if (!res.ok) {
    throw new NebiusRequestError(`Nebius chat/completions failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new NebiusRequestError("Respuesta de Nebius sin choices[0].message.content");
  }

  return extractJson(content);
}

export function nebiusModelId(): string {
  return `nebius/${MODEL}`;
}
