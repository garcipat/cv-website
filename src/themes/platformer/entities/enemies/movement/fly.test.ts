import { flyMovement } from './fly';
import { bee } from '../Bee';
import type { BeeState } from '../Bee';
import { BEE_SHEET } from '../../sprites/sheets';
import type { SpriteDescriptor } from '../../sprites/SpriteSheet';
import type { LevelDef, MarkerEntry, TileType } from '../../../level/LevelData';
import type { EnemyPlacement } from '../../../level/EnemyMapper';
import { RENDERED_TILE_SIZE } from '../../../level/Terrain';

/**
 * The bee's flight contract (FR-004/FR-005/FR-006, SC-002/SC-003): horizontal
 * patrol with NO ledge check, a bounded periodic bob around the placement
 * row, and `dt <= 0` a no-op.
 */

const SPEED = 70;
const AMPLITUDE = 6;
const PERIOD = 1.4;

const BEE_SPRITE: SpriteDescriptor = {
  sheet: BEE_SHEET,
  renderScale: 1,
  animations: { fly: { frames: [32, 33, 34, 35, 36, 37, 38, 39], frameDuration: 0.12 } },
};
const PADDING = { side: 3, top: 7, bottom: 5 };

const fly = flyMovement<BeeState>({
  speed: SPEED,
  bobAmplitude: AMPLITUDE,
  bobPeriod: PERIOD,
  sprite: BEE_SPRITE,
  hitboxPaddingNative: PADDING,
});

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

function makeBeeAt(col: number): BeeState {
  const placement: EnemyPlacement = {
    id: 'enemy-bee-x',
    type: 'bee',
    x: col * RENDERED_TILE_SIZE,
    y: 0,
  };
  return bee.create(placement, 0);
}

function step(
  enemy: BeeState,
  level: LevelDef,
  dt: number,
  elapsed = 0,
  blockedTiles: readonly { col: number; row: number }[] = [],
): BeeState {
  return fly.step(enemy, { level, blockedTiles, player: null, elapsed }, dt);
}

describe('flyMovement — horizontal', () => {
  it('openGroundMovingRight-advancesXBySpeedTimesDt', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeBeeAt(5), direction: 'right' as const };

    const next = step(enemy, level, 1 / 30);

    expect(next.x).toBeCloseTo(enemy.x + SPEED * (1 / 30));
    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
    expect(next.animState).toBe('fly');
  });

  it('openGroundMovingLeft-advancesXNegatively', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeBeeAt(5), direction: 'left' as const };

    const next = step(enemy, level, 1 / 30);

    expect(next.x).toBeCloseTo(enemy.x - SPEED * (1 / 30));
    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
  });

  it('aGapAhead-keepsMovingAcrossItInsteadOfReversingLikePatrol', () => {
    // SC-002: the same geometry a slime reverses at. Fly has no ledge check.
    const level = makeLevel(10, [], [7]);
    const enemy = { ...makeBeeAt(5), direction: 'right' as const };

    const next = step(enemy, level, 0.5);

    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
    expect(next.x).toBeCloseTo(enemy.x + SPEED * 0.5);
  });

  it('wallAheadMovingRight-reversesAndSnapsTheVisibleEdgeToTheWall', () => {
    const level = makeLevel(10, [7], []);
    const enemy = { ...makeBeeAt(5), direction: 'right' as const };

    const next = step(enemy, level, 0.5);

    expect(next.direction).toBe('left');
    expect(next.vx).toBe(-SPEED);
    // leadingCol(7)*32 - offsetX(-8) - size(48) + sidePadding(6) = 224+8-48+6
    expect(next.x).toBe(190);
  });

  it('wallAheadMovingLeft-reversesAndSnapsTheVisibleEdgeToTheWall', () => {
    const level = makeLevel(10, [3], []);
    const enemy = { ...makeBeeAt(5), direction: 'left' as const };

    const next = step(enemy, level, 0.5);

    expect(next.direction).toBe('right');
    expect(next.vx).toBe(SPEED);
    // (leadingCol(3)+1)*32 - offsetX(-8) - sidePadding(6) = 128+8-6
    expect(next.x).toBe(130);
  });

  it('patrolTileAhead-reversesAndSnapsExactlyLikeAWall', () => {
    const level = makePatrolLevel(10, [7]);
    const enemy = { ...makeBeeAt(5), direction: 'right' as const };

    const next = step(enemy, level, 0.5);

    expect(next.direction).toBe('left');
    expect(next.x).toBe(190);
  });

  it('liveBlockedCellAhead-reversesLikeAWallTile', () => {
    const level = makeLevel(10, [], []);
    const enemy = { ...makeBeeAt(5), direction: 'right' as const };

    const next = step(enemy, level, 0.5, 0, [{ col: 7, row: 0 }]);

    expect(next.direction).toBe('left');
    expect(next.x).toBe(190);
  });

  it('laneNarrowerThanItsBodyOnBothSides-standsStillInsteadOfFlipFlopping', () => {
    const level = makeLevel(10, [4, 6], []);
    const enemy = { ...makeBeeAt(5), direction: 'right' as const };

    const first = step(enemy, level, 1 / 30);
    expect(first.vx).toBe(0);

    const second = step(first, level, 1 / 30);
    expect(second.vx).toBe(0);
    expect(second.x).toBe(first.x);
  });
});

