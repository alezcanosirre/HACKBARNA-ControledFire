# ControlledFire — Spec de frontend y mapa

Documento de referencia para construir el frontend. Escrito para que un agente de código
pueda trabajar sin más contexto que este fichero.

**Estado:** borrador de hackathon. Todo lo marcado como `[VERIFICAR]` debe contrastarse
con el código real del backend antes de darlo por bueno.

---

## 1. Qué estamos construyendo

Una herramienta de sala de control para incendios forestales en Cataluña. La interfaz
principal es un mapa dividido en celdas. Cada celda tiene un estado, y al pulsarla se
abre un panel con el detalle y una lista de acciones priorizadas por IA.

El producto tiene **dos modos** sobre el mismo mapa:

| Modo | Pregunta que responde | Origen del dato |
|---|---|---|
| **ACTUAL** | ¿Dónde está ardiendo ahora mismo y qué hago primero? | Detección (satélite, cámaras, avisos) |
| **PRED** | ¿Dónde es probable que arda en las próximas horas? | Modelo de riesgo + meteo |

El usuario objetivo es un **bombero o coordinador de emergencias**, no un analista de
datos. Cada pantalla tiene que poder leerse en tres segundos desde dos metros de
distancia.

La tesis del producto: **la IA propone, el humano decide.** Ninguna acción se ejecuta
sola. La IA ordena, explica y sugiere; el operador acepta o descarta. Esto no es un
detalle de UX, es el argumento del proyecto y tiene que verse en pantalla.

### Contexto de hackathon

- HackBarna AI Summit 26, Norrsken House Barcelona, 19–20 sep 2026.
- Reto principal: **Norrsken — AI for Wildfire**. Encajamos en el track *Values at risk*
  (sistema agéntico que identifica infraestructura, personas y activos en peligro y
  ayuda a decidir evacuaciones), con solape en *Monitoring active fires* y *Prediction*.
- Proveedor de IA: **Nebius Token Factory**. Si su uso aporta algo medible (grounding,
  evaluación, coste, latencia), el mismo proyecto puede entrar también al reto de Nebius.
- Deadline de código: **domingo 11:00**. Demos a las 14:00.

Consecuencia directa sobre el alcance: el trabajo se ordena por lo que se ve en la demo.
Si algo no aparece en los 3 minutos de demo, va al final de la cola.

---

## 2. Estructura del repositorio

Estado real del repo a 19 sep 2026 (verificado, no propuesto):

```
controledfire/
├── README.md           «AI-powered wildfire simulation … Incident Commander … After Action Review»
├── tsconfig.json       raíz. "include": ["src"] — no cubre map/
├── map/                ← FRONTEND. Aquí se trabaja este spec.
│   └── spec.md         este documento (por ahora, lo único que hay)
├── api/                ← capa HTTP. Solo contiene spec.md, y está vacío.
│   └── spec.md
└── src/                ← NÚCLEO DE SIMULACIÓN. TypeScript, no Python.
    ├── types/          el contrato de datos real: common, scenario, simulation,
    │                   action, strategy, outcome, snapshot, index
    └── engine/         index.ts — solo firmas `declare`, sin implementación:
                        createInitialState() / step() / calculateOutcome()
```

- **`controledfire/map`** es la aplicación React. Todo lo descrito en este documento se
  implementa aquí.
- **`controledfire/src`** es el núcleo de simulación. El front **no lo modifica**. Se lee
  para extraer los shapes reales.
- **`controledfire/api`** es donde vivirá la capa HTTP cuando exista. Hoy no existe: su
  `spec.md` está vacío. Los endpoints de la sección 6.5 son propuesta, no contrato.

> **Regla de oro:** antes de escribir tipos o mocks, leer los tipos reales en
> `controledfire/src/types` y ajustar los contratos de la sección 6 a lo que realmente
> devuelve. Los JSON de este documento son la propuesta, no la verdad. Donde difieran,
> manda el backend.

### 2.1 Correcciones sobre el borrador original

Tres cosas que este documento daba por supuestas y que el repositorio contradice:

1. **`src` no es Python.** Es TypeScript estricto (`strict`, `noUnusedLocals`,
   `noEmit`), con los tipos ya escritos y el motor aún sin cuerpo. No hay serializers,
   no hay modelos ORM, no hay nada que «serializar»: el front puede importar los tipos
   tal cual con un alias de ruta, en vez de duplicarlos.
2. **Existe un tercer directorio, `api/`.** El borrador solo mencionaba `map/` y `src/`.
3. **El README describe otro producto.** Habla de una **simulación** donde el usuario
   hace de Incident Commander, sufre las consecuencias de sus decisiones y recibe un
   *After Action Review* generado por IA. Este spec describe una **consola sobre datos
   reales de Cataluña**. Los tipos de `src/types` respaldan lo primero: rejilla
   cuadrada en unidades de celda, sin una sola latitud ni longitud en todo el árbol,
   reloj de simulación en minutos, condiciones de victoria y derrota.
   **Esto hay que resolverlo antes de la Fase 3.** Las dos lecturas son compatibles si
   el mapa H3 es la *vista* y la simulación es el *motor* — pero alguien tiene que
   decidir explícitamente que es así, y ahora mismo nadie lo ha decidido. Ver 6.0.

