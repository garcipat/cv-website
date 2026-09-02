import { NEIGHBOUR_UP, NEIGHBOUR_DOWN } from '../level/Terrain';
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

export type GroundTileKind = 'bright' | 'gradient' | 'dark';

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
 * The vertical banding rule: the bright band is always exactly the topmost
 * cell of a vertical run, everything below it is dark, and the gradient is
 * used only when a run is a single cell tall (that cell being both the
 * surface and the underside). Both facts follow from the cell's own two
 * vertical edges, so no row counting is needed.
 *
 * This is deliberately independent of `GROUND_ATLAS` below.
 * `GroundAtlas.test.ts` asserts every table entry's `kind` agrees with it, so
 * editing this function surfaces exactly which entries need re-pointing.
 */
export function groundTileKind(mask: number): GroundTileKind {
  const topClosed = (mask & NEIGHBOUR_UP) === 0;
  if (!topClosed) return 'dark';

  const bottomClosed = (mask & NEIGHBOUR_DOWN) === 0;
  return bottomClosed ? 'gradient' : 'bright';
}

/**
 * Which atlas cell each of the 16 neighbour masks draws from. Pure data, so
 * re-pointing a shape — or swapping the whole sheet for another material —
 * is an edit to values only.
 *
 * Comments name the sides whose borders ARE drawn (the mask's clear bits).
 */
const GROUND_ATLAS: Record<number, GroundAtlasEntry> = {
  0: { ...cell(0, 0), rotation: 0, kind: 'gradient' }, // T B L R - isolated single cell
  1: { ...cell(0, 2), rotation: 0, kind: 'dark' }, //     B L R - bottom of a one-wide column
  2: { ...cell(1, 0), rotation: 0, kind: 'gradient' }, // T B L   - left end of a one-tall strip
  3: { ...cell(0, 1), rotation: 0, kind: 'dark' }, //     B L   - bottom-left corner
  4: { ...cell(6, 0), rotation: 0, kind: 'bright' }, //   T L R - top of a one-wide column
  5: { ...cell(4, 1), rotation: 0, kind: 'dark' }, //       L R - middle of a one-wide column
  6: { ...cell(3, 0), rotation: 0, kind: 'bright' }, //   T L   - top-left corner
  7: { ...cell(1, 1), rotation: 1, kind: 'dark' }, //       L   - left edge, bottom-edge tile turned CW
  8: { ...cell(2, 0), rotation: 0, kind: 'gradient' }, // T B R - right end of a one-tall strip
  9: { ...cell(2, 1), rotation: 0, kind: 'dark' }, //     B R   - bottom-right corner
  10: { ...cell(3, 1), rotation: 0, kind: 'gradient' }, // T B  - middle of a one-tall strip
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
