/**
 * The one layout-character walk. Both the parse side
 * (`LevelParser.parseLevel`, returning `LevelDef`) and the editor's load path
 * (`editor/ops/importLayout.importLayout`, returning `TileChar[][]`) iterate
 * through `walkLayout`; the per-path mapping (terrain/entity/sign/hazard +
 * unknown-char warning vs `TileChar` + legacy-marker migration) stays with
 * each caller, so their signatures are deliberately not unified.
 *
 * `level/` vocabulary only: both callers can import it (the editor imports
 * `level/`; `level/` must not import the editor).
 */

export interface LayoutCell {
  char: string;
  col: number;
  row: number;
}

/** The widest row's length (0 for an empty layout) — the grid width both
 * callers already derive from the same reduce. */
export function layoutWidth(layout: readonly string[]): number {
  return layout.reduce((max, row) => Math.max(max, row.length), 0);
}

/**
 * Visits every in-bounds cell of `layout` (top-to-bottom, left-to-right).
 * A short row's missing trailing cells are skipped rather than visited with
 * `undefined`, matching how both callers already treat such a row as
 * right-padded empty.
 */
export function walkLayout(layout: readonly string[], visit: (cell: LayoutCell) => void): void {
  const width = layoutWidth(layout);
  for (let row = 0; row < layout.length; row++) {
    const line = layout[row] ?? '';
    for (let col = 0; col < width; col++) {
      const char = line[col];
      if (char === undefined) continue;
      visit({ char, col, row });
    }
  }
}
