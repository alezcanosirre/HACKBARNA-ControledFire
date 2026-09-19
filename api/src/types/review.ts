import type { Outcome } from "./outcome";

/**
 * After-action review: like Strategy but looking backward instead of
 * forward — critiques a finished (or finishing) run instead of proposing
 * one. Purely AI-authored content: the Engine only defines its shape,
 * same as Strategy; nothing here is computed by step() or any other
 * Engine function.
 */
export interface Review {
  readonly id: string;
  readonly title: string;
  readonly outcome: Outcome;
  readonly summary: string;
  readonly whatWentWell: readonly string[];
  readonly whatToImprove: readonly string[];
}
