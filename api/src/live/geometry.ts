// Sin @types/geojson en el proyecto — tipos mínimos, solo lo que usamos.
export interface PointGeometry {
  readonly type: "Point";
  readonly coordinates: readonly [number, number]; // [lng, lat]
}

export interface MultiPolygonGeometry {
  readonly type: "MultiPolygon";
  // MultiPolygon → array de polígonos → array de anillos → array de [lng, lat]
  readonly coordinates: readonly (readonly (readonly (readonly [number, number])[])[])[];
}
