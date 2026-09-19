/**
 * Vocabulario del backend: api/src/types/common.ts define
 *   CellStatus = "NORMAL" | "BURNING" | "BURNED" | "PROTECTED"
 * De momento solo nos importa BURNING, así que aquí están solo esos dos. BURNED y
 * PROTECTED se añaden cuando haya datos que los usen, no antes.
 */
export type CellStatus = 'NORMAL' | 'BURNING';

export type RGBA = [number, number, number, number];

// Los cálidos son SOLO para fuego. Ver map/spec.md §7. Ni un botón usa esta gama.
export const STATUS_FILL: Record<CellStatus, RGBA> = {
  NORMAL: [0, 0, 0, 0],            // invisible
  BURNING: [236, 56, 28, 205],
};

export const STATUS_STROKE: Record<CellStatus, RGBA> = {
  NORMAL: [148, 163, 184, 45],     // rejilla base, apenas perceptible
  BURNING: [255, 138, 92, 235],
};

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * Aplica el latido a un color de estado: con t = 0 el color se apaga y se oscurece,
 * con t = 1 se aviva. No cambia el tono, solo brillo y opacidad, así que una celda
 * roja sigue leyéndose como roja en cualquier punto del ciclo.
 */
export function pulsed([r, g, b, a]: RGBA, t: number): RGBA {
  const k = 0.72 + t * 0.5;   // 0,72 → 1,22
  return [clamp255(r * k), clamp255(g * k), clamp255(b * k), clamp255(a * (0.6 + t * 0.4))];
}
