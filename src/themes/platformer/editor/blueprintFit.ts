import type { BlueprintCell } from './blueprintCells';
import type { TileChar } from '../level/LevelParser';

const EMPTY_CHAR: TileChar = '.';

/**
 * Whether a blueprint anchored so its own cell `(0,0)` lands on
 * `(anchorRow, anchorCol)` can be placed into `grid`.
 *
 * This is the ENTIRE validation rule: no cell the placement would write may
 * land on a cell the live grid already fills. Out of bounds counts as free,
 * because committing grows the grid there exactly the way painting there
 * would. There is no connection-point check, no adjacency check, no facing,
 * and no "first room" special case — see the design doc's Goal section for why
 * connection-point matching was dropped (it degenerates the moment a
 * blueprint's connection points are stamped into a level, since a placed `'+'`
 * carries no memory of its source blueprint's bounds). A
 * `blueprintConnectionPoint` cell, in the grid or in the blueprint, takes part
 * here exactly like any other non-`'.'` cell.
 *
 * `cells` are the blueprint's own `'.'`-free cells (`blueprintCells`), so its
 * padding is never checked: a room can be dropped over existing terrain that
 * only sits under the gaps in its bounding box.
 *
 * The `?.` reads `undefined` for "out of bounds" — which is sound here, and
 * only here, because every grid this ever sees is rectangular: `importLayout`
 * right-pads jagged layouts on the way in and `growGrid` builds a full
 * `newWidth × newHeight` grid on the way out, so `undefined` can only ever mean
 * "past an edge", never "a hole in a ragged row".
 */
export const blueprintFits = (
  grid: readonly TileChar[][],
  cells: readonly BlueprintCell[],
  anchorCol: number,
  anchorRow: number,
): boolean =>
  cells.every(({ row, col }) => {
    const existing = grid[anchorRow + row]?.[anchorCol + col];
    return existing === undefined || existing === EMPTY_CHAR;
  });
