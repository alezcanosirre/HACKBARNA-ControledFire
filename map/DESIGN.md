# ControlledFire — Sistema de diseño de la UI

Base para toda la interfaz que va **encima** del mapa: barra superior, panel de detalle,
lista de acciones, leyenda. El mapa y sus colores de dato se rigen por `spec.md` §4.7 y
§7, no por este documento.

**Origen:** tokens extraídos de openai.com. **Adaptado** al dominio, ver §0.

---

## 0. Qué se ha adaptado y por qué

Los tokens vienen de una herramienta de codificación en modo claro. Esto es una consola
de sala de control para emergencias. Tres cosas no se pueden importar tal cual, y una
cuarta estaba mal calculada en origen.

**1. Modo claro → oscuro.** No es preferencia estética. El basemap es
`dark-matter` (spec §4.5) y las celdas de fuego son luminosas sobre él. Una UI clara
alrededor de un mapa oscuro obliga al ojo a readaptarse en cada salto entre panel y mapa,
que es exactamente el movimiento que hace un operador cada treinta segundos. Se conserva
**toda** la filosofía del sistema —paleta desaturada, sin sombras, sin acentos de color—
sobre el fondo `#0C1220` del spec.

**2. El error de contraste del documento original.** Afirma que blanco sobre
`#8e8ea0` da ~8:1. Es **3,22:1**, el mismo valor que `#8e8ea0` sobre blanco, porque el
ratio es simétrico. Falla WCAG AA en los dos sentidos. Si se hubiera dado por bueno,
todos los botones primarios de la aplicación habrían salido ilegibles.

**3. `text` y `text-muted` estaban invertidos.** El original pone `#8e8ea0` (gris claro)
como texto principal y `#000000` (negro puro) como «muted». Es al revés: lo apagado no
puede tener más contraste que lo principal. Es un artefacto de extracción, no una
decisión. Corregido.

**4. Movimiento uniforme a 400 ms.** Se conserva para la UI. Pero el mapa tiene una
sola animación propia, el pulso de las celdas activas a 1400 ms (spec §4.8), y es el
único elemento que se mueve sin que el usuario lo provoque. No se le aplica este token.

**Lo que sí se importa entero, y es lo valioso:** la rejilla estricta de 8px, el radio
único y pequeño, la ausencia total de sombras, el stack `system-ui`, y sobre todo **la
paleta sin acentos**. Esto último encaja con la regla dura del proyecto (spec §7): los
cálidos son exclusivamente dato de fuego. Un sistema de diseño que de entrada no trae
ningún color de acento es el compañero perfecto para esa restricción — no hay tentación
que resistir porque no hay con qué.

---

## 1. Color

```css
:root {
  /* Superficies */
  --night-900: #0C1220;   /* fondo de la aplicación */
  --night-800: #131C2E;   /* paneles, tarjetas */
  --night-700: #1D2840;   /* bordes y separadores, 1px */

  /* Texto */
  --text:       #E4EBF5;  /* principal        15,58:1 sobre night-900  AAA */
  --text-muted: #8e8ea0;  /* secundario        5,81:1 sobre night-900  AA  */
  --text-dim:   #8FA3BF;  /* terciario         7,27:1 sobre night-900  AAA */

  /* Interacción */
  --primary:    #8e8ea0;  /* el gris-púrpura del sistema original */
  --on-primary: #0C1220;  /* NO blanco. Ver nota abajo */

  /* Único estado con color */
  --signal:     #4ADE80;  /* acción aceptada  10,73:1 sobre night-900  AAA */
}
```

Ratios calculados, no estimados.

**`--on-primary` es oscuro, no blanco.** Blanco sobre `#8e8ea0` da 3,22:1 y falla AA.
El fondo nocturno sobre ese mismo gris da contraste suficiente y además mantiene el botón
dentro de la gama fría. Es el único cambio de token que rompe con el original, y es el
que evita que toda la botonera sea inaccesible.

**`#8e8ea0` funciona, pero sobre oscuro.** El color del sistema original no es el
problema; el fondo blanco lo era. Sobre `#0C1220` pasa AA con holgura (5,81:1) y hace
exactamente el papel para el que se eligió: texto secundario que no compite.

### La regla que no se rompe

Ni ámbar, ni naranja, ni rojo en ningún elemento de interfaz. Ni en un botón de
«Aceptar», ni en un borde de error, ni en un badge. Si algo brilla en cálido en esta
pantalla, arde en el mundo. Los errores de formulario se marcan con texto y con el borde
`--text` a 2px, no con rojo.

`--signal` (verde) es la única excepción, y solo para confirmar una acción ya aceptada.

---

## 2. Tipografía

```css
--font: system-ui, -apple-system, "Segoe UI", sans-serif;
```

Se mantiene el stack del sistema. En una consola es lo correcto: renderiza nativo, no
hay descarga, y no se va a caer la fuente a las tres de la mañana.

