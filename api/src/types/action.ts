import type { Position, ResourceId } from "./common";

/**
 * An Action is the user's (or an AI Strategy step's) INTENT, never its
 * result. Deliberately no cost, cooldown or success field on any variant —
 * that is Engine logic, decided inside `step()`, not part of the request.
 */
export type Action =
  | { readonly type: "WAIT"; readonly minutes: number }
  | {
      readonly type: "DEPLOY_RESOURCE";
      readonly resourceId: ResourceId;
      readonly target: Position;
    }
  | {
      readonly type: "CREATE_FIREBREAK";
      readonly target: readonly Position[];
    };
