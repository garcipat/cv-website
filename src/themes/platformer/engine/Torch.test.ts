import { describe, it, expect } from 'vitest';
import {
  TORCH_FRAME_DURATION_SECONDS,
  TORCH_FRAME_COUNT,
  TORCH_FRAME_WIDTH,
  TORCH_FRAME_HEIGHT,
  TORCH_CONTENT_WIDTH,
  TORCH_INSET_X,
  torchPhase,
  torchFrameIndex,
} from './Torch';

describe('Torch constants', () => {
  it('frameDuration-isTwoTenthsOfASecond', () => {
    expect(TORCH_FRAME_DURATION_SECONDS).toBe(0.2);
  });

  it('frameCount-isFour', () => {
    expect(TORCH_FRAME_COUNT).toBe(4);
  });

  it('frameSize-matchesTheTorchSheetFrame', () => {
    expect(TORCH_FRAME_WIDTH).toBe(12);
    expect(TORCH_FRAME_HEIGHT).toBe(14);
  });

  it('contentWidth-isTheArtworksSixPixelWidth', () => {
    // Narrower than the 12px frame: the flame/bracket art is 6px wide, with a
    // 3px transparent margin per side inside the frame.
    expect(TORCH_CONTENT_WIDTH).toBe(6);
    expect(TORCH_CONTENT_WIDTH).toBeLessThan(TORCH_FRAME_WIDTH);
  });

  it('insetX-centresTheTwelvePixelFrameInASixteenPixelCell', () => {
    expect(TORCH_INSET_X).toBe(2);
    expect(TORCH_INSET_X).toBe((16 - TORCH_FRAME_WIDTH) / 2);
  });
});

describe('torchPhase', () => {
  it('returnsAnIntegerInRange', () => {
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 8; row++) {
        const phase = torchPhase(col, row);
        expect(Number.isInteger(phase)).toBe(true);
        expect(phase).toBeGreaterThanOrEqual(0);
        expect(phase).toBeLessThan(TORCH_FRAME_COUNT);
      }
    }
  });

  it('isDeterministicForAGivenCell', () => {
    expect(torchPhase(3, 5)).toBe(torchPhase(3, 5));
    expect(torchPhase(0, 0)).toBe(torchPhase(0, 0));
  });

  it('adjacentCellsAreOutOfPhase', () => {
    // (0,0) hashes to phase 0 and (1,0) to phase 1 — two neighbouring cells
    // must not always share a phase, or every torch on screen would strobe in
    // unison (spec FR-009).
    expect(torchPhase(0, 0)).not.toBe(torchPhase(1, 0));
  });

  it('negativeCoordinatesDoNotThrow', () => {
    expect(() => torchPhase(-1, -2)).not.toThrow();
    expect(Number.isInteger(torchPhase(-1, -2))).toBe(true);
  });
});

describe('torchFrameIndex', () => {
  it('atWorldElapsedZero-equalsTorchPhase', () => {
    expect(torchFrameIndex(2, 3, 0)).toBe(torchPhase(2, 3));
  });

  it('holdsAFrameForTheWholeDurationThenAdvances', () => {
    const phase = torchPhase(4, 4);
    expect(torchFrameIndex(4, 4, TORCH_FRAME_DURATION_SECONDS * 0.999)).toBe(phase);
    expect(torchFrameIndex(4, 4, TORCH_FRAME_DURATION_SECONDS)).toBe(
      (phase + 1) % TORCH_FRAME_COUNT,
    );
  });

  it('wrapsModuloTheFrameCount', () => {
    const phase = torchPhase(1, 2);
    const fullLoop = TORCH_FRAME_DURATION_SECONDS * TORCH_FRAME_COUNT;
    expect(torchFrameIndex(1, 2, fullLoop)).toBe(phase);
    expect(torchFrameIndex(1, 2, fullLoop + TORCH_FRAME_DURATION_SECONDS)).toBe(
      (phase + 1) % TORCH_FRAME_COUNT,
    );
  });

  it('alwaysReturnsAnIndexInRangeForAnyElapsedTime', () => {
    for (const elapsed of [0, 0.05, 0.2, 0.75, 1.3, 10.9, 1000.123]) {
      const frame = torchFrameIndex(3, 7, elapsed);
      expect(Number.isInteger(frame)).toBe(true);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(TORCH_FRAME_COUNT);
    }
  });

  it('isStableAcrossRepeatedCalls', () => {
    expect(torchFrameIndex(5, 6, 1.234)).toBe(torchFrameIndex(5, 6, 1.234));
  });
});
