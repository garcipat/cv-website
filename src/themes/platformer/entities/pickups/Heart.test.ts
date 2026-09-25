import {
  spawnHeartPickup,
  HEART_PICKUP_RENDERED_SIZE,
  HEART_PICKUP_TILE_OFFSET_X,
  HEART_PICKUP_TILE_OFFSET_Y,
  heart,
} from './Heart';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import { HEART_PICKUP_HEAL_AMOUNT, MAX_HALF_HEARTS } from '../Health';

describe('spawnHeartPickup', () => {
  it('called-startsAtTheGivenPosition', () => {
    expect(spawnHeartPickup('pot1', 100, 200)).toEqual({
      id: 'pot1',
      kind: 'heart',
      x: 100,
      y: 200,
      collected: false,
    });
  });
});

describe('HEART_PICKUP_RENDERED_SIZE', () => {
  it('isSmallerThanTheHudHeartIcon', () => {
    // Smaller than the 32px HUD heart (Health.ts's HEART_RENDERED_SIZE) —
    // the user asked for a less prominent world pickup than the HUD icon.
    expect(HEART_PICKUP_RENDERED_SIZE).toBe(24);
  });
});

describe('tile offsets', () => {
  it('centerTheRenderedSizeWithinOneTile', () => {
    expect(HEART_PICKUP_TILE_OFFSET_X).toBe((RENDERED_TILE_SIZE - HEART_PICKUP_RENDERED_SIZE) / 2);
    expect(HEART_PICKUP_TILE_OFFSET_Y).toBe((RENDERED_TILE_SIZE - HEART_PICKUP_RENDERED_SIZE) / 2);
  });
});

describe('heart view', () => {
  it('key-isHeart-andDrawLayerIsAfterEnemies', () => {
    expect(heart.key).toBe('heart');
    expect(heart.drawLayer).toBe('afterEnemies');
  });

  it('isCollectible-excludesAFullHealthPlayer', () => {
    const pickup = spawnHeartPickup('h1', 0, 0);
    expect(heart.isCollectible?.(pickup, { playerHitPoints: MAX_HALF_HEARTS })).toBe(false);
    expect(heart.isCollectible?.(pickup, { playerHitPoints: MAX_HALF_HEARTS - 1 })).toBe(true);
  });

  it('onPickup-healsTheFullHeartPickupAmount', () => {
    const outcome = heart.onPickup(spawnHeartPickup('h1', 0, 0), { pool: [], total: 0, collectedBefore: 0 });
    expect(outcome).toEqual({ heal: HEART_PICKUP_HEAL_AMOUNT });
    expect(outcome).not.toHaveProperty('disposition');
    expect(outcome).not.toHaveProperty('self');
  });
});
