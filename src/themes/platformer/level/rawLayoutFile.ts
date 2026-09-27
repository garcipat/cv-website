import type { MarkerPlacement } from './LevelData';

/**
 * The one raw level/blueprint file shape (FR-013, D10): a named layout plus
 * its optional background and tile-meta layers. `LevelEntry` and `Blueprint`
 * both extend this and redeclare none of its fields.
 *
 * The module is deliberately **not** named `LayoutFile.ts`: that would differ
 * from the existing `layoutFile.ts` (the M4 validation home) only by the case
 * of the first letter, and the two cannot coexist on the case-insensitive
 * Windows filesystem (nor under TypeScript's default
 * `forceConsistentCasingInFileNames`).
 *
 * `LevelDef` (`LevelData.ts`) is **not** an alias of this type — it is the
 * parsed runtime artifact (`terrain`, `width`, `height`, `background?`,
 * `markers?`), and the two are deliberately not conflated.
 */
export interface LayoutFile {
  readonly name?: string;
  /** One string per row, one character per column. */
  readonly layout: readonly string[];
  /** Optional; the same row shape as `layout`. */
  readonly background?: readonly string[];
  /** Optional; the sparse tile-meta layer. */
  readonly markers?: readonly MarkerPlacement[];
}
