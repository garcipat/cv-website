import { describe, it, expect } from 'vitest';
import { gridToLayout, markerGridToPlacements, previewLevelDef } from './gridLayout';
import { cropLayoutToBox } from './exportLayout';
import type { TileChar } from '../../level/LevelParser';
import type { MarkerGrid } from '../../level/LevelData';

describe('gridToLayout', () => {
  it('aWholeGrid-serializesEveryRowIncludingLeadingAndTrailingEmpties', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.'],
      ['.', 'G', 'S'],
      ['.', 'R', 'R'],
    ];
    expect(gridToLayout(grid)).toEqual(['...', '.GS', '.RR']);
  });

  it('aWholeGrid-equalsCropLayoutToBoxOverItsOwnFullBox', () => {
    const grid: TileChar[][] = [
      ['G', 'G', 'S'],
      ['R', 'R', 'R'],
    ];
    expect(gridToLayout(grid)).toEqual(
      cropLayoutToBox(grid, { minRow: 0, maxRow: 1, minCol: 0, maxCol: 2 }, '.'),
    );
  });

  it('aRaggedGrid-readsMissingCellsAsEmpty', () => {
    const grid = [['G', 'S'], ['R']] as unknown as TileChar[][];
    expect(gridToLayout(grid)).toEqual(['GS', 'R.']);
  });
});

describe('markerGridToPlacements', () => {
  it('aDenseGridWithTwoMarkers-returnsTwoSparsePlacementsInReadingOrder', () => {
    const markers: MarkerGrid = [
      [null, { kind: 'patrolBoundary' }],
      [{ kind: 'sign', hintId: 'bomb' }, null],
    ];
    expect(markerGridToPlacements(markers)).toEqual([
      { col: 1, row: 0, marker: { kind: 'patrolBoundary' } },
      { col: 0, row: 1, marker: { kind: 'sign', hintId: 'bomb' } },
    ]);
  });

  it('anEmptyGrid-returnsNoPlacements', () => {
    expect(markerGridToPlacements([])).toEqual([]);
  });
});

describe('previewLevelDef', () => {
  it('aBareTWithDefinedMarkers-mapsToEmptyTerrainNotTheDecorativeStalactite', () => {
    const level = previewLevelDef([['T', 'G']], []);
    expect(level.terrain).toEqual([['empty', 'groundGrass']]);
  });

  it('entityMarkers-mapToEmptyTerrain', () => {
    const level = previewLevelDef([['S', 'M', 'o', '$', 'M']], []);
    expect(level.terrain).toEqual([['empty', 'empty', 'empty', 'empty', 'empty']]);
    expect(level.width).toBe(5);
    expect(level.height).toBe(1);
  });

  it('aSignMarker-isCarriedIntoTheLevelDefsMarkerLayer', () => {
    const markers: MarkerGrid = [[null, { kind: 'sign', hintId: 'bomb' }]];
    const level = previewLevelDef([['.', 'T']], markers);
    expect(level.markers).toEqual([[null, { kind: 'sign', hintId: 'bomb' }]]);
  });

  it('anEmptyMarkerGrid-mapsABareTToEmptyTerrainSoItReadsAsASign', () => {
    // The `T`-generation rule: a defined-but-empty markers array is what a
    // new-format file has, so `T` is the sign character (empty terrain).
    const level = previewLevelDef([['T']], []);
    expect(level.terrain).toEqual([['empty']]);
  });
});
