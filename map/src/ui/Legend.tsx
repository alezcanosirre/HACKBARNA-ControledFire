import { riskFill } from '../pred/risk';
import type { Page } from './route';
import { Surface } from './Surface';

/**
 * The legend of UX.md §4, bottom left next to the menu: the five cell states of
 * spec.md §4.7.
 *
 * The warm colours here are the ones the map paints, and this is the only place in the
 * interface where they appear: the legend is not decoration, it is the key to the data.
 * That is why each swatch sits on the dark map background and not on the light card.
 *
 * Note: the map currently paints only NORMAL and BURNING (src/map/colors.ts). The other
 * three states come from the spec, and they are shown because the legend belongs to the
 * spec, not to whatever the layer happens to render today.
 */
const STATES = [
  { label: 'No status', fill: 'bg-transparent', line: 'border-cell-grid/30' },
  { label: 'Watch', fill: 'bg-cell-watch/22', line: 'border-cell-watch-line/45' },
  { label: 'At risk', fill: 'bg-cell-risk/47', line: 'border-cell-risk-line/67' },
  { label: 'Active', fill: 'bg-cell-active/80', line: 'border-cell-active-line/92' },
  { label: 'Contained', fill: 'bg-cell-contained/35', line: 'border-cell-contained-line/51' },
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