---

## 3. Stack

```
React 18 + Vite + TypeScript
MapLibre GL JS        → basemap vectorial (sin API key)
deck.gl               → capa de celdas sobre el mapa
h3-js                 → indexado geoespacial en celdas
Zustand               → estado global (ligero, sin boilerplate)
TanStack Query        → fetching, caché y polling
Tailwind CSS          → estilos
```

Instalación:

```bash
# map/ YA EXISTE y no está vacío (contiene este spec.md). `npm create vite@latest map`
# desde la raíz fallaría o pediría vaciarlo. Desde dentro de map/:
cd map
npm create vite@latest . -- --template react-ts    # elegir «Ignore files and continue»

npm i maplibre-gl react-map-gl deck.gl @deck.gl/react @deck.gl/geo-layers h3-js
npm i zustand @tanstack/react-query
npm i -D tailwindcss @tailwindcss/vite
```

Dos avisos de instalación:

- `deck.gl` y los submódulos `@deck.gl/*` tienen que ir **en la misma versión mayor y
  menor**. Mezclarlos es la causa clásica de `Invalid prop: getHexagon` sin más pistas.
  Si algo huele raro: `npm ls | grep deck.gl` antes de depurar nada más.
- El `tsconfig.json` de la raíz tiene `"include": ["src"]` y no cubre `map/`. Vite
  generará el suyo dentro de `map/`; son dos proyectos separados y está bien que lo
  sean. Para importar los tipos de `../src/types` hará falta añadir el `path` y subir
  `rootDir`/`include` en el tsconfig de `map/`.

**Por qué deck.gl y no Leaflet:** deck.gl trae `H3HexagonLayer` de serie, renderiza por
WebGL (miles de celdas sin despeinarse) y el *picking* de la celda pulsada viene resuelto.
Leaflet obligaría a generar polígonos a mano y se arrastra pasadas ~2.000 celdas.

---

## 4. El mapa — cómo se construye

Esta es la parte crítica. Si el mapa funciona, el resto es maquetación.

### 4.1 La decisión clave: no dibujamos una rejilla, usamos un índice

La tentación es generar cuadrados y guardar sus esquinas. Es un error: obliga a comparar
geometrías en cada consulta y a inventar identificadores.

Usamos **H3** (el sistema hexagonal de Uber). Cada celda del planeta tiene un
identificador único y estable, un string tipo `871f1d4c8ffffff`. Con eso:

- El backend guarda `cell_id → datos`. Sin geometría, sin PostGIS, sin cálculos de bbox.
- Convertir una coordenada a celda es una llamada: `latLngToCell(lat, lng, res)`.
- Front y backend hablan del mismo sitio con el mismo string. Cero ambigüedad.
- deck.gl dibuja la celda a partir del ID solo. No le pasamos polígonos.

Hexágonos en vez de cuadrados, además, tienen sentido para el dominio: todos los vecinos
están a la misma distancia del centro, que es exactamente lo que se quiere al modelar
propagación de fuego. Un cuadrado tiene vecinos en diagonal un 41% más lejos.

> Si en la demo alguien pregunta por qué hexágonos: la respuesta es propagación isótropa,
> no estética.

> **[VERIFICAR]** El motor de `src` usa hoy exactamente lo contrario: `Position {x, y}`
> sobre una rejilla cuadrada de `mapWidth × mapHeight`. El argumento de la propagación
> isótropa sigue siendo válido, pero a día de hoy describe el mapa, no el motor. Ver 6.0.

### 4.2 Resoluciones

H3 tiene 16 niveles. Usamos dos:

| Uso | Resolución | Área por celda | Celdas en Cataluña |
|---|---|---|---|
| **PRED** (riesgo, toda Cataluña) | **6** | ~36 km² | ~900 |
| **ACTUAL** (detalle del incendio) | **8** | ~0,74 km² | no se genera global |

Para el modo ACTUAL **no se genera la malla entera** a resolución 8 (serían ~43.000
celdas). Se generan solo las celdas alrededor de cada incendio con `gridDisk(centro, k)`,
con `k = 3` o `4`. Son unas 37–61 celdas por incendio. Instantáneo.

Constantes:

```ts
export const RES_PRED = 6;
export const RES_ACTIVE = 8;
export const FIRE_HALO_K = 3;
```

### 4.3 Área de trabajo

Demo centrada en Barcelona y su entorno forestal (Collserola, Montseny, Garraf), con
Cataluña entera disponible en el modo PRED.

```ts
export const BCN_CENTER = { longitude: 2.1686, latitude: 41.3874 };

export const VIEW_BCN       = { ...BCN_CENTER, zoom: 9.2, pitch: 0, bearing: 0 };
export const VIEW_CATALUNYA = { longitude: 1.74, latitude: 41.72, zoom: 7.4 };

// bbox Cataluña aproximado [oeste, sur, este, norte]
export const BBOX_CATALUNYA = [0.15, 40.52, 3.33, 42.86];
```

