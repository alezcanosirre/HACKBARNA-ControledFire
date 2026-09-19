import type { FuelLoad, LandCover, ValueType } from '../mocks/types';

const NUM = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const INT = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export const num = (v: number) => NUM.format(v);
export const int = (v: number) => INT.format(v);

/** Hora de detección. Solo hora y minuto: el día es hoy y escribirlo es ruido. */
export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export const LAND_COVER: Record<LandCover, string> = {
  urban: 'habitado',
  wui: 'interfaz urbano-forestal',
  forest: 'bosque',
  scrub: 'matorral',
  crop: 'cultivo',
  bare: 'suelo desnudo',
};

export const FUEL_LOAD: Record<FuelLoad, string> = {
  low: 'carga baja',
  moderate: 'carga moderada',
  high: 'carga alta',
  extreme: 'carga extrema',
};

export const VALUE_TYPE: Record<ValueType, string> = {
  school: 'Colegio',
  hospital: 'Hospital',
  care_home: 'Residencia',
  settlement: 'Núcleo',
  infrastructure: 'Infraestructura',
};
