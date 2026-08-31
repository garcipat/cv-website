import {
  currentLevel,
  currentLayout,
  LEVEL_1_LAYOUT,
  SPAWN_TILE,
  ENEMY_TILES_GREEN,
  ENEMY_TILES_PURPLE,
  COIN_TILES,
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  CHEST_TILES,
} from './level';
import { isTopExposed, isSolid, isClimbable, isStandableLadderTop, tileAt } from './Terrain';

/** Every hand-placed marker must sit on an empty tile directly above a solid
 *  one — the same "standable" shape a level author expects any marker to
 *  have, regardless of type. */
function expectStandable(tile: { col: number; row: number }) {
  expect(tileAt(currentLevel.value, tile.col, tile.row)).toBe('empty');
  expect(isSolid(tileAt(currentLevel.value, tile.col, tile.row + 1))).toBe(true);
}

describe('currentLevel', () => {
  it('dimensions-matchTerrainGridShape', () => {
    expect(currentLevel.value.terrain).toHaveLength(currentLevel.value.height);
    for (const row of currentLevel.value.terrain) {
      expect(row).toHaveLength(currentLevel.value.width);
    }
  });

  it('groundStrip-usesGrassBiomeOnLeftAndRockBiomeOnRight', () => {
    const lastRow = currentLevel.value.terrain[currentLevel.value.height - 1];
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
    expect(currentLevel.value.terrain[currentLevel.value.height - 1][2]).toBe('empty');
    expect(currentLevel.value.terrain[currentLevel.value.height - 1][3]).toBe('empty');
    expect(currentLevel.value.terrain[currentLevel.value.height - 1][4]).toBe('empty');
  });

  it('bridge-spansThePitAtRowAboveBottomRow', () => {
    expect(currentLevel.value.terrain[currentLevel.value.height - 2][2]).toBe('bridge');
    expect(currentLevel.value.terrain[currentLevel.value.height - 2][3]).toBe('bridge');
    expect(currentLevel.value.terrain[currentLevel.value.height - 2][4]).toBe('bridge');
  });

  it('containsAtLeastOnePlatformTile', () => {
    const hasPlatform = currentLevel.value.terrain.some((row) => row.includes('platform'));
    expect(hasPlatform).toBe(true);
  });

  it('groundStrip-rockZoneContinuesFlatToLevelEnd', () => {
    const lastRow = currentLevel.value.terrain[currentLevel.value.height - 1];
    expect(currentLevel.value.width).toBe(80);
    expect(lastRow[79]).toBe('groundRock');
  });

  it('greenEnemyWallPocket-boundsTheGreenEnemyMarkerAtTheEnemysOwnRow', () => {
    // Two wall tiles (cols 26/31) flank the green enemy marker (col 28) —
    // deliberately at the marker's own row, not the ground row below, since
    // EnemyAI.ts's stepEnemyPatrol tests the tile at the enemy's row, not the
    // ground it stands on. Both walls: the "bounded by two walls" patrol case.
    expect(ENEMY_TILES_GREEN.value).toHaveLength(1);
    const [green] = ENEMY_TILES_GREEN.value;
    expect(currentLevel.value.terrain[green.row][26]).toBe('wall');
    expect(currentLevel.value.terrain[green.row][31]).toBe('wall');
    expect(green.col).toBeGreaterThan(26);
    expect(green.col).toBeLessThan(31);
  });

  it('purpleEnemyWallPitSandwich-hasAWallOnOneSideAndARealPitOnTheOther', () => {
    // The user-requested "wall, enemy, pit" case: a wall (col 36) on one
    // side, a genuine bottomless pit (cols 40-42, no bridge — unlike the
    // spawn pit's bridge) on the other, with the purple enemy marker (col 38)
    // between them. Exercises both stepEnemyPatrol's wall-reversal and its
    // ledge/pit-edge-reversal branch on a single enemy.
    expect(ENEMY_TILES_PURPLE.value).toHaveLength(1);
    const [purple] = ENEMY_TILES_PURPLE.value;
    expect(currentLevel.value.terrain[purple.row][36]).toBe('wall');
    expect(purple.col).toBeGreaterThan(36);
    for (const col of [40, 41, 42]) {
      expect(currentLevel.value.terrain[currentLevel.value.height - 1][col]).toBe('empty');
      expect(currentLevel.value.terrain[currentLevel.value.height - 2][col]).toBe('empty');
    }
    expect(purple.col).toBeLessThan(40);
  });

  it('markers-eachStandsOnAnEmptyTileAboveSolidGround', () => {
    for (const tile of [...ENEMY_TILES_GREEN.value, ...ENEMY_TILES_PURPLE.value, ...COIN_TILES.value]) {
      expectStandable(tile);
    }
  });

  it('markerCounts-matchThisMechanicsTestLevelsIntentionalDesign', () => {
    // currentLevel deliberately covers only a slice of real CVData (see its doc
    // comment) — these counts are the level's own intentional design, not
    // derived from CVData length. The Language-fruit marker concept was
    // removed 2026-08-30 (live user feedback) — question-mark blocks spawn
    // their own bonus fruit instead.
    expect(ENEMY_TILES_GREEN.value).toHaveLength(1);
    expect(ENEMY_TILES_PURPLE.value).toHaveLength(1);
    expect(COIN_TILES.value).toHaveLength(4);
    expect(CRATE_TILES.value).toHaveLength(2);
    expect(QUESTIONMARK_TILES.value).toHaveLength(2);
    expect(FRAGILE_ROCK_TILES.value).toHaveLength(2);
  });

  it('newBlockMarkers-sitElevatedAboveGroundCloseToSpawn', () => {
    // Elevated to the floating-platform row (2 empty rows of clearance above solid ground,
    // same shape as the existing floating platform at cols 8-14) and moved
    // to cols 19-24 — right after the second coin (col 18), well before
    // the wall/enemy/pit gauntlet at cols 26-42, instead of the 51-tiles-
    // from-spawn cluster at cols 47-52.
    const blockRow = 3;
    expect(CRATE_TILES.value.map((t) => t.col)).toEqual([19, 22]);
    expect(QUESTIONMARK_TILES.value.map((t) => t.col)).toEqual([20, 23]);
    expect(FRAGILE_ROCK_TILES.value.map((t) => t.col)).toEqual([21, 24]);
    for (const tile of [...CRATE_TILES.value, ...QUESTIONMARK_TILES.value, ...FRAGILE_ROCK_TILES.value]) {
      expect(tile.row).toBe(blockRow);
    }
  });

  it('newBlockMarkers-haveTwoRowsOfClearanceAboveReachableGroundBelow', () => {
    // Same clearance shape as the elevatedBridge tests above: 2 empty rows
    // between the elevated block row and solid ground, so the player can
    // jump up into a block from below.
    for (const col of [19, 20, 21, 22, 23, 24]) {
      expect(currentLevel.value.terrain[4][col]).toBe('empty');
      expect(currentLevel.value.terrain[5][col]).toBe('empty');
      expect(isSolid(currentLevel.value.terrain[6][col])).toBe(true);
    }
  });

  it('secondCoin-sitsSoonAfterSpawnNotOnlyPastThePit', () => {
    // Previously only the col 10 coin was reachable without a long walk —
    // relocated one of the four coins to col 18 (just past the wall
    // pocket) so there's a second nearby one too.
    expect(COIN_TILES.value.map((t) => t.col)).toContain(18);
  });

  it('blockMarkers-sitOnEmptyTileTwoRowsAboveSolidGround', () => {
    for (const tile of [...CRATE_TILES.value, ...QUESTIONMARK_TILES.value, ...FRAGILE_ROCK_TILES.value]) {
      expect(currentLevel.value.terrain[tile.row][tile.col]).toBe('empty');
      expect(isSolid(currentLevel.value.terrain[tile.row + 3][tile.col])).toBe(true);
    }
  });

  it('elevatedBridge-spansGapBetweenTwoFloatingPlatformsAtPlatformRow', () => {
    const row = 3;
    expect(currentLevel.value.terrain[row][8]).toBe('platform');
    expect(currentLevel.value.terrain[row][9]).toBe('platform');
    expect(currentLevel.value.terrain[row][10]).toBe('platform');
    expect(currentLevel.value.terrain[row][11]).toBe('bridge');
    expect(currentLevel.value.terrain[row][12]).toBe('bridge');
    expect(currentLevel.value.terrain[row][13]).toBe('platform');
    expect(currentLevel.value.terrain[row][14]).toBe('platform');
  });

  it('elevatedBridge-hasTwoRowsOfClearanceAboveReachableGroundBelow', () => {
    // Enough clearance (2 empty rows) to jump up into the bridge from the
    // ground below, and solid ground to land on after dropping through it.
    for (const col of [11, 12]) {
      expect(currentLevel.value.terrain[4][col]).toBe('empty');
      expect(currentLevel.value.terrain[5][col]).toBe('empty');
      expect(isSolid(currentLevel.value.terrain[6][col])).toBe(true);
    }
  });

  it('spawnTile-isEmptySpaceAboveTopExposedGroundGrass', () => {
    const { col, row } = SPAWN_TILE.value;
    expect(currentLevel.value.terrain[row][col]).toBe('empty');
    expect(currentLevel.value.terrain[row + 1][col]).toBe('groundGrass');
    expect(isTopExposed(currentLevel.value, col, row + 1)).toBe(true);
  });

  it('enemiesAndCollectibles-sitCloseToSpawnForEasyManualTesting', () => {
    // Roadmap step 17: both enemy markers used to sit ~45 tiles from spawn
    // (col 1); they must now be reachable within a short walk.
    for (const tile of [...ENEMY_TILES_GREEN.value, ...ENEMY_TILES_PURPLE.value]) {
      expect(tile.col - SPAWN_TILE.value.col).toBeLessThan(40);
    }
  });
});

