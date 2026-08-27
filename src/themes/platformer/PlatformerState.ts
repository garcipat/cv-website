import { signal } from '@preact/signals-react';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { SPAWN_TILE } from './level/level1';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from './entities/Player';
import type { PlayerState } from './entities/Player';

function initialPlayerState(): PlayerState {
  // SPAWN_TILE is the empty cell the character stands in (see level1.ts's
  // `S` marker) — the ground surface is that cell's bottom edge.
  const spawnCell = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
  const groundSurfaceY = spawnCell.y + RENDERED_TILE_SIZE;
  return {
    x: spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2,
    y: groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING,
    vx: 0,
    vy: 0,
    facing: 'right',
    grounded: false,
    isDroppingThroughBridge: false,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
  };
}

/** Player position/animation state — mutated by the game loop (added in later steps). */
export const playerState = signal<PlayerState>(initialPlayerState());
