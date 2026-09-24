import { patrolMovement } from './patrol';
import type { MovementStrategy } from './MovementStrategy';
import { ENEMY_TYPES } from '../index';
import type { EnemyState } from '../../Enemy';
import { RENDERED_TILE_SIZE } from '../../../level/Terrain';
import { PHYSICS_CONFIG } from '../../../contracts/PhysicsConfig';
import type { LevelDef, MarkerEntry, TileType } from '../../../level/LevelData';
import type { EnemyPlacement } from '../../../level/EnemyMapper';

/**
 * The parity proof for SC-001: every case the pre-seam
 * `engine/EnemyAI.test.ts` pinned, exercised against `patrolMovement`
 * directly with identical reference values. The slimes' declarations wire
 * this same strategy, so these assertions and the unedited
 * `EnemyAI.test.ts` characterize the same behavior from both sides.
 */

function makeLevel(width: number, wallCols: number[], pitCols: number[]): LevelDef {
  const entityRow: TileType[] = Array.from({ length: width }, (_, c) =>
    wallCols.includes(c) ? 'wall' : 'empty',
  );
  const groundRow: TileType[] = Array.from({ length: width }, (_, c) =>
    pitCols.includes(c) ? 'empty' : 'groundRock',
  );
  return { terrain: [entityRow, groundRow], width, height: 2 };
}

function makePatrolLevel(width: number, patrolCols: number[]): LevelDef {
  const entityRow: TileType[] = Array.from({ length: width }, () => 'empty');
  const groundRow: TileType[] = Array.from({ length: width }, () => 'groundRock');
  const markers: (MarkerEntry | null)[][] = Array.from({ length: 2 }, () =>
    new Array<MarkerEntry | null>(width).fill(null),
  );
  for (const col of patrolCols) markers[0][col] = { kind: 'patrolBoundary' };
  return { terrain: [entityRow, groundRow], width, height: 2, markers };
}

function makeEntityFeatureLevel(width: number, featureCol: number, feature: TileType): LevelDef {
  const entityRow: TileType[] = Array.from({ length: width }, (_, c) =>
    c === featureCol ? feature : 'empty',
  );
  const groundRow: TileType[] = Array.from({ length: width }, () => 'groundRock');
  return { terrain: [entityRow, groundRow], width, height: 2 };
}

function makeGroundFeatureLevel(width: number, gapCol: number, gapTile: TileType): LevelDef {
  const entityRow: TileType[] = Array.from({ length: width }, () => 'empty');
  const groundRow: TileType[] = Array.from({ length: width }, (_, c) =>
    c === gapCol ? gapTile : 'groundRock',
  );
  return { terrain: [entityRow, groundRow], width, height: 2 };
}

const GREEN_MOVEMENT = patrolMovement<EnemyState>({
  speedMultiplier: 1,
  sprite: ENEMY_TYPES.slimeGreen.sprite,
  hitboxPaddingNative: ENEMY_TYPES.slimeGreen.hitboxPaddingNative,
  animState: 'walk',
});

const PURPLE_MOVEMENT = patrolMovement<EnemyState>({
  speedMultiplier: 0.7,
  sprite: ENEMY_TYPES.slimePurple.sprite,
  hitboxPaddingNative: ENEMY_TYPES.slimePurple.hitboxPaddingNative,
  animState: 'walk',
});

function makeEnemyAt(col: number): EnemyState {
  const placement: EnemyPlacement = {
    id: 'enemy-cert-x',
    type: 'slimeGreen',
    fact: {
      id: 'enemy-cert-x',
      sectionId: 'certificates',
      sectionLabel: 'Certificates',
      data: { name: 'X', issuer: 'Y', date: '2020-01' },
      sourceType: 'enemy',
    },
    x: col * RENDERED_TILE_SIZE,
    y: 0,
  };
  return ENEMY_TYPES.slimeGreen.create(placement, 0);
}

function step(
  movement: MovementStrategy<EnemyState>,
  enemy: EnemyState,
  level: LevelDef,
  dt: number,
  blockedTiles: readonly { col: number; row: number }[] = [],
): EnemyState {
  return movement.step(enemy, { level, blockedTiles, player: null, elapsed: 0 }, dt);
}

const SPEED = PHYSICS_CONFIG.enemyPatrolSpeed;
const DT = 1 / 30;

