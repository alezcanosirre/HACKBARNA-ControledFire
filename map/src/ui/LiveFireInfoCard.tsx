import type { LiveFireSummary } from '../live/types';
import { int, num } from './format';
import { Surface } from './Surface';

/**
 * `time()` in format.ts is deliberately 24h/en-GB for the rest of the app (a control
 * room reads a 24h clock, see that file's comment) — this card is the one place that
 * departs from it, because it is showing a raw satellite timestamp to whoever clicked
 * the map, not a simulated run, and 12h with AM/PM reads faster for that audience.
 */
const DETECTION_TIME = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function detectedAt(iso: string): string {
  return DETECTION_TIME.format(new Date(iso));
}

/** Deepfire's raw source codes, spelled out. Falls back to the code itself for
 * anything not in this list rather than hiding it. */
const SOURCE_LABELS: Record<string, string> = {
  VIIRS_NOAA20_NRT: 'VIIRS satellite (NOAA-20)',
  VIIRS_NOAA21_NRT: 'VIIRS satellite (NOAA-21)',
  MTG_I1: 'MTG satellite (geostationary)',
};

function sourceLabel(source: string | null): string {
  if (!source) return 'unknown source';
  return SOURCE_LABELS[source] ?? source;
}

const CONFIDENCE_LABELS: Record<LiveFireSummary['confidence'] & string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

/**
 * The info card for a fire clicked on the live Deepfire feed — a different shape from
 * FireInfoCard's, on purpose. That one fills its panel from a mock `Fire` (place, zone,
 * spread, values at risk) because none of those exist for a real detection today (see
 * the conversation: Deepfire has no weather, no land-cover, no values-at-risk endpoint
 * yet). Showing a live fire through FireInfoCard would mean inventing those fields, and
 * this codebase's rule everywhere else is: no data, no field. So this card is shorter
 * and only states what Deepfire actually gave us.
 *
 * The one exception is the weather block, and it is not an exception to the rule: it is
 * real, it just does not come from Deepfire. met.no gives the conditions over the fire's
 * centroid right now (api/src/live/weather.ts), which is the same source PRED uses —
 * there for the worst moment of the next 24 h, here for this minute, because a fire
 * burning now is described by the weather now.
 */
export function LiveFireInfoCard({ fire }: { fire: LiveFireSummary }) {
  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="p-4">
        {/*
          The place is the title, the same as it is on an exercise case (FireInfoCard).
          Deepfire gives no name — this is the nearest municipal seat to the centroid
          (api/src/live/placeName.ts), and the exact coordinates stay in the grid below:
          the name is for saying it out loud, the numbers are what you act on.

          "Active detection" only survives as the fallback, for a fire too far from any
          municipality to name — out at sea, in practice. As a permanent heading it spent
          the most visible line of the panel restating what the panel is.
        */}
        <h1 className="text-heading font-semibold text-text">
          {fire.place ?? 'Active detection'}
        </h1>
      </header>

      {fire.areaHa !== null && (
        <div className="flex items-baseline gap-2 p-4">
          <span className="text-display text-text">{num(fire.areaHa)}</span>
          <span className="text-meta text-muted">ha (satellite perimeter)</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4">
        <div>
          <span className="block text-meta text-muted">Detected since</span>
          <span className="text-body text-text">{detectedAt(fire.firstObserved)}</span>
        </div>
        <div>
          <span className="block text-meta text-muted">Last seen</span>
          <span className="text-body text-text">{detectedAt(fire.lastObserved)}</span>
        </div>
        <div>
          <span className="block text-meta text-muted">Detected by</span>
          <span className="text-body text-text">{sourceLabel(fire.source)}</span>
        </div>
        {fire.confidence && (
          <div>
            <span className="block text-meta text-muted">Confidence</span>
            <span className="text-body text-text">{CONFIDENCE_LABELS[fire.confidence]}</span>
          </div>
        )}
        {fire.fireRadiativePowerMw !== null && (
          <div>
            <span className="block text-meta text-muted">Radiative power</span>
            <span className="text-body text-text">{fire.fireRadiativePowerMw.toFixed(1)} MW</span>
          </div>
        )}
        {fire.perimeterM !== null && (
          <div>
            <span className="block text-meta text-muted">Perimeter</span>
            <span className="text-body text-text">{int(fire.perimeterM)} m</span>
          </div>
        )}
        {fire.nHotspots !== null && (
          <div>
            <span className="block text-meta text-muted">Detections used for perimeter</span>
            <span className="text-body text-text">{int(fire.nHotspots)}</span>
          </div>
        )}
        <div>
          <span className="block text-meta text-muted">Location</span>
          <span className="text-body text-text">
            {fire.centroid.lat.toFixed(4)}, {fire.centroid.lng.toFixed(4)}
          </span>
        </div>
        {fire.wind !== null && (
          <div>
            <span className="block text-meta text-muted">Wind (simulation avg.)</span>
            <span className="text-body text-text">
              {num(fire.wind.speedMs * 3.6)} km/h · {int(fire.wind.directionDeg)}°
            </span>
          </div>
        )}
      </div>

      {/* Conditions over the fire right now, from met.no. Deepfire has no weather. */}
      {fire.weather !== null && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4">
          <div>
            <span className="block text-meta text-muted">Temperature</span>
            <span className="text-body text-text">{num(fire.weather.temperatureC)} °C</span>
          </div>
          <div>
            <span className="block text-meta text-muted">Humidity</span>
            <span className="text-body text-text">{int(fire.weather.humidityPct)} %</span>
          </div>
          <div className="col-span-2">
            <span className="block text-meta text-muted">Wind now</span>
            <span className="text-body text-text">
              {num(fire.weather.windSpeedKmh)} km/h from {int(fire.weather.windDirectionDeg)}°
            </span>
          </div>
        </div>
      )}
    </Surface>
  );
}
