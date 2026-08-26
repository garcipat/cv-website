import { stepPlayerPhysics } from './Physics';
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { MAX_DT } from './GameLoop';
import { parseLevel } from '../level/level1';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
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
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE;
    const player = basePlayer({ x: restX - 1 });

    const next = stepPlayerPhysics(player, RIGHT_WALL_LEVEL, 1 / 60, {
      left: false,
      right: true,
    });

    expect(next.x).toBe(restX);
  });

  it('movingLeftIntoWall-overshootsInOneFrame-clampsToWallRightEdge', () => {
    const wallCol = 1;
    const restX = (wallCol + 1) * RENDERED_TILE_SIZE;
    const player = basePlayer({ x: restX + 1 });

    const next = stepPlayerPhysics(player, LEFT_WALL_LEVEL, 1 / 60, {
      left: true,
      right: false,
    });

    expect(next.x).toBe(restX);
  });
});
