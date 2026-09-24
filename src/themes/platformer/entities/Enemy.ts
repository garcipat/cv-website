import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { EnemyPlacement } from '../level/EnemyMapper';
import { ENEMY_TYPES, typeOf } from './enemies';
import type { EnemyState, EnemyTypeKey } from './enemies';
import { resolveAnimation } from './enemies/EnemyAnimation';
import { takeHit } from './enemies/shared';

/**
 * Enemy behavior that is the same for every type. Everything that differs per
 * type — hit points, render scale, patrol speed, hitbox padding, sprite sheet
 * and animations — lives in that type's own module under `entities/enemies/`
 * and is read from `ENEMY_TYPES` here.
 */

export type { EnemyState } from './enemies';
export type { EnemyAnimState } from './enemies/EnemyAnimation';
export { WALK_FRAME_DURATION } from './enemies/EnemyAnimation';
export type { Direction as EnemyDirection } from '../contracts/geometry';

/** Actual rendered size for a given type — the sheet's native frame scaled by
 *  RENDER_SCALE and the type's own render scale. Renderer.ts's drawEnemies
 *  and DebugOverlay.ts's render slot both call this, so a bigger purple slime
 *  gets a proportionally bigger draw rect. */
export function enemyRenderedSize(type: EnemyTypeKey): number {
  const { sheet, renderScale } = ENEMY_TYPES[type].sprite;
  return sheet.frameWidth * RENDER_SCALE * renderScale;
}

/** Per-type horizontal centering offset — the rendered sprite is wider than
 *  one tile, so it is centered over its placement tile. */
export function enemyTileOffsetX(type: EnemyTypeKey): number {
  return (RENDERED_TILE_SIZE - enemyRenderedSize(type)) / 2;
}

/**
 * Per-type bottom-anchoring offset. The frame is shifted down by the kind's
 * own `hitboxPaddingNative.bottom` inset so the VISIBLE art's bottom edge
 * rests on the placement row (FR-019). A bottom-anchored sheet declares
 * `bottom: 0`, which reproduces the pre-seam formula exactly.
 */
export function enemyTileOffsetY(type: EnemyTypeKey): number {
  return RENDERED_TILE_SIZE - enemyRenderedSize(type) + enemyHitboxBottomPadding(type);
}

/** A world-space anchor point + size scale for a one-shot visual effect at
 *  this enemy's position — see engine/CollectionEffects.ts's PuffEffect and
 *  B-003 (docs/bugs/B-003-puff-bound-to-fact-reward/ticket.md). Centred on
 *  the collision hitbox (`typeOf(enemy).box(enemy)`), not the render slot: a
 *  slime's actual opaque silhouette sits bottom-anchored with a big
 *  transparent gap above it — see SlimePurple.ts's HITBOX_PADDING_NATIVE doc
 *  comment and its held-key placement code, which centers against the same
 *  hitbox for the same reason. Scale still comes from the per-type render
 *  size drawEnemies already uses, so a purple slime's puff scales up right
 *  along with its bigger sprite. */
export interface EffectAnchor {
  x: number;
  y: number;
  scale: number;
}

export function enemyEffectAnchor(enemy: EnemyState): EffectAnchor {
  const type = enemy.type as EnemyTypeKey;
  const size = enemyRenderedSize(type);
  const box = typeOf(enemy).box(enemy);
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    scale: size / ENEMY_RENDERED_SIZE,
  };
}

/** Rendered size of a green slime — the baseline enemy size. */
export const ENEMY_RENDERED_SIZE = enemyRenderedSize('slimeGreen');

/** Green-slime tile offsets, for call sites that predate per-type sizing. */
export const ENEMY_TILE_OFFSET_X = enemyTileOffsetX('slimeGreen');
export const ENEMY_TILE_OFFSET_Y = enemyTileOffsetY('slimeGreen');

/**
 * Per-type collision-hitbox side inset — scaled the same way
 * enemyRenderedSize scales the frame itself, so the inset grows
 * proportionally with a bigger slime instead of staying a fixed pixel amount.
 * Insets the collision box away from the sprite's transparent corners: a
 * slime's silhouette is rounded, not a filled square, so a hitbox spanning
 * the full render slot would register a hit against visibly empty space.
 * Same convention as Player.ts's PLAYER_SIDE_PADDING/PLAYER_HEAD_PADDING.
 */
export function enemyHitboxSidePadding(type: EnemyTypeKey): number {
  const { hitboxPaddingNative, sprite } = ENEMY_TYPES[type];
  return hitboxPaddingNative.side * RENDER_SCALE * sprite.renderScale;
}

