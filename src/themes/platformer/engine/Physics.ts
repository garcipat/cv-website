import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';

/**
 * Applies gravity and resolves vertical collision against the level's solid
 * tiles for one frame. Horizontal movement/collision isn't implemented yet
 * (no input until step 5) — only `y`/`vy`/`grounded` change here.
 */
export function stepPlayerPhysics(player: PlayerState, level: LevelDef, dt: number): PlayerState {
  const vy = Math.min(player.vy + PHYSICS_CONFIG.gravity * dt, PHYSICS_CONFIG.terminalVelocity);
  let y = player.y + vy * dt;
  let grounded = false;
  let resolvedVy = vy;

  if (vy >= 0) {
    const feetY = y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
    const footRow = Math.floor(feetY / RENDERED_TILE_SIZE);
    const leftCol = Math.floor(player.x / RENDERED_TILE_SIZE);
    const rightCol = Math.floor((player.x + PLAYER_RENDERED_SIZE - 1) / RENDERED_TILE_SIZE);

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

  return { ...player, y, vy: resolvedVy, grounded };
}
