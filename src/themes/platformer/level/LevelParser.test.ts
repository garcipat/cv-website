import {
  parseLevel,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  TERRAIN_CHARS,
  ENTITY_CHARS,
} from './LevelParser';

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

  it('terrainChars-mapsEveryTerrainCharacter', () => {
    expect(TERRAIN_CHARS['.']).toBe('empty');
    expect(TERRAIN_CHARS.G).toBe('groundGrass');
    expect(TERRAIN_CHARS.R).toBe('groundRock');
    expect(TERRAIN_CHARS.P).toBe('platform');
    expect(TERRAIN_CHARS.W).toBe('wall');
    expect(TERRAIN_CHARS.B).toBe('bridge');
  });

  it('entityChars-mapsEveryEntityMarker', () => {
    expect(ENTITY_CHARS.S).toBe('spawn');
    expect(ENTITY_CHARS.E).toBe('enemyGreen');
    expect(ENTITY_CHARS.M).toBe('enemyPurple');
  });

  it('noTerrainAndEntityCharOverlap', () => {
    const shared = Object.keys(TERRAIN_CHARS).filter((char) => char in ENTITY_CHARS);
    expect(shared).toEqual([]);
  });

  it('spawnMarker-parsesAsEmptyWalkableTile', () => {
    const result = parseLevel(['S.', 'G.']);
    expect(result.terrain[0][0]).toBe('empty');
  });

  it('enemyMarkers-parseAsEmptyWalkableTile', () => {
    const result = parseLevel(['EM', 'GG']);
    expect(result.terrain[0][0]).toBe('empty');
    expect(result.terrain[0][1]).toBe('empty');
  });

  it('oneRow-heightIsOne', () => {
    // Height is read from the layout, never assumed — a level need only be
    // as tall as its content requires.
    const result = parseLevel(['GGG']);
    expect(result.height).toBe(1);
    expect(result.width).toBe(3);
  });
});

describe('findSpawnTile', () => {
  it('spawnMarkerPresent-returnsItsColAndRow', () => {
    expect(findSpawnTile(['..', '.S'])).toEqual({ col: 1, row: 1 });
  });

  it('noSpawnMarker-throws', () => {
    expect(() => findSpawnTile(['GG', 'GG'])).toThrow('Level layout has no spawn marker ("S")');
  });
});

describe('findGreenEnemyTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findGreenEnemyTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findGreenEnemyTiles(['.E', 'E.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('purpleMarker-isNotCountedAsGreen', () => {
    expect(findGreenEnemyTiles(['M.'])).toEqual([]);
  });
});

describe('findPurpleEnemyTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findPurpleEnemyTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findPurpleEnemyTiles(['.M', 'M.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('greenMarker-isNotCountedAsPurple', () => {
    expect(findPurpleEnemyTiles(['E.'])).toEqual([]);
  });
});
