import type { TileChar } from '../level/LevelParser';

export interface GrowResult {
  grid: TileChar[][];
  colShift: number;
  rowShift: number;
}

/**
 * Grows `grid` just enough to include `(col, row)` as a valid index. Growing
 * right/down appends `.`-filled columns/rows at the end (no existing index
 * changes). Growing left/up prepends them at the start, which shifts every
 * existing cell's index — `colShift`/`rowShift` report exactly how much, so
 * the caller (see `paintCell.ts`) can compensate `panOffset` and remap the
 * target coordinates into the grown grid. Returns the input grid unchanged
 * (colShift/rowShift both 0) when `(col, row)` is already in bounds — this
 * is the common case on every paint that doesn't cross a boundary.
 */
export function growGrid(grid: TileChar[][], col: number, row: number): GrowResult {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  const growLeft = col < 0 ? -col : 0;
  const growTop = row < 0 ? -row : 0;
  const growRight = col >= width ? col - width + 1 : 0;
  const growBottom = row >= height ? row - height + 1 : 0;

  if (growLeft === 0 && growTop === 0 && growRight === 0 && growBottom === 0) {
    return { grid, colShift: 0, rowShift: 0 };
  }

  const newWidth = growLeft + width + growRight;
  const newHeight = growTop + height + growBottom;

  const newGrid: TileChar[][] = [];
  for (let r = 0; r < newHeight; r++) {
    const newRow: TileChar[] = [];
    for (let c = 0; c < newWidth; c++) {
      newRow.push('.');
    }
    newGrid.push(newRow);
  }

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      newGrid[r + growTop][c + growLeft] = grid[r][c];
    }
  }

  return { grid: newGrid, colShift: growLeft, rowShift: growTop };
}
