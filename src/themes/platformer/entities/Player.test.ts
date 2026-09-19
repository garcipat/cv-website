import {
  playerFrameSource,
  jumpFrameSource,
  climbFrameSource,
  PLAYER_FRAME_SIZE,
  JUMP_FRAME_SIZE,
  PLAYER_RENDERED_SIZE,
  advancePlayerAnimation,
  updatePlayerAnimState,
  IDLE_FRAME_DURATION,
  applyKnockback,
  beginHitReaction,
  advancePlayerHitTimer,
  isPlayerBlinkVisible,
  hitFrameFromTimer,
  PLAYER_HIT_REACTION_SECONDS,
} from './Player';
import type { PlayerState } from './Player';
import type { Moving, SelfAnimated, Damageable } from './capabilities';
import { isInvulnerable } from './capabilities';
import { spawnPlayerState } from '../PlatformerState';
import { RENDER_SCALE } from '../level/Terrain';
import { MAX_HALF_HEARTS } from './Health';

function idlePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: 0,
    lastGroundedY: 0,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: MAX_HALF_HEARTS,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
    ...overrides,
  };
}

describe('Player', () => {
  it('playerRenderedSize-scalesByRenderScale', () => {
    expect(PLAYER_RENDERED_SIZE).toBe(PLAYER_FRAME_SIZE * RENDER_SCALE);
  });

  it('playerFrameSource-idleFrame0-returnsFirstColumnSource', () => {
    expect(playerFrameSource('idle', 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('playerFrameSource-idleFrame2-returnsThirdColumnSource', () => {
    expect(playerFrameSource('idle', 2)).toEqual({ sx: 2 * PLAYER_FRAME_SIZE, sy: 0 });
  });

  it('playerFrameSource-idleFrame4-wrapsToFirstColumnSource', () => {
    expect(playerFrameSource('idle', 4)).toEqual({ sx: 0, sy: 0 });
  });
});

describe('advancePlayerAnimation', () => {
  it('advancePlayerAnimation-belowFrameDuration-accumulatesTimerWithoutAdvancingFrame', () => {
    const next = advancePlayerAnimation(idlePlayer(), IDLE_FRAME_DURATION / 2);
    expect(next.animTimer).toBeCloseTo(IDLE_FRAME_DURATION / 2);
    expect(next.animFrame).toBe(0);
  });

  it('advancePlayerAnimation-reachesFrameDuration-advancesFrameAndCarriesRemainder', () => {
    const next = advancePlayerAnimation(
      idlePlayer({ animTimer: IDLE_FRAME_DURATION - 0.01 }),
      0.02,
    );
    expect(next.animFrame).toBe(1);
    expect(next.animTimer).toBeCloseTo(0.01);
  });

  it('advancePlayerAnimation-lastFrameReachesDuration-wrapsToFrameZero', () => {
    const next = advancePlayerAnimation(
      idlePlayer({ animFrame: 3, animTimer: IDLE_FRAME_DURATION }),
      0,
    );
    expect(next.animFrame).toBe(0);
  });
});

describe('playerFrameSource walk row', () => {
  it('playerFrameSource-walkFrame0-returnsFirstWalkColumnAtWalkRow', () => {
    expect(playerFrameSource('walk', 0)).toEqual({ sx: 0, sy: PLAYER_FRAME_SIZE * 2 });
  });

  it('playerFrameSource-walkFrame5-returnsSixthWalkColumnAtWalkRow', () => {
    expect(playerFrameSource('walk', 5)).toEqual({
      sx: 5 * PLAYER_FRAME_SIZE,
      sy: PLAYER_FRAME_SIZE * 2,
    });
  });

  it('playerFrameSource-walkFrame8-wrapsToFirstWalkColumn', () => {
    expect(playerFrameSource('walk', 8)).toEqual({ sx: 0, sy: PLAYER_FRAME_SIZE * 2 });
  });
});

describe('advancePlayerAnimation walk timing', () => {
  it('advancePlayerAnimation-walkStateBelowFrameDuration-accumulatesTimerWithoutAdvancingFrame', () => {
    const next = advancePlayerAnimation(idlePlayer({ animState: 'walk' }), 0.04);
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBeCloseTo(0.04);
  });

  it('advancePlayerAnimation-walkStateReachesFrameDuration-advancesFrameAndCarriesRemainder', () => {
    const next = advancePlayerAnimation(
      idlePlayer({ animState: 'walk', animTimer: 0.07 }),
      0.02,
    );
    expect(next.animFrame).toBe(1);
    expect(next.animTimer).toBeCloseTo(0.01);
  });
});

describe('advancePlayerAnimation climb-frozen-while-stationary', () => {
  it('hitState-doesNotAdvanceFrameOrTimer-evenWithALargeDt', () => {
    // The `hit` frame is derived from hitTimer at render time
    // (hitFrameFromTimer), not advanced incrementally here.
    const player = idlePlayer({ animState: 'hit', animFrame: 1, animTimer: 0.05 });
    const next = advancePlayerAnimation(player, 1);
    expect(next).toBe(player);
  });

  it('climbingWithVyZero-doesNotAdvanceFrameOrTimer-evenWithALargeDt', () => {
    const player = idlePlayer({ animState: 'climb', vy: 0, animFrame: 1, animTimer: 0.05 });
    const next = advancePlayerAnimation(player, 1); // dt far larger than any real frame duration
    expect(next.animFrame).toBe(1);
    expect(next.animTimer).toBe(0.05);
  });

  it('climbingWithNonzeroVy-stillAdvancesNormally', () => {
    const player = idlePlayer({ animState: 'climb', vy: -50, animFrame: 1, animTimer: 0.05 });
    const next = advancePlayerAnimation(player, 1);
    // With dt=1s and any reasonable frameDuration for 'climb' (check ANIM_CONFIG's
    // actual value in Player.ts), the frame must have advanced — assert
    // next.animFrame !== 1, rather than a hardcoded number, so this doesn't
    // depend on knowing the exact frameDuration/frameCount by heart.
    expect(next.animFrame).not.toBe(1);
  });
});

describe('updatePlayerAnimState', () => {
  it('updatePlayerAnimState-vxNonZeroFromIdle-switchesToWalkAndResetsFrame', () => {
    const player = idlePlayer({ vx: 200, animState: 'idle', animFrame: 3, animTimer: 0.1 });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('walk');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
  });

  it('updatePlayerAnimState-vxZeroFromWalk-switchesToIdleAndResetsFrame', () => {
    const player = idlePlayer({ vx: 0, animState: 'walk', animFrame: 5, animTimer: 0.05 });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('idle');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
  });

  it('updatePlayerAnimState-stateAlreadyMatchesVelocity-returnsSameObjectReference', () => {
    const player = idlePlayer({ vx: 0, animState: 'idle' });
    const next = updatePlayerAnimState(player);
    expect(next).toBe(player);
  });
});

describe('playerFrameSource jump row', () => {
  it('jumpFrameSource-risingFrame0-returnsFirstJumpColumnAtJumpRow', () => {
    expect(jumpFrameSource(-100, 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('jumpFrameSource-risingFrame3-returnsFourthJumpColumnAtJumpRow', () => {
    expect(jumpFrameSource(-100, 3)).toEqual({ sx: 3 * JUMP_FRAME_SIZE, sy: 0 });
  });

  it('jumpFrameSource-risingFrame7-wrapsToFirstJumpColumn', () => {
    // 7 real JUMP frames (column 7 in the sheet is a text label, unused).
    expect(jumpFrameSource(-100, 7)).toEqual({ sx: 0, sy: 0 });
  });

  it('jumpFrameSource-fallingFrame0-returnsFirstFallColumnAtFallRow', () => {
    expect(jumpFrameSource(50, 0)).toEqual({ sx: 0, sy: 161 });
  });

  it('jumpFrameSource-fallingFrame5-wrapsWithinFourFallFrames', () => {
    // Only 4 real FALL frames, so frame 5 wraps to column 1 (5 % 4 = 1).
    expect(jumpFrameSource(50, 5)).toEqual({ sx: JUMP_FRAME_SIZE, sy: 161 });
  });

  it('jumpFrameSource-vyExactlyZero-treatedAsFalling', () => {
    // The apex of the arc: no longer rising, so it reads as the fall pose
    // rather than staying pinned to the last rising frame.
    expect(jumpFrameSource(0, 0)).toEqual({ sx: 0, sy: 161 });
  });
});

describe('climbFrameSource', () => {
  it('frame0-returnsFirstClimbColumnAtClimbRow', () => {
    expect(climbFrameSource(0)).toEqual({ sx: 0, sy: 322 });
  });

  it('frame2-returnsThirdClimbColumnAtClimbRow', () => {
    expect(climbFrameSource(2)).toEqual({ sx: 2 * JUMP_FRAME_SIZE, sy: 322 });
  });

  it('frame4-wrapsToFirstClimbColumn', () => {
    // Only 4 real CLIMB frames in the sheet.
    expect(climbFrameSource(4)).toEqual({ sx: 0, sy: 322 });
  });
});

describe('updatePlayerAnimState jump priority', () => {
  it('updatePlayerAnimState-notGrounded-switchesToJumpEvenWithZeroVx', () => {
    const player = idlePlayer({ vx: 0, grounded: false, animState: 'idle' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('jump');
  });

  it('updatePlayerAnimState-notGroundedWithNonZeroVx-stillSwitchesToJumpNotWalk', () => {
    const player = idlePlayer({ vx: 200, grounded: false, animState: 'walk' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('jump');
  });

  it('updatePlayerAnimState-groundedAfterJumpWithZeroVx-switchesBackToIdle', () => {
    const player = idlePlayer({ vx: 0, grounded: true, animState: 'jump' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('idle');
  });

  it('updatePlayerAnimState-groundedAfterJumpWithNonZeroVx-switchesToWalk', () => {
    const player = idlePlayer({ vx: 200, grounded: true, animState: 'jump' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('walk');
  });
});

describe('updatePlayerAnimState climbing priority', () => {
  it('climbingTrue-switchesToClimbRegardlessOfGroundedOrVx', () => {
    const player = idlePlayer({ climbing: true, grounded: false, vx: 200, animState: 'idle' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('climb');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
  });

  it('climbingFalseAfterClimb-fallsBackToJumpWhileAirborne', () => {
    const player = idlePlayer({ climbing: false, grounded: false, animState: 'climb' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('jump');
  });
});

describe('advancePlayerHitTimer', () => {
  it('alreadyPastTheWindow-returnsSameReference', () => {
    const player = idlePlayer({ hitTimer: PLAYER_HIT_REACTION_SECONDS });
    const next = advancePlayerHitTimer(player, 1 / 30);
    expect(next).toBe(player);
  });

  it('freshHit-incrementsByDt', () => {
    const player = idlePlayer({ hitTimer: 0 });
    const next = advancePlayerHitTimer(player, 0.2);
    expect(next.hitTimer).toBeCloseTo(0.2);
  });

  it('dtOvershootingTheWindow-clampsToTheReactionDurationNotBeyond', () => {
    const player = idlePlayer({ hitTimer: PLAYER_HIT_REACTION_SECONDS - 0.1 });
    const next = advancePlayerHitTimer(player, 0.2);
    expect(next.hitTimer).toBe(PLAYER_HIT_REACTION_SECONDS);
  });

  it('manyTicksAfterTheWindow-neverGrowsUnbounded', () => {
    let player = idlePlayer({ hitTimer: 0 });
    for (let i = 0; i < 1000; i++) player = advancePlayerHitTimer(player, 1 / 60);
    expect(player.hitTimer).toBe(PLAYER_HIT_REACTION_SECONDS);
  });
});

describe('applyKnockback', () => {
  it('directionLeft-setsNegativeVxFacingLeftAndBothTimers', () => {
    const player = idlePlayer({ vx: 0, direction: 'right' });
    const next = applyKnockback(player, -1, 250, 0.25);
    expect(next.vx).toBe(-250);
    expect(next.direction).toBe('left');
    expect(next.knockbackTimer).toBe(0.25);
    expect(next.hitTimer).toBe(0);
    expect(isInvulnerable(next, PLAYER_HIT_REACTION_SECONDS)).toBe(true);
  });

  it('directionRight-setsPositiveVxAndFacingRight', () => {
    const player = idlePlayer({ vx: 0, direction: 'left' });
    const next = applyKnockback(player, 1, 250, 0.25);
    expect(next.vx).toBe(250);
    expect(next.direction).toBe('right');
  });

  it('called-switchesAnimStateToHitAndResetsItsFrame', () => {
    // A directional hit has a real "thing that hit you" — unlike a pit
    // fall's beginHitReaction, this enters the sprite flash directly.
    const player = idlePlayer({ animState: 'walk', animFrame: 5, animTimer: 0.03 });
    const next = applyKnockback(player, 1, 250, 0.25);
    expect(next.animState).toBe('hit');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
  });
});

it('playerState-assignedToMovingAndSelfAnimated-satisfiesBothShapes', () => {
  const player: Moving & SelfAnimated = spawnPlayerState();
  expect(player.vx).toBe(0);
  expect(player.vy).toBe(0);
  expect(player.direction).toBe('right');
  expect(player.animState).toBe('idle');
});

describe('beginHitReaction', () => {
  it('restartsTheHitTimer-leavesVxFacingKnockbackTimerUntouched', () => {
    // Unlike applyKnockback, a pit fall has no "direction to knock away
    // from" and no horizontal push at all — only the timer changes.
    const player = idlePlayer({ vx: 42, direction: 'left', knockbackTimer: 0 });
    const next = beginHitReaction(player);
    expect(next.hitTimer).toBe(0);
    expect(isInvulnerable(next, PLAYER_HIT_REACTION_SECONDS)).toBe(true);
    expect(next.vx).toBe(42);
    expect(next.direction).toBe('left');
    expect(next.knockbackTimer).toBe(0);
  });

  it('called-leavesAnimStateUntouched', () => {
    // No attacker to react to, so this stays on the render blink rather
    // than switching into the `hit` sprite flash applyKnockback uses.
    const player = idlePlayer({ animState: 'walk', animFrame: 3, animTimer: 0.02 });
    const next = beginHitReaction(player);
    expect(next.animState).toBe('walk');
    expect(next.animFrame).toBe(3);
    expect(next.animTimer).toBe(0.02);
  });
});

describe('player as a damageable', () => {
  it('spawnedPlayer-startsAtFullHitPointsAndAlive', () => {
    const player: Damageable = spawnPlayerState();
    expect(player.hitPoints).toBe(MAX_HALF_HEARTS);
    expect(player.alive).toBe(true);
  });

  it('hitPoints-areCountedInHalfHeartsSoThreeHeartsIsSix', () => {
    // The heart display is presentation over a plain hit-point count: three
    // hearts of two halves each.
    expect(MAX_HALF_HEARTS).toBe(6);
  });
});

describe('spawned player vulnerability', () => {
  it('freshlySpawnedPlayer-isNotInvulnerable', () => {
    // A respawn must leave the player immediately hittable. `hitTimer` counts
    // UP, so "no recent hit" is a value at or past the reaction duration —
    // seeding it to 0 would instead grant a free 0.8 s after every respawn.
    expect(isInvulnerable(spawnPlayerState(), PLAYER_HIT_REACTION_SECONDS)).toBe(false);
  });
});

describe('playerFrameSource hit row', () => {
  it('playerFrameSource-hitFrame0-returnsFirstColumnAtHitRow', () => {
    expect(playerFrameSource('hit', 0)).toEqual({ sx: 0, sy: PLAYER_FRAME_SIZE * 6 });
  });

  it('playerFrameSource-hitFrame2-returnsThirdColumnAtHitRow', () => {
    // The red-tinted flash frame — same row, third column.
    expect(playerFrameSource('hit', 2)).toEqual({
      sx: 2 * PLAYER_FRAME_SIZE,
      sy: PLAYER_FRAME_SIZE * 6,
    });
  });

  it('playerFrameSource-hitFrame3-wrapsToFirstColumn', () => {
    // Only the first 3 of the sheet's 4 HIT columns are used — the 4th is
    // dropped so the red-tint flash (column 2) recurs sooner.
    expect(playerFrameSource('hit', 3)).toEqual({ sx: 0, sy: PLAYER_FRAME_SIZE * 6 });
  });
});

describe('hitFrameFromTimer', () => {
  // A pure function of hitTimer — deterministic regardless of the game
  // loop's actual frame rate/dt jitter, unlike an incrementally-advanced
  // counter. 3 frames x 0.1s each: 0-0.1 -> 0, 0.1-0.2 -> 1, 0.2-0.3 -> 2
  // (the red flash), then wraps.
  it('withinFirstFrameWindow-returnsFrame0', () => {
    expect(hitFrameFromTimer(0)).toBe(0);
    expect(hitFrameFromTimer(0.05)).toBe(0);
  });

  it('withinSecondFrameWindow-returnsFrame1', () => {
    expect(hitFrameFromTimer(0.1)).toBe(1);
    expect(hitFrameFromTimer(0.15)).toBe(1);
  });

  it('withinThirdFrameWindow-returnsFrame2TheRedTintFlash', () => {
    expect(hitFrameFromTimer(0.2)).toBe(2);
    expect(hitFrameFromTimer(0.25)).toBe(2);
  });

  it('afterFullCycle-wrapsBackToFrame0', () => {
    expect(hitFrameFromTimer(0.35)).toBe(0);
  });

  it('secondCycleThirdFrameWindow-returnsFrame2Again', () => {
    // 0.5-0.6s is the second cycle's red-flash window (0.3 + 0.2 to 0.3).
    expect(hitFrameFromTimer(0.55)).toBe(2);
  });
});

describe('playerFrameSource death row', () => {
  it('playerFrameSource-deathFrame0-returnsFirstColumnAtDeathRow', () => {
    expect(playerFrameSource('death', 0)).toEqual({ sx: 0, sy: PLAYER_FRAME_SIZE * 7 });
  });

  it('playerFrameSource-deathFrame3-returnsFourthColumnAtDeathRow', () => {
    // The shrunken "collapsed" final frame — same row, fourth column.
    expect(playerFrameSource('death', 3)).toEqual({
      sx: 3 * PLAYER_FRAME_SIZE,
      sy: PLAYER_FRAME_SIZE * 7,
    });
  });

  it('playerFrameSource-deathFrame4-wrapsToFirstColumn', () => {
    // Only 4 real DEATH frames in the sheet.
    expect(playerFrameSource('death', 4)).toEqual({ sx: 0, sy: PLAYER_FRAME_SIZE * 7 });
  });
});

describe('updatePlayerAnimState hit priority', () => {
  // Entry into 'hit' is NOT this function's job (see its doc comment) — only
  // applyKnockback enters it directly, for a directional hit. This function
  // only ever HOLDS 'hit' for as long as the window stays open, regardless
  // of movement, and falls back to a movement-derived state once it closes.
  it('alreadyHitAndStillInWindow-staysHitRegardlessOfMovement', () => {
    const player = idlePlayer({ hitTimer: 0, vx: 200, grounded: true, animState: 'hit' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('hit');
  });

  it('alreadyHitAndStillInWindow-staysHitNotClimb', () => {
    const player = idlePlayer({ hitTimer: 0, climbing: true, animState: 'hit' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('hit');
  });

  it('alreadyHitAndStillInWindow-staysHitNotJump', () => {
    const player = idlePlayer({ hitTimer: 0, grounded: false, animState: 'hit' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('hit');
  });

  it('hitTimerFreshButAnimStateNotYetHit-doesNotAutoEnterHit', () => {
    // Confirms entry is external (applyKnockback), not derived from
    // hitTimer/isInvulnerable by this function — e.g. a pit fall's
    // beginHitReaction resets hitTimer without touching animState, and this
    // function must not second-guess that by entering 'hit' anyway.
    const player = idlePlayer({ hitTimer: 0, vx: 0, grounded: true, animState: 'idle' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('idle');
  });

  it('stillInsideTheWindow-returnsSameReferenceSoFramesKeepLooping', () => {
    // No frame/timer reset while still 'hit' — this is what lets the 3-frame
    // cycle loop continuously for the whole reaction window instead of
    // restarting every tick.
    const player = idlePlayer({ hitTimer: 0.5, animState: 'hit', animFrame: 2, animTimer: 0.05 });
    const next = updatePlayerAnimState(player);
    expect(next).toBe(player);
  });

  it('windowJustEnded-fallsBackToMovementState', () => {
    const player = idlePlayer({
      hitTimer: PLAYER_HIT_REACTION_SECONDS,
      animState: 'hit',
      vx: 0,
      grounded: true,
    });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('idle');
  });
});

describe('isPlayerBlinkVisible', () => {
  // Pins the blink PHASE, not merely its cadence. A count-up timer fed
  // straight into `floor(t / interval) % 2 === 0` would blink for the same
  // duration at the same rate but with every on/off frame swapped; these two
  // sample points are one blink interval apart and land on opposite phases,
  // so an inverted implementation flips both.
  it('halfABlinkIntervalAfterTheHit-isHidden', () => {
    expect(isPlayerBlinkVisible(0.05)).toBe(false);
  });

  it('oneAndAHalfBlinkIntervalsAfterTheHit-isVisible', () => {
    expect(isPlayerBlinkVisible(0.15)).toBe(true);
  });

  it('theInstantOfTheHit-isHidden', () => {
    // The window opens on a hidden frame — the hit reads as the sprite
    // vanishing. An end-anchored implementation would make this an accident
    // of the reaction duration's own value instead of a guaranteed frame.
    expect(isPlayerBlinkVisible(0)).toBe(false);
  });
});
