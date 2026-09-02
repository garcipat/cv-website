import { stepPlayerPhysics, checkPitFall, resolvePitFall } from './Physics';
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { MAX_DT } from './GameLoop';
import { parseLevel } from '../level/LevelParser';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { placeBlocks } from '../level/BlockMapper';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_HEAD_PADDING,
  PLAYER_SIDE_PADDING,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';

function basePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: false,
    climbing: false,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    isDroppingThroughBridge: false,
    lastGroundedX: 0,
    lastGroundedY: 0,
    invincibleTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    hitBlockIds: [],
    ...overrides,
  };
}

// 4 rows tall, 2 cols wide, ground on the bottom row only.
const GROUND_LEVEL = parseLevel(['..', '..', '..', 'GG']);

// Same footprint, no solid tile anywhere — an open pit.
const PIT_LEVEL = parseLevel(['..', '..', '..', '..']);

// Same footprint as GROUND_LEVEL, but the solid row is on top instead of the
// bottom — used to test the upward (ceiling) collision case jump introduces.
const CEILING_LEVEL = parseLevel(['GG', '..', '..', '..']);

// Same shape as CEILING_LEVEL, but the solid row is `bridge` instead of
// `groundGrass` — isolates the one-way case: rising into a bridge from below
// must NOT block, unlike CEILING_LEVEL's ground row, which does.
const BRIDGE_CEILING_LEVEL = parseLevel(['BB', '..', '..', '..']);

// Same shape as GROUND_LEVEL, but the solid row is `bridge` — bridge must
// still be solid when landed on from above under normal gravity, exactly
// like ground.
const BRIDGE_GROUND_LEVEL = parseLevel(['..', '..', '..', 'BB']);

// Same shape as a horizontal wall level (see RIGHT_WALL_LEVEL further down),
// but the solid tile is `bridge` — bridge must still block horizontal
// movement like any other wall.
const BRIDGE_SIDE_WALL_LEVEL = parseLevel(['....B.', '....B.']);

// Bridge at row 0, two empty rows of clearance, solid ground at the bottom
// row — used to test the Down-to-drop-through trigger: without Down held the
// character rests on the bridge; with it held, gravity carries them through
// to land on the floor below.
const BRIDGE_DROP_LEVEL = parseLevel(['BB', '..', '..', 'GG']);

// One empty tile, then a 3-tile-wide solid strip (cols 1-3), then empty —
// proportioned like currentLevel's real 3-tile floating platform, with room to
// its left/right so the hitbox can be positioned on either side without
// hitting world bounds. Isolates the platform-edge case: the full 64px
// render slot (2 tiles) is wider than the actual (now-centered) collision
// hitbox.
const NARROW_PLATFORM_LEVEL = parseLevel(['.GGG.....']);

// 4 rows tall, 2 cols wide (col 1 is empty filler, giving the hitbox — wider
// than one tile — room to move horizontally without immediately hitting the
// world-bounds clamp): row 0 is solid ground reachable by climbing (the tile
// directly above the ladder's top rung, per FR-006); rows 1-2 are ladder in
// col 0; row 3 is solid ground the ladder starts from. Mirrors currentLevel's real
// "ladder leads up to a platform" shape at a testable scale.
const LADDER_LEVEL = parseLevel(['G.', 'L.', 'L.', 'G.']);

// Row 0 is ladder with nothing above it (out-of-bounds) — reproduces the
// real currentLevel top-of-shaft scenario: climbing off the top must clamp,
// not overshoot into the void.
const TOP_LADDER_LEVEL = parseLevel(['L.', 'L.', 'G.']);

// Same shape as TOP_LADDER_LEVEL but with the shaft's top tile in the MIDDLE
// of the level (row 3) rather than at row 0, with open air above it — the
// ladder-top standing rule is a property of the ladder, not of the level's
// topmost row, so every top-of-shaft behaviour must hold here too.
const MID_LADDER_LEVEL = parseLevel(['..', '..', '..', 'L.', 'L.', 'G.']);

/** Y at which the player's feet rest exactly on the top edge of `row`. */
function standingYOnRow(row: number): number {
  return row * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
}

// 3 cols wide so col 0 and col 2 give room to approach col 1's ladder shaft
// from the side; col 1 is a standable ladder top (row 0, nothing above it)
// over a plain ladder tile (row 1) over solid ground (row 2). Used to prove
// the standable top tile is one-way exactly like `bridge` — solid from
// above, but never solid horizontally (isSolid('ladder') is always false,
// standable or not).
const STANDABLE_LADDER_TOP_SIDE_LEVEL = parseLevel(['.L.', '.L.', '.G.']);

describe('stepPlayerPhysics', () => {
  it('stepPlayerPhysics-inMidAir-appliesGravityToVelocityAndMovesDown', () => {
    const player = basePlayer({ y: 0, vy: 0 });
    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60);
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.gravity / 60);
    expect(next.y).toBeGreaterThan(player.y);
    expect(next.grounded).toBe(false);
  });

  it('stepPlayerPhysics-fallingOntoSolidTile-snapsFeetToSurfaceAndStopsVelocity', () => {
    const groundSurfaceY = 3 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    // Start 1px above the surface, falling fast enough to overshoot through
    // it in a single frame.
    const player = basePlayer({ y: restY - 1, vy: 500 });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60);

    expect(next.y).toBe(restY);
    expect(next.vy).toBe(0);
    expect(next.grounded).toBe(true);
  });

  it('stepPlayerPhysics-restingOnGround-staysAtSameYAndRemainsGrounded', () => {
    const groundSurfaceY = 3 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({ y: restY, vy: 0, grounded: true });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60);

    expect(next.y).toBe(restY);
    expect(next.vy).toBe(0);
    expect(next.grounded).toBe(true);
  });

  it('stepPlayerPhysics-fallingForManyFrames-clampsVelocityAtTerminal', () => {
    let player = basePlayer({ y: 0, vy: 0 });
    for (let i = 0; i < 120; i++) {
      player = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60);
    }
    expect(player.vy).toBe(PHYSICS_CONFIG.terminalVelocity);
  });

  it('stepPlayerPhysics-noSolidTileInColumn-neverGroundedKeepsFalling', () => {
    let player = basePlayer({ y: 0, vy: 0 });
    for (let i = 0; i < 10; i++) {
      player = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60);
    }
    expect(player.grounded).toBe(false);
    expect(player.y).toBeGreaterThan(0);
  });

  it('terminalVelocity-timesMaxDt-staysBelowOneTile', () => {
    // Discrete collision resolution checks only the player's final
    // foot-tile position each frame, so a single frame's fall must never
    // exceed one tile's height or the player can tunnel through a
    // 1-tile-thick solid (see PhysicsConfig.ts's terminalVelocity comment).
    expect(PHYSICS_CONFIG.terminalVelocity * MAX_DT).toBeLessThan(RENDERED_TILE_SIZE);
  });

  it('walkSpeed-timesMaxDt-staysBelowOneTile', () => {
    // Same tunneling invariant as above, but for horizontal movement: a
    // single frame's horizontal travel must never exceed one tile's width
    // or the player can tunnel through a 1-tile-thick solid (see
    // PhysicsConfig.ts's walkSpeed comment).
    expect(PHYSICS_CONFIG.walkSpeed * MAX_DT).toBeLessThan(RENDERED_TILE_SIZE);
  });

  it('jumpVelocity-timesMaxDt-staysBelowOneTile', () => {
    // Same tunneling invariant as gravity/walkSpeed above, but for the jump
    // impulse: a single frame's upward travel must never exceed one tile's
    // height or the player can tunnel through a 1-tile-thick ceiling.
    expect(Math.abs(PHYSICS_CONFIG.jumpVelocity) * MAX_DT).toBeLessThan(RENDERED_TILE_SIZE);
  });
});

