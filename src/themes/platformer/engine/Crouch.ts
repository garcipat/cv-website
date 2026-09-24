import type { LevelDef } from '../level/LevelData';
import type { BlockPlacement } from '../level/BlockMapper';
import { blockAt } from '../level/BlockMapper';
import type { PlayerState } from '../entities/Player';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  playerHeadPaddingFor,
  playerBoxHeightFor,
} from '../entities/Player';
import { hitboxInsetXForBlock } from '../entities/Block';
import { aabbOverlap } from './Collision';
import type { Box } from '../contracts/geometry';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';

/**
 * A block's real collision box — its full tile narrowed by the kind's own X
 * inset, exactly the box `Physics.ts`'s horizontal collision resolves against
 * (a pot's art is narrower than its tile). Used by `canStandUp` so a block only
 * blocks standing when the player's box would actually overlap it, not merely
 * its tile.
 */
function blockCollisionBox(block: BlockPlacement): Box {
  const inset = hitboxInsetXForBlock(block.blockKind);
  return {
    x: block.x + inset,
    y: block.y,
    width: RENDERED_TILE_SIZE - 2 * inset,
    height: RENDERED_TILE_SIZE,
  };
}

/**
 * The plain inputs to the crouch decision. Not stored: `stepPlayerPhysics`
 * builds one fresh each tick from the pre-step player state, the level and the
 * already-computed Down-context flags.
 */
export interface CrouchContext {
  /** Down/`S` is held this tick (`PlayerInput.dropThroughHeld`). */
  downHeld: boolean;
  /** The player was grounded at the start of the tick. */
  grounded: boolean;
  /** The player's `crouching` from the previous tick. */
  currentlyCrouching: boolean;
  /** Down is consumed by a higher-priority context (climbing, or grounded on a bridge). */
  downClaimed: boolean;
  /** `canStandUp(...)`: the full standing box fits in clear space. */
  canStand: boolean;
  /** The post-hit refractory window is open (`isInvulnerable`). */
  inHitReaction: boolean;
}

/**
 * Whether the player's full STANDING box (38 px) fits in clear space — the
 * single gate on standing up (FR-005/FR-006). Deliberately always measures the
 * standing box, crouched or not: a one-tile gap is not enough because the
 * standing box spans more than one tile row (research D5).
 *
 * Spans every column the hitbox covers and every row between the standing box's
 * top and the (unchanged) feet line, and returns `false` if any cell there is a
 * solid terrain tile (a `bridge` counts) or a live block. A block is tested
 * against its real collision box (per-kind X inset), not its full tile, so
 * standing beside a narrow-art block like a pot is not wrongly blocked. Never
 * throws: out-of-bounds reads resolve to `'empty'` via `tileAt`.
 */
export function canStandUp(
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  player: PlayerState,
): boolean {
  const top = player.y + playerHeadPaddingFor(false);
  const bottom = top + playerBoxHeightFor(false) - 1;
  const left = player.x + PLAYER_SIDE_PADDING;
  const right = left + (PLAYER_RENDERED_SIZE - 2 * PLAYER_SIDE_PADDING) - 1;
  const box: Box = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };

  const topRow = Math.floor(top / RENDERED_TILE_SIZE);
  const bottomRow = Math.floor(bottom / RENDERED_TILE_SIZE);
  const leftCol = Math.floor(left / RENDERED_TILE_SIZE);
  const rightCol = Math.floor(right / RENDERED_TILE_SIZE);

  for (let row = topRow; row <= bottomRow; row++) {
    for (let col = leftCol; col <= rightCol; col++) {
      if (isSolid(tileAt(level, col, row))) return false;
      const block = blockAt(blocks, col, row);
      if (block && aabbOverlap(box, blockCollisionBox(block))) return false;
    }
  }
  return true;
}

/**
 * Resolves this tick's `crouching` value from the context — the pure rule that
 * composes FR-001 (Down enters a crouch), FR-005/FR-006 (a stuck crouch is kept
 * until headroom returns) and FR-011 (a hit reaction freezes the crouch).
 *
 * - While a hit reaction is open the previous value is returned unchanged, so
 *   the one-tile box is kept for the whole window (FR-011).
 * - A voluntary crouch is requested by held Down while grounded (or already
 *   crouched, so a held Down carries through a fall) and not consumed by a
 *   higher-priority Down context (FR-009).
 * - `!canStand` only *keeps* an existing crouch; it never starts one (a crouch
 *   is always entered via Down, FR-001).
 *
 * Pure; returns a boolean; never throws; no side effects.
 */
export function resolveCrouching(ctx: CrouchContext): boolean {
  if (ctx.inHitReaction) return ctx.currentlyCrouching;
  const requested =
    ctx.downHeld && (ctx.grounded || ctx.currentlyCrouching) && !ctx.downClaimed;
  return requested || (!ctx.canStand && ctx.currentlyCrouching);
}
