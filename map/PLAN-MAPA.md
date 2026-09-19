# Plan: del directorio vacío al mapa con rejilla

**Objetivo:** en `controledfire/map`, un mapa oscuro a pantalla completa sobre Cataluña
con la rejilla hexagonal H3 encima, navegable y con la celda pulsada identificada.
Sin UI, sin paneles, sin menú. Solo el mapa y el cuadrante.

**Spec:** `map/spec.md` (secciones 3 y 4)

**Tiempo estimado:** 60–90 min si no se tuerce nada.

---

## Verificado antes de escribir esto

No es un plan a ojo. El 19 sep 2026 monté el proyecto entero en `/tmp/cf-probe` con
estos mismos comandos y este mismo código. Resultado:

- `npm create vite` + las seis dependencias instalan sin errores (solo warnings, ver abajo).
- `npm run build` (que incluye `tsc -b`) pasa limpio: 1959 módulos, 688 ms.
- `polygonToCells` sobre el bbox de Cataluña a res 6 devuelve **1966 celdas**.

**Lo que NO he verificado:** que se vea bonito en pantalla. He validado que compila y que
los tipos cuadran, no el render. Eso lo ves tú en el Paso 2.

Si algo falla, `/tmp/cf-probe` sigue ahí como referencia funcionando.

### Versiones exactas que instalé y funcionan

```
node 22.22.2   npm 10.9.7
vite 8.3.0     react 19.3.0      typescript 6.0.3
deck.gl 9.4.0  @deck.gl/react 9.4.0  @deck.gl/geo-layers 9.4.0
maplibre-gl 6.10.0  react-map-gl 8.1.3  h3-js 4.5.0  tailwindcss 4.3.3
```

Los tres paquetes `deck.gl*` **tienen que ir en la misma versión**. Si algún día algo
falla con un error incomprensible de `getHexagon`, lo primero es `npm ls | grep deck.gl`.

---

## Cómo usar este documento

Seis tareas. Cada una termina en **algo que puedes ver en pantalla** y en un commit.
No pases a la siguiente sin ver lo que dice «Qué tienes que ver».

El spec deja los tests fuera de alcance (sección 10), así que la puerta de cada tarea es
visual, no un test. Es lo correcto aquí: lo que estás construyendo se juzga mirándolo.

---

## Estructura de ficheros al terminar

```
map/
├── spec.md                  ya existe
├── PLAN-MAPA.md             este documento
├── package.json
├── vite.config.ts           plugins: react + tailwind
├── index.html
└── src/
    ├── main.tsx             punto de entrada
    ├── index.css            tailwind + css de maplibre + altura 100%
    ├── App.tsx              monta DeckGL + Map
    └── map/
        ├── constants.ts     resoluciones, vistas, bbox, basemap
        ├── grid.ts          generación de la malla H3
        └── colors.ts        paleta por estado (Tarea 5)
```

Todo lo del mapa vive en `src/map/`. Cuando llegue la UI de la Fase 2, entra en
`src/ui/` y no se mezcla. La regla: `src/map/` no sabe que existe una interfaz.

---

## Tarea 0 — Arrancar el proyecto

`map/` **ya tiene contenido** (este fichero y `spec.md`), así que `npm create vite@latest map`
desde la raíz no vale. Se ejecuta desde dentro con `.`.

- [ ] **Paso 1: Scaffold**

```bash
cd /Users/johnc/Desktop/projects/controledfire/map
npm create vite@latest . -- --template react-ts
```

Te preguntará qué hacer con el directorio no vacío. Elige **«Ignore files and continue»**.
No elijas «Remove existing files»: te borraría `spec.md` y este plan.

- [ ] **Paso 2: Instalar**

```bash
npm install
npm i maplibre-gl react-map-gl deck.gl @deck.gl/react @deck.gl/geo-layers h3-js
npm i -D tailwindcss @tailwindcss/vite
```

