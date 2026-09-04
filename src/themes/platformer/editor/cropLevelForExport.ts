import type { TileChar } from '../level/LevelParser';
import type { BackgroundPlacement } from '../level/LevelData';
import { exportLayout } from './exportLayout';

export interface CroppedLevel {
  layout: readonly string[];
  background: BackgroundPlacement[];
}

/**
 * Pairs `exportLayout`'s existing foreground-only crop with a matching
 * rebase of `backgroundPlacements`, so the two layers never drift apart
 * across export/save/try. The crop's origin (`minCol`/`minRow`, the
 * foreground's own tightest non-`.` bounding box — exactly what
 * `exportLayout` computes internally) is what re-bases every returned
 * background placement's `col`/`row`, the same way `growGrid` already
 * re-bases the foreground grid itself on a leftward/upward paint (see
 * `LevelEditorPage.tsx`'s `onPaint` handler).
 *
 * Deliberately does NOT extend the crop to include background footprints:
 * per the project owner, storage/export only ever reflects the foreground
 * grid's own content — background is unbounded and purely a render-time
 * concern (`drawBackgroundTiles` just offsets by camera/pan, with no
 * requirement that a placement's `col`/`row` fall inside the layout's
 * nominal width/height). So a rebased placement can legitimately end up
 * with a negative `col`/`row`, or one beyond the cropped layout's bounds —
 * that's expected, not a bug, and this function does not clamp it.
 */
export function cropLevelForExport(
  grid: TileChar[][],
  backgroundPlacements: readonly BackgroundPlacement[],
): CroppedLevel {
  let minRow = Infinity;
  let minCol = Infinity;

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== '.') {
        if (row < minRow) minRow = row;
        if (col < minCol) minCol = col;
      }
    }
  }

  // No foreground content at all — exportLayout returns the arbitrary
  // single-cell ['.'], which has no real origin to rebase against, so
  // background placements pass through unshifted.
  const originRow = minRow === Infinity ? 0 : minRow;
  const originCol = minCol === Infinity ? 0 : minCol;

  const background = backgroundPlacements.map((placement) => ({
    ...placement,
    col: placement.col - originCol,
    row: placement.row - originRow,
  }));

  return { layout: exportLayout(grid), background };
}