/** Per-type collision-hitbox top inset — see enemyHitboxSidePadding. */
export function enemyHitboxTopPadding(type: EnemyTypeKey): number {
  const { hitboxPaddingNative, sprite } = ENEMY_TYPES[type];
  return hitboxPaddingNative.top * RENDER_SCALE * sprite.renderScale;
}

/** Per-type collision-hitbox bottom inset — see enemyHitboxSidePadding.
 *  Pulls the box's bottom edge up to the visible art's bottom (FR-019); a
 *  bottom-anchored sheet declares `0` and leaves the box's bottom edge at the
 *  render slot's bottom, exactly as before this inset existed. */
export function enemyHitboxBottomPadding(type: EnemyTypeKey): number {
  const { hitboxPaddingNative, sprite } = ENEMY_TYPES[type];
  return hitboxPaddingNative.bottom * RENDER_SCALE * sprite.renderScale;
}

/**
 * The enemy factory: converts a placed-but-static `EnemyPlacement` (which
 * may carry the CV fact this enemy drops on defeat — see `EnemyMapper.ts`'s
 * `courseToEnemy`; a "plain" enemy beyond its color's CVData course count has
 * no fact and drops nothing — unaffected by this function) into its initial
 * live patrol state, by handing it to the type's own module.
 *
 * `index` (the enemy's position among all placed enemies — see
 * PlatformerState.ts's call site) offsets the starting walk frame/timer so
 * multiple enemies don't all animate in perfect lockstep. Defaults to 0 so a
 * single ad-hoc enemy (e.g. in a test) still gets deterministic behavior.
 */
export function toEnemyState(placement: EnemyPlacement, index = 0): EnemyState {
  return ENEMY_TYPES[placement.type].create(placement, index);
}

/**
 * Returns an enemy reset to its spawn state, preserving every field that
 * represents session progress rather than a moment in a life. Called by
 * `PlatformerState.ts`'s `resetGame()` on every enemy after a player death,
 * living or dead.
 *
 * `animFrame`/`animTimer` are deliberately left alone: `toEnemyState`
 * staggers them per enemy so multiple enemies don't animate in lockstep, and
 * zeroing them here would collapse that stagger back to a shared start state
 * after the first player death. This is safe because a dead enemy is always
 * revived from a frame reached while `animState` was `'hit'`, whose frame
 * count is less than or equal to `walk`'s.
 *
 * `rewardGiven` is deliberately NOT reset: an enemy that has already paid out
 * its fact or its dropped item revives as a normal, killable obstacle that has
 * nothing further to give. Only `resetGameProgress()` (the Reset Game button)
 * clears that, by rebuilding the array from placements.
 */
export function reviveEnemy(enemy: EnemyState): EnemyState {
  return typeOf(enemy).revive(enemy);
}

/**
 * Applies `amount` hit points of damage to an enemy through the shared hit
 * pipeline: one `takeHit` per point — starting the `hit` reaction and dropping
 * `hitPoints` by `amount` — then the type's own `onDamaged` hook, so any
 * type-specific consequence (a purple slime's temporary defense, say) is
 * layered on exactly as it is for a stomp.
 *
 * Defeat is deliberately NOT decided here: `stepEnemyHitReaction` checks
 * `hitPoints` once the reaction finishes, so the enemy always plays the same
 * brief stun before dying. Used by the bomb blast (O-012), which deals more
 * than a stomp's single point rather than killing outright.
 */
export function applyEnemyDamage(enemy: EnemyState, amount: number): EnemyState {
  if (amount <= 0) return enemy;
  let next = enemy;
  for (let i = 0; i < amount; i++) next = takeHit(next);
  const type = typeOf(next);
  return type.onDamaged ? type.onDamaged(next, amount) : next;
}

/** Advances the enemy's animation timer/frame by `dt` seconds — same
 *  convention as Player.ts's advancePlayerAnimation. Resolves the animation
 *  through the kind's OWN table, falling back to its `defaultAnimState` when
 *  the current state is missing (FR-009). */
export function advanceEnemyAnimation(enemy: EnemyState, dt: number): EnemyState {
  const type = typeOf(enemy);
  const { frames, frameDuration } = resolveAnimation(
    type.sprite,
    enemy.animState,
    type.defaultAnimState,
  );
  const animTimer = enemy.animTimer + dt;
  if (animTimer < frameDuration) {
    return { ...enemy, animTimer };
  }
  return {
    ...enemy,
    animTimer: animTimer - frameDuration,
    animFrame: (enemy.animFrame + 1) % frames.length,
  };
}
