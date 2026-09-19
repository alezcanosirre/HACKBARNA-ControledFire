import { BBOX_RMB, FIRE_HALO_K, QUAD_Z } from './constants';
import type { CellStatus } from './colors';

/** Lo mínimo que necesita la capa para pintar una celda. */
export interface Cell {
  cell_id: string;
}

/**
 * Un quadkey es el identificador de un tile de Web Mercator: una cadena en base 4 de
 * longitud z, donde cada dígito elige un cuadrante. Sirve para lo mismo que servía el
 * cell_id de H3 (ver spec.md §4.1): el backend guarda cell_id → datos y nadie almacena
 * geometría, porque la geometría se deriva del identificador.
 *
 * Lo que se gana sobre H3: la celda es cuadrada en la proyección, así que se ve
 * cuadrada en pantalla a cualquier latitud.
 */
function tileToQuadkey(x: number, y: number, z: number): string {
  let key = '';
  for (let i = z; i > 0; i--) {
    const mask = 1 << (i - 1);
    let digit = 0;
    if (x & mask) digit += 1;
    if (y & mask) digit += 2;
    key += digit;
  }
  return key;
}

function quadkeyToTile(key: string): [number, number] {
  let x = 0;
  let y = 0;
  for (let i = 0; i < key.length; i++) {
    const mask = 1 << (key.length - i - 1);
    const digit = Number(key[i]);
    if (digit & 1) x |= mask;
    if (digit & 2) y |= mask;
  }
  return [x, y];
}

const lngToTileX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);

const latToTileY = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  const merc = Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI;
  return Math.floor(((1 - merc) / 2) * 2 ** z);
};

/** Celda que contiene un punto. Sustituye a latLngToCell de h3-js. */
export function cellAt(lat: number, lng: number, z = QUAD_Z): string {
  return tileToQuadkey(lngToTileX(lng, z), latToTileY(lat, z), z);
}

/** Todas las celdas que solapan el bbox [oeste, sur, este, norte]. */
export function cellsInBbox(
  bbox: [number, number, number, number],
  z = QUAD_Z,
): string[] {
  const [w, s, e, n] = bbox;
  const x0 = lngToTileX(w, z);
  const x1 = lngToTileX(e, z);
  const y0 = latToTileY(n, z); // y crece hacia el sur
  const y1 = latToTileY(s, z);

  const out: string[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      out.push(tileToQuadkey(x, y, z));
    }
  }
  return out;
}

/**
 * Halo de celdas alrededor de un incendio. Sustituye al gridDisk de H3: en una rejilla
 * cuadrada los vecinos son x±1, y±1 al mismo nivel, así que k=3 da el cuadrado de lado
 * 2k+1 → 49 celdas (con hexágonos eran 37).
 *
 * Lo que se pierde respecto a H3, y conviene tenerlo escrito: en una rejilla cuadrada
 * los cuatro vecinos en diagonal están un 41% más lejos que los cuatro de al lado, así
 * que la propagación deja de ser isótropa (spec.md §4.1). Hoy no afecta a nada porque
 * no hay motor de propagación conectado.
 */
export function cellsAroundFire(lat: number, lng: number, k = FIRE_HALO_K): string[] {
  const [cx, cy] = quadkeyToTile(cellAt(lat, lng));
  const out: string[] = [];
  for (let dy = -k; dy <= k; dy++) {
    for (let dx = -k; dx <= k; dx++) {
      out.push(tileToQuadkey(cx + dx, cy + dy, QUAD_Z));
    }
  }
  return out;
}

/**
 * Se calcula UNA VEZ, al cargar el módulo. No en un render, no en un useMemo
 * dentro de un componente que se remonta. Recalcularlo en cada movimiento del mapa
 * lo convierte en una presentación de diapositivas.
 */
export const PRED_CELLS: Cell[] = cellsInBbox(BBOX_RMB).map((cell_id) => ({ cell_id }));

/** Escenario de demo: Collserola ardiendo, Montseny en riesgo, Garraf vigilado. */
const SCENARIO: Record<string, CellStatus> = {
  [cellAt(41.4186, 2.0899)]: 'active',     // Collserola
  [cellAt(41.7736, 2.4008)]: 'risk',       // Montseny
  [cellAt(41.2800, 1.8500)]: 'watch',      // Garraf
  [cellAt(41.6000, 1.6000)]: 'contained',  // interior
};

export function statusOf(cell_id: string): CellStatus {
  return SCENARIO[cell_id] ?? 'normal';
}

/**
 * Solo estas son pulsables. Una celda sin estado no tiene nada que abrir, así que no
 * se puede seleccionar ni cambia el cursor: es rejilla de referencia, no un objetivo.
 */
export const STATUS_CELLS: Cell[] = PRED_CELLS.filter(
  (c) => statusOf(c.cell_id) !== 'normal',
);

export const PLAIN_CELLS: Cell[] = PRED_CELLS.filter(
  (c) => statusOf(c.cell_id) === 'normal',
);
