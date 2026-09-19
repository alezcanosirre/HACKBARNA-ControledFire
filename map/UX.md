# ControlledFire — UI / UX

Cómo se comporta la interfaz que va encima del mapa. Los tokens visuales están en
`DESIGN.md`; el mapa y sus colores de dato, en `spec.md` §4. Aquí está la **estructura,
los estados y las transiciones**.

Basado en las pizarras ACTUAL y PRED.

---

## 0. Las tres reglas

**1. Todo flota.** No hay layout de columnas. El mapa ocupa el 100% de la ventana,
siempre, y cada pieza de interfaz es una superficie que se posa encima. El mapa nunca se
encoge ni se desplaza: al abrir un incendio, lo que se mueve es el panel, no el terreno.
Que el mapa salte en el momento de máxima tensión desorienta.

**2. Una cosa a la vez.** Al seleccionar una celda, **el menú desaparece**. No se apaga,
no se contrae: se va. En su sitio queda solo la flecha de volver. Mientras hay un
incendio abierto no existe navegación, solo ese incendio.

**3. Los cálidos son dato.** Ámbar, naranja y rojo solo aparecen en las celdas del mapa y
en las cifras que se refieren directamente al fuego. Ni un botón, ni un borde, ni un
badge. Ver §9 para la única excepción pendiente.

---

## 1. Las cuatro pantallas

No hay más. Dos páginas × dos estados:

```
              REPOSO                        CELDA SELECCIONADA
          ┌──────────────┐                 ┌──────────────┐
 ACTUAL   │ menú + mapa  │ ──clic celda──▶ │ ← + info + acciones + prioridades │
          └──────────────┘ ◀──volver────── └──────────────┘
                 │ ▲
          cambio │ │ de página (solo desde reposo)
                 ▼ │
          ┌──────────────┐                 ┌──────────────┐
 PRED     │ menú + mapa  │ ──clic celda──▶ │ ← + riesgo + análisis + acciones │
          └──────────────┘ ◀──volver────── └──────────────┘
```

Regla de la máquina de estados: **no se cambia de página con una celda abierta.** Si el
menú no está, no hay forma de cambiar de página, y eso es intencionado. Volver primero.

El estado vive en la URL (`/actual`, `/pred`, `/actual/:cellId`) para que recargar no
pierda el sitio y para que la demo se pueda saltar a un punto concreto si algo falla.

---

## 2. Anatomía de capas

```
z-30   flecha de volver
z-20   menú lateral   /   cards de detalle
z-10   leyenda
z-0    mapa + rejilla H3
```

Todo lo de z≥10 es `position: absolute` sobre el contenedor del mapa, con
`pointer-events: none` en el contenedor y `auto` en cada tarjeta. Si no, la capa de UI
se come los clics del mapa en toda la pantalla y el picking deja de funcionar en las
zonas «vacías». Es un fallo que parece del mapa y es de CSS.

**Superficie flotante estándar** — todas las tarjetas de este documento la usan:

```
fondo    surface al 92% + backdrop-blur   (se intuye el mapa detrás: flota)
borde    1px line
radio    5px
padding  16px
sombra   ninguna
```

**La superficie es clara y el mapa oscuro.** Es lo que separa la interfaz del terreno sin
recurrir a una sombra: el salto de luminancia hace el trabajo que haría el relieve. Ver
`DESIGN.md` §0 y §1.

El `backdrop-blur` es lo que hace que se lea como flotante y no como un recorte. Es el
único efecto de profundidad que se permite, y sustituye a la sombra que `DESIGN.md`
prohíbe.

---

## 3. Menú lateral

Flotante a la izquierda, **casi toda la altura** de la ventana: `top: 16px; bottom: 16px`.
Se ve el mapa por arriba, por abajo y por los lados. Eso es lo que lo hace flotar.

Dos anchos, con botón de expandir/contraer arriba:

```
  CONTRAÍDO 64px              EXPANDIDO 260px
┌──────┐                    ┌──────────────────────┐
│  ⇥   │                    │ ControlledFire    ⇤  │
│      │                    │                      │
│ ┌──┐ │                    │ ┌──────────────────┐ │
│ │🔥│ │ ← activo           │ │ 🔥 Fuegos activos│ │ ← activo
│ └──┘ │                    │ │    3 ahora mismo │ │
│ ┌──┐ │                    │ └──────────────────┘ │
│ │◹ │ │                    │ ┌──────────────────┐ │
│ └──┘ │                    │ │ ◹  Predicción    │ │
│      │                    │ │    próximas 24 h │ │
│      │                    │ └──────────────────┘ │
│      │                    │                      │
│  ⋮   │                    │         ⋮            │
│      │                    │                      │
│ ┌──┐ │                    │ ┌──────────────────┐ │
│ │▶ │ │                    │ │ ▶  SIMULATION    │ │
│ └──┘ │                    │ └──────────────────┘ │
└──────┘                    └──────────────────────┘
```

- **Página por defecto: Fuegos activos.** Marcada al arrancar, sin que nadie la elija.
- **Item activo:** fondo `--surface-2`, texto `--text`, y una barra de 2px a la izquierda.
  No solo color: el estado se marca también con forma, porque la regla de accesibilidad
  de `DESIGN.md` §6 lo exige.
- **Item inactivo:** texto `--muted`, fondo transparente. Al pasar por encima, fondo
  `--surface-2` al 60%.
- **Contador en vivo** («3 ahora mismo») solo en el modo expandido. Es el dato que dice
  si la pantalla merece atención ahora.
- La anchura se anima 400ms `ease`. El mapa no se entera: no se reposiciona.
- Contraído se guarda en `localStorage`. Si alguien lo dejó cerrado, sigue cerrado.

### El botón SIMULATION

Abajo del todo, separado del resto por una línea de 1px y un `margin-top: auto` que lo
empuja al fondo. Es de otra naturaleza que los dos de arriba: no navega, ejecuta.

**Esto choca con la regla 3** (los cálidos son solo dato). Ver §9: está pendiente de tu
decisión y por ahora va como lo pediste, en rojo.

---

## 4. Página ACTUAL — reposo

```
┌──────────────────────────────────────────────────────────────┐
│ ┌────┐                                      ┌──────────────┐ │
│ │    │                                      │ 3 activos    │ │
│ │ 🔥 │                                      ├──────────────┤ │
│ │    │              ◆ ← celda latiendo      │ Collserola   │ │
│ │ ◹  │                                      │ 12,4 ha      │ │
│ │    │                                      ├──────────────┤ │
│ │    │                                      │ Montseny     │ │
│ │    │                                      ├──────────────┤ │
│ │ ▶  │                                      │ Vallès ✓     │ │
│ └────┘  ┌────────────┐                      └──────────────┘ │
│         │  leyenda   │                                       │
│         └────────────┘                                       │
└──────────────────────────────────────────────────────────────┘
```

- Las celdas con fuego **laten** (spec §4.8). Es lo único que se mueve en la pantalla.
- **Lista de incendios a la derecha.** Esto sale de tu pizarra (las cuatro tarjetas
  apiladas), no de tu descripción. Pulsar una tarjeta hace lo mismo que pulsar su celda,
  y además centra el mapa en ella. Sirve para dos cosas: dar salida a un incendio que
  queda fuera de pantalla, y hacer la demo sin tener que acertar con el ratón. **Confirma
  si lo quieres**; si no, fuera y queda solo el mapa.
- Leyenda abajo a la izquierda, junto al menú: los cinco estados de celda.
- Sin incendios: la lista dice «Sin incendios activos. Última comprobación hace 8 s».
  Nunca en blanco.

---

## 5. Página ACTUAL — celda seleccionada

