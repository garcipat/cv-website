import {
  spawnBonusFruit,
  tickBonusFruit,
  bonusFruitY,
  BONUS_FRUIT_RISE_DURATION_SECONDS,
} from './BonusFruit';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { FRUIT_ICON_COUNT } from './Fruit';
import type { CollectedFact } from '../types';

const testFact: CollectedFact = {
  id: 'qmark-cert-x',
  sectionId: 'certificates',
  sectionLabel: 'Certificates',
  data: { name: 'Test Cert', issuer: 'Test', date: '2024-01' },
  sourceType: 'block',
};

describe('spawnBonusFruit', () => {
  it('called-startsAtBlockPositionWithZeroElapsed', () => {
    const fruit = spawnBonusFruit('f1', 100, 200, undefined, 0);
    expect(fruit.id).toBe('f1');
    expect(fruit.x).toBe(100);
    expect(fruit.elapsed).toBe(0);
    expect(fruit.restY).toBe(200 - RENDERED_TILE_SIZE);
  });

  it('factProvided-carriesItForward', () => {
    const fruit = spawnBonusFruit('f1', 100, 200, testFact, 0);
    expect(fruit.fact).toBe(testFact);
  });

  it('noFactProvided-factIsUndefined', () => {
    const fruit = spawnBonusFruit('f1', 100, 200, undefined, 0);
    expect(fruit.fact).toBeUndefined();
  });

  it('iconIndexWithinRange-usedAsIs', () => {
    const fruit = spawnBonusFruit('f1', 100, 200, undefined, 3);
    expect(fruit.iconIndex).toBe(3);
  });

  it('iconIndexOutOfRange-wrapsIntoValidRange', () => {
    const fruit = spawnBonusFruit('f1', 100, 200, undefined, FRUIT_ICON_COUNT + 2);
    expect(fruit.iconIndex).toBe(2);
  });
});

describe('tickBonusFruit', () => {
  it('called-accumulatesElapsed', () => {
    const fruit = tickBonusFruit(spawnBonusFruit('f1', 0, 0, undefined, 0), 0.1);
    expect(fruit.elapsed).toBeCloseTo(0.1);
  });
});

describe('bonusFruitY', () => {
  it('justSpawned-yEqualsStartingBlockY', () => {
    const fruit = spawnBonusFruit('f1', 0, 200, undefined, 0);
    expect(bonusFruitY(fruit)).toBe(200);
  });

  it('riseDurationElapsed-yEqualsRestYOneTileHigher', () => {
    let fruit = spawnBonusFruit('f1', 0, 200, undefined, 0);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS);
    expect(bonusFruitY(fruit)).toBe(200 - RENDERED_TILE_SIZE);
  });

  it('midRise-yIsBetweenStartAndRest', () => {
    let fruit = spawnBonusFruit('f1', 0, 200, undefined, 0);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS / 2);
    const y = bonusFruitY(fruit);
    expect(y).toBeLessThan(200);
    expect(y).toBeGreaterThan(200 - RENDERED_TILE_SIZE);
  });

  it('pastRiseDuration-yStaysClampedAtRestY', () => {
    let fruit = spawnBonusFruit('f1', 0, 200, undefined, 0);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS * 3);
    expect(bonusFruitY(fruit)).toBe(200 - RENDERED_TILE_SIZE);
  });
});
