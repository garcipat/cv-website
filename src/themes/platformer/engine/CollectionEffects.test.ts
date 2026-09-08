import {
  RISE_DURATION_SECONDS,
  HOLD_DURATION_SECONDS,
  FLIGHT_DURATION_SECONDS,
  SPARKLE_DURATION_SECONDS,
  COUNTER_POPUP_HOLD_SECONDS,
  COUNTER_POPUP_DURATION_SECONDS,
  startFlightEffect,
  tickFlightEffect,
  flightEffectPosition,
  sparkleParticles,
  startCounterPopup,
  tickCounterPopup,
  counterPopupOpacity,
  startPuffEffect,
  tickPuffEffect,
  createSlotAllocator,
  COLLECTION_TEXT_SLOT_COUNT,
  COLLECTION_TEXT_STACK_ROW_HEIGHT,
  HEAL_AURA_DURATION_SECONDS,
  startHealAuraEffect,
  tickHealAuraEffect,
  healAuraOpacity,
  healAuraRays,
  healAuraSparkles,
  startPlayerHitSplatter,
  startEnemyHitSplatter,
  tickHitSplatterEffect,
  hitSplatterDroplets,
  HIT_SPLATTER_DURATION_SECONDS,
} from './CollectionEffects';
import type { PuffEffect, HealAuraEffect, HitSplatterEffect } from './CollectionEffects';

describe('startFlightEffect', () => {
  it('called-returns-risingPhaseAtZeroElapsed', () => {
    const effect = startFlightEffect('a', 'German', 10, 20, 400, 300, 900, 600);
    expect(effect).toEqual({
      id: 'a',
      text: 'German',
      startX: 10,
      startY: 20,
      midX: 400,
      midY: 300,
      targetX: 900,
      targetY: 600,
      elapsed: 0,
      phase: 'rising',
    });
  });

  it('calledWithIcon-includesIconOnTheEffect', () => {
    const effect = startFlightEffect('a', 'German', 10, 20, 400, 300, 900, 600, '🇩🇪');
    expect(effect.icon).toBe('🇩🇪');
  });

  it('calledWithoutIcon-iconIsUndefined', () => {
    const effect = startFlightEffect('a', 'German', 10, 20, 400, 300, 900, 600);
    expect(effect.icon).toBeUndefined();
  });
});

describe('tickFlightEffect', () => {
  it('withinRiseDuration-staysRisingPhase', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 0, 0, 0, 0, 0, 0),
      RISE_DURATION_SECONDS / 2,
    );
    expect(effect.phase).toBe('rising');
  });

  it('pastRiseDuration-transitionsToHoldingPhase', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 0, 0, 0, 0, 0, 0),
      RISE_DURATION_SECONDS + 0.01,
    );
    expect(effect.phase).toBe('holding');
  });

  it('pastRisePlusHoldDuration-transitionsToFlyingPhase', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 0, 0, 0, 0, 0, 0),
      RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS + 0.01,
    );
    expect(effect.phase).toBe('flying');
  });

  it('pastRisePlusHoldPlusFlightDuration-transitionsToDonePhase', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 0, 0, 0, 0, 0, 0),
      RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS + FLIGHT_DURATION_SECONDS + 0.01,
    );
    expect(effect.phase).toBe('done');
  });

  it('donePhase-tickedAgain-returnsSameReference', () => {
    const done = tickFlightEffect(
      startFlightEffect('a', 't', 0, 0, 0, 0, 0, 0),
      RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS + FLIGHT_DURATION_SECONDS + 0.01,
    );
    expect(tickFlightEffect(done, 1)).toBe(done);
  });
});

