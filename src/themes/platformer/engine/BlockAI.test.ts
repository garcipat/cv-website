import {
  stepBlockAnimation,
  blockBumpOffsetY,
  BLOCK_BUMP_DURATION_SECONDS,
  CRATE_SHATTER_DURATION_SECONDS,
} from './BlockAI';
import { toBlockState } from '../entities/Block';
import type { BlockState } from '../entities/Block';
import type { BlockPlacement } from '../level/BlockMapper';

function block(overrides: Partial<BlockState> = {}): BlockState {
  const placement: BlockPlacement = { id: 'b1', blockKind: 'fragileRock', x: 0, y: 0 };
  return { ...toBlockState(placement), ...overrides };
}

describe('stepBlockAnimation', () => {
  it('idleBlock-isANoOp', () => {
    const b = block({ animState: 'idle' });
    expect(stepBlockAnimation(b, 1 / 60)).toBe(b);
  });

  it('bumping-midDuration-accumulatesTimerStaysInBump', () => {
    const b = block({ animState: 'bump', animTimer: 0 });
    const next = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS / 2);
    expect(next.animState).toBe('bump');
    expect(next.animTimer).toBeCloseTo(BLOCK_BUMP_DURATION_SECONDS / 2);
  });

  it('bumping-fragileRockOrQuestionMark-durationElapsed-revertsToIdle', () => {
    const b = block({ blockKind: 'fragileRock', hitsTaken: 1, animState: 'bump', animTimer: 0 });
    const next = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS);
    expect(next.animState).toBe('idle');
    expect(next.animTimer).toBe(0);
  });

  it('bumping-crateBelowMaxHits-durationElapsed-revertsToIdleNotShatter', () => {
    const b = block({ blockKind: 'crate', hitsTaken: 1, animState: 'bump', animTimer: 0 });
    const next = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS);
    expect(next.animState).toBe('idle');
  });

  it('bumping-crateAtMaxHits-durationElapsed-entersShatter', () => {
    const b = block({ blockKind: 'crate', hitsTaken: 2, animState: 'bump', animTimer: 0 });
    const next = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS);
    expect(next.animState).toBe('shatter');
    expect(next.animTimer).toBe(0);
  });

  it('shattering-midDuration-accumulatesTimerStaysInShatter', () => {
    const b = block({ blockKind: 'crate', hitsTaken: 2, animState: 'shatter', animTimer: 0 });
    const next = stepBlockAnimation(b, CRATE_SHATTER_DURATION_SECONDS / 2);
    expect(next.animState).toBe('shatter');
  });

  it('shattering-durationElapsed-revertsToIdle', () => {
    const b = block({ blockKind: 'crate', hitsTaken: 2, animState: 'shatter', animTimer: 0 });
    const next = stepBlockAnimation(b, CRATE_SHATTER_DURATION_SECONDS);
    expect(next.animState).toBe('idle');
  });

  it('durationSplitAcrossTwoTicks-stillCompletesCorrectly', () => {
    let b = block({ animState: 'bump', animTimer: 0 });
    b = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS * 0.6);
    expect(b.animState).toBe('bump');
    b = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS * 0.6);
    expect(b.animState).toBe('idle');
  });
});

describe('blockBumpOffsetY', () => {
  it('idleBlock-returnsZero', () => {
    expect(blockBumpOffsetY(block({ animState: 'idle' }))).toBe(0);
  });
  it('shatteringBlock-returnsZero', () => {
    expect(blockBumpOffsetY(block({ animState: 'shatter' }))).toBe(0);
  });
  it('bumpStart-offsetIsZero', () => {
    expect(blockBumpOffsetY(block({ animState: 'bump', animTimer: 0 }))).toBe(0);
  });
  it('bumpMidpoint-offsetIsNegativeMaximum', () => {
    const offset = blockBumpOffsetY(block({ animState: 'bump', animTimer: BLOCK_BUMP_DURATION_SECONDS / 2 }));
    expect(offset).toBeLessThan(0);
  });
  it('bumpEnd-offsetReturnsToZero', () => {
    const offset = blockBumpOffsetY(block({ animState: 'bump', animTimer: BLOCK_BUMP_DURATION_SECONDS }));
    expect(offset).toBeCloseTo(0, 1);
  });
});
