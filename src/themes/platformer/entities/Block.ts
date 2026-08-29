import { TILE_SIZE, RENDERED_TILE_SIZE } from '../level/Terrain';

/** Blocks are drawn from `world_tileset.png` — the same image and tile size
 *  as terrain (16px native, 32px rendered) — so no separate sprite sheet or
 *  dimensions are needed. */
export const BLOCK_FRAME_SIZE = TILE_SIZE;
export const BLOCK_RENDERED_SIZE = RENDERED_TILE_SIZE;

/**
 * Sprite-sheet source rect (in `world_tileset.png`) for a block's intact
 * state, by kind. Coordinates confirmed via a pixel-level inspection during
 * planning (roadmap step 20):
 * - `crate`: the wooden crate tile, at tile (col 7, row 3).
 * - `questionMark`: the brown-palette intact `?` tile, at tile (col 0, row
 *   2) — the only palette wired up for `level1` (a mechanics-test level);
 *   the matching `!` (used) tile lives at tile (col 1, row 2), needed once
 *   step 21b implements the hit mechanic, not used yet.
 * - `rock`: a plain, fractured-stone tile distinct from both
 *   `groundRock`(terrain) and the `?`/`!` tiles, at tile (col 3, row 0).
 *
 * No hit-state variants yet (step 20 is render-only) — every block always
 * renders in this intact state until step 21a/21b/21c add hit mechanics.
 */
export function blockFrameSource(blockKind: 'crate' | 'questionMark' | 'rock'): { sx: number; sy: number } {
  switch (blockKind) {
    case 'crate':
      return { sx: 7 * TILE_SIZE, sy: 3 * TILE_SIZE };
    case 'questionMark':
      return { sx: 0, sy: 2 * TILE_SIZE };
    case 'rock':
      return { sx: 3 * TILE_SIZE, sy: 0 };
    default: {
      const _exhaustive: never = blockKind;
      return _exhaustive;
    }
  }
}
