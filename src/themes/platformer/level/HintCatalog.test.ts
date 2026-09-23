import { describe, it, expect } from 'vitest';
import { HINT_IDS, DEFAULT_HINT_ID, hintCode, nextHintId, isHintId } from './HintCatalog';

describe('HintCatalog', () => {
  it('HINT_IDS-preservesTheOldDigitOrder', () => {
    // The order the old SIGN_CHARS digits carried (1 = bridgeDropThrough …
    // 6 = bomb), so badge codes and legacy migration agree.
    expect(HINT_IDS).toEqual([
      'bridgeDropThrough',
      'ladderClimbUp',
      'fragileRockBreaksFromBelow',
      'chestNeedsKey',
      'openAllChestsHaveFun',
      'bomb',
    ]);
  });

  it('DEFAULT_HINT_ID-isTheFirstRegisteredHint', () => {
    expect(DEFAULT_HINT_ID).toBe(HINT_IDS[0]);
  });

  it('hintCode-returnsTheDigitsOneThroughSix', () => {
    expect(HINT_IDS.map(hintCode)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('nextHintId-walksTheListInOrderAndWrapsAround', () => {
    expect(nextHintId('bridgeDropThrough')).toBe('ladderClimbUp');
    expect(nextHintId('openAllChestsHaveFun')).toBe('bomb');
    expect(nextHintId('bomb')).toBe('bridgeDropThrough');
  });

  it('isHintId-acceptsEveryRegisteredHintAndRejectsEverythingElse', () => {
    for (const id of HINT_IDS) expect(isHintId(id)).toBe(true);
    expect(isHintId('noKeyForChest')).toBe(false);
    expect(isHintId('notAHint')).toBe(false);
    expect(isHintId(undefined)).toBe(false);
    expect(isHintId(3)).toBe(false);
  });
});
