import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';

/** Which horizontal directions are currently held. Both held cancels out to no movement. */
export interface HorizontalInput {
  left: boolean;
  right: boolean;
}

const NO_HORIZONTAL_INPUT: HorizontalInput = { left: false, right: false };

/**
 * Resolves one frame of horizontal movement/collision, then gravity and
 * vertical collision, against the level's solid tiles. `input` defaults to
 * no movement so gravity-only call sites (and existing tests) keep working
 * unchanged.
 */
export function stepPlayerPhysics(
  player: PlayerState,
  level: LevelDef,
  dt: number,
  input: HorizontalInput = NO_HORIZONTAL_INPUT,
): PlayerState {
  const moveRight = input.right && !input.left;
  const moveLeft = input.left && !input.right;
  const vx = moveRight ? PHYSICS_CONFIG.walkSpeed : moveLeft ? -PHYSICS_CONFIG.walkSpeed : 0;
  const facing = moveRight ? 'right' : moveLeft ? 'left' : player.facing;

  let x = player.x + vx * dt;
  const topRow = Math.floor(player.y / RENDERED_TILE_SIZE);
  // Excludes the foot-padding sliver (like the vertical ground check below)
  // so standing on solid ground doesn't register as a horizontal wall
  // collision on every frame the player tries to walk.
  const bottomRow = Math.floor(
    (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - 1) / RENDERED_TILE_SIZE,
  );

  if (vx > 0) {
    const rightCol = Math.floor((x + PLAYER_RENDERED_SIZE - 1) / RENDERED_TILE_SIZE);
    for (let row = topRow; row <= bottomRow; row++) {
      if (isSolid(tileAt(level, rightCol, row))) {
        x = rightCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE;
        break;
      }
    }
  } else if (vx < 0) {
    const leftCol = Math.floor(x / RENDERED_TILE_SIZE);
    for (let row = topRow; row <= bottomRow; row++) {
      if (isSolid(tileAt(level, leftCol, row))) {
        x = (leftCol + 1) * RENDERED_TILE_SIZE;
        break;
      }
    }
  }

  const vy = Math.min(player.vy + PHYSICS_CONFIG.gravity * dt, PHYSICS_CONFIG.terminalVelocity);
  let y = player.y + vy * dt;
  let grounded = false;
  let resolvedVy = vy;

  if (vy >= 0) {
    const feetY = y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
    const footRow = Math.floor(feetY / RENDERED_TILE_SIZE);
    const leftCol = Math.floor(x / RENDERED_TILE_SIZE);
    const rightCol = Math.floor((x + PLAYER_RENDERED_SIZE - 1) / RENDERED_TILE_SIZE);

    for (let col = leftCol; col <= rightCol; col++) {
      if (isSolid(tileAt(level, col, footRow))) {
        const groundSurfaceY = footRow * RENDERED_TILE_SIZE;
        y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
        resolvedVy = 0;
        grounded = true;
        break;
      }
    }
  }

  return { ...player, x, y, vx, vy: resolvedVy, facing, grounded };
}
