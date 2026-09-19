import type { LiveFireSummary } from '../live/types';
import { int, num, time } from './format';
import { SectionLabel, Surface } from './Surface';

/**
 * The info card for a fire clicked on the live Deepfire feed — a different shape from
 * FireInfoCard's, on purpose. That one fills its panel from a mock `Fire` (place, zone,
 * spread, values at risk) because none of those exist for a real detection today (see
 * the conversation: Deepfire has no weather, no land-cover, no values-at-risk endpoint
 * yet). Showing a live fire through FireInfoCard would mean inventing those fields, and
 * this codebase's rule everywhere else is: no data, no field. So this card is shorter
 * and only states what Deepfire actually gave us.
 */
export function LiveFireInfoCard({ fire }: { fire: LiveFireSummary }) {
  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="p-4">
        <h1 className="text-heading font-semibold text-text">Active detection</h1>
        <p className="mt-1 text-meta text-muted">
          {time(fire.lastObserved)} · {fire.source ?? 'unknown source'}
          {fire.confidence ? ` · ${fire.confidence.toLowerCase()} confidence` : ''}
        </p>
      </header>

      <div className="flex items-baseline gap-2 p-4">
        {fire.areaHa !== null ? (
          <>
            <span className="text-display text-text">{num(fire.areaHa)}</span>
            <span className="text-meta text-muted">ha (satellite perimeter)</span>
          </>
        ) : (
          <>
            <span className="text-display text-text">{int(fire.cellIds.length)}</span>
            <span className="text-meta text-muted">
              {fire.cellIds.length === 1 ? 'cell burning' : 'cells burning'}
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4">
        <div>
          <span className="block text-meta text-muted">Detected since</span>
          <span className="text-body text-text">{time(fire.firstObserved)}</span>
        </div>
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
            <span className="block text-meta text-muted">Detections used</span>
            <span className="text-body text-text">{int(fire.nHotspots)}</span>
          </div>
        )}
      </div>

      {fire.areaHa !== null && (
        <div className="p-4">
          <SectionLabel>Cells burning</SectionLabel>
          <p className="mt-1 text-body text-text">{int(fire.cellIds.length)}</p>
        </div>
      )}
    </Surface>
  );
}