| Rol | Tamaño | Peso | Interlineado | Uso |
|---|---|---|---|---|
| `display` | 40px | 700 | 1.1 | **Solo dos sitios:** el % de riesgo en PRED y la superficie afectada en ACTUAL |
| `heading` | 20px | 600 | 1.3 | Cabecera del panel, títulos de sección |
| `body` | 16px | 400 | 1.5 | Texto corrido, justificación de las acciones |
| `label` | 14px | 500 | 1.4 | Etiquetas de campo, botones |
| `meta` | 12px | 400 | 1.4 | Horas, fuentes, unidades, pie de panel |

Dos desviaciones del original, ambas del spec §7:

- **Display baja de 48px a 40px** y su interlineado de 1.5 a 1.1. Una cifra grande con
  1.5 de interlineado desperdicia media tarjeta, y en un panel de 380px eso es caro.
  El 1.5 se conserva íntegro en `body`, que es donde sirve.
- **Se añaden `label` y `meta`.** El original salta de 32px a 16px sin nada en medio;
  un panel denso necesita esos dos escalones.

Nada de mayúsculas forzadas. Nada de monoespaciada para datos pequeños.

---

## 3. Espaciado

Rejilla estricta de **8px**. Todo es múltiplo: 8, 16, 24, 32, 40, 48.

```
4px    (medio paso, solo entre una etiqueta y su valor)
8px    interior de elementos pequeños
16px   padding de tarjeta, separación entre campos
24px   entre bloques del panel
32px   márgenes de sección
```

El medio paso de 4px es la única excepción a la rejilla y existe porque pares
etiqueta/valor separados 8px se leen como dos cosas distintas en vez de como una.

**Medidas fijas** (spec §5.1): barra superior 56px, panel lateral 380px.

---

## 4. Forma y profundidad

```css
--radius-sm: 5px;   /* botones, inputs, badges */
--radius-md: 5px;   /* tarjetas — el mismo, a propósito */
```

Un solo radio, el del sistema original. Y **cero sombras**. La separación se consigue
con línea de 1px en `--night-700` o con cambio de fondo a `--night-800`. Una sala de
control no tiene tarjetas flotantes.

La única excepción es el panel lateral, que sí flota sobre el mapa y necesita despegarse:
borde izquierdo de 1px, sin sombra difusa.

---

## 5. Movimiento

```css
--duration: 400ms;
--easing: ease;
```

Uno solo para todo, como el original. Transiciones de color, hover, foco y la entrada
del panel lateral.

**El mapa queda fuera de este token.** El pulso de las celdas activas va a 1400 ms
(spec §4.8) y es lo único de la pantalla que se mueve por su cuenta. Funciona
precisamente porque nada más lo hace.

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; }
}
```

Con `reduced-motion` el pulso se apaga y las celdas activas quedan a alfa fijo 205.

---

## 6. Accesibilidad

Esto no es una app de consumo: alguien la va a leer con prisa, de pie, a dos metros y
posiblemente de noche. Los mínimos no son negociables aquí.

- **Contraste:** todos los pares de arriba pasan AA; los principales pasan AAA. Ningún
  texto de la interfaz baja de 4,5:1.
- **Área de pulsado:** 44×44px mínimo. Con la rejilla de 8px: 16px de padding horizontal
  y 12px vertical sobre un `label` de 14px da 44px justos.
- **Foco:** contorno de 2px en `--text` con 2px de separación. Nunca `outline: none`.
  Los botones de Aceptar y Descartar tienen que ser alcanzables con teclado.
- **Nunca solo color.** Un estado se marca con texto o con forma además del color. El
  mapa lo respeta ya: una celda activa late, no solo es roja.

---

## 7. Aplicación al panel de acciones

Para que no haya dudas en la pieza que más importa (spec §5.4):

- Número de orden en `label`, en `--text-muted`. Es prioridad, no decoración.
- Título de la acción en `body` peso 500, en `--text`.
- El *por qué* en `body` peso 400, en `--text-dim`. Siempre visible, nunca plegado.
- **Aceptar**: fondo `--primary`, texto `--on-primary`, radio 5px.
- **Descartar**: fondo transparente, borde 1px `--night-700`, texto `--text-muted`.
- Aceptada: fondo transparente, texto `--signal`, con la hora en `meta` al lado.
  El verbo conserva la palabra: *Aceptar* → *Aceptada*.
- Separación entre acciones: línea de 1px, no espacio en blanco. Densidad.

---

## Registro

- 19 sep 2026 — Creado desde los tokens de openai.com. Adaptado a modo oscuro por
  compatibilidad con el basemap. Corregido el ratio de `on-primary` (el original decía
  8:1, es 3,22:1 y falla AA). Invertidos `text` y `text-muted`, que venían al revés.
  Añadidos los escalones `label` y `meta`. Exceptuado el pulso del mapa del token de
  movimiento.
