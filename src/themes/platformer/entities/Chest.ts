import { RENDER_SCALE } from '../level/Terrain';
import type { ChestPlacement } from '../level/ChestMapper';

/**
 * Native pixel dimensions of the two chest sprites (public/sprites/
 * chest_closed.png / chest_open.png), generated 2026-08-30 via nano-banana —
 * flat/front-facing 2D style matching the crate tile, non-square and
 * deliberately NOT the 16x16 block tile grid: a chest is a standalone placed
 * object, not wall-adjacent, so it doesn't need to tile (see spec.md's
 * Assumptions). Each is a standalone image file, not a sheet — no sx/sy
 * lookup needed, unlike Block.ts's blockFrameSource.
 */
export const CHEST_CLOSED_WIDTH = 28;
export const CHEST_CLOSED_HEIGHT = 20;
export const CHEST_OPEN_WIDTH = 24;
export const CHEST_OPEN_HEIGHT = 20;

export const CHEST_CLOSED_RENDERED_WIDTH = CHEST_CLOSED_WIDTH * RENDER_SCALE;
export const CHEST_CLOSED_RENDERED_HEIGHT = CHEST_CLOSED_HEIGHT * RENDER_SCALE;
export const CHEST_OPEN_RENDERED_WIDTH = CHEST_OPEN_WIDTH * RENDER_SCALE;
export const CHEST_OPEN_RENDERED_HEIGHT = CHEST_OPEN_HEIGHT * RENDER_SCALE;

export type ChestVisualState = 'closed' | 'open';

/**
 * Live per-instance open/closed state for a placed chest — mirrors
 * `BlockState extends BlockPlacement`. No hit-count/animation timer: opening
 * is a single, permanent, un-animated state flip (spec.md FR-023), unlike a
 * block's multi-hit progression.
 */
export interface ChestState extends ChestPlacement {
  state: ChestVisualState;
}

/** Converts a placed-but-static `ChestPlacement` into its initial live
 *  state — always starts closed. */
export function toChestState(placement: ChestPlacement): ChestState {
  return { ...placement, state: 'closed' };
}

export function isChestOpen(chest: ChestState): boolean {
  return chest.state === 'open';
}

/** Opens a chest — permanent for the rest of the session (only Reset Game,
 *  via PlatformerState.ts's resetGameProgress, puts it back to closed). A
 *  no-op (same reference) if already open, matching Block.ts's
 *  applyBlockHit's already-used-up guard convention. */
export function openChest(chest: ChestState): ChestState {
  if (chest.state === 'open') return chest;
  return { ...chest, state: 'open' };
}

/** Whether every chest in the level has been opened (spec.md FR-024's Thank
 *  You screen trigger) — false for an empty array so a level with zero
 *  chests (shouldn't happen in practice, but defensively) never
 *  spuriously "completes". */
export function allChestsOpen(chests: readonly ChestState[]): boolean {
  return chests.length > 0 && chests.every(isChestOpen);
}
