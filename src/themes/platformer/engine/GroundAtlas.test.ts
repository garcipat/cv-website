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

  it('topClosedBottomOpen-returnsBright', () => {
    // Topmost cell of a run two or more cells tall.
    expect(groundTileKind(NEIGHBOUR_DOWN)).toBe('bright');
    expect(groundTileKind(NEIGHBOUR_DOWN | NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT)).toBe('bright');
  });

  it('topAndBottomClosed-returnsGradient', () => {
    // A run exactly one cell tall carries the whole ramp in one tile.
    expect(groundTileKind(0)).toBe('gradient');
    expect(groundTileKind(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT)).toBe('gradient');
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

  it('noNeighbours-returnsIsolatedGradientTileAtC0R0', () => {
    expect(groundAtlasCell(0)).toEqual({ sx: 0, sy: 0, rotation: 0, kind: 'gradient' });
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

  it('onlyBrightAndDarkTilesAreRotated', () => {
    // A vertical brightness ramp turned sideways reads as broken, so the
    // gradient tiles must never carry a rotation.
    for (const mask of ALL_MASKS) {
      const entry = groundAtlasCell(mask);
      if (entry.kind === 'gradient') expect(entry.rotation).toBe(0);
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
