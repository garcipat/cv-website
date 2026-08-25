import { signal } from '@preact/signals-react';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { SPAWN_TILE } from './level/level1';
import { PLAYER_RENDERED_SIZE } from './entities/Player';
import type { PlayerState } from './entities/Player';

function initialPlayerState(): PlayerState {
  const spawnTop = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
  return {
    x: spawnTop.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2,
    y: spawnTop.y - PLAYER_RENDERED_SIZE,
    animState: 'idle',
    animFrame: 0,
  };
}

/** Player position/animation state — mutated by the game loop (added in later steps). */
export const playerState = signal<PlayerState>(initialPlayerState());
