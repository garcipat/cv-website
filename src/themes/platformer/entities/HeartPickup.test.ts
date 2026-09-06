import {
  spawnHeartPickup,
  HEART_PICKUP_RENDERED_SIZE,
  HEART_PICKUP_TILE_OFFSET_X,
  HEART_PICKUP_TILE_OFFSET_Y,
} from './HeartPickup';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

describe('spawnHeartPickup', () => {
  it('called-startsAtTheGivenPosition', () => {
    const pickup = spawnHeartPickup('pot1', 100, 200);
    expect(pickup).toEqual({ id: 'pot1', x: 100, y: 200 });
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
