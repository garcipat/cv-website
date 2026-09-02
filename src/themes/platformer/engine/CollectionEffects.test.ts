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
} from './CollectionEffects';
import type { PuffEffect } from './CollectionEffects';

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