describe('CHEST_TILES', () => {
  it('level1Layout-has-twoChestMarkers', () => {
    expect(CHEST_TILES.value).toHaveLength(2);
  });
});

describe('currentLayout reactivity', () => {
  afterEach(() => {
    // currentLayout is module-level and deliberately NOT localStorage-backed
    // (see level.ts's doc comment) — restoring it after each test here
    // keeps this describe block from leaking a non-default layout into every
    // other test in this file (or other files sharing this module instance).
    currentLayout.value = LEVEL_1_LAYOUT;
  });

  it('initialValue-onModuleLoad-isLEVEL_1_LAYOUT', () => {
    expect(currentLayout.value).toBe(LEVEL_1_LAYOUT);
  });

  it('changingCurrentLayout-recomputesLevel1AndEveryMarkerTileSignal', () => {
    // A tiny 2-row layout with a single spawn marker and nothing else —
    // enough to prove every derived computed signal re-reads currentLayout
    // instead of staying pinned to LEVEL_1_LAYOUT's original values.
    const tinyLayout = ['.S.', 'GGG'];

    currentLayout.value = tinyLayout;

    expect(currentLevel.value.width).toBe(3);
    expect(currentLevel.value.height).toBe(2);
    expect(SPAWN_TILE.value).toEqual({ col: 1, row: 0 });
    expect(ENEMY_TILES_GREEN.value).toEqual([]);
    expect(ENEMY_TILES_PURPLE.value).toEqual([]);
    expect(COIN_TILES.value).toEqual([]);
    expect(CRATE_TILES.value).toEqual([]);
    expect(QUESTIONMARK_TILES.value).toEqual([]);
    expect(FRAGILE_ROCK_TILES.value).toEqual([]);
    expect(CHEST_TILES.value).toEqual([]);
  });
});