// 2 rows tall, 6 cols wide, no ground anywhere — isolates horizontal
// movement/collision from gravity's vertical collision.
const OPEN_LEVEL = parseLevel(['......', '......']);

// Solid wall at col 4, both rows — blocks rightward movement.
const RIGHT_WALL_LEVEL = parseLevel(['....W.', '....W.']);

// Solid wall at col 1, both rows — blocks leftward movement.
const LEFT_WALL_LEVEL = parseLevel(['.W....', '.W....']);

// 3 rows tall, 6 cols wide. Solid wall at col 4, but ONLY on row 0 — rows 1-2
// are open. Used to prove the horizontal wall check excludes the
// PLAYER_HEAD_PADDING band: a player positioned so their padded head lands in
// row 1 (not row 0) must NOT be blocked by the row-0 wall tile, even though
// the top of their (mostly-empty) render frame is still numerically in row 0.
const HEAD_PADDING_WALL_LEVEL = parseLevel(['....W.', '......', '......']);

describe('stepPlayerPhysics horizontal movement', () => {
  it('noHorizontalInput-defaultParam-leavesXAndVxUnchanged', () => {
    const player = basePlayer({ x: 10, vx: 0 });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60);
    expect(next.x).toBe(10);
    expect(next.vx).toBe(0);
  });

  it('rightHeld-inOpenSpace-movesRightAtWalkSpeedAndFacesRight', () => {
    const player = basePlayer({ x: 0, direction: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: false, right: true });
    expect(next.vx).toBe(PHYSICS_CONFIG.walkSpeed);
    expect(next.x).toBeCloseTo(PHYSICS_CONFIG.walkSpeed / 60);
    expect(next.direction).toBe('right');
  });

  it('leftHeld-inOpenSpace-movesLeftAtWalkSpeedAndFacesLeft', () => {
    const player = basePlayer({ x: 100, direction: 'right' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: false });
    expect(next.vx).toBe(-PHYSICS_CONFIG.walkSpeed);
    expect(next.x).toBeCloseTo(100 - PHYSICS_CONFIG.walkSpeed / 60);
    expect(next.direction).toBe('left');
  });

  it('bothHeld-inOpenSpace-cancelsOutToZeroVelocityAndKeepsFacing', () => {
    const player = basePlayer({ x: 50, direction: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: true });
    expect(next.vx).toBe(0);
    expect(next.x).toBe(50);
    expect(next.direction).toBe('left');
  });

  it('neitherHeld-afterMoving-stopsButKeepsLastFacing', () => {
    const player = basePlayer({ x: 50, direction: 'right' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: false, right: false });
    expect(next.vx).toBe(0);
    expect(next.direction).toBe('right');
  });

  it('movingRightIntoWall-overshootsInOneFrame-clampsToWallLeftEdge', () => {
    const wallCol = 4;
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: restX - 1 });

    const next = stepPlayerPhysics(player, RIGHT_WALL_LEVEL, 1 / 60, {
      left: false,
      right: true,
    });

    expect(next.x).toBe(restX);
  });

  it('movingLeftIntoWall-overshootsInOneFrame-clampsToWallRightEdge', () => {
    const wallCol = 1;
    const restX = (wallCol + 1) * RENDERED_TILE_SIZE - PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: restX + 1 });

    const next = stepPlayerPhysics(player, LEFT_WALL_LEVEL, 1 / 60, {
      left: true,
      right: false,
    });

    expect(next.x).toBe(restX);
  });

  it('movingRightWithWallOnlyInHeadPaddingBand-isNotBlocked', () => {
    // y chosen so player.y falls in row 0 (top of the render frame is
    // numerically row 0), but player.y + PLAYER_HEAD_PADDING crosses into
    // row 1 — i.e. the player's actual (padded) head is in row 1, where
    // there's no wall, not row 0, where there is one.
    const wallCol = 4;
    const y = RENDERED_TILE_SIZE - PLAYER_HEAD_PADDING + 4;
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: restX - 1, y });

    const next = stepPlayerPhysics(player, HEAD_PADDING_WALL_LEVEL, 1 / 60, {
      left: false,
      right: true,
    });

    // If the bug were present, the row-0 wall would clamp x to restX. Fixed
    // behavior: the row-0 wall is outside the padded collision band, so the
    // player moves freely past where restX would have clamped it.
    expect(next.x).toBeCloseTo(restX - 1 + PHYSICS_CONFIG.walkSpeed / 60);
    expect(next.x).not.toBe(restX);
  });

  it('movingLeftPastTheLevelStart-noWallThere-clampsToWorldLeftEdge', () => {
    // Start 2px from the new world-left boundary (-PLAYER_SIDE_PADDING) so
    // one frame's movement overshoots it.
    const player = basePlayer({ x: -PLAYER_SIDE_PADDING + 2, direction: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: false });
    expect(next.x).toBe(-PLAYER_SIDE_PADDING);
  });

  it('movingRightPastTheLevelEnd-noWallThere-clampsToWorldRightEdge', () => {
    const maxX =
      OPEN_LEVEL.width * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: maxX - 2, direction: 'right' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: false, right: true });
    expect(next.x).toBe(maxX);
  });

  it('startingAtWorldLeftEdge-holdingLeft-staysAtWorldLeftEdge', () => {
    const player = basePlayer({ x: -PLAYER_SIDE_PADDING, direction: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: false });
    expect(next.x).toBe(-PLAYER_SIDE_PADDING);
  });
});

