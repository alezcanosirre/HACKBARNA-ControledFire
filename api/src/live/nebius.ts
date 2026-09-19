/**
 * Cliente mínimo para Nebius Token Factory (map/spec.md la nombra como proveedor de
 * IA del hackathon). Su API de chat es compatible con el formato de OpenAI — un solo
 * endpoint, sin SDK propio necesario para esto.
 */
const BASE_URL = (process.env.NEBIUS_BASE_URL ?? "https://api.studio.nebius.ai/v1").replace(/\/$/, "");
const MODEL = process.env.NEBIUS_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct";

/**
 * No todos los proveedores compatibles con OpenAI soportan `response_format:
 * json_object` de la misma forma — en vez de arriesgarse a que el parámetro tire la
 * petición entera, se le pide el JSON por instrucciones del prompt y se extrae aquí de
 * forma tolerante (el modelo a veces lo envuelve en ```json ... ``` pese a que se le
 * pida que no lo haga).
 */
function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No se encontró JSON en la respuesta de Nebius: ${content.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Llama a chat/completions con un system+user prompt y devuelve el JSON ya parseado. */
export async function callNebiusForJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) {
    throw new Error("Falta NEBIUS_API_KEY. Copia api/.env.example a api/.env y rellénala.");
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Nebius chat/completions failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Respuesta de Nebius sin choices[0].message.content");
  }

  return extractJson(content);
}

export function nebiusModelId(): string {
  return `nebius/${MODEL}`;
}
