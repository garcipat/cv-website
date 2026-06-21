// ---------------------------------------------------------------------------
// Space Parade Utils — Unit tests for pure functions
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  lerp,
  clamp,
  edgeFade,
  computeElementPosition,
  scaleConfigsToSpan,
  SPACE_PARADE_CONFIGS,
  easeInOutQuad,
  easeInOutSine,
  easeInExpo,
  easeOutExpo,
  easeOutCubic,
  linear,
} from './space-parade-utils';
import type { MotionConfig, ElementConfig } from './components/space-elements/types';

// ===========================================================================
// T004: lerp() and clamp()
// ===========================================================================

describe('lerp and clamp helpers (T004)', () => {
  describe('lerp', () => {
    it('returns a when t = 0', () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });

    it('returns b when t = 1', () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });

    it('returns midpoint when t = 0.5', () => {
      expect(lerp(10, 20, 0.5)).toBe(15);
    });

    it('handles negative t (extrapolation below)', () => {
      expect(lerp(10, 20, -0.5)).toBe(5);
    });

    it('handles t > 1 (extrapolation above)', () => {
      expect(lerp(10, 20, 1.5)).toBe(25);
    });

    it('handles same start and end', () => {
      expect(lerp(7, 7, 0.3)).toBe(7);
    });
  });

  describe('clamp', () => {
    it('returns min when value below range', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('returns max when value above range', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('returns value when in range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('returns min when value equals min', () => {
      expect(clamp(0, 0, 10)).toBe(0);
    });

    it('returns max when value equals max', () => {
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });
});

// ===========================================================================
// T005: edgeFade()
// ===========================================================================

describe('edgeFade 3-phase opacity (T005)', () => {
  it('returns 0 at t = 0 (start of entry phase)', () => {
    expect(edgeFade(0)).toBe(0);
  });

  it('returns 1 at t = 0.12 (end of entry ramp)', () => {
    expect(edgeFade(0.12)).toBeCloseTo(1, 5);
  });

  it('returns 1 at t = 0.5 (mid-display zone)', () => {
    expect(edgeFade(0.5)).toBe(1);
  });

  it('returns 1 at t = 0.88 (start of exit phase)', () => {
    expect(edgeFade(0.88)).toBeCloseTo(1, 5);
  });

  it('returns 0 at t = 1 (end of exit phase)', () => {
    expect(edgeFade(1)).toBe(0);
  });

  it('increases monotonically during entry phase', () => {
    const a = edgeFade(0.04);
    const b = edgeFade(0.08);
    expect(b).toBeGreaterThanOrEqual(a);
  });

  it('decreases monotonically during exit phase', () => {
    const a = edgeFade(0.92);
    const b = edgeFade(0.96);
    expect(b).toBeLessThanOrEqual(a);
  });

  it('clamps at or near 1 in display zone (0.12 to 0.88)', () => {
    expect(edgeFade(0.2)).toBeCloseTo(1, 4);
    expect(edgeFade(0.5)).toBeCloseTo(1, 4);
    expect(edgeFade(0.8)).toBeCloseTo(1, 4);
  });
});

// ===========================================================================
// T006: computeElementPosition() — determinism, boundary offsets, extreme values
// ===========================================================================

describe('computeElementPosition (T006)', () => {
  const baseConfig: MotionConfig = {
    entryOffset: 10,
    exitOffset: 20,
    startX: 0,
    endX: 100,
    baseY: 50,
    verticalWaves: 0,
    verticalAmplitude: 0,
    scaleProfile: () => 1,
    rotationStart: 0,
    rotationEnd: 360,
    easing: linear,
  };

  it('returns start position when scrollOffset equals entryOffset', () => {
    const result = computeElementPosition(baseConfig, 10);
    expect(result.x).toBeCloseTo(0, 1);
    expect(result.rotation).toBeCloseTo(0, 1);
  });

  it('returns end position when scrollOffset equals exitOffset', () => {
    const result = computeElementPosition(baseConfig, 20);
    expect(result.x).toBeCloseTo(100, 1);
    expect(result.rotation).toBeCloseTo(360, 1);
  });

  it('returns midpoint when scrollOffset is halfway', () => {
    const result = computeElementPosition(baseConfig, 15);
    expect(result.x).toBeCloseTo(50, 1);
    expect(result.rotation).toBeCloseTo(180, 1);
  });

  it('clamps to start when scrollOffset is before entryOffset', () => {
    const result = computeElementPosition(baseConfig, 5);
    expect(result.x).toBeCloseTo(0, 1);
    expect(result.opacity).toBe(0); // edgeFade at t=0 → 0
  });

  it('clamps to end when scrollOffset is after exitOffset', () => {
    const result = computeElementPosition(baseConfig, 25);
    expect(result.x).toBeCloseTo(100, 1);
    expect(result.opacity).toBe(0); // edgeFade at t=1 → 0
  });

  it('handles zero range (entryOffset === exitOffset)', () => {
    const zeroRangeConfig: MotionConfig = { ...baseConfig, entryOffset: 10, exitOffset: 10 };
    const result = computeElementPosition(zeroRangeConfig, 10);
    expect(result.x).toBe(0);
    expect(result.opacity).toBe(0);
  });

  it('handles negative range (entryOffset > exitOffset)', () => {
    const badConfig: MotionConfig = { ...baseConfig, entryOffset: 20, exitOffset: 10 };
    const result = computeElementPosition(badConfig, 15);
    expect(result.x).toBe(0);
    expect(result.opacity).toBe(0);
  });

  it('is deterministic — same input → same output', () => {
    const a = computeElementPosition(baseConfig, 14);
    const b = computeElementPosition(baseConfig, 14);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.scale).toBe(b.scale);
    expect(a.rotation).toBe(b.rotation);
    expect(a.opacity).toBe(b.opacity);
  });

  it('computes sine-wave y position with verticalWaves > 0', () => {
    const waveConfig: MotionConfig = {
      ...baseConfig,
      baseY: 50,
      verticalWaves: 2,
      verticalAmplitude: 10,
      easing: linear,
    };
    // At midpoint (t=0.5), sin(0.5 * PI * 2) = sin(PI) = 0
    const mid = computeElementPosition(waveConfig, 15);
    expect(mid.y).toBeCloseTo(50, 1);

    // At quarter (t=0.25), sin(0.25 * PI * 2) = sin(PI/2) = 1
    const quarter = computeElementPosition(waveConfig, 12.5);
    expect(quarter.y).toBeCloseTo(60, 1);
  });

  it('applies easing function correctly', () => {
    // easeInExpo starts very slow, so at small t, easedT ≈ 0
    const expoConfig: MotionConfig = { ...baseConfig, easing: easeInExpo };
    const early = computeElementPosition(expoConfig, 12); // t = 0.2
    // easedT ≈ 0, so x should be close to startX (0)
    expect(early.x).toBeLessThan(10);
  });

  it('returns values within reasonable bounds for extreme scrollOffsets', () => {
    // Very large positive scrollOffset
    const largeResult = computeElementPosition(baseConfig, 1_000_000);
    // Should clamp to end position
    expect(largeResult.x).toBeCloseTo(100, 1);
    expect(largeResult.opacity).toBe(0);

    // Very large negative scrollOffset
    const negResult = computeElementPosition(baseConfig, -1_000_000);
    expect(negResult.x).toBeCloseTo(0, 1);
    expect(negResult.opacity).toBe(0);
  });

  it('no NaN or Infinity in results', () => {
    const result = computeElementPosition(baseConfig, 15);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    expect(Number.isFinite(result.scale)).toBe(true);
    expect(Number.isFinite(result.rotation)).toBe(true);
    expect(Number.isFinite(result.opacity)).toBe(true);
  });
});

