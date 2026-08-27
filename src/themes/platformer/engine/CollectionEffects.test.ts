import {
  HOVER_DURATION_SECONDS,
  FLIGHT_DURATION_SECONDS,
  SPARKLE_DURATION_SECONDS,
  startFlightEffect,
  tickFlightEffect,
  flightEffectPosition,
  sparkleParticles,
} from './CollectionEffects';

describe('startFlightEffect', () => {
  it('called-returns-hoverPhaseAtZeroElapsed', () => {
    const effect = startFlightEffect('a', 'German', 10, 20, 500, 600);
    expect(effect).toEqual({
      id: 'a',
      text: 'German',
      startX: 10,
      startY: 20,
      targetX: 500,
      targetY: 600,
      elapsed: 0,
      phase: 'hover',
    });
  });
});

describe('tickFlightEffect', () => {
  it('withinHoverDuration-staysHoverPhase', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 0, 0, 0, 0), HOVER_DURATION_SECONDS / 2);
    expect(effect.phase).toBe('hover');
  });

  it('pastHoverDuration-transitionsToFlyingPhase', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 0, 0, 0, 0), HOVER_DURATION_SECONDS + 0.01);
    expect(effect.phase).toBe('flying');
  });

  it('pastHoverPlusFlightDuration-transitionsToDonePhase', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 0, 0, 0, 0),
      HOVER_DURATION_SECONDS + FLIGHT_DURATION_SECONDS + 0.01,
    );
    expect(effect.phase).toBe('done');
  });

  it('donePhase-tickedAgain-returnsSameReference', () => {
    const done = tickFlightEffect(
      startFlightEffect('a', 't', 0, 0, 0, 0),
      HOVER_DURATION_SECONDS + FLIGHT_DURATION_SECONDS + 0.01,
    );
    expect(tickFlightEffect(done, 1)).toBe(done);
  });
});

describe('flightEffectPosition', () => {
  it('hoverPhase-staysNearStartWithFullOpacity', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 100, 100, 900, 900), HOVER_DURATION_SECONDS / 2);
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(100, 0);
    expect(pos.opacity).toBe(1);
  });

  it('flightStart-positionedAtStart', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 100, 100, 900, 900), HOVER_DURATION_SECONDS);
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(100);
  });

  it('flightEnd-positionedAtTargetWithZeroOpacity', () => {
    const effect = tickFlightEffect(
      startFlightEffect('a', 't', 100, 100, 900, 900),
      HOVER_DURATION_SECONDS + FLIGHT_DURATION_SECONDS,
    );
    const pos = flightEffectPosition(effect);
    expect(pos.x).toBeCloseTo(900);
    expect(pos.y).toBeCloseTo(900);
    expect(pos.opacity).toBeCloseTo(0, 1);
  });

  it('donePhase-returnsZeroOpacity', () => {
    const effect = tickFlightEffect(startFlightEffect('a', 't', 0, 0, 0, 0), 100);
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