Vas a ver warnings de `@arcgis/core`, `@loaders.gl` y tres paquetes deprecados
(`crypto-js`, `jpeg-exif`, `esri-loader`), y un `npm audit` con vulnerabilidades.
**Es normal y no lo toques.** Son dependencias transitivas de deck.gl que no usamos.
`npm audit fix --force` te romperá el árbol de versiones. No lo ejecutes.

- [ ] **Paso 3: Comprobar que arranca**

```bash
npm run dev
```

**Qué tienes que ver:** la página por defecto de Vite con el logo de React girando, en
`http://localhost:5173`.

- [ ] **Paso 4: Commit**

```bash
git add -A
git commit -m "chore(map): scaffold vite + react + ts"
```

---

## Tarea 1 — Tailwind y lienzo a pantalla completa

El mapa necesita un contenedor con altura real. Si `#root` no tiene altura, deck.gl
renderiza un canvas de 0px y ves una pantalla negra sin ningún error. Es el fallo más
tonto y el que más tiempo cuesta.

**Ficheros:** modificar `vite.config.ts`, `src/index.css`; borrar `src/App.css`.

- [ ] **Paso 1: Registrar Tailwind en Vite**

Reemplaza `vite.config.ts` entero:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Tailwind v4 no lleva `tailwind.config.js` ni `postcss.config.js`. Si algún tutorial te
dice que ejecutes `npx tailwindcss init`, está hablando de la v3. Ignóralo.

- [ ] **Paso 2: CSS base**

Reemplaza `src/index.css` entero:

```css
@import "tailwindcss";
@import "maplibre-gl/dist/maplibre-gl.css";

html, body, #root {
  height: 100%;
  margin: 0;
}

body {
  background: #0C1220;
  font-family: system-ui, sans-serif;
}
```

El `@import` de maplibre es obligatorio. Sin él, los controles del mapa salen
descolocados por la pantalla.

- [ ] **Paso 3: Vaciar la plantilla**

```bash
rm src/App.css
```

Y reemplaza `src/App.tsx` entero:

```tsx
export default function App() {
  return (
    <div className="h-full w-full bg-[#0C1220] flex items-center justify-center">
      <span className="text-[#8FA3BF] text-sm">lienzo listo</span>
    </div>
  );
}
```

- [ ] **Paso 4: Comprobar**

**Qué tienes que ver:** pantalla entera azul muy oscuro (no negro), con «lienzo listo»
en gris centrado. Si el texto no está centrado verticalmente, la altura no llega:
revisa el `html, body, #root { height: 100% }`.

- [ ] **Paso 5: Commit**

```bash
git add -A && git commit -m "feat(map): tailwind v4 y lienzo a pantalla completa"
```

---

## Tarea 2 — El basemap

Todavía sin rejilla. Solo el mapa oscuro de CARTO, navegable. Esta tarea aislada te dice
si el problema (si lo hay) es de MapLibre o de deck.gl. Mezclar las dos cosas y depurar
después cuesta el doble.

**Ficheros:** crear `src/map/constants.ts`; modificar `src/App.tsx`.

- [ ] **Paso 1: Constantes**

Crea `src/map/constants.ts`:

```ts
// Resoluciones H3. Ver spec.md §4.2
export const RES_PRED = 6;      // ~36 km²/celda — riesgo, toda Cataluña
export const RES_ACTIVE = 8;    // ~0,74 km²/celda — detalle del incendio
export const FIRE_HALO_K = 3;   // gridDisk alrededor de un fuego → 37 celdas

// bbox de Cataluña [oeste, sur, este, norte]
export const BBOX_CATALUNYA: [number, number, number, number] = [0.15, 40.52, 3.33, 42.86];

export const BCN_CENTER = { longitude: 2.1686, latitude: 41.3874 };

export const VIEW_CATALUNYA = {
  longitude: 1.74,
  latitude: 41.72,
  zoom: 7.4,
  pitch: 0,
  bearing: 0,
};

export const VIEW_BCN = { ...BCN_CENTER, zoom: 9.2, pitch: 0, bearing: 0 };

// CARTO, sin API key. Ver spec.md §4.5
export const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
```

