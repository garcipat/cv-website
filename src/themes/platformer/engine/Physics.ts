import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, isSolidExcludingBridge, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_SIDE_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';

/**
 * One frame's worth of player input. `left`/`right` default to no movement so
 * gravity-only call sites (and existing tests) keep working unchanged.
 * `jumpPressed` is edge-triggered (true only on the frame the key was
 * pressed — see `Input.ts`'s `consumePress`); `jumpHeld` is a level check
 * (true for every frame the key is down — see `Input.ts`'s `isHeld`). Both
 * default to `false`.
 */
export interface PlayerInput {
  left?: boolean;
  right?: boolean;
  jumpPressed?: boolean;
  jumpHeld?: boolean;
  dropThroughHeld?: boolean;
}

const NO_INPUT: PlayerInput = { left: false, right: false };

/**
 * Width of the actual collision hitbox — narrower than PLAYER_RENDERED_SIZE
 * (the full render slot) and centered within it, matching where the visible
 * sprite is always drawn (see Renderer.ts's drawPlayer: it draws at this
 * same fixed offset within the slot regardless of facing — only the
 * artwork mirrors, never the position). Used uniformly below for horizontal
 * wall collision, vertical ground/ceiling collision, and world bounds, so
 * there's one single definition of "where the character actually is" that
 * rendering and every collision check agree on.
 */
const HITBOX_WIDTH = PLAYER_RENDERED_SIZE - 2 * PLAYER_SIDE_PADDING;

/**
 * Resolves one frame of horizontal movement/collision, then jump/gravity and
 * vertical collision, against the level's solid tiles.
 */
