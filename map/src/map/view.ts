import type { MapViewState } from '@deck.gl/core';
import { BBOX_RMB, MAX_ZOOM, MIN_ZOOM } from './constants';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * El operador no puede salirse de la Regió Metropolitana. deck.gl toma el control de la
 * cámara cuando <Map> va dentro de <DeckGL>, así que el `maxBounds` de MapLibre no
 * llega a aplicarse: el acotado se hace aquí, sobre el viewState de cada movimiento.
 *
 * Se limita el centro, no el borde visible. En los extremos del bbox se sigue viendo
 * terreno de fuera; lo que no se puede es navegar hasta él.
 */
export function clampToArea(vs: MapViewState): MapViewState {
  const [w, s, e, n] = BBOX_RMB;
  return {
    ...vs,
    zoom: clamp(vs.zoom ?? MIN_ZOOM, MIN_ZOOM, MAX_ZOOM),
    longitude: clamp(vs.longitude, w, e),
    latitude: clamp(vs.latitude, s, n),
  };
}
