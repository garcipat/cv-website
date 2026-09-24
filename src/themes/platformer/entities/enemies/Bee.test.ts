import { bee, BEE_SPRITE } from './Bee';
import type { BeeState } from './Bee';
import { typeOf } from './index';
import { advanceEnemyAnimation } from '../Enemy';
import { stepEnemyHitReaction } from './hitReaction';
import { resolveAnimation, enemyFrameIndex } from './EnemyAnimation';
import { frameSource } from '../sprites/SpriteSheet';
import { ENEMY_HIT_REACTION_SECONDS } from './shared';
import type { PlayerState } from '../Player';
import type { Contact, ContactSide } from '../../contracts/Outcome';
import type { DrawContext } from '../../contracts/DrawContext';
import type { LevelDef, TileType } from '../../level/LevelData';
import type { EnemyPlacement } from '../../level/EnemyMapper';
import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import { PHYSICS_CONFIG } from '../../contracts/PhysicsConfig';

/**
 * The bee's combat contract (FR-010/FR-011/FR-012/FR-013, SC-004/SC-009):
 * a flying enemy that stomps exactly like a green slime and pays nothing.
 */

function makePlacement(col = 5): EnemyPlacement {
  return { id: `enemy-bee-${col}-0`, type: 'bee', x: col * RENDERED_TILE_SIZE, y: 0 };
}

function makeBee(col = 5): BeeState {
  return bee.create(makePlacement(col), 0);
}

function makeContact(side: ContactSide, playerVy = 200): Contact {
  return {
    side,
    playerVx: 0,
    playerVy,
    playerBox: { x: 0, y: 0, width: 64, height: 64 },
    selfBox: { x: 0, y: 0, width: 36, height: 24 },
  };
}

function makeLevel(width: number, pitCols: number[]): LevelDef {
  const entityRow: TileType[] = Array.from({ length: width }, () => 'empty');
  const groundRow: TileType[] = Array.from({ length: width }, (_, c) =>
    pitCols.includes(c) ? 'empty' : 'groundRock',
  );
  return { terrain: [entityRow, groundRow], width, height: 2 };
}

describe('bee create/revive', () => {
  it('create-seedsFlyStateOneHitPointAndHomes', () => {
    const enemy = makeBee();
    expect(enemy.type).toBe('bee');
    expect(enemy.animState).toBe('fly');
    expect(enemy.hitPoints).toBe(1);
    expect(enemy.homeX).toBe(enemy.x);
    expect(enemy.homeY).toBe(enemy.y);
    expect(enemy.alive).toBe(true);
  });

  it('create-differentIndices-staggerTheFlyLoop', () => {
    const a = bee.create(makePlacement(), 0);
    const b = bee.create(makePlacement(), 1);
    expect(a.animFrame).not.toBe(b.animFrame);
  });

  it('revive-reseedsFlyFullHitPointsAndSpawnPosition', () => {
    const dead: BeeState = { ...makeBee(), hitPoints: 0, alive: false, animState: 'hit' };
    const revived = bee.revive(dead);
    expect(revived.animState).toBe('fly');
    expect(revived.hitPoints).toBe(1);
    expect(revived.alive).toBe(true);
    expect(revived.x).toBe(revived.homeX);
    expect(revived.y).toBe(revived.homeY);
  });
});

describe('bee box (FR-019 / SC-009)', () => {
  it('box-isTheVisibleSilhouette-withTheBottomInsetApplied', () => {
    const enemy = makeBee();
    const size = BEE_SPRITE.sheet.frameWidth * RENDER_SCALE * BEE_SPRITE.renderScale;
    const sidePad = 7 * RENDER_SCALE;
    const topPad = 7 * RENDER_SCALE;
    const bottomPad = 5 * RENDER_SCALE;

    const box = bee.box(enemy);
    expect(box).toEqual({
      x: enemy.x + (RENDERED_TILE_SIZE - size) / 2 + sidePad,
      y: enemy.y + (RENDERED_TILE_SIZE - size) + topPad + bottomPad,
      width: size - 2 * sidePad,
      height: size - topPad - bottomPad,
    });
    // The box's bottom edge rests on the placement row, matching the drawn art.
    expect(box.y + box.height).toBeCloseTo(enemy.y + RENDERED_TILE_SIZE);
  });
});

