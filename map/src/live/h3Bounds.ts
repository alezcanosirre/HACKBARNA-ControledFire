import { cellToBoundary } from 'h3-js';

/**
 * The bounding box of a set of H3 cells, in the [[west, south], [east, north]] shape
 * `focusOn` (src/map/view.ts) expects.
 *
 * A simulated fire carries its own bounds because the Engine knows its grid
 * (engine/anchor.ts). A real one does not: what arrives from the proxy is a list of H3
 * cell ids and a centroid, so the extent has to be derived here before the camera can
 * frame it. Without this, selecting a real fire opened its panel and left the camera
 * where it was — the click looked like it had missed.
 *
 * The extent comes from the cell BOUNDARIES, not from their centres: a one-cell fire
 * has no extent between centres, and fitBounds on a zero-size box gives an absurd zoom.
 */
export function boundsForH3Cells(
  cellIds: readonly string[],
): [[number, number], [number, number]] | null {
  if (cellIds.length === 0) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const cellId of cellIds) {
    // cellToBoundary gives [lat, lng] pairs; the map works in [lng, lat].
    for (const [lat, lng] of cellToBoundary(cellId)) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }

  if (!Number.isFinite(west) || !Number.isFinite(south)) return null;

  return [
    [west, south],
    [east, north],
  ];
}