### 4.4 Generar la malla

```ts
import { polygonToCells, cellToBoundary, cellToLatLng, latLngToCell, gridDisk } from 'h3-js';

// h3-js v4: polygonToCells(coords, res, isGeoJson)
// Con isGeoJson=true los pares son [lng, lat]; con false son [lat, lng]. Cuidado aquí,
// es la fuente de error más común al integrar H3.

export function cellsInBbox(bbox: number[], res: number): string[] {
  const [w, s, e, n] = bbox;
  const ring = [[w, s], [e, s], [e, n], [w, n], [w, s]];
  return polygonToCells([ring], res, true);
}
```

Para el halo de un incendio:

```ts
export function cellsAroundFire(lat: number, lng: number, k = FIRE_HALO_K): string[] {
  return gridDisk(latLngToCell(lat, lng, RES_ACTIVE), k);
}
```

**La malla se genera una sola vez y se cachea.** No se recalcula en cada render ni en
cada movimiento del mapa. Va en un `useMemo` con dependencias `[]`, o directamente en un
módulo a nivel superior.

Idealmente, el backend devuelve los `cell_id` ya resueltos y el front solo pinta. La
generación en cliente es el plan B para trabajar con mocks mientras el backend no está.
Hoy el backend no devuelve `cell_id` ninguno, así que el plan B es el plan A.

### 4.5 Basemap sin API key

CARTO sirve estilos vectoriales gratis y sin registro. Esto elimina la dependencia de
tokens de Mapbox, que en un hackathon siempre falla a las 3 de la mañana.

```ts
export const BASEMAP =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
```

Alternativas del mismo proveedor: `dark-matter-nolabels-gl-style` (más limpio, sin
topónimos compitiendo con las celdas) y `positron-gl-style` (claro). Para esta interfaz
el oscuro es el correcto: las celdas de fuego son luminosas y necesitan fondo que no
compita.

### 4.6 Montaje del mapa

```tsx
import DeckGL from '@deck.gl/react';
import Map from 'react-map-gl/maplibre';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import 'maplibre-gl/dist/maplibre-gl.css';

export function FireMap({ cells, mode, onSelect }: FireMapProps) {
  const tick = usePulse(mode === 'active');   // 0 → 1 → 0, ver 4.8

  const layer = new H3HexagonLayer({
    id: `cells-${mode}`,
    data: cells,
    getHexagon: (d: Cell) => d.cell_id,
    getFillColor: (d: Cell) => fillFor(d, mode, tick),
    getLineColor: (d: Cell) => strokeFor(d, mode),
    lineWidthMinPixels: 1,
    filled: true,
    stroked: true,
    extruded: false,
    coverage: 0.94,          // deja aire entre celdas, se leen como rejilla
    pickable: true,
    onClick: ({ object }) => object && onSelect(object),
    updateTriggers: {
      getFillColor: [mode, tick],   // tick fuerza el repintado del pulso
      getLineColor: [mode],
    },
  });

  return (
    <DeckGL
      initialViewState={VIEW_BCN}
      controller={{ dragRotate: false }}
      layers={[layer]}
      getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
    >
      <Map mapStyle={BASEMAP} reuseMaps />
    </DeckGL>
  );
}
```

Notas de implementación que ahorran horas:

- **`updateTriggers` es obligatorio.** deck.gl memoiza los accesores. Si cambia el color
  de una celda y no está declarado el trigger, la pantalla no se entera. Es el bug número
  uno con esta librería.
- **`dragRotate: false`.** Un mapa girado no aporta nada aquí y desorienta en la demo.
- **`coverage: 0.94`** encoge levemente cada hexágono. El hueco resultante hace que se
  lea como una rejilla y no como una mancha continua.
- Las celdas en estado `normal` se pintan con **alfa 0**. Si se colorea toda Cataluña,
  el incendio deja de verse. Solo se destaca lo que importa.

### 4.7 Colores por estado

El color de peligro está reservado **exclusivamente al dato**. No se usa naranja ni rojo
en botones, bordes, cabeceras ni ningún otro elemento de interfaz. Cuando algo brilla en
cálido en esta pantalla, siempre significa fuego.

```ts
// Modo ACTUAL — estados discretos
export const STATUS_FILL: Record<CellStatus, [number, number, number, number]> = {
  normal:    [  0,   0,   0,   0],   // invisible
  watch:     [ 96, 165, 250,  55],   // azul frío: vigilado, sin amenaza
  risk:      [255, 176,  32, 120],
  active:    [236,  56,  28, 205],
  contained: [122, 122, 138,  90],   // gris: controlado, ya no es urgente
};

export const STATUS_STROKE: Record<CellStatus, [number, number, number, number]> = {
  normal:    [148, 163, 184, 28],    // rejilla base, apenas perceptible
  watch:     [147, 197, 253, 110],
  risk:      [255, 196,  92, 170],
  active:    [255, 138,  92, 235],
  contained: [160, 160, 175, 130],
};
```

