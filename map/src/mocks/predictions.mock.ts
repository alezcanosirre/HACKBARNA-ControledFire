import { QUAD_Z } from '../map/constants';
import { latToTileY, lngToTileX, tileToQuadkey } from '../lib/quadkey';
import type { AIAnalysis, Prediction } from './types';

/**
 * Risk scenario of spec.md §8: around forty cells with risk spread across the RMB, a
 * couple above 0.8 clearly visible in the Garraf.
 *
 * Generated at module load from three centres rather than written out cell by cell: the
 * ids are quadkeys and a hand-written list of forty of them would be unreadable and
 * impossible to check. The noise is deterministic — same cell, same value on every
 * reload — so the map does not flicker between renders.
 *
 * This whole file goes when the backend sends real predictions. The types are spec
 * §6.3, so what changes then is where the data comes from, not the components.
 */

interface RiskArea {
  id: string;
  place: string;
  lat: number;
  lng: number;
  /** Radius in cells. */
  radius: number;
  peak: number;
}

const AREAS: RiskArea[] = [
  { id: 'garraf', place: 'Garraf — Pla de Querol', lat: 41.28, lng: 1.85, radius: 3, peak: 0.92 },
  { id: 'montseny', place: 'Montseny — Coll Formic', lat: 41.72, lng: 2.38, radius: 3, peak: 0.63 },
  { id: 'valles', place: "Vallès — Sant Llorenç", lat: 41.6, lng: 2.05, radius: 2, peak: 0.44 },
];

