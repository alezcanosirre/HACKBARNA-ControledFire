import { callNebiusForJson } from "./nebius";
import type { IgnitionRiskCell, RiskDriver } from "./ignitionRisk";

/**
 * The model scores ignition risk; the heuristic is only the floor under it.
 *
 * `ignitionRisk.ts` still does the measuring — it counts a cell's ignition history and
 * pairs it with the forecast — but the weights that turned those numbers into a 0-1 were
 * picked by hand and calibrated against nothing. Handing the measurements to the model
 * and asking it for the score puts the judgement somewhere that can at least explain
 * itself, and its reasoning goes on screen next to the number.
 *
 * What does NOT change is where the inputs come from. The history is Deepfire's, the
 * weather is met.no's, and the model is told to score what it is given and nothing else.
 * It is a different judge, not a different source.
 *
 * On any failure — no key, timeout, malformed answer — the heuristic scores are served
 * untouched. A forecast that silently disappears because a provider is down is worse
 * than one computed by a formula we wrote down.
 */

export interface IgnitionAssessment {
  readonly cells: readonly IgnitionRiskCell[];
  /** The model's read of the area as a whole. Null when the heuristic is being served. */
  readonly summary: string | null;
  /** Null while the heuristic is in use, so the UI can say which one it is showing. */
  readonly model: string | null;
  readonly generatedAt: string;
}

const MAX_CELLS = 24;
const MAX_SUMMARY_LEN = 600;
const MAX_RATIONALE_LEN = 300;

const OUTPUT_CONTRACT = `Return ONLY a JSON object in exactly this shape, with no text before or after and no code fence:

{
  "summary": "2-4 sentences on the area as a whole: where the risk concentrates today and why.",
  "cells": [
    {
      "cellId": "<the id exactly as given>",
      "risk": 0.0,
      "rationale": "One or two sentences on why this cell scores what it scores."
    }
  ]
}

Score every cell you are given, once each, with its id copied exactly.
"risk" is a number between 0 and 1.`;

const SYSTEM_PROMPT = `You are a wildfire risk analyst for the Barcelona metropolitan region. You are scoring IGNITION risk — how likely a fire is to START in a cell over the next 24 hours — not how an existing fire would spread.

For each cell you are given measured inputs and nothing else:
- "ignitionsSince2024": how many fire clusters satellites have detected in that cell since 2024. It is a base rate, not a forecast: it says where fires have actually started.
- "forecast": the worst conditions expected in the cell over the window — lowest humidity, peak temperature, peak wind — from a weather service, with the hour each one falls.
- "baselineRisk": a hand-weighted formula's score for the same inputs. Treat it as one more opinion, not as an answer to reproduce. Disagree with it where the inputs justify disagreeing.

Strict rules:
- Score only from the inputs given. Do not use knowledge of these places, of the season, or of fires you have heard about.
- History says WHERE and weather says HOW MUCH. A cell with no history is not made dangerous by a hot day alone, and a cell that burns every year is not safe because today is humid.
- Dry, hot and windy compound each other. Two of the three at once is worse than the sum of them apart.
- Do not invent a driver you were not given. There is no fuel model, no slope and no ignition-cause data here.
- Write in English, in short sentences someone under pressure can read.
- Do not name a municipality or a place: you are given coordinates, and guessing the name is how a forecast gets quoted for the wrong valley.

${OUTPUT_CONTRACT}`;

function buildUserPrompt(cells: readonly IgnitionRiskCell[]): string {
  const payload = cells.slice(0, MAX_CELLS).map((c) => {
    const by = (factor: string) => c.drivers.find((d) => d.factor === factor)?.value ?? null;
    return {
      cellId: c.cell_id,
      lat: Number(c.lat.toFixed(4)),
      lng: Number(c.lng.toFixed(4)),
      ignitionsSince2024: by("history"),
      forecast: {
        humidity: by("fuel_dryness"),
        temperature: by("temperature"),
        wind: by("wind_speed"),
        horizonHours: c.horizonHours,
      },
      baselineRisk: Number(c.risk.toFixed(2)),
    };
  });
  return JSON.stringify({ cells: payload }, null, 2);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/**
 * The model's scores, merged onto the measured cells.
 *
 * A cell the model skipped or scored out of range keeps its heuristic value rather than
 * being dropped: losing a cell from the map is a silent error, and a cell showing the
 * formula's number is a visible, explicable one.
 */
function merge(
  cells: readonly IgnitionRiskCell[],
  scored: ReadonlyMap<string, { risk: number; rationale: string }>,
): IgnitionRiskCell[] {
  return cells.map((cell) => {
    const hit = scored.get(cell.cell_id);
    if (!hit) return cell;
    const drivers: RiskDriver[] = [...cell.drivers];
    return { ...cell, risk: hit.risk, rationale: hit.rationale, drivers };
  });
}

function parse(raw: unknown): { summary: string; scored: Map<string, { risk: number; rationale: string }> } {
  if (typeof raw !== "object" || raw === null) throw new Error("respuesta no es un objeto");
  const body = raw as Record<string, unknown>;

  const summary = typeof body.summary === "string" ? truncate(body.summary, MAX_SUMMARY_LEN) : "";
  if (!summary) throw new Error("falta summary");

  if (!Array.isArray(body.cells)) throw new Error("falta cells");
  const scored = new Map<string, { risk: number; rationale: string }>();
  for (const item of body.cells) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    if (typeof c.cellId !== "string" || typeof c.risk !== "number" || !Number.isFinite(c.risk)) continue;
    scored.set(c.cellId, {
      risk: clamp01(c.risk),
      rationale: typeof c.rationale === "string" ? truncate(c.rationale, MAX_RATIONALE_LEN) : "",
    });
  }
  if (scored.size === 0) throw new Error("ninguna celda puntuada");

  return { summary, scored };
}

export async function assessIgnitionRisk(
  cells: readonly IgnitionRiskCell[],
): Promise<IgnitionAssessment> {
  const generatedAt = new Date().toISOString();
  if (cells.length === 0) return { cells, summary: null, model: null, generatedAt };

  try {
    const raw = await callNebiusForJson(SYSTEM_PROMPT, buildUserPrompt(cells));
    const { summary, scored } = parse(raw);
    return {
      cells: merge(cells, scored),
      summary,
      model: process.env.NEBIUS_MODEL ?? "nebius",
      generatedAt,
    };
  } catch (err) {
    console.error(
      "[live] evaluación de riesgo por IA no disponible, se sirve la heurística:",
      err instanceof Error ? err.message : err,
    );
    return { cells, summary: null, model: null, generatedAt };
  }
}
