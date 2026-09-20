import { PICKUP_TYPES } from './index';
import { COIN_SHEET, FRUIT_SHEET, KEY_SHEET, HEARTS_SHEET, BOMB_SHEET } from '../sprites/sheets';
import { spawnKeyPickup } from '../KeyPickup';
import { spawnHeartPickup, HEART_PICKUP_RENDERED_SIZE, HEART_PICKUP_TILE_OFFSET_X } from '../HeartPickup';
import {
  spawnBombPickup,
  BOMB_PICKUP_RENDERED_SIZE,
  BOMB_PICKUP_TILE_OFFSET_X,
  BOMB_PICKUP_TILE_OFFSET_Y,
} from '../BombPickup';
import { spawnBonusFruit, BONUS_FRUIT_RISE_DURATION_SECONDS, bonusFruitY } from '../BonusFruit';
import type { CollectiblePlacement } from '../../level/CollectibleMapper';

function makePlacement(x: number, y: number): CollectiblePlacement {
  return { id: 'coin-x', spriteType: 'coin', x, y };
}

describe('PICKUP_TYPES', () => {
  it('everyEntry-declaresItsOwnKey', () => {
    for (const [key, type] of Object.entries(PICKUP_TYPES)) {
      expect(type.key).toBe(key);
    }
  });

  it('eachEntry-pointsAtItsOwnSheet', () => {
    expect(PICKUP_TYPES.coin.sprite.sheet).toBe(COIN_SHEET);
    expect(PICKUP_TYPES.fruit.sprite.sheet).toBe(FRUIT_SHEET);
    expect(PICKUP_TYPES.key.sprite.sheet).toBe(KEY_SHEET);
    expect(PICKUP_TYPES.bonusFruit.sprite.sheet).toBe(FRUIT_SHEET);
    expect(PICKUP_TYPES.heart.sprite.sheet).toBe(HEARTS_SHEET);
    expect(PICKUP_TYPES.bomb.sprite.sheet).toBe(BOMB_SHEET);
  });
});

describe('pickup boxes match the boxes collision uses today', () => {
  it('coin-boxIsItsPlacementAtRenderedSize', () => {
    expect(PICKUP_TYPES.coin.box(makePlacement(100, 200))).toEqual({
      x: 100,
      y: 200,
      width: 32,
      height: 32,
    });
  });

  it('key-boxIsOffsetAndNarrowerThanATile', () => {
    // KEY_RENDERED_WIDTH is round(14/22 * 32) = 20, so the key is centered
    // over its tile with a 6px inset each side; its height fills the tile.
    expect(PICKUP_TYPES.key.box(spawnKeyPickup('k', 100, 200))).toEqual({
      x: 106,
      y: 200,
      width: 20,
      height: 32,
    });
  });

  it('bonusFruit-boxFollowsTheRiseTween', () => {
    const fruit = spawnBonusFruit('b', 100, 200, undefined, 0);
    expect(PICKUP_TYPES.bonusFruit.box(fruit).y).toBe(bonusFruitY(fruit));

    const risen = { ...fruit, elapsed: BONUS_FRUIT_RISE_DURATION_SECONDS };
    expect(PICKUP_TYPES.bonusFruit.box(risen).y).toBe(risen.restY);
  });

  it('heart-boxIsCenteredAtItsSmallerRenderedSize', () => {
    expect(PICKUP_TYPES.heart.box(spawnHeartPickup('h', 100, 200))).toEqual({
      x: 100 + HEART_PICKUP_TILE_OFFSET_X,
      y: 200 + HEART_PICKUP_TILE_OFFSET_X,
      width: HEART_PICKUP_RENDERED_SIZE,
      height: HEART_PICKUP_RENDERED_SIZE,
    });
  });

  it('bomb-boxIsCenteredAtItsSmallerRenderedSize', () => {
    expect(PICKUP_TYPES.bomb.box(spawnBombPickup('b', 100, 200))).toEqual({
      x: 100 + BOMB_PICKUP_TILE_OFFSET_X,
      y: 200 + BOMB_PICKUP_TILE_OFFSET_Y,
      width: BOMB_PICKUP_RENDERED_SIZE,
      height: BOMB_PICKUP_RENDERED_SIZE,
    });
  });
});

describe('pickup frames match their existing frame functions', () => {
  it('coinFrameIndex-followsTheSharedWorldClock', () => {
    expect(PICKUP_TYPES.coin.frameIndex(makePlacement(0, 0), 0, 0)).toBe(0);
    expect(PICKUP_TYPES.coin.frameIndex(makePlacement(0, 0), 0.12 * 3, 0)).toBe(3);
  });

  it('key-hasASingleFrame', () => {
    expect(PICKUP_TYPES.key.frameIndex(spawnKeyPickup('k', 0, 0), 99, 0)).toBe(0);
  });

  it('fruitFrameIndex-tracksItsPositionAmongPlacements', () => {
    const placement = makePlacement(0, 0);
    expect(PICKUP_TYPES.fruit.frameIndex(placement, 0, 0)).toBe(0);
    expect(PICKUP_TYPES.fruit.frameIndex(placement, 0, 1)).toBe(1);
  });

  it('heart-alwaysShowsTheFullHeartFrame', () => {
    // Frame 0 of hearts.png (see Health.ts's heartFrameIndex) — a dropped
    // heart is always a whole half-heart's worth, never half or empty.
    expect(PICKUP_TYPES.heart.frameIndex(spawnHeartPickup('h', 0, 0), 99, 0)).toBe(0);
  });

  it('bomb-alwaysShowsTheUnlitFrame', () => {
    // Frame 0 of bomb.png — the same unlit bomb the HUD counter uses; a
    // placed bomb's lit frames 1-5 never appear on a world pickup (O-012).
    expect(PICKUP_TYPES.bomb.frameIndex(spawnBombPickup('b', 0, 0), 99, 0)).toBe(0);
  });
});

describe('bomb pickup carries no CV fact (FR-011)', () => {
  it('bomb-hasNoFactField', () => {
    expect('fact' in PICKUP_TYPES.bomb).toBe(false);
  });

  it('bomb-isNeverACollectiblePlacement', () => {
    // A CollectiblePlacement's spriteType is the fact-bearing coin/fruit set;
    // a bomb feeds no fact pool and no journal counter.
    const collectibleSpriteTypes: CollectiblePlacement['spriteType'][] = ['coin', 'fruit'];
    expect(collectibleSpriteTypes.includes(PICKUP_TYPES.bomb.key as CollectiblePlacement['spriteType'])).toBe(
      false,
    );
  });
});
