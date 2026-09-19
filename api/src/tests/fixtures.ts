import type { Scenario, TerrainCell } from "../types";

/**
 * A small 5x5 all-FOREST grid with a single ignition cell at the center,
 * calm wind, and no resources/vulnerable areas by default. Every test
 * overrides only what it actually cares about.
 */
export function buildScenario(overrides: Partial<Scenario> = {}): Scenario {
  const size = 5;
  const terrain: TerrainCell[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      terrain.push({ position: { x, y }, type: "FOREST", slope: 0, initialFuel: 1 });
    }
  }

  return {
    id: "test-scenario",
    name: "Test scenario",
    mapWidth: size,
    mapHeight: size,
    terrain,
    infrastructure: { vulnerableAreas: [] },
    initialFire: { ignitionCells: [{ x: 2, y: 2 }], initialIntensity: 0.8 },
    initialEnvironment: { temperature: 30, humidity: 0.2, wind: { speed: 0, direction: 0 } },
    initialResources: [],
    mission: { timeLimitMinutes: 120, maxBurnedAreaHa: 100 },
    ...overrides,
  };
}
