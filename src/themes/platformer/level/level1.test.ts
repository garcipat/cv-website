import {
  level1,
  SPAWN_TILE,
  ENEMY_TILES_GREEN,
  ENEMY_TILES_PURPLE,
  COIN_TILES,
  FRUIT_TILES,
} from './level1';
import { isTopExposed, isSolid, tileAt } from './Terrain';

/** Every hand-placed marker must sit on an empty tile directly above a solid
 *  one — the same "standable" shape a level author expects any marker to
 *  have, regardless of type. */
function expectStandable(tile: { col: number; row: number }) {
  expect(tileAt(level1, tile.col, tile.row)).toBe('empty');
  expect(isSolid(tileAt(level1, tile.col, tile.row + 1))).toBe(true);
}

describe('level1', () => {
  it('dimensions-matchTerrainGridShape', () => {
    expect(level1.terrain).toHaveLength(level1.height);
    for (const row of level1.terrain) {
      expect(row).toHaveLength(level1.width);
    }
  });

  it('groundStrip-usesGrassBiomeOnLeftAndRockBiomeOnRight', () => {
    const lastRow = level1.terrain[level1.height - 1];
    expect(lastRow[0]).toBe('groundGrass');
    expect(lastRow[11]).toBe('groundGrass');
    expect(lastRow[12]).toBe('groundRock');
    expect(lastRow[19]).toBe('groundRock');
  });

  it('pit-atColumns2Through4-hasNoFloorAtBottomRow', () => {
    // Deliberately a genuine bottomless drop (roadmap step 9): walking off
    // the bridge's edge, or dropping through it on purpose (Down/S), both
    // must trigger real pit-fall damage — a floor here would silently negate
    // that.
    expect(level1.terrain[level1.height - 1][2]).toBe('empty');
    expect(level1.terrain[level1.height - 1][3]).toBe('empty');
    expect(level1.terrain[level1.height - 1][4]).toBe('empty');
  });

  it('bridge-spansThePitAtRowAboveBottomRow', () => {
    expect(level1.terrain[level1.height - 2][2]).toBe('bridge');
    expect(level1.terrain[level1.height - 2][3]).toBe('bridge');
    expect(level1.terrain[level1.height - 2][4]).toBe('bridge');
  });

  it('containsAtLeastOnePlatformTile', () => {
    const hasPlatform = level1.terrain.some((row) => row.includes('platform'));
    expect(hasPlatform).toBe(true);
  });

  it('groundStrip-rockZoneContinuesFlatToLevelEnd', () => {
    const lastRow = level1.terrain[level1.height - 1];
    expect(level1.width).toBe(80);
    expect(lastRow[79]).toBe('groundRock');
  });

  it('greenEnemyWallPocket-boundsTheGreenEnemyMarkerAtTheEnemysOwnRow', () => {
    // Two wall tiles (cols 26/31) flank the green enemy marker (col 28) —
    // deliberately at the marker's own row, not the ground row below, since
    // EnemyAI.ts's stepEnemyPatrol tests the tile at the enemy's row, not the
    // ground it stands on. Both walls: the "bounded by two walls" patrol case.
    expect(ENEMY_TILES_GREEN).toHaveLength(1);
    const [green] = ENEMY_TILES_GREEN;
    expect(level1.terrain[green.row][26]).toBe('wall');
    expect(level1.terrain[green.row][31]).toBe('wall');
    expect(green.col).toBeGreaterThan(26);
    expect(green.col).toBeLessThan(31);
  });

  it('purpleEnemyWallPitSandwich-hasAWallOnOneSideAndARealPitOnTheOther', () => {
    // The user-requested "wall, enemy, pit" case: a wall (col 36) on one
    // side, a genuine bottomless pit (cols 40-42, no bridge — unlike the
    // spawn pit's bridge) on the other, with the purple enemy marker (col 38)
    // between them. Exercises both stepEnemyPatrol's wall-reversal and its
    // ledge/pit-edge-reversal branch on a single enemy.
    expect(ENEMY_TILES_PURPLE).toHaveLength(1);
    const [purple] = ENEMY_TILES_PURPLE;
    expect(level1.terrain[purple.row][36]).toBe('wall');
    expect(purple.col).toBeGreaterThan(36);
    for (const col of [40, 41, 42]) {
      expect(level1.terrain[level1.height - 1][col]).toBe('empty');
      expect(level1.terrain[level1.height - 2][col]).toBe('empty');
    }
    expect(purple.col).toBeLessThan(40);
  });

  it('markers-eachStandsOnAnEmptyTileAboveSolidGround', () => {
    for (const tile of [...ENEMY_TILES_GREEN, ...ENEMY_TILES_PURPLE, ...COIN_TILES, ...FRUIT_TILES]) {
      expectStandable(tile);
    }
  });

  it('markerCounts-matchThisMechanicsTestLevelsIntentionalDesign', () => {
    // level1 deliberately covers only a slice of real CVData (see its doc
    // comment) — these counts are the level's own intentional design, not
    // derived from CVData length.
    expect(ENEMY_TILES_GREEN).toHaveLength(1);
    expect(ENEMY_TILES_PURPLE).toHaveLength(1);
    expect(COIN_TILES).toHaveLength(4);
    expect(FRUIT_TILES).toHaveLength(2);
  });

  it('elevatedBridge-spansGapBetweenTwoFloatingPlatformsAtPlatformRow', () => {
    const row = 0;
    expect(level1.terrain[row][8]).toBe('platform');
    expect(level1.terrain[row][9]).toBe('platform');
    expect(level1.terrain[row][10]).toBe('platform');
    expect(level1.terrain[row][11]).toBe('bridge');
    expect(level1.terrain[row][12]).toBe('bridge');
    expect(level1.terrain[row][13]).toBe('platform');
    expect(level1.terrain[row][14]).toBe('platform');
  });

  it('elevatedBridge-hasTwoRowsOfClearanceAboveReachableGroundBelow', () => {
    // Enough clearance (2 empty rows) to jump up into the bridge from the
    // ground below, and solid ground to land on after dropping through it.
    for (const col of [11, 12]) {
      expect(level1.terrain[1][col]).toBe('empty');
      expect(level1.terrain[2][col]).toBe('empty');
      expect(isSolid(level1.terrain[3][col])).toBe(true);
    }
  });

  it('spawnTile-isEmptySpaceAboveTopExposedGroundGrass', () => {
    const { col, row } = SPAWN_TILE;
    expect(level1.terrain[row][col]).toBe('empty');
    expect(level1.terrain[row + 1][col]).toBe('groundGrass');
    expect(isTopExposed(level1, col, row + 1)).toBe(true);
  });

  it('enemiesAndCollectibles-sitCloseToSpawnForEasyManualTesting', () => {
    // Roadmap step 17: both enemy markers used to sit ~45 tiles from spawn
    // (col 1); they must now be reachable within a short walk.
    for (const tile of [...ENEMY_TILES_GREEN, ...ENEMY_TILES_PURPLE]) {
      expect(tile.col - SPAWN_TILE.col).toBeLessThan(40);
    }
  });
});
