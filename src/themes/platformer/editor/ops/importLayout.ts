import {
  BACKGROUND_CHARS,
  LEGACY_MARKER_CHARS,
  SIGN_CHAR,
  parseMarkers,
  type BackgroundChar,
  type TileChar,
} from '../../level/LevelParser';
import type { MarkerGrid, MarkerPlacement } from '../../level/LevelData';
import { layoutWidth, walkLayout } from '../../level/layoutChars';

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
 * the moment the grid is first loaded.
 *
 * Legacy marker characters are migrated once, at load time, so the editor
 * grid never holds one: `P`/`+` become `.` (their marker lives on the tile
 * meta layer, see `importMarkerGrid`), a digit `1`-`6` becomes the uniform
 * `T` sign character, and a legacy `T` hazard becomes the decorative `⊤`
 * tile when `legacyT` is true. `legacyT` is set by the caller for a
 * pre-feature file (one with no `markers` field); a new-format `T` stays the
 * sign character.
 */
export function importLayout(layout: readonly string[], legacyT = false): TileChar[][] {
  const width = layoutWidth(layout);
  const grid: TileChar[][] = Array.from({ length: layout.length }, () =>
    new Array<TileChar>(width).fill('.'),
  );
  // The one shared character walk; only the `TileChar` +
  // legacy-marker migration mapping lives here.
  walkLayout(layout, ({ char, col, row }) => {
    if (char === SIGN_CHAR) {
      grid[row][col] = legacyT ? '⊤' : 'T';
      return;
    }
    const legacy = LEGACY_MARKER_CHARS[char];
    if (legacy) {
      grid[row][col] = legacy.kind === 'sign' ? 'T' : '.';
      return;
    }
    grid[row][col] = char as TileChar;
  });
  return grid;
}

/**
 * The tile meta layer's analogue of `importLayout` — lifts every legacy
 * marker character out of a saved layout and merges the file's own
 * `storedMarkers` on top, via the same `parseMarkers` the runtime uses
 *. The editor grid it accompanies is produced by `importLayout`
 * with `legacyT` matching this file's generation, so the two stay aligned.
 */
export function importMarkerGrid(
  layout: readonly string[],
  storedMarkers?: readonly MarkerPlacement[],
): MarkerGrid {
  const height = layout.length;
  const width = layoutWidth(layout);
  return parseMarkers(layout, storedMarkers, width, height);
}

/**
 * The background layer's analogue of `importLayout` — converts a saved
 * `background: readonly string[]` layout (a level/blueprint file's own,
 * post- storage shape) into the editor's `BackgroundChar[][]` grid.
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
