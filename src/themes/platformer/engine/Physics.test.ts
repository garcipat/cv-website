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
