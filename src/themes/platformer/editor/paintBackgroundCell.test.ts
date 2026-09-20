import { describe, it, expect } from 'vitest';
import { paintBackgroundCell, eraseBackgroundCell } from './paintBackgroundCell';
import type { BackgroundChar } from '../level/LevelParser';

describe('paintBackgroundCell', () => {
  it('paintingOnAnEmptyGrid-growsItAndSetsTheSingleCell', () => {
    const result = paintBackgroundCell([], 0, 0, 'd');
    expect(result).toEqual([['d']]);
  });

  it('paintingWithinBounds-writesOnlyThatCell', () => {
    const grid: BackgroundChar[][] = [
      ['.', '.'],
      ['.', '.'],
    ];
    const result = paintBackgroundCell(grid, 1, 0, 'c');
    expect(result).toEqual([
      ['.', 'c'],
      ['.', '.'],
    ]);
  });

  it('paintingBeyondTheRightOrBottomEdge-growsTheGridWithoutShiftingExistingCells', () => {
    const grid: BackgroundChar[][] = [['d']];
    const result = paintBackgroundCell(grid, 2, 1, 'c');
    expect(result).toEqual([
      ['d', '.', '.'],
      ['.', '.', 'c'],
    ]);
  });

  it('paintingLeftOfOrAboveTheGrid-growsAndShiftsExistingCellsIntoTheNewOrigin', () => {
    const grid: BackgroundChar[][] = [['d']];
    const result = paintBackgroundCell(grid, -1, -1, 'c');
    expect(result).toEqual([
      ['c', '.'],
      ['.', 'd'],
    ]);
  });

  it('overwritingAnAlreadyPaintedCell-replacesItsMaterial', () => {
    const grid: BackgroundChar[][] = [['d']];
    const result = paintBackgroundCell(grid, 0, 0, 'c');
    expect(result).toEqual([['c']]);
  });

  it('doesNotMutateTheInputGrid', () => {
    const grid: BackgroundChar[][] = [['.']];
    paintBackgroundCell(grid, 0, 0, 'd');
    expect(grid).toEqual([['.']]);
  });
});

describe('eraseBackgroundCell', () => {
  it('erasingAPaintedCell-clearsOnlyThatCell', () => {
    const grid: BackgroundChar[][] = [
      ['d', 'c'],
      ['.', '.'],
    ];
    const result = eraseBackgroundCell(grid, 0, 0);
    expect(result).toEqual([
      ['.', 'c'],
      ['.', '.'],
    ]);
  });

  it('erasingAnAlreadyEmptyCell-isANoOp', () => {
    const grid: BackgroundChar[][] = [['.', 'd']];
    const result = eraseBackgroundCell(grid, 0, 0);
    expect(result).toEqual(grid);
  });

  it('erasingOutsideTheGridsBounds-isANoOpAndNeverGrows', () => {
    const grid: BackgroundChar[][] = [['d']];
    const result = eraseBackgroundCell(grid, 5, 5);
    expect(result).toEqual(grid);
  });

  it('doesNotMutateTheInputGrid', () => {
    const grid: BackgroundChar[][] = [['d']];
    eraseBackgroundCell(grid, 0, 0);
    expect(grid).toEqual([['d']]);
  });
});
