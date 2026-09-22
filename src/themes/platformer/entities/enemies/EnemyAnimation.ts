import type { SpriteDescriptor } from '../sprites/SpriteSheet';

/** A kind's own animation-state name. Widened from `'walk' | 'hit'` to
 *  `string`: the `SelfAnimated.animState` capability is already `string`, and
 *  each kind names its own states (`walk`/`hit` for the slimes, `fly` for the
 *  bee). The alias is kept for continuity with existing imports. */
export type EnemyAnimState = string;

export type EnemyAnimations = SpriteDescriptor['animations'];

export const WALK_FRAME_DURATION = 0.15;
const HIT_FRAME_DURATION = 0.1;

/** The slimes' own table — still the source of truth for `slimeGreen` and
 *  `slimePurple`. A kind with different states authors its own table instead
 *  (see entities/enemies/Bee.ts). */
export const ENEMY_ANIMATIONS: SpriteDescriptor['animations'] = {
  walk: { frames: [3, 4, 5, 6, 7], frameDuration: WALK_FRAME_DURATION },
  hit: { frames: [8, 9, 10, 11], frameDuration: HIT_FRAME_DURATION },
};

/**
 * The animation a kind plays for `state`, or its resting state when the kind
 * does not define `state` (FR-009). Never returns `undefined` for a kind
 * whose `defaultAnimState` exists in its own table — the invariant the
 * contract test asserts for every registered kind.
 */
export function resolveAnimation(
  sprite: SpriteDescriptor,
  state: string,
  fallbackState: string,
): { frames: number[]; frameDuration: number } {
  return sprite.animations[state] ?? sprite.animations[fallbackState];
}

/** Sheet frame index for a state, resolved through the kind's own table.
 *  Frames are indices into the sheet, so a loop crossing a row boundary
 *  needs no special handling here. */
export function enemyFrameIndex(
  sprite: SpriteDescriptor,
  state: string,
  frame: number,
  fallbackState: string,
): number {
  const { frames } = resolveAnimation(sprite, state, fallbackState);
  return frames[frame % frames.length];
}
