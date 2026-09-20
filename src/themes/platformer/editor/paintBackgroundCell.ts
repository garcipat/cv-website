import { growGrid } from './growGrid';
import type { BackgroundChar } from '../level/LevelParser';

/**
 * Paints `char` at `(col, row)`, growing the grid first if the target is out
 * of bounds — a single-cell write, no footprint, no overlap search, mirroring
 * the foreground layer's `paintCell` exactly (FR-010). Reuses `growGrid`
 * directly rather than a bespoke background-only grow: `BackgroundChar[][]`
 * has the exact same shape (a rectangular grid of a string-union "char" type
 * with `'.'` as its empty value) `TileChar[][]` does, and `growGrid` is
 * generic over that shape now.
 */
export function paintBackgroundCell(
  grid: BackgroundChar[][],
  col: number,
  row: number,
  char: BackgroundChar,
): BackgroundChar[][] {
  const { grid: grown, colShift, rowShift } = growGrid(grid, col, row, '.');
  const next = grown.map((r) => [...r]);
  next[row + rowShift][col + colShift] = char;
  return next;
}

/**
 * Clears `(col, row)` back to empty (`'.'`). A no-op (same contents) when the
 * cell is already empty or outside the grid's current bounds — erasing never
 * grows the grid, matching `eraseBackgroundCell`'s old right-click-always-
 * erases convention with nothing to overlap-search for any more.
 */
export function eraseBackgroundCell(
  grid: BackgroundChar[][],
  col: number,
  row: number,
): BackgroundChar[][] {
  if (grid[row]?.[col] === undefined || grid[row][col] === '.') return grid;
  const next = grid.map((r) => [...r]);
  next[row][col] = '.';
  return next;
}