describe('flightEffectPosition', () => {
  it('risingPhaseStart-positionedAtStart', () => {
    const effect = startFlightEffect('a', 't', 100, 100, 400, 300, 900, 600);
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(100);
    expect(pos.opacity).toBe(1);
  });

  it('risingPhaseEnd-positionedAtMidWithFullOpacity', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 100, 100, 400, 300, 900, 600),
      RISE_DURATION_SECONDS,
    );
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(400);
    expect(pos.y).toBeCloseTo(300);
    expect(pos.opacity).toBe(1);
  });

  it('holdingPhase-staysFixedAtMidWithFullOpacity', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 100, 100, 400, 300, 900, 600),
      RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS / 2,
    );
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(400);
    expect(pos.y).toBeCloseTo(300);
    expect(pos.opacity).toBe(1);
  });

  it('flightStart-positionedAtMid', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 100, 100, 400, 300, 900, 600),
      RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS,
    );
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(400);
    expect(pos.y).toBeCloseTo(300);
  });

  it('flightEnd-positionedAtTargetWithZeroOpacity', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 100, 100, 400, 300, 900, 600),
      RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS + FLIGHT_DURATION_SECONDS,
    );
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(900);
    expect(pos.y).toBeCloseTo(600);
    expect(pos.opacity).toBeCloseTo(0, 1);
  });

  it('donePhase-returnsZeroOpacity', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 0, 0, 0, 0, 0, 0), 100);
    expect(flightEffectPosition(effect).opacity).toBe(0);
  });
});

describe('sparkleParticles', () => {
  it('elapsedZero-returnsSixParticlesAtFullOpacity', () => {
    const particles = sparkleParticles(0);
    expect(particles).toHaveLength(6);
    expect(particles.every((p) => p.opacity === 1)).toBe(true);
    expect(particles.every((p) => p.dx === 0 && p.dy === 0)).toBe(true);
  });

  it('midway-particlesHaveMovedAndFadedPartially', () => {
    const particles = sparkleParticles(SPARKLE_DURATION_SECONDS / 2);
    expect(particles.some((p) => p.dx !== 0 || p.dy !== 0)).toBe(true);
    expect(particles[0].opacity).toBeCloseTo(0.5);
  });

  it('pastDuration-returnsEmptyArray', () => {
    expect(sparkleParticles(SPARKLE_DURATION_SECONDS + 0.01)).toEqual([]);
  });
});

describe('sparkleParticles scale', () => {
  it('scaleOf2-doublesEveryParticlesOffsetFromDefault', () => {
    const base = sparkleParticles(SPARKLE_DURATION_SECONDS / 2);
    const scaled = sparkleParticles(SPARKLE_DURATION_SECONDS / 2, 2);
    expect(scaled).toHaveLength(base.length);
    scaled.forEach((particle, i) => {
      expect(particle.dx).toBeCloseTo(base[i].dx * 2);
      expect(particle.dy).toBeCloseTo(base[i].dy * 2);
    });
  });

  it('noScaleArgument-behavesExactlyLikeScaleOf1', () => {
    const withDefault = sparkleParticles(SPARKLE_DURATION_SECONDS / 2);
    const explicit = sparkleParticles(SPARKLE_DURATION_SECONDS / 2, 1);
    expect(withDefault).toEqual(explicit);
  });
});

describe('startPuffEffect / tickPuffEffect', () => {
  it('startPuffEffect-noScaleArgument-defaultsScaleTo1', () => {
    const effect = startPuffEffect('rock-1', 100, 200);
    expect(effect).toEqual<PuffEffect>({ id: 'rock-1', x: 100, y: 200, scale: 1, elapsed: 0 });
  });

  it('startPuffEffect-withScale-storesIt', () => {
    const effect = startPuffEffect('slime-1', 50, 60, 1.5);
    expect(effect.scale).toBe(1.5);
  });

  it('tickPuffEffect-advancesElapsedByDt-preservesEverythingElse', () => {
    const effect = startPuffEffect('rock-1', 100, 200, 1.5);
    const ticked = tickPuffEffect(effect, 0.1);
    expect(ticked).toEqual<PuffEffect>({ id: 'rock-1', x: 100, y: 200, scale: 1.5, elapsed: 0.1 });
  });
});

describe('startHealAuraEffect / tickHealAuraEffect', () => {
  it('startHealAuraEffect-startsAtZeroElapsed', () => {
    const effect = startHealAuraEffect('heart-1');
    expect(effect).toEqual<HealAuraEffect>({ id: 'heart-1', elapsed: 0 });
  });

  it('tickHealAuraEffect-advancesElapsedByDt-preservesId', () => {
    const effect = startHealAuraEffect('heart-1');
    const ticked = tickHealAuraEffect(effect, 0.1);
    expect(ticked).toEqual<HealAuraEffect>({ id: 'heart-1', elapsed: 0.1 });
  });
});

