import { describe, it, expect } from 'vitest';
import { clamp01, smoothstep, lerp, hash2D, pulse, shakeOffsetX } from './math';

/** The former inline `clamp01` bodies this module replaces. */
const legacyClamp = (x: number) => Math.max(0, Math.min(1, x));

/** The former inline `smoothstep` body this module replaces. */
const legacySmoothstep = (t: number) => t * t * (3 - 2 * t);

/** The former salted position hash in `engine/Lighting.ts`. */
const legacySaltedHash = (col: number, row: number, salt: number) =>
  (Math.imul(col + salt * 92821, 374761393) ^ Math.imul(row + salt * 68917, 668265263)) >>> 0;

/** The former unsalted position hash in `Torch.ts`/`StaticObjectsCatalog.ts`. */
const legacyUnsaltedHash = (col: number, row: number) =>
  (Math.imul(col, 374761393) ^ Math.imul(row, 668265263)) >>> 0;

describe('clamp01', () => {
  it('belowZero-clampsToZero', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(-100)).toBe(0);
  });

  it('aboveOne-clampsToOne', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(100)).toBe(1);
  });

  it('withinZeroToOne-returnsValueUnchanged', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
  });

  it('anyFiniteInput-isByteEqualToTheFormerInlineFormula', () => {
    for (const x of [-3, -0.1, 0, 0.37, 1, 2.5]) {
      expect(clamp01(x)).toBe(legacyClamp(x));
    }
  });
});

describe('smoothstep', () => {
  it('zero-returnsZero', () => {
    expect(smoothstep(0)).toBe(0);
  });

  it('one-returnsOne', () => {
    expect(smoothstep(1)).toBe(1);
  });

  it('halfway-returnsHalf', () => {
    expect(smoothstep(0.5)).toBe(0.5);
  });

  it('anyInput-isByteEqualToTheFormerInlineFormula', () => {
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 1, 1.5]) {
      expect(smoothstep(t)).toBe(legacySmoothstep(t));
    }
  });
});

describe('lerp', () => {
  it('tZero-returnsA', () => {
    expect(lerp(3, 9, 0)).toBe(3);
  });

  it('tOne-returnsB', () => {
    expect(lerp(3, 9, 1)).toBe(9);
  });

  it('tHalfway-returnsMidpoint', () => {
    expect(lerp(3, 9, 0.5)).toBe(6);
  });

  it('tPastOne-isClampedToOne', () => {
    expect(lerp(3, 9, 2)).toBe(9);
  });

  it('tBelowZero-isClampedToZero', () => {
    expect(lerp(3, 9, -1)).toBe(3);
  });
});

describe('hash2D', () => {
  it('saltZero-isByteEqualToTheFormerUnsaltedHash', () => {
    const cells = [
      [0, 0],
      [1, 2],
      [7, 13],
      [100, 250],
      [1234, 4321],
    ] as const;
    for (const [col, row] of cells) {
      expect(hash2D(col, row, 0)).toBe(legacyUnsaltedHash(col, row));
    }
  });

  it('saltOmitted-isIdenticalToSaltZero', () => {
    for (const [col, row] of [
      [0, 0],
      [3, 5],
      [99, 12],
    ] as const) {
      expect(hash2D(col, row)).toBe(hash2D(col, row, 0));
    }
  });

  it('saltOneTwoThree-areByteEqualToTheFormerSaltedHash', () => {
    const cells = [
      [0, 0],
      [1, 2],
      [7, 13],
      [100, 250],
    ] as const;
    for (const salt of [1, 2, 3]) {
      for (const [col, row] of cells) {
        expect(hash2D(col, row, salt)).toBe(legacySaltedHash(col, row, salt));
      }
    }
  });

  it('anyInput-returnsAnUnsignedThirtyTwoBitInteger', () => {
    for (const value of [hash2D(0, 0), hash2D(5, 9, 3), hash2D(-4, 12, 2)]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 32);
    }
  });
});

describe('pulse', () => {
  it('phaseZero-returnsZero', () => {
    expect(pulse(0)).toBeCloseTo(0);
  });

  it('phaseQuarter-returnsOne', () => {
    expect(pulse(0.25)).toBeCloseTo(1);
  });

  it('phaseHalf-returnsZero', () => {
    expect(pulse(0.5)).toBeCloseTo(0);
  });

  it('phaseThreeQuarters-returnsMinusOne', () => {
    expect(pulse(0.75)).toBeCloseTo(-1);
  });
});

describe('shakeOffsetX', () => {
  it('amplitudeOne-isByteEqualToTheFormerCrumblingFloorShake', () => {
    for (const elapsed of [0, 0.01, 0.05, 0.2]) {
      expect(shakeOffsetX(elapsed, 1)).toBe(Math.sin(elapsed * 40) * 1);
    }
  });

  it('amplitudeOnePointFive-isByteEqualToTheFormerStalactiteShake', () => {
    for (const elapsed of [0, 0.01, 0.05, 0.2]) {
      expect(shakeOffsetX(elapsed, 1.5)).toBe(Math.sin(elapsed * 40) * 1.5);
    }
  });
});
