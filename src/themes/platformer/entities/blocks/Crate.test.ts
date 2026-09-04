import { crate, crateCrackOverlayVisible, crateShatterOpacity } from './Crate';
import { toBlockState } from '../Block';
import type { BlockState } from '../Block';
import type { BlockPlacement } from '../../level/BlockMapper';
import type { CollectedFact } from '../../types';
import { CRATE_SHATTER_DURATION_SECONDS } from '../../engine/BlockAI';

function block(overrides: Partial<BlockState> = {}): BlockState {
  const placement: BlockPlacement = { id: 'c1', blockKind: 'crate', x: 0, y: 0 };
  return { ...toBlockState(placement), ...overrides };
}

describe('crateCrackOverlayVisible', () => {
  it('hitsTakenZero-notVisible', () => expect(crateCrackOverlayVisible(0)).toBe(false));
  it('hitsTakenOne-visible', () => expect(crateCrackOverlayVisible(1)).toBe(true));
  it('hitsTakenTwo-noLongerVisible', () => expect(crateCrackOverlayVisible(2)).toBe(false));
});

describe('crateShatterOpacity', () => {
  it('nonShatteringBlock-returnsFullOpacity', () => {
    expect(crateShatterOpacity(block({ animState: 'idle' }))).toBe(1);
    expect(crateShatterOpacity(block({ animState: 'bump' }))).toBe(1);
  });
  it('shatterStart-fullOpacity', () => {
    expect(crateShatterOpacity(block({ animState: 'shatter', animTimer: 0 }))).toBe(1);
  });
  it('shatterEnd-zeroOpacity', () => {
    expect(crateShatterOpacity(block({ animState: 'shatter', animTimer: CRATE_SHATTER_DURATION_SECONDS }))).toBe(0);
  });
});

describe('crate.key', () => {
  it('matchesItsRegistrySlot', () => expect(crate.key).toBe('crate'));
});

describe('crate.onHit', () => {
  const crateFact: CollectedFact = {
    id: 'crate-edu-1',
    sectionId: 'education',
    sectionLabel: 'Education',
    data: { degree: 'BSc', institution: 'X', startDate: '2010-01' },
    sourceType: 'block',
  };

  // A crate takes two hits: the first cracks it, the second shatters it and
  // pays out. onHit receives the block AFTER applyBlockHit, so hitsTaken is
  // already incremented when it runs.
  it('firstOfTwoHits-revealsNothing', () => {
    const outcome = crate.onHit!(block({ hitsTaken: 1, fact: crateFact }));

    expect(outcome).toEqual({});
  });

  it('terminalHit-revealsItsFact', () => {
    const outcome = crate.onHit!(block({ hitsTaken: 2, fact: crateFact }));

    expect(outcome).toEqual({ revealFact: crateFact });
  });

  it('terminalHitWithNoFact-revealsNothing', () => {
    const outcome = crate.onHit!(block({ hitsTaken: 2, fact: undefined }));

    expect(outcome).toEqual({});
  });
});
