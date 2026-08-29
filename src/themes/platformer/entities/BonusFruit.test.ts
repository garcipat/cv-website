import {
  spawnBonusFruit,
  tickBonusFruit,
  bonusFruitY,
  BONUS_FRUIT_RISE_DURATION_SECONDS,
} from './BonusFruit';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

describe('spawnBonusFruit', () => {
  it('called-startsAtBlockPositionWithZeroElapsed', () => {
    const fruit = spawnBonusFruit('f1', 100, 200);
    expect(fruit.id).toBe('f1');
    expect(fruit.x).toBe(100);
    expect(fruit.elapsed).toBe(0);
    expect(fruit.restY).toBe(200 - RENDERED_TILE_SIZE);
  });
});

describe('tickBonusFruit', () => {
  it('called-accumulatesElapsed', () => {
    const fruit = tickBonusFruit(spawnBonusFruit('f1', 0, 0), 0.1);
    expect(fruit.elapsed).toBeCloseTo(0.1);
  });
});

describe('bonusFruitY', () => {
  it('justSpawned-yEqualsStartingBlockY', () => {
    const fruit = spawnBonusFruit('f1', 0, 200);
    expect(bonusFruitY(fruit)).toBe(200);
  });

  it('riseDurationElapsed-yEqualsRestYOneTileHigher', () => {
    let fruit = spawnBonusFruit('f1', 0, 200);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS);
    expect(bonusFruitY(fruit)).toBe(200 - RENDERED_TILE_SIZE);
  });

  it('midRise-yIsBetweenStartAndRest', () => {
    let fruit = spawnBonusFruit('f1', 0, 200);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS / 2);
    const y = bonusFruitY(fruit);
    expect(y).toBeLessThan(200);
    expect(y).toBeGreaterThan(200 - RENDERED_TILE_SIZE);
  });

  it('pastRiseDuration-yStaysClampedAtRestY', () => {
    let fruit = spawnBonusFruit('f1', 0, 200);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS * 3);
    expect(bonusFruitY(fruit)).toBe(200 - RENDERED_TILE_SIZE);
  });
});
