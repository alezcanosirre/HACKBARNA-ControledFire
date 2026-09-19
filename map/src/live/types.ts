// Debe reflejar LiveHotspot en api/src/live/deepfireHotspots.ts — no hay
// path compartido entre los dos proyectos TS (ver map/spec.md §3, aviso del
// tsconfig de la raíz), así que este tipo se duplica a propósito.
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

export interface HotspotsResponse {
  readonly hotspots: readonly LiveHotspot[];
  readonly fetchedAt: number;
}