describe('patrolMovement', () => {
  it('openFloorMovingRight-advancesXBySpeedTimesDtAndKeepsDirection', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, DT);

    expect(next.x).toBeCloseTo(enemy.x + SPEED * DT);
    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
    expect(next.animState).toBe('walk');
  });

  it('openFloorMovingLeft-advancesXNegativelyAndKeepsDirection', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, DT);

    expect(next.x).toBeCloseTo(enemy.x - SPEED * DT);
    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
  });

  it('wallAhead-movingRight-reversesAndClampsBeforeTheWall', () => {
    const level = makeLevel(10, [7], []);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1);

    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
    expect(next.x).toBe(194);
  });

  it('wallAhead-movingLeft-reversesAndClampsBeforeTheWall', () => {
    const level = makeLevel(10, [3], []);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1.1);

    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
    expect(next.x).toBe(126);
  });

  it('pitAheadMovingRight-noSolidGroundBelow-reversesAtTheEdgeInsteadOfFalling', () => {
    const level = makeLevel(10, [], [7]);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1);

    expect(next.direction).toBe('left');
    expect(next.x).toBe(194);
  });

  it('pitAheadMovingLeft-noSolidGroundBelow-reversesAtTheEdge', () => {
    const level = makeLevel(10, [], [3]);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1.1);

    expect(next.direction).toBe('right');
    expect(next.x).toBe(126);
  });

  it('patrolTileAhead-movingRight-reversesAndClampsExactlyLikeAWall', () => {
    const level = makePatrolLevel(10, [7]);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1);

    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
    expect(next.x).toBe(194);
  });

  it('patrolTileAhead-movingLeft-reversesAndClampsExactlyLikeAWall', () => {
    const level = makePatrolLevel(10, [3]);
    const enemy = { ...makeEnemyAt(5), direction: 'left' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1.1);

    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
    expect(next.x).toBe(126);
  });

  it('patrolTilesOnBothSides-keepsTheEnemyInsideThePocket', () => {
    const level = makePatrolLevel(10, [3, 7]);
    let enemy: EnemyState = { ...makeEnemyAt(5), direction: 'right' };

    for (let i = 0; i < 200; i++) {
      enemy = step(GREEN_MOVEMENT, enemy, level, DT);
      expect(enemy.x).toBeGreaterThanOrEqual(126);
      expect(enemy.x).toBeLessThanOrEqual(194);
    }
  });

  it('patrolTileOnADifferentRow-doesNotTurnTheEnemyAround', () => {
    const width = 10;
    const skyRow: TileType[] = Array.from({ length: width }, () => 'empty');
    const entityRow: TileType[] = Array.from({ length: width }, () => 'empty');
    const groundRow: TileType[] = Array.from({ length: width }, () => 'groundRock');
    const markers: (MarkerEntry | null)[][] = Array.from({ length: 3 }, () =>
      new Array<MarkerEntry | null>(width).fill(null),
    );
    markers[0][7] = { kind: 'patrolBoundary' };
    const level: LevelDef = { terrain: [skyRow, entityRow, groundRow], width, height: 3, markers };
    const enemy = {
      ...makeEnemyAt(5),
      y: RENDERED_TILE_SIZE,
      direction: 'right' as const,
    };

    const next = step(GREEN_MOVEMENT, enemy, level, 1);

    expect(next.direction).toBe('right');
    expect(next.x).toBe(enemy.x + SPEED);
  });

  it('patrolTileUnderfoot-isNotGroundSoTheEnemyTurnsAtItLikeAPit', () => {
    const width = 10;
    const entityRow: TileType[] = Array.from({ length: width }, () => 'empty');
    const groundRow: TileType[] = Array.from({ length: width }, (_, c) =>
      c === 7 ? 'empty' : 'groundRock',
    );
    const markers: (MarkerEntry | null)[][] = Array.from({ length: 2 }, () =>
      new Array<MarkerEntry | null>(width).fill(null),
    );
    markers[1][7] = { kind: 'patrolBoundary' };
    const level: LevelDef = { terrain: [entityRow, groundRow], width, height: 2, markers };
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1);

    expect(next.direction).toBe('left');
    expect(next.x).toBe(194);
  });

  it('wallOnLeftAndPitOnRight-patrolsBackAndForthWithoutEscaping', () => {
    const level = makeLevel(10, [3], [7]);
    let enemy: EnemyState = { ...makeEnemyAt(5), direction: 'right' };

    for (let i = 0; i < 200; i++) {
      enemy = step(GREEN_MOVEMENT, enemy, level, DT);
      expect(enemy.x).toBeGreaterThanOrEqual(126);
      expect(enemy.x).toBeLessThanOrEqual(194);
    }
  });

  it('pitAheadMovingRight-liveBlockFillsTheGap-continuesWalkingOntoIt', () => {
    const level = makeLevel(10, [], [7]);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1, [{ col: 7, row: 1 }]);

    expect(next.direction).toBe('right');
    expect(next.x).toBeCloseTo(enemy.x + SPEED * 1);
  });

  it('blockDirectlyAhead-atEnemyRow-reversesLikeAWallTile', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1, [{ col: 7, row: 0 }]);

    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
    expect(next.x).toBe(194);
  });

  it('pitAheadMovingRight-blockedTilesDoNotCoverTheGap-stillReverses', () => {
    const level = makeLevel(10, [], [7]);
    const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

    const next = step(GREEN_MOVEMENT, enemy, level, 1, [{ col: 2, row: 1 }]);

    expect(next.direction).toBe('left');
    expect(next.x).toBe(194);
  });

  it('slimePurple-laneNarrowerThanItsOwnOverhangOnBothSides-standsStillInsteadOfFlipFlopping', () => {
    const level = makeLevel(10, [4], [6]);
    const enemy: EnemyState = {
      ...ENEMY_TYPES.slimePurple.create(
        { id: 'e1', type: 'slimePurple', x: 5 * RENDERED_TILE_SIZE, y: 0 },
        0,
      ),
      direction: 'right',
    };

    const first = step(PURPLE_MOVEMENT, enemy, level, DT);
    expect(first.vx).toBe(0);

    const second = step(PURPLE_MOVEMENT, first, level, DT);
    expect(second.vx).toBe(0);
    expect(second.x).toBe(first.x);
  });

  it('slimePurple-wallAtHeadHeightOnly-reversesInsteadOfWalkingThroughIt', () => {
    const width = 10;
    const aboveRow: TileType[] = Array.from({ length: width }, (_, c) => (c === 7 ? 'wall' : 'empty'));
    const entityRow: TileType[] = Array.from({ length: width }, () => 'empty');
    const groundRow: TileType[] = Array.from({ length: width }, () => 'groundRock');
    const level: LevelDef = { terrain: [aboveRow, entityRow, groundRow], width, height: 3 };
    const enemy: EnemyState = {
      ...ENEMY_TYPES.slimePurple.create(
        { id: 'e1', type: 'slimePurple', x: 5 * RENDERED_TILE_SIZE, y: RENDERED_TILE_SIZE },
        0,
      ),
      direction: 'right',
    };

    const next = step(PURPLE_MOVEMENT, enemy, level, 1);

    expect(next.direction).toBe('left');
    expect(next.vx).toBeLessThan(0);
  });

  it('slimePurple-wallAtFootHeightOnly-stillReverses', () => {
    const level = makeLevel(10, [7], []);
    const enemy: EnemyState = {
      ...ENEMY_TYPES.slimePurple.create(
        { id: 'e1', type: 'slimePurple', x: 5 * RENDERED_TILE_SIZE, y: 0 },
        0,
      ),
      direction: 'right',
    };

    const next = step(PURPLE_MOVEMENT, enemy, level, 1);

    expect(next.direction).toBe('left');
    expect(next.vx).toBeLessThan(0);
  });

  it('slimePurple-movesSlowerThanGreen', () => {
    const level = makeLevel(10, [], []);
    const green = { ...makeEnemyAt(3), direction: 'right' as const };
    const purple: EnemyState = {
      ...ENEMY_TYPES.slimePurple.create(
        { id: 'e1', type: 'slimePurple', x: 3 * RENDERED_TILE_SIZE, y: 0 },
        0,
      ),
      direction: 'right',
    };
    const greenDelta = step(GREEN_MOVEMENT, green, level, 1).x - green.x;
    const purpleDelta = step(PURPLE_MOVEMENT, purple, level, 1).x - purple.x;
    expect(purpleDelta).toBeCloseTo(greenDelta * 0.7, 5);
  });

  it('dtZero-isANoOp-returnsTheSameReference', () => {
    const level = makeLevel(10, [], []);
    const enemy = makeEnemyAt(5);
    expect(step(GREEN_MOVEMENT, enemy, level, 0)).toBe(enemy);
  });

  describe('mushrooms are non-solid (FR-014)', () => {
    const MUSHROOM_TILES: readonly TileType[] = ['bouncyMushroom', 'decorativeMushroom'];

    it.each(MUSHROOM_TILES)(
      '%s-inTheEnemysPath-movingRight-neverReversesAsIfItWereAWall',
      (tile) => {
        const level = makeEntityFeatureLevel(10, 7, tile);
        const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

        const next = step(GREEN_MOVEMENT, enemy, level, 1);

        expect(next.direction).toBe('right');
        expect(next.vx).toBe(SPEED);
        expect(next.x).toBeGreaterThan(enemy.x);
      },
    );

    it.each(MUSHROOM_TILES)(
      '%s-asTheOnlyGroundBelow-movingRight-reversesAtTheLedgeLikeAPit',
      (tile) => {
        const overMushroom = makeGroundFeatureLevel(10, 7, tile);
        const overPit = makeGroundFeatureLevel(10, 7, 'empty');
        const enemy = { ...makeEnemyAt(5), direction: 'right' as const };

        const nextOverMushroom = step(GREEN_MOVEMENT, enemy, overMushroom, 1);
        const nextOverPit = step(GREEN_MOVEMENT, enemy, overPit, 1);

        expect(nextOverMushroom.direction).toBe('left');
        expect(nextOverMushroom.direction).toBe(nextOverPit.direction);
        expect(nextOverMushroom.x).toBeCloseTo(nextOverPit.x);
      },
    );
  });
});