describe('healAuraOpacity', () => {
  it('atStart-isFullyOpaque', () => {
    expect(healAuraOpacity(0)).toBe(1);
  });

  it('atHalfway-isHalfFaded', () => {
    expect(healAuraOpacity(HEAL_AURA_DURATION_SECONDS / 2)).toBeCloseTo(0.5);
  });

  it('pastDuration-isZero', () => {
    expect(healAuraOpacity(HEAL_AURA_DURATION_SECONDS + 0.01)).toBe(0);
  });

  it('negativeElapsed-isZero', () => {
    expect(healAuraOpacity(-0.01)).toBe(0);
  });
});

describe('healAuraRays', () => {
  it('pastDuration-returnsNoRays', () => {
    expect(healAuraRays(HEAL_AURA_DURATION_SECONDS + 0.01, 32)).toEqual([]);
  });

  it('withinDuration-returnsRaysSpreadAcrossTheGivenWidth', () => {
    const rays = healAuraRays(HEAL_AURA_DURATION_SECONDS / 2, 32);
    expect(rays.length).toBeGreaterThan(0);
    for (const ray of rays) {
      expect(Math.abs(ray.dx)).toBeLessThanOrEqual(16);
      expect(ray.height).toBeGreaterThan(0);
    }
  });

  it('laterElapsed-raysAreTaller', () => {
    const early = healAuraRays(0, 32)[0].height;
    const late = healAuraRays(HEAL_AURA_DURATION_SECONDS * 0.9, 32)[0].height;
    expect(late).toBeGreaterThan(early);
  });
});

describe('healAuraSparkles', () => {
  it('pastDuration-returnsNoSparkles', () => {
    expect(healAuraSparkles(HEAL_AURA_DURATION_SECONDS + 0.01, 32)).toEqual([]);
  });

  it('withinDuration-returnsSparklesRisingAboveTheAnchor', () => {
    const sparkles = healAuraSparkles(HEAL_AURA_DURATION_SECONDS / 2, 32);
    expect(sparkles.length).toBeGreaterThan(0);
    for (const sparkle of sparkles) {
      expect(sparkle.dy).toBeLessThan(0);
    }
  });

  it('laterElapsed-sparklesRiseFurther', () => {
    const early = healAuraSparkles(0.01, 32)[0].dy;
    const late = healAuraSparkles(HEAL_AURA_DURATION_SECONDS * 0.9, 32)[0].dy;
    expect(late).toBeLessThan(early);
  });
});

describe('startCounterPopup', () => {
  it('called-returnsZeroElapsedWithGivenFields', () => {
    expect(startCounterPopup('fruits', 1, 4)).toEqual({
      labelKey: 'fruits',
      collected: 1,
      total: 4,
      elapsed: 0,
    });
  });
});

describe('tickCounterPopup', () => {
  it('withinDuration-advancesElapsed', () => {
    const effect = tickCounterPopup(startCounterPopup('coins', 2, 4), 0.5);
    expect(effect).toEqual({ labelKey: 'coins', collected: 2, total: 4, elapsed: 0.5 });
  });

  it('pastDuration-returnsNull', () => {
    expect(tickCounterPopup(startCounterPopup('coins', 2, 4), COUNTER_POPUP_DURATION_SECONDS + 0.01)).toBeNull();
  });
});

describe('counterPopupOpacity', () => {
  it('duringHold-returnsFullOpacity', () => {
    const effect = tickCounterPopup(startCounterPopup('coins', 1, 4), COUNTER_POPUP_HOLD_SECONDS - 0.01)!;
    expect(counterPopupOpacity(effect)).toBe(1);
  });

  it('midFade-returnsPartialOpacity', () => {
    const effect = tickCounterPopup(
      startCounterPopup('coins', 1, 4),
      COUNTER_POPUP_DURATION_SECONDS - (COUNTER_POPUP_DURATION_SECONDS - COUNTER_POPUP_HOLD_SECONDS) / 2,
    )!;
    expect(counterPopupOpacity(effect)).toBeCloseTo(0.5);
  });
});

