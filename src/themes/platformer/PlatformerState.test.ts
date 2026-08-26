import { playerState } from './PlatformerState';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { SPAWN_TILE } from './level/level1';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from './entities/Player';

describe('PlatformerState', () => {
  it('playerState-initial-hasIdleAnimAtFrameZero', () => {
    expect(playerState.value.animState).toBe('idle');
    expect(playerState.value.animFrame).toBe(0);
  });

  it('playerState-initial-standsHorizontallyCenteredOnSpawnTile', () => {
    const spawnTop = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
    const expectedX = spawnTop.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
    expect(playerState.value.x).toBe(expectedX);
  });

  it('playerState-initial-feetRestOnSpawnTileTop', () => {
    const spawnTop = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
    const expectedY = spawnTop.y - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    expect(playerState.value.y).toBe(expectedY);
  });
});
