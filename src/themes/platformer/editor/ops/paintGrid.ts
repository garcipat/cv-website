import { growGrid, type GrowResult } from './growGrid';

/**
 * The one generic paint/stamp primitive. Every per-layer paint
 * foreground, background, marker — resolves to a call here with its own
 * `value`/`emptyValue`/`grow` data; the copy/grow/write body exists once.
 *
 * `grow = true` grows the grid just enough to include every cell (prepending
 * rows/columns for a leftward/upward target, so existing cells shift and
 * `colShift`/`rowShift` report by how much). `grow = false` never grows — an
 * out-of-bounds cell is skipped, and the grid is returned unchanged when
 * nothing in bounds was written (the marker layer's own rule).
 */

export interface GridCell<T> {
  col: number;
  row: number;
  value: T;
}

/**
 * Writes every cell in one copy of the grid (after growing if `grow`). Returns
 * the new grid plus whatever growth shift was applied.
 */
export function stampGridCells<T>(
  grid: T[][],
  cells: readonly GridCell<T>[],
  emptyValue: T,
  grow = true,
): GrowResult<T> {
  if (cells.length === 0) return { grid, colShift: 0, rowShift: 0 };

  if (!grow) {
    const inBounds = cells.filter(({ col, row }) => grid[row]?.[col] !== undefined);
    if (inBounds.length === 0) return { grid, colShift: 0, rowShift: 0 };
    const next = grid.map((row) => [...row]);
    for (const { col, row, value } of inBounds) next[row][col] = value;
    return { grid: next, colShift: 0, rowShift: 0 };
  }

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const { col, row } of cells) {
    if (col < minCol) minCol = col;
    if (row < minRow) minRow = row;
    if (col > maxCol) maxCol = col;
    if (row > maxRow) maxRow = row;
  }

  // Two grows, then one bulk write — a leftward/upward growth renumbers every
  // existing index, so the geometry must settle (for both the minimum and the
  // maximum corner, in the already-grown grid's coordinates) before writing.
  const first = growGrid(grid, minCol, minRow, emptyValue);
  const second = growGrid(first.grid, maxCol + first.colShift, maxRow + first.rowShift, emptyValue);
  const colShift = first.colShift + second.colShift;
  const rowShift = first.rowShift + second.rowShift;

  const next = second.grid.map((row) => [...row]);
  for (const { col, row, value } of cells) {
    next[row + rowShift][col + colShift] = value;
  }
  return { grid: next, colShift, rowShift };
}

/** The single-cell case of `stampGridCells`. */
export function paintGridCell<T>(
  grid: T[][],
  col: number,
  row: number,
  value: T,
  emptyValue: T,
  grow = true,
): GrowResult<T> {
  return stampGridCells(grid, [{ col, row, value }], emptyValue, grow);
}
