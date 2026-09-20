import type { TileChar, BackgroundChar } from '../level/LevelParser';
import { exportLayout, boundingBoxOfContent } from './exportLayout';

export interface CroppedLevel {
  layout: readonly string[];
  background: readonly string[];
}

/**
 * Pairs `exportLayout`'s existing foreground-only crop with the matching
 * sub-region of `background`, serialized the same `readonly string[]` shape
 * `layout` itself has (O-014's storage-unification revision — background is
 * a compact `string[]` layout now, not an array-of-arrays grid) — the
 * grid-model replacement for the old placement-rebase, so the two layers
 * never drift apart across export/save/try. The crop's origin
 * (`minCol`/`minRow`, the foreground's own tightest non-`.` bounding box) and
 * its extent (`maxCol`/`maxRow`) — computed via the SAME `boundingBoxOfContent`
 * helper `exportLayout` uses internally, rather than a second min/max scan —
 * are what slice `background`.
 *
 * Deliberately does NOT extend the crop to include background content beyond
 * the foreground's own bounding box: per the project owner, storage/export
 * only ever reflects the foreground grid's own content — background is
 * purely a render-time concern aligned 1:1 with the foreground grid, not an
 * independent shape with its own bounds. A background cell outside the
 * foreground's tightest box is simply dropped by the crop, the same way any
 * other cell outside the exported layout's own bounds would be.
 */
export function cropLevelForExport(
  grid: TileChar[][],
  background: BackgroundChar[][],
): CroppedLevel {
  const box = boundingBoxOfContent(grid, '.');

  // No foreground content at all — exportLayout returns the arbitrary
  // single-cell ['.'], which has no real bounding box to crop background
  // against, so background exports empty too (nothing to align it to).
  if (box === null) {
    return { layout: exportLayout(grid), background: [] };
  }

  const backgroundRows: string[] = [];
  for (let row = box.minRow; row <= box.maxRow; row++) {
    let line = '';
    for (let col = box.minCol; col <= box.maxCol; col++) {
      line += background[row]?.[col] ?? '.';
    }
    backgroundRows.push(line);
  }

  return { layout: exportLayout(grid), background: backgroundRows };
}
