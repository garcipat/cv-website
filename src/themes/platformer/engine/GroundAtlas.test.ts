import {
  ATLAS_STRIDE,
  GRASS_SOURCE_HEIGHT,
  groundTileKind,
  groundAtlasCell,
  secondBandCell,
  grassCell,
} from './GroundAtlas';
import {
  NEIGHBOUR_UP,
  NEIGHBOUR_RIGHT,
  NEIGHBOUR_DOWN,
  NEIGHBOUR_LEFT,
} from '../level/Terrain';

const ALL_MASKS = Array.from({ length: 16 }, (_, mask) => mask);

/** The run position a top-closed mask always implies: such a cell is its
 *  run's topmost, so depth 0. */
const SURFACE_RUN = { depth: 0, height: 1 };
/** A run position that is buried but outside the two-cell bright band, so a
 *  top-open mask reduces to the original bright/dark rule. */
const BURIED_RUN = { depth: 2, height: 3 };

describe('groundTileKind', () => {
  it('topOpen-outsideTheSecondBand-returnsDark', () => {
    // Anything with terrain above it is buried, however deep.
    expect(groundTileKind(NEIGHBOUR_UP, BURIED_RUN)).toBe('dark');
    expect(groundTileKind(NEIGHBOUR_UP | NEIGHBOUR_DOWN, BURIED_RUN)).toBe('dark');
    expect(groundTileKind(15, BURIED_RUN)).toBe('dark');
  });

  it('topClosed-returnsBright-regardlessOfTheBottomEdge', () => {
    // A one-tile-tall platform is bright, exactly like the top of a deep mass:
    // the bottom edge does not darken a tile that faces air above.
    expect(groundTileKind(NEIGHBOUR_DOWN, SURFACE_RUN)).toBe('bright');
    expect(groundTileKind(0, SURFACE_RUN)).toBe('bright');
    expect(groundTileKind(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT, SURFACE_RUN)).toBe('bright');
    expect(groundTileKind(NEIGHBOUR_DOWN | NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT, SURFACE_RUN)).toBe(
      'bright',
    );
  });
});

describe('groundTileKind with run position', () => {
  it('depthZero-topClosed-isAlwaysBright-howeverTallTheRun', () => {
    // The surface cell of a run stays bright whether the run is one cell or
    // nine — the second band never displaces the first.
    const topClosed = NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN | NEIGHBOUR_LEFT;
    expect(groundTileKind(topClosed, { depth: 0, height: 1 })).toBe('bright');
    expect(groundTileKind(topClosed, { depth: 0, height: 9 })).toBe('bright');
  });

  it('depthZero-butTopOpen-isDark-theRunIsCappedByAnotherMaterial', () => {
    // A grass run can start at depth 0 and still have its UP bit set, when the
    // cell above is solid but not grass (rock or wall). Then the cell faces no
    // open air, so it is buried and dark — depth alone does not make it bright.
    expect(groundTileKind(15, { depth: 0, height: 1 })).toBe('dark');
    expect(groundTileKind(15, { depth: 0, height: 9 })).toBe('dark');
  });

  it('depthOne-runShorterThanFour-isDark', () => {
    expect(groundTileKind(15, { depth: 1, height: 2 })).toBe('dark');
    expect(groundTileKind(15, { depth: 1, height: 3 })).toBe('dark');
  });

  it('depthOne-runFourOrTaller-isSecondBand', () => {
    expect(groundTileKind(15, { depth: 1, height: 4 })).toBe('brightSecond');
    expect(groundTileKind(15, { depth: 1, height: 12 })).toBe('brightSecond');
  });

  it('depthTwoOrMore-isAlwaysDark-howeverTallTheRun', () => {
    expect(groundTileKind(15, { depth: 2, height: 4 })).toBe('dark');
    expect(groundTileKind(15, { depth: 3, height: 20 })).toBe('dark');
  });
});

