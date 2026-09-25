import {
  spawnFruit,
  tickFruit,
  fruitY,
  FRUIT_FRAME_SIZE,
  FRUIT_ICON_COUNT,
  FRUIT_RISE_DURATION_SECONDS,
  fruitFrameSource,
  fruit,
} from './Fruit';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { CollectedFact } from '../../types';

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
    const f = spawnFruit('f1', 100, 200, undefined, 0);
    expect(f.id).toBe('f1');
    expect(f.kind).toBe('fruit');
    expect(f.x).toBe(100);
    expect(f.y).toBe(200);
    expect(f.collected).toBe(false);
    expect(f.elapsed).toBe(0);
    expect(f.restY).toBe(200 - RENDERED_TILE_SIZE);
  });

  it('factProvided-carriesItForward', () => {
    expect(spawnFruit('f1', 100, 200, testFact, 0).fact).toBe(testFact);
  });

  it('noFactProvided-factIsUndefined', () => {
    expect(spawnFruit('f1', 100, 200, undefined, 0).fact).toBeUndefined();
  });

  it('iconIndexWithinRange-usedAsIs', () => {
    expect(spawnFruit('f1', 100, 200, undefined, 3).iconIndex).toBe(3);
  });

  it('iconIndexOutOfRange-wrapsIntoValidRange', () => {
    expect(spawnFruit('f1', 100, 200, undefined, FRUIT_ICON_COUNT + 2).iconIndex).toBe(2);
  });
});

describe('tickFruit', () => {
  it('called-accumulatesElapsed', () => {
    const f = tickFruit(spawnFruit('f1', 0, 0, undefined, 0), 0.1);
    expect(f.elapsed).toBeCloseTo(0.1);
  });

  it('called-keepsTheStoredYInSyncWithTheRiseEasing', () => {
    const mid = tickFruit(spawnFruit('f1', 0, 200, undefined, 0), FRUIT_RISE_DURATION_SECONDS / 2);
    expect(mid.y).toBe(fruitY(mid));
    const rest = tickFruit(spawnFruit('f1', 0, 200, undefined, 0), FRUIT_RISE_DURATION_SECONDS);
    expect(rest.y).toBe(fruitY(rest));
    expect(rest.y).toBe(200 - RENDERED_TILE_SIZE);
  });
});

describe('fruitY', () => {
  it('justSpawned-yEqualsStartingBlockY', () => {
    expect(fruitY(spawnFruit('f1', 0, 200, undefined, 0))).toBe(200);
  });

  it('riseDurationElapsed-yEqualsRestYOneTileHigher', () => {
    const f = tickFruit(spawnFruit('f1', 0, 200, undefined, 0), FRUIT_RISE_DURATION_SECONDS);
    expect(fruitY(f)).toBe(200 - RENDERED_TILE_SIZE);
  });

  it('midRise-yIsBetweenStartAndRest', () => {
    const f = tickFruit(spawnFruit('f1', 0, 200, undefined, 0), FRUIT_RISE_DURATION_SECONDS / 2);
    const y = fruitY(f);
    expect(y).toBeLessThan(200);
    expect(y).toBeGreaterThan(200 - RENDERED_TILE_SIZE);
  });

  it('pastRiseDuration-yStaysClampedAtRestY', () => {
    const f = tickFruit(spawnFruit('f1', 0, 200, undefined, 0), FRUIT_RISE_DURATION_SECONDS * 3);
    expect(fruitY(f)).toBe(200 - RENDERED_TILE_SIZE);
  });
});

describe('fruit view', () => {
  it('key-isFruit-andDrawLayerIsBelowBlocks', () => {
    expect(fruit.key).toBe('fruit');
    expect(fruit.drawLayer).toBe('belowBlocks');
  });

  it('isCollectible-notUntilTheRiseFinishes', () => {
    const rising = spawnFruit('f1', 0, 200, undefined, 0);
    expect(fruit.isCollectible?.(rising, { playerHitPoints: 6 })).toBe(false);
    const rested = tickFruit(rising, FRUIT_RISE_DURATION_SECONDS);
    expect(fruit.isCollectible?.(rested, { playerHitPoints: 6 })).toBe(true);
  });

  it('onPickup-revealsItsFactWithTheFruitsCounter-andRetainsTheEntry', () => {
    const withFact = spawnFruit('f1', 0, 0, testFact, 0);
    const outcome = fruit.onPickup(withFact, { pool: [], total: 1, collectedBefore: 0 });
    expect(outcome.facts).toEqual([{ fact: testFact, effectId: 'f1', counterKey: 'fruits' }]);
    expect(outcome).not.toHaveProperty('disposition');
    expect(outcome).not.toHaveProperty('self');
  });

  it('onPickup-factlessFruitAsksForNothing', () => {
    const factless = spawnFruit('f1', 0, 0, undefined, 0);
    expect(fruit.onPickup(factless, { pool: [], total: 1, collectedBefore: 0 })).toEqual({});
  });
});
