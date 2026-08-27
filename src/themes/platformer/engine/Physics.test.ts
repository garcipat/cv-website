import { stepPlayerPhysics } from './Physics';
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { MAX_DT } from './GameLoop';
import { parseLevel } from '../level/level1';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
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
    facing: 'right',
    grounded: false,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    isDroppingThroughBridge: false,
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
// proportioned like level1's real 3-tile floating platform, with room to
// its left/right so the hitbox can be positioned on either side without
// hitting world bounds. Isolates the platform-edge case: the full 64px
// render slot (2 tiles) is wider than the actual (now-centered) collision
// hitbox.
const NARROW_PLATFORM_LEVEL = parseLevel(['.GGG.....']);

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
    const player = basePlayer({ x: 0, facing: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: false, right: true });
    expect(next.vx).toBe(PHYSICS_CONFIG.walkSpeed);
    expect(next.x).toBeCloseTo(PHYSICS_CONFIG.walkSpeed / 60);
    expect(next.facing).toBe('right');
  });

  it('leftHeld-inOpenSpace-movesLeftAtWalkSpeedAndFacesLeft', () => {
    const player = basePlayer({ x: 100, facing: 'right' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: false });
    expect(next.vx).toBe(-PHYSICS_CONFIG.walkSpeed);
    expect(next.x).toBeCloseTo(100 - PHYSICS_CONFIG.walkSpeed / 60);
    expect(next.facing).toBe('left');
  });

  it('bothHeld-inOpenSpace-cancelsOutToZeroVelocityAndKeepsFacing', () => {
    const player = basePlayer({ x: 50, facing: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: true });
    expect(next.vx).toBe(0);
    expect(next.x).toBe(50);
    expect(next.facing).toBe('left');
  });

  it('neitherHeld-afterMoving-stopsButKeepsLastFacing', () => {
    const player = basePlayer({ x: 50, facing: 'right' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: false, right: false });
    expect(next.vx).toBe(0);
    expect(next.facing).toBe('right');
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
    const player = basePlayer({ x: -PLAYER_SIDE_PADDING + 2, facing: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: false });
    expect(next.x).toBe(-PLAYER_SIDE_PADDING);
  });

  it('movingRightPastTheLevelEnd-noWallThere-clampsToWorldRightEdge', () => {
    const maxX =
      OPEN_LEVEL.width * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: maxX - 2, facing: 'right' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: false, right: true });
    expect(next.x).toBe(maxX);
  });

  it('startingAtWorldLeftEdge-holdingLeft-staysAtWorldLeftEdge', () => {
    const player = basePlayer({ x: -PLAYER_SIDE_PADDING, facing: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: false });
    expect(next.x).toBe(-PLAYER_SIDE_PADDING);
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
    // both solid (the strip spans columns 1-3). facing shouldn't matter
    // anymore — loop both to prove it.
    const restY = 0 - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    for (const facing of ['left', 'right'] as const) {
      const player = basePlayer({ x: 32, y: restY, vy: 0, grounded: true, facing });
      const next = stepPlayerPhysics(player, NARROW_PLATFORM_LEVEL, 1 / 60);
      expect(next.grounded).toBe(true);
    }
  });

  it('walkedPastNarrowPlatformEdge-anyFacing-becomesUngrounded', () => {
    // x=110: the centered hitbox (x+20=130 to x+43=153) falls entirely in
    // column 4, empty — past the platform's right edge at pixel 128.
    const restY = 0 - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    for (const facing of ['left', 'right'] as const) {
      const player = basePlayer({ x: 110, y: restY, vy: 0, grounded: true, facing });
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
