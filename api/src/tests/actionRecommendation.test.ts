import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveFireSummary } from "../live/liveFireState";

vi.mock("../live/liveFireStore", () => ({
  findFireById: vi.fn(),
}));

vi.mock("../live/nebius", () => {
  class NebiusConfigError extends Error {}
  class NebiusRequestError extends Error {}
  class NebiusTimeoutError extends Error {}
  return {
    callNebiusForJson: vi.fn(),
    nebiusModelId: () => "nebius/test-model",
    NebiusConfigError,
    NebiusRequestError,
    NebiusTimeoutError,
  };
});

import { findFireById } from "../live/liveFireStore";
import {
  callNebiusForJson,
  NebiusConfigError,
  NebiusRequestError,
  NebiusTimeoutError,
} from "../live/nebius";
import {
  getActionRecommendation,
  isValidIncidentId,
  NotFoundError,
  validateModelOutput,
  ModelResponseError,
} from "../live/actionRecommendation";

let nextId = 0;
/** Cada test recibe un incidente con id/lastObserved únicos, para que la caché interna
 * de actionRecommendation.ts (por contenido, no solo por id) nunca cruce resultados
 * entre tests — ver la prueba de caché explícita, que sí reutiliza uno a propósito. */
function makeFire(overrides: Partial<LiveFireSummary> = {}): LiveFireSummary {
  nextId += 1;
  return {
    id: `11111111-1111-1111-1111-${String(nextId).padStart(12, "0")}`,
    centroid: { lat: 41.4, lng: 2.1 },
    firstObserved: "2026-09-19T10:00:00Z",
    lastObserved: `2026-09-19T10:${String(30 + nextId).padStart(2, "0")}:00Z`,
    cellIds: ["8839447131fffff"],
    areaHa: null,
    perimeterM: null,
    nHotspots: 1,
    confidence: "MEDIUM",
    source: "VIIRS_NOAA21_NRT",
    fireRadiativePowerMw: 1.2,
    wind: null,
    weather: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(findFireById).mockReset();
  vi.mocked(callNebiusForJson).mockReset();
});

describe("getActionRecommendation — incidente no encontrado", () => {
  it("lanza NotFoundError si el id no está en el estado actual (nunca cae a otra fuente)", async () => {
    vi.mocked(findFireById).mockReturnValue(undefined);
    await expect(getActionRecommendation("does-not-exist")).rejects.toThrow(NotFoundError);
    expect(callNebiusForJson).not.toHaveBeenCalled();
  });
});

describe("getActionRecommendation — detección sin confirmación de campo", () => {
  it("A01 recomendada, con título resuelto del catálogo y evidencia válida", async () => {
    const fire = makeFire({ confidence: "LOW", areaHa: null, perimeterM: null, nHotspots: 1 });
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue({
      status: "recommended",
      summary: "Detección única, sin confirmación operativa todavía.",
      recommendedAction: {
        id: "A01",
        title: "esto se ignora, nunca se confía en el título del modelo",
        reason: "Solo hay una detección de baja confianza, sin perímetro calculado.",
        evidence: [
          { field: "incident.detection.latestConfidence", explanation: "Confianza LOW del sensor." },
        ],
      },
      complementaryActionIds: ["A02"],
      missingData: ["Confirmación operativa del incidente"],
      limitations: [],
    });

    const result = await getActionRecommendation(fire.id);

    expect(result.status).toBe("recommended");
    expect(result.incidentId).toBe(fire.id);
    expect(result.mode).toBe("ACTUAL");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.recommendedAction?.id).toBe("A01");
    expect(result.recommendedAction?.title).toBe("Verificar el aviso"); // del catálogo, no del modelo
    expect(result.complementaryActionIds).toEqual(["A02"]);
  });

  it("caso real reportado: detección nocturna sin meteo/terreno/confirmación sigue permitiendo A01", async () => {
    // 03:22–04:06, VIIRS/NOAA-21, confianza media, FRP 0.7 MW, 3 detecciones usadas
    // para el perímetro (pero sin área/longitud calculadas todavía), sin confirmación
    // operativa. La falta de una táctica de extinción no debe bloquear la acción de
    // verificación — es justo el caso para el que existe A01.
    const fire = makeFire({
      confidence: "MEDIUM",
      areaHa: null,
      perimeterM: null,
      nHotspots: 3,
      fireRadiativePowerMw: 0.7,
      centroid: { lat: 41.4562, lng: 1.9791 },
    });
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue({
      status: "recommended",
      summary: "Detección de confianza media, sin confirmación operativa ni perímetro calculado.",
      recommendedAction: {
        id: "A01",
        title: "se ignora",
        reason: "Hay 3 detecciones de confianza media pero ninguna confirmación operativa registrada.",
        evidence: [
          { field: "incident.detection.latestConfidence", explanation: "Confianza MEDIUM, no confirmación en tierra." },
          { field: "incident.perimeter.hotspotsUsed", explanation: "3 detecciones acumuladas, sin área/perímetro aún." },
        ],
      },
      complementaryActionIds: [],
      missingData: ["Confirmación operativa del incidente"],
      limitations: [],
    });

    const result = await getActionRecommendation(fire.id);

    expect(result.status).toBe("recommended");
    expect(result.recommendedAction?.id).toBe("A01");
    expect(result.recommendedAction?.title).toBe("Verificar el aviso");
  });
});

