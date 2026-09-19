import type { ReactNode } from 'react';

import type { Fire } from '../mocks/types';
import { DownwindIcon } from './icons';
import { FUEL_LOAD, LAND_COVER, VALUE_TYPE, int, num, time } from './format';
import { SectionLabel, Surface } from './Surface';

/**
 * Flecha que apunta a donde va el aire, no a de dónde viene. `wind_dir_deg` es
 * meteorológico (dirección de PROCEDENCIA), así que se le suman 180°. La flecha en
 * reposo apunta al norte.
 *
 * UX.md §5: el viento se dibuja como flecha girada, nunca como «210°». Un operador lee
 * una flecha de un vistazo; un acimut hay que traducirlo.
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
 * Tarjeta de información de UX.md §5, en el orden de spec.md §5.2: quién y cuándo,
 * el número grande, las condiciones y lo que hay en riesgo. Nunca el cell_id en crudo.
 */
export function FireInfoCard({ fire }: { fire: Fire }) {
  const { weather, spread, zone } = fire;

  // Lo de sotavento primero: es lo que decide la evacuación. A igualdad, lo más cerca.
  const atRisk = [...fire.values_at_risk].sort(
    (a, b) => Number(b.downwind) - Number(a.downwind) || a.distance_km - b.distance_km,
  );

  return (
    <div className="flex flex-col gap-2">
      <Surface padded={false} className="divide-y divide-night-700">
        <header className="p-4">
          <h1 className="text-heading font-semibold text-text">{fire.place}</h1>
          <p className="mt-1 text-meta text-muted">
            {time(fire.detected_at)} · {fire.source} · confianza{' '}
            {Math.round(fire.confidence * 100)}%
          </p>
        </header>

        {/* El número por el que se abre el panel (DESIGN.md §2: display, solo aquí). */}
        <div className="flex items-baseline gap-2 p-4">
          <span className="text-display text-text">{num(fire.area_ha)}</span>
          <span className="text-meta text-muted">ha afectadas</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4">
          <Row>
            <Arrow deg={weather.wind_dir_deg + 180} label="Dirección del viento" />
            <span className="text-text">{num(weather.wind_speed_kmh)} km/h</span>
          </Row>
          <Row>
            <span className="text-muted">Temp.</span>
            <span className="text-text">{num(weather.temp_c)} °C</span>
          </Row>
          <Row>
            <span className="text-muted">HR</span>
            <span className="text-text">{int(weather.humidity_pct)} %</span>
          </Row>
          <Row>
            <Arrow deg={spread.direction_deg} label="Dirección de propagación" />
            <span className="text-text">{num(spread.speed_kmh)} km/h</span>
          </Row>
        </div>

        <section className="flex flex-col gap-3 p-4">
          <SectionLabel>En riesgo</SectionLabel>
          <ul className="flex flex-col gap-2">
            {atRisk.map((v) => (
              <li key={v.name} className="flex items-start gap-2">
                {/*
                  Lo que está a sotavento lleva marca propia: el aviso y el nombre en
                  --text en vez de --text-dim. Es lo que convierte «hay un colegio
                  cerca» en «evacuar ese colegio ya» (spec §6.2, UX §5).
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
                    {v.population !== undefined && ` · ${int(v.population)} personas`}
                    {v.downwind && ' · a sotavento'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </Surface>

      {/* Las pastillas de zona, fuera de la tarjeta, como en la pizarra. */}
      <ul className="flex flex-wrap gap-2">
        {[
          LAND_COVER[zone.land_cover],
          FUEL_LOAD[zone.fuel_load],
          `pendiente ${int(zone.slope_deg)}°`,
        ].map((pill) => (
          <li
            key={pill}
            className="pointer-events-auto rounded-sm border border-night-700 bg-night-800/92 px-2 py-1 text-meta text-dim backdrop-blur-sm"
          >
            {pill}
          </li>
        ))}
      </ul>
    </div>
  );
}
