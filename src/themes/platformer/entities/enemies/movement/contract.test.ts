import { ENEMY_TYPES, typeOf } from '../index';
import type { EnemyState, EnemyTypeKey } from '../index';
import type { EnemyType, BaseEnemyState } from '../EnemyType';
import { advanceEnemyAnimation } from '../../Enemy';
import { chaseMovement } from './chase';
import { resolveAnimation, enemyFrameIndex } from '../EnemyAnimation';
import { drawSpriteSheetEntity } from '../drawSpriteSheetEntity';
import { baseEnemyState, baseRevive, ENEMY_HIT_REACTION_SECONDS, type EnemyBaseConfig } from '../shared';
import { SLIME_GREEN_SHEET } from '../../sprites/sheets';
import { frameSource } from '../../sprites/SpriteSheet';
import type { SpriteDescriptor } from '../../sprites/SpriteSheet';
import type { DrawContext } from '../../../engine/DrawContext';
import type { EnemyPlacement } from '../../../level/EnemyMapper';
import type { LevelDef } from '../../../level/LevelData';

/**
 * The seam's automated proof (SC-005/SC-006, FR-017/FR-018): every registered
 * kind declares its own movement + resting state, and a brand-new kind with
 * its own movement and animation works end-to-end through the shared pipeline
 * with no shared file changed.
 */

const FIXTURE_KEY = 'chaseFixture';
const FIXTURE_SPRITE: SpriteDescriptor = {
  sheet: SLIME_GREEN_SHEET,
  renderScale: 1,
  animations: {
    idle: { frames: [0], frameDuration: 1 },
    chase: { frames: [12, 13], frameDuration: 0.2 },
  },
};

interface FixtureState extends BaseEnemyState {
  ticks: number;
}

const FIXTURE_BASE_CONFIG: EnemyBaseConfig = {
  maxHitPoints: 1,
  hitReactionSeconds: ENEMY_HIT_REACTION_SECONDS,
  defaultAnimState: 'idle',
  animations: FIXTURE_SPRITE.animations,
};

const FIXTURE_LEVEL: LevelDef = { terrain: [['empty']], width: 1, height: 1 };

const fixture: EnemyType<FixtureState> = {
  key: FIXTURE_KEY,
  maxHitPoints: 1,
  hitReactionSeconds: ENEMY_HIT_REACTION_SECONDS,
  movement: chaseMovement<FixtureState>({
    speed: 90,
    detectRange: 200,
    activeAnimState: 'chase',
    idleAnimState: 'idle',
  }),
  defaultAnimState: 'idle',
  hitboxPaddingNative: { side: 0, top: 0, bottom: 0 },
  sprite: FIXTURE_SPRITE,
  heldItem: null,
  create: (placement, index) => ({
    ...baseEnemyState(placement, index, FIXTURE_BASE_CONFIG),
    type: FIXTURE_KEY as EnemyTypeKey,
    ticks: 0,
  }),
  revive: (enemy) => ({
    ...baseRevive(enemy, FIXTURE_BASE_CONFIG),
    type: FIXTURE_KEY as EnemyTypeKey,
    ticks: 0,
  }),
  box: (enemy) => ({ x: enemy.x, y: enemy.y, width: 32, height: 32 }),
  draw: (enemy, dc) => drawSpriteSheetEntity(enemy, dc, FIXTURE_SPRITE, 'idle'),
  onPlayerCollide: () => ({}),
  onTick: (enemy, dt) => ({ ...enemy, ticks: enemy.ticks + dt }),
};

/** Registers the fixture in the live registry for the duration of `run`, so
 *  the shared `typeOf`-based dispatch can find it, then removes it — the
 *  fixture is never part of `ENEMY_TYPES` outside this test. */
function withRegisteredFixture<T>(run: () => T): T {
  const registry = ENEMY_TYPES as unknown as Record<string, EnemyType<BaseEnemyState>>;
  registry[FIXTURE_KEY] = fixture as unknown as EnemyType<BaseEnemyState>;
  try {
    return run();
  } finally {
    delete registry[FIXTURE_KEY];
  }
}

describe('movement seam — registry contract (SC-006 / FR-017)', () => {
  it('everyRegisteredKind-declaresACallableMovementAndARestingStateInItsOwnTable', () => {
    for (const type of Object.values(ENEMY_TYPES)) {
      expect(typeof type.movement.step).toBe('function');
      expect(type.sprite.animations[type.defaultAnimState]).toBeDefined();
    }
  });
});

describe('movement seam — fixture kind end-to-end (SC-005 / FR-018)', () => {
  it('aFixtureKind-withItsOwnMovementAndAnimation-worksThroughTheSharedPipeline', () => {
    withRegisteredFixture(() => {
      const placement: EnemyPlacement = {
        id: 'fixture',
        type: FIXTURE_KEY as EnemyTypeKey,
        x: 100,
        y: 100,
      };
      const enemy = fixture.create(placement, 0);
      const player = { x: enemy.x + 60, y: enemy.y, width: 32, height: 32 };
      const movementCtx = { level: FIXTURE_LEVEL, blockedTiles: [], player, elapsed: 0 };

      // 1. its own movement rule (chase), not the shared patrol
      const moved = fixture.movement.step(enemy, movementCtx, 1 / 30);
      expect(moved.x).toBeGreaterThan(enemy.x);
      expect(moved.direction).toBe('right');
      expect(moved.animState).toBe('chase');

      // 2. its own onTick
      const ticked = fixture.onTick!(moved, 1 / 30);
      expect(ticked.ticks).toBeCloseTo(1 / 30);

      // 3. the shared animation advance dispatches through the registry
      const animated = advanceEnemyAnimation(ticked as unknown as EnemyState, 0.2);
      expect(animated.animFrame).toBe(1);
      expect(typeOf(ticked as unknown as EnemyState).key).toBe(FIXTURE_KEY);

      // 4. its own draw resolves frames from its own table
      const drawn: { sx: number; sy: number }[] = [];
      const drawCtx = {
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
        ctx: drawCtx,
        sprites: { [SLIME_GREEN_SHEET.src]: {} as HTMLImageElement },
        originX: 0,
        originY: 0,
        worldElapsed: 0,
      } as unknown as DrawContext;

      fixture.draw(animated as unknown as FixtureState, dc);

      const expected = frameSource(
        SLIME_GREEN_SHEET,
        enemyFrameIndex(FIXTURE_SPRITE, animated.animState, animated.animFrame, 'idle'),
      );
      expect(drawn).toEqual([expected]);
    });
  });
});

describe('movement seam — missing-state fallback (FR-009)', () => {
  it('aFixtureMissingTheRequestedState-resolvesToItsDefaultStateWithoutThrowing', () => {
    expect(resolveAnimation(FIXTURE_SPRITE, 'hit', 'idle')).toEqual(FIXTURE_SPRITE.animations.idle);
    expect(enemyFrameIndex(FIXTURE_SPRITE, 'hit', 0, 'idle')).toBe(0);
  });
});
