import type { ReactNode } from 'react';

import type { Fire } from '../mocks/types';
import { DownwindIcon } from './icons';
import { FUEL_LOAD, LAND_COVER, VALUE_TYPE, int, num, time } from './format';
import { SectionLabel, Surface } from './Surface';

/**
 * An arrow pointing where the air is going, not where it comes from. `wind_dir_deg` is
 * meteorological (the direction it blows FROM), so 180° are added. At rest the arrow
 * points north.
 *
 * UX.md §5: wind is drawn as a rotated arrow, never as "210°". An operator reads an
 * arrow at a glance; a bearing has to be translated first.
 */
function Arrow({ deg, label }: { deg: number; label: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      role="img"
      aria-label={label}
      className="h-4 w-4 shrink-0"
      style={{ transform: `rotate(${deg}deg)` }}
    >
      <path
        d="M8 14V2.8M8 2.8 4.4 6.4M8 2.8l3.6 3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 text-label text-dim">{children}</div>;
}

/**
 * The information card of UX.md §5, in the order of spec.md §5.2: who and when, the
 * big number, the conditions and what is at risk. Never the raw cell_id.
 */
export function FireInfoCard({
  fire,
  live,
}: {
  fire: Fire;
  /**
   * What the Engine actually knows, when a simulation is running. Everything here
   * overrides the mock: showing 27 km/h of mocked wind next to a fire spreading at the
   * Engine's 25 would be two different fires on one card.
   *
   * What is NOT here stays mocked because the Engine has no model for it: the place
   * name, the detection source, and the values at risk (it has vulnerable areas, but
   * no type, population or distance). And `spread` is out of its contract on purpose —
   * `FireCell` says the rates are internal — so the live run shows the size of the
   * active front instead, which is a real number.
   */
  live?: {
    areaHa: number;
    minutes: number;
    burningCells: number;
    weather: { temp_c: number; humidity_pct: number; wind_speed_kmh: number; wind_dir_deg: number };
  };
}) {
  const { spread, zone } = fire;
  const weather = live?.weather ?? fire.weather;

  // Downwind first: that is what decides an evacuation. Ties go to whatever is closest.
  const atRisk = [...fire.values_at_risk].sort(
    (a, b) => Number(b.downwind) - Number(a.downwind) || a.distance_km - b.distance_km,
  );

  return (
    <div className="flex flex-col gap-2">
      <Surface padded={false} className="divide-y divide-line">
        <header className="p-4">
          <h1 className="text-heading font-semibold text-text">{fire.place}</h1>
          <p className="mt-1 text-meta text-muted">
            {/*
              A simulation has no wall clock and no detection source: what it has is
              elapsed simulated time. Showing 14:32 next to a running Engine would be a
              lie, so the live run says how long it has been burning instead.
            */}
            {live
              ? `t+${int(live.minutes)} min · simulation`
              : `${time(fire.detected_at)} · ${fire.source} · ${Math.round(fire.confidence * 100)}% confidence`}
          </p>
        </header>

        {/* The number the panel is opened for (DESIGN.md §2: display, only here). */}
        <div className="flex items-baseline gap-2 p-4">
          <span className="text-display text-text">{num(live?.areaHa ?? fire.area_ha)}</span>
          <span className="text-meta text-muted">ha affected</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4">
          <Row>
            <Arrow deg={weather.wind_dir_deg + 180} label="Wind direction" />
            <span className="text-text">{num(weather.wind_speed_kmh)} km/h</span>
          </Row>
          <Row>
            <span className="text-muted">Temp</span>
            <span className="text-text">{num(weather.temp_c)} °C</span>
          </Row>
          <Row>
            <span className="text-muted">RH</span>
            <span className="text-text">{int(weather.humidity_pct)} %</span>
          </Row>
          <Row>
            {live ? (
              <>
                <span className="text-muted">Front</span>
                <span className="text-text">{int(live.burningCells)} cells</span>
              </>
            ) : (
              <>
                <Arrow deg={spread.direction_deg} label="Spread direction" />
                <span className="text-text">{num(spread.speed_kmh)} km/h</span>
              </>
            )}
          </Row>
        </div>

        <section className="flex flex-col gap-3 p-4">
          <SectionLabel>At risk</SectionLabel>
          <ul className="flex flex-col gap-2">
            {atRisk.map((v) => (
              <li key={v.name} className="flex items-start gap-2">
                {/*
                  Whatever sits downwind gets a mark of its own: the warning glyph and
                  the name in --text instead of --text-dim. That is what turns "there is
                  a school nearby" into "evacuate that school now" (spec §6.2, UX §5).
                */}
                <span className={`mt-0.5 ${v.downwind ? 'text-text' : 'text-transparent'}`}>
                  <DownwindIcon />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-label ${v.downwind ? 'font-medium text-text' : 'text-dim'}`}
                  >
                    {v.name}
                  </span>
                  <span className="block text-meta text-muted">
                    {VALUE_TYPE[v.type]} · {num(v.distance_km)} km
                    {v.population !== undefined && ` · ${int(v.population)} people`}
                    {v.downwind && ' · downwind'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </Surface>

      {/* The zone pills, outside the card, as on the whiteboard. */}
      <ul className="flex flex-wrap gap-2">
        {[
          LAND_COVER[zone.land_cover],
          FUEL_LOAD[zone.fuel_load],
          `${int(zone.slope_deg)}° slope`,
        ].map((pill) => (
          <li
            key={pill}
            className="pointer-events-auto rounded-sm border border-line bg-surface/92 px-2 py-1 text-meta text-dim backdrop-blur-sm"
          >
            {pill}
          </li>
        ))}
      </ul>
    </div>
  );
}
