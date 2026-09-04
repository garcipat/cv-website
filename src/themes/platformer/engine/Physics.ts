import { PHYSICS_CONFIG } from './PhysicsConfig';
import {
  isSolid,
  isSolidExcludingBridge,
  isClimbable,
  isStandableLadderTop,
  tileAt,
  RENDERED_TILE_SIZE,
} from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { isBlockOccupied, blockIdAt, blockAt } from '../level/BlockMapper';
import type { BlockPlacement } from '../level/BlockMapper';
import { hitboxInsetXForBlock } from '../entities/Block';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_SIDE_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import type { BlockContact } from '../entities/Player';

/**
 * One frame's worth of player input. `left`/`right` default to no movement so
 * gravity-only call sites (and existing tests) keep working unchanged.
 * `jumpPressed` is edge-triggered (true only on the frame the key was
 * pressed — see `Input.ts`'s `consumePress`); `jumpHeld` is a level check
 * (true for every frame the key is down — see `Input.ts`'s `isHeld`). Both
 * default to `false`. `suppressJumpCut` is a one-off override for the frame a
 * stomp bounce was just applied to `player.vy` before this call — without
 * it, the variable-jump-height cut below would immediately
 * shrink the bounce impulse on the overwhelmingly common case where the jump
 * key isn't currently held, defeating the bounce almost entirely. Defaults to
 * `false`.
 */
