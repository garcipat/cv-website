import { TILE_SIZE, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { BlockPlacement } from '../level/BlockMapper';
import { BLOCK_TYPES } from './blocks';
import { frameSource } from './sprites/SpriteSheet';

/** Blocks are drawn from `world_tileset.png` — the same image and tile size
 *  as terrain (16px native, 32px rendered) — so no separate sprite sheet or
 *  dimensions are needed. */
export const BLOCK_FRAME_SIZE = TILE_SIZE;
export const BLOCK_RENDERED_SIZE = RENDERED_TILE_SIZE;

export type BlockKind = 'crate' | 'questionMark' | 'fragileRock';

/**
 * Sprite-sheet source rect (in `world_tileset.png`) for a block's current
 * visual state, by kind and `hitsTaken`. A hit question-mark does not swap
 * to a `!` indicator tile — that would read as still-a-special-block rather
 * than "used up" — so it swaps to the plain top-exposed `groundRock` terrain
 * tile instead, at tile (col 1, row 0) — the same coordinates `Renderer.ts`'s
 * `tileSource` uses for exposed `groundRock` terrain, so a used-up
 * question-mark blends into ordinary ground rather than reading as a
 * distinct block type. Every other kind/hit-count combination keeps
 * rendering its one intact tile forever — crate's crack is a separate
 * overlay (see `crateCrackOverlayVisible`), not a frame swap, and
 * fragileRock/crate are removed from the world entirely once used up rather
 * than swapping tile. `hitsTaken` defaults to 0 so render-only call sites
 * that don't track hit state still get a valid frame.
 */
export function blockFrameSource(blockKind: BlockKind, hitsTaken = 0): { sx: number; sy: number } {
  const { sprite } = BLOCK_TYPES[blockKind];
  return frameSource(sprite.sheet, BLOCK_TYPES[blockKind].frameIndex(hitsTaken));
}

/** Hits required to fully use up a block, by kind — crate takes 2 (crack then
 *  shatter); question-mark and fragileRock each take just 1 (spec.md FR-022b/c). */
export function maxHitsForBlock(blockKind: BlockKind): number {
  return BLOCK_TYPES[blockKind].maxHits;
}

export type BlockAnimState = 'idle' | 'bump' | 'shatter';

/**
 * Live per-instance hit/animation state for a placed block — mirrors
 * `Enemy.ts`'s `EnemyState extends EnemyPlacement` pattern. `animState`
 * cycles `'idle' -> 'bump' -> ('shatter' -> ) 'idle'` on every hit (see
 * `BlockAI.ts`'s `stepBlockAnimation`) — `'shatter'` is reachable only for a
 * `crate` on its terminal (2nd) hit; question-mark/fragileRock go straight back to
 * `'idle'` after their bump.
 */
export interface BlockState extends BlockPlacement {
  hitsTaken: number;
  animState: BlockAnimState;
  /** Seconds elapsed since entering the current `animState` — meaningless
   *  while `'idle'`. */
  animTimer: number;
}

/** Converts a placed-but-static `BlockPlacement` into its initial live state —
 *  no hits taken, idle. */
export function toBlockState(placement: BlockPlacement): BlockState {
  return { ...placement, hitsTaken: 0, animState: 'idle', animTimer: 0 };
}

/** Whether this block has taken all the hits its kind responds to — it may
 *  still be mid-animation (bump/shatter) even once true; see `isBlockRemoved`
 *  for whether it's actually gone from the world yet. */
export function isBlockUsedUp(block: BlockState): boolean {
  return block.hitsTaken >= maxHitsForBlock(block.blockKind);
}

/**
 * Whether this block should be filtered out of the live world entirely —
 * true once a crate or fragileRock is used up AND its post-hit animation (bump,
 * then shatter for crate) has finished settling back to `'idle'`. A
 * question-mark is NEVER removed — spec.md FR-022b: it "permanently changes
 * to its matching `!` terrain tile" and stays a solid, present block forever;
 * only its rendered tile (via `blockFrameSource`) changes.
 */
export function isBlockRemoved(block: BlockState): boolean {
  if (!BLOCK_TYPES[block.blockKind].removeWhenUsedUp) return false;
  return isBlockUsedUp(block) && block.animState === 'idle';
}

/**
 * Applies one upward hit: increments `hitsTaken` and enters the shared
 * `'bump'` nudge animation from frame zero (FR-022d — every upward hit, not
 * just intermediate ones, plays this). A no-op (returns the same reference)
 * if the block is already used up — callers (`PlatformerPage.tsx`) are
 * expected to already exclude used-up blocks from `hitBlockIds` before
 * calling this, but this guard keeps the function safe to call
 * unconditionally regardless.
 */
export function applyBlockHit(block: BlockState): BlockState {
  if (isBlockUsedUp(block)) return block;
  return { ...block, hitsTaken: block.hitsTaken + 1, animState: 'bump', animTimer: 0 };
}

/** Whether a crate's cracked-overlay sprite (`crack_overlay.png`) should be
 *  composited over its base tile — only between its first hit (cracked) and
 *  second hit (shattered/removed), never on an intact or fully-broken
 *  crate. */
export function crateCrackOverlayVisible(hitsTaken: number): boolean {
  return hitsTaken === 1;
}
