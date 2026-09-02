import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import { frameSource } from '../sprites/SpriteSheet';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import { enemyFrameIndex } from './EnemyAnimation';
import type { BaseEnemyState } from './EnemyType';
import type { DrawContext } from '../../engine/DrawContext';

/** Opacity every slime's body is drawn at — low enough that a purple slime's
 *  held key (see SlimePurple.ts) visibly shines through it, high enough that
 *  either slime still reads as a solid creature rather than a ghost. Applied
 *  uniformly to green slimes too (which never hold a key) purely for visual
 *  consistency between the two enemy types, not because green has anything
 *  to show through it. */
const SLIME_BODY_ALPHA = 0.78;

/**
 * The plain sprite-sheet blit shared by every enemy type: current animation
 * frame, bottom-anchored and horizontally centered over its placement tile,
 * mirrored when facing left. Left-facing enemies are mirrored via a
 * save/translate/scale(-1,1)/restore pattern, matching drawPlayer's
 * left-facing behavior.
 *
 * Size and tile offsets use the same formula as Enemy.ts's
 * enemyRenderedSize/enemyTileOffsetX/enemyTileOffsetY, computed here from
 * `sprite` directly rather than imported — entities/enemies/ modules never
 * import Enemy.ts (see shared.ts's own note on this), since Enemy.ts itself
 * depends on this directory through ENEMY_TYPES and importing it back here
 * would create a load-order cycle.
 */
export function drawSpriteSheetEntity(enemy: BaseEnemyState, dc: DrawContext, sprite: SpriteDescriptor): void {
  const { sheet, renderScale } = sprite;
  const image = dc.sprites[sheet.src];
  if (!image) return;

  const { sx, sy } = frameSource(sheet, enemyFrameIndex(enemy.animState, enemy.animFrame));
  const size = sheet.frameWidth * RENDER_SCALE * renderScale;
  const dx = enemy.x + (RENDERED_TILE_SIZE - size) / 2 + dc.originX;
  const dy = enemy.y + (RENDERED_TILE_SIZE - size) + dc.originY;

  dc.ctx.save();
  dc.ctx.globalAlpha = SLIME_BODY_ALPHA;

  if (enemy.direction === 'left') {
    // Mirrors drawPlayer's left-facing flip: translate to the sprite's right
    // edge, then scale(-1, 1) so drawImage's own (0, 0) origin lands where
    // the mirrored sprite's top-left should visually appear.
    dc.ctx.translate(dx + size, dy);
    dc.ctx.scale(-1, 1);
    dc.ctx.drawImage(image, sx, sy, sheet.frameWidth, sheet.frameHeight, 0, 0, size, size);
  } else {
    dc.ctx.drawImage(image, sx, sy, sheet.frameWidth, sheet.frameHeight, dx, dy, size, size);
  }
  dc.ctx.restore();
}
