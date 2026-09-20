import {
  spawnBombPickup,
  BOMB_PICKUP_RENDERED_SIZE,
  BOMB_PICKUP_TILE_OFFSET_X,
  BOMB_PICKUP_TILE_OFFSET_Y,
} from './BombPickup';
import { bomb } from './pickups/Bomb';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

describe('spawnBombPickup', () => {
  it('called-startsAtTheGivenPosition', () => {
    const pickup = spawnBombPickup('pot1', 100, 200);
    expect(pickup).toEqual({ id: 'pot1', x: 100, y: 200 });
  });
});

describe('BOMB_PICKUP_RENDERED_SIZE', () => {
  it('matchesTheHeartPickupSize', () => {
    expect(BOMB_PICKUP_RENDERED_SIZE).toBe(24);
  });
});

describe('tile offsets', () => {
  it('centerTheRenderedSizeWithinOneTile', () => {
    expect(BOMB_PICKUP_TILE_OFFSET_X).toBe((RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2);
    expect(BOMB_PICKUP_TILE_OFFSET_Y).toBe((RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2);
  });
});

describe('bomb pickup box', () => {
  it('box-isTheCenteredSmallerRect', () => {
    expect(bomb.box(spawnBombPickup('b', 100, 200))).toEqual({
      x: 100 + BOMB_PICKUP_TILE_OFFSET_X,
      y: 200 + BOMB_PICKUP_TILE_OFFSET_Y,
      width: BOMB_PICKUP_RENDERED_SIZE,
      height: BOMB_PICKUP_RENDERED_SIZE,
    });
  });
});
