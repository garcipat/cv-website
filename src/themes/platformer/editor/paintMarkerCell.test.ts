import { describe, it, expect } from 'vitest';
import { paintMarkerCell, eraseMarkerCell, paintSignMarker, resizeMarkerGrid } from './paintMarkerCell';
import type { MarkerGrid } from '../level/LevelData';
import { DEFAULT_HINT_ID } from '../level/HintCatalog';

const EMPTY: MarkerGrid = [
  [null, null],
  [null, null],
];

describe('paintMarkerCell', () => {
  it('writesTheMarkerIntoTheTargetCell', () => {
    const result = paintMarkerCell(EMPTY, 1, 0, { kind: 'patrolBoundary' });
    expect(result[0][1]).toEqual({ kind: 'patrolBoundary' });
    expect(result[0][0]).toBeNull();
  });

  it('overwritesAnExistingMarker', () => {
    const grid: MarkerGrid = [[{ kind: 'patrolBoundary' }, null]];
    expect(paintMarkerCell(grid, 0, 0, { kind: 'connectionPoint' })[0][0]).toEqual({
      kind: 'connectionPoint',
    });
  });

  it('doesNotMutateTheInputGrid', () => {
    paintMarkerCell(EMPTY, 0, 0, { kind: 'patrolBoundary' });
    expect(EMPTY[0][0]).toBeNull();
  });

  it('outOfBounds-isANoOpThatNeverGrows', () => {
    expect(paintMarkerCell(EMPTY, 5, 5, { kind: 'patrolBoundary' })).toBe(EMPTY);
    expect(paintMarkerCell(EMPTY, -1, 0, { kind: 'patrolBoundary' })).toBe(EMPTY);
    expect(paintMarkerCell([], 0, 0, { kind: 'patrolBoundary' })).toEqual([]);
  });
});

describe('eraseMarkerCell', () => {
  it('clearsTheCellToNull', () => {
    const grid: MarkerGrid = [[{ kind: 'patrolBoundary' }]];
    expect(eraseMarkerCell(grid, 0, 0)[0][0]).toBeNull();
  });

  it('anAlreadyEmptyOrOutOfBoundsCell-isANoOp', () => {
    expect(eraseMarkerCell(EMPTY, 0, 0)).toBe(EMPTY);
    expect(eraseMarkerCell(EMPTY, 9, 9)).toBe(EMPTY);
  });
});

describe('paintSignMarker', () => {
  it('freshCell-writesTheDefaultHint', () => {
    expect(paintSignMarker(EMPTY, 1, 1)[1][1]).toEqual({
      kind: 'sign',
      hintId: DEFAULT_HINT_ID,
    });
  });

  it('anExistingSign-cyclesToTheNextHint', () => {
    const grid: MarkerGrid = [[{ kind: 'sign', hintId: 'bridgeDropThrough' }]];
    expect(paintSignMarker(grid, 0, 0)[0][0]).toEqual({
      kind: 'sign',
      hintId: 'ladderClimbUp',
    });
  });

  it('aNonSignMarker-isReplacedByADefaultHintSign', () => {
    const grid: MarkerGrid = [[{ kind: 'patrolBoundary' }]];
    expect(paintSignMarker(grid, 0, 0)[0][0]).toEqual({
      kind: 'sign',
      hintId: DEFAULT_HINT_ID,
    });
  });

  it('outOfBounds-isANoOp', () => {
    expect(paintSignMarker(EMPTY, 9, 9)).toBe(EMPTY);
  });
});

describe('resizeMarkerGrid', () => {
  it('padsWithNullToTheRequestedSize', () => {
    const result = resizeMarkerGrid([[{ kind: 'patrolBoundary' }]], 3, 2);
    expect(result).toEqual([
      [{ kind: 'patrolBoundary' }, null, null],
      [null, null, null],
    ]);
  });

  it('alreadyLargeEnough-returnsTheSameGrid', () => {
    expect(resizeMarkerGrid(EMPTY, 2, 2)).toBe(EMPTY);
  });
});
