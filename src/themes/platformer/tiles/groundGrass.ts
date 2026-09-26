import { NEIGHBOUR_UP, RENDER_SCALE, RENDERED_TILE_SIZE, TILE_SIZE, horizontalRunPosition, neighbourMask, tileAt } from '../level/Terrain';
import type { RunPosition } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { atlasCell, type TileAtlasEntry } from '../shared/tileAtlas';
import { drawRotatedTile } from './draw';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `groundGrass` — the bright surface soil tile (`G`). Solid, fog-exempt, drawn
 * in the terrain band. Owns the ground atlas tables relocated from
 * `engine/GroundAtlas.ts` (US4/T024).
 */

/** Grass sprites occupy only the top 9px of their cell; the rest is
 *  transparent so the ground tile beneath shows through. */
export const GRASS_SOURCE_HEIGHT = 9;

export type GroundTileKind = 'bright' | 'dark';

export interface GroundAtlasEntry extends TileAtlasEntry {
  kind: GroundTileKind;
}

/**
 * The vertical banding rule: a tile whose top edge faces open space is the
 * exposed surface and is bright; anything with terrain above it is buried and
 * dark. The bottom edge does not enter into it — a one-tile-tall platform is
 * just as much a surface as the top of a deep mass.
 *
 * This is deliberately independent of `GROUND_ATLAS` below.
 * `groundGrass.test.ts` asserts every table entry's `kind` agrees with it, so
 * editing this function surfaces exactly which entries need re-pointing.
 */
export function groundTileKind(mask: number): GroundTileKind {
  return (mask & NEIGHBOUR_UP) === 0 ? 'bright' : 'dark';
}

/**
 * Which atlas cell each of the 16 neighbour masks draws from. Pure data, so
 * re-pointing a shape — or swapping the whole sheet for another material — is an
 * edit to values only.
 *
 * Comments name the sides whose borders ARE drawn (the mask's clear bits).
 *
 * A one-tile-tall shape (masks 0/2/8/10) closes its bottom edge, so it does NOT
 * share a cell with the top of a taller run (4/6/12/14), which leaves that edge
 * open. Masks 2, 8 and 10 get their shapes by rotating `c6r0` and `c6r1`, whose
 * artwork is flat enough that turning a border onto an adjacent edge reads
 * correctly. Mask 0 uses `c0r0`, the sheet's only all-four-sides-closed cell;
 * its artwork still carries the old vertical ramp, and it is kept anyway —
 * deliberately — because nothing else borders all four sides, with a half turn
 * putting the bright end of the ramp in the band visible below the grass.
 *
 * Cells `c1r0`, `c2r0` and `c3r1` are unreferenced — still in the sheet, just
 * not used by any mask. `c6r1` is referenced (mask 10) and is not a spare.
 */
const GROUND_ATLAS: Record<number, GroundAtlasEntry> = {
  0: { ...atlasCell(0, 0), rotation: 2, kind: 'bright' }, // T B L R - isolated single tile, half-turned
  1: { ...atlasCell(0, 2), rotation: 0, kind: 'dark' }, //     B L R - bottom of a one-wide column
  2: { ...atlasCell(6, 0), rotation: 3, kind: 'bright' }, // T B L   - left end of a one-tall run
  3: { ...atlasCell(0, 1), rotation: 0, kind: 'dark' }, //     B L   - bottom-left corner
  4: { ...atlasCell(6, 0), rotation: 0, kind: 'bright' }, //   T L R - top of a one-wide column
  5: { ...atlasCell(4, 1), rotation: 0, kind: 'dark' }, //       L R - middle of a one-wide column
  6: { ...atlasCell(3, 0), rotation: 0, kind: 'bright' }, //   T L   - top-left corner
  7: { ...atlasCell(1, 1), rotation: 1, kind: 'dark' }, //       L   - left edge, bottom-edge tile turned CW
  8: { ...atlasCell(6, 0), rotation: 1, kind: 'bright' }, // T B   R - right end of a one-tall run
  9: { ...atlasCell(2, 1), rotation: 0, kind: 'dark' }, //     B R   - bottom-right corner
  10: { ...atlasCell(6, 1), rotation: 1, kind: 'bright' }, // T B    - middle of a one-tall run
  11: { ...atlasCell(1, 1), rotation: 0, kind: 'dark' }, //     B    - bottom edge
  12: { ...atlasCell(5, 0), rotation: 0, kind: 'bright' }, //  T   R - top-right corner
  13: { ...atlasCell(1, 1), rotation: 3, kind: 'dark' }, //         R - right edge, bottom-edge tile turned CCW
  14: { ...atlasCell(4, 0), rotation: 0, kind: 'bright' }, //  T     - top edge
  15: { ...atlasCell(5, 1), rotation: 0, kind: 'dark' }, //  (none)  - fully buried interior
};

export function groundAtlasCell(mask: number): GroundAtlasEntry {
  const entry = GROUND_ATLAS[mask];
  if (!entry) {
    throw new Error(`No ground atlas entry for neighbour mask ${mask}`);
  }
  return entry;
}

/** Grass is a separate overlay keyed by horizontal run position, so no ground
 *  tile carries grass of its own. */
const GRASS_CELLS: Record<RunPosition, { sx: number; sy: number }> = {
  left: atlasCell(1, 2),
  middle: atlasCell(2, 2),
  right: atlasCell(3, 2),
  single: atlasCell(4, 2),
};

export function grassCell(position: RunPosition): { sx: number; sy: number } {
  return GRASS_CELLS[position];
}

/**
 * Grass continues into a horizontal neighbour only when that neighbour is
 * itself a grass-topped surface cell. A `groundRock` neighbour, or a
 * `groundGrass` one that is buried because the terrain steps up, caps the run
 * instead — so this adds a material check on top of the ground mask's notion of
 * exposure. Exposure is read from the mask's UP bit rather than `isTopExposed`
 * so that a bridge overhead counts as open space here exactly as it does when
 * the ground cell is chosen.
 */
function isGrassSurface(level: LevelDef, col: number, row: number): boolean {
  return (
    tileAt(level, col, row) === 'groundGrass' &&
    (neighbourMask(level, col, row) & NEIGHBOUR_UP) === 0
  );
}

/** The ground-atlas cell plus the grass overlay for this cell. */
function draw(rc: TileDrawContext): void {
  const { ctx, level, col, row, destX, destY, images } = rc;
  const mask = neighbourMask(level, col, row);
  drawRotatedTile(ctx, images.groundAtlas, groundAtlasCell(mask), destX, destY);

  if ((mask & NEIGHBOUR_UP) === 0) {
    const grass = grassCell(horizontalRunPosition(level, col, row, isGrassSurface));
    ctx.drawImage(
      images.groundAtlas, grass.sx, grass.sy, TILE_SIZE, GRASS_SOURCE_HEIGHT,
      destX, destY, RENDERED_TILE_SIZE, GRASS_SOURCE_HEIGHT * RENDER_SCALE,
    );
  }
}

export const groundGrassModule = {
  char: 'G',
  fogExempt: true,
  solid: true,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
