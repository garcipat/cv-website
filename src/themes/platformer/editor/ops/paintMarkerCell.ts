import { paintGridCell } from './paintGrid';
import type { MarkerEntry, MarkerGrid } from '../../level/LevelData';
import { DEFAULT_HINT_ID, nextHintId } from '../../level/HintCatalog';
import { DEFAULT_TORCH_STRENGTH, nextTorchStrength } from '../../tiles/torch';

/**
 * Shifts a marker grid by a terrain growth, inserting empty rows/columns at
 * the start for a leftward/upward growth and leaving it untouched for a
 * rightward/downward one (new cells already read as `null`). The marker grid's
 * own analogue of `editorActions.ts`'s `shiftBackgroundGrid`; the marker grid
 * must stay aligned to the terrain grid across a growth.
 */
export function shiftMarkerGrid(
  markers: MarkerGrid,
  colShift: number,
  rowShift: number,
): MarkerGrid {
  if (colShift === 0 && rowShift === 0) return markers;
  const shiftedRows = markers.map((row) => [
    ...new Array<MarkerEntry | null>(colShift).fill(null),
    ...row,
  ]);
  const newWidth = (markers[0]?.length ?? 0) + colShift;
  const emptyRow = (): (MarkerEntry | null)[] => new Array<MarkerEntry | null>(newWidth).fill(null);
  return [...Array.from({ length: rowShift }, emptyRow), ...shiftedRows];
}

/**
 * Pads a marker grid with empty (`null`) cells so it is at least
 * `width × height`, mirroring a terrain grid's own dimensions. A left/up
 * terrain growth is handled by `shiftMarkerGrid`; a right/down growth appends
 * cells without shifting, so this is what keeps the marker grid aligned to the
 * terrain grid in that direction. Returns the same grid when it is
 * already large enough.
 */
export function resizeMarkerGrid(markers: MarkerGrid, width: number, height: number): MarkerGrid {
  const currentWidth = markers[0]?.length ?? 0;
  if (markers.length >= height && currentWidth >= width) return markers;
  const newHeight = Math.max(markers.length, height);
  const newWidth = Math.max(currentWidth, width);
  return Array.from({ length: newHeight }, (_, row) => {
    const nextRow: (MarkerEntry | null)[] = markers[row] ? [...markers[row]] : [];
    while (nextRow.length < newWidth) nextRow.push(null);
    return nextRow;
  });
}

/**
 * Writes exactly one marker into cell `(col, row)` and returns a new grid.
 * Unlike `paintCell`/`paintBackgroundCell`, this **never grows** the grid
 *: an out-of-bounds click is a no-op returning the same grid. At most
 * one marker per cell falls out of the single-cell write.
 */
export function paintMarkerCell(
  markers: MarkerGrid,
  col: number,
  row: number,
  marker: MarkerEntry,
): MarkerGrid {
  if (markers[row]?.[col] === undefined) return markers;
  return paintGridCell(markers, col, row, marker, null, false).grid;
}

/**
 * Clears cell `(col, row)` to `null`; a no-op for an already-empty or
 * out-of-bounds cell.
 */
export function eraseMarkerCell(markers: MarkerGrid, col: number, row: number): MarkerGrid {
  if (markers[row]?.[col] === undefined || markers[row][col] === null) return markers;
  return paintGridCell(markers, col, row, null, null, false).grid;
}

/**
 * The sign tool's marker write: `{kind:'sign', hintId: DEFAULT_HINT_ID}` on a
 * fresh cell, else the next hint in `HINT_IDS`. An out-of-bounds cell
 * is a no-op, matching `paintMarkerCell`.
 */
export function paintSignMarker(markers: MarkerGrid, col: number, row: number): MarkerGrid {
  if (markers[row]?.[col] === undefined) return markers;
  const existing = markers[row][col];
  const hintId = existing?.kind === 'sign' ? nextHintId(existing.hintId) : DEFAULT_HINT_ID;
  return paintGridCell(markers, col, row, { kind: 'sign', hintId }, null, false).grid;
}

/**
 * The torch tool's marker write on a cell that already holds `¥`: the next
 * strength in the `0`–`9` cycle (`nextTorchStrength`). The cycle clears the
 * marker when it reaches `DEFAULT_TORCH_STRENGTH`, so a torch at the default is
 * stored as no marker at all and an unadjusted level stays sparse.
 * An out-of-bounds cell is a no-op, matching `paintMarkerCell`.
 */
export function paintTorchMarker(markers: MarkerGrid, col: number, row: number): MarkerGrid {
  if (markers[row]?.[col] === undefined) return markers;
  const existing = markers[row][col];
  const current = existing?.kind === 'torch' ? existing.strength : DEFAULT_TORCH_STRENGTH;
  const next = nextTorchStrength(current);
  const marker =
    next === DEFAULT_TORCH_STRENGTH ? null : { kind: 'torch' as const, strength: next };
  return paintGridCell(markers, col, row, marker, null, false).grid;
}