describe("getActionRecommendation — incidente con datos incompletos", () => {
  it("insufficient_data cuando el modelo no puede fundamentar una prioridad", async () => {
    const fire = makeFire({ areaHa: null, perimeterM: null, confidence: null, source: null, fireRadiativePowerMw: null });
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue({
      status: "insufficient_data",
      summary: "No hay suficientes datos para priorizar una acción concreta.",
      recommendedAction: null,
      complementaryActionIds: [],
      missingData: ["Confianza de detección", "Perímetro estimado"],
      limitations: ["Sin evolución temporal disponible."],
    });

    const result = await getActionRecommendation(fire.id);

    expect(result.status).toBe("insufficient_data");
    expect(result.recommendedAction).toBeNull();
    expect(result.missingData).toContain("Confianza de detección");
  });
});

describe("getActionRecommendation — respuesta de Nebius inválida", () => {
  it("id de acción inexistente en el catálogo -> unavailable, nunca se cuela", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue({
      status: "recommended",
      summary: "x",
      recommendedAction: { id: "A99", reason: "motivo", evidence: [] },
      complementaryActionIds: [],
      missingData: [],
      limitations: [],
    });

    const result = await getActionRecommendation(fire.id);

    expect(result.status).toBe("unavailable");
    expect(result.recommendedAction).toBeNull();
    expect(result.requiresHumanReview).toBe(true);
  });

  it("JSON con forma inválida (no es un objeto) -> unavailable", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue("esto no es un objeto");

    const result = await getActionRecommendation(fire.id);

    expect(result.status).toBe("unavailable");
    expect(result.recommendedAction).toBeNull();
  });

  it("evidence.field fuera de las rutas permitidas -> unavailable", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue({
      status: "recommended",
      summary: "x",
      recommendedAction: {
        id: "A02",
        reason: "motivo",
        evidence: [{ field: "incident.poblacion_cercana", explanation: "inventado" }],
      },
      complementaryActionIds: [],
      missingData: [],
      limitations: [],
    });

    const result = await getActionRecommendation(fire.id);

    expect(result.status).toBe("unavailable");
  });

  it("status recommended pero sin recommendedAction -> unavailable", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue({
      status: "recommended",
      summary: "x",
      recommendedAction: null,
      complementaryActionIds: [],
      missingData: [],
      limitations: [],
    });

    const result = await getActionRecommendation(fire.id);
    expect(result.status).toBe("unavailable");
  });

  it("dedupe: quita el id de recommendedAction si el modelo lo repite en complementaryActionIds", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue({
      status: "recommended",
      summary: "x",
      recommendedAction: { id: "A02", reason: "motivo", evidence: [] },
      complementaryActionIds: ["A02", "A03", "A03"],
      missingData: [],
      limitations: [],
    });

    const result = await getActionRecommendation(fire.id);

    expect(result.status).toBe("recommended");
    expect(result.complementaryActionIds).toEqual(["A03"]);
  });
});