Modo PRED: el riesgo es continuo, así que interpolamos en vez de usar escalones.

```ts
export function riskFill(risk: number): [number, number, number, number] {
  const r = Math.max(0, Math.min(1, risk));
  if (r < 0.25) return [0, 0, 0, 0];               // bajo riesgo: no se pinta
  return [
    255,
    Math.round(210 - r * 175),   // 210 (ámbar) → 35 (rojo)
    Math.round(70 - r * 60),
    Math.round(40 + r * 150),    // los más peligrosos, más opacos
  ];
}
```

En la pizarra aparece *"Rojo = Punto Caliente"*. Se respeta: rojo saturado y opaco es
siempre lo más peligroso de la pantalla, en cualquiera de los dos modos.

### 4.8 El pulso de los incendios activos

Las celdas `active` laten. Cuesta unas diez líneas y hace que el incendio reclame la
atención del operador sin que nadie tenga que señalarlo en la demo.

```ts
export function usePulse(active: boolean, periodMs = 1400) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf: number;
    const start = performance.now();
    const loop = (now: number) => {
      setT((Math.sin(((now - start) / periodMs) * Math.PI * 2) + 1) / 2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, periodMs]);
  return t; // 0 → 1 → 0
}
```

Se aplica solo al alfa de las celdas activas: `alpha = 165 + t * 55`. Nada más en la
pantalla se mueve por su cuenta. Es el único elemento con movimiento no provocado por el
usuario, y por eso funciona.

Respetar `prefers-reduced-motion`: si está activo, alfa fijo a 205.

### 4.9 Rendimiento

- Una sola `H3HexagonLayer` por modo. No una capa por celda.
- Filtrar antes de pasar a deck.gl: las celdas `normal` no necesitan llegar a la capa
  si no se van a pintar.
- No meter objetos nuevos en `data` en cada render; romperá la memoización.
- `reuseMaps` en el componente `Map` evita reinicializar MapLibre al cambiar de modo.

Con ~900 celdas a resolución 6 esto va sobrado en cualquier portátil. El margen es amplio.

---

## 5. Pantallas

Basado en los bocetos de pizarra (`ACTUAL` arriba, `PRED` debajo, panel de acciones a la
derecha en ambos).

### 5.1 Estructura general

```
┌────────────────────────────────────────────────────────────────┐
│  ControlledFire        [ ACTUAL │ PRED ]         3 activos ● │ ← barra superior, 56px
├──────────────────────────────────────┬─────────────────────────┤
│                                      │                         │
│                                      │   PANEL DE DETALLE      │
│                                      │   (entra al pulsar      │
│            MAPA                      │    una celda)           │
│      (ocupa todo lo demás)           │                         │
│                                      │   ── Acciones ──        │
│                                      │   ordenadas por IA      │
│                                      │                         │
│  ┌─────────────┐                     │                         │
│  │  leyenda    │                     │                         │
│  └─────────────┘                     │                         │
└──────────────────────────────────────┴─────────────────────────┘
                                        ↑ 380px, se desliza desde
                                          la derecha
```

El mapa nunca se encoge ni se desplaza al abrir el panel: el panel flota encima. Que el
mapa salte al abrir un incendio desorienta justo en el momento de máxima tensión.

### 5.2 Modo ACTUAL — panel de detalle

Se abre al pulsar una celda con estado `active`. Contiene, en este orden:

1. **Cabecera.** Flecha de volver, identificador legible de la zona (topónimo, no
   `871f1d4c8ffffff`), hora de detección y fuente.
2. **Estado del fuego.** Superficie afectada, confianza de la detección, dirección y
   velocidad de propagación.
3. **Condiciones.** Viento (velocidad y dirección), temperatura, humedad relativa.
   La dirección del viento se dibuja como flecha, no como «210°».
4. **Zona.** Tipo de terreno: habitado, interfaz urbano-forestal, bosque, matorral,
   cultivo. En la pizarra: *"Cuadrado – Zona (Habitado, bosque)"*. Determina la
   priorización y debe verse.
5. **En riesgo.** Lista de lo que hay cerca: colegios, hospitales, residencias,
   núcleos de población, con distancia y personas afectadas.
6. **Acciones.** Ver 5.4.

### 5.3 Modo PRED — panel de detalle

Se abre al pulsar una celda con riesgo. Contiene:

1. **Cabecera** con la zona y el horizonte temporal («próximas 24 h»).
2. **Riesgo.** El porcentaje, grande. Es el dato que se ha venido a ver.
3. **Por qué.** Los factores que lo explican, con su peso: viento, sequedad del
   combustible, temperatura, histórico. Esto es *Risk Analisis* en la pizarra.
   Sin esta sección el número no es accionable, es solo un número.
4. **Acciones preventivas.** Enviar dron, avisar a la base de helicópteros, desplazar
   una dotación, revisión sobre el terreno.

