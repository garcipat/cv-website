import type { TileChar } from '../../level/LevelParser';
import { parseLevel } from '../../level/LevelParser';
import type { LevelDef, MarkerGrid, MarkerPlacement } from '../../level/LevelData';
import { cropLayoutToBox, type BoundingBox } from './exportLayout';

/**
 * The one grid→layout adapter. `gridToLayout` serializes
 * the **whole** rectangular editor grid into the raw `readonly string[]` shape
 * `parseLevel`/the runtime finders consume — it is the only editor function
 * that derives raw layout rows from a grid, and it does so through the shared
 * grid-crop primitive (`cropLayoutToBox`), never a local row-serialization
 * loop (contract §2). Leading/trailing empty rows/columns are deliberately
 * kept: the runtime finders scan by character, so cropping is not needed and
 * would only risk shifting columns.
 */
export function gridToLayout(grid: TileChar[][]): readonly string[] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const fullBox: BoundingBox = { minRow: 0, maxRow: height - 1, minCol: 0, maxCol: width - 1 };
  return cropLayoutToBox(grid, fullBox, '.');
}

/**
 * The dense marker grid → sparse stored placements (`MarkerPlacement[]`), the
 * shape `parseLevel`/parse-side reads and a level/blueprint file stores
 *. One placement per non-`null` cell, in reading order.
 */
export function markerGridToPlacements(markers: MarkerGrid): MarkerPlacement[] {
  const placements: MarkerPlacement[] = [];
  for (let row = 0; row < markers.length; row++) {
    for (let col = 0; col < markers[row].length; col++) {
      const marker = markers[row][col];
      if (marker) placements.push({ col, row, marker });
    }
  }
  return placements;
}

/**
 * The editor grid's `LevelDef`, for the preview's terrain/rope-ladder
 * geometry: `parseLevel` over the adapter output.
 *
 * Markers are **always** passed (even `[]`) so `parseLevel`'s `T`-generation
 * rule maps a bare `T` to `'empty'` terrain (the sign character) rather than
 * the pre-feature decorative `stalactite` (contract §2).
 */
export function previewLevelDef(grid: TileChar[][], markers: MarkerGrid): LevelDef {
  return parseLevel(gridToLayout(grid), markerGridToPlacements(markers));
}