El menú se va. Entran tres zonas.

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──┐                                        ┌──────────────┐ │
│ │← │                                        │ ACCIONES  IA │ │
│ └──┘                                        ├──────────────┤ │
│ ┌──────────────────┐                        │ 1 Evacuar…   │ │
│ │ Collserola nord  │        ◆               │   420 pers.  │ │
│ │ 14:32 · VIIRS    │                        │  [✓]  [✕]    │ │
│ ├──────────────────┤                        ├──────────────┤ │
│ │      12,4        │ ha                     │ 2 Helicóptero│ │
│ ├──────────────────┤                        │  [✓]  [✕]    │ │
│ │ ↗ 27 km/h  31°C  │                        ├──────────────┤ │
│ │ HR 18%   ↑ 4 km/h│                        │ 3 Cortar BV… │ │
│ ├──────────────────┤                        └──────────────┘ │
│ │ EN RIESGO        │                        ┌──────────────┐ │
│ │ CEIP · 1,8 km ⚠  │                        │ PRIORIDADES  │ │
│ │ Núcleo · 3,1 km  │                        ├──────────────┤ │
│ └──────────────────┘                        │ ▸ …          │ │
│ [habitado][bosque][pendiente 12°]           └──────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Izquierda, 360px** — el botón de volver arriba del todo, y debajo la tarjeta de
información. En este orden, que es el de spec §5.2:

1. Topónimo, hora de detección y fuente. Nunca el `cell_id` en crudo.
2. **Superficie afectada en `display` 40px.** Es el número por el que se abre el panel.
3. Condiciones: viento como **flecha girada**, no como «210°». Temperatura, humedad,
   velocidad de propagación.
4. En riesgo: lista de lo que hay cerca, con distancia. **Lo que está a sotavento lleva
   marca propia** (`⚠` + el nombre en `--text` en vez de `--text-dim`). Es lo que
   convierte «hay un colegio cerca» en «evacuar ese colegio ya».
5. Las tres pastillas de zona debajo de la tarjeta, como en la pizarra
   («Cuadrado – Zona (Habitado, bosque)»).

**Derecha arriba, 360px — ACCIONES.** Una tarjeta con la lista ordenada, y nada más
antes de ella. **El resumen de la IA no se pinta**: repetía en prosa lo que la tarjeta de
la izquierda ya da como dato —viento, humedad, quién está a sotavento— y decirlo dos
veces en la misma pantalla no aporta. El campo sigue en el contrato de `spec.md` §6.4.
Cada acción es una fila:

- Tile de glifo a la izquierda, con el icono del tipo de acción. Monocromo.
- El qué, en peso 500.
- Línea de meta debajo: número de orden —que es prioridad real, no viñeta—, urgencia,
  tiempo estimado y recursos.
- **El porqué, siempre visible, nunca plegado.** Sin la justificación la fila no sirve
  de nada: es lo que permite juzgar la propuesta.
- Pie de la tarjeta: el modelo que generó el análisis, en `meta`. Trazabilidad.

**No hay botones de decisión.** Ni `[Aceptar]` ni `[Descartar]`. Esta tarjeta **solo
muestra información**: quien decide es el bombero, sobre el terreno y con su criterio, y
la pantalla no le pide que firme nada. Se aparta de `spec.md` §5.4 a propósito; ver
`DESIGN.md` §7.

**Derecha abajo — PRIORIDADES.** Segunda tarjeta, separada, como en la pizarra («Prios»).

**El botón de volver deselecciona.** No es «atrás» del navegador: apaga la selección y
devuelve a §4, con el menú entrando de nuevo. `Esc` hace lo mismo.

---

## 6. Página PRED — reposo

Idéntica a §4 salvo el dato: el mapa pinta la rampa continua de riesgo de spec §4.7.
Ámbar el riesgo moderado, rojo saturado y opaco el punto caliente — que es lo que dice
la pizarra, «Rojo = Punto Caliente». Por debajo de 0,25 no se pinta nada: si se colorea
todo, deja de verse lo que importa.

