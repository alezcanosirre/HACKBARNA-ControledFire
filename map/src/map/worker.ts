import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

/**
 * maplibre-gl 6 sirve el worker como fichero aparte y lo resuelve en runtime con
 * `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Al prebundear la dependencia,
 * Vite mueve el módulo a `.vite/deps/` y esa URL da 404: sin worker no se parsean los
 * tiles vectoriales y el mapa se queda negro, sin un solo error en consola.
 *
 * El nombre del fichero sale de un ternario, así que Vite no puede detectarlo como
 * asset por sí solo. Con `?worker&url` lo empaqueta (junto a su import de
 * `maplibre-gl-shared.mjs`) y lo emite tanto en dev como en build, y le pasamos la URL
 * resultante a MapLibre. Importar este módulo antes de montar ningún mapa es suficiente.
 */
setWorkerUrl(workerUrl);
