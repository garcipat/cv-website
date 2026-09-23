import type { TileChar } from '../level/LevelParser';

export interface BoundingBox {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

/**
 * The tightest rectangle containing every cell of `grid` that isn't
 * `emptyValue`, or `null` if the grid has no such cell at all. Shared by
 * `exportLayout` (foreground) and `cropLevelForExport` (which crops the
 * background to the SAME box, see its own doc comment) so the min/max scan
 * exists in exactly one place rather than being duplicated per grid shape —
 * generic over the cell type for the same reason `growGrid` is.
 */
export function boundingBoxOfContent<T>(grid: T[][], emptyValue: T): BoundingBox | null {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== emptyValue) {
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
      }
    }
  }

  return minRow === Infinity ? null : { minRow, maxRow, minCol, maxCol };
}

/** The smallest box containing both `a` and `b`, or whichever is non-null, or
 *  `null` when both are — the tile meta layer's crop shares the foreground's
 *  origin through this (D11/FR-017). */
export function unionBoxes(a: BoundingBox | null, b: BoundingBox | null): BoundingBox | null {
  if (a === null) return b;
  if (b === null) return a;
  return {
    minRow: Math.min(a.minRow, b.minRow),
    maxRow: Math.max(a.maxRow, b.maxRow),
    minCol: Math.min(a.minCol, b.minCol),
    maxCol: Math.max(a.maxCol, b.maxCol),
  };
}

/**
 * Serializes the sub-rectangle of `grid` described by `box` into the exact
 * `readonly string[]` shape `parseLevel` expects (one string per row, top row
 * first). A `null` box (no content) returns `['.']` rather than an empty
 * array, which `parseLevel` cannot represent as a valid level. Cells missing
 * from a ragged grid read as `.`, matching `boundingBoxOfContent`'s own
 * tolerance.
 */
export function cropLayoutToBox(grid: TileChar[][], box: BoundingBox | null): readonly string[] {
  if (box === null) return ['.'];

  const rows: string[] = [];
  for (let row = box.minRow; row <= box.maxRow; row++) {
    let line = '';
    for (let col = box.minCol; col <= box.maxCol; col++) {
      line += grid[row]?.[col] ?? '.';
    }
    rows.push(line);
  }
  return rows;
}

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
  return cropLayoutToBox(grid, boundingBoxOfContent(grid, '.'));
}
