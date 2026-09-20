import { riskFill } from '../pred/risk';
import type { Page } from './route';
import { Surface } from './Surface';

/**
 * The legend of UX.md §4, top right.
 *
 * ONE state, not the five of spec.md §4.7. The other four — watch, at risk, contained,
 * no status — were in the spec and on this legend, and nothing on the map has ever
 * painted them: the live Deepfire feed only ever says a cell is burning, and so does
 * SIMULATION. A key that lists four colours you will never see is not a key, it is a
 * promise the map does not keep, and it costs the reader time working out which of the
 * five they are looking at.
 *
 * They come back the day something paints them. PRED has its own key — a ramp, because
 * risk is continuous — a few lines below.
 *
 * The swatch is the colour the map paints, over the dark background it has there.
 */
const STATES = [
  { label: 'Active fire', fill: 'bg-cell-active/80', line: 'border-cell-active-line/92' },
];

/**
 * PRED does not use the discrete states: risk is continuous, so its key is a ramp and
 * not a list (spec.md §4.7). Built from `riskFill` itself rather than from hand-picked
 * stops, so the key cannot drift away from what the map paints.
 */
const RAMP_STOPS = [0.25, 0.45, 0.65, 0.85, 1];

const rgba = ([r, g, b, a]: readonly number[]) => `rgba(${r},${g},${b},${a / 255})`;

function RiskRamp() {
  return (
    <div className="flex w-40 flex-col gap-2">
      <div className="flex h-3.5 overflow-hidden rounded-sm bg-night-900">
        {RAMP_STOPS.map((stop) => (
          <span
            key={stop}
            aria-hidden="true"
            className="h-full flex-1"
            style={{ backgroundColor: rgba(riskFill(stop)) }}
          />
        ))}
      </div>
      <div className="flex justify-between text-meta text-dim">
        <span>Moderate</span>
        <span>Hot spot</span>
      </div>
      <p className="text-meta text-muted">Below 25% is not painted</p>
    </div>
  );
}

export function Legend({ page, className = '' }: { page: Page; className?: string }) {
  if (page === 'pred') {
    return (
      <Surface as="aside" className={className}>
        <RiskRamp />
      </Surface>
    );
  }

  return (
    <Surface as="aside" className={className}>
      <ul className="flex flex-col gap-2">
        {STATES.map(({ label, fill, line }) => (
          <li key={label} className="flex items-center gap-3">
            {/*
              The swatch sits on night-900, the background the colour has on the map.
              The fills carry alpha: over the light card the same token would produce a
              different colour and the key would stop explaining what is on the ground.
            */}
            <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 bg-night-900">
              <span className={`block h-full w-full border ${fill} ${line}`} />
            </span>
            <span className="text-meta text-dim">{label}</span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