// ===========================================================================
// T007: scaleConfigsToSpan() — proportional scaling, min clamp
// ===========================================================================

describe('scaleConfigsToSpan (T007)', () => {
  const sampleConfigs: ElementConfig[] = [
    {
      id: 'test-1',
      type: 'planet',
      entryOffset: 0.1,
      exitOffset: 0.5,
      startX: 0,
      endX: 100,
      baseY: 50,
      verticalWaves: 1,
      verticalAmplitude: 5,
      scaleProfile: () => 1,
      rotationStart: 0,
      rotationEnd: 360,
      easing: linear,
    },
  ];

  it('scales entry/exit offsets proportionally to totalSpan', () => {
    const scaled = scaleConfigsToSpan(sampleConfigs, 20);
    expect(scaled[0].entryOffset).toBeCloseTo(2, 1); // 0.1 * 20
    expect(scaled[0].exitOffset).toBeCloseTo(10, 1); // 0.5 * 20
  });

  it('clamps minimum totalSpan to 5.0 vh', () => {
    const scaled = scaleConfigsToSpan(sampleConfigs, 2);
    expect(scaled[0].entryOffset).toBeCloseTo(0.5, 1); // 0.1 * 5.0
    expect(scaled[0].exitOffset).toBeCloseTo(2.5, 1); // 0.5 * 5.0
  });

  it('return same count of configs', () => {
    const scaled = scaleConfigsToSpan(sampleConfigs, 10);
    expect(scaled.length).toBe(sampleConfigs.length);
  });

  it('preserves non-offset fields unchanged', () => {
    const scaled = scaleConfigsToSpan(sampleConfigs, 10);
    expect(scaled[0].id).toBe('test-1');
    expect(scaled[0].type).toBe('planet');
    expect(scaled[0].startX).toBe(0);
    expect(scaled[0].endX).toBe(100);
    expect(scaled[0].easing).toBe(linear);
  });

  it('handles multiple configs', () => {
    const twoConfigs: ElementConfig[] = [
      { ...sampleConfigs[0], id: 'a', entryOffset: 0, exitOffset: 0.3 },
      { ...sampleConfigs[0], id: 'b', entryOffset: 0.7, exitOffset: 1 },
    ];
    const scaled = scaleConfigsToSpan(twoConfigs, 10);
    expect(scaled[0].entryOffset).toBe(0);
    expect(scaled[0].exitOffset).toBe(3);
    expect(scaled[1].entryOffset).toBe(7);
    expect(scaled[1].exitOffset).toBe(10);
  });
});