describe('createSlotAllocator', () => {
  it('zeroInFlight-startsAtOffsetZero', () => {
    const allocate = createSlotAllocator(0);

    expect(allocate()).toBe(0);
  });

  it('successiveCalls-advanceByOneRow', () => {
    const allocate = createSlotAllocator(0);

    allocate();

    expect(allocate()).toBe(COLLECTION_TEXT_STACK_ROW_HEIGHT);
  });

  it('nonZeroInFlight-startsSeededByThatCount', () => {
    const allocate = createSlotAllocator(1);

    expect(allocate()).toBe(COLLECTION_TEXT_STACK_ROW_HEIGHT);
  });

  it('inFlightCountAboveSlotCount-wrapsTheSeed', () => {
    const allocate = createSlotAllocator(COLLECTION_TEXT_SLOT_COUNT);

    expect(allocate()).toBe(0);
  });

  it('pastTheSlotCount-cyclesBackToOffsetZero', () => {
    const allocate = createSlotAllocator(0);
    const offsets = Array.from({ length: COLLECTION_TEXT_SLOT_COUNT + 1 }, () => allocate());

    expect(offsets[COLLECTION_TEXT_SLOT_COUNT]).toBe(offsets[0]);
    expect(new Set(offsets.slice(0, COLLECTION_TEXT_SLOT_COUNT)).size).toBe(COLLECTION_TEXT_SLOT_COUNT);
  });

  // The property that TWO CONSUMERS sharing one allocator never take the same
  // slot is pinned in RewardReveal.test.ts's
  // 'allocatorSharedWithAnotherConsumer-theyNeverTakeTheSameSlot' — that test
  // shares one allocator between the reveal trigger and a second consumer,
  // which two separate calls on one allocator here cannot exercise.
});

describe('startPlayerHitSplatter', () => {
  it('contactSideRight-anchorsRightOfAndBelowCenter', () => {
    const effect = startPlayerHitSplatter('p', 100, 200, 1);
    expect(effect.x).toBeGreaterThan(100);
    expect(effect.y).toBeGreaterThan(200);
    expect(effect.dirBiasX).toBeGreaterThan(0);
  });

  it('contactSideLeft-anchorsLeftOfCenterMirroringTheRightCase', () => {
    const right = startPlayerHitSplatter('p', 100, 200, 1);
    const left = startPlayerHitSplatter('p', 100, 200, -1);
    // Mirrored around the center x, not just "less than center" — pins the
    // exact symmetry contactSide is supposed to guarantee.
    expect(left.x - 100).toBeCloseTo(-(right.x - 100));
    expect(left.dirBiasX).toBeCloseTo(-right.dirBiasX);
  });

  it('noContactSide-anchorsExactlyAtCenterX', () => {
    // The pit-fall case (spec.md FR-001's "no clear side").
    const effect = startPlayerHitSplatter('p', 100, 200, 0);
    expect(effect.x).toBe(100);
    expect(effect.dirBiasX).toBe(0);
  });

  it('called-usesRedAndSevenDroplets', () => {
    const effect = startPlayerHitSplatter('p', 0, 0, 1);
    expect(effect.color).toBe('#a30f1f');
    expect(effect.dropletCount).toBe(7);
    expect(effect.elapsed).toBe(0);
  });
});

describe('startEnemyHitSplatter', () => {
  it('greenSlime-usesGreenGooColor', () => {
    const effect = startEnemyHitSplatter('e', 50, 60, 'slimeGreen');
    expect(effect.color).toBe('#3ddc55');
  });

  it('purpleSlime-usesPurpleGooColorDistinctFromGreen', () => {
    const green = startEnemyHitSplatter('e', 50, 60, 'slimeGreen');
    const purple = startEnemyHitSplatter('e', 50, 60, 'slimePurple');
    expect(purple.color).not.toBe(green.color);
  });

  it('called-anchorsExactlyAtGivenTopXY', () => {
    // No further offset — the caller already passes the top of the
    // enemy's own hitbox (see PlatformerPage.tsx's wiring in Task 6).
    const effect = startEnemyHitSplatter('e', 50, 60, 'slimeGreen');
    expect(effect.x).toBe(50);
    expect(effect.y).toBe(60);
  });

  it('called-usesMoreDropletsThanThePlayersSplatter', () => {
    const effect = startEnemyHitSplatter('e', 0, 0, 'slimeGreen');
    expect(effect.dropletCount).toBe(13);
    expect(effect.dropletCount).toBeGreaterThan(startPlayerHitSplatter('p', 0, 0, 1).dropletCount);
  });

  it('called-biasesUpwardNotSideways', () => {
    const effect = startEnemyHitSplatter('e', 0, 0, 'slimeGreen');
    expect(effect.dirBiasY).toBeLessThan(0);
    expect(effect.dirBiasX).toBe(0);
  });
});

