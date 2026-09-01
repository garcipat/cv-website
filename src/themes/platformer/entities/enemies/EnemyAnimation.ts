import type { SpriteDescriptor } from '../sprites/SpriteSheet';

/** Patrol uses constant-slide movement — a patrolling enemy is always in
 *  motion — so there is no reachable idle state. The frames 3-7 loop reads
 *  fine as movement and is reused for `walk`. */
export type EnemyAnimState = 'walk' | 'hit';

export const WALK_FRAME_DURATION = 0.15;
const HIT_FRAME_DURATION = 0.1;

export const ENEMY_ANIMATIONS: SpriteDescriptor['animations'] = {
  walk: { frames: [3, 4, 5, 6, 7], frameDuration: WALK_FRAME_DURATION },
  hit: { frames: [8, 9, 10, 11], frameDuration: HIT_FRAME_DURATION },
};

/** Number of frames in the walk loop — used to stagger enemies' starting
 *  frames so they don't animate in lockstep. */
export function walkAnimFrameCount(): number {
  return ENEMY_ANIMATIONS.walk.frames.length;
}

/** Sheet frame index for a given animation state and animation-frame counter.
 *  Frames are indices into the sheet, so a loop crossing a row boundary — the
 *  walk loop does — needs no special handling here. */
export function enemyFrameIndex(animState: EnemyAnimState, animFrame: number): number {
  const { frames } = ENEMY_ANIMATIONS[animState];
  return frames[animFrame % frames.length];
}
