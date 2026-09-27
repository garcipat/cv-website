import { describe, it, expect } from 'vitest';
import { paintGridCell, stampGridCells } from './paintGrid';

describe('paintGridCell', () => {
  const grid = [
    ['G', 'G'],
    ['R', 'R'],
  ];

  it('anInBoundsCell-growTrue-copiesWritesAndReportsNoShiftWithoutMutatingTheInput', () => {
    const result = paintGridCell(grid, 1, 1, 'S', '.');
    expect(result).toEqual({
      grid: [
        ['G', 'G'],
        ['R', 'S'],
      ],
      colShift: 0,
      rowShift: 0,
    });
    expect(grid).toEqual([
      ['G', 'G'],
      ['R', 'R'],
    ]);
  });

  it('aCellPastTheRightAndBottomEdge-growTrue-growsAndWrites', () => {
    const result = paintGridCell(grid, 3, 0, 'S', '.');
    expect(result.grid).toEqual([
      ['G', 'G', '.', 'S'],
      ['R', 'R', '.', '.'],
    ]);
    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(0);
  });

  it('aNegativeCell-growTrue-prependsAndReportsTheShift', () => {
    const result = paintGridCell(grid, -1, -1, 'S', '.');
    expect(result.colShift).toBe(1);
    expect(result.rowShift).toBe(1);
    expect(result.grid[0][0]).toBe('S');
    expect(result.grid[1][1]).toBe('G');
  });

  it('anOutOfBoundsCell-growFalse-returnsTheSameGrid', () => {
    const result = paintGridCell(grid, 9, 9, 'S', '.', false);
    expect(result.grid).toBe(grid);
    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(0);
  });

  it('anInBoundsCell-growFalse-copiesAndWritesWithoutGrowing', () => {
    const result = paintGridCell(grid, 0, 1, 'S', '.', false);
    expect(result.grid).toEqual([
      ['G', 'G'],
      ['S', 'R'],
    ]);
  });
});

describe('stampGridCells', () => {
  it('noCells-returnsTheSameGridAndNoShift', () => {
    const grid = [['G']];
    expect(stampGridCells(grid, [], '.')).toEqual({ grid, colShift: 0, rowShift: 0 });
  });

  it('severalCells-growTrue-growsToOneBoundingBoxAndWritesThemAll', () => {
    const grid = [
      ['G', 'G'],
      ['R', 'R'],
    ];
    const result = stampGridCells(
      grid,
      [
        { col: -1, row: 0, value: 'A' },
        { col: 2, row: 2, value: 'B' },
      ],
      '.',
    );
    expect(result.colShift).toBe(1);
    expect(result.rowShift).toBe(0);
    expect(result.grid).toEqual([
      ['A', 'G', 'G', '.'],
      ['.', 'R', 'R', '.'],
      ['.', '.', '.', 'B'],
    ]);
  });

  it('severalCells-growFalse-writesOnlyTheInBoundsCells', () => {
    const grid = [
      ['G', 'G'],
      ['R', 'R'],
    ];
    const result = stampGridCells(
      grid,
      [
        { col: 0, row: 0, value: 'A' },
        { col: 9, row: 0, value: 'B' },
      ],
      '.',
      false,
    );
    expect(result.grid).toEqual([
      ['A', 'G'],
      ['R', 'R'],
    ]);
  });

  it('onlyOutOfBoundsCells-growFalse-returnsTheSameGrid', () => {
    const grid = [['G']];
    expect(stampGridCells(grid, [{ col: 5, row: 5, value: 'A' }], '.', false).grid).toBe(grid);
  });
});
