import type { RGBA } from '../live/liveFires';

/**
 * The continuous risk ramp of spec.md §4.7. PRED does not use the discrete states that
 * ACTUAL does: risk is a number, so it is interpolated rather than bucketed.
 *
 * Amber for moderate risk, saturated and opaque red for the hot spot — the whiteboard's
 * "Rojo = Punto Caliente". Below 0.25 nothing is painted at all: colouring everything is
 * how you stop being able to see what matters.
 */
export function riskFill(risk: number): RGBA {
  const r = Math.max(0, Math.min(1, risk));
  if (r < 0.25) return [0, 0, 0, 0];
  return [
    255,
    Math.round(210 - r * 175), // 210 (amber) → 35 (red)
    Math.round(70 - r * 60),
    Math.round(40 + r * 150), // the most dangerous ones, more opaque
  ];
}

/** Outline for the same cell: the fill one step brighter, so the lattice survives. */
export function riskStroke(risk: number): RGBA {
  const [, g, b, a] = riskFill(risk);
  if (a === 0) return [0, 0, 0, 0];
  return [255, Math.min(255, g + 45), Math.min(255, b + 40), Math.min(255, a + 60)];
}
