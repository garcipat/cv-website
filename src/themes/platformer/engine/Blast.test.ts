import { blastTiles, blocksInBlast, enemiesInBlast, playerInBlast } from './Blast';
import { toBlockState } from '../entities/Block';
import type { BlockState } from '../entities/Block';
import { toEnemyState } from '../entities/Enemy';
import { RENDERED_TILE_SIZE, tileToPixel } from '../level/Terrain';
import type { Box } from './Collision';

function blockAt(kind: string, col: number, row: number, id = `${kind}-${col}-${row}`): BlockState {
  const { x, y } = tileToPixel(col, row);
  return toBlockState({ id, blockKind: kind as BlockState['blockKind'], x, y });
}

function enemyAt(id: string, type: 'slimeGreen' | 'slimePurple', col: number, row: number) {
  const { x, y } = tileToPixel(col, row);
  return toEnemyState({ id, type, fact: undefined, x, y });
}

describe('blastTiles', () => {
  it('interiorCentre-returnsTheRoundedAreaWithCornersCut', () => {
    const tiles = blastTiles(5, 5, 10, 10);
    // 5x5 = 25 minus the four (±2,±2) corner tiles = 21.
    expect(tiles).toHaveLength(21);
    expect(tiles).toContainEqual({ col: 4, row: 4 });
    expect(tiles).toContainEqual({ col: 5, row: 5 });
    expect(tiles).toContainEqual({ col: 6, row: 6 });
    // The extreme corners are cut, so the area reads round...
    expect(tiles).not.toContainEqual({ col: 3, row: 3 });
    expect(tiles).not.toContainEqual({ col: 3, row: 7 });
    expect(tiles).not.toContainEqual({ col: 7, row: 3 });
    expect(tiles).not.toContainEqual({ col: 7, row: 7 });
    // ...but the tiles beside them stay.
    expect(tiles).toContainEqual({ col: 3, row: 4 });
    expect(tiles).toContainEqual({ col: 4, row: 3 });
  });

  it('cornerCentre-clipsToTheLevelBounds', () => {
    const tiles = blastTiles(0, 0, 10, 10);
    expect(tiles).toHaveLength(8);
    expect(tiles).toContainEqual({ col: 0, row: 0 });
    expect(tiles).toContainEqual({ col: 1, row: 1 });
    expect(tiles).not.toContainEqual({ col: 2, row: 2 }); // the cut corner
  });

  it('edgeCentre-clipsOnlyTheOutOfBoundsSide', () => {
    const tiles = blastTiles(0, 5, 10, 10);
    expect(tiles).toHaveLength(13);
  });

  it('anyCentre-alwaysReturnsDistinctInBoundsTiles', () => {
    for (const [col, row] of [
      [0, 0],
      [0, 5],
      [5, 0],
      [9, 9],
      [5, 5],
      [0, 9],
    ] as const) {
      const tiles = blastTiles(col, row, 10, 10);
      expect(tiles.length).toBeGreaterThanOrEqual(1);
      expect(tiles.length).toBeLessThanOrEqual(21);
      const keys = new Set(tiles.map((t) => `${t.col},${t.row}`));
      expect(keys.size).toBe(tiles.length);
      for (const tile of tiles) {
        expect(tile.col).toBeGreaterThanOrEqual(0);
        expect(tile.col).toBeLessThan(10);
        expect(tile.row).toBeGreaterThanOrEqual(0);
        expect(tile.row).toBeLessThan(10);
      }
    }
  });
});

describe('blocksInBlast', () => {
  const tiles = blastTiles(5, 5, 10, 10);

  it('liveDestructibleBlocksInTheArea-areIncluded', () => {
    const crate = blockAt('crate', 5, 5);
    const fragileRock = blockAt('fragileRock', 4, 5);
    const coinPot = blockAt('coinPot', 6, 5);
    expect(blocksInBlast([crate, fragileRock, coinPot], tiles).map((b) => b.id)).toEqual([
      crate.id,
      fragileRock.id,
      coinPot.id,
    ]);
  });

  it('aQuestionMarkInTheArea-isExcludedBecauseItNeverLeavesTheWorld', () => {
    const questionMark = blockAt('questionMark', 5, 5);
    expect(blocksInBlast([questionMark], tiles)).toEqual([]);
  });

  it('aUsedUpBlockInTheArea-isExcluded', () => {
    const usedUp = { ...blockAt('fragileRock', 5, 5), hitsTaken: 1 };
    expect(blocksInBlast([usedUp], tiles)).toEqual([]);
  });

  it('aBlockOutsideTheArea-isExcluded', () => {
    const crate = blockAt('crate', 9, 9);
    expect(blocksInBlast([crate], tiles)).toEqual([]);
  });

  it('called-neverMutatesItsInput', () => {
    const crate = blockAt('crate', 5, 5);
    const before = { ...crate };
    blocksInBlast([crate], tiles);
    expect(crate).toEqual(before);
  });
});

describe('enemiesInBlast', () => {
  const tiles = blastTiles(5, 5, 10, 10);

  it('anAliveEnemyOverlappingTheArea-isIncluded', () => {
    const enemy = enemyAt('e1', 'slimeGreen', 5, 5);
    expect(enemiesInBlast([enemy], tiles, RENDERED_TILE_SIZE).map((e) => e.id)).toEqual(['e1']);
  });

  it('aDeadEnemy-isExcluded', () => {
    const enemy = { ...enemyAt('e1', 'slimeGreen', 5, 5), alive: false };
    expect(enemiesInBlast([enemy], tiles, RENDERED_TILE_SIZE)).toEqual([]);
  });

  it('anEnemyEntirelyOutsideTheArea-isExcluded', () => {
    const enemy = enemyAt('e1', 'slimeGreen', 9, 9);
    expect(enemiesInBlast([enemy], tiles, RENDERED_TILE_SIZE)).toEqual([]);
  });
});

describe('playerInBlast', () => {
  const tiles = blastTiles(5, 5, 10, 10);

  it('aHitboxOverlappingAnyTile-returnsTrue', () => {
    const box: Box = { x: 5 * RENDERED_TILE_SIZE, y: 5 * RENDERED_TILE_SIZE, width: 20, height: 20 };
    expect(playerInBlast(box, tiles, RENDERED_TILE_SIZE)).toBe(true);
  });

  it('aHitboxEntirelyOutsideTheArea-returnsFalse', () => {
    const box: Box = { x: 0, y: 0, width: 10, height: 10 };
    expect(playerInBlast(box, tiles, RENDERED_TILE_SIZE)).toBe(false);
  });
});
