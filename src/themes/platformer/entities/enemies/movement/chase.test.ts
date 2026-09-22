import { chaseMovement } from './chase';
import type { MovementContext } from './MovementStrategy';
import { ENEMY_TYPES } from '../index';
import type { EnemyState } from '../../Enemy';
import { RENDERED_TILE_SIZE } from '../../../level/Terrain';
import type { LevelDef } from '../../../level/LevelData';
import type { EnemyPlacement } from '../../../level/EnemyMapper';

const LEVEL: LevelDef = { terrain: [['empty']], width: 1, height: 1 };
const SPEED = 90;
const DETECT_RANGE = 120;

const chase = chaseMovement<EnemyState>({
  speed: SPEED,
  detectRange: DETECT_RANGE,
  activeAnimState: 'chase',
  idleAnimState: 'idle',
});

function makeEnemy(x = 100, y = 100): EnemyState {
  const placement: EnemyPlacement = { id: 'e1', type: 'slimeGreen', x, y };
  return ENEMY_TYPES.slimeGreen.create(placement, 0);
}

function ctxWithPlayer(player: MovementContext['player']): MovementContext {
  return { level: LEVEL, blockedTiles: [], player, elapsed: 0 };
}

function distanceToPlayer(enemy: EnemyState, player: NonNullable<MovementContext['player']>): number {
  return Math.hypot(
    player.x + player.width / 2 - (enemy.x + RENDERED_TILE_SIZE / 2),
    player.y + player.height / 2 - (enemy.y + RENDERED_TILE_SIZE / 2),
  );
}

const DT = 1 / 30;

describe('chaseMovement', () => {
  it('noPlayer-isIdleAndKeepsDirection', () => {
    const enemy = { ...makeEnemy(), direction: 'right' as const };
    const next = chase.step(enemy, ctxWithPlayer(null), DT);
    expect(next.vx).toBe(0);
    expect(next.vy).toBe(0);
    expect(next.animState).toBe('idle');
    expect(next.direction).toBe('right');
    expect(next.x).toBe(enemy.x);
    expect(next.y).toBe(enemy.y);
  });

  it('playerOutOfDetectRange-isIdle', () => {
    const enemy = makeEnemy();
    const player = { x: enemy.x + DETECT_RANGE + 200, y: enemy.y, width: 32, height: 32 };
    const next = chase.step(enemy, ctxWithPlayer(player), DT);
    expect(next.vx).toBe(0);
    expect(next.vy).toBe(0);
    expect(next.animState).toBe('idle');
  });

  it('playerInRange-closesDistanceByAtMostSpeedTimesDtAndFacesThePlayer', () => {
    const enemy = { ...makeEnemy(), direction: 'left' as const };
    // Player up and to the right of the enemy.
    const player = { x: enemy.x + 80, y: enemy.y - 40, width: 32, height: 32 };

    const before = distanceToPlayer(enemy, player);
    const next = chase.step(enemy, ctxWithPlayer(player), DT);
    const after = distanceToPlayer(next, player);

    expect(before - after).toBeGreaterThan(0);
    expect(before - after).toBeLessThanOrEqual(SPEED * DT + 1e-9);
    expect(next.direction).toBe('right');
    expect(next.animState).toBe('chase');
  });

  it('playerToTheLeft-facesLeft', () => {
    const enemy = { ...makeEnemy(), direction: 'right' as const };
    const player = { x: enemy.x - 80, y: enemy.y, width: 32, height: 32 };
    const next = chase.step(enemy, ctxWithPlayer(player), DT);
    expect(next.direction).toBe('left');
  });

  it('isDeterministicAndNonMutating', () => {
    const enemy = { ...makeEnemy(), direction: 'left' as const };
    const player = { x: enemy.x + 60, y: enemy.y + 20, width: 32, height: 32 };
    const enemySnapshot = { ...enemy };
    const ctx = ctxWithPlayer(player);

    const first = chase.step(enemy, ctx, DT);
    const second = chase.step(enemy, ctx, DT);

    expect(first).toEqual(second);
    expect(enemy).toEqual(enemySnapshot);
  });

  it('dtZeroOrNegative-isANoOp', () => {
    const enemy = makeEnemy();
    const player = { x: enemy.x + 10, y: enemy.y, width: 32, height: 32 };
    expect(chase.step(enemy, ctxWithPlayer(player), 0)).toBe(enemy);
    expect(chase.step(enemy, ctxWithPlayer(player), -1)).toBe(enemy);
  });
});
