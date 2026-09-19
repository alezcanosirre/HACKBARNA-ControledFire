import type { ActionRecommendation } from '../live/types';
import { time } from './format';
import { SectionLabel, Surface } from './Surface';

/**
 * Mirrors api/src/live/actionCatalog.ts's titles — only the titles, never the full
 * description/whenToPropose/limitation, which stay server-side prompt material. The
 * backend already resolves `recommendedAction.title` for us; this map exists only to
 * label `complementaryActionIds`, which the contract sends as bare ids ("A02") with no
 * text of their own. Same duplication-on-purpose as the types in live/types.ts.
 */
const ACTION_TITLES: Record<string, string> = {
  A01: 'Verificar el aviso',
  A02: 'Realizar reconocimiento y evaluar seguridad',
  A03: 'Evaluar exposición de personas e infraestructuras',
  A04: 'Establecer el plan de intervención y los recursos',
  A05: 'Mantener seguimiento y reevaluar el plan',
};

/**
 * The actions panel for a real Deepfire detection — a different shape from ActionsCard's
 * on purpose, the same way LiveFireInfoCard departs from FireInfoCard. That one renders a
 * ranked list because the mock `AIAnalysis` contract carries one (spec.md §6.4); the real
 * contract (api/src/live/actionRecommendation.ts) deliberately proposes at most ONE
 * priority action, grounded only in what Deepfire actually gave us, plus optional
 * complementary ids with no invented urgency, ETA or resources attached to them.
 *
 * `status` decides the layout: "recommended" has an action to show, "insufficient_data"
 * says plainly what's missing instead of guessing, and "unavailable" means Nebius (or the
 * key) couldn't be reached — the summary already says so without pretending otherwise.
 */
export function LiveActionsCard({ recommendation }: { recommendation: ActionRecommendation }) {
  const { status, recommendedAction, complementaryActionIds, missingData, limitations } =
    recommendation;

  return (
    <Surface padded={false} className="divide-y divide-line">
      <header className="flex items-baseline justify-between gap-4 p-4">
        <SectionLabel>Actions</SectionLabel>
        <span className="text-meta text-muted">AI proposal</span>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-body text-dim">{recommendation.summary}</p>

        {status === 'recommended' && recommendedAction && (
          <div>
            <p className="text-body font-medium text-text">{recommendedAction.title}</p>
            <p className="mt-1 text-body text-dim">{recommendedAction.reason}</p>
            {recommendedAction.evidence.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {recommendedAction.evidence.map((item, i) => (
                  <li key={i} className="flex gap-2 text-meta text-muted">
                    <span aria-hidden="true">▸</span>
                    <span>{item.explanation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {complementaryActionIds.length > 0 && (
          <div>
            <span className="block text-meta text-muted">Also consider</span>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {complementaryActionIds.map((id) => (
                <li
                  key={id}
                  className="rounded-sm border border-line bg-surface-2 px-2 py-1 text-meta text-dim"
                >
                  {ACTION_TITLES[id] ?? id}
                </li>
              ))}
            </ul>
          </div>
        )}

        {missingData.length > 0 && (
          <div>
            <span className="block text-meta text-muted">Missing data</span>
            <ul className="mt-1 flex flex-col gap-1">
              {missingData.map((item, i) => (
                <li key={i} className="flex gap-2 text-meta text-dim">
                  <span aria-hidden="true">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {limitations.length > 0 && (
          <ul className="flex flex-col gap-1">
            {limitations.map((item, i) => (
              <li key={i} className="text-meta text-muted">
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* No model attribution here — the contract deliberately never names which
          provider (or whether a fallback) produced this, see actionRecommendation.ts.
          `requiresHumanReview` is always true on this contract: it is a proposal for a
          human commander to weigh, never an instruction executed on its own. */}
      <footer className="p-4 text-meta text-muted">
        Requires human review · {time(recommendation.generatedAt)}
      </footer>
    </Surface>
  );
}
