import {
  ENEMY_RENDERED_SIZE,
  toEnemyState,
  reviveEnemy,
  advanceEnemyAnimation,
  enemyRenderedSize,
  enemyTileOffsetX,
  enemyTileOffsetY,
  enemyHitboxSidePadding,
  enemyHitboxTopPadding,
} from './Enemy';
import type { EnemyState } from './Enemy';
import { ENEMY_TYPES } from './enemies';
import { enemyFrameIndex } from './enemies/EnemyAnimation';
import { ENEMY_HIT_REACTION_SECONDS } from './enemies/shared';
import { SLIME_GREEN_SHEET } from './sprites/sheets';
import { frameSource } from './sprites/SpriteSheet';

const ENEMY_FRAME_SIZE = SLIME_GREEN_SHEET.frameWidth;

function enemyFrameSource(animState: 'walk' | 'hit', frame: number): { sx: number; sy: number } {
  return frameSource(SLIME_GREEN_SHEET, enemyFrameIndex(animState, frame));
}
import type { EnemyPlacement } from '../level/EnemyMapper';
import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';

function makePlacement(): EnemyPlacement {
  return {
    id: 'enemy-cert-x',
    type: 'slimeGreen',
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

describe('enemyFrameIndex resolved through the sheet', () => {
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
    expect(state.type).toBe('slimeGreen');
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
    // Walk has 5 frames (see EnemyAnimation.ts) — index 5 must land back
    // on the same frame as index 0, confirming the offset wraps via modulo
    // rather than growing unbounded.
    const a = toEnemyState(makePlacement(), 0);
    const b = toEnemyState(makePlacement(), 5);
    expect(b.animFrame).toBe(a.animFrame);
  });

  it('greenSlime-startsWithOneHitPoint', () => {
    const state = toEnemyState(makePlacement());
    expect(state.hitPoints).toBe(1);
    expect(state.alive).toBe(true);
    expect(state.hitTimer).toBe(ENEMY_HIT_REACTION_SECONDS);
  });

  it('purpleSlime-startsWithThreeHitPoints', () => {
    const purplePlacement = { ...makePlacement(), type: 'slimePurple' as const };
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

describe('per-type enemy config', () => {
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
    expect(ENEMY_TYPES.slimePurple.patrolSpeedMultiplier).toBeLessThan(
      ENEMY_TYPES.slimeGreen.patrolSpeedMultiplier,
    );
    expect(ENEMY_TYPES.slimePurple.patrolSpeedMultiplier).toBe(0.7);
  });

  it('hitPoints-slimePurple-is3', () => {
    expect(ENEMY_TYPES.slimePurple.maxHitPoints).toBe(3);
    expect(ENEMY_TYPES.slimeGreen.maxHitPoints).toBe(1);
  });

  it('renderScale-slimePurple-is1point5', () => {
    expect(ENEMY_TYPES.slimePurple.sprite.renderScale).toBe(2);
    expect(ENEMY_TYPES.slimeGreen.sprite.renderScale).toBe(1);
  });
});

describe('toEnemyState hitPoints (updated)', () => {
  it('toEnemyState-slimePurple-hasThreeHitPoints', () => {
    const placement = { id: 'e1', type: 'slimePurple' as const, x: 0, y: 0 };
    expect(toEnemyState(placement).hitPoints).toBe(3);
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
    // edge, per enemyTileOffsetY's doc comment).
    expect(enemyHitboxTopPadding('slimeGreen')).toBe(9 * RENDER_SCALE * 1);
  });

  it('enemyHitboxTopPadding-slimePurple-scalesWithRenderScale', () => {
    expect(enemyHitboxTopPadding('slimePurple')).toBe(9 * RENDER_SCALE * 2);
  });
});

describe('reviveEnemy', () => {
  it('deadEnemyAwayFromSpawn-restoresPositionHitPointsAndLife', () => {
    const enemy = toEnemyState(makePlacement());
    const wandered: EnemyState = {
      ...enemy,
      x: enemy.x + 250,
      y: enemy.y + 64,
      vx: -40,
      hitPoints: 0,
      alive: false,
      animState: 'hit',
      animFrame: 3,
      animTimer: 0.07,
      hitTimer: 0.9,
    };

    const revived = reviveEnemy(wandered);

    expect(revived.x).toBe(enemy.x);
    expect(revived.y).toBe(enemy.y);
    expect(revived.hitPoints).toBe(ENEMY_TYPES[enemy.type].maxHitPoints);
    expect(revived.alive).toBe(true);
    expect(revived.animState).toBe('walk');
    expect(revived.hitTimer).toBe(ENEMY_HIT_REACTION_SECONDS);
  });

  it('livingEnemy-stillResetsToSpawnState', () => {
    // resetGame() maps over every enemy unconditionally, so revive must be
    // correct for a living enemy too, not only a dead one.
    const enemy = toEnemyState(makePlacement());
    const revived = reviveEnemy({ ...enemy, x: enemy.x + 100, vx: 40 });
    expect(revived.x).toBe(enemy.x);
    expect(revived.vx).toBe(0);
  });

  it('twoEnemiesWithDifferentIndex-staySeparatedInAnimationPhaseAfterRevive', () => {
    // toEnemyState staggers animFrame/animTimer by `index` so multiple
    // enemies don't animate in lockstep (see toEnemyState's doc comment).
    // reviveEnemy must preserve that stagger across a death/respawn cycle
    // instead of hard-zeroing animFrame/animTimer back to a shared start
    // state.
    const enemyA = toEnemyState(makePlacement(), 0);
    const enemyB = toEnemyState(makePlacement(), 1);
    expect(enemyA.animFrame).not.toBe(enemyB.animFrame);

    const revivedA = reviveEnemy({ ...enemyA, alive: false, hitPoints: 0 });
    const revivedB = reviveEnemy({ ...enemyB, alive: false, hitPoints: 0 });

    expect(revivedA.animFrame !== revivedB.animFrame || revivedA.animTimer !== revivedB.animTimer).toBe(
      true,
    );
  });
});
