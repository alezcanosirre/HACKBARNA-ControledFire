/**
 * Área de consulta del feed en vivo: [oeste, sur, este, norte].
 *
 * Es la Regió Metropolitana de Barcelona, que es lo que le importa a la demo, y es
 * EXACTAMENTE el mismo bbox que BBOX_RMB en map/src/map/constants.ts: la zona que el
 * mapa cubre con rejilla y en la que arranca la cámara. Consultar más ancho traería
 * incendios que nadie va a ver sin salirse del encuadre; consultar más estrecho dejaría
 * huecos dentro de él.
 *
 * Sustituye a una caja anterior de [1.85, 41.25, 2.35, 41.55] que era más pequeña sin
 * motivo: se dejaba fuera el Montseny, el Montnegre, buena parte del Vallès Oriental y
 * el Penedès, todos ellos dentro del área metropolitana y todos ellos pintados en el
 * mapa. Cubre los 164 municipios de la RMB más Collserola, Garraf, Montseny y Montnegre.
 */
export const BBOX_RMB: readonly [number, number, number, number] = [
  1.55, 41.15, 2.6, 41.85,
];

export function isInBbox(
  lng: number,
  lat: number,
  bbox: readonly [number, number, number, number] = BBOX_RMB,
): boolean {
  const [w, s, e, n] = bbox;
  return lng >= w && lng <= e && lat >= s && lat <= n;
}
