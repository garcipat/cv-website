import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { HazardFacing } from '../../level/LevelParser';
import { STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { TILE_SIZE, RENDERED_TILE_SIZE, RENDER_SCALE } from '../../level/Terrain';
import { SIDE_HIT_DAMAGE } from '../Health';
import type { Rect } from '../geometry';

/**
 * Native tile coordinates (columns 3-4, rows 6-7 of staticObjects.png, 16px
 * tiles) of each facing's pre-drawn sprite — the artist already drew all 4
 * orientations, so no runtime rotation is needed. Confirmed against the
 * actual asset before this module was written:
 *   up    (floor spike, tip up):    column 3, row 7
 *   down  (ceiling spike, tip down): column 4, row 6
 *   right (mounted on a left wall):  column 3, row 6
 *   left  (mounted on a right wall): column 4, row 7
 */
const FACING_TILE: Record<HazardFacing, { col: number; row: number }> = {
  up: { col: 3, row: 7 },
  down: { col: 4, row: 6 },
  right: { col: 3, row: 6 },
  left: { col: 4, row: 7 },
};

function spriteCoords(facing: HazardFacing): { sx: number; sy: number } {
  const { col, row } = FACING_TILE[facing];
  return { sx: col * TILE_SIZE, sy: row * TILE_SIZE };
}

/**
 * The visible spiky pixels' own native-tile band, per facing — measured
 * directly from the actual sprite (every facing's art occupies only 5 of
 * the tile's 16 native rows/columns, on the side its tip points away from:
 * up's spikes sit in the bottom 5 rows and point up into empty space above
 * them, down's sit in the top 5 rows, right's in the left 5 columns
 * (mounted on a wall to the left), left's in the right 5 columns). Only
 * this band is hazardous — a player passing through the rest of the tile
 * (e.g. jumping well clear of a floor spike's tip) never takes damage,
 * unlike an earlier design that made the whole tile hazardous regardless
 * of facing. `BAND_NATIVE` is one length (how many native px the visible
 * band spans) since every facing's band is the same size, just anchored to
 * a different edge.
 */
const BAND_NATIVE = 5;

function facingBox(hazard: HazardPlacement): Rect {
  const band = BAND_NATIVE * RENDER_SCALE;
  switch (hazard.facing) {
    case 'up':
      return { x: hazard.x, y: hazard.y + RENDERED_TILE_SIZE - band, width: RENDERED_TILE_SIZE, height: band };
    case 'down':
      return { x: hazard.x, y: hazard.y, width: RENDERED_TILE_SIZE, height: band };
    case 'right':
      return { x: hazard.x, y: hazard.y, width: band, height: RENDERED_TILE_SIZE };
    case 'left':
      return { x: hazard.x + RENDERED_TILE_SIZE - band, y: hazard.y, width: band, height: RENDERED_TILE_SIZE };
  }
}

export const spike: HazardType<HazardPlacement> & { spriteCoords: typeof spriteCoords } = {
  key: 'spike',
  damage: SIDE_HIT_DAMAGE,
  spriteCoords,
  box: facingBox,
  draw: (hazard, dc) => {
    const image = dc.sprites[STATIC_OBJECTS_SHEET.src];
    if (!image) return;
    const { sx, sy } = spriteCoords(hazard.facing);
    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      TILE_SIZE,
      TILE_SIZE,
      hazard.x + dc.originX,
      hazard.y + dc.originY,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  },
};
