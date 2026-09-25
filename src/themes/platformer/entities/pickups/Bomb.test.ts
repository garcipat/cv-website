import {
  spawnBombPickup,
  BOMB_PICKUP_RENDERED_SIZE,
  BOMB_PICKUP_TILE_OFFSET_X,
  BOMB_PICKUP_TILE_OFFSET_Y,
  bomb,
} from './Bomb';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';

describe('spawnBombPickup', () => {
  it('called-startsAtTheGivenPosition', () => {
    expect(spawnBombPickup('pot1', 100, 200)).toEqual({
      id: 'pot1',
      kind: 'bomb',
      x: 100,
      y: 200,
      collected: false,
    });
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

describe('bomb view', () => {
  it('key-isBomb-andDrawLayerIsAfterEnemies', () => {
    expect(bomb.key).toBe('bomb');
    expect(bomb.drawLayer).toBe('afterEnemies');
  });

  it('maxPerTick-returnsTheRemainingCapacity', () => {
    expect(bomb.maxPerTick?.({ playerHitPoints: 6, capacity: 3 })).toBe(3);
    expect(bomb.maxPerTick?.({ playerHitPoints: 6 })).toBe(0);
  });

  it('onPickup-addsExactlyOneBomb', () => {
    const outcome = bomb.onPickup(spawnBombPickup('b1', 0, 0), { pool: [], total: 0, collectedBefore: 0 });
    expect(outcome).toEqual({ bombs: 1 });
    expect(outcome).not.toHaveProperty('disposition');
    expect(outcome).not.toHaveProperty('self');
  });
});
