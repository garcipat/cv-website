import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';
import type { HazardFacing } from '../../level/LevelParser';
import { STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { TILE_SIZE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import { SIDE_HIT_DAMAGE } from '../Health';

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

export const spike: HazardType<HazardPlacement> & { spriteCoords: typeof spriteCoords } = {
  key: 'spike',
  damage: SIDE_HIT_DAMAGE,
  spriteCoords,
  box: (hazard) => ({ x: hazard.x, y: hazard.y, width: RENDERED_TILE_SIZE, height: RENDERED_TILE_SIZE }),
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
