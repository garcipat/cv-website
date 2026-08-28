import { level1, SPAWN_TILE } from './level1';
import { isTopExposed, isSolid } from './Terrain';

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

  it('wallPocket-boundsAnOpenGapInTheGroundRow', () => {
    // Two wall tiles (cols 44/49) flank an open pocket (cols 45-48) in the
    // ground row — a mechanics test spot for roadmap step 17's
    // walled-patrol case, once patrol exists.
    const groundRow = level1.height - 2;
    expect(level1.terrain[groundRow][44]).toBe('wall');
    expect(level1.terrain[groundRow][49]).toBe('wall');
    for (const col of [45, 46, 47, 48]) {
      expect(level1.terrain[groundRow][col]).not.toBe('wall');
    }
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
});
