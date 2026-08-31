import {
  level1,
  SPAWN_TILE,
  ENEMY_TILES_GREEN,
  ENEMY_TILES_PURPLE,
  COIN_TILES,
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  CHEST_TILES,
} from './level1';
import { isTopExposed, isSolid, isClimbable, tileAt } from './Terrain';

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
    for (const tile of [...ENEMY_TILES_GREEN, ...ENEMY_TILES_PURPLE, ...COIN_TILES]) {
      expectStandable(tile);
    }
  });

  it('markerCounts-matchThisMechanicsTestLevelsIntentionalDesign', () => {
    // level1 deliberately covers only a slice of real CVData (see its doc
    // comment) — these counts are the level's own intentional design, not
    // derived from CVData length. The Language-fruit marker concept was
    // removed 2026-08-30 (live user feedback) — question-mark blocks spawn
    // their own bonus fruit instead.
    expect(ENEMY_TILES_GREEN).toHaveLength(1);
    expect(ENEMY_TILES_PURPLE).toHaveLength(1);
    expect(COIN_TILES).toHaveLength(4);
    expect(CRATE_TILES).toHaveLength(2);
    expect(QUESTIONMARK_TILES).toHaveLength(2);
    expect(FRAGILE_ROCK_TILES).toHaveLength(2);
  });

  it('newBlockMarkers-sitElevatedAboveGroundCloseToSpawn', () => {
    // Elevated to row 0 (2 empty rows of clearance above solid ground,
    // same shape as the existing floating platform at cols 8-14) and moved
    // to cols 19-24 — right after the second coin (col 18), well before
    // the wall/enemy/pit gauntlet at cols 26-42, instead of the 51-tiles-
    // from-spawn cluster at cols 47-52.
    const blockRow = 18;
    expect(CRATE_TILES.map((t) => t.col)).toEqual([19, 22]);
    expect(QUESTIONMARK_TILES.map((t) => t.col)).toEqual([20, 23]);
    expect(FRAGILE_ROCK_TILES.map((t) => t.col)).toEqual([21, 24]);
    for (const tile of [...CRATE_TILES, ...QUESTIONMARK_TILES, ...FRAGILE_ROCK_TILES]) {
      expect(tile.row).toBe(blockRow);
    }
  });

  it('newBlockMarkers-haveTwoRowsOfClearanceAboveReachableGroundBelow', () => {
    // Same clearance shape as the elevatedBridge tests above: 2 empty rows
    // between the elevated block row and solid ground, so the player can
    // jump up into a block from below.
    for (const col of [19, 20, 21, 22, 23, 24]) {
      expect(level1.terrain[19][col]).toBe('empty');
      expect(level1.terrain[20][col]).toBe('empty');
      expect(isSolid(level1.terrain[21][col])).toBe(true);
    }
  });

  it('secondCoin-sitsSoonAfterSpawnNotOnlyPastThePit', () => {
    // Previously only the col 10 coin was reachable without a long walk —
    // relocated one of the four coins to col 18 (just past the wall
    // pocket) so there's a second nearby one too.
    expect(COIN_TILES.map((t) => t.col)).toContain(18);
  });

  it('blockMarkers-sitOnEmptyTileTwoRowsAboveSolidGround', () => {
    for (const tile of [...CRATE_TILES, ...QUESTIONMARK_TILES, ...FRAGILE_ROCK_TILES]) {
      expect(level1.terrain[tile.row][tile.col]).toBe('empty');
      expect(isSolid(level1.terrain[tile.row + 3][tile.col])).toBe(true);
    }
  });

  it('elevatedBridge-spansGapBetweenTwoFloatingPlatformsAtPlatformRow', () => {
    const row = 18;
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
      expect(level1.terrain[19][col]).toBe('empty');
      expect(level1.terrain[20][col]).toBe('empty');
      expect(isSolid(level1.terrain[21][col])).toBe(true);
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

describe('CHEST_TILES', () => {
  it('level1Layout-has-twoChestMarkers', () => {
    expect(CHEST_TILES).toHaveLength(2);
  });
});

describe('ladder shaft (roadmap step 23)', () => {
  it('ladderTopTile-sitsBesideTheLandingPlatformNotAboveIt', () => {
    expect(level1.terrain[0][14]).toBe('platform');
    expect(level1.terrain[0][15]).toBe('ladder');
  });

  it('shaftIsLadderAtCol15-nineteenTilesTall-flushWithBothPlatformRows', () => {
    for (let row = 0; row <= 18; row++) {
      expect(level1.terrain[row][15]).toBe('ladder');
      expect(isClimbable(level1.terrain[row][15])).toBe(true);
    }
  });

  it('ladderBottomTile-sitsBesideTheExistingFloatingPlatformNotBelowIt', () => {
    // Row 18 is the pre-existing floating platform. The ladder's bottom
    // tile is now IN row 18 too (col 15, one column right of the
    // platform's rightmost tile at col 14) — same row, adjacent column —
    // so standing on the platform and walking one tile right puts the
    // player's feet directly on a ladder tile without needing to jump
    // (roadmap step 23 follow-up: the ladder previously sat one row ABOVE
    // the platform at the same column, which blocked climb-entry from
    // standing height).
    expect(level1.terrain[18][14]).toBe('platform');
    expect(level1.terrain[18][15]).toBe('ladder');
  });

  it('levelIsTallEnoughToExceedATypicalDesktopViewport', () => {
    // 23 rows * 32px/tile = 736px — taller than most real browser viewports
    // once browser chrome is accounted for; if it isn't on a very large
    // monitor, shrinking the browser window height confirms the same
    // scrolling logic (proven independently by Camera.test.ts's
    // updateCameraY tests regardless of window size).
    expect(level1.height * 32).toBeGreaterThan(700);
  });
});