describe('stepPlayerPhysics block solidity', () => {
  // 4 rows tall, 4 cols wide, ground on the bottom row; a block sits at
  // (col 2, row 2) — one row above the ground, with an empty row (row 1)
  // above that for a ceiling-collision approach from below.
  const BLOCK_LEVEL = parseLevel(['....', '....', '....', 'GGGG']);
  const blockAtCol2Row2 = placeBlocks([], {
    crate: [],
    questionMark: [{ col: 2, row: 2 }],
    fragileRock: [],
  });

  it('walkingRightIntoABlock-stopsAtItsLeftEdgeLikeAWall', () => {
    // Same "start 1px before the wall, overshoot in one frame" convention as
    // the pre-existing terrain wall tests (see restX above): wallCol=2 (the
    // block's column). y=1*RENDERED_TILE_SIZE keeps the hitbox's vertical
    // span within rows 1-2 only (topRow=1, bottomRow=2), so it reaches the
    // block's row without also touching row 3's full-width ground — that
    // matters here because a starting x already grazing column 2 (e.g. the
    // render slot's left edge placed one full tile back without this
    // adjustment) would let the post-move rightCol skip straight past column
    // 2 to column 3 in a single frame, missing the block collision entirely.
    const wallCol = 2;
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({
      x: restX - 1,
      y: 1 * RENDERED_TILE_SIZE,
      grounded: true,
    });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { left: false, right: true }, blockAtCol2Row2);
    expect(next.x).toBe(restX);
  });

  it('noBlockPlacementsPassed-behavesExactlyAsBefore', () => {
    // Same position/input as the test above, but with no blockPlacements
    // argument at all — the player must walk straight through unimpeded,
    // proving the new parameter is opt-in and every pre-existing call site
    // (which never passes a 5th argument) is unaffected.
    const wallCol = 2;
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({
      x: restX - 1,
      y: 1 * RENDERED_TILE_SIZE,
      grounded: true,
    });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { left: false, right: true });
    expect(next.x).toBeGreaterThan(restX);
  });

  it('landingOnTopOfABlockFromAbove-restsOnItLikeGround', () => {
    // Mirrors the pre-existing terrain landing-collision convention exactly
    // (see `stepPlayerPhysics-fallingOntoSolidTile-...` above): start 1px
    // above the block's top surface, falling fast enough to reach it within
    // one frame.
    const groundSurfaceY = 2 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({
      x: 2 * RENDERED_TILE_SIZE,
      y: restY - 1,
      vy: 300,
    });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, {}, blockAtCol2Row2);
    expect(next.grounded).toBe(true);
    expect(next.vy).toBe(0);
    expect(next.y).toBe(restY);
  });

  it('jumpingUpIntoABlockFromBelow-stopsAscentLikeACeiling', () => {
    // Mirrors the pre-existing terrain ceiling-collision convention exactly
    // (see `movingUpIntoCeiling-...` above): the block's underside — the
    // surface a rising head hits — is the boundary below row 2, i.e. where
    // row 3 (the ground row) begins. `jumpHeld: true` avoids the
    // variable-jump-height cutoff so this test isolates collision behavior,
    // exactly as the pre-existing ceiling test does.
    const ceilingBottomY = 3 * RENDERED_TILE_SIZE;
    const restY = ceilingBottomY - PLAYER_HEAD_PADDING;
    const player = basePlayer({
      x: 2 * RENDERED_TILE_SIZE,
      y: restY + 1,
      vy: -1000,
      grounded: false,
    });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { jumpHeld: true }, blockAtCol2Row2);
    expect(next.vy).toBe(0);
    expect(next.y).toBe(restY);
  });

  it('jumpingUpIntoABlockFromBelow-reportsItsIdInHitBlockIds', () => {
    const ceilingBottomY = 3 * RENDERED_TILE_SIZE;
    const restY = ceilingBottomY - PLAYER_HEAD_PADDING;
    const player = basePlayer({
      x: 2 * RENDERED_TILE_SIZE,
      y: restY + 1,
      vy: -1000,
      grounded: false,
    });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { jumpHeld: true }, blockAtCol2Row2);
    expect(next.hitBlockIds).toEqual([blockAtCol2Row2[0].id]);
  });

  it('jumpingUpIntoPlainTerrainCeiling-reportsNoHitBlockIds', () => {
    const next = stepPlayerPhysics(
      basePlayer({ x: 0, y: 1 * RENDERED_TILE_SIZE, vy: -1000, grounded: false }),
      parseLevel(['GGGG', '....', '....', 'GGGG']),
      1 / 60,
      { jumpHeld: true },
    );
    expect(next.hitBlockIds).toEqual([]);
  });

  it('walkingRightIntoABlock-doesNotReportItInHitBlockIds', () => {
    // A side collision must never register as a below-hit (spec.md
    // Acceptance Scenario 5: only upward hits from below trigger a reaction).
    const wallCol = 2;
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: restX - 1, y: 1 * RENDERED_TILE_SIZE, grounded: true });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { left: false, right: true }, blockAtCol2Row2);
    expect(next.hitBlockIds).toEqual([]);
  });

  it('landingOnTopOfABlockFromAbove-doesNotReportItInHitBlockIds', () => {
    const groundSurfaceY = 2 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({ x: 2 * RENDERED_TILE_SIZE, y: restY - 1, vy: 300 });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, {}, blockAtCol2Row2);
    expect(next.hitBlockIds).toEqual([]);
  });
});

describe('stepPlayerPhysics knockback', () => {
  it('knockbackActive-ignoresHeldMovementKeysAndKeepsKnockbackVx', () => {
    const player = basePlayer({ y: 0, vx: -250, knockbackTimer: 0.25, grounded: true });

    // Holding RIGHT would normally set vx to +walkSpeed — knockback must win.
    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 30, { right: true });

    expect(next.vx).toBe(-250);
  });

  it('knockbackActive-decrementsKnockbackTimerByDt', () => {
    const player = basePlayer({ y: 0, vx: -250, knockbackTimer: 0.25, grounded: true });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 0.1);

    expect(next.knockbackTimer).toBeCloseTo(0.15);
  });

  it('knockbackTimerBelowDt-clampsToZeroNotNegative', () => {
    const player = basePlayer({ y: 0, vx: -250, knockbackTimer: 0.05, grounded: true });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 0.1);

    expect(next.knockbackTimer).toBe(0);
  });

  it('knockbackExpired-normalInputDrivenMovementResumes', () => {
    const player = basePlayer({ y: 0, vx: -250, knockbackTimer: 0, grounded: true });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 30, { right: true });

    expect(next.vx).toBe(PHYSICS_CONFIG.walkSpeed);
  });
});

