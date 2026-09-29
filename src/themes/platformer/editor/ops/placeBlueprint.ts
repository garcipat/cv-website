import { type GrowResult } from './growGrid';
import { stampGridCells, type GridCell } from './paintGrid';
import { importMarkerGrid } from './importLayout';
import type { BlueprintCell } from './blueprintCells';
import type { Blueprint } from '../../level/BlueprintData';
import type { MarkerEntry, MarkerGrid } from '../../level/LevelData';
import type { BackgroundChar, TileChar } from '../../level/LevelParser';

/** Same shape `paintCell` returns, deliberately: a placement is just a bigger
 * paint as far as `LevelEditorPage` is concerned, so it flows through the same
 * grow/shift bookkeeping (`applyGrowthShift`) a single painted cell does. */
export type PlacementResult = GrowResult<TileChar>;

/**
 * Stamps a blueprint's `cells` into `grid`, anchored so the blueprint's own
 * cell `(0,0)` lands on `(anchorRow, anchorCol)`.
 *
 * Two grows, then one bulk write — NOT a loop over `paintCell`. Each
 * `paintCell` may grow the grid, and a leftward/upward growth prepends
 * rows/columns and renumbers every existing index, so cells written after the
 * first growth would land in the wrong place. Growing once for the placement's
 * minimum corner and once for its maximum (in the already-grown grid's own
 * coordinates) settles the geometry before anything is written. The second call
 * is not redundant: after the first, a placement extending past the right or
 * bottom edge is still out of bounds.
 *
 * The caller checks `blueprintFits` first — this function trusts its anchor and
 * overwrites whatever is there, exactly the way `paintCell` does.
 */
export const placeBlueprint = (
  grid: TileChar[][],
  cells: readonly BlueprintCell[],
  anchorCol: number,
  anchorRow: number,
): PlacementResult =>
  stampGridCells(
    grid,
    cells.map(({ row, col, char }) => ({
      col: anchorCol + col,
      row: anchorRow + row,
      value: char,
    })),
    '.',
    true,
  );

/**
 * Every marker a blueprint carries, relative to the room's own top-left corner
 * — its stored `markers` field merged over any legacy marker characters still
 * in `layout`, via the same `importMarkerGrid` the editor's load path
 * uses. `blueprintCells` deliberately stays terrain-only; this is the marker
 * analogue a placement stamps alongside it.
 */
export function blueprintMarkers(
  blueprint: Blueprint,
): readonly { row: number; col: number; marker: MarkerEntry }[] {
  const grid = importMarkerGrid(blueprint.layout, blueprint.markers);
  const placements: { row: number; col: number; marker: MarkerEntry }[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const marker = grid[row][col];
      if (marker) placements.push({ row, col, marker });
    }
  }
  return placements;
}

/**
 * Stamps a blueprint's markers into `markers` at the placement's anchor,
 * replacing whatever marker was there. The level marker grid
 * may be smaller than the placement's extent (a level with no markers starts
 * empty, and a right/down growth appends terrain without touching it), so the
 * grid is padded with `null` to fit; it never triggers a `GrowthShift`, since
 * markers never define a level's extent. `blueprintFit` is untouched and
 * terrain-only — a marker never blocks a placement.
 */
export function placeBlueprintMarkers(
  markers: MarkerGrid,
  placements: readonly { row: number; col: number; marker: MarkerEntry }[],
  anchorCol: number,
  anchorRow: number,
): MarkerGrid {
  if (placements.length === 0) return markers;

  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const { row, col } of placements) {
    maxRow = Math.max(maxRow, anchorRow + row);
    maxCol = Math.max(maxCol, anchorCol + col);
  }

  const height = Math.max(markers.length, maxRow + 1, 0);
  const width = Math.max(markers[0]?.length ?? 0, maxCol + 1, 0);
  const next: MarkerGrid = Array.from({ length: height }, (_, row) => {
    const nextRow: (MarkerEntry | null)[] = markers[row] ? [...markers[row]] : [];
    while (nextRow.length < width) nextRow.push(null);
    return nextRow;
  });

  for (const { row, col, marker } of placements) {
    const targetRow = anchorRow + row;
    const targetCol = anchorCol + col;
    if (targetRow < 0 || targetCol < 0) continue;
    next[targetRow][targetCol] = marker;
  }

  return next;
}

/**
 * Stamps a blueprint's own `background` sub-region into `target`, anchored so
 * the blueprint's own cell `(0,0)` lands on `(anchorRow, anchorCol)` — the
 * grid-model mirror of the rebase `cropLevelForExport` applies when the
 * blueprint is saved. Grows `target` as needed (the same right/down-append,
 * left/up-prepend behaviour `paintBackgroundCell`'s grow uses) so a blueprint
 * background reaching past the target's current bounds still lands correctly.
 *
 * Every non-`null` cell overwrites unconditionally, with no overlap check
 * background painting has always silently replaced on overlap (design, Step
 * 44c — Placement); a `null` cell in the blueprint's background leaves
 * whatever was already in `target` at that position untouched, so placing a
 * blueprint with a sparse background never erases surrounding cells outside
 * its own footprint.
 */
export const rebaseBlueprintBackground = (
  target: BackgroundChar[][],
  background: BackgroundChar[][],
  colOffset: number,
  rowOffset: number,
): BackgroundChar[][] => {
  if (background.length === 0) return target;

  const cells: GridCell<BackgroundChar>[] = [];
  for (let row = 0; row < background.length; row++) {
    for (let col = 0; col < background[row].length; col++) {
      const char = background[row][col];
      if (char === '.') continue;
      cells.push({ col: colOffset + col, row: rowOffset + row, value: char });
    }
  }
  // No non-`.` cell — nothing to stamp; `stampGridCells` returns `target`
  // unchanged for the empty cell list, matching the old `minRow === Infinity`
  // early return.
  return stampGridCells(target, cells, '.', true).grid;
};
