import { describe, it, expect } from 'vitest';
import {
  MAX_DARKNESS,
  DARKNESS_FADE_SECONDS,
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
  localDarknessAt,
  enemyEyeOpacity,
  enemyEyeBobOffset,
} from './Lighting';
import type { LightSource } from '../contracts/lighting';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import type { PlayerState } from '../entities/Player';

/** The lighting helpers only ever read `x`/`y` from a player, so a minimal
 *  cast keeps this pure module's tests free of the whole player factory. */
function makePlayer(x: number, y: number): PlayerState {
  return { x, y } as unknown as PlayerState;
}

/** A hand-built light — deliberately neither a torch nor the player, to prove
 *  the probe reads the shared list generically. */
function makeLight(overrides: Partial<LightSource> = {}): LightSource {
  return {
    x: 100,
    y: 100,
    radius: 112,
    color: 'rgb(255, 176, 74)',
    intensity: 1,
    glowMidAlpha: 0.35,
    punchHole: true,
    ...overrides,
  };
}

describe('Lighting constants', () => {
  it('maxDarkness-isACapBelowFullOpacity', () => {
    expect(MAX_DARKNESS).toBeGreaterThan(0);
    expect(MAX_DARKNESS).toBeLessThan(1);
  });

  it('darknessFadeSeconds-isAPositiveFadeDuration', () => {
    expect(DARKNESS_FADE_SECONDS).toBeGreaterThan(0);
  });

  it('enemyEyeColor-isANonEmptyString', () => {
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

describe('localDarknessAt', () => {
  it('noLights-returnsTheBaseDarkness', () => {
    expect(localDarknessAt(0, 0, MAX_DARKNESS, [])).toBe(MAX_DARKNESS);
  });

  it('lightAtThePoint-erasesAllDarkness', () => {
    const light = makeLight();
    expect(localDarknessAt(light.x, light.y, MAX_DARKNESS, [light])).toBe(0);
  });

  it('overlappingLights-useTheMaximumNotTheSum', () => {
    const light = makeLight();
    // Half a radius out, the smooth falloff is exactly 0.5 — so one light
    // leaves darkness - 0.5, and a summed pair would clamp to 0 instead.
    const x = light.x + light.radius * 0.5;
    const one = localDarknessAt(x, light.y, MAX_DARKNESS, [light]);
    const two = localDarknessAt(x, light.y, MAX_DARKNESS, [light, { ...light }]);

    expect(one).toBeCloseTo(MAX_DARKNESS - 0.5);
    expect(two).toBe(one);
  });

  it('isMonotonicInTheBaseDarkness', () => {
    const light = makeLight();
    const x = light.x + light.radius * 0.5;
    expect(localDarknessAt(x, light.y, MAX_DARKNESS, [light])).toBeGreaterThanOrEqual(
      localDarknessAt(x, light.y, MAX_DARKNESS / 2, [light]),
    );
  });

  it('result-isClampedToTheValidRange', () => {
    const light = makeLight();
    const lit = localDarknessAt(light.x, light.y, MAX_DARKNESS, [light]);
    expect(lit).toBeGreaterThanOrEqual(0);
    expect(lit).toBeLessThanOrEqual(MAX_DARKNESS);
  });

  it('glowOnlyLight-punchHoleFalse-stillIlluminates', () => {
    // `punchHole` is a draw-pass concern only: a glow-only light still counts
    // as local light (FR-007; Story 1 scenario 5).
    const light = makeLight({ punchHole: false });
    const x = light.x + light.radius * 0.5;

    expect(localDarknessAt(light.x, light.y, MAX_DARKNESS, [light])).toBe(0);
    expect(localDarknessAt(x, light.y, MAX_DARKNESS, [light])).toBeCloseTo(MAX_DARKNESS - 0.5);
  });

  it('aThirdArbitraryLight-isCountedWithNoSpecialBranch', () => {
    // Not a torch, not the player — just data in the list (SC-003).
    const third = makeLight({
      x: 400,
      y: 400,
      radius: 50,
      color: 'rgb(10, 20, 30)',
      intensity: 0.5,
      glowMidAlpha: 0.2,
      punchHole: false,
    });

    expect(localDarknessAt(third.x, third.y, MAX_DARKNESS, [third])).toBe(0);
    expect(localDarknessAt(third.x + third.radius, third.y, MAX_DARKNESS, [third])).toBe(
      MAX_DARKNESS,
    );
  });

  it('emptyRadiusLight-illuminatesNothing', () => {
    const light = makeLight({ radius: 0 });
    expect(localDarknessAt(light.x, light.y, MAX_DARKNESS, [light])).toBe(MAX_DARKNESS);
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