describe('bee contact', () => {
  it('fallingTopContact-stompsWithTheGreenSlimeBounce', () => {
    const outcome = bee.onPlayerCollide(makeBee(), {} as PlayerState, makeContact('top', 200));
    expect(outcome.self?.hitPoints).toBe(0);
    expect(outcome.bounceVelocity).toBe(PHYSICS_CONFIG.stompBounceVelocity);
    expect(outcome.damagePlayer).toBeUndefined();
  });

  it('sideOrUndersideContact-damagesHalfAHeartAndKnocksAway', () => {
    for (const side of ['side', 'bottom'] as const) {
      const outcome = bee.onPlayerCollide(makeBee(), {} as PlayerState, makeContact(side));
      expect(outcome.damagePlayer).toBe(1);
      expect(outcome.knockback).toBe('away');
      expect(outcome.self).toBeUndefined();
    }
  });

  it('whileReacting-takesNoSecondHitAndDamagesNobody', () => {
    const reacting: BeeState = { ...makeBee(), animState: 'hit', hitTimer: 0, hitPoints: 0 };
    expect(bee.onPlayerCollide(reacting, {} as PlayerState, makeContact('top'))).toEqual({});

    const reactingAlive: BeeState = { ...makeBee(), animState: 'hit', hitTimer: 0, hitPoints: 1 };
    expect(bee.onPlayerCollide(reactingAlive, {} as PlayerState, makeContact('side'))).toEqual({});
  });
});

describe('bee through the real step pipeline', () => {
  it('overAGap-crossesWithoutReversingAndBobs', () => {
    const level = makeLevel(10, [7]);
    const dt = 1 / 60;
    let elapsed = 0;
    let enemy: BeeState = makeBee();
    const startX = enemy.x;
    const sampledY = new Set<number>();

    for (let i = 0; i < 60; i++) {
      elapsed += dt;
      const moved = typeOf(enemy).movement.step(
        enemy,
        { level, blockedTiles: [], player: null, elapsed },
        dt,
      );
      enemy = advanceEnemyAnimation(typeOf(moved).onTick?.(moved, dt) ?? moved, dt) as BeeState;
      sampledY.add(Math.round(enemy.y * 100));
    }

    expect(enemy.direction).toBe('right');
    expect(enemy.x).toBeGreaterThan(startX);
    expect(sampledY.size).toBeGreaterThan(5);
  });
});

describe('bee animation is per-kind (FR-008 / FR-009)', () => {
  it('aBeeThatSurvivesAHit-revertsToItsOwnFlyStateAtFrameZeroNotWalk', () => {
    const hit: BeeState = {
      ...makeBee(),
      hitPoints: 1,
      animState: 'hit',
      animFrame: 2,
      animTimer: 0.05,
      hitTimer: 0,
    };

    const reverted = stepEnemyHitReaction(hit, ENEMY_HIT_REACTION_SECONDS);

    expect(reverted.animState).toBe('fly');
    expect(reverted.animFrame).toBe(0);
    expect(reverted.animTimer).toBe(0);
    expect(reverted.alive).toBe(true);
  });

  it('aFreshlyHitBee-withNoHitRow-isDrawnWithFlyFramesBeforeAnyAdvanceRuns', () => {
    // The draw path must resolve the fallback itself: a freshly hit bee is
    // drawn before the next tick's advanceEnemyAnimation runs.
    expect(resolveAnimation(BEE_SPRITE, 'hit', 'fly')).toEqual(BEE_SPRITE.animations.fly);

    const hit: BeeState = { ...makeBee(), animState: 'hit', animFrame: 0, hitTimer: 0 };
    const drawn: { sx: number; sy: number }[] = [];
    const ctx = {
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      globalAlpha: 1,
      drawImage: (_img: unknown, sx: number, sy: number) => {
        drawn.push({ sx, sy });
      },
    } as unknown as CanvasRenderingContext2D;
    const dc = {
      ctx,
      sprites: { [BEE_SPRITE.sheet.src]: {} as HTMLImageElement },
      originX: 0,
      originY: 0,
      worldElapsed: 0,
    } as unknown as DrawContext;

    bee.draw(hit, dc);

    expect(drawn).toEqual([frameSource(BEE_SPRITE.sheet, enemyFrameIndex(BEE_SPRITE, 'hit', 0, 'fly'))]);
  });
});
