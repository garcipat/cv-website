import { describe, it, expect } from 'vitest';
import { importLayout, importBackgroundLayout, importMarkerGrid } from './importLayout';

describe('importLayout', () => {
  it('converts a single-row layout into a one-row grid of the same characters', () => {
    expect(importLayout(['G.S'])).toEqual([['G', '.', 'S']]);
  });

  it('converts a multi-row layout into a grid with one array per row, top row first', () => {
    const result = importLayout(['.S.', 'GGG']);
    expect(result).toEqual([
      ['.', 'S', '.'],
      ['G', 'G', 'G'],
    ]);
  });

  it('returns an empty array for an empty layout', () => {
    expect(importLayout([])).toEqual([]);
  });

  it('right-pads shorter rows with "." to match the widest row, like parseLevel does', () => {
    const result = importLayout(['GG', 'G', 'GGGG']);
    expect(result).toEqual([
      ['G', 'G', '.', '.'],
      ['G', '.', '.', '.'],
      ['G', 'G', 'G', 'G'],
    ]);
  });

  it('carries the floor spear marker "¦" through literally', () => {
    expect(importLayout(['S¦.', 'GGG'])).toEqual([
      ['S', '¦', '.'],
      ['G', 'G', 'G'],
    ]);
  });

  it('migrates a legacy digit to the uniform sign character', () => {
    expect(importLayout(['1.'])).toEqual([['T', '.']]);
  });

  it('drops the legacy patrol and connection-point characters to empty terrain', () => {
    expect(importLayout(['P+'])).toEqual([['.', '.']]);
  });

  it('legacyT-mapsToTheDecorativeStalactiteTileWhenTheFileIsPreFeature', () => {
    expect(importLayout(['T.'], true)).toEqual([['⊤', '.']]);
  });

  it('newFormatT-staysTheSignCharacter', () => {
    expect(importLayout(['T.'])).toEqual([['T', '.']]);
  });
});

describe('importMarkerGrid', () => {
  it('liftsLegacyPatrolConnectionPointAndSignCharacters', () => {
    expect(importMarkerGrid(['P+1.'])).toEqual([
      [
        { kind: 'patrolBoundary' },
        { kind: 'connectionPoint' },
        { kind: 'sign', hintId: 'bridgeDropThrough' },
        null,
      ],
    ]);
  });

  it('legacyT-liftsToAFallingStalactiteWhenNoMarkersFieldIsGiven', () => {
    expect(importMarkerGrid(['T.'])).toEqual([[{ kind: 'fallingStalactite' }, null]]);
  });

  it('storedMarkersAreMergedOnTopOfTheLegacyLift', () => {
    expect(
      importMarkerGrid(['..'], [{ col: 0, row: 0, marker: { kind: 'connectionPoint' } }]),
    ).toEqual([[{ kind: 'connectionPoint' }, null]]);
  });

  it('newFormatTWithNoSignMarkerStaysEmpty', () => {
    expect(importMarkerGrid(['T.'], [])).toEqual([[null, null]]);
  });
});

describe('importBackgroundLayout', () => {
  it('converts a single-row background layout into a one-row grid of the same characters', () => {
    expect(importBackgroundLayout(['d.c'])).toEqual([['d', '.', 'c']]);
  });

  it('converts a multi-row background layout into a grid with one array per row, top row first', () => {
    const result = importBackgroundLayout(['.d.', 'ccc']);
    expect(result).toEqual([
      ['.', 'd', '.'],
      ['c', 'c', 'c'],
    ]);
  });

  it('returns an empty array for an empty layout', () => {
    expect(importBackgroundLayout([])).toEqual([]);
  });

  it('right-pads shorter rows with "." to match the widest row', () => {
    const result = importBackgroundLayout(['dd', 'd', 'dddd']);
    expect(result).toEqual([
      ['d', 'd', '.', '.'],
      ['d', '.', '.', '.'],
      ['d', 'd', 'd', 'd'],
    ]);
  });

  it('an unrecognized character reads as empty ("."), never carried through literally', () => {
    expect(importBackgroundLayout(['d?c'])).toEqual([['d', '.', 'c']]);
  });
});