### 5.4 Panel de acciones — el corazón del producto

Es lo que diferencia el proyecto de un mapa bonito. Estructura:

```
┌──────────────────────────────────────┐
│  Análisis                            │
│  Dos o tres líneas de la IA           │
│  explicando qué tiene delante el      │
│  operador y por qué este orden.       │
├──────────────────────────────────────┤
│  1 ▸ Evacuar CEIP Sant Jordi         │
│      420 personas · 1,8 km a favor   │
│      del viento                       │
│      [ Aceptar ]  [ Descartar ]      │
├──────────────────────────────────────┤
│  2 ▸ Helicóptero a la cabeza del     │
│      frente                           │
│      Llegada estimada 25 min          │
│      [ Aceptar ]  [ Descartar ]      │
├──────────────────────────────────────┤
│  3 ▸ Cortar la BV-1415               │
│      ...                              │
└──────────────────────────────────────┘
```

Reglas de esta sección:

- **Cada acción lleva su porqué.** Una acción sin justificación es una orden ciega, y el
  operador no la va a seguir. El *por qué* es tan importante como el *qué*.
- **La numeración es real.** Es una secuencia de prioridad ordenada por la IA, y por eso
  se numera. No es decoración.
- **Aceptar y Descartar están siempre visibles**, no escondidos tras un menú. La decisión
  humana es el argumento del proyecto; tiene que estar en primer plano.
- Al aceptar, la acción cambia de estado y queda registrada con hora. Se construye así un
  registro de decisiones, que es exactamente lo que un coordinador necesita después.
- El catálogo de acciones vive en la base de datos. La IA **elige y ordena** dentro de ese
  catálogo, no inventa acciones libres. Esto es lo que hace el sistema defendible: hay
  una barrera entre lo que el modelo propone y lo que el sistema permite.

> El backend ya implementa esta última regla, y de forma más fuerte de lo que pedía este
> spec: el catálogo no es una tabla, es el tipo `Action` — una unión cerrada de tres
> variantes (`WAIT`, `DEPLOY_RESOURCE`, `CREATE_FIREBREAK`). La IA no puede proponer
> nada fuera de ella porque no compilaría. Y `Strategy` lleva `reasoning` obligatorio,
> igual que nuestro `why`. Los comentarios de `strategy.ts` y `action.ts` defienden
> exactamente el mismo argumento que la sección 5.4. Usarlo en la demo: es un argumento
> más fuerte dicho así.

---

## 6. Contratos de datos

**`[VERIFICAR]` — contrastar con `controledfire/src` antes de implementar.**
Definir todos estos tipos en `map/src/types/api.ts`.

### 6.0 Lo que el backend define HOY

Contrastado contra `src/types/*.ts` el 19 sep 2026. **El resto de la sección 6 es
propuesta y hoy no coincide con nada de esto.** No es un desajuste de nombres: son dos
modelos del mundo distintos.

Lo que existe, resumido:

```ts
// common.ts — no hay latitud ni longitud en NINGÚN sitio del árbol de tipos
interface Position { x: number; y: number }          // unidades de celda, no píxeles ni grados
type CellStatus   = 'NORMAL' | 'BURNING' | 'BURNED' | 'PROTECTED';
type TerrainType  = 'FOREST' | 'GRASS' | 'URBAN' | 'ROAD' | 'WATER';
type ResourceType = 'BRIGADE' | 'HELICOPTER' | 'AIRPLANE';
interface EnvironmentState { temperature; humidity; wind: { speed; direction } }  // global, no por celda

// scenario.ts — entrada ESTÁTICA de una partida
interface Scenario { id; name; mapWidth; mapHeight; terrain: TerrainCell[];
                     infrastructure; initialFire; initialEnvironment;
                     initialResources; mission }
interface VulnerableArea { id; name; cells: Position[] }   // ≈ values_at_risk

// simulation.ts — estado DINÁMICO, solo `step()` lo produce
interface CellState { position; remainingFuel; status }
interface FireCell  { position; intensity }
interface FireState { activeCells: FireCell[]; burnedAreaHa }
interface CellRisk  { position; fireRisk; populationRisk; infrastructureRisk }
interface SimulationState { scenarioId; time; environment; cells; fire; resources;
                            risk; events; executedActions; mission }

// action.ts / strategy.ts — la IA propone, el motor decide
type Action = { type:'WAIT'; minutes } | { type:'DEPLOY_RESOURCE'; resourceId; target }
            | { type:'CREATE_FIREBREAK'; target: Position[] };
interface Strategy { id; title; reasoning; actions: Action[] }

// engine/index.ts — funciones SÍNCRONAS, sin cuerpo todavía
declare function createInitialState(scenario: Scenario): SimulationState;
declare function step(state: SimulationState, actions: Action[]): SimulationState;
declare function calculateOutcome(state: SimulationState): Outcome;
```

Tabla de divergencias:

| Este spec propone | `src/types` define | Qué hacer |
|---|---|---|
| `cell_id: string` (índice H3) | `Position {x, y}` sobre rejilla `mapWidth × mapHeight` | **Decisión bloqueante.** O el motor adopta H3, o el front mantiene un mapeo `Position ↔ cell_id`. Ver abajo. |
| `CellStatus` en minúsculas, 5 valores | `'NORMAL'\|'BURNING'\|'BURNED'\|'PROTECTED'` | Mapear. `watch` y `risk` no existen en el motor: salen de `CellRisk.fireRisk`. `contained` ≈ `PROTECTED`. |
| `Fire` con `centroid`, `confidence`, `source`, `detected_at` | `FireState { activeCells, burnedAreaHa }` | No hay detección: el fuego es **simulado**, no observado. `confidence` y `source` no tienen equivalente y hoy son ficción. |
| `weather` por incendio | `EnvironmentState` global | El viento es uno para todo el mapa. El panel puede mostrarlo igual. |
| `values_at_risk[]` con distancia y población | `VulnerableArea { id, name, cells[] }` + `CellRisk` | El motor da riesgo por celda ya calculado; las distancias hay que derivarlas. `population` no existe. |
| `Prediction.risk_score` | `CellRisk.fireRisk` (0–1) | Encaja directo. `drivers[]` y `rationale` no existen: los genera la IA. |
| `RankedAction` con `accept`/`reject` y catálogo en BD | `Strategy { reasoning, actions[] }` + unión cerrada `Action` | Ya resuelto y mejor. `rank` = índice en `actions`. Falta `status` y el registro de decisiones. |
| Endpoints REST + WebSocket (6.5) | Nada. `engine/index.ts` expone funciones síncronas y `api/` está vacío | Para la demo no hace falta HTTP: el motor puede correr **en el propio navegador**. Ver 6.5. |

**Recomendación sobre la divergencia principal (H3 vs `Position`):** no tocar el motor.
Que siga en `{x, y}`, que es lo correcto para un autómata celular. El front ancla la
rejilla del escenario a una esquina geográfica y traduce en el borde:

```ts
// map/src/lib/grid.ts — la ÚNICA pieza que conoce las dos representaciones
const ORIGIN = { lat: 41.4700, lng: 2.0600 };   // NO del escenario (Collserola)
const CELL_M = 250;                              // lado de celda del escenario, en metros

export function positionToCell(p: Position): string { /* offset → lat/lng → latLngToCell */ }
export function cellToPosition(id: string): Position { /* inverso, con redondeo */ }
```

Cuesta media hora, no obliga a nadie a reescribir nada y deja las dos mitades trabajando
en las unidades que les convienen. Se decide antes de la Fase 3 y se anota aquí.

### 6.1 Celda

```ts
type CellStatus = 'normal' | 'watch' | 'risk' | 'active' | 'contained';

interface Cell {
  cell_id: string;       // índice H3
  status: CellStatus;
  fire_id?: string;      // presente si status === 'active'
  risk_score?: number;   // 0–1, presente en modo PRED
  updated_at: string;    // ISO 8601
}
```

### 6.2 Incendio activo

```ts
interface Fire {
  id: string;
  cell_id: string;
  centroid: [number, number];          // [lat, lng]
  detected_at: string;
  confidence: number;                  // 0–1
  source: 'VIIRS' | 'MODIS' | 'camera' | 'manual' | 'deepfire';
  area_ha: number;
  perimeter?: GeoJSON.Polygon;
  spread: { direction_deg: number; speed_kmh: number };
  weather: {
    temp_c: number;
    humidity_pct: number;
    wind_speed_kmh: number;
    wind_dir_deg: number;
  };
  zone: {
    land_cover: 'urban' | 'wui' | 'forest' | 'scrub' | 'crop' | 'bare';
    slope_deg: number;
    fuel_load: 'low' | 'moderate' | 'high' | 'extreme';
  };
  values_at_risk: Array<{
    type: 'school' | 'hospital' | 'care_home' | 'settlement' | 'infrastructure';
    name: string;
    distance_km: number;
    population?: number;
    downwind: boolean;                 // ¿está en la trayectoria del viento?
  }>;
}
```

`downwind` merece un tratamiento visual propio en la UI. Es el factor que convierte «hay
un colegio cerca» en «hay que evacuar ese colegio ya».

### 6.3 Predicción

```ts
interface Prediction {
  cell_id: string;
  risk_score: number;        // 0–1
  horizon_h: number;         // 6 | 12 | 24 | 48
  drivers: Array<{
    factor: string;          // 'wind_speed' | 'fuel_dryness' | 'temperature' | ...
    contribution: number;    // 0–1, para la barra
    value: string;           // texto ya formateado: "38 km/h SO"
  }>;
  rationale: string;
}
```

### 6.4 Análisis y acciones de la IA