- [ ] **Paso 2: Montar el mapa**

Reemplaza `src/App.tsx` entero:

```tsx
import { Map } from 'react-map-gl/maplibre';
import { BASEMAP, VIEW_CATALUNYA } from './map/constants';

export default function App() {
  return (
    <div className="h-full w-full bg-[#0C1220]">
      <Map
        initialViewState={VIEW_CATALUNYA}
        mapStyle={BASEMAP}
        style={{ width: '100%', height: '100%' }}
        dragRotate={false}
        reuseMaps
      />
    </div>
  );
}
```

Ojo con el import: en react-map-gl v8 es `import { Map } from 'react-map-gl/maplibre'`,
con llaves y con el sufijo `/maplibre`. Sin el sufijo importa la versión de Mapbox, que
te pedirá un token que no tenemos.

- [ ] **Paso 3: Comprobar**

**Qué tienes que ver:** Cataluña entera en gris oscuro, de Tarragona a los Pirineos, con
topónimos tenues y la costa reconocible. Arrastrando se mueve, con la rueda se hace zoom,
y girar no funciona (es intencionado: `dragRotate={false}`).

Si sale gris uniforme sin nada: mira la pestaña Network. Si la petición a
`basemaps.cartocdn.com` falla, es la wifi del hackathon, no tu código.

- [ ] **Paso 4: Commit**

```bash
git add -A && git commit -m "feat(map): basemap oscuro de carto sobre cataluña"
```

---

## Tarea 3 — Generar la malla H3

Sin dibujar nada todavía. Solo calcular los identificadores y comprobar el número en
consola. Así separas «el cálculo está bien» de «el pintado está bien».

**Ficheros:** crear `src/map/grid.ts`; modificar `src/App.tsx`.

- [ ] **Paso 1: El módulo de malla**

Crea `src/map/grid.ts`:

```ts
import { polygonToCells, latLngToCell, gridDisk } from 'h3-js';
import { BBOX_CATALUNYA, RES_PRED, RES_ACTIVE, FIRE_HALO_K } from './constants';

/** Lo mínimo que necesita la capa para pintar una celda. */
export interface Cell {
  cell_id: string;
}

/**
 * h3-js v4: polygonToCells(coords, res, isGeoJson).
 * Con isGeoJson = true los pares son [lng, lat]. Con false son [lat, lng].
 * Invertirlos es EL error clásico de H3: no da error, simplemente te devuelve
 * celdas en China. Si la rejilla no aparece sobre Cataluña, mira esto primero.
 */
export function cellsInBbox(
  bbox: [number, number, number, number],
  res: number,
): string[] {
  const [w, s, e, n] = bbox;
  const ring: number[][] = [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ];
  return polygonToCells([ring], res, true);
}

/** Halo de celdas de detalle alrededor de un incendio. k=3 → 37 celdas. */
export function cellsAroundFire(lat: number, lng: number, k = FIRE_HALO_K): string[] {
  return gridDisk(latLngToCell(lat, lng, RES_ACTIVE), k);
}

/**
 * Se calcula UNA VEZ, al cargar el módulo. No en un render, no en un useMemo
 * dentro de un componente que se remonta. 1966 celdas es barato pero no gratis,
 * y recalcularlo en cada movimiento del mapa lo convierte en una presentación
 * de diapositivas.
 */
export const PRED_CELLS: Cell[] = cellsInBbox(BBOX_CATALUNYA, RES_PRED).map(
  (cell_id) => ({ cell_id }),
);
```

- [ ] **Paso 2: Comprobar el número antes de pintar**

Añade temporalmente al principio de `App.tsx`, después de los imports:

```tsx
import { PRED_CELLS } from './map/grid';
console.log('celdas res 6:', PRED_CELLS.length, PRED_CELLS[0]);
```