describe('stepPlayerPhysics jump', () => {
  it('jumpPressed-whileGrounded-setsUpwardVelocityAndLeavesGround', () => {
    const player = basePlayer({ vy: 0, grounded: true });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpPressed: true,
      jumpHeld: true,
    });
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60);
    expect(next.grounded).toBe(false);
  });

  it('jumpPressed-whileAirborne-isIgnoredNoDoubleJump', () => {
    const player = basePlayer({ vy: -200, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpPressed: true,
      jumpHeld: true,
    });
    expect(next.vy).toBeCloseTo(-200 + PHYSICS_CONFIG.gravity / 60);
  });

  it('jumpHeldFalse-whileAscending-cutsVelocityByMultiplier', () => {
    const player = basePlayer({ vy: PHYSICS_CONFIG.jumpVelocity, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpHeld: false,
    });
    const beforeCut = PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60;
    expect(next.vy).toBeCloseTo(beforeCut * PHYSICS_CONFIG.jumpCutMultiplier);
  });

  it('jumpHeldTrue-whileAscending-appliesNoCut', () => {
    const player = basePlayer({ vy: PHYSICS_CONFIG.jumpVelocity, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpHeld: true,
    });
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60);
  });

  it('bounceAscendingTrue-jumpNotHeld-appliesNoCutOnFirstTick', () => {
    const player = basePlayer({ vy: PHYSICS_CONFIG.stompBounceVelocity, grounded: false, bounceAscending: true });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, { left: false, right: false, jumpHeld: false });
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.stompBounceVelocity + PHYSICS_CONFIG.gravity / 60);
  });

  it('bounceAscendingTrue-jumpNotHeld-appliesNoCutAcrossManyConsecutiveTicks', () => {
    // The jump-cut multiplier re-applies EVERY tick the key isn't held, not
    // just once — a single-tick-only suppression would shear the bounce
    // down to ~45% of its configured magnitude on the very next tick, no
    // matter how large `stompBounceVelocity` was set. `bounceAscending`
    // must stay effective for the WHOLE ascent, not just the tick the
    // bounce was applied.
    let player = basePlayer({ vy: PHYSICS_CONFIG.stompBounceVelocity, grounded: false, bounceAscending: true });
    const dt = 1 / 60;
    for (let i = 0; i < 10 && player.vy < 0; i++) {
      player = stepPlayerPhysics(player, PIT_LEVEL, dt, { left: false, right: false, jumpHeld: false });
    }
    // After 10 ticks of gravity alone (no cut), vy should have decayed
    // linearly from the full bounce velocity — nowhere near the ~55% cut a
    // per-tick jump-cut would have inflicted almost immediately.
    const expectedVy = PHYSICS_CONFIG.stompBounceVelocity + PHYSICS_CONFIG.gravity * dt * 10;
    expect(player.vy).toBeCloseTo(expectedVy);
  });

  it('bounceAscendingTrue-onceApexPasses-clearsBackToFalse', () => {
    const player = basePlayer({ vy: -10, grounded: false, bounceAscending: true });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 30, { left: false, right: false, jumpHeld: false });
    // -10 + gravity(1200)/30 = 30, i.e. resolvedVy is now positive — the
    // ascent is over, so the flag must clear even though it started true.
    expect(next.vy).toBeGreaterThan(0);
    expect(next.bounceAscending).toBe(false);
  });

  it('bounceAscendingFalse-jumpNotHeld-stillAppliesNormalCut', () => {
    // A regular jump (not a stomp bounce) must still get the normal
    // variable-height cutoff — `bounceAscending` only protects an actual bounce.
    const player = basePlayer({ vy: PHYSICS_CONFIG.jumpVelocity, grounded: false, bounceAscending: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, { left: false, right: false, jumpHeld: false });
    const beforeCut = PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60;
    expect(next.vy).toBeCloseTo(beforeCut * PHYSICS_CONFIG.jumpCutMultiplier);
  });

  it('jumpHeldFalse-whileDescending-appliesNoCut', () => {
    // The cutoff only ever shortens an ascent — it must not also brake a fall.
    const player = basePlayer({ vy: 50, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpHeld: false,
    });
    expect(next.vy).toBeCloseTo(50 + PHYSICS_CONFIG.gravity / 60);
  });

  it('movingUpIntoCeiling-overshootsInOneFrame-clampsToTileBottomEdgeAndZeroesVelocity', () => {
    const ceilingBottomY = RENDERED_TILE_SIZE; // row 0 is solid; row 1 starts here
    const restY = ceilingBottomY - PLAYER_HEAD_PADDING; // head touches exactly at the boundary
    // Start with the head 1px below the ceiling, moving up fast enough to
    // overshoot through it in a single frame. jumpHeld: true avoids the
    // variable-height cutoff so this test isolates collision behavior.
    const player = basePlayer({ y: restY + 1, vy: -1000, grounded: false });

    const next = stepPlayerPhysics(player, CEILING_LEVEL, 1 / 60, { jumpHeld: true });

    expect(next.y).toBe(restY);
    expect(next.vy).toBe(0);
    expect(next.grounded).toBe(false);
  });

  it('movingUpWithNoCeilingAbove-keepsRisingUngrounded', () => {
    const player = basePlayer({ y: 500, vy: -400, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, { jumpHeld: true });
    expect(next.y).toBeLessThan(player.y);
    expect(next.grounded).toBe(false);
  });

  it('standingOverNarrowPlatform-anyFacing-staysGrounded', () => {
    // x=32: the centered hitbox (x+20 to x+43) falls within columns 1-2,
    // both solid (the strip spans columns 1-3). direction shouldn't matter
    // anymore — loop both to prove it.
    const restY = 0 - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    for (const direction of ['left', 'right'] as const) {
      const player = basePlayer({ x: 32, y: restY, vy: 0, grounded: true, direction });
      const next = stepPlayerPhysics(player, NARROW_PLATFORM_LEVEL, 1 / 60);
      expect(next.grounded).toBe(true);
    }
  });

  it('walkedPastNarrowPlatformEdge-anyFacing-becomesUngrounded', () => {
    // x=110: the centered hitbox (x+20=130 to x+43=153) falls entirely in
    // column 4, empty — past the platform's right edge at pixel 128.
    const restY = 0 - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    for (const direction of ['left', 'right'] as const) {
      const player = basePlayer({ x: 110, y: restY, vy: 0, grounded: true, direction });
      const next = stepPlayerPhysics(player, NARROW_PLATFORM_LEVEL, 1 / 60);
      expect(next.grounded).toBe(false);
    }
  });
});

