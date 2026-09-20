import { clayVariantAt, fillerVariantAt, CLAY_VARIANT_COUNT } from './clayVariants';

describe('clayVariantAt', () => {
  it('anyTile-returnsOneOfTheThreeClayVariants', () => {
    for (let col = 0; col < 30; col++) {
      for (let row = 0; row < 8; row++) {
        const variant = clayVariantAt(col, row);
        expect(variant).toBeGreaterThanOrEqual(0);
        expect(variant).toBeLessThan(CLAY_VARIANT_COUNT);
      }
    }
  });

  it('sameTile-returnsTheSameVariantEveryCall', () => {
    expect(clayVariantAt(7, 3)).toBe(clayVariantAt(7, 3));
    expect(clayVariantAt(0, 0)).toBe(clayVariantAt(0, 0));
    expect(clayVariantAt(41, 5)).toBe(clayVariantAt(41, 5));
  });

  it('differentTiles-produceMoreThanOneVariantAcrossARange', () => {
    const seen = new Set<number>();
    for (let col = 0; col < 30; col++) seen.add(clayVariantAt(col, 2));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('adjacentColumns-inTheSameRow-neverShareAVariant', () => {
    // Two horizontally adjacent clay pots are the tiles a visitor reads as
    // "the bunch", so they must never repeat a size (FR-009/SC-002). The
    // filler only guarantees base-vs-filler, not base-vs-base — this is the
    // rule that actually makes a run of pots read as varied sizes.
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 40; col++) {
        expect(clayVariantAt(col, row)).not.toBe(clayVariantAt(col + 1, row));
      }
    }
  });

  it('isAFunctionOfTheTileAlone-soASurvivorKeepsItsVariantWhenItsNeighbourIsGone', () => {
    // The signature takes only (col, row): there is no run input, so a
    // surviving pot's variant cannot change when a neighbour breaks or a
    // bunch re-forms (FR-010, SC-008).
    const before = clayVariantAt(5, 2);
    expect(clayVariantAt(5, 2)).toBe(before);
  });
});

describe('fillerVariantAt', () => {
  it('anySeam-overALongColumnRange-differsFromBothBridgedClayVariants', () => {
    for (let seamCol = 0; seamCol < 60; seamCol++) {
      for (let row = 0; row < 6; row++) {
        const filler = fillerVariantAt(seamCol, row);
        expect(filler).not.toBe(clayVariantAt(seamCol, row));
        expect(filler).not.toBe(clayVariantAt(seamCol + 1, row));
      }
    }
  });

  it('anySeam-returnsOneOfTheThreeClayVariants', () => {
    for (let seamCol = 0; seamCol < 30; seamCol++) {
      const filler = fillerVariantAt(seamCol, 1);
      expect(filler).toBeGreaterThanOrEqual(0);
      expect(filler).toBeLessThan(CLAY_VARIANT_COUNT);
    }
  });

  it('sameSeam-returnsTheSameVariantEveryCall', () => {
    expect(fillerVariantAt(4, 2)).toBe(fillerVariantAt(4, 2));
  });

  it('anyRunOverALongRange-noTwoNeighbouringRenderedClayPotsShareAVariant', () => {
    // The rendered sequence of a run is base(c0), filler(c0), base(c1),
    // filler(c1), ... — a filler always sits between two base pots, so
    // pairwise-distinct neighbours for the whole sequence is exactly the
    // no-neighbour-repeat guarantee FR-009/SC-002 require, however long the
    // run.
    for (let row = 0; row < 4; row++) {
      const rendered: number[] = [];
      for (let col = 0; col < 40; col++) {
        rendered.push(clayVariantAt(col, row));
        rendered.push(fillerVariantAt(col, row));
      }
      for (let i = 1; i < rendered.length; i++) {
        expect(rendered[i]).not.toBe(rendered[i - 1]);
      }
    }
  });
});
