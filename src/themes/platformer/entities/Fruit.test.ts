import {
  spawnFruit,
  tickFruit,
  fruitY,
  FRUIT_FRAME_SIZE,
  FRUIT_ICON_COUNT,
  FRUIT_RISE_DURATION_SECONDS,
  fruitFrameSource,
} from './Fruit';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { CollectedFact } from '../types';

describe('fruitFrameSource', () => {
  it('indexZero-returnsFirstPriorityFruit', () => {
    expect(fruitFrameSource(0)).toEqual({ sx: 0, sy: 0 });
  });

  it('indicesWithinPriorityOrder-returnHandPickedFruitsFirst', () => {
    // Sheet positions 0, 2, 4, 10, 12 were hand-picked as the most
    // realistic-looking icons and take logical indices 0-4.
    expect(fruitFrameSource(1)).toEqual({ sx: 2 * FRUIT_FRAME_SIZE, sy: 0 });
    expect(fruitFrameSource(2)).toEqual({ sx: 0, sy: FRUIT_FRAME_SIZE });
    expect(fruitFrameSource(3)).toEqual({ sx: 2 * FRUIT_FRAME_SIZE, sy: 2 * FRUIT_FRAME_SIZE });
    expect(fruitFrameSource(4)).toEqual({ sx: 0, sy: 3 * FRUIT_FRAME_SIZE });
  });

  it('indicesBeyondPriorityOrder-returnRemainingFruitsInSheetOrder', () => {
    // The remaining sheet positions (1, 5, 6, 8, 9, 13, 14) follow as the
    // reserve pool, in their original left-to-right, top-to-bottom order.
    expect(fruitFrameSource(5)).toEqual({ sx: FRUIT_FRAME_SIZE, sy: 0 });
    expect(fruitFrameSource(6)).toEqual({ sx: FRUIT_FRAME_SIZE, sy: FRUIT_FRAME_SIZE });
    expect(fruitFrameSource(11)).toEqual({ sx: 2 * FRUIT_FRAME_SIZE, sy: 3 * FRUIT_FRAME_SIZE });
  });

  it('indexBeyondIconCount-wraps', () => {
    expect(fruitFrameSource(FRUIT_ICON_COUNT)).toEqual(fruitFrameSource(0));
  });
});

// Folded in from the removed entities/BonusFruit.test.ts (R-002 FR-022).
const testFact: CollectedFact = {
  id: 'qmark-cert-x',
  sectionId: 'certificates',
  sectionLabel: 'Certificates',
  data: { name: 'Test Cert', issuer: 'Test', date: '2024-01' },
  sourceType: 'block',
};

describe('spawnFruit', () => {
  it('called-startsAtBlockPositionWithZeroElapsed', () => {
    const fruit = spawnFruit('f1', 100, 200, undefined, 0);
    expect(fruit.id).toBe('f1');
    expect(fruit.x).toBe(100);
    expect(fruit.elapsed).toBe(0);
    expect(fruit.restY).toBe(200 - RENDERED_TILE_SIZE);
  });

  it('factProvided-carriesItForward', () => {
    const fruit = spawnFruit('f1', 100, 200, testFact, 0);
    expect(fruit.fact).toBe(testFact);
  });

  it('noFactProvided-factIsUndefined', () => {
    const fruit = spawnFruit('f1', 100, 200, undefined, 0);
    expect(fruit.fact).toBeUndefined();
  });

  it('iconIndexWithinRange-usedAsIs', () => {
    const fruit = spawnFruit('f1', 100, 200, undefined, 3);
    expect(fruit.iconIndex).toBe(3);
  });

  it('iconIndexOutOfRange-wrapsIntoValidRange', () => {
    const fruit = spawnFruit('f1', 100, 200, undefined, FRUIT_ICON_COUNT + 2);
    expect(fruit.iconIndex).toBe(2);
  });
});

describe('tickFruit', () => {
  it('called-accumulatesElapsed', () => {
    const fruit = tickFruit(spawnFruit('f1', 0, 0, undefined, 0), 0.1);
    expect(fruit.elapsed).toBeCloseTo(0.1);
  });
});

describe('fruitY', () => {
  it('justSpawned-yEqualsStartingBlockY', () => {
    const fruit = spawnFruit('f1', 0, 200, undefined, 0);
    expect(fruitY(fruit)).toBe(200);
  });

  it('riseDurationElapsed-yEqualsRestYOneTileHigher', () => {
    let fruit = spawnFruit('f1', 0, 200, undefined, 0);
    fruit = tickFruit(fruit, FRUIT_RISE_DURATION_SECONDS);
    expect(fruitY(fruit)).toBe(200 - RENDERED_TILE_SIZE);
  });

  it('midRise-yIsBetweenStartAndRest', () => {
    let fruit = spawnFruit('f1', 0, 200, undefined, 0);
    fruit = tickFruit(fruit, FRUIT_RISE_DURATION_SECONDS / 2);
    const y = fruitY(fruit);
    expect(y).toBeLessThan(200);
    expect(y).toBeGreaterThan(200 - RENDERED_TILE_SIZE);
  });

  it('pastRiseDuration-yStaysClampedAtRestY', () => {
    let fruit = spawnFruit('f1', 0, 200, undefined, 0);
    fruit = tickFruit(fruit, FRUIT_RISE_DURATION_SECONDS * 3);
    expect(fruitY(fruit)).toBe(200 - RENDERED_TILE_SIZE);
  });
});
