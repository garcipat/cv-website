import { BLOCK_TYPES } from './index';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';

describe('BLOCK_TYPES', () => {
  it('everyEntry-declaresItsOwnKey', () => {
    for (const [key, type] of Object.entries(BLOCK_TYPES)) {
      expect(type.key).toBe(key);
    }
  });

  it('everyEntry-drawsFromTheSharedTileset', () => {
    for (const type of Object.values(BLOCK_TYPES)) {
      expect(type.sprite.sheet).toBe(WORLD_TILESET_SHEET);
    }
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