export function stepPlayerPhysics(
  player: PlayerState,
  level: LevelDef,
  dt: number,
  input: PlayerInput = NO_INPUT,
): PlayerState {
  const moveRight = input.right && !input.left;
  const moveLeft = input.left && !input.right;
  // `vx` reflects commanded/intended velocity from input, not realized
  // displacement — a wall or world-bounds clamp below may prevent `x` from
  // actually changing this frame even though `vx` stays non-zero. Any future
  // code that infers "the player moved" (dust particles, camera easing) from
  // `vx !== 0` should account for that.
  const vx = moveRight ? PHYSICS_CONFIG.walkSpeed : moveLeft ? -PHYSICS_CONFIG.walkSpeed : 0;
  const facing = moveRight ? 'right' : moveLeft ? 'left' : player.facing;

  let x = player.x + vx * dt;
  // Excludes the head-padding sliver (like the vertical ceiling check below)
  // so a solid tile directly above the character's transparent head-padding
  // band doesn't register as a horizontal wall collision when nothing is
  // visually beside the character.
  const topRow = Math.floor((player.y + PLAYER_HEAD_PADDING) / RENDERED_TILE_SIZE);
  // Excludes the foot-padding sliver (like the vertical ground check below)
  // so standing on solid ground doesn't register as a horizontal wall
  // collision on every frame the player tries to walk.
  const bottomRow = Math.floor(
    (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - 1) / RENDERED_TILE_SIZE,
  );

  if (vx > 0) {
    const rightCol = Math.floor(
      (x + PLAYER_SIDE_PADDING + HITBOX_WIDTH - 1) / RENDERED_TILE_SIZE,
    );
    // The hitbox's rightmost column *before* this frame's horizontal move
    // (using the pre-move `player.x`). If that's the same column as
    // `rightCol` above, the hitbox was already occupying this column when
    // the frame started — e.g. mid pass-through while jumping up through a
    // bridge, or while actively dropping through one (both let the vertical
    // branches carry the hitbox into/through a `bridge` tile's row for many
    // frames). In that case a `bridge` tile here isn't a new sideways
    // collision, so it must not block (isSolidExcludingBridge). Only a
    // genuinely NEW column — approaching the tile from the side, as in
    // `walkingIntoBridgeFromSide-blockedLikeAnyWall` — still treats bridge
    // as solid, exactly like any other wall.
    const prevRightCol = Math.floor(
      (player.x + PLAYER_SIDE_PADDING + HITBOX_WIDTH - 1) / RENDERED_TILE_SIZE,
    );
    const isWall = rightCol === prevRightCol ? isSolidExcludingBridge : isSolid;
    for (let row = topRow; row <= bottomRow; row++) {
      if (isWall(tileAt(level, rightCol, row))) {
        x = rightCol * RENDERED_TILE_SIZE - PLAYER_SIDE_PADDING - HITBOX_WIDTH;
        break;
      }
    }
  } else if (vx < 0) {
    const leftCol = Math.floor((x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
    // Mirrors the rightward branch above: only a bridge tile in a column the
    // hitbox wasn't already occupying before this frame's move still blocks.
    const prevLeftCol = Math.floor((player.x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
    const isWall = leftCol === prevLeftCol ? isSolidExcludingBridge : isSolid;
    for (let row = topRow; row <= bottomRow; row++) {
      if (isWall(tileAt(level, leftCol, row))) {
        x = (leftCol + 1) * RENDERED_TILE_SIZE - PLAYER_SIDE_PADDING;
        break;
      }
    }
  }

  const maxX = level.width * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
  x = Math.max(-PLAYER_SIDE_PADDING, Math.min(x, maxX));

  // Jump trigger (FR-006): a fixed upward impulse, only while grounded — no
  // double jump. Ignored entirely while already airborne.
  const jumpStarts = player.grounded && Boolean(input.jumpPressed);
  let vy = jumpStarts ? PHYSICS_CONFIG.jumpVelocity : player.vy;
  vy = Math.min(vy + PHYSICS_CONFIG.gravity * dt, PHYSICS_CONFIG.terminalVelocity);

  // Variable jump height (FR-006): releasing the jump key while still
  // ascending cuts the velocity short via a multiplier instead of a fixed
  // clamp, so the resulting height scales with how long the key was held
  // before release rather than snapping to one fixed "short hop" value.
  if (!input.jumpHeld && vy < 0) {
    vy *= PHYSICS_CONFIG.jumpCutMultiplier;
  }

  let y = player.y + vy * dt;
  let grounded = false;
  let resolvedVy = vy;

  const leftCol = Math.floor((x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
  const rightCol = Math.floor((x + PLAYER_SIDE_PADDING + HITBOX_WIDTH - 1) / RENDERED_TILE_SIZE);

  // Drop-through trigger: pressing Down while already resting on a bridge
  // lets the character deliberately fall through it (the base one-way
  // behavior alone only lets you leave a bridge by walking off its edge).
  // Detected against the tile the player is currently standing on, using
  // the pre-frame `y` — so holding Down elsewhere (mid-air, or standing on
  // regular solid ground) has no effect. Once triggered, the flag persists
  // across frames (a single frame's gravity rarely clears a whole 32px
  // tile from a standing start) until the character actually lands on
  // something solid again, at which point it's cleared in the return below.
  const standingFootRow = Math.floor(
    (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING) / RENDERED_TILE_SIZE,
  );
  let standingOnBridge = false;
  for (let col = leftCol; col <= rightCol; col++) {
    if (tileAt(level, col, standingFootRow) === 'bridge') {
      standingOnBridge = true;
      break;
    }
  }
  const droppingThroughBridge =
    player.isDroppingThroughBridge ||
    (player.grounded && standingOnBridge && Boolean(input.dropThroughHeld));

  if (vy < 0) {
    // Ceiling collision: symmetric to the landing case below, but for the
    // player's head hitting a solid tile from underneath while rising.
    // PLAYER_HEAD_PADDING accounts for the transparent rows above the
    // sprite's actual head, so this triggers when the VISIBLE head reaches
    // the tile, not when the top of the (mostly-empty) frame does.
    // Uses isSolidExcludingBridge (not isSolid) so `bridge` tiles are
    // passable from underneath while remaining solid everywhere else
    // (roadmap step 7).
    const headY = y + PLAYER_HEAD_PADDING;
    const headRow = Math.floor(headY / RENDERED_TILE_SIZE);
    for (let col = leftCol; col <= rightCol; col++) {
      if (isSolidExcludingBridge(tileAt(level, col, headRow))) {
        y = (headRow + 1) * RENDERED_TILE_SIZE - PLAYER_HEAD_PADDING;
        resolvedVy = 0;
        break;
      }
    }
  } else {
    const feetY = y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
    const footRow = Math.floor(feetY / RENDERED_TILE_SIZE);
    // While actively dropping through a bridge, ground collision ignores
    // bridge tiles the same way the ceiling check always does — everything
    // else (regular ground, platforms, walls) still catches the character.
    const groundIsSolid = droppingThroughBridge ? isSolidExcludingBridge : isSolid;

    for (let col = leftCol; col <= rightCol; col++) {
      if (groundIsSolid(tileAt(level, col, footRow))) {
        const groundSurfaceY = footRow * RENDERED_TILE_SIZE;
        y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
        resolvedVy = 0;
        grounded = true;
        break;
      }
    }
  }

  return {
    ...player,
    x,
    y,
    vx,
    vy: resolvedVy,
    facing,
    grounded,
    isDroppingThroughBridge: grounded ? false : droppingThroughBridge,
  };
}
