import type { EnvironmentState, Position } from "../types";

/**
 * Sustituye al motor de propagación (api/src/engine/fire/propagateTick.ts) para el
 * modo SIMULACIÓN: en vez de calcular cómo se extiende un incendio tick a tick, cada
 * caso es una FOTO FIJA de qué celdas arden — "unas celdas únicas", sin `step()` ni
 * reloj detrás. Esto es solo el dato; cómo se pinta y cómo se navega entre casos lo
 * decide map/ (map/src/engine/useSimulation.ts hoy es quien llama al motor — deja de
 * hacerlo cuando el front pase a leer de aquí).
 *
 * `SimulatedCell` sigue siendo mínima: de cada celda, lo único que hoy pinta el mapa es
 * `position` (para ubicarla en el grid local, vía map/src/engine/anchor.ts) e
 * `intensity` (para el color — ver `intensityFill` en map/src/App.tsx).
 *
 * El resto de `SimulatedFireCase` (todo excepto id/nombre/celdas) es DATO INVENTADO A
 * PROPÓSITO — a diferencia de api/src/live/ (Deepfire real, donde un campo sin dato
 * real se omite), aquí no hay ninguna API detrás que decepcionar, así que se rellena
 * con lo que un panel de incidente necesita para leerse completo. La forma calca la
 * del `Fire` que ya consume el panel de detalle (map/src/mocks/types.ts, spec.md §6.2)
 * — mismos campos, en camelCase en vez de snake_case porque esto es un módulo TS que
 * se importa directo, no JSON de una API — para que adaptarlo sea renombrar, no rediseñar.
 */

export interface SimulatedCell {
  readonly position: Position;
  readonly intensity: number; // 0-1
}

export type SimulatedLandCover = "urban" | "wui" | "forest" | "scrub" | "crop" | "bare";
export type SimulatedFuelLoad = "low" | "moderate" | "high" | "extreme";
export type SimulatedValueType = "school" | "hospital" | "care_home" | "settlement" | "infrastructure";

/** Calca ValueAtRisk de map/src/mocks/types.ts. */
export interface SimulatedValueAtRisk {
  readonly type: SimulatedValueType;
  readonly name: string;
  readonly distanceKm: number;
  readonly population?: number;
  // ¿Está en la trayectoria del viento? Es el campo que convierte "hay un colegio
  // cerca" en "hay que evacuar ese colegio ya" (spec §6.2, UX §5).
  readonly downwind: boolean;
}

export interface SimulatedFireCase {
  readonly id: string;
  readonly name: string; // topónimo legible — nunca se enseña un id en pantalla (UX §5)
  // Mismo grid local {x,y} que api/src/scenario/collserola.ts — sin lat/lng aquí, el
  // front la ancla a un punto real del mapa (ver map/src/engine/anchor.ts SIM_CENTER).
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly burningCells: readonly SimulatedCell[];
  // Hectáreas ya quemadas — un número fijo, no derivado de contar celdas (el tamaño de
  // celda del grid local no equivale a un valor real de área, ver anchor.ts).
  readonly burnedAreaHa: number;
  readonly detectedAt: string; // ISO 8601
  readonly confidence: number; // 0-1
  readonly source: "camera" | "manual" | "deepfire";
  // Hacia dónde y a qué velocidad avanza el frente — no de dónde sopla el viento
  // (ver `environment.wind.direction`, que es meteorológico: de dónde VIENE).
  readonly spread: { readonly directionDeg: number; readonly speedKmh: number };
  readonly environment: EnvironmentState;
  readonly zone: {
    readonly landCover: SimulatedLandCover;
    readonly slopeDeg: number;
    readonly fuelLoad: SimulatedFuelLoad;
  };
  readonly valuesAtRisk: readonly SimulatedValueAtRisk[];
}

const WIDTH = 20;
const HEIGHT = 15;

