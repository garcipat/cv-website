import type { TileChar, BackgroundChar } from '../../level/LevelParser';
import type { MarkerGrid, MarkerPlacement } from '../../level/LevelData';
import { boundingBoxOfContent, cropLayoutToBox, unionBoxes } from './exportLayout';

export interface CroppedLevel {
  layout: readonly string[];
  background: readonly string[];
  markers: readonly MarkerPlacement[];
}

/**
 * Pairs the foreground's crop with the matching sub-region of `background` and
 * the tile meta layer, serialized the same `readonly string[]`/`MarkerPlacement[]`
 * shapes `layout` and the stored `markers` field have ('s
 * storage-unification revision, extended by the tile meta layer) — so the
 * three layers never drift apart across export/save/try.
 *
 * This is a **wrapper** over the one generic crop primitive:
 * both `layout` and `background` come from `cropLayoutToBox`, differing only in
 * their grid and their row shape. The only loop left here is the sparse marker
 * walk (which reads `markers` and shifts coordinates; it serializes no
 * character/background rows itself).
 *
 * The crop box is the tightest rectangle over every non-`.` terrain cell
 * **and** every non-null marker cell, so an isolated marker on an
 * empty cell expands the box and survives the save. `background` is cropped to
 * that same box, and `markers` are serialized relative to its origin.
 *
 * An all-empty level still exports `layout: ['.']`, `background: []`,
 * `markers: []`.
 */
export function cropLevelForExport(
  grid: TileChar[][],
  background: BackgroundChar[][],
  markers: MarkerGrid = [],
): CroppedLevel {
  const box = unionBoxes(boundingBoxOfContent(grid, '.'), boundingBoxOfContent(markers, null));

  // No foreground or marker content at all — exportLayout returns the
  // arbitrary single-cell ['.'], which has no real bounding box to crop the
  // other layers against, so they export empty too (nothing to align them to).
  if (box === null) {
    return { layout: cropLayoutToBox(grid, null, '.'), background: [], markers: [] };
  }

  const markerPlacements: MarkerPlacement[] = [];
  for (let row = box.minRow; row <= box.maxRow; row++) {
    for (let col = box.minCol; col <= box.maxCol; col++) {
      const marker = markers[row]?.[col];
      if (marker) {
        markerPlacements.push({ col: col - box.minCol, row: row - box.minRow, marker });
      }
    }
  }

  return {
    layout: cropLayoutToBox(grid, box, '.'),
    background: cropLayoutToBox(background, box, '.'),
    markers: markerPlacements,
  };
}
