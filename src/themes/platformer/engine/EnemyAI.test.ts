import { stepEnemyPatrol } from './EnemyAI';
import { toEnemyState } from '../entities/Enemy';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { PHYSICS_CONFIG } from './PhysicsConfig';
import type { LevelDef, TileType } from '../level/LevelData';
import type { EnemyPlacement } from '../level/EnemyMapper';

/** Builds a one-row-tall-per-feature level: `groundRow` is solid everywhere
 *  except where noted, and `entityRow` (one tile above it) holds walls at the
 *  given columns and is otherwise empty — matching level1's real convention
 *  of placing enemies/walls on the row above the ground they patrol on. */
function makeLevel(width: number, wallCols: number[], pitCols: number[]): LevelDef {
  const entityRow: TileType[] = Array.from({ length: width }, (_, c) =>
    wallCols.includes(c) ? 'wall' : 'empty',
  );
  const groundRow: TileType[] = Array.from({ length: width }, (_, c) =>
    pitCols.includes(c) ? 'empty' : 'groundRock',
  );
  return { terrain: [entityRow, groundRow], width, height: 2 };
}

function makeEnemyAt(col: number) {
  const placement: EnemyPlacement = {
    id: 'enemy-cert-x',
    spriteType: 'slimeGreen',
    fact: {
      id: 'enemy-cert-x',
      sectionId: 'certificates',
      sectionLabel: 'Certificates',
      data: { name: 'X', issuer: 'Y', date: '2020-01' },
      sourceType: 'enemy',
    },
    x: col * RENDERED_TILE_SIZE,
    y: 0, // entity row is row 0 in makeLevel's grid
  };
  return toEnemyState(placement);
}

const SPEED = PHYSICS_CONFIG.enemyPatrolSpeed;
const DT = 1 / 30;

describe('stepEnemyPatrol', () => {
  it('openFloorMovingRight-advancesXBySpeedTimesDtAndKeepsDirection', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = stepEnemyPatrol(enemy, level, DT);

    expect(next.x).toBeCloseTo(enemy.x + SPEED * DT);
    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
  });

  it('openFloorMovingLeft-advancesXNegativelyAndKeepsDirection', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = stepEnemyPatrol(enemy, level, DT);

    expect(next.x).toBeCloseTo(enemy.x - SPEED * DT);
    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
  });

  it('wallAhead-movingRight-reversesAndClampsBeforeTheWall', () => {
    // Wall at col 7, enemy starting at col 5 moving right. dt=1s moves it
    // 60px (nextX=220) — far enough in one step that its leading edge lands
    // inside col 7 (wall), so the clamp/reversal is exercised deterministically
    // in a single call rather than relying on many small frames adding up.
    const level = makeLevel(10, [7], []);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = stepEnemyPatrol(enemy, level, 1);

    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
    expect(next.x).toBe(6 * RENDERED_TILE_SIZE);
  });

  it('wallAhead-movingLeft-reversesAndClampsBeforeTheWall', () => {
    // Wall at col 2, enemy starting at col 5 moving left. dt=1.1s moves it
    // 66px (nextX=94), landing the leading edge inside col 2 (wall).
    const level = makeLevel(10, [2], []);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = stepEnemyPatrol(enemy, level, 1.1);

    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
    expect(next.x).toBe(3 * RENDERED_TILE_SIZE);
  });

  it('pitAheadMovingRight-noSolidGroundBelow-reversesAtTheEdgeInsteadOfFalling', () => {
    // Ground missing at col 7 (a pit, no wall tile at all) — same nextX=220
    // as the wall test above, but blocked by the ledge check instead.
    const level = makeLevel(10, [], [7]);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = stepEnemyPatrol(enemy, level, 1);

    expect(next.direction).toBe('left');
    expect(next.x).toBe(6 * RENDERED_TILE_SIZE);
  });

  it('pitAheadMovingLeft-noSolidGroundBelow-reversesAtTheEdge', () => {
    const level = makeLevel(10, [], [2]);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = stepEnemyPatrol(enemy, level, 1.1);

    expect(next.direction).toBe('right');
    expect(next.x).toBe(3 * RENDERED_TILE_SIZE);
  });

  it('wallOnLeftAndPitOnRight-patrolsBackAndForthWithoutEscaping', () => {
    // The user-requested "wall - enemy - pit" sandwich: wall at col 3, pit at
    // col 7, enemy starts at col 5 patrolling cols 4-6.
    const level = makeLevel(10, [3], [7]);
    let enemy = { ...makeEnemyAt(5), direction: 'right' as const };
    const minX = 4 * RENDERED_TILE_SIZE;
    const maxX = 6 * RENDERED_TILE_SIZE;

    for (let i = 0; i < 200; i++) {
      enemy = stepEnemyPatrol(enemy, level, DT);
      expect(enemy.x).toBeGreaterThanOrEqual(minX);
      expect(enemy.x).toBeLessThanOrEqual(maxX);
    }
  });
});
