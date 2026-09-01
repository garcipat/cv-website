import {
  ENEMY_FRAME_SIZE,
  ENEMY_RENDERED_SIZE,
  ENEMY_RENDER_SCALE,
  ENEMY_PATROL_SPEED_MULTIPLIER,
  ENEMY_HIT_POINTS,
  enemyFrameSource,
  toEnemyState,
  advanceEnemyAnimation,
  applyStomp,
  enemyRenderedSize,
  enemyTileOffsetX,
  enemyTileOffsetY,
  enemyHitboxSidePadding,
  enemyHitboxTopPadding,
} from './Enemy';
import type { EnemyState } from './Enemy';
import type { EnemyPlacement } from '../level/EnemyMapper';
import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';

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

  it('purpleSlime-startsWithThreeHitPoints', () => {
    const purplePlacement = { ...makePlacement(), spriteType: 'slimePurple' as const };
    const state = toEnemyState(purplePlacement);
    expect(state.hitPoints).toBe(3);
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
    // applyStomp itself never refuses a second call (see its doc comment) —
    // calling it again mid-reaction must replay from frame 0, not continue
    // wherever the first stomp's animation had gotten to. Collision.ts's
    // `spiked` exclusion is what actually prevents this from happening via
    // real player input once spikes are up — this test exercises the
    // function directly, bypassing that gate.
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

  it('purpleSlimeWithThreeHitPoints-decrementsToTwo', () => {
    const purplePlacement = { ...makePlacement(), spriteType: 'slimePurple' as const };
    const state = toEnemyState(purplePlacement);
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(2);
  });
});

describe('per-spriteType enemy config', () => {
  it('enemyRenderedSize-slimePurple-is1point5xGreen', () => {
    expect(enemyRenderedSize('slimePurple')).toBe(ENEMY_FRAME_SIZE * RENDER_SCALE * 2);
    expect(enemyRenderedSize('slimeGreen')).toBe(ENEMY_FRAME_SIZE * RENDER_SCALE);
  });

  it('enemyTileOffsetX-slimePurple-centersLargerSpriteOnTile', () => {
    const size = enemyRenderedSize('slimePurple');
    expect(enemyTileOffsetX('slimePurple')).toBe((RENDERED_TILE_SIZE - size) / 2);
  });

  it('enemyTileOffsetY-slimePurple-bottomAnchorsLargerSprite', () => {
    const size = enemyRenderedSize('slimePurple');
    expect(enemyTileOffsetY('slimePurple')).toBe(RENDERED_TILE_SIZE - size);
  });

  it('patrolSpeedMultiplier-slimePurple-isSlowerThanGreen', () => {
    expect(ENEMY_PATROL_SPEED_MULTIPLIER.slimePurple).toBeLessThan(ENEMY_PATROL_SPEED_MULTIPLIER.slimeGreen);
    expect(ENEMY_PATROL_SPEED_MULTIPLIER.slimePurple).toBe(0.7);
  });

  it('hitPoints-slimePurple-is3', () => {
    expect(ENEMY_HIT_POINTS.slimePurple).toBe(3);
    expect(ENEMY_HIT_POINTS.slimeGreen).toBe(1);
  });

  it('renderScale-slimePurple-is1point5', () => {
    expect(ENEMY_RENDER_SCALE.slimePurple).toBe(2);
    expect(ENEMY_RENDER_SCALE.slimeGreen).toBe(1);
  });
});

describe('toEnemyState hitPoints (updated)', () => {
  it('toEnemyState-slimePurple-hasThreeHitPoints', () => {
    const placement = { id: 'e1', spriteType: 'slimePurple' as const, x: 0, y: 0 };
    expect(toEnemyState(placement).hitPoints).toBe(3);
  });
});

describe('toEnemyState spiked/spikeTimer defaults', () => {
  it('toEnemyState-anyPlacement-startsNotSpiked', () => {
    const placement = { id: 'e1', spriteType: 'slimePurple' as const, x: 0, y: 0 };
    const state = toEnemyState(placement);
    expect(state.spiked).toBe(false);
    expect(state.spikeTimer).toBe(0);
  });
});

describe('applyStomp spiked behavior', () => {
  it('applyStomp-survivingStomp-becomesSpikedWithResetTimer', () => {
    const state = { ...toEnemyState({ id: 'e1', spriteType: 'slimePurple' as const, x: 0, y: 0 }), spikeTimer: 0.9 };
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(2);
    expect(next.spiked).toBe(true);
    expect(next.spikeTimer).toBe(0);
  });

  it('applyStomp-finishingStomp-doesNotBecomeSpiked', () => {
    const state = { ...toEnemyState({ id: 'e1', spriteType: 'slimeGreen' as const, x: 0, y: 0 }) };
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(0);
    expect(next.spiked).toBe(false);
  });

  it('applyStomp-alreadySpikedSurvivingAnotherStomp-restartsTimer', () => {
    const state = {
      ...toEnemyState({ id: 'e1', spriteType: 'slimePurple' as const, x: 0, y: 0 }),
      hitPoints: 2,
      spiked: true,
      spikeTimer: 1.2,
    };
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(1);
    expect(next.spiked).toBe(true);
    expect(next.spikeTimer).toBe(0);
  });
});

describe('enemy hitbox padding (insets the collision box from the sprite corners)', () => {
  it('enemyHitboxSidePadding-slimeGreen-matchesMeasuredNativePaddingTimesRenderScale', () => {
    // Measured via pixel bounding-box analysis across slime_green.png's/
    // slime_purple.png's shared walk-cycle frames: the opaque silhouette
    // spans x 5-18 of the 24px native frame (5px transparent margin each
    // side).
    expect(enemyHitboxSidePadding('slimeGreen')).toBe(5 * RENDER_SCALE * 1);
  });

  it('enemyHitboxSidePadding-slimePurple-scalesWithRenderScale', () => {
    expect(enemyHitboxSidePadding('slimePurple')).toBe(5 * RENDER_SCALE * 2);
  });

  it('enemyHitboxTopPadding-slimeGreen-matchesMeasuredNativePaddingTimesRenderScale', () => {
    // Same measurement: opaque silhouette spans y 9-23 (9px transparent
    // margin above; 0px below — the feet already touch the frame's bottom
    // edge, per ENEMY_TILE_OFFSET_Y's doc comment).
    expect(enemyHitboxTopPadding('slimeGreen')).toBe(9 * RENDER_SCALE * 1);
  });

  it('enemyHitboxTopPadding-slimePurple-scalesWithRenderScale', () => {
    expect(enemyHitboxTopPadding('slimePurple')).toBe(9 * RENDER_SCALE * 2);
  });
});
