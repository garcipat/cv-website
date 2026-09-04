import { BLOCK_TYPES } from './index';
import { WORLD_TILESET_SHEET, STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { toBlockState } from '../Block';

describe('BLOCK_TYPES', () => {
  it('everyEntry-declaresItsOwnKey', () => {
    for (const [key, type] of Object.entries(BLOCK_TYPES)) {
      expect(type.key).toBe(key);
    }
  });

  it('mostEntries-drawFromTheSharedTileset', () => {
    // coinPot is the one exception — it draws from staticObjects.png's pot
    // variants instead (see CoinPot.ts), so it's excluded here and checked
    // separately below.
    for (const [key, type] of Object.entries(BLOCK_TYPES)) {
      if (key === 'coinPot') continue;
      expect(type.sprite.sheet).toBe(WORLD_TILESET_SHEET);
    }
  });

  it('coinPot-drawsFromTheStaticObjectsSheet', () => {
    expect(BLOCK_TYPES.coinPot.sprite.sheet).toBe(STATIC_OBJECTS_SHEET);
  });

  // These are the values maxHitsForBlock and isBlockRemoved encoded as
  // conditionals before they read the registry.
  it('crate-takesTwoHitsAndLeavesTheWorld', () => {
    expect(BLOCK_TYPES.crate).toMatchObject({ maxHits: 2, removeWhenUsedUp: true });
  });

  it('fragileRock-takesOneHitAndLeavesTheWorld', () => {
    expect(BLOCK_TYPES.fragileRock).toMatchObject({ maxHits: 1, removeWhenUsedUp: true });
  });

  it('questionMark-takesOneHitAndStaysInTheWorld', () => {
    expect(BLOCK_TYPES.questionMark).toMatchObject({ maxHits: 1, removeWhenUsedUp: false });
  });

  it('everyEntry-declaresANonEmptyTriggerSides', () => {
    for (const type of Object.values(BLOCK_TYPES)) {
      expect(type.triggerSides.length).toBeGreaterThan(0);
    }
  });

  // These are the values PlatformerPage.tsx's two hardcoded
  // `blockKind === 'coinPot'` filters encoded before the engine read the
  // registry.
  it('coinPot-reactsOnlyToALandingFromAbove', () => {
    expect(BLOCK_TYPES.coinPot.triggerSides).toEqual(['top']);
  });

  it('everyOtherKind-reactsOnlyToAHitFromBelow', () => {
    for (const [key, type] of Object.entries(BLOCK_TYPES)) {
      if (key === 'coinPot') continue;
      expect(type.triggerSides).toEqual(['bottom']);
    }
  });
});

describe('block frame selection', () => {
  it('intactQuestionMark-usesItsOwnFrame', () => {
    expect(BLOCK_TYPES.questionMark.frameIndex(0)).toBe(32);
  });

  it('usedUpQuestionMark-swapsToThePlainGroundFrame', () => {
    expect(BLOCK_TYPES.questionMark.frameIndex(1)).toBe(1);
  });

  it('crate-keepsOneFrameRegardlessOfHits', () => {
    expect(BLOCK_TYPES.crate.frameIndex(0)).toBe(BLOCK_TYPES.crate.frameIndex(2));
  });
});

describe('questionMark.onHit', () => {
  it('itsOnlyHit-spawnsABonusFruit', () => {
    // maxHits is 1, so its only registering hit is always its terminal one.
    const qmark = toBlockState({ id: 'q1', blockKind: 'questionMark', x: 0, y: 0 });

    expect(BLOCK_TYPES.questionMark.onHit!({ ...qmark, hitsTaken: 1 })).toEqual({
      spawnPickup: 'bonusFruit',
    });
  });
});

describe('fragileRock', () => {
  it('anyHit-hasNoConsequencesBeyondBreaking', () => {
    expect(BLOCK_TYPES.fragileRock.onHit).toBeUndefined();
  });
});