// ===========================================================================
// T012: SPACE_PARADE_CONFIGS — validation
// ===========================================================================

describe('SPACE_PARADE_CONFIGS validation (T012)', () => {
  it('all entryOffsets are in [0, 1] range', () => {
    for (const config of SPACE_PARADE_CONFIGS) {
      expect(config.entryOffset).toBeGreaterThanOrEqual(0);
      expect(config.entryOffset).toBeLessThanOrEqual(1);
    }
  });

  it('all exitOffsets are in [0, 1] range', () => {
    for (const config of SPACE_PARADE_CONFIGS) {
      expect(config.exitOffset).toBeGreaterThanOrEqual(0);
      expect(config.exitOffset).toBeLessThanOrEqual(1);
    }
  });

  it('entryOffset < exitOffset for all configs', () => {
    for (const config of SPACE_PARADE_CONFIGS) {
      expect(config.entryOffset).toBeLessThan(config.exitOffset);
    }
  });

  it('has expected element types to satisfy SC-001', () => {
    const types = new Set(SPACE_PARADE_CONFIGS.map((c) => c.type));
    expect(types.has('planet')).toBe(true);
    expect(types.has('rocket')).toBe(true);
    expect(types.has('ufo')).toBe(true);
    expect(types.has('satellite')).toBe(true);
    expect(types.has('shooting-star')).toBe(true);
    expect(types.has('asteroid')).toBe(true);
  });

  it('has at least 5 shooting stars (US5)', () => {
    const ssCount = SPACE_PARADE_CONFIGS.filter((c) => c.type === 'shooting-star').length;
    expect(ssCount).toBeGreaterThanOrEqual(5);
  });

  it('has at least 3 asteroids (US5)', () => {
    const asteroidCount = SPACE_PARADE_CONFIGS.filter((c) => c.type === 'asteroid').length;
    expect(asteroidCount).toBeGreaterThanOrEqual(3);
  });
});

// ===========================================================================
// Easing function contract
// ===========================================================================

describe('Easing functions', () => {
  const easings = [
    { name: 'easeInOutQuad', fn: easeInOutQuad },
    { name: 'easeInOutSine', fn: easeInOutSine },
    { name: 'easeInExpo', fn: easeInExpo },
    { name: 'easeOutExpo', fn: easeOutExpo },
    { name: 'easeOutCubic', fn: easeOutCubic },
    { name: 'linear', fn: linear },
  ];

  for (const { name, fn } of easings) {
    describe(name, () => {
      it('returns 0 at t = 0', () => {
        expect(fn(0)).toBe(0);
      });

      it('returns 1 at t = 1', () => {
        expect(fn(1)).toBe(1);
      });

      it('returns values in [0, 1] for t ∈ [0, 1]', () => {
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const val = fn(t);
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
        }
      });

      it('returns finite values for t in [0, 1]', () => {
        for (let i = 0; i <= 10; i++) {
          expect(Number.isFinite(fn(i / 10))).toBe(true);
        }
      });
    });
  }
});
