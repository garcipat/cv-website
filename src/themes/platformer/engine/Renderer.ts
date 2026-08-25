import { isSolid, tileAt, isTopExposed, tileToPixel, TILE_SIZE, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef, TileType } from '../level/LevelData';

function tileSource(
  level: LevelDef,
  type: TileType,
  col: number,
  row: number,
): { sx: number; sy: number } | null {
  switch (type) {
    case 'groundGrass':
      return isTopExposed(level, col, row)
        ? { sx: 0, sy: 0 }
        : { sx: 0, sy: TILE_SIZE };
    case 'groundRock':
      return isTopExposed(level, col, row)
        ? { sx: TILE_SIZE, sy: 0 }
        : { sx: TILE_SIZE, sy: TILE_SIZE };
    case 'platform':
      return { sx: 0, sy: 0 };
    case 'wall':
      return { sx: 8 * TILE_SIZE, sy: 0 };
    case 'bridge':
      return { sx: 9 * TILE_SIZE, sy: 2 * TILE_SIZE };
    default:
      return null;
  }
}

export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  tileset: HTMLImageElement,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const tile = tileAt(level, col, row);
      if (!isSolid(tile)) continue;

      const source = tileSource(level, tile, col, row);
      if (!source) continue;

      const { x, y } = tileToPixel(col, row);
      ctx.drawImage(
        tileset,
        source.sx,
        source.sy,
        TILE_SIZE,
        TILE_SIZE,
        x,
        y,
        RENDERED_TILE_SIZE,
        RENDERED_TILE_SIZE,
      );
    }
  }
}
