import { RENDERED_TILE_SIZE, TILE_SIZE } from '../level/Terrain';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `wall` — the solid masonry structure tile (`#`). Solid, fog-exempt, drawn in
 * the terrain band.
 */
function draw(rc: TileDrawContext): void {
  const { ctx, destX, destY, images } = rc;
  ctx.drawImage(
    images.tileset, 8 * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE,
    destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
}

export const wallModule = {
  char: '#',
  fogExempt: true,
  solid: true,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
