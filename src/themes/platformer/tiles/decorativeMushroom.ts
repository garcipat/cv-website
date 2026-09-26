import { RENDERED_TILE_SIZE, TILE_SIZE } from '../level/Terrain';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `decorativeMushroom` — the small non-behaving dressing mushroom (`s`). No
 * rules of any kind, fogged; drawn in the terrain band. Owns the fixed sprite
 * relocated from `entities/blocks/Mushroom.ts` (US4/T038).
 */

/** The small mushroom's fixed cell (col 2, row 0 of the red row of
 *  `mushroom.png`) — drawn whole, never split and never squashed. */
export const MUSHROOM_DECORATIVE_ENTRY = { sx: 32, sy: 0 };

function draw(rc: TileDrawContext): void {
  const { ctx, destX, destY, images } = rc;
  const mushroom = images.mushroom;
  if (!mushroom) return;
  // A single fixed cell; the small mushroom's art already sits in the lower
  // part of its 16px cell.
  ctx.drawImage(
    mushroom,
    MUSHROOM_DECORATIVE_ENTRY.sx, MUSHROOM_DECORATIVE_ENTRY.sy,
    TILE_SIZE, TILE_SIZE,
    destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
}

export const decorativeMushroomModule = {
  char: 's',
  fogExempt: false,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
