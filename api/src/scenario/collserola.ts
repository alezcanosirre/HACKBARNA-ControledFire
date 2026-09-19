import type { Position, Scenario, TerrainCell } from "../types";

/**
 * Stylized Collserola scenario — NOT real GPS coordinates. `Position` here
 * is a local {x,y} grid (see api/spec.md); anchoring it to a real spot on
 * the map (lat/lng of local (0,0)) is a separate, still-open integration
 * step with the map/ side.
 *
 * Layout: a forested ridge through the middle (steeper slope near the
 * center rows), Sant Cugat del Vallès in the NW corner, Vallvidrera/
 * Barcelona in the SE corner, and the road that historically cuts through
 * the park running as a diagonal between them.
 */
const WIDTH = 20;
const HEIGHT = 15;

function isSantCugat(position: Position): boolean {
  return position.x < 4 && position.y < 4;
}

function isVallvidrera(position: Position): boolean {
  return position.x > WIDTH - 6 && position.y > HEIGHT - 5;
}

function isRoad(position: Position): boolean {
  return Math.abs(position.x / WIDTH - position.y / HEIGHT) < 0.04;
}

function buildTerrain(): TerrainCell[] {
  const cells: TerrainCell[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const position: Position = { x, y };

      if (isSantCugat(position) || isVallvidrera(position)) {
        cells.push({ position, type: "URBAN", slope: 0.1, initialFuel: 0.3 });
        continue;
      }
      if (isRoad(position)) {
        cells.push({ position, type: "ROAD", slope: 0.1, initialFuel: 0 });
        continue;
      }

      const distanceFromRidge = Math.abs(y - HEIGHT / 2);
      const slope = Math.min(1, Math.max(0.1, 0.8 - distanceFromRidge * 0.15));
      cells.push({ position, type: "FOREST", slope, initialFuel: 0.9 });
    }
  }
  return cells;
}

const terrain = buildTerrain();

/**
 * Balance, checked with a crude "attack the hottest burning cell" playtest
 * (see api/src/tests/collserola.test.ts): doing nothing loses (~95min,
 * ~43ha burned); reacting within ~10-15min of the ignition is enough to
 * put it out; waiting 20min+ to react is already too late for this
 * roster. That gives a real decision window instead of an always-win or
 * always-lose scenario.
 */
export const collserolaScenario: Scenario = {
  id: "collserola-v1",
  name: "Incendio en Collserola",
  mapWidth: WIDTH,
  mapHeight: HEIGHT,
  terrain,
  infrastructure: {
    vulnerableAreas: [
      {
        id: "sant-cugat",
        name: "Sant Cugat del Vallès",
        cells: terrain.filter((c) => isSantCugat(c.position)).map((c) => c.position),
      },
      {
        id: "vallvidrera",
        name: "Vallvidrera",
        cells: terrain.filter((c) => isVallvidrera(c.position)).map((c) => c.position),
      },
    ],
  },
  initialFire: { ignitionCells: [{ x: 6, y: 10 }], initialIntensity: 0.6 },
  // Hot, dry, windy — wind FROM the NW blows the fire SE, towards Vallvidrera.
  initialEnvironment: { temperature: 32, humidity: 0.15, wind: { speed: 25, direction: 315 } },
  initialResources: [
    { id: "brigade-sant-cugat", name: "Brigada Sant Cugat", type: "BRIGADE", startPosition: { x: 2, y: 2 }, effectiveness: 0.6 },
    { id: "brigade-vallvidrera", name: "Brigada Vallvidrera", type: "BRIGADE", startPosition: { x: 17, y: 12 }, effectiveness: 0.6 },
    { id: "truck-1", name: "Autobomba 1", type: "TRUCK", startPosition: { x: 4, y: 6 }, effectiveness: 0.5 },
    { id: "truck-2", name: "Autobomba 2", type: "TRUCK", startPosition: { x: 14, y: 8 }, effectiveness: 0.5 },
    { id: "heli-1", name: "Helicóptero 1", type: "HELICOPTER", startPosition: { x: 10, y: 7 }, effectiveness: 0.9 },
    // POLICE/DRONE have no fire-suppression mechanic yet (see calculateOutcome.ts /
    // resources/deployResource.ts) — effectiveness 0 so deploying them is a safe no-op.
    { id: "police-1", name: "Policía 1", type: "POLICE", startPosition: { x: 15, y: 11 }, effectiveness: 0 },
    { id: "drone-1", name: "Dron 1", type: "DRONE", startPosition: { x: 10, y: 5 }, effectiveness: 0 },
  ],
  mission: { timeLimitMinutes: 180, maxBurnedAreaHa: 40 },
};
