import {
  ATLAS_STRIDE,
  GRASS_SOURCE_HEIGHT,
  groundTileKind,
  groundAtlasCell,
  grassCell,
} from './GroundAtlas';
import {
  NEIGHBOUR_UP,
  NEIGHBOUR_RIGHT,
  NEIGHBOUR_DOWN,
  NEIGHBOUR_LEFT,
} from '../level/Terrain';

const ALL_MASKS = Array.from({ length: 16 }, (_, mask) => mask);

describe('groundTileKind', () => {
  it('topOpen-returnsDark', () => {
    // Anything with terrain above it is buried, however deep.
    expect(groundTileKind(NEIGHBOUR_UP)).toBe('dark');
    expect(groundTileKind(NEIGHBOUR_UP | NEIGHBOUR_DOWN)).toBe('dark');
    expect(groundTileKind(15)).toBe('dark');
  });

  it('topClosed-returnsBright-regardlessOfTheBottomEdge', () => {
    // A one-tile-tall platform is bright, exactly like the top of a deep mass:
    // the bottom edge does not darken a tile that faces air above.
    expect(groundTileKind(NEIGHBOUR_DOWN)).toBe('bright');
    expect(groundTileKind(0)).toBe('bright');
    expect(groundTileKind(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT)).toBe('bright');
    expect(groundTileKind(NEIGHBOUR_DOWN | NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT)).toBe('bright');
  });
});

describe('groundAtlasCell', () => {
  it('everyMask-hasAnEntry', () => {
    for (const mask of ALL_MASKS) {
      expect(groundAtlasCell(mask)).toBeDefined();
    }
  });

  it('everyEntry-kindAgreesWithBandingRule', () => {
    // The table is the source of truth for rendering; this pins it to the
    // rule so changing groundTileKind reveals which entries need re-pointing.
    for (const mask of ALL_MASKS) {
      expect(groundAtlasCell(mask).kind).toBe(groundTileKind(mask));
    }
  });

  it('everyEntry-coordinatesLieOnTheAtlasGrid', () => {
    for (const mask of ALL_MASKS) {
      const { sx, sy } = groundAtlasCell(mask);
      expect(sx % ATLAS_STRIDE).toBe(0);
      expect(sy % ATLAS_STRIDE).toBe(0);
      expect(sx / ATLAS_STRIDE).toBeLessThanOrEqual(6);
      expect(sy / ATLAS_STRIDE).toBeLessThanOrEqual(2);
    }
  });

  it('noNeighbours-returnsTheBrightThreeSidedCellAtC6R0', () => {
    // Air on all four sides. The bottom edge is ignored for a top-exposed tile,
    // so an isolated platform uses the same cell as a one-wide column's top.
    expect(groundAtlasCell(0)).toEqual({
      sx: 6 * ATLAS_STRIDE,
      sy: 0,
      rotation: 0,
      kind: 'bright',
    });
  });

  it('topExposedMasks-ignoreTheDownBitWhenChoosingACell', () => {
    // 0/2/8/10 differ from 4/6/12/14 only in the DOWN bit, which no longer
    // changes the choice.
    expect(groundAtlasCell(0)).toEqual(groundAtlasCell(NEIGHBOUR_DOWN));
    expect(groundAtlasCell(NEIGHBOUR_RIGHT)).toEqual(
      groundAtlasCell(NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN),
    );
    expect(groundAtlasCell(NEIGHBOUR_LEFT)).toEqual(
      groundAtlasCell(NEIGHBOUR_LEFT | NEIGHBOUR_DOWN),
    );
    expect(groundAtlasCell(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT)).toEqual(
      groundAtlasCell(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN),
    );
  });

  it('allNeighbours-returnsBuriedInteriorAtC5R1', () => {
    expect(groundAtlasCell(15)).toEqual({
      sx: 5 * ATLAS_STRIDE,
      sy: 1 * ATLAS_STRIDE,
      rotation: 0,
      kind: 'dark',
    });
  });

  it('onlyLeftEdgeClosed-rotatesTheBottomEdgeTileOneQuarterTurnClockwise', () => {
    const mask = NEIGHBOUR_UP | NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN;
    expect(groundAtlasCell(mask)).toEqual({
      sx: 1 * ATLAS_STRIDE,
      sy: 1 * ATLAS_STRIDE,
      rotation: 1,
      kind: 'dark',
    });
  });

  it('onlyRightEdgeClosed-rotatesTheBottomEdgeTileThreeQuarterTurnsClockwise', () => {
    const mask = NEIGHBOUR_UP | NEIGHBOUR_DOWN | NEIGHBOUR_LEFT;
    expect(groundAtlasCell(mask)).toEqual({
      sx: 1 * ATLAS_STRIDE,
      sy: 1 * ATLAS_STRIDE,
      rotation: 3,
      kind: 'dark',
    });
  });

  it('onlyFlatDarkTilesAreRotated', () => {
    // Rotation is safe only where the texture is direction-neutral.
    for (const mask of ALL_MASKS) {
      const entry = groundAtlasCell(mask);
      if (entry.rotation !== 0) expect(entry.kind).toBe('dark');
    }
  });

  it('oneWideColumn-topMiddleBottom-useDistinctCells', () => {
    const top = groundAtlasCell(NEIGHBOUR_DOWN);
    const middle = groundAtlasCell(NEIGHBOUR_UP | NEIGHBOUR_DOWN);
    const bottom = groundAtlasCell(NEIGHBOUR_UP);
    expect(top.kind).toBe('bright');
    expect(middle.kind).toBe('dark');
    expect(bottom.kind).toBe('dark');
    const key = (e: { sx: number; sy: number }) => `${e.sx},${e.sy}`;
    expect(new Set([key(top), key(middle), key(bottom)]).size).toBe(3);
  });
});

describe('grassCell', () => {
  it('everyRunPosition-mapsToRowTwo', () => {
    for (const position of ['single', 'left', 'middle', 'right'] as const) {
      expect(grassCell(position).sy).toBe(2 * ATLAS_STRIDE);
    }
  });

  it('runPositions-mapToDistinctColumnsInSheetOrder', () => {
    expect(grassCell('left')).toEqual({ sx: 1 * ATLAS_STRIDE, sy: 2 * ATLAS_STRIDE });
    expect(grassCell('middle')).toEqual({ sx: 2 * ATLAS_STRIDE, sy: 2 * ATLAS_STRIDE });
    expect(grassCell('right')).toEqual({ sx: 3 * ATLAS_STRIDE, sy: 2 * ATLAS_STRIDE });
    expect(grassCell('single')).toEqual({ sx: 4 * ATLAS_STRIDE, sy: 2 * ATLAS_STRIDE });
  });

  it('grassSourceHeight-isNinePixels', () => {
    expect(GRASS_SOURCE_HEIGHT).toBe(9);
  });
});
