import { WebMercatorViewport } from '@deck.gl/core';
import type { MapViewState } from '@deck.gl/core';
import {
  BBOX_CATALUNYA,
  FOCUS_MAX_ZOOM,
  FOCUS_PADDING_PX,
  MAX_ZOOM,
  MIN_ZOOM,
} from './constants';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// El límite de navegación es CATALUÑA, no la RMB. La RMB sigue siendo el área
// funcional (donde hay rejilla y celdas pulsables) y el encuadre de arranque, pero
// acotar la cámara ahí mismo hacía que un foco pegado al borde no se pudiera centrar
// y que el vuelo de FlyToInterpolator chocara contra el tope a media transición.
const [W, S, E, N] = BBOX_CATALUNYA;

/**
 * El operador no puede salirse de Cataluña. deck.gl toma el control de la
 * cámara cuando <Map> va dentro de <DeckGL>, así que el `maxBounds` de MapLibre no
 * llega a aplicarse: el acotado se hace aquí, sobre el viewState de cada movimiento.
 *
 * Se acota el RECTÁNGULO VISIBLE, no el centro. Acotar solo el centro dejaba arrastrar
 * hasta poner el foco en la esquina del bbox con media pantalla enseñando terreno de
 * fuera; ahora el borde de la pantalla es el que topa contra el límite.
 *
 * Necesita el tamaño del lienzo: sin él no se sabe cuántos grados abarca la pantalla.
 * Mientras deck.gl no lo haya medido (width = 0 en el primer render) se devuelve el
 * viewState tal cual.
 */
export function clampToArea(
  vs: MapViewState,
  width: number,
  height: number,
): MapViewState {
  if (!width || !height) return vs;

  // Zoom mínimo: aquel en el que el bbox entero cabe en pantalla. Por debajo solo se
  // añadiría terreno de fuera, así que es el tope de alejamiento.
  const fitZoom = new WebMercatorViewport({ width, height }).fitBounds([
    [W, S],
    [E, N],
  ]).zoom;

  // El mínimo lo marca el encaje, no una constante: en una ventana estrecha o muy
  // apaisada el zoom que hace caber el bbox no es el mismo, y forzar un número fijo
  // dejaba media pantalla fuera del área por un lado mientras recortaba por el otro.
  const zoom = clamp(vs.zoom ?? MIN_ZOOM, fitZoom, MAX_ZOOM);

  let { longitude, latitude } = vs;

  // Dos pasadas: en Mercator los grados de latitud no son lineales en pantalla, así que
  // la primera corrección se queda algo corta y la segunda la remata.
  for (let i = 0; i < 2; i++) {
    const [minLng, minLat, maxLng, maxLat] = new WebMercatorViewport({
      ...vs,
      width,
      height,
      zoom,
      longitude,
      latitude,
    }).getBounds();

    if (minLng < W) longitude += W - minLng;
    if (maxLng > E) longitude -= maxLng - E;
    if (minLat < S) latitude += S - minLat;
    if (maxLat > N) latitude -= maxLat - N;
  }

  return { ...vs, zoom, longitude, latitude };
}

/**
 * Encuadre de un incendio al seleccionarlo: centra la cámara en él y se acerca lo justo
 * para que quepa con aire alrededor. Confirma el clic y sitúa al operador de un vistazo.
 *
 * El zoom sale de fitBounds, no de un «+1.5» fijo: el foco grande y un conato de siete
 * celdas necesitan encuadres muy distintos. FOCUS_MAX_ZOOM evita que un conato dispare
 * el zoom hasta perder el contexto.
 */
export function focusOn(
  bounds: readonly [[number, number], [number, number]],
  vs: MapViewState,
  width: number,
  height: number,
): MapViewState {
  if (!width || !height) return vs;

  const padding = Math.min(FOCUS_PADDING_PX, width / 4, height / 4);
  const fit = new WebMercatorViewport({ width, height }).fitBounds(
    bounds as [[number, number], [number, number]],
    { padding },
  );

  return clampToArea(
    {
      ...vs,
      longitude: fit.longitude,
      latitude: fit.latitude,
      zoom: Math.min(fit.zoom, FOCUS_MAX_ZOOM),
    },
    width,
    height,
  );
}