export const SIMULATED_FIRE_CASES: readonly SimulatedFireCase[] = [
  {
    id: "sim-collserola",
    name: "Incendio en Collserola",
    mapWidth: WIDTH,
    mapHeight: HEIGHT,
    burnedAreaHa: 34,
    detectedAt: "2026-09-19T14:12:00+02:00",
    confidence: 0.92,
    source: "camera", // red de cámaras forestales del parque
    // Viento del NO (315°) empuja el frente hacia el SE (135°) — mismo patrón que
    // api/src/scenario/collserola.ts, para que las dos lecturas no se contradigan.
    spread: { directionDeg: 135, speedKmh: 1.4 },
    environment: { temperature: 32, humidity: 0.15, wind: { speed: 25, direction: 315 } },
    zone: { landCover: "wui", slopeDeg: 18, fuelLoad: "high" },
    valuesAtRisk: [
      { type: "school", name: "CEIP Turó de Can Mates", distanceKm: 1.8, population: 420, downwind: true },
      { type: "settlement", name: "Vallvidrera", distanceKm: 2.6, population: 4700, downwind: true },
      { type: "infrastructure", name: "BV-1415", distanceKm: 0.9, downwind: false },
    ],
    // The one big zone of the three cases (see the comment on sim-sant-andreu below for
    // the contrast this is deliberately drawn against): one compact front, hottest at
    // its head and cooling outward, not a giant blob — 14 of the grid's 300 cells.
    burningCells: [
      { position: { x: 6, y: 10 }, intensity: 0.9 },
      { position: { x: 7, y: 10 }, intensity: 0.9 },
      { position: { x: 7, y: 9 }, intensity: 0.8 },
      { position: { x: 8, y: 9 }, intensity: 0.7 },
      { position: { x: 8, y: 10 }, intensity: 0.65 },
      { position: { x: 6, y: 9 }, intensity: 0.6 },
      { position: { x: 6, y: 11 }, intensity: 0.6 },
      { position: { x: 5, y: 10 }, intensity: 0.55 },
      { position: { x: 7, y: 11 }, intensity: 0.5 },
      { position: { x: 5, y: 11 }, intensity: 0.45 },
      { position: { x: 9, y: 9 }, intensity: 0.4 },
      { position: { x: 8, y: 11 }, intensity: 0.4 },
      { position: { x: 4, y: 10 }, intensity: 0.35 },
      { position: { x: 6, y: 12 }, intensity: 0.35 },
    ],
  },
  {
    id: "sim-montseny",
    name: "Incendio en el Montseny",
    mapWidth: WIDTH,
    mapHeight: HEIGHT,
    burnedAreaHa: 18,
    detectedAt: "2026-09-19T13:05:00+02:00",
    confidence: 0.85,
    source: "manual", // aviso de un senderista
    // Viento flojo del S (200°) hacia el N (20°) — el frente avanza despacio, más
    // contenido; lo que manda aquí es la pendiente, no el viento.
    spread: { directionDeg: 20, speedKmh: 0.4 },
    environment: { temperature: 27, humidity: 0.35, wind: { speed: 8, direction: 200 } },
    zone: { landCover: "forest", slopeDeg: 34, fuelLoad: "extreme" },
    valuesAtRisk: [
      { type: "infrastructure", name: "Línea 110 kV Montseny-Vic", distanceKm: 1.5, downwind: true },
    ],
    burningCells: [
      { position: { x: 14, y: 4 }, intensity: 0.8 },
      { position: { x: 15, y: 4 }, intensity: 0.75 },
      { position: { x: 14, y: 5 }, intensity: 0.55 },
      { position: { x: 15, y: 3 }, intensity: 0.45 },
    ],
  },
  {
    id: "sim-sant-andreu",
    name: "Incendio urbano en Sant Andreu (Barcelona)",
    mapWidth: WIDTH,
    mapHeight: HEIGHT,
    // Mucho más pequeño que los otros dos a propósito: no es un frente forestal
    // abierto, es una manzana/edificio ardiendo — pocas celdas, muy juntas, muy
    // intensas, en vez de un blob extendido.
    burnedAreaHa: 2,
    detectedAt: "2026-09-19T18:40:00+02:00",
    confidence: 0.97, // urbano y con testigos: se confirma casi al instante
    source: "manual", // llamada vecinal al 112
    // Un incendio urbano no "avanza" como un frente forestal — se contiene edificio a
    // edificio. Dirección nominal (viento 250° → hacia 70°), velocidad casi nula.
    spread: { directionDeg: 70, speedKmh: 0.1 },
    // Poco viento y bastante humedad: lo que manda aquí no es el tiempo, es que
    // arde combustible urbano (edificios), no vegetación.
    environment: { temperature: 24, humidity: 0.45, wind: { speed: 10, direction: 250 } },
    // fuelLoad no tiene una categoría "urbana" propia en el vocabulario de spec §6.2 —
    // 'moderate' es la aproximación menos falsa para material de construcción/interiores.
    zone: { landCover: "urban", slopeDeg: 2, fuelLoad: "moderate" },
    valuesAtRisk: [
      { type: "settlement", name: "Bloc Carrer de Sant Adrià 42", distanceKm: 0.1, population: 140, downwind: true },
      { type: "school", name: "Escola Mare de Déu del Carme", distanceKm: 0.4, population: 310, downwind: true },
    ],
    burningCells: [
      { position: { x: 3, y: 3 }, intensity: 0.95 },
      { position: { x: 4, y: 3 }, intensity: 0.9 },
      { position: { x: 3, y: 2 }, intensity: 0.7 },
      { position: { x: 4, y: 2 }, intensity: 0.5 },
    ],
  },
];

export function simulatedFireCaseById(id: string): SimulatedFireCase | null {
  return SIMULATED_FIRE_CASES.find((c) => c.id === id) ?? null;
}
