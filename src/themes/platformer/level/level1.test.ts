import { level1, parseLevel, TILE_CHARS, SPAWN_TILE } from './level1';
import { isTopExposed, isSolid } from './Terrain';

describe('parseLevel', () => {
  it('charLayout-parsesInto-matchingTileMap', () => {
    const result = parseLevel(['G.', '.W']);
    expect(result).toEqual({
      terrain: [
        ['groundGrass', 'empty'],
        ['empty', 'wall'],
      ],
      width: 2,
      height: 2,
    });
  });

  it('unknownCharacter-throws', () => {
    expect(() => parseLevel(['G?'])).toThrow('Unknown level tile character: "?"');
  });

  it('raggedRows-throws', () => {
    expect(() => parseLevel(['GG', 'G'])).toThrow('Row 1 has length 1, expected 2');
  });

  it('tileChars-mapsEveryLegendCharacter', () => {
    expect(TILE_CHARS['.']).toBe('empty');
    expect(TILE_CHARS.G).toBe('groundGrass');
    expect(TILE_CHARS.R).toBe('groundRock');
    expect(TILE_CHARS.P).toBe('platform');
    expect(TILE_CHARS.W).toBe('wall');
    expect(TILE_CHARS.B).toBe('bridge');
    expect(TILE_CHARS.S).toBe('empty');
  });

  it('spawnMarker-parsesAsEmptyWalkableTile', () => {
    const result = parseLevel(['S.', 'G.']);
    expect(result.terrain[0][0]).toBe('empty');
  });
});

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

  it('pit-atColumns2And3-hasSolidGroundFloorAtBottomRow', () => {
    // The pit has a bridge one row up (see the next test) but must not be a
    // bottomless drop now that drop-through lets the character fall through
    // that bridge on purpose — a floor here keeps that safe while preserving
    // the original "walk off the bridge and fall a level" character.
    expect(level1.terrain[level1.height - 1][2]).toBe('groundGrass');
    expect(level1.terrain[level1.height - 1][3]).toBe('groundGrass');
  });

  it('bridge-spansThePitAtRowAboveBottomRow', () => {
    expect(level1.terrain[level1.height - 2][2]).toBe('bridge');
    expect(level1.terrain[level1.height - 2][3]).toBe('bridge');
  });

  it('containsAtLeastOnePlatformTile', () => {
    const hasPlatform = level1.terrain.some((row) => row.includes('platform'));
    expect(hasPlatform).toBe(true);
  });

  it('containsAtLeastOneWallTile', () => {
    const hasWall = level1.terrain.some((row) => row.includes('wall'));
    expect(hasWall).toBe(true);
  });

  it('elevatedBridge-spansGapBetweenTwoFloatingPlatformsAtPlatformRow', () => {
    const row = 7;
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
      expect(level1.terrain[8][col]).toBe('empty');
      expect(level1.terrain[9][col]).toBe('empty');
      expect(isSolid(level1.terrain[10][col])).toBe(true);
    }
  });

  it('spawnTile-isEmptySpaceAboveTopExposedGroundGrass', () => {
    const { col, row } = SPAWN_TILE;
    expect(level1.terrain[row][col]).toBe('empty');
    expect(level1.terrain[row + 1][col]).toBe('groundGrass');
    expect(isTopExposed(level1, col, row + 1)).toBe(true);
  });
});
