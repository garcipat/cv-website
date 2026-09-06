import { growGrid, type GrowResult } from './growGrid';
import type { BlueprintCell } from './blueprintCells';
import type { BackgroundPlacement } from '../level/LevelData';
import type { TileChar } from '../level/LevelParser';

/** Same shape `paintCell` returns, deliberately: a placement is just a bigger
 *  paint as far as `LevelEditorPage` is concerned, so it flows through the same
 *  grow/shift bookkeeping (`applyGrowthShift`) a single painted cell does. */
export type PlacementResult = GrowResult;

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

  const first = growGrid(grid, minCol, minRow);
  const second = growGrid(first.grid, maxCol + first.colShift, maxRow + first.rowShift);
  const colShift = first.colShift + second.colShift;
  const rowShift = first.rowShift + second.rowShift;

  const nextGrid = second.grid.map((row) => [...row]);
  for (const { row, col, char } of cells) {
    nextGrid[anchorRow + row + rowShift][anchorCol + col + colShift] = char;
  }

  return { grid: nextGrid, colShift, rowShift };
};

/**
 * A blueprint's own `background` placements moved onto the origin its
 * foreground cells were just written at — the mirror of the rebase
 * `cropLevelForExport` applies when the blueprint is saved.
 *
 * Appended to the target level's background list unconditionally, with no
 * overlap check: background placements already silently replace on overlap,
 * matching how painting the background layer works today (design, Step 44c —
 * Placement).
 */
export const rebaseBlueprintBackground = (
  background: readonly BackgroundPlacement[],
  colOffset: number,
  rowOffset: number,
): BackgroundPlacement[] =>
  background.map((placement) => ({
    ...placement,
    col: placement.col + colOffset,
    row: placement.row + rowOffset,
  }));
