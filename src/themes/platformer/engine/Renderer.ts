import {
  isSolid,
  tileAt,
  isTopExposed,
  bridgeRunPosition,
  tileToPixel,
  TILE_SIZE,
  RENDERED_TILE_SIZE,
} from '../level/Terrain';
import type { LevelDef, TileType } from '../level/LevelData';
import {
  PLAYER_FRAME_SIZE,
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  playerFrameSource,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';

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
    case 'bridge': {
      const position = bridgeRunPosition(level, col, row);
      if (position === 'left') return { sx: 9 * TILE_SIZE, sy: 2 * TILE_SIZE }; // ramp down
      if (position === 'right') return { sx: 11 * TILE_SIZE, sy: 2 * TILE_SIZE }; // ramp up
      return { sx: 10 * TILE_SIZE, sy: 2 * TILE_SIZE }; // low (middle, or a lone single tile)
    }
    case 'empty':
      return null;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/**
 * Draws the level's terrain. `originY` shifts every tile vertically (e.g. to
 * anchor the level to the bottom of a taller-than-the-level canvas instead
 * of drawing it pinned to the top with empty space below). Defaults to 0
 * (level drawn at its raw grid position, top-left origin).
 */
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  tileset: HTMLImageElement,
  originY = 0,
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
        y + originY,
        RENDERED_TILE_SIZE,
        RENDERED_TILE_SIZE,
      );
    }
  }
}

/**
 * Draws the player sprite. `originY` shifts it vertically by the same
 * amount as `drawTerrain`'s `originY`, so the player stays aligned with
 * the bottom-anchored level. When `player.facing` is `'left'`, the sprite is
 * mirrored horizontally around its own bounding box — the sheet only needs
 * to depict the character facing one direction.
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  spriteSheet: HTMLImageElement,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  const { sx, sy } = playerFrameSource(player.animState, player.animFrame);

  if (player.facing === 'left') {
    ctx.save();
    ctx.translate(player.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING, player.y + originY);
    ctx.scale(-1, 1);
    ctx.drawImage(
      spriteSheet,
      sx,
      sy,
      PLAYER_FRAME_SIZE,
      PLAYER_FRAME_SIZE,
      0,
      0,
      PLAYER_RENDERED_SIZE,
      PLAYER_RENDERED_SIZE,
    );
    ctx.restore();
    return;
  }

  ctx.drawImage(
    spriteSheet,
    sx,
    sy,
    PLAYER_FRAME_SIZE,
    PLAYER_FRAME_SIZE,
    player.x + PLAYER_SIDE_PADDING,
    player.y + originY,
    PLAYER_RENDERED_SIZE,
    PLAYER_RENDERED_SIZE,
  );
}
