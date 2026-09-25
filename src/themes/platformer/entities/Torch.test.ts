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
  DEFAULT_TORCH_STRENGTH,
  TORCH_STRENGTHS,
  torchStrengthCode,
  nextTorchStrength,
  isTorchStrength,
  torchLightScale,
  TORCH_LIGHT_RADIUS_PX,
  TORCH_PULSE_AMPLITUDE,
  TORCH_GLOW_COLOR,
  torchPulseScale,
  torchLightRadius,
  torchGlowStrengthAt,
  torchLightSource,
} from './Torch';
import type { TorchLight } from './Torch';

function makeTorch(overrides: Partial<TorchLight> = {}): TorchLight {
  return { col: 3, row: 4, x: 100, y: 100, strength: 5, ...overrides };
}

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

  it('lightRadiusPx-isAPositiveRadius', () => {
    expect(TORCH_LIGHT_RADIUS_PX).toBeGreaterThan(0);
  });

  it('pulseAmplitude-isSmallButNonZero', () => {
    expect(TORCH_PULSE_AMPLITUDE).toBeGreaterThan(0);
    expect(TORCH_PULSE_AMPLITUDE).toBeLessThan(0.25);
  });

  it('glowColor-isANonEmptyString', () => {
    expect(TORCH_GLOW_COLOR.length).toBeGreaterThan(0);
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

describe('torch strength catalog', () => {
  it('defaultStrength-isFive', () => {
    expect(DEFAULT_TORCH_STRENGTH).toBe(5);
  });

  it('strengths-coverZeroThroughNineInOrder', () => {
    expect(TORCH_STRENGTHS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('code-isTheStrengthDigit', () => {
    expect(torchStrengthCode(0)).toBe('0');
    expect(torchStrengthCode(7)).toBe('7');
  });

  it('nextStrength-incrementsAndWrapsFromNineToZero', () => {
    expect(nextTorchStrength(5)).toBe(6);
    expect(nextTorchStrength(9)).toBe(0);
  });

  it('isTorchStrength-acceptsZeroThroughNineAndRejectsEverythingElse', () => {
    for (const value of TORCH_STRENGTHS) expect(isTorchStrength(value)).toBe(true);
    expect(isTorchStrength(-1)).toBe(false);
    expect(isTorchStrength(10)).toBe(false);
    expect(isTorchStrength(1.5)).toBe(false);
    expect(isTorchStrength('5')).toBe(false);
    expect(isTorchStrength(undefined)).toBe(false);
  });

  it('lightScale-isOneAtTheDefaultAndScalesLinearly', () => {
    expect(torchLightScale(5)).toBe(1);
    expect(torchLightScale(0)).toBe(0);
    expect(torchLightScale(9)).toBeCloseTo(1.8);
  });
});

describe('torchPulseScale', () => {
  it('anyWorldElapsed-staysWithinThePulseAmplitudeBounds', () => {
    const torch = makeTorch();
    for (let elapsed = 0; elapsed <= 5; elapsed += 0.013) {
      const scale = torchPulseScale(torch, elapsed);
      expect(scale).toBeGreaterThanOrEqual(1 - TORCH_PULSE_AMPLITUDE);
      expect(scale).toBeLessThanOrEqual(1 + TORCH_PULSE_AMPLITUDE);
    }
  });

  it('sameInputs-areDeterministic', () => {
    const torch = makeTorch();
    expect(torchPulseScale(torch, 1.234)).toBe(torchPulseScale(torch, 1.234));
  });

  it('differentTorches-differInPhaseAtTheSameInstant', () => {
    expect(torchPulseScale(makeTorch({ col: 0, row: 0 }), 0)).not.toBe(
      torchPulseScale(makeTorch({ col: 1, row: 0 }), 0),
    );
  });
});

describe('torchLightRadius', () => {
  it('defaultStrength-atRest-isTheBaseRadiusTimesThePulse', () => {
    const torch = makeTorch();
    expect(torchLightRadius(torch, 0)).toBe(TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, 0));
  });

  it('strengthZero-isDark', () => {
    expect(torchLightRadius(makeTorch({ strength: 0 }), 0)).toBe(0);
  });
});

describe('torchGlowStrengthAt', () => {
  it('torchCentre-isFullStrength', () => {
    const torch = makeTorch();
    expect(torchGlowStrengthAt(torch, torch.x, torch.y, 0)).toBe(1);
  });

  it('atOrBeyondThePulsedRadius-isZero', () => {
    const torch = makeTorch();
    const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, 0);
    // The exact boundary is subject to float rounding (x + radius - x), so it
    // only needs to be effectively zero there; strictly beyond is exact zero.
    expect(torchGlowStrengthAt(torch, torch.x + radius, torch.y, 0)).toBeCloseTo(0, 12);
    expect(torchGlowStrengthAt(torch, torch.x + radius * 1.000001, torch.y, 0)).toBe(0);
    expect(torchGlowStrengthAt(torch, torch.x + radius * 2, torch.y, 0)).toBe(0);
  });

  it('falloff-isSmoothAndMonotonicFromCentreToEdge', () => {
    const torch = makeTorch();
    const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, 0);
    const centre = torchGlowStrengthAt(torch, torch.x, torch.y, 0);
    const near = torchGlowStrengthAt(torch, torch.x + radius * 0.25, torch.y, 0);
    const middle = torchGlowStrengthAt(torch, torch.x + radius * 0.5, torch.y, 0);
    const far = torchGlowStrengthAt(torch, torch.x + radius * 0.9, torch.y, 0);

    expect(centre).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
});

describe('torchLightSource', () => {
  it('radius-isByteEqualToTorchLightRadius', () => {
    const torch = makeTorch();
    expect(torchLightSource(torch, 1.7).radius).toBe(torchLightRadius(torch, 1.7));
  });

  it('colourMidStopIntensityAndPunch-matchTheTorchGlow', () => {
    const light = torchLightSource(makeTorch(), 0);

    expect(light.color).toBe(TORCH_GLOW_COLOR);
    expect(light.glowMidAlpha).toBe(0.35);
    expect(light.intensity).toBe(1);
    expect(light.punchHole).toBe(true);
  });

  it('centre-isTheTorchCentre', () => {
    const torch = makeTorch({ x: 123, y: 456 });
    const light = torchLightSource(torch, 0);

    expect(light.x).toBe(123);
    expect(light.y).toBe(456);
  });
});