```ts
interface AIAnalysis {
  target_id: string;               // fire_id o cell_id
  summary: string;
  priority_rationale: string;
  actions: RankedAction[];
  model: string;                   // para trazabilidad; se muestra en pie de panel
  generated_at: string;
}

interface RankedAction {
  action_id: string;               // referencia al catálogo en BD
  label: string;
  rank: number;                    // 1 = primero
  urgency: 'immediate' | 'soon' | 'monitor';
  why: string;                     // justificación, obligatoria
  resources?: string[];
  eta_min?: number;
  status: 'proposed' | 'accepted' | 'rejected' | 'done';
}
```

### 6.5 Endpoints

**Ninguno de estos existe.** `controledfire/api` contiene un único `spec.md` vacío.
Propuesta a validar con quien construya esa capa:

```
GET  /api/grid?mode=active|pred&res=6|8      → Cell[]
GET  /api/fires                              → Fire[]
GET  /api/fires/:id                          → Fire
POST /api/fires/:id/analysis                 → AIAnalysis   (llama a Nebius)
GET  /api/predictions?horizon=24             → Prediction[]
GET  /api/actions/catalog                    → ActionTemplate[]
POST /api/actions/:id/decision               → { status }
WS   /ws/events                              → push de nuevas detecciones
```

**Sobre el tiempo real:** si el WebSocket da problemas, hacer *polling* cada 10 segundos
con TanStack Query. En una demo nadie nota la diferencia, y se ahorra una hora de
depuración a las tres de la mañana. Encapsular la decisión detrás de un hook
(`useLiveFires`) para poder cambiarla sin tocar componentes.

**Y una salida más corta:** como `src` es TypeScript y el motor son tres funciones
síncronas, para la demo **no hace falta ninguna capa HTTP**. `map/` puede importar
`createInitialState`/`step`/`calculateOutcome` directamente y correr la simulación en el
navegador. Solo la llamada a Nebius necesita servidor, y únicamente para no publicar la
clave. Eso reduce `api/` a un endpoint. El mismo hook `useLiveFires` lo tapa: dentro,
un `setInterval` que llama a `step()` en vez de un `fetch`.

---

## 7. Sistema visual

**Los tokens viven en `map/DESIGN.md`.** Ese documento manda: colores, tipografía,
espaciado, radios, movimiento y accesibilidad. Aquí queda solo lo que es propio del
dominio y no de la interfaz.

La referencia no es un panel de SaaS. Es una consola de sala de operaciones: densa,
oscura, legible bajo presión, sin nada que sobre.

### La regla del color cálido

Los cálidos —ámbar, naranja, rojo— **solo aparecen como dato de fuego**, en el mapa y en
los indicadores que se refieren directamente a él. Ningún botón, ninguna cabecera, ningún
borde decorativo usa esa gama. Es una restricción autoimpuesta y es la que hace que la
pantalla se lea: si algo arde en la interfaz, arde en el mundo.

Esta regla es del proyecto, no del sistema de diseño, y por eso vive aquí. El sistema de
`DESIGN.md` la respalda: no trae ningún color de acento, así que no hay tentación que
resistir.

La paleta de las celdas (§4.7) es lo único que puede usar cálidos, y es dato, no estilo.

El fondo es azul nocturno (`#0C1220`) y no negro puro, para que el basemap oscuro se
integre en lugar de flotar sobre un recorte.

### Cifras grandes

El escalón `display` (40px) se reserva para dos cosas y nada más: el porcentaje de riesgo
en PRED y la superficie afectada en ACTUAL. Son los números por los que alguien abre el
panel.

### Copy

Verbos en infinitivo y en activa, en frase normal: «Evacuar CEIP Sant Jordi», no
«Evacuación escolar recomendada». Un botón dice lo que pasa al pulsarlo, y el estado
resultante conserva la misma palabra: *Aceptar* → *Aceptada*.

Sin estados vacíos mudos: si no hay incendios, la pantalla lo dice («Sin incendios activos
en Cataluña. Última comprobación hace 8 s») en vez de quedarse en blanco.

---

## 8. Datos falsos para arrancar

**No esperar al backend.** Poner en `map/src/mocks/` un escenario completo que dure los
tres minutos de demo:

- `fires.mock.ts` — tres incendios: uno en Collserola junto a zona habitada (el que se
  enseña), uno en el Montseny en bosque puro, uno ya controlado.
- `predictions.mock.ts` — ~40 celdas con riesgo repartido, con un par por encima de 0,8
  bien visibles en el Garraf.
- `analysis.mock.ts` — la respuesta de la IA para el incendio de Collserola, ya escrita
  y revisada.

El *mock* del análisis tiene que estar bien escrito aunque luego lo genere el modelo:
es el texto que van a leer los jueces. Si la llamada a Nebius falla en directo, el
sistema cae a este mock sin que se note. Encapsularlo en el hook, con `try/catch` y
respaldo silencioso.

Los mocks se escriben contra los tipos de la sección 6 (los de este spec), no contra los
de `src/types`. Cuando se conecte el motor, el adaptador de 6.0 es lo único que cambia.

Escenario de demo, en este orden:

1. Mapa de Cataluña, tranquilo, un par de celdas en vigilancia.
2. Entra una detección: una celda empieza a latir en rojo sobre Collserola.
3. El operador la pulsa. Se abre el panel: bosque en interfaz urbana, viento de 27 km/h
   empujando hacia el sur, un colegio a 1,8 km a sotavento.