describe("getActionRecommendation — fallos del proveedor", () => {
  it("timeout -> unavailable, sin lanzar", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockRejectedValue(new NebiusTimeoutError("timed out"));

    const result = await getActionRecommendation(fire.id);
    expect(result.status).toBe("unavailable");
    expect(result.recommendedAction).toBeNull();
  });

  it("error del proveedor (5xx/red) -> unavailable, sin lanzar", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockRejectedValue(new NebiusRequestError("502 bad gateway"));

    const result = await getActionRecommendation(fire.id);
    expect(result.status).toBe("unavailable");
  });

  it("clave ausente (NEBIUS_API_KEY) -> unavailable, sin lanzar", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockRejectedValue(new NebiusConfigError("Falta NEBIUS_API_KEY"));

    const result = await getActionRecommendation(fire.id);
    expect(result.status).toBe("unavailable");
  });

  it("nunca presenta el fallback como si viniera de Nebius: sin campo model/proveedor en la respuesta", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockRejectedValue(new NebiusTimeoutError("timed out"));

    const result = await getActionRecommendation(fire.id);
    expect(result).not.toHaveProperty("model");
    expect(result.summary).not.toMatch(/nebius/i);
  });
});

describe("caché — vinculada al contenido del incidente, no solo al id", () => {
  it("no vuelve a llamar a Nebius si el incidente no ha cambiado", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValue(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue({
      status: "insufficient_data",
      summary: "x",
      recommendedAction: null,
      complementaryActionIds: [],
      missingData: [],
      limitations: [],
    });

    await getActionRecommendation(fire.id);
    await getActionRecommendation(fire.id);

    expect(callNebiusForJson).toHaveBeenCalledTimes(1);
  });

  it("vuelve a llamar a Nebius si el incidente cambió (nueva detección) aunque el id sea el mismo", async () => {
    const fire = makeFire();
    vi.mocked(findFireById).mockReturnValueOnce(fire);
    vi.mocked(callNebiusForJson).mockResolvedValue({
      status: "insufficient_data",
      summary: "x",
      recommendedAction: null,
      complementaryActionIds: [],
      missingData: [],
      limitations: [],
    });
    await getActionRecommendation(fire.id);

    const updatedFire: LiveFireSummary = { ...fire, lastObserved: "2026-09-19T23:59:00Z", fireRadiativePowerMw: 9.9 };
    vi.mocked(findFireById).mockReturnValueOnce(updatedFire);
    await getActionRecommendation(fire.id);

    expect(callNebiusForJson).toHaveBeenCalledTimes(2);
  });
});

describe("validateModelOutput — contrato en aislado", () => {
  it("acepta una respuesta 'recommended' bien formada", () => {
    const parsed = validateModelOutput({
      status: "recommended",
      summary: "resumen",
      recommendedAction: { id: "A04", reason: "motivo", evidence: [] },
      complementaryActionIds: ["A05"],
      missingData: [],
      limitations: [],
    });
    expect(parsed.status).toBe("recommended");
    expect(parsed.recommendedAction?.title).toBe("Establecer el plan de intervención y los recursos");
  });

  it("rechaza un status fuera del enum", () => {
    expect(() => validateModelOutput({ status: "urgent", summary: "x" })).toThrow(ModelResponseError);
  });

  it("rechaza insufficient_data que trae recommendedAction igualmente", () => {
    expect(() =>
      validateModelOutput({
        status: "insufficient_data",
        summary: "x",
        recommendedAction: { id: "A01", reason: "y", evidence: [] },
      }),
    ).toThrow(ModelResponseError);
  });
});

describe("isValidIncidentId", () => {
  it("acepta un uuid", () => {
    expect(isValidIncidentId("70292af5-2b29-4986-9492-f98b5e6e2882")).toBe(true);
  });
  it("rechaza texto arbitrario", () => {
    expect(isValidIncidentId("'; DROP TABLE fires; --")).toBe(false);
  });
});
