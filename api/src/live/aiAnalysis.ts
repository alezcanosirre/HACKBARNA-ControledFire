/**
 * Refleja map/src/mocks/types.ts (spec.md §6.4) — mismo motivo de siempre para la
 * duplicación: los dos proyectos TS no comparten path (ver map/spec.md §3). Esta es
 * la forma que useFireActions.ts espera recibir cuando deje de usar el stub.
 */
export interface RankedAction {
  readonly action_id: string;
  readonly label: string;
  readonly rank: number; // 1 = primera
  readonly urgency: "immediate" | "soon" | "monitor";
  readonly why: string; // justificación, obligatoria
  readonly resources?: string[];
  readonly eta_min?: number;
  readonly status: "proposed" | "accepted" | "rejected" | "done";
}

export interface AIAnalysis {
  readonly target_id: string; // cluster_id
  readonly summary: string;
  readonly priority_rationale: string;
  readonly actions: RankedAction[];
  readonly model: string;
  readonly generated_at: string; // ISO 8601
}

const VALID_URGENCY = new Set(["immediate", "soon", "monitor"]);

/**
 * El modelo puede devolver cualquier cosa — json mal formado, campos que faltan,
 * urgencias inventadas. Esto valida y normaliza en vez de confiar a ciegas: si algo no
 * cuadra, lanza en vez de dejar pasar un `AIAnalysis` a medias que rompa el frontend en
 * silencio. `target_id`/`model`/`generated_at` los pone el servidor, no el modelo — no
 * hay razón para confiar en que el LLM copie bien un uuid.
 */
export function toAiAnalysis(raw: unknown, targetId: string, model: string): AIAnalysis {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Respuesta de Nebius no es un objeto JSON");
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.summary !== "string" || typeof body.priority_rationale !== "string") {
    throw new Error("Respuesta de Nebius sin summary/priority_rationale");
  }
  if (!Array.isArray(body.actions) || body.actions.length === 0) {
    throw new Error("Respuesta de Nebius sin actions");
  }

  const actions: RankedAction[] = body.actions.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`actions[${i}] no es un objeto`);
    }
    const a = raw as Record<string, unknown>;
    if (typeof a.action_id !== "string" || typeof a.label !== "string" || typeof a.why !== "string") {
      throw new Error(`actions[${i}] sin action_id/label/why`);
    }
    if (typeof a.urgency !== "string" || !VALID_URGENCY.has(a.urgency)) {
      throw new Error(`actions[${i}].urgency inválida: ${String(a.urgency)}`);
    }

    return {
      action_id: a.action_id,
      label: a.label,
      rank: typeof a.rank === "number" ? a.rank : i + 1,
      urgency: a.urgency as RankedAction["urgency"],
      why: a.why,
      resources: Array.isArray(a.resources) ? a.resources.filter((r) => typeof r === "string") : undefined,
      eta_min: typeof a.eta_min === "number" ? a.eta_min : undefined,
      // El estado lo decide el operador al aceptar/descartar, nunca el modelo — spec §5.4.
      status: "proposed",
    };
  });

  actions.sort((a, b) => a.rank - b.rank);

  return {
    target_id: targetId,
    summary: body.summary,
    priority_rationale: body.priority_rationale,
    actions,
    model,
    generated_at: new Date().toISOString(),
  };
}
