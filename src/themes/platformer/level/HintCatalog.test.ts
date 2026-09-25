import { describe, it, expect } from 'vitest';
import {
  HINT_IDS,
  DEFAULT_HINT_ID,
  hintCode,
  nextHintId,
  isSignHintId,
  type SignHintId,
  type BubbleMessageId,
} from './HintCatalog';

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

  it('isSignHintId-acceptsEveryRegisteredHintAndRejectsEverythingElse', () => {
    for (const id of HINT_IDS) expect(isSignHintId(id)).toBe(true);
    expect(isSignHintId('noKeyForChest')).toBe(false);
    expect(isSignHintId('noBombs')).toBe(false);
    expect(isSignHintId('notAHint')).toBe(false);
    expect(isSignHintId(undefined)).toBe(false);
    expect(isSignHintId(3)).toBe(false);
  });

  it('signHintIdsAreAssignableToBubbleMessageIds', () => {
    const signHint: SignHintId = 'bridgeDropThrough';
    const bubbleMessage: BubbleMessageId = signHint;
    expect(bubbleMessage).toBe('bridgeDropThrough');
  });

  it('uiOnlyMessagesAreNotSignHintIds', () => {
    // A UI-only bubble message is a valid BubbleMessageId but must fail to
    // type-check as a SignHintId — the whole point of splitting the old mixed
    // sign-or-bubble id union (FR-007).
    // @ts-expect-error noKeyForChest is a bubble-only message, not a sign hint
    const uiOnly: SignHintId = 'noKeyForChest';
    expect(uiOnly).toBe('noKeyForChest');
  });
});
