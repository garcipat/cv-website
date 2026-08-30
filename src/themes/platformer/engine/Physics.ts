import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, isSolidExcludingBridge, isClimbable, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { isBlockOccupied, blockIdAt } from '../level/BlockMapper';
import type { BlockPlacement } from '../level/BlockMapper';
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
 * default to `false`. `suppressJumpCut` is a one-off override for the frame a
 * stomp bounce (roadmap step 18) was just applied to `player.vy` before this
 * call — without it, the variable-jump-height cut below would immediately
 * shrink the bounce impulse on the overwhelmingly common case where the jump
 * key isn't currently held, defeating the bounce almost entirely. Defaults to
 * `false`.
 */
export interface PlayerInput {
  left?: boolean;
  right?: boolean;
  jumpPressed?: boolean;
  jumpHeld?: boolean;
  /** Held state of Up/`W` (roadmap step 23) — continuous, like movement,
   *  not edge-triggered like `jumpPressed`: climbing is driven every frame
   *  the key is down, not just once on press. */
  climbUpHeld?: boolean;
  dropThroughHeld?: boolean;
  suppressJumpCut?: boolean;
}

const NO_INPUT: PlayerInput = { left: false, right: false };
const NO_BLOCKS: readonly BlockPlacement[] = [];

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
  blockPlacements: readonly BlockPlacement[] = NO_BLOCKS,
): PlayerState {
  // While a side-hit's knockback is still active (roadmap step 19), held
  // movement keys are ignored entirely and the knockback velocity/facing set
  // by Player.ts's `applyKnockback` is held steady — otherwise this branch
  // would recompute `vx` from input every single frame (as it does normally)
  // and silently erase the knockback the instant this function next runs.
  const knockbackActive = player.knockbackTimer > 0;
  const moveRight = !knockbackActive && input.right && !input.left;
  const moveLeft = !knockbackActive && input.left && !input.right;
  // `vx` reflects commanded/intended velocity from input, not realized
  // displacement — a wall or world-bounds clamp below may prevent `x` from
  // actually changing this frame even though `vx` stays non-zero. Any future
  // code that infers "the player moved" (dust particles, camera easing) from
  // `vx !== 0` should account for that.
  const vx = knockbackActive
    ? player.vx
    : moveRight
      ? PHYSICS_CONFIG.walkSpeed
      : moveLeft
        ? -PHYSICS_CONFIG.walkSpeed
        : 0;
  const facing = knockbackActive ? player.facing : moveRight ? 'right' : moveLeft ? 'left' : player.facing;

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
      if (isWall(tileAt(level, rightCol, row)) || isBlockOccupied(blockPlacements, rightCol, row)) {
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
      if (isWall(tileAt(level, leftCol, row)) || isBlockOccupied(blockPlacements, leftCol, row)) {
        x = (leftCol + 1) * RENDERED_TILE_SIZE - PLAYER_SIDE_PADDING;
        break;
      }
    }
  }

  const maxX = level.width * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
  x = Math.max(-PLAYER_SIDE_PADDING, Math.min(x, maxX));

  // Climbing (roadmap step 23, FR-006): checked against the row at the
  // player's CURRENT (pre-vertical-move) feet position, using this frame's
  // already-resolved horizontal `x` — deliberately feet-only, not the whole
  // hitbox, so climbing ends almost exactly at the ladder's top edge instead
  // of overshooting into the solid tile above it (a whole-hitbox check would
  // keep climbing true until the character's HEAD also clears the ladder, by
  // which point the feet are already a tile or more above it).
  const climbLeftCol = Math.floor((x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
  const climbRightCol = Math.floor(
    (x + PLAYER_SIDE_PADDING + HITBOX_WIDTH - 1) / RENDERED_TILE_SIZE,
  );
  const feetRow = Math.floor(
    (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - 1) / RENDERED_TILE_SIZE,
  );
  const columnsAreClimbable = (row: number): boolean => {
    for (let col = climbLeftCol; col <= climbRightCol; col++) {
      if (isClimbable(tileAt(level, col, row))) return true;
    }
    return false;
  };
  const onLadderNow = columnsAreClimbable(feetRow);
  const climbUpHeld = Boolean(input.climbUpHeld);
  const climbDownHeld = Boolean(input.dropThroughHeld);

  let climbing = player.climbing;
  if (climbing) {
    // Continue only while still over a ladder tile and not jump-cancelled.
    climbing = onLadderNow && !input.jumpPressed;
  } else if (onLadderNow && (climbUpHeld || climbDownHeld)) {
    // Fresh entry: overlapping a ladder column and pressing Up/Down.
    climbing = true;
  } else if (player.grounded && climbDownHeld && columnsAreClimbable(feetRow + 1)) {
    // Fresh entry from above: standing on the solid tile directly above a
    // ladder's top rung, pressing Down re-enters the climb downward — mirrors
    // the drop-through-bridge trigger below, but checked one row LOWER (the
    // ladder starts the row BELOW the tile the character rests on, unlike a
    // bridge, which the character rests ON TOP of directly).
    climbing = true;
  }

  if (climbing) {
    const vy = climbUpHeld ? -PHYSICS_CONFIG.climbSpeed : climbDownHeld ? PHYSICS_CONFIG.climbSpeed : 0;
    return {
      ...player,
      x,
      y: player.y + vy * dt,
      vx,
      vy,
      facing,
      grounded: false,
      climbing: true,
      isDroppingThroughBridge: false,
      knockbackTimer: Math.max(0, player.knockbackTimer - dt),
      bounceAscending: false,
      hitBlockIds: [],
    };
  }

  // Jump trigger (FR-006): a fixed upward impulse while grounded, OR while
  // cancelling a climb (roadmap step 23) — climbing always reports
  // `grounded: false` above, so the plain grounded-only check would silently
  // swallow a jump press that's meant to cancel a climb.
  const climbJumpCancelled = player.climbing && Boolean(input.jumpPressed);
  const jumpStarts = (player.grounded || climbJumpCancelled) && Boolean(input.jumpPressed);
  let vy = jumpStarts
    ? PHYSICS_CONFIG.jumpVelocity
    : player.climbing
      ? 0 // just exited climbing (reached the top, or walked off) — fall from rest, not from the old climb speed
      : player.vy;
  vy = Math.min(vy + PHYSICS_CONFIG.gravity * dt, PHYSICS_CONFIG.terminalVelocity);

  if (player.climbing) {
    // Just exited climbing this very frame (roadmap step 23) — either
    // reached the ladder's top/walked off it under gravity, or cancelled
    // via jump (both are detected above; if execution reaches here, this
    // frame's `climbing` local is already false). The character's hitbox is
    // still positioned exactly where the climbing branch left it — right
    // against (or slightly inside) the solid tile it was climbing next to —
    // so running this frame's normal ground/ceiling collision and
    // variable-jump-height cut would immediately (and wrongly) snap it back
    // onto that tile or shear a fresh cancel-jump's impulse, one tick
    // before either check is actually meaningful. Skipping both for this
    // one transitional frame lets the exit register cleanly (falling from
    // rest, or launching at full jump impulse); normal collision resumes
    // from the very next frame's now-accurate position.
    return {
      ...player,
      x,
      y: player.y + vy * dt,
      vx,
      vy,
      facing,
      grounded: false,
      climbing: false,
      isDroppingThroughBridge: false,
      knockbackTimer: Math.max(0, player.knockbackTimer - dt),
      bounceAscending: false,
      hitBlockIds: [],
    };
  }

  // Variable jump height (FR-006): releasing the jump key while still
  // ascending cuts the velocity short via a multiplier instead of a fixed
  // clamp, so the resulting height scales with how long the key was held
  // before release rather than snapping to one fixed "short hop" value.
  // Skipped for the whole ascent of a stomp bounce (`player.bounceAscending`
  // — set by `PlatformerPage.tsx` the tick the bounce is applied, persisted
  // across ticks here) — that impulse isn't a jump the player is "holding",
  // so it must reach its full intended height regardless of jump-key state.
  // `input.suppressJumpCut` (a single-tick override) is kept too for
  // whatever else might need it, but `bounceAscending` is what actually
  // protects a bounce: this cut re-applies EVERY tick the key isn't held,
  // not just once, so a one-tick-only override left every later ascending
  // frame of the SAME bounce unprotected and sheared it down to ~45% of its
  // configured magnitude regardless of how large it was set (found via live
  // testing).
  const suppressJumpCutThisFrame = input.suppressJumpCut || player.bounceAscending;
  if (!input.jumpHeld && vy < 0 && !suppressJumpCutThisFrame) {
    vy *= PHYSICS_CONFIG.jumpCutMultiplier;
  }

  let y = player.y + vy * dt;
  let grounded = false;
  // Stricter than `grounded`: true only when EVERY column the hitbox spans
  // at the foot row is solid, not just one. `grounded` itself stays lenient
  // (any spanned column solid counts, so the character doesn't feel like it
  // falls the instant it's not 100% supported on a ledge) — but that leniency
  // means `grounded` can stay true while the character is mostly hanging
  // over a gap with only a sliver of hitbox still on solid ground. Recording
  // that precarious position as the pit-fall recovery anchor would reposition
  // the character back to a spot that still looks like it's floating over
  // the pit (and can immediately re-trigger another fall). `fullyGrounded`
  // is only used below, for `lastGroundedX/Y` — never for `grounded` itself.
  let fullyGrounded = false;
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

  const hitBlockIds: string[] = [];
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
    let ceilingResolved = false;
    for (let col = leftCol; col <= rightCol; col++) {
      const blockId = blockIdAt(blockPlacements, col, headRow);
      const solid = isSolidExcludingBridge(tileAt(level, col, headRow)) || blockId !== undefined;
      if (!solid) continue;
      // Position is resolved against only the FIRST solid column found
      // (matches the pre-existing single-collision behavior) — but every
      // column at this row is scanned so a block spanning any of them is
      // still reported in `hitBlockIds`, even if it wasn't the column that
      // stopped the ascent.
      if (!ceilingResolved) {
        y = (headRow + 1) * RENDERED_TILE_SIZE - PLAYER_HEAD_PADDING;
        resolvedVy = 0;
        ceilingResolved = true;
      }
      if (blockId !== undefined) hitBlockIds.push(blockId);
    }
  } else {
    const feetY = y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
    const footRow = Math.floor(feetY / RENDERED_TILE_SIZE);
    // While actively dropping through a bridge, ground collision ignores
    // bridge tiles the same way the ceiling check always does — everything
    // else (regular ground, platforms, walls) still catches the character.
    const groundIsSolid = droppingThroughBridge ? isSolidExcludingBridge : isSolid;

    for (let col = leftCol; col <= rightCol; col++) {
      if (groundIsSolid(tileAt(level, col, footRow)) || isBlockOccupied(blockPlacements, col, footRow)) {
        const groundSurfaceY = footRow * RENDERED_TILE_SIZE;
        y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
        resolvedVy = 0;
        grounded = true;
        break;
      }
    }

    if (grounded) {
      fullyGrounded = true;
      for (let col = leftCol; col <= rightCol; col++) {
        if (!groundIsSolid(tileAt(level, col, footRow)) && !isBlockOccupied(blockPlacements, col, footRow)) {
          fullyGrounded = false;
          break;
        }
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
    climbing: false,
    isDroppingThroughBridge: grounded ? false : droppingThroughBridge,
    lastGroundedX: fullyGrounded ? x : player.lastGroundedX,
    lastGroundedY: fullyGrounded ? y : player.lastGroundedY,
    knockbackTimer: Math.max(0, player.knockbackTimer - dt),
    // Stays true only while still actually ascending — clears itself the
    // moment the bounce's apex passes (resolvedVy >= 0) or a ceiling stops
    // it early, so it never lingers into a later, unrelated jump.
    bounceAscending: player.bounceAscending && resolvedVy < 0,
    hitBlockIds,
  };
}

/**
 * Whether the player has fallen below the bottom of the level's tile grid —
 * a pit fall. Deliberately position-only (no tile lookup): a column with no
 * solid tile anywhere lets gravity carry the player past `level.height`
 * tiles indefinitely (see Terrain.ts's tileAt, which returns 'empty' for any
 * out-of-bounds row), so crossing that line is an unambiguous signal
 * regardless of the level's layout.
 */
export function checkPitFall(player: PlayerState, level: LevelDef): boolean {
  const feetY = player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
  return feetY > level.height * RENDERED_TILE_SIZE;
}

/**
 * Recovers from a pit fall by snapping the character back to the last
 * position it was resting on solid ground (`lastGroundedX/Y`), rather than a
 * level spawn/checkpoint (that full-respawn behavior is roadmap step 10's
 * 0-heart case). Velocity is zeroed and `grounded` is set true so the very
 * next frame doesn't read as still-falling; `isDroppingThroughBridge` is
 * cleared since the character can't still be mid-drop-through after being
 * teleported back onto solid ground. `animState`/`animFrame`/`animTimer` are
 * deliberately left untouched (via spread) — `PlatformerPage.tsx`'s loop
 * calls `updatePlayerAnimState` on this function's result (in that order),
 * which re-derives `animState` from the corrected `grounded` flag before
 * anything renders, so there's no frame where a stale fall/jump animation
 * state is visible on screen.
 */
export function resolvePitFall(player: PlayerState): PlayerState {
  return {
    ...player,
    x: player.lastGroundedX,
    y: player.lastGroundedY,
    vx: 0,
    vy: 0,
    grounded: true,
    isDroppingThroughBridge: false,
  };
}