4. La IA ordena: primero evacuar el colegio, después atacar la cabeza del frente.
   Explica por qué en ese orden.
5. El operador acepta las dos primeras y descarta la tercera. Quedan registradas.
6. Cambio a PRED: el Garraf lleva tres días sin humedad y mañana entra viento. Se envía
   un dron antes de que haya nada que apagar.

---

## 9. Plan de implementación

Por orden. No empezar una fase sin cerrar la anterior.

**Fase 0 — Decidir el modelo (30 min, antes de escribir código)**
Resolver la divergencia de 2.1 y 6.0: ¿consola sobre datos reales, o simulación con
mapa real como vista? Elegir y anotarlo aquí. Todo lo demás depende de esta respuesta y
cuesta caro cambiarla en la Fase 4.

**Fase 1 — El mapa se ve (2 h)**
Vite + React + Tailwind dentro de `map/`, respetando el `spec.md` que ya está ahí.
MapLibre con basemap CARTO centrado en Barcelona. `H3HexagonLayer` con la malla de
resolución 6 sobre Cataluña, todas las celdas en `normal`. Objetivo: se ve la rejilla y
se puede navegar.

**Fase 2 — El mapa tiene estados (2 h)**
Datos falsos con estados. Colores por estado. Pulso en las activas. Leyenda abajo a la
izquierda. Conmutador ACTUAL / PRED en la barra superior, cada modo con su capa.

**Fase 3 — El panel se abre (3 h)**
Picking de celda → panel lateral. Detalle de incendio con meteo, zona y valores en
riesgo. Detalle de predicción con riesgo y factores. Transición de entrada del panel.

**Fase 4 — La IA prioriza (3 h)**
Conectar el análisis (endpoint propio o llamada directa, según Fase 0). Lista de acciones
ordenadas con su justificación. Botones de aceptar y descartar con cambio de estado y
registro. Respaldo al mock si la llamada falla.

**Fase 5 — Datos reales (lo que quede)**
Sustituir mocks por el motor: el adaptador `Position ↔ cell_id` y `step()` en bucle.
Coordinar con quien esté implementando `src/engine`, que hoy son solo firmas.

**Fase 6 — Pulido**
Estados de carga, estados vacíos, `prefers-reduced-motion`, foco de teclado visible,
revisión de copy. Ensayar la demo tres veces cronometrando.

---

## 10. Fuera de alcance

Escrito aquí para poder señalarlo cuando alguien lo proponga a las dos de la mañana:

- Autenticación y gestión de usuarios.
- Histórico y reproducción temporal de incendios pasados.
- Móvil. Esto es una consola de sala de control; se enseña en portátil.
- Mapas 3D, extrusión de celdas, vistas inclinadas.
- Dibujar perímetros reales de incendio a mano. Si llega `perimeter` del backend, se
  pinta con `GeoJsonLayer`; si no, la celda basta.
- Multiidioma.
- Tests. Es un hackathon de 24 horas.

---

## 11. Fuentes y documentación

- Reto y datos de Norrsken: <https://www.deepfire.co/hackbarna>
- Plataforma Deepfire: <https://app.deepfire.co/>
- WeatherNext (DeepMind), previsión meteorológica: <https://deepmind.google/science/weathernext/>
- H3, documentación: <https://h3geo.org/docs/>
- `H3HexagonLayer` de deck.gl: <https://deck.gl/docs/api-reference/geo-layers/h3-hexagon-layer>
- Estilos base CARTO: <https://github.com/CartoDB/basemap-styles>
- Nebius Token Factory: quickstart, Models API y cookbook desde el portal de Nebius.

---

## 12. Notas para el agente de código

- Se trabaja en **`controledfire/map`**. No tocar `controledfire/src` ni `controledfire/api`.
- Leer los tipos reales de `src/types` **antes** de escribir los del front. Este documento
  propone los contratos; el backend los define. El resumen está en 6.0, pero los ficheros
  son cortos: leerlos enteros cuesta cinco minutos.
- Si un contrato de la sección 6 no coincide con el backend, **ajustar el front y anotar
  la diferencia aquí mismo**, para que ambos lados compartan una única referencia.
- Priorizar siempre lo que se ve en la demo. Ante la duda entre robustez y visibilidad,
  en las próximas 24 horas gana la visibilidad.
- Los cálidos son solo para fuego. Es la regla visual del proyecto y no se rompe ni en
  un botón de «Aceptar».

---

### Registro de cambios sobre el borrador

- 19 sep 2026 — Contrastado con el repositorio. Corregido: `src` es TypeScript, no
  Python; existe `api/`; el README describe una simulación y no una consola de
  detección. Añadidos 2.1, 6.0 y la Fase 0. Corregido el `tick` sin definir en el
  ejemplo de 4.6. Ajustado el comando de instalación, que fallaba porque `map/` ya
  existe con contenido.
