import type { FuelLoad, LandCover, ValueType } from '../mocks/types';

// en-GB, not en-US: metric units and a 24-hour clock, which is what a control room
// reads. It also keeps the decimal point consistent with the rest of the interface.
const LOCALE = 'en-GB';

const NUM = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const INT = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export const num = (v: number) => NUM.format(v);
export const int = (v: number) => INT.format(v);

/** Detection time. Hours and minutes only: the day is today and writing it is noise. */
export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

/**
 * The same instant with am/pm, for the footer of a card that has nothing to say but
 * when it was read. `time()` above stays 24h for everything that sits next to other
 * figures — a control room reads a 24h clock — but a bare timestamp on its own line
 * reads faster with the meridiem, the same call LiveFireInfoCard already makes for a
 * raw satellite detection.
 */
const CLOCK = new Intl.DateTimeFormat(LOCALE, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function clock(iso: string): string {
  return CLOCK.format(new Date(iso));
}

export const LAND_COVER: Record<LandCover, string> = {
  urban: 'built-up',
  wui: 'wildland-urban interface',
  forest: 'forest',
  scrub: 'scrub',
  crop: 'cropland',
  bare: 'bare ground',
};

export const FUEL_LOAD: Record<FuelLoad, string> = {
  low: 'low fuel load',
  moderate: 'moderate fuel load',
  high: 'high fuel load',
  extreme: 'extreme fuel load',
};

export const VALUE_TYPE: Record<ValueType, string> = {
  school: 'School',
  hospital: 'Hospital',
  care_home: 'Care home',
  settlement: 'Settlement',
  infrastructure: 'Infrastructure',
};
