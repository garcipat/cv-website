import { growGrid, type GrowResult } from './growGrid';
import type { TileChar } from '../level/LevelParser';

/** Same shape as `growGrid`'s `GrowResult` — `paintCell` always returns a
 *  grown-and-painted grid plus whatever shift growth applied, so callers
 *  (see `EditorCanvas.tsx`) handle both the same way. */
export type PaintResult = GrowResult;

/**
 * Paints `tool` into cell `(col, row)`, growing the grid first if the
 * target is out of bounds (see `growGrid`). When `tool` is `'S'` (spawn),
 * every other cell currently holding `'S'` is cleared back to `'.'` in the
 * same call — this guarantees exactly one spawn marker exists at a time
 * without ever blocking placement or prompting a warning (spec User Story
 * 3 / FR-006).
 */
export function paintCell(
  grid: TileChar[][],
  col: number,
  row: number,
  tool: TileChar,
): PaintResult {
  const { grid: grownGrid, colShift, rowShift } = growGrid(grid, col, row);
  const targetCol = col + colShift;
  const targetRow = row + rowShift;

  const nextGrid = grownGrid.map((r) => [...r]);

  if (tool === 'S') {
    for (let r = 0; r < nextGrid.length; r++) {
      for (let c = 0; c < nextGrid[r].length; c++) {
        if (nextGrid[r][c] === 'S') {
          nextGrid[r][c] = '.';
        }
      }
    }
  }

  nextGrid[targetRow][targetCol] = tool;

  return { grid: nextGrid, colShift, rowShift };
}
