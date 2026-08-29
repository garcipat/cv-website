import type { BlockState } from '../entities/Block';

/** How long the shared bump/nudge animation plays on every upward hit
 *  (FR-022d: "roughly 100ms"). */
export const BLOCK_BUMP_DURATION_SECONDS = 0.1;

/** How far the block nudges upward at the peak of its bump, in rendered px —
 *  small and quick, just enough to read as tactile feedback. */
export const BLOCK_BUMP_HEIGHT_PX = 6;

/** How long a crate's shatter (fade-out) plays after its terminal hit's bump
 *  finishes, before it's removed from the world. No dedicated shatter sprite
 *  sheet exists (same tileset gap step 20 already worked around) — a fade is
 *  built entirely from the already-loaded crate tile, no new asset needed. */
export const CRATE_SHATTER_DURATION_SECONDS = 0.25;

/**
 * Advances one block's shared bump/shatter animation by `dt` seconds. A no-op
 * (same reference) while `'idle'` — hit application (`Block.ts`'s
 * `applyBlockHit`) is what enters `'bump'` in the first place; this function
 * only ever advances/exits an animation already in progress, same
 * convention as `EnemyAI.ts`'s `stepEnemyHitReaction`.
 *
 * `'bump'` always transitions to `'idle'` once `BLOCK_BUMP_DURATION_SECONDS`
 * elapses — UNLESS this is a crate that just took its terminal (2nd) hit
 * (`blockKind === 'crate' && hitsTaken >= maxHitsForBlock('crate')`), in which
 * case it enters `'shatter'` instead. `'shatter'` (crate only) transitions
 * back to `'idle'` once `CRATE_SHATTER_DURATION_SECONDS` elapses; the caller
 * (`PlatformerPage.tsx`) is what actually removes a used-up block from the
 * world once `Block.ts`'s `isBlockRemoved` reports true for that final
 * `'idle'` state.
 */
export function stepBlockAnimation(block: BlockState, dt: number): BlockState {
  if (block.animState === 'bump') {
    const animTimer = block.animTimer + dt;
    if (animTimer < BLOCK_BUMP_DURATION_SECONDS) {
      return { ...block, animTimer };
    }
    if (block.blockKind === 'crate' && block.hitsTaken >= 2) {
      return { ...block, animTimer: 0, animState: 'shatter' };
    }
    return { ...block, animTimer: 0, animState: 'idle' };
  }
  if (block.animState === 'shatter') {
    const animTimer = block.animTimer + dt;
    if (animTimer < CRATE_SHATTER_DURATION_SECONDS) {
      return { ...block, animTimer };
    }
    return { ...block, animTimer: 0, animState: 'idle' };
  }
  return block;
}

/**
 * Vertical render offset (rendered px, negative = upward, matching the
 * canvas y axis) for the shared bump animation — a triangle wave rising to
 * `-BLOCK_BUMP_HEIGHT_PX` at the bump's midpoint and settling back to 0 by
 * its end, so the block visibly nudges up then drops back into place. Zero
 * outside `'bump'` (including `'shatter'` and `'idle'`, matching
 * `stepBlockAnimation`'s "no-op while idle" convention).
 */
export function blockBumpOffsetY(block: BlockState): number {
  if (block.animState !== 'bump') return 0;
  const t = Math.max(0, Math.min(1, block.animTimer / BLOCK_BUMP_DURATION_SECONDS));
  const phase = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
  return phase === 0 ? 0 : -BLOCK_BUMP_HEIGHT_PX * phase;
}

/**
 * Opacity (0-1) to draw a crate at — 1 (fully opaque) unless it's currently
 * `'shatter'`ing, in which case it linearly fades to 0 over
 * `CRATE_SHATTER_DURATION_SECONDS`. Meaningless for question-mark/rock (which
 * never enter `'shatter'`) — Renderer.ts only calls this for `blockKind ===
 * 'crate'`.
 */
export function crateShatterOpacity(block: BlockState): number {
  if (block.animState !== 'shatter') return 1;
  return Math.max(0, 1 - block.animTimer / CRATE_SHATTER_DURATION_SECONDS);
}
