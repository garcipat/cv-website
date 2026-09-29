import { RENDERED_TILE_SIZE, TILE_SIZE, bridgeRunPosition } from '../level/Terrain';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `bridge` — the one-way walkway (`B`). Solid from above and the side, but
 * passable from below and while actively dropping through (`oneWay` +
 * `dropThrough`). Fog-exempt, drawn in the terrain band. Its run sprite is
 * picked from the cell's horizontal bridge run: ramp-down / low / ramp-up.
 */
function draw(rc: TileDrawContext): void {
  const { ctx, level, col, row, destX, destY, images } = rc;
  const position = bridgeRunPosition(level, col, row);
  let sx = 10 * TILE_SIZE; // low (middle, or a lone single tile)
  if (position === 'left')
    sx = 9 * TILE_SIZE; // ramp down
  else if (position === 'right') sx = 11 * TILE_SIZE; // ramp up
  ctx.drawImage(
    images.tileset,
    sx,
    2 * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    destX,
    destY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
}

export const bridgeModule = {
  char: 'B',
  fogExempt: true,
  solid: true,
  oneWay: true,
  dropThrough: true,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
