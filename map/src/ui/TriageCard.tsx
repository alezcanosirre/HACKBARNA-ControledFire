import type { IncidentTriage } from '../live/types';
import { clock } from './format';
import { openSelection } from './route';
import { SectionLabel, Surface } from './Surface';

/**
 * Which fire to go to first, when more than one is burning.
 *
 * It answers a different question from LiveActionsCard's, and that is why it is a card
 * of its own rather than a line inside that one: the actions card decides what to do
 * INSIDE an incident and never looks at the others, and this one does nothing but
 * compare them. A commander with three columns of smoke on the map needs both, and they
 * are not the same answer.
 *
 * Hence its place on screen: this is the overview, before anything is selected. Open a
 * fire and this card is gone — with a selection there is only that fire (UX.md §0, rule
 * 2), and the panel that matters is the incident's own.
 *
 * A row is the same click as the fire on the map. It goes through `openSelection`, the
 * same door the map layer uses, so the camera flies to it and the panels open exactly as
 * if it had been clicked out there. The list is a second way into the same place, not a
 * second place.
 */

/**
 * One row's subject: the incident, and what to call it on screen.
 *
 * The card takes this rather than a fire, because the two things it ranks are not the
 * same shape — a real Deepfire detection and an exercise case share no type — and the
 * only thing a row needs from either is an id to open and a line to read. Whoever has
 * both shapes in hand (Shell) is the one who knows how each should be named.
 */
export interface TriageIncident {
  readonly id: string;
  readonly label: string;
}

export function TriageCard({
  triage,
  incidents,
}: {
  triage: IncidentTriage;
  /** What is on screen right now. Only these get a row — see below. */
  incidents: readonly TriageIncident[];
}) {
  /*
   * A poll can land between the model being asked and its answer arriving, and take a
   * fire out of the feed. A row for an incident that is no longer burning would open a
   * panel with nothing in it, so it is dropped here rather than rendered and left dead.
   *
   * The backend already refuses an order that invents or omits an id (ModelResponseError
   * in incidentTriage.ts) — this is not that check repeated, it is the 15 seconds
   * between that check and this render. SIMULATION's three cases never move, so there
   * this filter is simply always a no-op.
   */
  const rows = triage.order
    .map((entry) => ({ entry, incident: incidents.find((i) => i.id === entry.incidentId) }))
    .filter(
      (row): row is { entry: (typeof triage.order)[number]; incident: TriageIncident } =>
        row.incident !== undefined,
    );

  // With one incident left there is no order to show: the comparison is the whole content.
  const ordered = triage.status === 'ranked' && rows.length >= 2;

  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Where to go first</SectionLabel>
        <span className="text-meta text-muted">AI triage</span>
      </header>

      {ordered ? (
        <ul className="divide-y divide-line">
          {rows.map(({ entry, incident }) => (
            <li key={entry.incidentId}>
              <button
                type="button"
                onClick={() => openSelection(entry.incidentId)}
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text"
              >
                {/* The position, and nothing else marking it: the order IS the ranking,
                    so a second badge or colour would be saying it twice. */}
                <span className="w-4 shrink-0 text-label font-medium tabular-nums text-muted">
                  {entry.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-label font-medium text-text">
                    {incident.label}
                  </span>
                  {/* Clamped to two lines, the same two the skeleton reserves. A longer
                      reason is the model's to shorten, not this card's to grow for. */}
                  <span className="mt-1 line-clamp-2 text-meta text-dim">{entry.reason}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        /*
         * Nebius (or the key) could not be reached, and the card says so instead of
         * disappearing. Vanishing after the skeleton reads as a bug; an empty order
         * dressed as a real one would be worse than either — the backend never sends one
         * (see incidentTriage.ts unavailable()).
         */
        <p className="p-4 text-meta text-muted">
          Automatic triage unavailable right now — order these by hand.
        </p>
      )}

      {/* Same footer as the actions card, and for the same reason: this is a proposal a
          human commander weighs, never a dispatch order. */}
      <footer className="p-4 text-meta text-muted">
        {clock(triage.generatedAt)}
      </footer>
    </Surface>
  );
}
