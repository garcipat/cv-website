import {
  currentLevel,
  currentLayout,
  currentBackground,
  LEVEL_1_LAYOUT,
  SPAWN_TILE,
  ENEMY_TILES_GREEN,
  ENEMY_TILES_PURPLE,
  COIN_TILES,
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  CHEST_TILES,
  SIGN_TILES,
} from './level';
import { isTopExposed, isSolid, isClimbable, isStandableLadderTop, tileAt } from './Terrain';
import { SIGN_CHARS } from './LevelParser';
import cvEn from '@/data/cv.en.json';

/** Every hand-placed marker must sit on an empty tile directly above a solid
 *  one — the same "standable" shape a level author expects any marker to
 *  have, regardless of type. */
function expectStandable(tile: { col: number; row: number }) {
  expect(tileAt(currentLevel.value, tile.col, tile.row)).toBe('empty');
  expect(isSolid(tileAt(currentLevel.value, tile.col, tile.row + 1))).toBe(true);
}

/** The row the character walks on at ground level. Derived from the spawn
 *  marker rather than by scanning for a material: ground is the level's
 *  default material, so platform rows are made of it too. */
function surfaceRow(): number {
  return SPAWN_TILE.value.row + 1;
}

/** Rows/cols of every cell in the layout, for whole-map scans. */
function everyCell(): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < currentLevel.value.height; row++) {
    for (let col = 0; col < currentLevel.value.width; col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

// These assert the level's DESIGN INVARIANTS, not hand-authored coordinates:
// the layout is expected to be re-drawn (by hand or via the Level Editor)
// without rewriting this file, so a test that pinned a specific column would
// only ever cost an edit. What must not silently break is reachability
// (nothing floats, nothing is boxed in, no gap is wider than a jump) and CV
// coverage (a missing marker means a CV fact no visitor can ever reach).
describe('currentLevel', () => {
  it('dimensions-matchTerrainGridShape', () => {
    expect(currentLevel.value.terrain).toHaveLength(currentLevel.value.height);
    for (const row of currentLevel.value.terrain) {
      expect(row).toHaveLength(currentLevel.value.width);
    }
  });

  it('groundIsTheDefaultMaterial-withRockOnlyAsAnAccent', () => {
    // The map is made of ground, with rock painted back in for the bedrock
    // stratum, cave floors and the two deliberately stony zones. Rock
    // outnumbering ground would mean that accent has swallowed the level.
    const tiles = currentLevel.value.terrain.flat();
    const grass = tiles.filter((tile) => tile === 'groundGrass').length;
    const rock = tiles.filter((tile) => tile === 'groundRock').length;
    expect(grass).toBeGreaterThan(0);
    expect(rock).toBeGreaterThan(0);
    expect(grass).toBeGreaterThan(rock);
    expect(currentLevel.value.terrain[surfaceRow()]).toContain('groundGrass');
  });

  it('spawnTile-isEmptySpaceAboveTopExposedGroundGrass', () => {
    const { col, row } = SPAWN_TILE.value;
    expect(currentLevel.value.terrain[row][col]).toBe('empty');
    expect(currentLevel.value.terrain[row + 1][col]).toBe('groundGrass');
    expect(isTopExposed(currentLevel.value, col, row + 1)).toBe(true);
  });

  it('markers-eachStandsOnAnEmptyTileAboveSolidGround', () => {
    for (const tile of [
      ...ENEMY_TILES_GREEN.value,
      ...ENEMY_TILES_PURPLE.value,
      ...COIN_TILES.value,
      ...CHEST_TILES.value,
      ...SIGN_TILES.value,
    ]) {
      expectStandable(tile);
    }
  });

  it('blockMarkers-haveTwoEmptyRowsBeneathThemAboveSolidGround', () => {
    // A block is only ever broken by being hit from below (Physics.ts's
    // ceiling collision), so every block needs a floor to jump from and room
    // to jump in. The two fragileRock plugs set into the surface itself are
    // the deliberate exception — they are hit from inside the cave below,
    // whose floor is further down than this shape describes.
    const plugs = FRAGILE_ROCK_TILES.value.filter((tile) =>
      isSolid(tileAt(currentLevel.value, tile.col - 1, tile.row)),
    );
    const floating = [
      ...CRATE_TILES.value,
      ...QUESTIONMARK_TILES.value,
      ...FRAGILE_ROCK_TILES.value,
    ].filter((tile) => !plugs.includes(tile));

    for (const { col, row } of floating) {
      expect(currentLevel.value.terrain[row][col]).toBe('empty');
      expect(currentLevel.value.terrain[row + 1][col]).toBe('empty');
      expect(currentLevel.value.terrain[row + 2][col]).toBe('empty');
      expect(isSolid(currentLevel.value.terrain[row + 3][col])).toBe(true);
    }
  });

  it('fragileRockPlugs-sitInTheSurfaceAboveAnOpenCave', () => {
    // The two plugged holes are the level's optional shortcuts: broken from
    // the cave below, they open a way back up to the surface. That only works
    // if the tile under the plug is open cave, not solid rock.
    const plugs = FRAGILE_ROCK_TILES.value.filter((tile) =>
      isSolid(tileAt(currentLevel.value, tile.col - 1, tile.row)),
    );
    expect(plugs.length).toBeGreaterThanOrEqual(2);
    for (const { col, row } of plugs) {
      expect(tileAt(currentLevel.value, col, row + 1)).toBe('empty');
    }
  });

  it('purpleSlimes-haveHeadroomAndRoomToTurnAround', () => {
    // A purple slime renders at 2x (SlimePurple.ts's renderScale), so it is
    // two tiles tall and two wide: a pocket sized for a green slime would
    // leave it visually overlapping the obstacle it turns at, and a low
    // ceiling would bury its top half. See EnemyAI.ts's stepEnemyPatrol.
    for (const { col, row } of ENEMY_TILES_PURPLE.value) {
      expect(isSolid(tileAt(currentLevel.value, col, row - 1))).toBe(false);
      for (const offset of [1, 2, 3]) {
        expect(isSolid(tileAt(currentLevel.value, col + offset, row))).toBe(false);
      }
      for (const offset of [1, 2]) {
        expect(isSolid(tileAt(currentLevel.value, col - offset, row))).toBe(false);
      }
    }
  });

  it('everyLadderTop-hasOpenSpaceAboveIt-soAClimbEndsStandingOnIt', () => {
    // A capped shaft dead-ends the climb under a ceiling instead of letting
    // the character step out onto the top rung (Terrain.ts's
    // isStandableLadderTop).
    for (const { col, row } of everyCell()) {
      const isTopRung =
        isClimbable(tileAt(currentLevel.value, col, row)) &&
        !isClimbable(tileAt(currentLevel.value, col, row - 1));
      if (isTopRung) {
        expect(isStandableLadderTop(currentLevel.value, col, row)).toBe(true);
      }
    }
  });

  it('surfaceGaps-areNeverWiderThanASingleJumpCanClear', () => {
    // PhysicsConfig.ts's jump peaks at ~3.5 tiles and carries ~5 tiles of
    // horizontal air-reach, so a gap of at most 4 tiles is always crossable.
    // Anything wider would strand the player mid-level with no way forward.
    const surface = surfaceRow();
    let gap = 0;
    for (let col = 0; col < currentLevel.value.width; col++) {
      const walkable =
        isSolid(currentLevel.value.terrain[surface][col]) ||
        isClimbable(currentLevel.value.terrain[surface][col]) ||
        FRAGILE_ROCK_TILES.value.some((tile) => tile.col === col && tile.row === surface);
      gap = walkable ? 0 : gap + 1;
      expect(gap).toBeLessThanOrEqual(4);
    }
  });

  it('pits-haveNoFloorBeneathThem-soFallingThroughOneIsARealPitFall', () => {
    // A pit only reads as a pit if it is open all the way to the grid floor
    // (Physics.ts's checkPitFall is position-only). A gap in the surface with
    // solid rock a few rows down is a cave entrance instead — both exist in
    // this level, and the difference must stay deliberate.
    const surface = surfaceRow();
    const bottom = currentLevel.value.height - 1;
    const openToTheBottom = (col: number) =>
      !isSolid(currentLevel.value.terrain[bottom][col]);
    const pitColumns = Array.from({ length: currentLevel.value.width }, (_, col) => col).filter(
      openToTheBottom,
    );

    expect(pitColumns.length).toBeGreaterThan(0);
    for (const col of pitColumns) {
      for (let row = surface + 1; row <= bottom; row++) {
        expect(isSolid(currentLevel.value.terrain[row][col])).toBe(false);
      }
    }
  });

  it('bridges-spanAPitOrACaveMouth-neverSolidGround', () => {
    // A bridge exists to be dropped through (Down/S). One laid over solid
    // ground would make that gesture a no-op and the hint sign a lie.
    for (const { col, row } of everyCell()) {
      if (currentLevel.value.terrain[row][col] !== 'bridge') continue;
      expect(isSolid(tileAt(currentLevel.value, col, row + 1))).toBe(false);
    }
  });
});

describe('CV coverage', () => {
  // Unlike the mechanics-test layout this replaced, the level now carries one
  // marker per CV fact, so the Journal can actually be completed. A marker is
  // a slot: no mapper auto-places, so a fact with no marker is a fact no
  // visitor can ever reach.
  it('chestMarkers-oneForEachExperienceEntry', () => {
    expect(CHEST_TILES.value).toHaveLength(cvEn.experience.length);
  });

  it('coinMarkers-oneForEachSkillCategory', () => {
    expect(COIN_TILES.value).toHaveLength(cvEn.skills.length);
  });

  it('greenSlimeMarkers-oneForEachCourse', () => {
    expect(ENEMY_TILES_GREEN.value).toHaveLength(cvEn.courses.length);
  });

  it('crateMarkers-oneForEachEducationActivityAndLanguageEntry', () => {
    expect(CRATE_TILES.value).toHaveLength(
      cvEn.education.length + cvEn.activities.length + cvEn.languages.length,
    );
  });

  it('questionMarkMarkers-oneForEachCertificateAndProject', () => {
    expect(QUESTIONMARK_TILES.value).toHaveLength(
      cvEn.certificates.length + cvEn.projects.length,
    );
  });

  it('purpleSlimeMarkerCount-equalsChestMarkerCount', () => {
    // Every chest costs exactly one key and a purple slime drops exactly one,
    // so fewer slimes than chests makes the ending unreachable — and more
    // makes a key meaningless.
    expect(ENEMY_TILES_PURPLE.value).toHaveLength(CHEST_TILES.value.length);
  });

  it('firstChest-comesBeforeTheFirstKey-soTheRunNeedsBacktracking', () => {
    // A deliberate design choice: the earliest chest cannot be opened when
    // it is first found, which is what makes the map a loop rather than a
    // corridor. `noKeyForChest` is the hint that fires there.
    const firstChest = Math.min(...CHEST_TILES.value.map((tile) => tile.col));
    const firstKey = Math.min(...ENEMY_TILES_PURPLE.value.map((tile) => tile.col));
    expect(firstChest).toBeLessThan(firstKey);
  });
});

describe('SIGN_TILES', () => {
  it('everyHint-hasExactlyOneSignInTheLevel', () => {
    // A hint with no sign can never be shown; two signs for one hint is
    // repetition. `noKeyForChest` is the exception — it fires from the chest
    // itself, not from a signpost, so it has no SIGN_CHARS entry.
    const placed = SIGN_TILES.value.map((sign) => sign.hintId).sort();
    expect(placed).toEqual(Object.values(SIGN_CHARS).sort());
  });

  it('bridgeDropThroughSign-standsOnTheBridgeItExplains', () => {
    const sign = SIGN_TILES.value.find((tile) => tile.hintId === 'bridgeDropThrough');
    expect(sign).toBeDefined();
    expect(currentLevel.value.terrain[sign!.row + 1][sign!.col]).toBe('bridge');
  });

  it('ladderClimbUpSign-standsBesideALadder', () => {
    const sign = SIGN_TILES.value.find((tile) => tile.hintId === 'ladderClimbUp');
    expect(sign).toBeDefined();
    // A shaft's top rung sits in the surface row itself (flush with the
    // ground beside it, so stepping on needs no jump), one row below where a
    // sign standing on that ground is drawn — hence both rows here.
    const neighbours = [-2, -1, 1, 2].flatMap((offset) => [
      tileAt(currentLevel.value, sign!.col + offset, sign!.row),
      tileAt(currentLevel.value, sign!.col + offset, sign!.row + 1),
    ]);
    expect(neighbours.some(isClimbable)).toBe(true);
  });

  it('chestNeedsKeySign-standsNearAChest', () => {
    const sign = SIGN_TILES.value.find((tile) => tile.hintId === 'chestNeedsKey');
    expect(sign).toBeDefined();
    const nearest = Math.min(
      ...CHEST_TILES.value.map((chest) => Math.abs(chest.col - sign!.col) + Math.abs(chest.row - sign!.row)),
    );
    expect(nearest).toBeLessThanOrEqual(5);
  });

  it('fragileRockSign-standsUnderneathAFragileRock', () => {
    const sign = SIGN_TILES.value.find((tile) => tile.hintId === 'fragileRockBreaksFromBelow');
    expect(sign).toBeDefined();
    const nearest = Math.min(
      ...FRAGILE_ROCK_TILES.value.map(
        (rock) => Math.abs(rock.col - sign!.col) + Math.abs(rock.row - sign!.row),
      ),
    );
    expect(nearest).toBeLessThanOrEqual(4);
  });

  it('openAllChestsSign-standsAtSpawn', () => {
    const sign = SIGN_TILES.value.find((tile) => tile.hintId === 'openAllChestsHaveFun');
    expect(sign).toBeDefined();
    expect(Math.abs(sign!.col - SPAWN_TILE.value.col)).toBeLessThanOrEqual(4);
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
    expect(SIGN_TILES.value).toEqual([]);
  });
});

describe('currentBackground', () => {
  afterEach(() => {
    currentBackground.value = [];
  });

  it('defaultValue-isAnEmptyList', () => {
    expect(currentBackground.value).toEqual([]);
  });

  it('settingCurrentBackground-appearsOnCurrentLevelsBackgroundField', () => {
    currentBackground.value = [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }];
    expect(currentLevel.value.background).toEqual([{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }]);
  });
});
