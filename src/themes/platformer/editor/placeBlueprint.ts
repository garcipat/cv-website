import { growGrid, type GrowResult } from './growGrid';
import { importMarkerGrid } from './importLayout';
import type { BlueprintCell } from './blueprintCells';
import type { Blueprint } from '../level/BlueprintData';
import type { MarkerEntry, MarkerGrid } from '../level/LevelData';
import type { BackgroundChar, TileChar } from '../level/LevelParser';

/** Same shape `paintCell` returns, deliberately: a placement is just a bigger
 *  paint as far as `LevelEditorPage` is concerned, so it flows through the same
 *  grow/shift bookkeeping (`applyGrowthShift`) a single painted cell does. */
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
): PlacementResult => {
  if (cells.length === 0) return { grid, colShift: 0, rowShift: 0 };

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const { row, col } of cells) {
    const absoluteCol = anchorCol + col;
    const absoluteRow = anchorRow + row;
    if (absoluteCol < minCol) minCol = absoluteCol;
    if (absoluteRow < minRow) minRow = absoluteRow;
    if (absoluteCol > maxCol) maxCol = absoluteCol;
    if (absoluteRow > maxRow) maxRow = absoluteRow;
  }

  const first = growGrid(grid, minCol, minRow, '.');
  const second = growGrid(first.grid, maxCol + first.colShift, maxRow + first.rowShift, '.');
  const colShift = first.colShift + second.colShift;
  const rowShift = first.rowShift + second.rowShift;

  const nextGrid = second.grid.map((row) => [...row]);
  for (const { row, col, char } of cells) {
    nextGrid[anchorRow + row + rowShift][anchorCol + col + colShift] = char;
  }

  return { grid: nextGrid, colShift, rowShift };
};

/**
 * Every marker a blueprint carries, relative to the room's own top-left corner
 * — its stored `markers` field merged over any legacy marker characters still
 * in `layout` (FR-015), via the same `importMarkerGrid` the editor's load path
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
 * replacing whatever marker was there (FR-018/FR-020). The level marker grid
 * may be smaller than the placement's extent (a level with no markers starts
 * empty, and a right/down growth appends terrain without touching it), so the
 * grid is padded with `null` to fit; it never triggers a `GrowthShift`, since
 * markers never define a level's extent. `blueprintFit` is untouched and
 * terrain-only — a marker never blocks a placement (FR-019).
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
 * Every non-`null` cell overwrites unconditionally, with no overlap check —
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

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (let row = 0; row < background.length; row++) {
    for (let col = 0; col < background[row].length; col++) {
      if (background[row][col] === '.') continue;
      const absoluteCol = colOffset + col;
      const absoluteRow = rowOffset + row;
      if (absoluteCol < minCol) minCol = absoluteCol;
      if (absoluteRow < minRow) minRow = absoluteRow;
      if (absoluteCol > maxCol) maxCol = absoluteCol;
      if (absoluteRow > maxRow) maxRow = absoluteRow;
    }
  }
  if (minRow === Infinity) return target; // every cell was empty — nothing to stamp

  const first = growGrid(target, minCol, minRow, '.');
  const second = growGrid(first.grid, maxCol + first.colShift, maxRow + first.rowShift, '.');
  const colShift = first.colShift + second.colShift;
  const rowShift = first.rowShift + second.rowShift;

  const nextGrid = second.grid.map((row) => [...row]);
  for (let row = 0; row < background.length; row++) {
    for (let col = 0; col < background[row].length; col++) {
      const char = background[row][col];
      if (char === '.') continue;
      nextGrid[rowOffset + row + rowShift][colOffset + col + colShift] = char;
    }
  }

  return nextGrid;
};
