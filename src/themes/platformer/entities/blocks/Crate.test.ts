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

describe('crate.onHit', () => {
  // A crate takes two hits: the first cracks it, the second shatters it and
  // pays out. onHit receives the block AFTER applyBlockHit, so hitsTaken is
  // already incremented when it runs.
  //
  // Which fact (if any) a destroyed crate reveals is no longer decided here:
  // a crate carries no fixed fact of its own — PlatformerPage.tsx resolves
  // that dynamically from the shared crate fact pool, proportionally across
  // however many crates the level has (see PlatformerState.ts's
  // crateFactPool doc comment), the same way a coin pickup already works.
  // onHit's only job is to signal "a crate was just destroyed" via
  // counterKey, regardless of whether this specific crate has a `fact`.
  it('firstOfTwoHits-signalsNothing', () => {
    const outcome = crate.onHit!(block({ hitsTaken: 1 }));

    expect(outcome).toEqual({});
  });

  it('terminalHit-signalsTheCratesCounter', () => {
    const outcome = crate.onHit!(block({ hitsTaken: 2 }));

    expect(outcome).toEqual({ counterKey: 'crates' });
  });
});