describe('stepPlayerPhysics one-way bridge platforms', () => {
  it('jumpingUpThroughBridgeFromBelow-doesNotBlockAndKeepsRising', () => {
    const ceilingBottomY = RENDERED_TILE_SIZE; // row 0 is the bridge; row 1 starts here
    const restY = ceilingBottomY - PLAYER_HEAD_PADDING; // where a solid ceiling would clamp to
    // Same setup as the solid-ceiling collision test, but against a bridge —
    // if bridge incorrectly blocked from below, this would clamp to restY
    // exactly like the CEILING_LEVEL case does.
    const player = basePlayer({ y: restY + 1, vy: -1000, grounded: false });

    const next = stepPlayerPhysics(player, BRIDGE_CEILING_LEVEL, 1 / 60, { jumpHeld: true });

    expect(next.y).toBeLessThan(restY);
    expect(next.vy).not.toBe(0);
  });

  it('fallingOntoBridgeFromAbove-snapsFeetToSurfaceAndStopsVelocityLikeGround', () => {
    const groundSurfaceY = 3 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    // Start 1px above the surface, falling fast enough to overshoot through
    // it in a single frame — identical setup to the plain-ground landing test.
    const player = basePlayer({ y: restY - 1, vy: 500 });

    const next = stepPlayerPhysics(player, BRIDGE_GROUND_LEVEL, 1 / 60);

    expect(next.y).toBe(restY);
    expect(next.vy).toBe(0);
    expect(next.grounded).toBe(true);
  });

  it('walkingIntoBridgeFromSide-blockedLikeAnyWall', () => {
    const wallCol = 4;
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: restX - 1 });

    const next = stepPlayerPhysics(player, BRIDGE_SIDE_WALL_LEVEL, 1 / 60, {
      left: false,
      right: true,
    });

    expect(next.x).toBe(restX);
  });

  // Single bridge tile at col 2, row 0, otherwise open on all sides — used to
  // prove horizontal movement isn't frozen/snapped while the hitbox is
  // vertically overlapping the SAME bridge tile it's passing through (the
  // cross-cutting bug: the horizontal branch used to treat that overlap as a
  // sideways wall collision). Columns beside the bridge column are empty, so
  // drifting into them during the test's few frames never introduces an
  // unrelated collision.
  const BRIDGE_CEILING_SINGLE_COL_LEVEL = parseLevel(['..B...', '......', '......', '......']);

  it.each([
    ['right', { right: true }, 1] as const,
    ['left', { left: true }, -1] as const,
  ])(
    'jumpingUpThroughBridgeWhileHolding%s-keepsAdvancingHorizontallyAtWalkSpeed',
    (_label, dirInput, sign) => {
      // x chosen so the hitbox starts fully inside column 2 (the bridge
      // column): left edge = x+20 >= 64, right edge = x+43 <= 95, i.e.
      // x in [44, 52].
      const startX = 48;
      // y chosen so the hitbox is already vertically overlapping the row-0
      // bridge tile from the very first frame (topRow ends up 0), so the
      // horizontal check's column range is still column 2 (the bridge
      // column) when the artifact would strike, before any drift moves it
      // into a neighboring (empty) column.
      let player = basePlayer({
        x: startX,
        y: -10,
        vy: PHYSICS_CONFIG.jumpVelocity,
        grounded: false,
      });

      // Run several frames while the head is passing through/near the
      // bridge row — each frame's horizontal displacement must be exactly
      // walkSpeed * dt, identical to open-air movement, with no stall or
      // snap-back from the overlapping bridge tile.
      for (let i = 0; i < 5; i++) {
        const prevX = player.x;
        player = stepPlayerPhysics(player, BRIDGE_CEILING_SINGLE_COL_LEVEL, 1 / 60, {
          ...dirInput,
          jumpHeld: true,
        });
        expect(player.x).toBeCloseTo(prevX + sign * (PHYSICS_CONFIG.walkSpeed / 60));
      }
    },
  );
});

describe('stepPlayerPhysics bridge drop-through', () => {
  it('downNotHeld-whileStandingOnBridge-remainsRestingOnIt', () => {
    const restY = 0 - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING; // resting on row-0 bridge
    const player = basePlayer({ y: restY, vy: 0, grounded: true });

    const next = stepPlayerPhysics(player, BRIDGE_DROP_LEVEL, 1 / 60);

    expect(next.grounded).toBe(true);
    expect(next.y).toBe(restY);
    expect(next.isDroppingThroughBridge).toBe(false);
  });

  it('downHeld-whileStandingOnBridge-startsFallingThroughIt', () => {
    const restY = 0 - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({ y: restY, vy: 0, grounded: true });

    const next = stepPlayerPhysics(player, BRIDGE_DROP_LEVEL, 1 / 60, { dropThroughHeld: true });

    expect(next.grounded).toBe(false);
    expect(next.isDroppingThroughBridge).toBe(true);
    expect(next.y).toBeGreaterThan(restY);
  });

  it('downHeld-whileGroundedOnRegularGround-hasNoEffect', () => {
    const restY = 3 * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({ y: restY, vy: 0, grounded: true });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60, { dropThroughHeld: true });

    expect(next.grounded).toBe(true);
    expect(next.y).toBe(restY);
    expect(next.isDroppingThroughBridge).toBe(false);
  });

  it('droppingThroughBridge-onceTriggered-eventuallyLandsOnFloorBelowAndClearsFlag', () => {
    const restY = 0 - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    let player = basePlayer({ y: restY, vy: 0, grounded: true });

    player = stepPlayerPhysics(player, BRIDGE_DROP_LEVEL, 1 / 60, { dropThroughHeld: true });
    expect(player.grounded).toBe(false);

    // Keep ticking with Down no longer held — the flag persists on its own
    // once triggered (a single frame's fall rarely clears a whole tile), so
    // the character isn't caught by the bridge again on the very next frame.
    for (let i = 0; i < 60 && !player.grounded; i++) {
      player = stepPlayerPhysics(player, BRIDGE_DROP_LEVEL, 1 / 60);
    }

    const floorSurfaceY = 3 * RENDERED_TILE_SIZE;
    expect(player.grounded).toBe(true);
    expect(player.y).toBe(floorSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING);
    expect(player.isDroppingThroughBridge).toBe(false);
  });

  // Same bridge-at-row-0 setup as BRIDGE_DROP_LEVEL, but wide with open
  // columns beside the bridge/floor column — isolates the same cross-cutting
  // bug as the jump-through test above, for the drop-through direction: the
  // horizontal branch must not treat the bridge tile the player is actively
  // dropping through as a sideways wall.
  const BRIDGE_DROP_WIDE_LEVEL = parseLevel(['..B...', '......', '......', '..G...']);

  it.each([
    ['right', { right: true }, 1] as const,
    ['left', { left: true }, -1] as const,
  ])(
    'droppingThroughBridgeWhileHolding%s-keepsAdvancingHorizontallyAtWalkSpeed',
    (_label, dirInput, sign) => {
      const startX = 48; // fully inside column 2 (the bridge/floor column)
      // Mid pass-through already (not the resting-on-top trigger frame):
      // gravity accelerates slowly from a standstill, so reaching a y where
      // the hitbox is vertically overlapping the row-0 bridge (same
      // requirement as the jump-through test above) takes many frames from
      // a resting start. Starting already inside the overlap, with the flag
      // already set, isolates the same few frames the jump-through test
      // does, without the test needing to simulate the whole slow fall.
      let player = basePlayer({
        x: startX,
        y: -10,
        vy: 50,
        grounded: false,
        isDroppingThroughBridge: true,
      });

      for (let i = 0; i < 5; i++) {
        const prevX = player.x;
        player = stepPlayerPhysics(player, BRIDGE_DROP_WIDE_LEVEL, 1 / 60, dirInput);
        expect(player.x).toBeCloseTo(prevX + sign * (PHYSICS_CONFIG.walkSpeed / 60));
      }
    },
  );
});