describe('flyMovement — vertical bob', () => {
  it('elapsedZeroAndElapsedWholePeriod-bothSitExactlyOnHomeY', () => {
    const level = makeLevel(10, [], []);
    const enemy = makeBeeAt(5);

    expect(step(enemy, level, 1 / 60, 0).y).toBeCloseTo(enemy.homeY, 10);
    expect(step(enemy, level, 1 / 60, PERIOD).y).toBeCloseTo(enemy.homeY, 10);
  });

  it('overAFullPeriod-staysWithinAmplitudeAndPeaksExactlyAtAmplitudeAtQuarterPeriod', () => {
    const level = makeLevel(10, [], []);
    const enemy = makeBeeAt(5);

    let maxDeviation = 0;
    for (let i = 0; i <= 200; i++) {
      const elapsed = (i / 200) * PERIOD;
      const y = step(enemy, level, 1 / 60, elapsed).y;
      const deviation = Math.abs(y - enemy.homeY);
      expect(deviation).toBeLessThanOrEqual(AMPLITUDE + 1e-9);
      maxDeviation = Math.max(maxDeviation, deviation);
    }
    expect(maxDeviation).toBeCloseTo(AMPLITUDE, 6);
    expect(step(enemy, level, 1 / 60, PERIOD / 4).y).toBeCloseTo(enemy.homeY + AMPLITUDE, 6);
    expect(step(enemy, level, 1 / 60, (3 * PERIOD) / 4).y).toBeCloseTo(enemy.homeY - AMPLITUDE, 6);
  });

  it('vy-matchesTheAnalyticDerivativeOfTheBob', () => {
    const level = makeLevel(10, [], []);
    const enemy = makeBeeAt(5);
    const omega = (2 * Math.PI) / PERIOD;

    for (const elapsed of [0, PERIOD / 8, PERIOD / 4, PERIOD / 2]) {
      const expected = AMPLITUDE * omega * Math.cos(omega * elapsed);
      expect(step(enemy, level, 1 / 60, elapsed).vy).toBeCloseTo(expected, 6);
    }
  });
});

describe('flyMovement — purity', () => {
  it('dtZeroOrNegative-isANoOpAndReturnsTheSameReference', () => {
    const level = makeLevel(10, [], []);
    const enemy = makeBeeAt(5);
    expect(step(enemy, level, 0)).toBe(enemy);
    expect(step(enemy, level, -1)).toBe(enemy);
  });

  it('aPlayerInContext-isIgnored', () => {
    const level = makeLevel(10, [], []);
    const enemy = makeBeeAt(5);
    const ctx = {
      level,
      blockedTiles: [],
      player: { x: 0, y: 0, width: 64, height: 64 },
      elapsed: 0.3,
    };
    const withPlayer = fly.step(enemy, ctx, 1 / 30);
    const withoutPlayer = fly.step(
      enemy,
      { ...ctx, player: null },
      1 / 30,
    );
    expect(withPlayer).toEqual(withoutPlayer);
  });
});
