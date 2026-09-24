import {
  ENEMY_RENDERED_SIZE,
  toEnemyState,
  reviveEnemy,
  applyEnemyDamage,
  advanceEnemyAnimation,
  enemyRenderedSize,
  enemyTileOffsetX,
  enemyTileOffsetY,
  enemyHitboxSidePadding,
  enemyHitboxTopPadding,
  enemyHitboxBottomPadding,
  enemyEffectAnchor,
} from './Enemy';
import type { EnemyState } from './Enemy';
import { ENEMY_TYPES, typeOf } from './enemies';
import { resolveAnimation, enemyFrameIndex } from './enemies/EnemyAnimation';
import { spriteSheetHitbox } from './enemies/spriteSheetHitbox';
import { drawSpriteSheetEntity } from './enemies/drawSpriteSheetEntity';
import type { BaseEnemyState } from './enemies/EnemyType';
import { ENEMY_HIT_REACTION_SECONDS } from './enemies/shared';
import { SLIME_GREEN_SHEET } from './sprites/sheets';
import { frameSource } from './sprites/SpriteSheet';
import type { SpriteDescriptor } from './sprites/SpriteSheet';
import type { DrawContext } from '../contracts/DrawContext';

const ENEMY_FRAME_SIZE = SLIME_GREEN_SHEET.frameWidth;
const GREEN_SPRITE = ENEMY_TYPES.slimeGreen.sprite;