describe('stepPlayerPhysics lastGroundedX/Y tracking', () => {
  it('whileGrounded-updatesLastGroundedPositionToCurrentFrame', () => {
    const groundSurfaceY = 3 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({
      x: 10,
      y: restY,
      vy: 0,
      grounded: true,
      lastGroundedX: -999,
      lastGroundedY: -999,
    });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60);

    expect(next.lastGroundedX).toBe(next.x);
    expect(next.lastGroundedY).toBe(next.y);
  });

  it('whileAirborne-freezesLastGroundedPositionAtTakeoffSpot', () => {
    const player = basePlayer({
      x: 10,
      y: 0,
      vy: -100,
      grounded: false,
      lastGroundedX: 10,
      lastGroundedY: 40,
    });

    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60);

    expect(next.lastGroundedX).toBe(10);
    expect(next.lastGroundedY).toBe(40);
  });

  it('landingThisFrame-updatesLastGroundedPositionToLandingSpot', () => {
    const groundSurfaceY = 3 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({
      y: restY - 1,
      vy: 500,
      grounded: false,
      lastGroundedX: -999,
      lastGroundedY: -999,
    });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60);

    expect(next.grounded).toBe(true);
    expect(next.lastGroundedY).toBe(restY);
  });

  it('hitboxStraddlesLedgeEdge-staysGroundedButDoesNotAdvanceLastGroundedPosition', () => {
    // x=100: the centered hitbox (x+20=120 to x+43=143) straddles column 3
    // (96-128, solid — part of NARROW_PLATFORM_LEVEL's GGG strip) and column
    // 4 (128-160, empty, past the platform's right edge). `grounded` stays
    // true (the existing lenient any-column-solid landing check — column 3
    // alone is enough), but this position is mostly hanging over the empty
    // column 4, so it must NOT become the pit-fall recovery anchor: repositioning
    // a pit-fall here would visibly float the character over open space.
    const restY = 0 - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({
      x: 100,
      y: restY,
      vy: 0,
      grounded: true,
      lastGroundedX: 32,
      lastGroundedY: restY,
    });

    const next = stepPlayerPhysics(player, NARROW_PLATFORM_LEVEL, 1 / 60);

    expect(next.grounded).toBe(true);
    expect(next.lastGroundedX).toBe(32);
    expect(next.lastGroundedY).toBe(restY);
  });
});

describe('checkPitFall', () => {
  it('feetAboveLevelBottom-returnsFalse', () => {
    const player = basePlayer({ y: 0 });
    expect(checkPitFall(player, PIT_LEVEL)).toBe(false);
  });

  it('feetBelowLevelBottom-returnsTrue', () => {
    // PIT_LEVEL is 4 rows tall (128px). Well past that.
    const player = basePlayer({ y: 500 });
    expect(checkPitFall(player, PIT_LEVEL)).toBe(true);
  });

  it('feetExactlyAtLevelBottom-returnsFalse', () => {
    const levelBottomY = PIT_LEVEL.height * RENDERED_TILE_SIZE;
    const player = basePlayer({
      y: levelBottomY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING,
    });
    expect(checkPitFall(player, PIT_LEVEL)).toBe(false);
  });

  it('stepPlayerPhysics-fallingThroughOpenPit-eventuallyTriggersPitFall', () => {
    let player = basePlayer({ y: 0, vy: 0 });
    for (let i = 0; i < 60 && !checkPitFall(player, PIT_LEVEL); i++) {
      player = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60);
    }
    expect(checkPitFall(player, PIT_LEVEL)).toBe(true);
  });
});

describe('resolvePitFall', () => {
  it('repositionsToLastGroundedPositionAndStopsMovement', () => {
    const player = basePlayer({
      x: 500,
      y: 999,
      vx: 200,
      vy: 900,
      grounded: false,
      isDroppingThroughBridge: true,
      lastGroundedX: 64,
      lastGroundedY: 96,
    });

    const next = resolvePitFall(player);

    expect(next.x).toBe(64);
    expect(next.y).toBe(96);
    expect(next.vx).toBe(0);
    expect(next.vy).toBe(0);
    expect(next.grounded).toBe(true);
    expect(next.isDroppingThroughBridge).toBe(false);
  });

  it('preservesAnimationAndFacingFields', () => {
    const player = basePlayer({
      direction: 'left',
      animState: 'jump',
      animFrame: 3,
      lastGroundedX: 0,
      lastGroundedY: 0,
    });

    const next = resolvePitFall(player);

    expect(next.direction).toBe('left');
    expect(next.animState).toBe('jump');
    expect(next.animFrame).toBe(3);
  });
});

