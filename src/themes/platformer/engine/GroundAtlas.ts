import { NEIGHBOUR_UP } from '../level/Terrain';
import type { RunPosition } from '../level/Terrain';

/**
 * `tile_atlas.png` holds 16px tiles on a uniform 19px stride (16px tile plus
 * a 3px transparent gutter), 7 columns by 3 rows. The gutter is why the
 * stride is not the tile size — a cell's origin is `index * ATLAS_STRIDE`,
 * while the source rect drawn from it stays `TILE_SIZE` square.
 */
export const ATLAS_STRIDE = 19;

/** Grass sprites occupy only the top 9px of their cell; the rest is
 *  transparent so the ground tile beneath shows through. */
export const GRASS_SOURCE_HEIGHT = 9;

function cell(col: number, row: number): { sx: number; sy: number } {
  return { sx: col * ATLAS_STRIDE, sy: row * ATLAS_STRIDE };
}

export type GroundTileKind = 'bright' | 'dark';

/** Quarter-turns clockwise applied when drawing. Only 90 degrees either way
 *  is ever needed, and only for the flat dark tiles. */
export type QuarterTurns = 0 | 1 | 3;

export interface GroundAtlasEntry {
  sx: number;
  sy: number;
  rotation: QuarterTurns;
  kind: GroundTileKind;
}

/**
 * The vertical banding rule: a tile whose top edge faces open space is the
 * exposed surface and is bright; anything with terrain above it is buried and
 * dark. The bottom edge does not enter into it — a one-tile-tall platform is
 * just as much a surface as the top of a deep mass.
 *
 * This is deliberately independent of `GROUND_ATLAS` below.
 * `GroundAtlas.test.ts` asserts every table entry's `kind` agrees with it, so
 * editing this function surfaces exactly which entries need re-pointing.
 */
export function groundTileKind(mask: number): GroundTileKind {
  return (mask & NEIGHBOUR_UP) === 0 ? 'bright' : 'dark';
}

/**
 * Which atlas cell each of the 16 neighbour masks draws from. Pure data, so
 * re-pointing a shape — or swapping the whole sheet for another material —
 * is an edit to values only.
 *
 * Comments name the sides whose borders ARE drawn (the mask's clear bits).
 *
 * Because the bottom edge never affects a top-exposed tile's cell, masks
 * 0/2/8/10 share the cells of 4/6/12/14. Cells `c0r0`, `c1r0`, `c2r0` and
 * `c3r1` are therefore unreferenced — they are still in the sheet, just not
 * used by any mask.
 */
const GROUND_ATLAS: Record<number, GroundAtlasEntry> = {
  0: { ...cell(6, 0), rotation: 0, kind: 'bright' }, //   T L R - air all round; bottom edge ignored
  1: { ...cell(0, 2), rotation: 0, kind: 'dark' }, //     B L R - bottom of a one-wide column
  2: { ...cell(3, 0), rotation: 0, kind: 'bright' }, //   T L   - left end of a surface run
  3: { ...cell(0, 1), rotation: 0, kind: 'dark' }, //     B L   - bottom-left corner
  4: { ...cell(6, 0), rotation: 0, kind: 'bright' }, //   T L R - top of a one-wide column
  5: { ...cell(4, 1), rotation: 0, kind: 'dark' }, //       L R - middle of a one-wide column
  6: { ...cell(3, 0), rotation: 0, kind: 'bright' }, //   T L   - top-left corner
  7: { ...cell(1, 1), rotation: 1, kind: 'dark' }, //       L   - left edge, bottom-edge tile turned CW
  8: { ...cell(5, 0), rotation: 0, kind: 'bright' }, //   T   R - right end of a surface run
  9: { ...cell(2, 1), rotation: 0, kind: 'dark' }, //     B R   - bottom-right corner
  10: { ...cell(4, 0), rotation: 0, kind: 'bright' }, //  T     - middle of a surface run
  11: { ...cell(1, 1), rotation: 0, kind: 'dark' }, //     B    - bottom edge
  12: { ...cell(5, 0), rotation: 0, kind: 'bright' }, //  T   R - top-right corner
  13: { ...cell(1, 1), rotation: 3, kind: 'dark' }, //         R - right edge, bottom-edge tile turned CCW
  14: { ...cell(4, 0), rotation: 0, kind: 'bright' }, //  T     - top edge
  15: { ...cell(5, 1), rotation: 0, kind: 'dark' }, //  (none)  - fully buried interior
};

export function groundAtlasCell(mask: number): GroundAtlasEntry {
  const entry = GROUND_ATLAS[mask];
  if (!entry) {
    throw new Error(`No ground atlas entry for neighbour mask ${mask}`);
  }
  return entry;
}

/** Grass is a separate overlay keyed by horizontal run position, so no
 *  ground tile carries grass of its own. */
const GRASS_CELLS: Record<RunPosition, { sx: number; sy: number }> = {
  left: cell(1, 2),
  middle: cell(2, 2),
  right: cell(3, 2),
  single: cell(4, 2),
};

export function grassCell(position: RunPosition): { sx: number; sy: number } {
  return GRASS_CELLS[position];
}