function enemyFrameSource(animState: string, frame: number): { sx: number; sy: number } {
  return frameSource(SLIME_GREEN_SHEET, enemyFrameIndex(GREEN_SPRITE, animState, frame, 'walk'));
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

  it('movement-slimes-useAPatrolStrategyWithTheirOwnRestingState', () => {
    // The old `patrolSpeedMultiplier` field moved into each slime's patrol
    // strategy config; what is observable from the registry now is the
    // strategy kind and the resting animation state.
    expect(ENEMY_TYPES.slimePurple.movement.kind).toBe('patrol');
    expect(ENEMY_TYPES.slimeGreen.movement.kind).toBe('patrol');
    expect(ENEMY_TYPES.slimePurple.defaultAnimState).toBe('walk');
    expect(ENEMY_TYPES.slimeGreen.defaultAnimState).toBe('walk');
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

describe('enemyEffectAnchor', () => {
  it('slimeGreen-centersOnTheHitbox-notTheRenderSlot', () => {
    const enemy = toEnemyState(makePlacement());
    const anchor = enemyEffectAnchor(enemy);
    const box = typeOf(enemy).box(enemy);
    expect(anchor.x).toBeCloseTo(box.x + box.width / 2);
    expect(anchor.y).toBeCloseTo(box.y + box.height / 2);
  });

  it('slimeGreen-scaleIs1-theBaselineSize', () => {
    const enemy = toEnemyState(makePlacement());
    expect(enemyEffectAnchor(enemy).scale).toBeCloseTo(1);
  });

  it('slimePurple-scaleIsGreaterThan1-biggerThanTheGreenBaseline', () => {
    const purplePlacement = { ...makePlacement(), type: 'slimePurple' as const };
    const enemy = toEnemyState(purplePlacement);
    const anchor = enemyEffectAnchor(enemy);
    expect(anchor.scale).toBeGreaterThan(1);
    expect(anchor.scale).toBeCloseTo(enemyRenderedSize('slimePurple') / ENEMY_RENDERED_SIZE);
  });

  it('slimePurple-centersOnTheHitbox-notTheRenderSlot', () => {
    const purplePlacement = { ...makePlacement(), type: 'slimePurple' as const };
    const enemy = toEnemyState(purplePlacement);
    const anchor = enemyEffectAnchor(enemy);
    const box = typeOf(enemy).box(enemy);
    expect(anchor.x).toBeCloseTo(box.x + box.width / 2);
    expect(anchor.y).toBeCloseTo(box.y + box.height / 2);
  });

  it('slimePurple-anchorIsLowerThanTheOldRenderSlotCenterFormula-locksInTheBugFix', () => {
    // The old (buggy) formula centered on the full render slot: since a
    // slime's transparent padding sits above the visible silhouette (never
    // below — see HITBOX_PADDING_NATIVE's own doc comment), the old y-center
    // was always too high. Purple has the largest padding (renderScale: 2),
    // so it shows the biggest, most unambiguous divergence between the two
    // formulas.
    const purplePlacement = { ...makePlacement(), type: 'slimePurple' as const };
    const enemy = toEnemyState(purplePlacement);
    const anchor = enemyEffectAnchor(enemy);

    const size = enemyRenderedSize('slimePurple');
    const oldBuggyY = enemy.y + enemyTileOffsetY('slimePurple') + size / 2;

    expect(anchor.y).toBeGreaterThan(oldBuggyY);
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

describe('applyEnemyDamage', () => {
  it('greenSlimeWithTwoDamage-dropsBelowZeroAndEntersTheHitReactionWithoutDyingYet', () => {
    const enemy = toEnemyState(makePlacement());
    expect(enemy.hitPoints).toBe(1);

    const damaged = applyEnemyDamage(enemy, 2);

    expect(damaged.hitPoints).toBe(-1);
    expect(damaged.animState).toBe('hit');
    expect(damaged.hitTimer).toBe(0);
    // Defeat is stepEnemyHitReaction's decision, not this function's: the hit
    // reaction must play first.
    expect(damaged.alive).toBe(true);
  });

  it('purpleSlimeWithTwoDamage-leavesOneHitPointAndRunsTheTypesOnDamaged', () => {
    const purple = toEnemyState({ ...makePlacement(), id: 'enemy-purple', type: 'slimePurple' });
    expect(purple.hitPoints).toBe(3);

    const damaged = applyEnemyDamage(purple, 2);

    expect(damaged.hitPoints).toBe(1);
    expect(damaged.animState).toBe('hit');
    // SlimePurple's own onDamaged raises its temporary defense while alive.
    expect('spiked' in damaged && damaged.spiked).toBe(true);
  });

  it('zeroOrNegativeDamage-isANoOpAndNeverRunsOnDamaged', () => {
    const purple = toEnemyState({ ...makePlacement(), id: 'enemy-purple', type: 'slimePurple' });
    expect(applyEnemyDamage(purple, 0)).toEqual(purple);
    expect(applyEnemyDamage(purple, -1)).toEqual(purple);
  });
});

describe('enemy hitbox bottom inset (FR-019 / SC-009)', () => {
  it('slimes-declareBottomZero-soTheirBoxIsBitIdenticalToBeforeTheSeam', () => {
    for (const type of ['slimeGreen', 'slimePurple'] as const) {
      expect(ENEMY_TYPES[type].hitboxPaddingNative.bottom).toBe(0);
      expect(enemyHitboxBottomPadding(type)).toBe(0);

      const enemy = toEnemyState({ id: 'e', type, x: 100, y: 200 });
      const size = enemyRenderedSize(type);
      const sidePad = enemyHitboxSidePadding(type);
      const topPad = enemyHitboxTopPadding(type);
      expect(typeOf(enemy).box(enemy)).toEqual({
        x: 100 + enemyTileOffsetX(type) + sidePad,
        y: 200 + enemyTileOffsetY(type) + topPad,
        width: size - 2 * sidePad,
        height: size - topPad,
      });
    }
  });

  it('aNonZeroBottomKind-boxBottomEdgeEqualsTheDrawnVisibleArtBottomAndIsAnchoredOnItsRow', () => {
    // A synthetic descriptor + padding (not a registered kind) with a
    // non-zero bottom inset: the box's bottom edge must coincide with the
    // visible art's bottom, and the frame must be drawn anchored so that art
    // rests on the placement row.
    const sprite: SpriteDescriptor = {
      sheet: SLIME_GREEN_SHEET,
      renderScale: 1,
      animations: { idle: { frames: [0], frameDuration: 1 } },
    };
    const padding = { side: 4, top: 6, bottom: 5 };
    const enemy: BaseEnemyState = { ...toEnemyState(makePlacement()), animState: 'idle' };

    const scale = RENDER_SCALE * sprite.renderScale;
    const size = sprite.sheet.frameWidth * scale;
    const bottomPad = padding.bottom * scale;

    const box = spriteSheetHitbox(enemy, sprite, padding);
    expect(box.y + box.height).toBeCloseTo(enemy.y + RENDERED_TILE_SIZE);

    const drawn: { dy: number }[] = [];
    const ctx = {
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      globalAlpha: 1,
      drawImage: (_img: unknown, _sx: number, _sy: number, _sw: number, _sh: number, _dx: number, dy: number) => {
        drawn.push({ dy });
      },
    } as unknown as CanvasRenderingContext2D;
    const dc = {
      ctx,
      sprites: { [SLIME_GREEN_SHEET.src]: {} as HTMLImageElement },
      originX: 0,
      originY: 0,
      worldElapsed: 0,
    } as unknown as DrawContext;

    drawSpriteSheetEntity(enemy, dc, sprite, 'idle', bottomPad, 1);

    expect(drawn).toHaveLength(1);
    const visibleArtBottom = drawn[0].dy + size - bottomPad;
    expect(visibleArtBottom).toBeCloseTo(box.y + box.height);
    expect(visibleArtBottom).toBeCloseTo(enemy.y + RENDERED_TILE_SIZE);
  });
});

describe('per-kind animation resolution (FR-007 / FR-009)', () => {
  const customSprite: SpriteDescriptor = {
    sheet: SLIME_GREEN_SHEET,
    renderScale: 1,
    animations: {
      idle: { frames: [0, 1], frameDuration: 0.25 },
      walk: { frames: [3, 4, 5], frameDuration: 0.1 },
    },
  };

  it('resolveAnimation-statePresentInTheKindsTable-returnsThatAnimationsFrames', () => {
    expect(resolveAnimation(customSprite, 'walk', 'idle')).toEqual(customSprite.animations.walk);
  });

  it('resolveAnimation-stateMissingFromTheKindsTable-fallsBackToItsDefaultState', () => {
    expect(resolveAnimation(customSprite, 'hit', 'idle')).toEqual(customSprite.animations.idle);
  });

  it('enemyFrameIndex-stateMissingFromTheKindsTable-resolvesThroughTheFallbackWithoutThrowing', () => {
    // The bee's table declares no `hit` row; a requested 'hit' must resolve
    // to the resting state's frames rather than throwing or rendering blank.
    expect(enemyFrameIndex(customSprite, 'hit', 1, 'idle')).toBe(customSprite.animations.idle.frames[1]);
  });

  it('slimes-keepWalkAndHitTablesUnchanged', () => {
    expect(ENEMY_TYPES.slimeGreen.sprite.animations.walk).toEqual({
      frames: [3, 4, 5, 6, 7],
      frameDuration: 0.15,
    });
    expect(ENEMY_TYPES.slimePurple.sprite.animations.hit).toEqual({
      frames: [8, 9, 10, 11],
      frameDuration: 0.1,
    });
  });
});

