/**
 * The operator's decision log (spec.md §5.4): accepting or dismissing changes the
 * action's state and stamps it with the time. That log is exactly what a coordinator
 * needs afterwards, so it is kept even though no backend receives it yet.
 */
export interface Decision {
  status: 'accepted' | 'rejected';
  at: string; // ISO
}

/** An action belongs to an analysis, not to the system: the key carries both ids. */
export const decisionKey = (targetId: string, actionId: string) => `${targetId}:${actionId}`;
