import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_FOOT_PADDING,
  PLAYER_HEAD_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import { isSolid, tileAt, tileToPixel, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';

/**
 * Draws the player's actual collision geometry and the level's solid tiles
 * on top of the normal render, so collision bugs (e.g. the head-padding and
 * ground/ceiling column-span bugs found in `Physics.ts`) are visible without
 * manual pixel-measurement. Toggled by `?debug=hitboxes` in `PlatformerPage`.
 * Uses only stroked (unfilled) shapes so the sprite/terrain underneath stays
 * visible.
 */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  level: LevelDef,
  originY: number,
): void {
  ctx.lineWidth = 1;

  // Full collision hitbox (red).
  ctx.strokeStyle = 'red';
  ctx.strokeRect(player.x, player.y + originY, PLAYER_RENDERED_SIZE, PLAYER_RENDERED_SIZE);

  // Narrower "visible window" used by the ground/ceiling checks (yellow).
  const visibleLeft = player.x + PLAYER_SIDE_PADDING;
  const visibleRight = player.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING - 1;
  ctx.strokeStyle = 'yellow';
  ctx.strokeRect(visibleLeft, player.y + originY, visibleRight - visibleLeft, PLAYER_RENDERED_SIZE);

  // Head-collision row line (cyan).
  const headY = player.y + PLAYER_HEAD_PADDING + originY;
  ctx.strokeStyle = 'cyan';
  ctx.beginPath();
  ctx.moveTo(visibleLeft, headY);
  ctx.lineTo(visibleRight, headY);
  ctx.stroke();

  // Foot-collision row line (magenta).
  const footY = player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING + originY;
  ctx.strokeStyle = 'magenta';
  ctx.beginPath();
  ctx.moveTo(visibleLeft, footY);
  ctx.lineTo(visibleRight, footY);
  ctx.stroke();

  // Solid terrain tiles (green).
  ctx.strokeStyle = 'green';
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      if (!isSolid(tileAt(level, col, row))) continue;
      const { x, y } = tileToPixel(col, row);
      ctx.strokeRect(x, y + originY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    }
  }
}
