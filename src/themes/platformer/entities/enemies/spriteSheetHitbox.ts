import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { BaseEnemyState } from './EnemyType';
import type { Rect } from '../geometry';

/**
 * The collision box shared by every sprite-sheet enemy: the render slot
 * `drawSpriteSheetEntity` blits into (bottom-anchored, horizontally centered
 * over the placement tile), inset by the sprite's own transparent margins so
 * the box coincides with the visible, rounded silhouette rather than the
 * full square slot. `paddingNative` is in pre-scale pixels and scales with
 * the sprite exactly as the frame itself does, so a bigger slime gets a
 * proportionally bigger inset instead of a fixed one. There is no bottom
 * inset: a slime's feet already touch the native frame's bottom edge.
 *
 * Size and offsets are computed from `sprite` here rather than imported from
 * Enemy.ts — enemies/ modules never import Enemy.ts, which depends on this
 * directory through ENEMY_TYPES, so importing it back would create a
 * load-order cycle. Same reasoning as drawSpriteSheetEntity.ts's own note.
 */
export function spriteSheetHitbox(
  enemy: BaseEnemyState,
  sprite: SpriteDescriptor,
  paddingNative: { side: number; top: number },
): Rect {
  const scale = RENDER_SCALE * sprite.renderScale;
  const size = sprite.sheet.frameWidth * scale;
  const sidePad = paddingNative.side * scale;
  const topPad = paddingNative.top * scale;
  return {
    x: enemy.x + (RENDERED_TILE_SIZE - size) / 2 + sidePad,
    y: enemy.y + (RENDERED_TILE_SIZE - size) + topPad,
    width: size - 2 * sidePad,
    height: size - topPad,
  };
}
