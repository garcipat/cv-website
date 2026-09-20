import { describe, it, expect } from 'vitest';
import {
  MAX_DARKNESS,
  DARKNESS_FADE_SECONDS,
  TORCH_LIGHT_RADIUS_PX,
  TORCH_PULSE_AMPLITUDE,
  TORCH_GLOW_COLOR,
  PLAYER_LIGHT_RADIUS_PX,
  ENEMY_EYE_DARKNESS_THRESHOLD,
  ENEMY_EYE_FADE_RANGE,
  ENEMY_EYE_COLOR,
  ENEMY_EYE_SIZE_PX,
  ENEMY_EYE_GAP_PX,
  ENEMY_EYE_BOB_PERIOD_SECONDS,
  ENEMY_EYE_BOB_AMPLITUDE_PX,
  nextDarknessLevel,
  isCellDarkening,
  playerOccupiedCell,
  torchPulseScale,
  torchGlowStrengthAt,
  localDarknessAt,
  enemyEyeOpacity,
  enemyEyeBobOffset,
  playerGlowStrengthAt,
} from './Lighting';
import type { TorchLight } from './Lighting';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import type { PlayerState } from '../entities/Player';

/** The lighting helpers only ever read `x`/`y` from a player, so a minimal
 *  cast keeps this pure module's tests free of the whole player factory. */
function makePlayer(x: number, y: number): PlayerState {
  return { x, y } as unknown as PlayerState;
}

function makeTorch(overrides: Partial<TorchLight> = {}): TorchLight {
  return { col: 3, row: 4, x: 100, y: 100, ...overrides };
}

describe('Lighting constants', () => {
  it('maxDarkness-isACapBelowFullOpacity', () => {
    expect(MAX_DARKNESS).toBeGreaterThan(0);
    expect(MAX_DARKNESS).toBeLessThan(1);
  });

  it('darknessFadeSeconds-isAPositiveFadeDuration', () => {
    expect(DARKNESS_FADE_SECONDS).toBeGreaterThan(0);
  });

  it('torchLightRadiusPx-isAPositiveRadius', () => {
    expect(TORCH_LIGHT_RADIUS_PX).toBeGreaterThan(0);
  });

  it('torchPulseAmplitude-isSmallButNonZero', () => {
    expect(TORCH_PULSE_AMPLITUDE).toBeGreaterThan(0);
    expect(TORCH_PULSE_AMPLITUDE).toBeLessThan(0.25);
  });

  it('torchGlowColor-and-enemyEyeColor-areNonEmptyStrings', () => {
    expect(TORCH_GLOW_COLOR.length).toBeGreaterThan(0);
    expect(ENEMY_EYE_COLOR.length).toBeGreaterThan(0);
  });

  it('enemyEyeSizePx-and-enemyEyeGapPx-arePositiveIntegers', () => {
    expect(Number.isInteger(ENEMY_EYE_SIZE_PX)).toBe(true);
    expect(ENEMY_EYE_SIZE_PX).toBeGreaterThan(0);
    expect(Number.isInteger(ENEMY_EYE_GAP_PX)).toBe(true);
    expect(ENEMY_EYE_GAP_PX).toBeGreaterThan(0);
  });
});

