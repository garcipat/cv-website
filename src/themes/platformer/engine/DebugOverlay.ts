import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_FOOT_PADDING,
  PLAYER_HEAD_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import { enemyRenderedSize, enemyTileOffsetX, enemyTileOffsetY } from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';
import { typeOf } from '../entities/enemies';
import { isSolid, tileAt, tileToPixel, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';

/**
 * Draws the player's actual collision geometry, every enemy's render slot
 * and collision hitbox, and the level's solid tiles on top of the normal
 * render, so collision bugs (e.g. the head-padding and ground/ceiling
 * column-span bugs found in `Physics.ts`) are visible without manual
 * pixel-measurement. Toggled by `?debug=hitboxes` in `PlatformerPage`. Uses
 * only stroked (unfilled) shapes so the sprite/terrain underneath stays
 * visible. `originX`/`originY` shift all drawn shapes to match the camera's
 * current scroll offset. Color meaning is shared across entities — red
 * always means "full render slot, not used for collision" and yellow
 * always means "the actual collision hitbox", whether the box belongs to
 * the player or an enemy.
 */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  level: LevelDef,
  originX: number,
  originY: number,
  enemies: EnemyState[] = [],
): void {
  ctx.lineWidth = 1;

  // Full render slot (red) — where the sprite is drawn, not the hitbox.
  ctx.strokeStyle = 'red';
  ctx.strokeRect(player.x + originX, player.y + originY, PLAYER_RENDERED_SIZE, PLAYER_RENDERED_SIZE);

  // Narrower collision hitbox (yellow) — used by ALL collision checks
  // (horizontal, vertical, and world bounds).
  const visibleLeft = player.x + PLAYER_SIDE_PADDING;
  const visibleRight = player.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING - 1;
  ctx.strokeStyle = 'yellow';
  ctx.strokeRect(
    visibleLeft + originX,
    player.y + originY,
    visibleRight - visibleLeft,
    PLAYER_RENDERED_SIZE,
  );

  // Head-collision row line (cyan).
  const headY = player.y + PLAYER_HEAD_PADDING + originY;
  ctx.strokeStyle = 'cyan';
  ctx.beginPath();
  ctx.moveTo(visibleLeft + originX, headY);
  ctx.lineTo(visibleRight + originX, headY);
  ctx.stroke();

  // Foot-collision row line (magenta).
  const footY = player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING + originY;
  ctx.strokeStyle = 'magenta';
  ctx.beginPath();
  ctx.moveTo(visibleLeft + originX, footY);
  ctx.lineTo(visibleRight + originX, footY);
  ctx.stroke();

  // Solid terrain tiles (green).
  ctx.strokeStyle = 'green';
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      if (!isSolid(tileAt(level, col, row))) continue;
      const { x, y } = tileToPixel(col, row);
      ctx.strokeRect(x + originX, y + originY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    }
  }

  // Enemies: full render slot (red) — where the sprite is drawn, not the
  // hitbox — and the narrower collision hitbox (yellow) that
  // resolveEnemyContacts actually uses. Same
  // colors as the player's own render-slot/hitbox pair above, so the same
  // color always means the same collision concept regardless of which
  // entity it's drawn on. A dead enemy (`!alive`) is skipped — collision
  // ignores it entirely (see resolveEnemyContacts in Collision.ts), so
  // drawing a hitbox for one
  // here would misrepresent what's actually collidable.
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const size = enemyRenderedSize(enemy.type);
    ctx.strokeStyle = 'red';
    ctx.strokeRect(
      enemy.x + enemyTileOffsetX(enemy.type) + originX,
      enemy.y + enemyTileOffsetY(enemy.type) + originY,
      size,
      size,
    );

    const box = typeOf(enemy).box(enemy);
    ctx.strokeStyle = 'yellow';
    ctx.strokeRect(box.x + originX, box.y + originY, box.width, box.height);
  }
}
