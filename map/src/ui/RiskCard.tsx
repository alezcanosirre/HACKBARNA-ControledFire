import type { Prediction } from '../mocks/types';
import { int, time } from './format';
import { SectionLabel, Surface } from './Surface';

const FACTOR: Record<string, string> = {
  wind_speed: 'Wind',
  fuel_dryness: 'Dryness',
  fuel_load: 'Fuel load',
  temperature: 'Temperature',
  slope: 'Slope',
  history: 'History',
};

const factorLabel = (factor: string) =>
  FACTOR[factor] ?? factor.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * The detail card of PRED (UX.md §7). Same architecture as ACTUAL's, different content:
 *
 *  1. The percentage, in display. It is the figure the operator came to see.
 *  2. Underneath, the why. The AI's text, and then the factors with their weight as a
 *     bar. Without this section the number is not actionable — it is just a number.
 *
 * The bars use --muted, never the warm ramp. The risk is already painted on the map;
 * repeating the palette here devalues it (UX.md §7). And nothing beats on this page:
 * the pulse belongs to real fire, and a risk is not an emergency.
 */
export interface RiskAnalysis {
  readonly summary: string | null;
  readonly model: string | null;
  readonly generatedAt: string;
}

export function RiskCard({
  prediction,
  analysis,
}: {
  prediction: Prediction;
  /**
   * The model's read of the whole area, under the per-cell detail. It sits at the bottom
   * because it is context, not the answer: the operator came for this cell's number and
   * gets the area's picture once they have it.
   */
  analysis?: RiskAnalysis;
}) {
  const percent = Math.round(prediction.risk_score * 100);
  // Heaviest first: the bar chart is a ranking, so it should read as one.
  const drivers = [...prediction.drivers].sort((a, b) => b.contribution - a.contribution);

  return (
    <div className="flex flex-col gap-2">
      <Surface padded={false} className="divide-y divide-line">
        <header className="p-4">
          <h1 className="text-heading font-semibold text-text">{prediction.place}</h1>
          <p className="mt-1 text-meta text-muted">
            forecast · next {int(prediction.horizon_h)} h
          </p>
        </header>

        <div className="p-4">
          <SectionLabel>Risk</SectionLabel>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-display text-text">{percent}%</span>
            <span className="text-meta text-muted">next {int(prediction.horizon_h)} h</span>
          </div>
        </div>

        <section className="p-4">
          <SectionLabel>Analysis</SectionLabel>
          <p className="mt-2 text-body text-dim">{prediction.rationale}</p>
        </section>

        <section className="flex flex-col gap-3 p-4">
          <SectionLabel>Drivers</SectionLabel>
          <ul className="flex flex-col gap-2">
            {drivers.map((driver) => (
              <li key={driver.factor} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-label">
                  <span className="text-text">{factorLabel(driver.factor)}</span>
                  <span className="shrink-0 text-meta text-muted">{driver.value}</span>
                </div>
                {/*
                  The weight as a bar, in --muted. A number between 0 and 1 means nothing
                  read aloud; the length of the bar is the comparison, which is the whole
                  point of listing the factors together.
                */}
                <div
                  role="img"
                  aria-label={`${factorLabel(driver.factor)}: ${Math.round(driver.contribution * 100)}% weight`}
                  className="h-1.5 w-full overflow-hidden rounded-sm bg-surface-2"
                >
                  <div
                    className="h-full rounded-sm bg-muted"
                    style={{ width: `${Math.round(driver.contribution * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/*
          The area, not the cell. Only rendered when the model actually wrote one — with
          the heuristic in use there is no analysis, and inventing a paragraph to fill
          the space would be the one thing this card must not do.
        */}
        {analysis?.summary && (
          <section className="p-4">
            <SectionLabel>Area analysis</SectionLabel>
            <p className="mt-2 text-body text-dim">{analysis.summary}</p>
            {analysis.model && (
              <p className="mt-2 text-meta text-muted">
                {analysis.model} · {time(analysis.generatedAt)}
              </p>
            )}
          </section>
        )}
      </Surface>
    </div>
  );
}
