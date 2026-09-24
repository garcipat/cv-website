/**
 * The shared tile-atlas vocabulary (R-002 FR-009): the quarter-turn type, the
 * uniform 19px cell stride, and the `{ sx, sy, rotation }` entry shape that
 * both `GroundAtlas.ts` and `BackgroundAtlas.ts` build on. Pure — imports
 * nothing.
 */

/** Quarter-turns clockwise applied when drawing a tile from an atlas. A half
 *  turn (2) flips a vertical ramp end-for-end; the quarter turns move a border
 *  onto an adjacent edge and are only safe on flat cells. */
export type QuarterTurns = 0 | 1 | 2 | 3;

/** One atlas cell's source rect plus its clockwise quarter-turn rotation. */
export interface TileAtlasEntry {
  sx: number;
  sy: number;
  rotation: QuarterTurns;
}

/**
 * `16px` tile plus a `3px` transparent gutter — the uniform stride both tile
 * atlases lay their cells out on.
 */
export const ATLAS_STRIDE = 19;

/** The source rect of the atlas cell at `(col, row)` on the uniform stride. */
export function atlasCell(col: number, row: number): { sx: number; sy: number } {
  return { sx: col * ATLAS_STRIDE, sy: row * ATLAS_STRIDE };
}
