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

/**
 * MOCK VISUAL. Nada de esto viene del backend: es una mancha de celdas generada aquí
 * para ver cómo se lee un incendio en pantalla. Se borra entero el día que
 * api/ mande celdas de verdad.
 *
 * Ruido determinista: mismo (x, y) → mismo valor en cada carga, así el borde de la
 * mancha es irregular pero no cambia entre recargas ni parpadea al repintar.
 */
function noise(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * Mancha elíptica de celdas ardiendo alrededor de un punto. `rx`/`ry` son radios en
 * celdas (a z15, una celda ≈ 916 m). La elipse se alarga en el eje que marque el
 * viento; el borde se come un 35% de las celdas del contorno para que no se vea el
 * óvalo perfecto, que en un mapa canta muchísimo.
 */
function fireBlob(lat: number, lng: number, rx: number, ry: number): string[] {
  const [cx, cy] = quadkeyToTile(cellAt(lat, lng));
  const out: string[] = [];
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const d = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (d > 1) continue;
      if (d > 0.55 && noise(cx + dx, cy + dy) < 0.35) continue;   // borde comido
      out.push(tileToQuadkey(cx + dx, cy + dy, QUAD_Z));
    }
  }
  return out;
}

/**
 * Escenario de demo: un incendio grande en Collserola alargado hacia el nordeste
 * (viento de poniente), más cuatro focos menores repartidos por la RMB.
 */
const DEMO_FIRES: Array<[number, number, number, number]> = [
  [41.4186, 2.0899, 11, 6],   // Collserola — el grande
  [41.7736, 2.4008, 4, 3],    // Montseny
  [41.2800, 1.8500, 3, 2],    // Garraf
  [41.6400, 1.7100, 2, 2],    // interior, foco pequeño
  [41.5200, 2.3400, 1.5, 1.5],// Vallès, conato
];

const SCENARIO: Record<string, CellStatus> = Object.fromEntries(
  DEMO_FIRES.flatMap(([lat, lng, rx, ry]) =>
    fireBlob(lat, lng, rx, ry).map((id) => [id, 'BURNING' as CellStatus]),
  ),
);

export function statusOf(cell_id: string): CellStatus {
  return SCENARIO[cell_id] ?? 'NORMAL';
}

/**
 * Solo estas son pulsables. Una celda sin estado no tiene nada que abrir, así que no
 * se puede seleccionar ni cambia el cursor: es rejilla de referencia, no un objetivo.
 */
export const STATUS_CELLS: Cell[] = PRED_CELLS.filter(
  (c) => statusOf(c.cell_id) !== 'NORMAL',
);

export const PLAIN_CELLS: Cell[] = PRED_CELLS.filter(
  (c) => statusOf(c.cell_id) === 'NORMAL',
);

// ---------------------------------------------------------------------------
// Agrupación: un incendio es UN incidente, no N celdas sueltas
// ---------------------------------------------------------------------------

const tileToLng = (x: number, z = QUAD_Z) => (x / 2 ** z) * 360 - 180;

const tileToLat = (y: number, z = QUAD_Z) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

const EARTH_CIRCUMFERENCE_M = 40075016.686;

/** Lado de la celda en km a la latitud de la fila y. En Mercator depende de la latitud. */
function cellSideKm(y: number, z = QUAD_Z): number {
  const lat = tileToLat(y + 0.5, z);
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / 2 ** z / 1000;
}

type LngLat = [number, number];

const NEIGHBORS_8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

export interface Fire {
  readonly id: string;
  readonly cells: readonly Cell[];
  readonly areaKm2: number;
  /** Extensión del foco [[oeste, sur], [este, norte]]. Para encuadrarlo al clicarlo. */
  readonly bounds: readonly [LngLat, LngLat];
  /** Solo los lados que dan al exterior del grupo: el contorno de la mancha. */
  readonly outline: ReadonlyArray<readonly [LngLat, LngLat]>;
}

/**
 * Agrupa las celdas ardiendo por vecindad (8-conectividad) con un flood fill: dos
 * celdas que se tocan, aunque sea solo por una esquina, son el mismo incendio.
 *
 * Con 4-conectividad salían focos fantasma: una celda que el borde mordido deja
 * colgando en diagonal de la masa principal se contaba como un incendio aparte de una
 * sola celda. Para agrupar incidentes la diagonal cuenta; para propagar no, pero eso
 * es cosa del motor, no de aquí.
 *
 * Se calcula una vez al cargar, como PRED_CELLS.
 */
function buildFires(cells: readonly Cell[]): Fire[] {
  const byXY = new Map<string, [number, number]>();
  for (const c of cells) byXY.set(c.cell_id, quadkeyToTile(c.cell_id));

  const key = (x: number, y: number) => `${x},${y}`;
  const pending = new Set(byXY.keys());
  const out: Fire[] = [];

  while (pending.size > 0) {
    const seed = pending.values().next().value as string;
    const stack = [seed];
    pending.delete(seed);
    const group: Cell[] = [];
    const groupXY: Array<[number, number]> = [];

    while (stack.length > 0) {
      const id = stack.pop() as string;
      const [x, y] = byXY.get(id) as [number, number];
      group.push({ cell_id: id });
      groupXY.push([x, y]);

      for (const [dx, dy] of NEIGHBORS_8) {
        const nid = tileToQuadkey(x + dx, y + dy, QUAD_Z);
        if (pending.has(nid)) {
          pending.delete(nid);
          stack.push(nid);
        }
      }
    }

    // Contorno: un lado se dibuja solo si al otro lado no hay celda del incendio.
    const inGroup = new Set(groupXY.map(([x, y]) => key(x, y)));
    const outline: Array<[LngLat, LngLat]> = [];
    let areaKm2 = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [x, y] of groupXY) {
      areaKm2 += cellSideKm(y) ** 2;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const w = tileToLng(x);
      const e = tileToLng(x + 1);
      const n = tileToLat(y);
      const s = tileToLat(y + 1);
      if (!inGroup.has(key(x, y - 1))) outline.push([[w, n], [e, n]]);
      if (!inGroup.has(key(x, y + 1))) outline.push([[w, s], [e, s]]);
      if (!inGroup.has(key(x - 1, y))) outline.push([[w, n], [w, s]]);
      if (!inGroup.has(key(x + 1, y))) outline.push([[e, n], [e, s]]);
    }

    const bounds: [LngLat, LngLat] = [
      [tileToLng(minX), tileToLat(maxY + 1)],   // esquina suroeste
      [tileToLng(maxX + 1), tileToLat(minY)],   // esquina noreste
    ];

    out.push({ id: `fire-${out.length + 1}`, cells: group, areaKm2, outline, bounds });
  }

  // Mayor primero: el número de foco sigue al tamaño, que es como se nombran al hablar.
  out.sort((a, b) => b.cells.length - a.cells.length);
  return out.map((f, i) => ({ ...f, id: `fire-${i + 1}` }));
}

export const FIRES: Fire[] = buildFires(STATUS_CELLS);

const FIRE_BY_CELL = new Map<string, string>(
  FIRES.flatMap((f) => f.cells.map((c) => [c.cell_id, f.id] as [string, string])),
);

/** A qué incendio pertenece una celda, o null si no arde. */
export function fireOf(cell_id: string): string | null {
  return FIRE_BY_CELL.get(cell_id) ?? null;
}

/** Los segmentos de contorno de todos los incendios, aplanados para la capa de líneas. */
export const FIRE_OUTLINES = FIRES.flatMap((f) =>
  f.outline.map(([from, to]) => ({ fire_id: f.id, from, to })),
);
