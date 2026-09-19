// Debe reflejar api/src/live/liveFireState.ts + deepfireHotspots.ts — no
// hay path compartido entre los dos proyectos TS (ver map/spec.md §3), así
// que este tipo se duplica a propósito.
export interface LiveHotspot {
  readonly id: string;
  readonly clusterId: string;
  readonly lat: number;
  readonly lng: number;
  readonly observedAt: string;
  readonly source: string;
  readonly confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly fireRadiativePowerMw: number | null;
}

export interface LiveFireState {
  readonly activeCellIds: readonly string[]; // res-8, ardiendo AHORA
  readonly riskCellIds: readonly string[]; // res-8, riesgo próximas horas
  readonly hotspots: readonly LiveHotspot[];
  readonly fetchedAt: number;
  // Del último ciclo de refresco del servidor, si falló — el resto de
  // campos en ese caso son el último dato bueno conocido, no vacío.
  readonly error: string | null;
}