describe('stepPlayerPhysics climbing', () => {
  it('onLadderTile-climbUpHeld-entersClimbingAndMovesUpwardAtClimbSpeed', () => {
    const player = basePlayer({ x: 0, y: 20, grounded: false, climbing: false });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.grounded).toBe(false);
    expect(next.vy).toBeCloseTo(-PHYSICS_CONFIG.climbSpeed);
    expect(next.y).toBeCloseTo(20 - PHYSICS_CONFIG.climbSpeed / 60);
  });

  it('onLadderTile-dropThroughHeld-entersClimbingAndMovesDownwardAtClimbSpeed', () => {
    const player = basePlayer({ x: 0, y: 20, grounded: false, climbing: false });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { dropThroughHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.climbSpeed);
    expect(next.y).toBeCloseTo(20 + PHYSICS_CONFIG.climbSpeed / 60);
  });

  it('climbing-leftOrRightHeld-stillMovesHorizontallyAtNormalWalkSpeed', () => {
    const player = basePlayer({ x: 0, y: 20, grounded: false, climbing: true });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true, right: true });

    expect(next.vx).toBeCloseTo(PHYSICS_CONFIG.walkSpeed);
    expect(next.x).toBeCloseTo(PHYSICS_CONFIG.walkSpeed / 60);
  });

  it('climbingButFeetNoLongerOnLadderTile-exitsClimbingAndFallsUnderGravityFromRest', () => {
    // y = -40 places the feet row on row 0 (the solid platform above the
    // ladder's top rung), not a ladder tile — simulates having just climbed
    // past the top.
    const player = basePlayer({
      x: 0,
      y: -40,
      vy: -PHYSICS_CONFIG.climbSpeed,
      grounded: false,
      climbing: true,
    });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(false);
    // Falls from rest (vy=0), not from the old climb speed — one frame of
    // gravity accumulation from a standstill.
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.gravity / 60);
  });

  it('climbingAndJumpPressed-cancelsClimbAndAppliesNormalJumpImpulseEvenThoughNotGrounded', () => {
    const player = basePlayer({
      x: 0,
      y: 20,
      vy: -PHYSICS_CONFIG.climbSpeed,
      grounded: false,
      climbing: true,
    });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { jumpPressed: true });

    expect(next.climbing).toBe(false);
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60);
  });

  it('standingOnPlatformAboveLaddersTopRung-dropThroughHeld-reEntersClimbDownward', () => {
    // y = -40: feet rest on row 0's solid tile, directly above the ladder's
    // top rung at row 1 — FR-006's "press Down to re-enter the climb" case.
    const player = basePlayer({ x: 0, y: -40, vy: 0, grounded: true, climbing: false });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { dropThroughHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.grounded).toBe(false);
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.climbSpeed);
  });

  it('groundedOnRegularGroundWithNoLadderNearby-dropThroughHeld-doesNotStartClimbing', () => {
    const restY = 3 * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({ x: 0, y: restY, vy: 0, grounded: true, climbing: false });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60, { dropThroughHeld: true });

    expect(next.climbing).toBe(false);
  });

  it('freshClimbEntry-snapsXToCenterOnTheLadderColumn', () => {
    // Player starts off-center from the ladder column (col 0) — e.g. x=10,
    // not the centered value. Entering climbing should snap x to center the
    // player on col 0: col*32 + 16 - PLAYER_RENDERED_SIZE/2 = 0 + 16 - 32 = -16.
    const player = basePlayer({ x: 10, y: 20, grounded: false, climbing: false });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.x).toBeCloseTo(-16);
  });

  it('continuingToClimb-doesNotResnapX-freeHorizontalMovementStillWorks', () => {
    // Already climbing (not a fresh entry) and holding Right — x should
    // move normally by walkSpeed, NOT get re-snapped to the ladder center.
    const player = basePlayer({ x: -16, y: 20, grounded: false, climbing: true });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true, right: true });

    expect(next.climbing).toBe(true);
    expect(next.x).toBeCloseTo(-16 + PHYSICS_CONFIG.walkSpeed / 60);
  });
});

