import type { ResourceState, SimMinutes } from "../../types";

/** Flips any BUSY resource back to AVAILABLE once the clock passes its busyUntil. */
export function recoverResources(
  resources: readonly ResourceState[],
  currentTime: SimMinutes,
): ResourceState[] {
  return resources.map((resource) =>
    resource.status === "BUSY" && resource.busyUntil !== null && resource.busyUntil <= currentTime
      ? { ...resource, status: "AVAILABLE", busyUntil: null }
      : resource,
  );
}
