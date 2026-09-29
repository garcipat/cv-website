import { RENDERED_TILE_SIZE, TILE_SIZE, isTopExposed } from '../level/Terrain';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `groundRock` — the dark buried rock tile (`R`). Solid, fog-exempt, drawn in
 * the terrain band. Two sprites: the exposed surface cell (top row) and the
 * buried cell, selected by `isTopExposed`.
 */
function draw(rc: TileDrawContext): void {
  const { ctx, level, col, row, destX, destY, images } = rc;
  const sy = isTopExposed(level, col, row) ? 0 : TILE_SIZE;
  ctx.drawImage(
    images.tileset,
    TILE_SIZE,
    sy,
    TILE_SIZE,
    TILE_SIZE,
    destX,
    destY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
}

export const groundRockModule = {
  char: 'R',
  fogExempt: true,
  solid: true,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