describe('stepPlayerPhysics standing on top of a ladder', () => {
  const topEdgeY = standingYOnRow(0); // TOP_LADDER_LEVEL's shaft top is row 0
  const step = PHYSICS_CONFIG.climbSpeed / 60;

  it('climbingUp-moreThanOneFrameBelowTheLadderTopEdge-keepsClimbingWithoutLandingYet', () => {
    // Two frames' worth of climbing still to go — the character must climb
    // THROUGH the top tile, not land the instant its feet enter that tile.
    const player = basePlayer({
      x: 0,
      y: topEdgeY + 2 * step + 1,
      grounded: false,
      climbing: true,
    });

    const next = stepPlayerPhysics(player, TOP_LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.grounded).toBe(false);
    expect(next.y).toBeCloseTo(topEdgeY + step + 1);
  });

  it('climbingUp-reachingTheLadderTopEdge-standsGroundedExactlyOnTopOfTheTopTile', () => {
    // One frame away from the top edge: this frame's climb reaches (and
    // would overshoot) it, so the character stops with its feet exactly on
    // the tile's top edge and is handed over to normal grounded physics.
    const player = basePlayer({ x: 0, y: topEdgeY + step, grounded: false, climbing: true });

    const next = stepPlayerPhysics(player, TOP_LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(false);
    expect(next.grounded).toBe(true);
    expect(next.vy).toBe(0);
    expect(next.y).toBeCloseTo(topEdgeY);
  });

  it('standingOnTheLaddersTopTile-noInput-keepsStandingInsteadOfFallingThroughIt', () => {
    // The whole point of the follow-up: the landing has to SURVIVE the next
    // frame's gravity — the shaft's topmost tile is solid from above.
    const player = basePlayer({ x: 0, y: topEdgeY, vy: 0, grounded: true, climbing: false });

    const next = stepPlayerPhysics(player, TOP_LADDER_LEVEL, 1 / 60, {});

    expect(next.grounded).toBe(true);
    expect(next.climbing).toBe(false);
    expect(next.y).toBeCloseTo(topEdgeY);
  });

  it('climbingUpAMidLevelShaft-reachingItsTopEdge-standsOnTopOfItToo', () => {
    // Same rule away from the level's topmost row — it's the LADDER's top,
    // not row 0, that the character stands on.
    const midTopEdgeY = standingYOnRow(3); // MID_LADDER_LEVEL's shaft top is row 3
    const player = basePlayer({ x: 0, y: midTopEdgeY + step, grounded: false, climbing: true });

    const next = stepPlayerPhysics(player, MID_LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(false);
    expect(next.grounded).toBe(true);
    expect(next.y).toBeCloseTo(midTopEdgeY);
  });

  it('fallingOntoALaddersTopTileFromAbove-landsOnTopOfIt', () => {
    const midTopEdgeY = standingYOnRow(3);
    // Just above the top edge and falling fast enough to cross it this frame.
    const player = basePlayer({ x: 0, y: midTopEdgeY - 3, vy: 200, grounded: false });

    const next = stepPlayerPhysics(player, MID_LADDER_LEVEL, 1 / 60, {});

    expect(next.grounded).toBe(true);
    expect(next.y).toBeCloseTo(midTopEdgeY);
  });

  it('fallingPastALadderTileThatIsNotTheShaftTop-doesNotLandOnIt', () => {
    // Only the topmost tile is standable — the rest of the shaft stays
    // fully passable, so a ladder never becomes a floor mid-shaft.
    // Crossing row 4's top edge — a ladder tile one row BELOW the shaft's
    // top rung, so nothing here catches the fall.
    const player = basePlayer({ x: 0, y: standingYOnRow(4) - 3, vy: 200, grounded: false });

    const next = stepPlayerPhysics(player, MID_LADDER_LEVEL, 1 / 60, {});

    expect(next.grounded).toBe(false);
  });

  it('standingOnTheLaddersTopTile-dropThroughHeld-climbsBackDownIntoTheShaft', () => {
    const player = basePlayer({ x: 0, y: topEdgeY, vy: 0, grounded: true, climbing: false });

    const next = stepPlayerPhysics(player, TOP_LADDER_LEVEL, 1 / 60, { dropThroughHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.grounded).toBe(false);
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.climbSpeed);
  });

  it('standingOnTheLaddersTopTile-jumpPressed-jumpsOffItLikeAnyOtherGround', () => {
    const player = basePlayer({ x: 0, y: topEdgeY, vy: 0, grounded: true, climbing: false });

    // jumpHeld too, so the variable-jump-height cut doesn't shorten it —
    // this is about the ladder top counting as jumpable ground, not about
    // the cut.
    const next = stepPlayerPhysics(player, TOP_LADDER_LEVEL, 1 / 60, {
      jumpPressed: true,
      jumpHeld: true,
    });

    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60);
  });

  it('ladderTopDirectlyBeneathASolidTile-climbingUp-doesNotStandInsideThatTile', () => {
    // LADDER_LEVEL's shaft (rows 1-2) dead-ends into solid ground at row 0 —
    // there's no room to stand on the shaft's top tile, so the old
    // climb-until-the-feet-leave-the-ladder behaviour has to remain.
    //
    // standingYOnRow(1) would put the feet at row 0 (the row ABOVE row 1,
    // per this file's "feet resting on top of `row`" convention) — already
    // the solid ground tile, so `onLadderNow` is false before the climbing
    // branch's canStandOnLadderTop logic is ever consulted, and the test
    // would pass via the unrelated "just exited climbing" early return
    // instead of the dead-end fallback it's meant to cover. standingYOnRow(2)
    // instead puts the feet at row 1 — the shaft's own top rung, still on
    // the ladder — so `onLadderNow` is true, `canStandOnLadderTop` genuinely
    // evaluates to false (solid tile at row 0 above), and the plain
    // climb-until-the-feet-leave-the-ladder fallback is what's exercised.
    const player = basePlayer({ x: 0, y: standingYOnRow(2), grounded: false, climbing: true });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.grounded).toBe(false);
  });
});

describe('stepPlayerPhysics standable ladder top tile is one-way like bridge', () => {
  it('standableLadderTopTile-doesNotBlockHorizontalMovementThroughItsColumn', () => {
    // Player moving sideways INTO col 1's column at row 0 itself (the
    // standable ladder-top tile), not standing on it — passing through at
    // the same row from col 0. y=0 puts topRow/bottomRow at rows 0-1, both
    // of which are ladder tiles in col 1. isSolid('ladder') is always false
    // (confirmed in Terrain.test.ts), so this must move exactly like open
    // space — no wall-style clamp the way isSolid('groundGrass') would produce.
    const x = 0;
    const player = basePlayer({ x, y: 0, grounded: false, climbing: false });

    const next = stepPlayerPhysics(player, STANDABLE_LADDER_TOP_SIDE_LEVEL, 1 / 60, {
      right: true,
    });

    expect(next.x).toBeCloseTo(x + PHYSICS_CONFIG.walkSpeed / 60);
  });
});

describe('stepPlayerPhysics climbing lands on the ladder\'s own top tile', () => {
  it('climbingUp-stillWithinTheShaft-notYetAtTheTop-continuesClimbingNormally', () => {
    // Sanity: the new branch must not fire prematurely while there's still
    // a climbable tile above. y=0 puts the feet in row 1 of TOP_LADDER_LEVEL
    // (still 'L'), with row 0 (also 'L') directly above — NOT y=20, which
    // (on this 3-row-tall fixture) already puts the feet in row 2, the
    // solid ground row below the shaft, not the shaft itself.
    const player = basePlayer({ x: 0, y: 0, grounded: false, climbing: true });

    const next = stepPlayerPhysics(player, TOP_LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.grounded).toBe(false);
  });
});

describe('stepPlayerPhysics climbing re-entry guard after jump-cancel', () => {
  it('freshEntryHeldWhileAscendingFromAJump-doesNotReEnterClimbing', () => {
    // Simulates the frame right after a jump-cancel: still overlapping the
    // ladder, still ascending (vy very negative from the jump impulse),
    // Up still held — must NOT re-enter climbing.
    const player = basePlayer({ x: 0, y: 20, vy: -400, grounded: false, climbing: false });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(false);
  });

  it('freshEntryWhileAtRest-stillEntersClimbingNormally', () => {
    // Sanity check: the new vy>=0 guard must not break the ORIGINAL entry
    // case (vy=0, not mid-jump) — mirrors the plan's own
    // 'onLadderTile-climbUpHeld-entersClimbingAndMovesUpwardAtClimbSpeed'
    // test, which already exercises this exact scenario and must keep
    // passing unmodified; this test exists to make the vy>=0 boundary
    // explicit rather than relying on that other test alone.
    const player = basePlayer({ x: 0, y: 20, vy: 0, grounded: false, climbing: false });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(true);
  });
});
