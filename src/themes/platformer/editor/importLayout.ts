import type { TileChar } from '../level/LevelParser';

/**
 * Converts a level layout string array (one string per row, one character
 * per column — the shape `parseLevel` also consumes) into the editor's
 * `TileChar[][]` grid. Does no validation beyond what `TileChar` guarantees
 * at the type level: this is a plain per-character mapping, not a
 * re-implementation of `parseLevel`'s row-length/unknown-character runtime
 * checks — those checks exist for arbitrary user-typed layouts, but this
 * function is only ever called with `LEVEL_1_LAYOUT`, a known-valid,
 * statically-imported constant.
 */
export function importLayout(layout: readonly string[]): TileChar[][] {
  return layout.map((row) => row.split('') as TileChar[]);
}