export interface PlayerInput {
  left?: boolean;
  right?: boolean;
  jumpPressed?: boolean;
  jumpHeld?: boolean;
  /** Held state of Up/`W` — continuous, like movement, not edge-triggered
   *  like `jumpPressed`: climbing is driven every frame the key is down,
   *  not just once on press. */
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
  const blockContacts: BlockContact[] = [];
  // While a side-hit's knockback is still active, held movement keys are
  // ignored entirely and the knockback velocity/direction set
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
  const direction = knockbackActive ? player.direction : moveRight ? 'right' : moveLeft ? 'left' : player.direction;

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
    let rightWallFound = false;
    // The MINIMUM inset among every row this column's wall spans, not just
    // the first one found — a coinPot's hitboxInsetX only applies safely
    // when every solid row in the same column tolerates it. Using the
    // first-found row's inset (whatever kind it happened to be) could let
    // the player resolve to a position that's still inside a DIFFERENT
    // row's full-tile (inset-0) solid terrain or block in the same column.
    // NOTE: a non-zero inset also widens which column registers as "already
    // occupying" the wall for the bridge-tunneling check above (a coinPot in
    // the player's row span could flip a same-column bridge tile to
    // passable a frame early) and joins the ground/ceiling scan spans a
    // pixel sooner than a full-tile block would. Not reachable in the
    // shipped level (no coinPot shares a column with a bridge or another
    // block today) — worth a real fix only if a future level stacks them.
    let rightMinInset = Infinity;
    for (let row = topRow; row <= bottomRow; row++) {
      if (!isWall(tileAt(level, rightCol, row)) && !isBlockOccupied(blockPlacements, rightCol, row)) continue;
      rightWallFound = true;
      // A block whose art doesn't fill its tile (e.g. coinPot) declares a
      // hitboxInsetX so the player can approach closer than the raw tile
      // boundary, matching where its sprite actually looks solid — plain
      // terrain (no block here) keeps the exact tile boundary (inset 0).
      const block = blockAt(blockPlacements, rightCol, row);
      const inset = block ? hitboxInsetXForBlock(block.blockKind) : 0;
      if (inset < rightMinInset) rightMinInset = inset;
      if (block !== undefined) blockContacts.push({ id: block.id, side: 'left' });
    }
    if (rightWallFound) {
      x = rightCol * RENDERED_TILE_SIZE + rightMinInset - PLAYER_SIDE_PADDING - HITBOX_WIDTH;
    }
  } else if (vx < 0) {
    const leftCol = Math.floor((x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
    // Mirrors the rightward branch above: only a bridge tile in a column the
    // hitbox wasn't already occupying before this frame's move still blocks.
    const prevLeftCol = Math.floor((player.x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
    const isWall = leftCol === prevLeftCol ? isSolidExcludingBridge : isSolid;
    let leftWallFound = false;
    // Mirrors the rightward branch's "minimum inset across every row this
    // column's wall spans" handling above.
    let leftMinInset = Infinity;
    for (let row = topRow; row <= bottomRow; row++) {
      if (!isWall(tileAt(level, leftCol, row)) && !isBlockOccupied(blockPlacements, leftCol, row)) continue;
      leftWallFound = true;
      const block = blockAt(blockPlacements, leftCol, row);
      const inset = block ? hitboxInsetXForBlock(block.blockKind) : 0;
      if (inset < leftMinInset) leftMinInset = inset;
      if (block !== undefined) blockContacts.push({ id: block.id, side: 'right' });
    }
    if (leftWallFound) {
      x = (leftCol + 1) * RENDERED_TILE_SIZE - leftMinInset - PLAYER_SIDE_PADDING;
    }
  }

  const maxX = level.width * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
  x = Math.max(-PLAYER_SIDE_PADDING, Math.min(x, maxX));

  // Climbing (FR-006): checked against the row at the
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
  const columnsHaveStandableLadderTop = (row: number): boolean => {
    for (let col = climbLeftCol; col <= climbRightCol; col++) {
      if (isStandableLadderTop(level, col, row)) return true;
    }
    return false;
  };
  const onLadderNow = columnsAreClimbable(feetRow);
  const climbUpHeld = Boolean(input.climbUpHeld);
  const climbDownHeld = Boolean(input.dropThroughHeld);

  let climbing = player.climbing;
  let justEnteredClimbing = false;
  if (climbing) {
    climbing = onLadderNow && !input.jumpPressed;
  } else if (onLadderNow && (climbUpHeld || climbDownHeld) && player.vy >= 0) {
    // Fresh entry: overlapping a ladder column and pressing Up/Down. The
    // `player.vy >= 0` guard stops this from immediately re-triggering the
    // very next frame after a jump-cancel
    // off a ladder — right after cancelling, the player is still briefly
    // overlapping the same row while ascending under the jump impulse; if
    // Up is still held (edge-triggered `jumpPressed` is already consumed
    // by then), this branch would otherwise fire again and undo the jump.
    // Entering while already falling or at rest (vy >= 0) is unaffected —
    // grabbing the ladder while falling past it still works normally.
    climbing = true;
    justEnteredClimbing = true;
  } else if (player.grounded && climbDownHeld && columnsAreClimbable(feetRow + 1)) {
    // Fresh entry from above: standing on the solid tile directly above a
    // ladder's top rung, pressing Down re-enters the climb downward — mirrors
    // the drop-through-bridge trigger below, but checked one row LOWER (the
    // ladder starts the row BELOW the tile the character rests on, unlike a
    // bridge, which the character rests ON TOP of directly).
    climbing = true;
    justEnteredClimbing = true;
  }

  if (climbing) {
    const vy = climbUpHeld ? -PHYSICS_CONFIG.climbSpeed : climbDownHeld ? PHYSICS_CONFIG.climbSpeed : 0;
    let climbX = x;
    if (justEnteredClimbing) {
      for (let col = climbLeftCol; col <= climbRightCol; col++) {
        if (isClimbable(tileAt(level, col, feetRow)) || isClimbable(tileAt(level, col, feetRow + 1))) {
          climbX = col * RENDERED_TILE_SIZE + RENDERED_TILE_SIZE / 2 - PLAYER_RENDERED_SIZE / 2;
          break;
        }
      }
    }
    // Climbing out at the top of the shaft. Find the shaft's topmost tile
    // from the feet's current row upward; if
    // there's room to stand on it (`isStandableLadderTop` — nothing solid
    // directly above), that tile's top edge is where the climb ends: the
    // character climbs all the way THROUGH the top tile and stops with its
    // feet exactly on top of it, grounded, instead of either stopping the
    // instant its feet enter that tile (which reads as hovering) or
    // climbing on into empty space above the shaft. Ground collision below
    // treats that same tile as solid-from-above, so the landing persists
    // under the next frame's gravity — the character just stands there.
    //
    // A dead-end shaft (solid tile directly above the top rung, so nowhere
    // to stand) keeps the plain behavior: climb until the feet leave the
    // ladder, then fall. `minClimbY` — feet no higher than the level's own
    // top edge — remains the backstop for that case, so holding Up can
    // never carry the character out of bounds into a long fall.
    let ladderTopRow = feetRow;
    while (columnsAreClimbable(ladderTopRow - 1)) ladderTopRow--;
    const canStandOnLadderTop = columnsHaveStandableLadderTop(ladderTopRow);
    const minClimbY = canStandOnLadderTop
      ? ladderTopRow * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING
      : -PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING; // feet at the level's top edge
    const climbY = Math.max(player.y + vy * dt, minClimbY);

    if (canStandOnLadderTop && climbUpHeld && player.y + vy * dt <= minClimbY) {
      return {
        ...player,
        x: climbX,
        y: minClimbY, // feet exactly on the shaft's top edge
        vx,
        vy: 0,
        direction,
        grounded: true,
        climbing: false,
        isDroppingThroughBridge: false,
        lastGroundedX: climbX,
        lastGroundedY: minClimbY,
        knockbackTimer: Math.max(0, player.knockbackTimer - dt),
        bounceAscending: false,
        blockContacts: [],
      };
    }

    return {
      ...player,
      x: climbX,
      y: climbY,
      vx,
      vy,
      direction,
      grounded: false,
      climbing: true,
      isDroppingThroughBridge: false,
      knockbackTimer: Math.max(0, player.knockbackTimer - dt),
      bounceAscending: false,
      blockContacts: [],
    };
  }

  // Jump trigger (FR-006): a fixed upward impulse while grounded, OR while
  // cancelling a climb — climbing always reports
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
    // Just exited climbing this very frame — either reached the ladder's
    // top/walked off it under gravity, or cancelled
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
      direction,
      grounded: false,
      climbing: false,
      isDroppingThroughBridge: false,
      knockbackTimer: Math.max(0, player.knockbackTimer - dt),
      bounceAscending: false,
      blockContacts: [],
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
  // not just once, so a one-tick-only override would leave every later
  // ascending frame of the SAME bounce unprotected and shear it down to
  // ~45% of its configured magnitude regardless of how large it was set.
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

  if (vy < 0) {
    // Ceiling collision: symmetric to the landing case below, but for the
    // player's head hitting a solid tile from underneath while rising.
    // PLAYER_HEAD_PADDING accounts for the transparent rows above the
    // sprite's actual head, so this triggers when the VISIBLE head reaches
    // the tile, not when the top of the (mostly-empty) frame does.
    // Uses isSolidExcludingBridge (not isSolid) so `bridge` tiles are
    // passable from underneath while remaining solid everywhere else.
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
      // still reported in `blockContacts`, even if it wasn't the column that
      // stopped the ascent.
      if (!ceilingResolved) {
        y = (headRow + 1) * RENDERED_TILE_SIZE - PLAYER_HEAD_PADDING;
        resolvedVy = 0;
        ceilingResolved = true;
      }
      if (blockId !== undefined) blockContacts.push({ id: blockId, side: 'bottom' });
    }
  } else {
    const feetY = y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
    const footRow = Math.floor(feetY / RENDERED_TILE_SIZE);
    // While actively dropping through a bridge, ground collision ignores
    // bridge tiles the same way the ceiling check always does — everything
    // else (regular ground, platforms, walls) still catches the character.
    const groundIsSolid = droppingThroughBridge ? isSolidExcludingBridge : isSolid;
    // A ladder shaft's topmost rung is solid from above — that's what lets
    // the character stand on top of a ladder
    // after climbing out of the shaft, and catches it when it falls back
    // onto that spot. One-way, exactly like `bridge`: the rest of the shaft
    // stays fully passable, and nothing here makes a ladder block sideways
    // movement or a climb through it. Pressing Down to climb back in is
    // handled far above (the grounded + climbable-row-below entry), which
    // returns before this collision pass runs.
    const columnIsGround = (col: number): boolean =>
      groundIsSolid(tileAt(level, col, footRow)) ||
      isStandableLadderTop(level, col, footRow) ||
      isBlockOccupied(blockPlacements, col, footRow);

    let groundResolved = false;
    for (let col = leftCol; col <= rightCol; col++) {
      if (!columnIsGround(col)) continue;
      if (!groundResolved) {
        const groundSurfaceY = footRow * RENDERED_TILE_SIZE;
        y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
        resolvedVy = 0;
        grounded = true;
        groundResolved = true;
      }
      const blockId = blockIdAt(blockPlacements, col, footRow);
      if (blockId !== undefined) blockContacts.push({ id: blockId, side: 'top' });
    }

    if (grounded) {
      fullyGrounded = true;
      for (let col = leftCol; col <= rightCol; col++) {
        if (!columnIsGround(col)) {
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
    direction,
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
    blockContacts,
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
 * level spawn/checkpoint (that full-respawn behavior is the 0-heart case).
 * Velocity is zeroed and `grounded` is set true so the very
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
