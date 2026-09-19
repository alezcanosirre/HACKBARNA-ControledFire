/**
 * Área metropolitana de Barcelona: [oeste, sur, este, norte].
 * Más ajustado que BBOX_CATALUNYA (map/src/map/constants.ts) — ese cubre
 * toda Catalunya para el modo PRED, este es solo la zona que nos interesa
 * para incendios reales en vivo.
 */
export const BBOX_BCN_METRO: readonly [number, number, number, number] = [
  1.85, 41.25, 2.35, 41.55,
];

export function isInBbox(
  lng: number,
  lat: number,
  bbox: readonly [number, number, number, number] = BBOX_BCN_METRO,
): boolean {
  const [w, s, e, n] = bbox;
  return lng >= w && lng <= e && lat >= s && lat <= n;
}
