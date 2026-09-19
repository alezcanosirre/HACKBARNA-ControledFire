import type { LiveFireDetail } from '../live/groupFires';
import { int, time } from './format';
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
export function LiveFireInfoCard({ fire }: { fire: LiveFireDetail }) {
  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="p-4">
        <h1 className="text-heading font-semibold text-text">Active detection</h1>
        <p className="mt-1 text-meta text-muted">
          {fire.detectedAt
            ? `${time(fire.detectedAt)} · ${fire.source ?? 'unknown source'}${
                fire.confidence ? ` · ${fire.confidence.toLowerCase()} confidence` : ''
              }`
            : 'Detection time unknown'}
        </p>
      </header>

      <div className="flex items-baseline gap-2 p-4">
        <span className="text-display text-text">{int(fire.cellIds.length)}</span>
        <span className="text-meta text-muted">
          {fire.cellIds.length === 1 ? 'cell burning' : 'cells burning'}
        </span>
      </div>

      {fire.fireRadiativePowerMw !== null && (
        <div className="flex items-center justify-between p-4">
          <SectionLabel>Radiative power</SectionLabel>
          <span className="text-body text-text">{fire.fireRadiativePowerMw.toFixed(1)} MW</span>
        </div>
      )}
    </Surface>
  );
}
