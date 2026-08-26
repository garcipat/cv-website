import { stepPlayerPhysics } from './Physics';
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { parseLevel } from '../level/level1';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';

function basePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vy: 0,
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
});
