import { useEffect, useState } from 'react';
import type { LiveFireState } from './types';

// El servidor local (api/src/live/server.ts) ya consulta Deepfire en
// segundo plano cada POLL_INTERVAL_MS (2 min por defecto) y cachea el
// resultado — leer esa caché aquí cada 15s es barato y no cuenta para el
// rate limit de Deepfire. Solo hace que "actualizado hace..." se sienta vivo.
const POLL_MS = 15_000;

interface State {
  data: LiveFireState | null;
  // Fallo de red hablando con el proxy local (proxy caído, etc).
  error: string | null;
  // El proxy respondió pero su último ciclo contra Deepfire falló — `data`
  // sigue siendo el último dato bueno conocido.
  stale: boolean;
  loading: boolean;
}

/**
 * Sondea /api/live-fires (proxy local a Deepfire) cada POLL_MS.
 *
 * `enabled` a false corta el sondeo Y vacía lo que hubiera. Es lo que hace SIMULACIÓN:
 * mientras enseña casos inventados no pide nada al backend ni conserva dato real de
 * antes, para que no quede una celda de Deepfire colada entre los focos de mentira. Las
 * dos fuentes nunca se mezclan en pantalla, que es toda la razón de que el botón exista.
 */
export function useLiveFireState(enabled = true): State {
  const [state, setState] = useState<State>({ data: null, error: null, stale: false, loading: true });

  // Apagar el sondeo también vacía el dato, y se ajusta durante el render en vez de en
  // un efecto: con un efecto quedaría un fotograma con celdas reales sobre el mapa de
  // la simulación, que es exactamente lo que el botón existe para evitar.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    if (!enabled) setState({ data: null, error: null, stale: false, loading: false });
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/live-fires');
        if (res.status === 503) return; // primer ciclo del servidor aún en curso
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        const body = (await res.json()) as LiveFireState;
        if (!cancelled) {
          setState({ data: body, error: null, stale: body.error !== null, loading: false });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : 'error desconocido',
            loading: false,
          }));
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);

  return state;
}