describe('tickHitSplatterEffect', () => {
  it('called-advancesElapsedByDt', () => {
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), 0.1);
    expect(effect.elapsed).toBeCloseTo(0.1);
  });
});

describe('hitSplatterDroplets', () => {
  it('freshEffect-returnsExactlyDropletCountEntriesAllAtAnchorFullOpacity', () => {
    const effect = startPlayerHitSplatter('p', 0, 0, 1);
    const droplets = hitSplatterDroplets(effect);
    expect(droplets).toHaveLength(effect.dropletCount);
    for (const d of droplets) {
      expect(d.dx).toBe(0);
      expect(d.dy).toBe(0);
      expect(d.opacity).toBe(1);
    }
  });

  it('sevenDroplets-verticalSpreadIsNotDegenerate', () => {
    // Regression guard: an earlier draft shuffled each droplet's vertical
    // position with `(i * 7) % count`, which for a 7-droplet burst collapses
    // to 0 for every `i` (7 is a multiple of 7) — every droplet would fall
    // in a single vertical line instead of scattering. The real stride must
    // be coprime with every droplet count this effect uses (7 and 13).
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), 0.3);
    const droplets = hitSplatterDroplets(effect);
    const dys = droplets.map((d) => d.dy);
    expect(new Set(dys).size).toBeGreaterThan(1);
  });

  it('thirteenDroplets-verticalSpreadIsNotDegenerate', () => {
    const effect = tickHitSplatterEffect(startEnemyHitSplatter('e', 0, 0, 'slimeGreen'), 0.3);
    const droplets = hitSplatterDroplets(effect);
    const dys = droplets.map((d) => d.dy);
    expect(new Set(dys).size).toBeGreaterThan(1);
  });

  it('calledTwiceWithSameEffect-returnsIdenticalResult', () => {
    // Determinism: the whole point of moving off Math.random() (see
    // design.md) is that the same effect always produces the same burst.
    const effect = tickHitSplatterEffect(startEnemyHitSplatter('e', 10, 20, 'slimePurple'), 0.2);
    expect(hitSplatterDroplets(effect)).toEqual(hitSplatterDroplets(effect));
  });

  it('midway-appliesGravitySoDyExceedsLinearProjection', () => {
    const early = tickHitSplatterEffect(startEnemyHitSplatter('e', 0, 0, 'slimeGreen'), 0.1);
    const late = tickHitSplatterEffect(startEnemyHitSplatter('e', 0, 0, 'slimeGreen'), 0.5);
    // Both bias upward (dirBiasY < 0); gravity pulls the LATE sample back
    // down relative to a pure linear projection from the early sample.
    const earlyDy0 = hitSplatterDroplets(early)[0].dy;
    const lateDy0 = hitSplatterDroplets(late)[0].dy;
    const linearProjection = (earlyDy0 / 0.1) * 0.5;
    expect(lateDy0).toBeGreaterThan(linearProjection);
  });

  it('beforeFadeStart-opacityIsFullyOpaque', () => {
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), 0.2); // 0.2/0.6 ≈ 0.33 < 0.7
    expect(hitSplatterDroplets(effect)[0].opacity).toBe(1);
  });

  it('pastFadeStart-opacityIsBelowOne', () => {
    const effect = tickHitSplatterEffect(
      startPlayerHitSplatter('p', 0, 0, 1),
      HIT_SPLATTER_DURATION_SECONDS * 0.85,
    );
    const opacity = hitSplatterDroplets(effect)[0].opacity;
    expect(opacity).toBeLessThan(1);
    expect(opacity).toBeGreaterThan(0);
  });

  it('atOrPastDuration-opacityIsZero', () => {
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), HIT_SPLATTER_DURATION_SECONDS);
    expect(hitSplatterDroplets(effect)[0].opacity).toBe(0);
    const wayPast = tickHitSplatterEffect(startPlayerHitSplatter('p', 0, 0, 1), HIT_SPLATTER_DURATION_SECONDS + 5);
    expect(hitSplatterDroplets(wayPast)[0].opacity).toBe(0);
  });
});