- [ ] **Paso 3: Comprobar**

**Qué tienes que ver en la consola del navegador:**

```
celdas res 6: 1966 {cell_id: '863946cf7ffffff'}
```

**1966 es el número correcto**, lo he comprobado. Si te sale otro, algo cambió en el bbox.
Si te sale 0, el orden de los pares está invertido.

Nota: el spec decía «~900 celdas». Eso es la superficie real de Cataluña. El bbox es un
rectángulo, así que incluye mar y un trozo de Francia. Para la Fase 1 da igual — las
celdas de mar se pintarán con alfa 0 igual que el resto. Si más adelante molestan, se
recortan con el polígono real, pero no es trabajo de hoy.

- [ ] **Paso 4: Commit**

```bash
git add -A && git commit -m "feat(map): generacion de la malla h3 sobre cataluña"
```

---

## Tarea 4 — La rejilla encima del mapa

Aquí es donde aparece el cuadrante.

**Ficheros:** modificar `src/App.tsx`.

- [ ] **Paso 1: Montar deck.gl sobre MapLibre**

Reemplaza `src/App.tsx` entero:

```tsx
import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { BASEMAP, VIEW_CATALUNYA } from './map/constants';
import { PRED_CELLS, type Cell } from './map/grid';

export default function App() {
  const layers = useMemo(
    () => [
      new H3HexagonLayer<Cell>({
        id: 'cells-pred',
        data: PRED_CELLS,
        getHexagon: (d) => d.cell_id,
        getFillColor: [0, 0, 0, 0],            // sin relleno: solo el trazo
        getLineColor: [148, 163, 184, 45],     // rejilla base, apenas perceptible
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        coverage: 0.94,                        // deja aire entre celdas
        pickable: true,
      }),
    ],
    [],
  );

  return (
    <div className="h-full w-full bg-[#0C1220]">
      <DeckGL
        initialViewState={VIEW_CATALUNYA}
        controller={{ dragRotate: false }}
        layers={layers}
      >
        <Map mapStyle={BASEMAP} reuseMaps />
      </DeckGL>
    </div>
  );
}
```

Fíjate en el cambio de estructura: ahora **DeckGL es el contenedor y `<Map>` va dentro**.
DeckGL toma el control de la cámara y MapLibre la sigue. Por eso `initialViewState` y
`controller` se mueven a DeckGL, y `<Map>` se queda solo con el estilo.

- [ ] **Paso 2: Comprobar**

**Qué tienes que ver:** la malla hexagonal gris tenue cubriendo toda la pantalla,
incluido el mar. Los hexágonos con un hilo de separación entre ellos, no pegados. Al
hacer zoom y mover, la rejilla se queda clavada al terreno.

Si ves el basemap pero ninguna rejilla, en este orden:
1. ¿La consola de la Tarea 3 decía 1966? Si decía 0, el problema es H3, no deck.gl.
2. `npm ls | grep deck.gl` — los tres en 9.4.0.
3. Sube `getLineColor` a `[255, 255, 255, 255]` para descartar que sea solo demasiado tenue.

- [ ] **Paso 3: Commit**

```bash
git add -A && git commit -m "feat(map): rejilla h3 res 6 sobre el basemap"
```

---

## Tarea 5 — Pulsar una celda

El *picking* de deck.gl. Es lo que la Fase 3 usará para abrir el panel, así que conviene
dejarlo funcionando ahora aunque todavía no haya panel que abrir.

**Ficheros:** modificar `src/App.tsx`.

- [ ] **Paso 1: Estado de selección y cursor**

En `App.tsx`, añade `useState` al import de react y estas piezas:

```tsx
import { useMemo, useState } from 'react';
// ...

export default function App() {
  const [selected, setSelected] = useState<Cell | null>(null);

  const layers = useMemo(
    () => [
      new H3HexagonLayer<Cell>({
        id: 'cells-pred',
        data: PRED_CELLS,
        getHexagon: (d) => d.cell_id,
        getFillColor: (d) =>
          d.cell_id === selected?.cell_id ? [96, 165, 250, 90] : [0, 0, 0, 0],
        getLineColor: (d) =>
          d.cell_id === selected?.cell_id ? [147, 197, 253, 220] : [148, 163, 184, 45],
        lineWidthMinPixels: 1,
        filled: true,
        stroked: true,
        extruded: false,
        coverage: 0.94,
        pickable: true,
        onClick: ({ object }) => setSelected((object as Cell) ?? null),
        updateTriggers: {
          getFillColor: [selected?.cell_id],
          getLineColor: [selected?.cell_id],
        },
      }),
    ],
    [selected],
  );

  return (
    <div className="h-full w-full bg-[#0C1220]">
      <DeckGL
        initialViewState={VIEW_CATALUNYA}
        controller={{ dragRotate: false }}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map mapStyle={BASEMAP} reuseMaps />
      </DeckGL>

      <div className="absolute bottom-4 left-4 rounded border border-[#1D2840] bg-[#131C2E]/90 px-3 py-2 text-xs text-[#8FA3BF]">
        {PRED_CELLS.length} celdas ·{' '}
        <span className="text-[#E4EBF5]">{selected?.cell_id ?? 'ninguna seleccionada'}</span>
      </div>
    </div>
  );
}
```

**`updateTriggers` no es opcional.** deck.gl memoiza los accesores: sin declarar de qué
depende `getFillColor`, pulsas una celda, el estado cambia, React re-renderiza y la
pantalla no se entera. Es el bug número uno con esta librería y desde fuera parece que
el clic no funciona.

- [ ] **Paso 2: Comprobar**

**Qué tienes que ver:** al pasar por encima, el cursor cambia a mano. Al pulsar una celda,
se rellena de azul, su borde se aclara, y abajo a la izquierda aparece su identificador
H3. Al pulsar otra, la anterior se apaga.

- [ ] **Paso 3: Commit**

```bash
git add -A && git commit -m "feat(map): picking de celda con resaltado"
```

**A partir de aquí ya tienes lo que pedías.** La Tarea 6 es opcional y es el puente a la
Fase 2 del spec.

---

## Tarea 6 — Colores por estado (opcional hoy)

Con esto el mapa deja de ser una rejilla y empieza a parecer la herramienta. Son 20
minutos y es lo que hace que al enseñarlo se entienda de qué va.

**Ficheros:** crear `src/map/colors.ts`; modificar `src/map/grid.ts` y `src/App.tsx`.

- [ ] **Paso 1: La paleta**

Crea `src/map/colors.ts`:

```ts
export type CellStatus = 'normal' | 'watch' | 'risk' | 'active' | 'contained';

export type RGBA = [number, number, number, number];

// Los cálidos son SOLO para fuego. Ver spec.md §7. Ni un botón usa esta gama.
export const STATUS_FILL: Record<CellStatus, RGBA> = {
  normal: [0, 0, 0, 0],            // invisible
  watch: [96, 165, 250, 55],       // azul frío: vigilado, sin amenaza
  risk: [255, 176, 32, 120],
  active: [236, 56, 28, 205],
  contained: [122, 122, 138, 90],  // gris: controlado, ya no es urgente
};

export const STATUS_STROKE: Record<CellStatus, RGBA> = {
  normal: [148, 163, 184, 45],
  watch: [147, 197, 253, 110],
  risk: [255, 196, 92, 170],
  active: [255, 138, 92, 235],
  contained: [160, 160, 175, 130],
};
```

- [ ] **Paso 2: Escenario falso**

Añade al final de `src/map/grid.ts`:

```ts
import { latLngToCell } from 'h3-js';
import type { CellStatus } from './colors';
import { RES_PRED } from './constants';

/** Escenario de demo: Collserola ardiendo, Montseny en riesgo, Garraf vigilado. */
const SCENARIO: Record<string, CellStatus> = {
  [latLngToCell(41.4186, 2.0899, RES_PRED)]: 'active',     // Collserola
  [latLngToCell(41.7736, 2.4008, RES_PRED)]: 'risk',       // Montseny
  [latLngToCell(41.2800, 1.8500, RES_PRED)]: 'watch',      // Garraf
  [latLngToCell(41.6000, 1.6000, RES_PRED)]: 'contained',  // interior
};

export function statusOf(cell_id: string): CellStatus {
  return SCENARIO[cell_id] ?? 'normal';
}
```

Ojo: `latLngToCell` ya está importado arriba en el fichero, así que quita el import
duplicado y añade solo lo que falte.

- [ ] **Paso 3: Usarlo en la capa**

En `App.tsx`, cambia los dos accesores de color:

```tsx
getFillColor: (d) =>
  d.cell_id === selected?.cell_id ? [96, 165, 250, 90] : STATUS_FILL[statusOf(d.cell_id)],
getLineColor: (d) =>
  d.cell_id === selected?.cell_id ? [147, 197, 253, 220] : STATUS_STROKE[statusOf(d.cell_id)],
```

Con los imports correspondientes de `./map/colors` y `./map/grid`.

- [ ] **Paso 4: Comprobar**

**Qué tienes que ver:** cuatro celdas destacadas sobre la rejilla gris. Una roja intensa
sobre Collserola (al oeste de Barcelona), una ámbar en el Montseny, una azul en el Garraf
y una gris en el interior. El resto, invisible.

Que solo cuatro celdas tengan color **es lo correcto**. Si se colorea todo, el incendio
deja de verse. Es la regla de la sección 4.6 del spec.

- [ ] **Paso 5: Commit**

```bash
git add -A && git commit -m "feat(map): colores por estado con escenario de demo"
```

---

## Los cinco fallos que te van a costar tiempo

Por orden de probabilidad:

1. **Pantalla negra, sin errores.** `#root` no tiene altura. Revisa el CSS de la Tarea 1.
2. **La rejilla no está sobre Cataluña.** El flag `isGeoJson` de `polygonToCells`. Con
   `true` los pares son `[lng, lat]`. Invertirlos no da error, te manda a otro continente.
3. **El clic no hace nada visible.** Falta `updateTriggers`. El clic sí funciona: lo que
   no se entera es el color.
4. **`<Map>` pide un token de Mapbox.** Te falta el `/maplibre` en el import de react-map-gl.
5. **Errores raros de deck.gl al arrancar.** Versiones desparejadas entre `deck.gl`,
   `@deck.gl/react` y `@deck.gl/geo-layers`. Los tres en 9.4.0.

---

## Qué NO hacer hoy

Escrito para poder señalarlo a las dos de la mañana:

- Nada de resolución 8 global. Son 96.405 celdas en el bbox, lo he comprobado. El detalle
  se genera con `cellsAroundFire()` solo alrededor de cada incendio, 37 celdas.
- Nada de recortar el bbox con el polígono real de Cataluña. Las celdas de mar son
  invisibles. No es un problema hasta que alguien lo mire de cerca, y nadie lo va a hacer.
- Nada de pulso, animación ni transiciones. Eso es la Fase 2 del spec y va después de que
  el color por estado funcione.
- Nada de conectar con `src/engine`. Sigue siendo un fichero de firmas sin implementación.
- Nada de UI, menú ni paneles. Van encima de esto, no mezclados con esto.

---

## Después de esto

Cuando el mapa esté, el orden del spec es: pulso en las activas y leyenda (Fase 2),
panel lateral al pulsar (Fase 3), acciones de la IA (Fase 4).

Y queda pendiente la decisión de la Fase 0 del spec, que sigue sin resolver: si esto es
una consola sobre datos reales o la vista de una simulación. No bloquea nada de este
documento, pero sí bloquea la Fase 3.