describe('nextDarknessLevel', () => {
  it('fullBrightnessTarget-easesNowhere', () => {
    expect(nextDarknessLevel(0, 0, 0.1)).toBe(0);
  });

  it('risingTarget-movesHalfwayOverHalfTheFade', () => {
    expect(nextDarknessLevel(0, MAX_DARKNESS, DARKNESS_FADE_SECONDS / 2)).toBeCloseTo(MAX_DARKNESS / 2);
  });

  it('fallingTarget-movesHalfwayOverHalfTheFade', () => {
    expect(nextDarknessLevel(MAX_DARKNESS, 0, DARKNESS_FADE_SECONDS / 2)).toBeCloseTo(MAX_DARKNESS / 2);
  });

  it('largeDt-neverOvershootsTheTarget', () => {
    expect(nextDarknessLevel(MAX_DARKNESS - 0.01, MAX_DARKNESS, 5)).toBe(MAX_DARKNESS);
    expect(nextDarknessLevel(0.01, 0, 5)).toBe(0);
  });

  it('nonPositiveDt-returnsCurrentUnchanged', () => {
    expect(nextDarknessLevel(0.3, MAX_DARKNESS, 0)).toBe(0.3);
    expect(nextDarknessLevel(0.3, MAX_DARKNESS, -1)).toBe(0.3);
  });

  it('nonPositiveFadeSeconds-snapsStraightToTheTarget', () => {
    expect(nextDarknessLevel(0.3, MAX_DARKNESS, 0.1, 0)).toBe(MAX_DARKNESS);
    expect(nextDarknessLevel(0.3, 0, 0.1, 0)).toBe(0);
  });

  it('outOfRangeInputs-areClampedToTheValidRange', () => {
    expect(nextDarknessLevel(2, MAX_DARKNESS, 0.1)).toBe(MAX_DARKNESS);
    expect(nextDarknessLevel(-1, 0, 0.1)).toBe(0);
  });
});

describe('isCellDarkening', () => {
  const caveLevel: LevelDef = {
    terrain: [],
    width: 3,
    height: 3,
    background: [
      [null, null, null],
      [null, 'charcoal', null],
      [null, null, null],
    ],
  };

  it('cellWithACaveFamilyMaterial-isDarkening', () => {
    expect(isCellDarkening(caveLevel, 1, 1)).toBe(true);
  });

  it('cellOutsideTheCaveCell-isNotDarkening', () => {
    expect(isCellDarkening(caveLevel, 0, 1)).toBe(false);
    expect(isCellDarkening(caveLevel, 2, 0)).toBe(false);
  });

  it('surfaceOnlyBackground-isNeverDarkening', () => {
    const surfaceLevel: LevelDef = {
      terrain: [],
      width: 1,
      height: 1,
      background: [['dirt']],
    };
    expect(isCellDarkening(surfaceLevel, 0, 0)).toBe(false);
  });

  it('emptyCell-isNotDarkening', () => {
    const level: LevelDef = { terrain: [], width: 1, height: 1, background: [[null]] };
    expect(isCellDarkening(level, 0, 0)).toBe(false);
  });

  it('levelWithNoBackgroundField-isNeverDarkening', () => {
    const level: LevelDef = { terrain: [], width: 1, height: 1 };
    expect(isCellDarkening(level, 0, 0)).toBe(false);
  });

  it('outOfRangeIntegerCells-returnFalseInsteadOfThrowing', () => {
    expect(isCellDarkening(caveLevel, -5, -5)).toBe(false);
    expect(isCellDarkening(caveLevel, 999, 999)).toBe(false);
  });

  it('everyCaveMaterial-isDarkening', () => {
    for (const material of ['charcoal', 'maroon', 'caveStone'] as const) {
      const level: LevelDef = { terrain: [], width: 1, height: 1, background: [[material]] };
      expect(isCellDarkening(level, 0, 0)).toBe(true);
    }
  });

  it('everySurfaceMaterial-isNeverDarkening', () => {
    for (const material of ['dirt', 'rust', 'surfaceStone'] as const) {
      const level: LevelDef = { terrain: [], width: 1, height: 1, background: [[material]] };
      expect(isCellDarkening(level, 0, 0)).toBe(false);
    }
  });
});