/** Same deterministic hash as the map's demo scenario: same cell, same value, always. */
function noise(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export interface RiskCell {
  cell_id: string;
  risk: number;
  areaId: string;
}

function buildRiskCells(): RiskCell[] {
  const out: RiskCell[] = [];

  for (const area of AREAS) {
    const cx = lngToTileX(area.lng, QUAD_Z);
    const cy = latToTileY(area.lat, QUAD_Z);

    for (let dy = -area.radius; dy <= area.radius; dy++) {
      for (let dx = -area.radius; dx <= area.radius; dx++) {
        const distance = Math.hypot(dx, dy) / area.radius;
        if (distance > 1) continue;

        // Falls off from the centre, with a bit of noise so the patch is not a perfect
        // disc — a perfect disc on a map reads as a bug, not as terrain.
        const risk = area.peak * (1 - distance * 0.7) * (0.85 + noise(cx + dx, cy + dy) * 0.3);
        // Below 0.25 nothing is painted (spec §4.7), so it is not worth carrying.
        if (risk < 0.25) continue;

        out.push({
          cell_id: tileToQuadkey(cx + dx, cy + dy, QUAD_Z),
          risk: Math.min(1, risk),
          areaId: area.id,
        });
      }
    }
  }

  return out;
}

export const RISK_CELLS: RiskCell[] = buildRiskCells();

const RISK_BY_CELL = new Map(RISK_CELLS.map((c) => [c.cell_id, c]));

/**
 * One prediction per area, written by hand. Not generated: the rationale and the
 * drivers are what an operator reads to decide, and a sentence assembled from a
 * template would read like one.
 */
const PREDICTIONS: Record<string, Omit<Prediction, 'cell_id' | 'risk_score'>> = {
  garraf: {
    horizon_h: 24,
    place: 'Garraf — Pla de Querol',
    rationale:
      'Three days without rain on scrub that was already dry, and a westerly is forecast ' +
      'to pick up overnight. The massif has no natural break on this slope.',
    drivers: [
      { factor: 'fuel_dryness', contribution: 0.91, value: '3 days without rain' },
      { factor: 'wind_speed', contribution: 0.78, value: '38 km/h SW forecast' },
      { factor: 'temperature', contribution: 0.62, value: '31 °C' },
      { factor: 'history', contribution: 0.44, value: '4 fires in 10 years' },
    ],
  },
  montseny: {
    horizon_h: 24,
    place: 'Montseny — Coll Formic',
    rationale:
      'Extreme fuel load on a steep slope. Humidity holds for now, which is the only ' +
      'thing keeping this from being the worst cell on the map.',
    drivers: [
      { factor: 'fuel_load', contribution: 0.84, value: 'extreme' },
      { factor: 'slope', contribution: 0.71, value: '21°' },
      { factor: 'fuel_dryness', contribution: 0.38, value: 'rain 2 days ago' },
      { factor: 'wind_speed', contribution: 0.26, value: '12 km/h N' },
    ],
  },
  valles: {
    horizon_h: 24,
    place: "Vallès — Sant Llorenç",
    rationale:
      'Harvested cropland next to woodland. Moderate on its own; it matters because of ' +
      'what it is next to, not because of what it is.',
    drivers: [
      { factor: 'wind_speed', contribution: 0.52, value: '19 km/h SE' },
      { factor: 'temperature', contribution: 0.41, value: '28 °C' },
      { factor: 'fuel_dryness', contribution: 0.33, value: 'rain 4 days ago' },
    ],
  },
};

/**
 * Built once, at module load, and handed out by reference.
 *
 * This is not an optimisation. Shell keeps the open detail mounted by comparing it with
 * the previous one by identity, so a function that assembled a fresh object on every
 * call would look like a new selection on every render — and it did: the first version
 * of this file spun React into "Too many re-renders" the moment a cell was clicked.
 */
const PREDICTION_BY_CELL = new Map<string, Prediction>(
  RISK_CELLS.map((cell) => [
    cell.cell_id,
    { ...PREDICTIONS[cell.areaId], cell_id: cell.cell_id, risk_score: cell.risk },
  ]),
);

/** Full prediction for a cell, or null if that cell carries no risk. */
export function predictionFor(cellId: string | null): Prediction | null {
  return cellId ? (PREDICTION_BY_CELL.get(cellId) ?? null) : null;
}

/**
 * Preventive actions per area (UX.md §7). Same contract as ACTUAL's — the difference is
 * what they propose, not how they are shaped: here nothing is burning yet, so every one
 * of them is about arriving before there is anything to put out.
 */
const ANALYSES: Record<string, AIAnalysis> = {
  garraf: {
    target_id: 'garraf',
    summary: '',
    priority_rationale: '',
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T18:40:00+02:00',
    actions: [
      {
        action_id: 'DEPLOY_RESOURCE:drone',
        label: 'Send a drone over the massif',
        rank: 1,
        urgency: 'immediate',
        why: 'No camera covers this slope. Half an hour of drone confirms whether there is already smoke nobody has reported.',
        eta_min: 15,
        status: 'proposed',
      },
      {
        action_id: 'DEPLOY_RESOURCE:helicopter',
        label: 'Put the helicopter base on notice',
        rank: 2,
        urgency: 'soon',
        why: 'With 38 km/h forecast, a flare-up here reaches the urbanisations in under an hour. Scrambling takes 15 minutes that would not be available then.',
        resources: ['Sabadell base'],
        status: 'proposed',
      },
      {
        action_id: 'DEPLOY_RESOURCE:ground',
        label: 'Move a crew to the Querol track',
        rank: 3,
        urgency: 'soon',
        why: 'It is the only vehicle access into the massif from the north. A crew already there saves 25 minutes of approach.',
        eta_min: 25,
        status: 'proposed',
      },
    ],
  },
  montseny: {
    target_id: 'montseny',
    summary: '',
    priority_rationale: '',
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T18:40:00+02:00',
    actions: [
      {
        action_id: 'DEPLOY_RESOURCE:ground',
        label: 'Ground inspection of the upper track',
        rank: 1,
        urgency: 'soon',
        why: 'Extreme fuel load on a 21° slope. Confirming the track is passable now is what makes a firebreak possible later.',
        eta_min: 45,
        status: 'proposed',
      },
      {
        action_id: 'WAIT',
        label: 'Keep under observation',
        rank: 2,
        urgency: 'monitor',
        why: 'Humidity is holding. Without a wind shift the risk does not turn into anything today.',
        status: 'proposed',
      },
    ],
  },
  valles: {
    target_id: 'valles',
    summary: '',
    priority_rationale: '',
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T18:40:00+02:00',
    actions: [
      {
        action_id: 'WAIT',
        label: 'Keep under observation',
        rank: 1,
        urgency: 'monitor',
        why: 'Moderate risk on harvested cropland. It is worth watching because of the woodland next to it, not because of the field.',
        status: 'proposed',
      },
    ],
  },
};

/** Preventive actions for a cell, or null if that cell carries no risk. */
export function preventiveActionsFor(cellId: string | null): AIAnalysis | null {
  if (!cellId) return null;
  const cell = RISK_BY_CELL.get(cellId);
  return cell ? ANALYSES[cell.areaId] : null;
}