Aquí **no late nada**. El pulso es exclusivo del fuego real. Un riesgo no es una
emergencia y no puede reclamar la misma atención.

---

## 7. Página PRED — celda seleccionada

Misma arquitectura que §5, distinto contenido.

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──┐                                        ┌──────────────┐ │
│ │← │                                        │ ACCIONES     │ │
│ └──┘                                        │ PREVENTIVAS  │ │
│ ┌──────────────────┐                        ├──────────────┤ │
│ │ RIESGO           │                        │ 1 Enviar dron│ │
│ │       87%        │ ← display 40px         │  [✓]  [✕]    │ │
│ │ próximas 24 h    │                        ├──────────────┤ │
│ ├──────────────────┤                        │ 2 Avisar base│ │
│ │ ANÁLISIS         │                        │   helicóptero│ │
│ │ Tres días sin    │                        │  [✓]  [✕]    │ │
│ │ humedad y entra  │                        ├──────────────┤ │
│ │ viento de poniente│                       │ 3 Desplazar  │ │
│ ├──────────────────┤                        │   dotación   │ │
│ │ Viento     ████▁ │                        └──────────────┘ │
│ │ Sequedad   ███▁▁ │                                         │
│ │ Temperatura██▁▁▁ │                                         │
│ └──────────────────┘                                         │
│ [Garraf][matorral][sin lluvia 3 d]                           │
└──────────────────────────────────────────────────────────────┘
```

- **El porcentaje en 40px es lo primero.** Es el dato que se ha venido a ver.
- **Debajo, el porqué.** Texto de la IA, y luego los factores con su peso en barra. Sin
  esta sección el número no es accionable: es solo un número.
- Las barras de factores usan `--muted`, no cálidos. El riesgo ya está pintado en el mapa;
  repetir la gama aquí la devalúa.
- Acciones preventivas a la derecha, con la misma fila que en §5 y también sin botones.
  Aquí no hay tarjeta de prioridades: con riesgo no hay frente que atacar en orden.

---

## 8. Datos: dos niveles

Tal como lo planteaste, y conviene que quede escrito porque cambia la arquitectura:

**Nivel 1 — el feed de la página.** Una conexión por página que va diciendo qué celdas
tienen fuego o riesgo. Alimenta el mapa entero. Es lo que hace que una celda empiece a
latir sin que nadie pulse nada.

**Nivel 2 — el detalle de la celda.** Una petición extra, solo al pulsar. Trae la
información, las acciones y las prioridades de esa celda.

Consecuencias en la interfaz:

- **El panel abre inmediatamente, no cuando llega la respuesta.** Entra con la estructura
  ya montada y los huecos en estado de carga. Un panel que tarda 400ms en aparecer se
  siente roto; uno que aparece vacío y se rellena, no.
- **Esqueletos, no *spinners*.** Bloques en `--surface-2` del tamaño del contenido final.
  Nada gira.
- **La lista de acciones es lo último en llegar** (la genera un modelo). Su esqueleto
  lleva un rótulo: «Analizando…». Es el único sitio donde se admite decir que se está
  pensando.
- **Si el análisis falla, cae al mock sin avisar.** El respaldo está en el hook, con
  `try/catch` silencioso. En directo nadie tiene que enterarse.
- Mientras el panel está abierto, el feed sigue vivo: el mapa de detrás se actualiza.

---

## 9. Pendiente de tu decisión: el rojo de SIMULATION

Lo pediste en rojo y así va, pero quiero que la decisión sea consciente porque es la
única grieta en la regla que sostiene toda la pantalla.

El problema: ese botón vive flotando **encima del mapa**, a unos centímetros de las
celdas que laten en rojo. En la demo, el ojo del jurado tiene que ir al incendio y va a
ir dos veces al botón. Y el argumento «si algo arde en la interfaz, arde en el mundo»
deja de ser cierto en cuanto hay un rojo que no es fuego.

Tres salidas, de menos a más disruptiva:

**A. Como lo pediste.** Fondo `#EC381C`, texto `--on-primary`. Máxima visibilidad, y la
regla queda con una excepción declarada. Contraste 4,59:1 sobre el fondo: pasa AA justo.

