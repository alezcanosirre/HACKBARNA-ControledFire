import type { LiveFireState, LiveFireSummary } from "./liveFireState";

/**
 * El estado del último ciclo de sondeo, en un módulo propio — antes vivía como una
 * variable privada dentro de server.ts. Se extrae aquí porque el endpoint de
 * recomendaciones (actionRecommendation.ts) necesita poder buscar un incidente "en su
 * estado actual" sin re-consultar Deepfire por su cuenta, y sin crear un import
 * circular server.ts ⇄ actionRecommendation.ts.
 */

interface Store {
  readonly state: LiveFireState;
  readonly lastError: string | null;
}

// undefined = todavía no se ha completado ni un solo ciclo de sondeo.
let current: Store | undefined;

export function setLiveFireState(state: LiveFireState): void {
  current = { state, lastError: null };
}

/** Un fallo de sondeo no borra el último dato bueno — solo lo marca como posiblemente
 * desactualizado. Ver server.ts pollOnce(). */
export function setLiveFireError(message: string, fallbackState: LiveFireState): void {
  current = { state: current?.state ?? fallbackState, lastError: message };
}

export function getLiveFireStore(): Store | undefined {
  return current;
}

/** El incidente con este id en el ciclo de sondeo más reciente, o `undefined` si no
 * existe (nunca se ha visto, o ha dejado de estar activo). Nunca dispara una consulta
 * nueva a Deepfire — "buscar en su estado actual", no "ir a buscarlo". */
export function findFireById(incidentId: string): LiveFireSummary | undefined {
  return current?.state.fires.find((f) => f.id === incidentId);
}
