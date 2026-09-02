import { crate, crateCrackOverlayVisible, crateShatterOpacity } from './Crate';
import { toBlockState } from '../Block';
import type { BlockState } from '../Block';
import type { BlockPlacement } from '../../level/BlockMapper';
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
