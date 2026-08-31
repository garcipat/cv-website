import {
  ENEMY_FRAME_SIZE,
  ENEMY_RENDERED_SIZE,
  enemyFrameSource,
  toEnemyState,
  advanceEnemyAnimation,
  applyStomp,
} from './Enemy';
import type { EnemyState } from './Enemy';
import type { EnemyPlacement } from '../level/EnemyMapper';

function makePlacement(): EnemyPlacement {
  return {
    id: 'enemy-cert-x',
    spriteType: 'slimeGreen',
    fact: {
      id: 'enemy-cert-x',
      sectionId: 'certificates',
      sectionLabel: 'Certificates',
      data: { name: 'X', issuer: 'Y', date: '2020-01' },
      sourceType: 'enemy',
    },
    x: 320,
    y: 96,
  };
}

describe('enemyFrameSource', () => {
  it('walkFrameZero-returnsSheetFrameFour', () => {
    // Sheet frame 4 (1-based, row 0 col 3) — the tuned breathing/bounce loop
    // is walk's frame range since there's no idle state (a patrolling enemy
    // is always moving).
    expect(enemyFrameSource('walk', 0)).toEqual({ sx: 3 * ENEMY_FRAME_SIZE, sy: 0 });
  });

  it('walkFrameTwo-returnsSheetFrameSix', () => {
    // Sheet frame 6 (1-based, row 1 col 1).
    expect(enemyFrameSource('walk', 2)).toEqual({ sx: 1 * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE });
  });

  it('hitFrameZero-returnsRowTwo', () => {
    expect(enemyFrameSource('hit', 0)).toEqual({ sx: 0, sy: ENEMY_FRAME_SIZE * 2 });
  });
});

describe('toEnemyState', () => {
  it('placement-noIndex-convertsToInitialWalkStateAtFrameZero', () => {
    const state = toEnemyState(makePlacement());
    expect(state.x).toBe(320);
    expect(state.y).toBe(96);
    expect(state.spriteType).toBe('slimeGreen');
    expect(state.fact).toEqual(makePlacement().fact);
    expect(state.vx).toBe(0);
    expect(state.direction).toBe('right');
    expect(state.animState).toBe('walk');
    expect(state.animFrame).toBe(0);
    expect(state.animTimer).toBe(0);
  });

  it('differentIndices-desyncStartingAnimFrame', () => {
    // Two enemies placed via the same factory must not start on the same
    // walk frame, or they'd visibly animate in perfect unison.
    const a = toEnemyState(makePlacement(), 0);
    const b = toEnemyState(makePlacement(), 1);
    expect(a.animFrame).not.toBe(b.animFrame);
  });

  it('indexEqualToWalkFrameCount-wrapsAroundToSameFrameAsIndexZero', () => {
    // Walk has 5 frames (see Enemy.ts's WALK_FRAMES) — index 5 must land back
    // on the same frame as index 0, confirming the offset wraps via modulo
    // rather than growing unbounded.
    const a = toEnemyState(makePlacement(), 0);
    const b = toEnemyState(makePlacement(), 5);
    expect(b.animFrame).toBe(a.animFrame);
  });

  it('greenSlime-startsWithOneHitPoint', () => {
    const state = toEnemyState(makePlacement());
    expect(state.hitPoints).toBe(1);
    expect(state.defeated).toBe(false);
    expect(state.hitTimer).toBe(0);
  });

  it('purpleSlime-startsWithTwoHitPoints', () => {
    const purplePlacement = { ...makePlacement(), spriteType: 'slimePurple' as const };
    const state = toEnemyState(purplePlacement);
    expect(state.hitPoints).toBe(2);
  });
});

describe('advanceEnemyAnimation', () => {
  it('belowFrameDuration-onlyAccumulatesTimer', () => {
    const state = toEnemyState(makePlacement());
    const next = advanceEnemyAnimation(state, 0.05);
    expect(next.animTimer).toBeCloseTo(0.05);
    expect(next.animFrame).toBe(0);
  });

  it('atFrameDuration-advancesFrameAndResetsTimerRemainder', () => {
    // walk's frameDuration is 0.15s.
    const state = { ...toEnemyState(makePlacement()), animTimer: 0.1 };
    const next = advanceEnemyAnimation(state, 0.05);
    expect(next.animFrame).toBe(1);
    expect(next.animTimer).toBeCloseTo(0);
  });

  it('wrapsFrameAfterFullCycle', () => {
    let state = toEnemyState(makePlacement());
    for (let i = 0; i < 5; i++) {
      state = advanceEnemyAnimation(state, 0.15);
    }
    expect(state.animFrame).toBe(0);
  });

  it('hitState-usesHitsFrameDurationAndCount', () => {
    let state: EnemyState = { ...toEnemyState(makePlacement()), animState: 'hit', animFrame: 0, animTimer: 0 };
    state = advanceEnemyAnimation(state, 0.1);
    expect(state.animFrame).toBe(1);
  });
});

describe('ENEMY_RENDERED_SIZE', () => {
  it('equals-frameSizeTimesRenderScale', () => {
    expect(ENEMY_RENDERED_SIZE).toBe(ENEMY_FRAME_SIZE * 2);
  });
});

describe('applyStomp', () => {
  it('anyEnemy-entersHitStateAtFrameZeroAndFreezesMovement', () => {
    const state = { ...toEnemyState(makePlacement()), vx: 60, direction: 'right' as const };
    const next = applyStomp(state);
    expect(next.animState).toBe('hit');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
    expect(next.hitTimer).toBe(0);
    expect(next.vx).toBe(0);
  });

  it('enemyAlreadyMidHitReactionFromAnEarlierStomp-resetsAnimationAgain', () => {
    // A legitimate second stomp (chain-stomping a still-alive purple enemy,
    // even entirely airborne from the first stomp's own bounce arc — see
    // Collision.ts's checkEnemyStompCollisions) must replay the reaction
    // from frame 0, not continue wherever the first stomp's animation had
    // gotten to.
    const state = {
      ...toEnemyState({ ...makePlacement(), spriteType: 'slimePurple' as const }),
      hitPoints: 2,
      animState: 'hit' as const,
      animFrame: 3,
      animTimer: 0.05,
      hitTimer: 0.2,
    };
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(1);
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
    expect(next.hitTimer).toBe(0);
  });

  it('greenSlimeWithOneHitPoint-decrementsToZero', () => {
    const state = toEnemyState(makePlacement());
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(0);
  });

  it('purpleSlimeWithTwoHitPoints-decrementsToOne', () => {
    const purplePlacement = { ...makePlacement(), spriteType: 'slimePurple' as const };
    const state = toEnemyState(purplePlacement);
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(1);
  });
});