describe('ladder shaft (roadmap step 23)', () => {
  it('ladderTopTile-sitsBesideTheLandingPlatformNotAboveIt', () => {
    expect(currentLevel.value.terrain[0][14]).toBe('platform');
    expect(currentLevel.value.terrain[0][15]).toBe('ladder');
  });

  it('shaftIsLadderAtCol15-fourTilesTall-flushWithBothPlatformRows', () => {
    for (let row = 0; row <= 3; row++) {
      expect(currentLevel.value.terrain[row][15]).toBe('ladder');
      expect(isClimbable(currentLevel.value.terrain[row][15])).toBe(true);
    }
  });

  it('ladderBottomTile-sitsBesideTheExistingFloatingPlatformNotBelowIt', () => {
    // Row 3 is the pre-existing floating platform. The ladder's bottom
    // tile is now IN row 3 too (col 15, one column right of the
    // platform's rightmost tile at col 14) — same row, adjacent column —
    // so standing on the platform and walking one tile right puts the
    // player's feet directly on a ladder tile without needing to jump
    // (roadmap step 23 follow-up: the ladder previously sat one row ABOVE
    // the platform at the same column, which blocked climb-entry from
    // standing height).
    expect(currentLevel.value.terrain[3][14]).toBe('platform');
    expect(currentLevel.value.terrain[3][15]).toBe('ladder');
  });

  it('aboveTheShaftsTopRung-isOpenSpace-soTheClimbEndsStandingOnTopOfIt', () => {
    // The top rung (row 0) has nothing above it — that open space is what
    // makes it standable (Terrain.ts's isStandableLadderTop): the climb
    // ends with the character standing on the rung, level with the landing
    // platform beside it, rather than dead-ending under a ceiling.
    expect(isStandableLadderTop(currentLevel.value, 15, 0)).toBe(true);
  });
});