**B. Rojo solo en el borde y el texto.** Fondo transparente, borde 1px y texto en rojo.
*(Los ratios de esta sección se calcularon contra la interfaz oscura; hay que rehacerlos
ahora que la superficie es clara.)* Se lee igual de rojo, pesa mucho menos y no compite con una
celda rellena.

**C. Neutro apagado, rojo encendido.** El botón es `--muted` en reposo. Al arrancar la
simulación, **el marco entero de la ventana** coge un borde rojo de 2px con el rótulo
«SIMULACIÓN EN CURSO». El rojo aparece solo cuando significa algo, y entonces significa
que nada de lo que ves es real — que es exactamente lo que hay que comunicar.

Yo iría a la **C**, y si te parece mucho, a la **B**. Pero es tu pantalla: dime cuál y lo
fijo aquí y en `DESIGN.md`.

---

## 10. Movimiento

Un solo token, 400ms `ease` (`DESIGN.md` §5), para todo:

| Transición | Cómo |
|---|---|
| Menú expandir/contraer | anchura 64 ↔ 260px |
| Selección de celda | menú sale a la izquierda + tarjetas entran, a la vez |
| Deselección | lo inverso |
| Cambio de página | las celdas cambian de color, la UI no se mueve |

El cambio de página **no mueve nada de interfaz**. Solo cambia el dato del mapa. Es lo
que deja claro que ACTUAL y PRED son dos lecturas del mismo sitio, no dos sitios.

Con `prefers-reduced-motion` todo es instantáneo y el pulso de las celdas se apaga a
alfa fijo 205.

---

## 11. Teclado

Una sala de control se maneja con las manos ocupadas. Mínimos:

- `Tab` recorre menú → tarjetas → acciones. Foco visible siempre: 2px en `--text` con 2px
  de separación. Nunca `outline: none`.
- `Esc` deselecciona la celda. Es el atajo del botón de volver.
- `1` / `2` cambian de página, solo en reposo.
- *(Queda sin objeto desde que el panel de acciones no lleva botones. Si vuelve alguna
  decisión a la pantalla, vuelve también este mínimo.)*

---

## 12. Lo que NO lleva

- Ventanas modales. Nada bloquea el mapa.
- Pestañas dentro del panel. Todo visible a la vez o no está.
- Acordeones sobre el porqué de una acción. Plegar la justificación es esconderla.
- Tooltips con información necesaria. Si hace falta, se escribe.
- Móvil. Esto se enseña en portátil (spec §10).
- Una tercera página. Son dos, y el menú tiene sitio justo para dos.

---

## Registro

- 19 sep 2026 — Fuera el **resumen de la IA** de la cabecera del panel de acciones: era
  la tarjeta de la izquierda contada otra vez.
- 19 sep 2026 — **El panel de acciones pierde los botones de decisión.** En ACTUAL solo
  muestra información; el criterio lo pone el bombero. Afecta a §5, §7 y §11, y se
  aparta de `spec.md` §5.4, que sigue pidiéndolos.
- 19 sep 2026 — La leyenda se mueve a **arriba a la derecha**, enfrente del menú.
- 19 sep 2026 — La capa flotante pasa a **superficie clara** sobre el mapa oscuro; ver
  `DESIGN.md` §1. Afecta a §2, §3 y §8. Las tres salidas de §9 siguen abiertas, pero sus
  ratios eran contra la interfaz oscura y hay que recalcularlos.
- 19 sep 2026 — Creado desde tu descripción y las pizarras ACTUAL y PRED. Pendientes:
  la lista de incendios del §4 (está en la pizarra, no en tu descripción) y el rojo de
  SIMULATION (§9).