describe('playerOccupiedCell', () => {
  it('bottomCentrePoint-mapsToItsGridCell', () => {
    // RENDERED_TILE_SIZE = 32, PLAYER_RENDERED_SIZE = 64, PLAYER_FOOT_PADDING = 8.
    // col = floor((100 + 32) / 32) = 4; row = floor((100 + 64 - 8) / 32) = 4.
    expect(playerOccupiedCell(makePlayer(100, 100))).toEqual({ col: 4, row: 4 });
  });

  it('bottomCentrePoint-usesTheFeetNotTheRenderSlotTop', () => {
    const player = makePlayer(37, 51);
    expect(playerOccupiedCell(player)).toEqual({
      col: Math.floor((37 + PLAYER_RENDERED_SIZE / 2) / RENDERED_TILE_SIZE),
      row: Math.floor((51 + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - 1) / RENDERED_TILE_SIZE),
    });
  });

  it('feetRestingOnATileBoundary-mapToTheCellAboveTheFloor', () => {
    // A player standing on floor tile 4 has their feet exactly on its top
    // edge (world y = 4 * tile); the occupied cell must be the air cell they
    // are standing in (row 3), not the floor tile itself (row 4) — otherwise
    // a cave backdrop behind the air would never trigger.
    const player = makePlayer(0, 4 * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING);
    expect(playerOccupiedCell(player).row).toBe(3);
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

describe('torchGlowStrengthAt', () => {
  it('torchCentre-isFullStrength', () => {
    const torch = makeTorch();
    expect(torchGlowStrengthAt(torch, torch.x, torch.y, 0)).toBe(1);
  });

  it('atOrBeyondThePulsedRadius-isZero', () => {
    const torch = makeTorch();
    const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, 0);
    expect(torchGlowStrengthAt(torch, torch.x + radius, torch.y, 0)).toBe(0);
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

describe('localDarknessAt', () => {
  it('noTorches-returnsTheBaseDarkness', () => {
    expect(localDarknessAt(0, 0, MAX_DARKNESS, [], 0)).toBe(MAX_DARKNESS);
  });

  it('torchAtThePoint-erasesAllDarkness', () => {
    const torch = makeTorch();
    expect(localDarknessAt(torch.x, torch.y, MAX_DARKNESS, [torch], 0)).toBe(0);
  });

  it('overlappingTorches-useTheMaximumNotTheSum', () => {
    const torch = makeTorch();
    const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, 0);
    // Half a radius out, the smooth falloff is exactly 0.5 — so one torch
    // leaves darkness - 0.5, and a summed pair would clamp to 0 instead.
    const x = torch.x + radius * 0.5;
    const one = localDarknessAt(x, torch.y, MAX_DARKNESS, [torch], 0);
    const two = localDarknessAt(x, torch.y, MAX_DARKNESS, [torch, { ...torch }], 0);

    expect(one).toBeCloseTo(MAX_DARKNESS - 0.5);
    expect(two).toBe(one);
  });

  it('isMonotonicInTheBaseDarkness', () => {
    const torch = makeTorch();
    const x = torch.x + TORCH_LIGHT_RADIUS_PX * 0.5;
    expect(localDarknessAt(x, torch.y, MAX_DARKNESS, [torch], 0)).toBeGreaterThanOrEqual(
      localDarknessAt(x, torch.y, MAX_DARKNESS / 2, [torch], 0),
    );
  });

  it('result-isClampedToTheValidRange', () => {
    const torch = makeTorch();
    const lit = localDarknessAt(torch.x, torch.y, MAX_DARKNESS, [torch], 0);
    expect(lit).toBeGreaterThanOrEqual(0);
    expect(lit).toBeLessThanOrEqual(MAX_DARKNESS);
  });
});

describe('enemyEyeOpacity', () => {
  it('atOrBelowTheThreshold-isZero', () => {
    expect(enemyEyeOpacity(0)).toBe(0);
    expect(enemyEyeOpacity(ENEMY_EYE_DARKNESS_THRESHOLD - 0.05)).toBe(0);
    expect(enemyEyeOpacity(ENEMY_EYE_DARKNESS_THRESHOLD)).toBe(0);
  });

  it('atTheEndOfTheFadeBand-isFullyOpaque', () => {
    expect(enemyEyeOpacity(ENEMY_EYE_DARKNESS_THRESHOLD + ENEMY_EYE_FADE_RANGE)).toBe(1);
  });

  it('beyondTheFadeBand-staysClampedAtOne', () => {
    expect(enemyEyeOpacity(MAX_DARKNESS)).toBe(1);
    expect(enemyEyeOpacity(5)).toBe(1);
  });

  it('insideTheFadeBand-risesSmoothlyBetweenZeroAndOne', () => {
    const mid = enemyEyeOpacity(ENEMY_EYE_DARKNESS_THRESHOLD + ENEMY_EYE_FADE_RANGE / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('neverReturnsANegativeValue', () => {
    expect(enemyEyeOpacity(-10)).toBe(0);
  });
});

describe('enemyEyeBobOffset', () => {
  it('anyWorldElapsed-staysWithinTheBobAmplitudeBounds', () => {
    for (let elapsed = 0; elapsed <= 5; elapsed += 0.017) {
      const offset = enemyEyeBobOffset(elapsed);
      expect(offset).toBeGreaterThanOrEqual(-ENEMY_EYE_BOB_AMPLITUDE_PX);
      expect(offset).toBeLessThanOrEqual(ENEMY_EYE_BOB_AMPLITUDE_PX);
    }
  });

  it('atRest-and-everyFullPeriod-isCentred', () => {
    expect(enemyEyeBobOffset(0)).toBeCloseTo(0);
    expect(enemyEyeBobOffset(ENEMY_EYE_BOB_PERIOD_SECONDS)).toBeCloseTo(0);
  });

  it('quarterPeriod-reachesThePeakOffset', () => {
    expect(enemyEyeBobOffset(ENEMY_EYE_BOB_PERIOD_SECONDS / 4)).toBeCloseTo(
      ENEMY_EYE_BOB_AMPLITUDE_PX,
    );
  });

  it('sameInputs-areDeterministic', () => {
    expect(enemyEyeBobOffset(1.234)).toBe(enemyEyeBobOffset(1.234));
  });
});

describe('playerGlowStrengthAt', () => {
  const light = { x: 50, y: 60 };

  it('playerLightRadius-isPositiveAndSmallerThanATorch', () => {
    expect(PLAYER_LIGHT_RADIUS_PX).toBeGreaterThan(0);
    expect(PLAYER_LIGHT_RADIUS_PX).toBeLessThan(TORCH_LIGHT_RADIUS_PX);
  });

  it('atThePlayerCentre-isFullStrength', () => {
    expect(playerGlowStrengthAt(light.x, light.y, light)).toBe(1);
  });

  it('atOrBeyondTheRadius-isZero', () => {
    expect(playerGlowStrengthAt(light.x + PLAYER_LIGHT_RADIUS_PX, light.y, light)).toBe(0);
    expect(playerGlowStrengthAt(light.x + PLAYER_LIGHT_RADIUS_PX * 2, light.y, light)).toBe(0);
  });

  it('falloff-isSmoothAndMonotonicFromCentreToEdge', () => {
    const near = playerGlowStrengthAt(light.x + PLAYER_LIGHT_RADIUS_PX * 0.25, light.y, light);
    const mid = playerGlowStrengthAt(light.x + PLAYER_LIGHT_RADIUS_PX * 0.5, light.y, light);
    const far = playerGlowStrengthAt(light.x + PLAYER_LIGHT_RADIUS_PX * 0.9, light.y, light);

    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });
});

describe('localDarknessAt with the player light', () => {
  const light = { x: 50, y: 60 };

  it('atThePlayerCentre-erasesAllDarkness', () => {
    expect(localDarknessAt(light.x, light.y, MAX_DARKNESS, [], 0, light)).toBe(0);
  });

  it('farFromThePlayer-keepsTheBaseDarkness', () => {
    expect(localDarknessAt(light.x + 10000, light.y, MAX_DARKNESS, [], 0, light)).toBe(MAX_DARKNESS);
  });

  it('playerLightAndTorch-useTheMaximumNotTheSum', () => {
    const torch = makeTorch({ x: light.x, y: light.y });
    const lit = localDarknessAt(light.x, light.y, MAX_DARKNESS, [torch], 0, light);

    expect(lit).toBe(0);
  });
});