describe('secondBandCell', () => {
  it('interiorOfAWideMass-usesTheBorderlessBrightTileAtC5R2', () => {
    expect(secondBandCell(15)).toEqual({
      sx: 5 * ATLAS_STRIDE,
      sy: 2 * ATLAS_STRIDE,
      rotation: 0,
      kind: 'brightSecond',
    });
  });

  it('oneWideColumn-usesTheBrightLeftRightCellAtC6R1', () => {
    expect(secondBandCell(NEIGHBOUR_UP | NEIGHBOUR_DOWN)).toEqual({
      sx: 6 * ATLAS_STRIDE,
      sy: 1 * ATLAS_STRIDE,
      rotation: 0,
      kind: 'brightSecond',
    });
  });

  it('massEdges-rotateTheBrightTopCell', () => {
    // c4r0 is bright with only its top edge closed, so a quarter turn puts
    // that border on the side the mass ends at.
    expect(secondBandCell(NEIGHBOUR_UP | NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN)).toEqual({
      sx: 4 * ATLAS_STRIDE,
      sy: 0,
      rotation: 3,
      kind: 'brightSecond',
    });
    expect(secondBandCell(NEIGHBOUR_UP | NEIGHBOUR_DOWN | NEIGHBOUR_LEFT)).toEqual({
      sx: 4 * ATLAS_STRIDE,
      sy: 0,
      rotation: 1,
      kind: 'brightSecond',
    });
  });

  it('maskThatCannotBeASecondBandCell-throws', () => {
    // A second-band cell always has terrain above AND below it.
    expect(() => secondBandCell(0)).toThrow();
    expect(() => secondBandCell(NEIGHBOUR_DOWN)).toThrow();
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
    // GROUND_ATLAS serves the surface and the plain-dark cases only (the
    // second band has its own table), so each mask is checked at the run
    // position it implies: depth 0 for a top-closed mask, and a buried
    // position outside the band for a top-open one.
    for (const mask of ALL_MASKS) {
      const run = (mask & NEIGHBOUR_UP) === 0 ? SURFACE_RUN : BURIED_RUN;
      expect(groundAtlasCell(mask).kind).toBe(groundTileKind(mask, run));
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

  it('oneTileTallShapes-keepTheirBottomBorder', () => {
    // A one-tile-tall platform has air above AND below, so its cell must close
    // the bottom too — that is what distinguishes these from the top of a
    // taller run.
    expect(groundAtlasCell(0)).toEqual({ sx: 0, sy: 0, rotation: 2, kind: 'bright' });
    expect(groundAtlasCell(NEIGHBOUR_RIGHT)).toEqual({
      sx: 6 * ATLAS_STRIDE,
      sy: 0,
      rotation: 3,
      kind: 'bright',
    });
    expect(groundAtlasCell(NEIGHBOUR_LEFT)).toEqual({
      sx: 6 * ATLAS_STRIDE,
      sy: 0,
      rotation: 1,
      kind: 'bright',
    });
    expect(groundAtlasCell(NEIGHBOUR_LEFT | NEIGHBOUR_RIGHT)).toEqual({
      sx: 6 * ATLAS_STRIDE,
      sy: 1 * ATLAS_STRIDE,
      rotation: 1,
      kind: 'bright',
    });
  });

  it('topOfATallerRun-differsFromTheOneTileTallShape', () => {
    // Same three closed sides, but the bottom edge is open because ground
    // continues below — so a different cell, and no rotation.
    expect(groundAtlasCell(NEIGHBOUR_DOWN)).toEqual({
      sx: 6 * ATLAS_STRIDE,
      sy: 0,
      rotation: 0,
      kind: 'bright',
    });
    expect(groundAtlasCell(0)).not.toEqual(groundAtlasCell(NEIGHBOUR_DOWN));
    expect(groundAtlasCell(NEIGHBOUR_RIGHT)).not.toEqual(
      groundAtlasCell(NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN),
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

  it('quarterTurnsOnlyUseFlatCells', () => {
    // A quarter turn moves a border onto an adjacent edge, which would also
    // swing a vertical brightness ramp sideways — so it is only safe on cells
    // measured flat: c1r1 (the dark bottom edge), c6r0 and c6r1 (ramps 24 and
    // -4). A HALF turn is exempt: it maps every edge onto its opposite and
    // flips the ramp end-for-end, which is exactly why mask 0 uses one.
    const FLAT = [
      { sx: 1 * ATLAS_STRIDE, sy: 1 * ATLAS_STRIDE },
      { sx: 6 * ATLAS_STRIDE, sy: 0 },
      { sx: 6 * ATLAS_STRIDE, sy: 1 * ATLAS_STRIDE },
    ];
    for (const mask of ALL_MASKS) {
      const entry = groundAtlasCell(mask);
      if (entry.rotation === 0 || entry.rotation === 2) continue;
      expect(FLAT).toContainEqual({ sx: entry.sx, sy: entry.sy });
    }
  });

  it('isolatedTile-usesAHalfTurnToPutTheBrightEndBelowTheGrass', () => {
    // c0r0 ramps bright (185) at the top to dark (82) at the bottom. A half
    // turn buries the dark end under the 9px grass strip and leaves the bright
    // end in the visible band below it, and preserves all four borders.
    const entry = groundAtlasCell(0);
    expect(entry.rotation).toBe(2);
    expect({ sx: entry.sx, sy: entry.sy }).toEqual({ sx: 0, sy: 0 });
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
