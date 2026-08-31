import type { TileChar } from '../level/LevelParser';

/**
 * Crops `grid` to the tightest rectangle containing every non-`.` cell,
 * then serializes it into the exact `readonly string[]` shape `parseLevel`
 * expects (one string per row, top row first). The stored grid only ever
 * grows (see `growGrid.ts`) and never auto-shrinks when cells are erased —
 * this cropping is what makes the exported layout always reflect only the
 * tiles actually placed, regardless of how large the in-memory array has
 * become. Returns `['.']` if the grid has no non-`.` cell at all, rather
 * than an empty array (which `parseLevel` cannot represent as a valid
 * level).
 */
export function exportLayout(grid: TileChar[][]): readonly string[] {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== '.') {
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
      }
    }
  }

  if (minRow === Infinity) {
    return ['.'];
  }

  const rows: string[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    let line = '';
    for (let col = minCol; col <= maxCol; col++) {
      line += grid[row][col];
    }
    rows.push(line);
  }
  return rows;
}
