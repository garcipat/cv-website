import { BACKGROUND_CHARS, type BackgroundChar, type TileChar } from '../level/LevelParser';

/**
 * Converts a level layout string array (one string per row, one character
 * per column — the shape `parseLevel` also consumes) into the editor's
 * `TileChar[][]` grid. Rows shorter than the widest row are right-padded
 * with `.` (empty) — matching `parseLevel`'s own convention exactly
 * (`LEVEL_1_LAYOUT` itself is jagged: its ladder-shaft rows are
 * deliberately short, and `parseLevel` treats missing trailing characters
 * as empty terrain). Every other function in this module assumes a
 * rectangular grid (e.g. `growGrid`/`gridToLevelDef` read `grid[0].length`
 * as "the" width) — padding here is what keeps that invariant true from
 * the moment the grid is first loaded. Does no further validation beyond
 * what `TileChar` guarantees at the type level and this padding: this
 * function is only ever called with `LEVEL_1_LAYOUT`, a known-valid,
 * statically-imported constant.
 */
export function importLayout(layout: readonly string[]): TileChar[][] {
  const width = layout.reduce((max, row) => Math.max(max, row.length), 0);
  return layout.map((row) => {
    const chars = row.split('') as TileChar[];
    while (chars.length < width) chars.push('.');
    return chars;
  });
}

/**
 * The background layer's analogue of `importLayout` — converts a saved
 * `background: readonly string[]` layout (a level/blueprint file's own,
 * post-O-014 storage shape) into the editor's `BackgroundChar[][]` grid.
 * Same right-pad-with-`.` convention as `importLayout`, plus one background-
 * specific step: any character not a recognized `BACKGROUND_CHARS` key (an
 * old/malformed save, or simply `'.'` itself) reads as `'.'` rather than
 * being carried through literally — the editor grid must only ever hold
 * values `paintBackgroundCell`/`growGrid` know how to treat as "empty" or "a
 * real material", the same closed-set guarantee `parseBackgroundLayout`
 * gives the engine-facing `BackgroundGrid`.
 */
export function importBackgroundLayout(layout: readonly string[]): BackgroundChar[][] {
  const width = layout.reduce((max, row) => Math.max(max, row.length), 0);
  return layout.map((row) => {
    const chars: BackgroundChar[] = [];
    for (let i = 0; i < width; i++) {
      const char = row[i];
      chars.push(char !== undefined && char in BACKGROUND_CHARS ? (char as BackgroundChar) : '.');
    }
    return chars;
  });
}
