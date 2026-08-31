import { describe, it, expect } from 'vitest';
import { growGrid } from './growGrid';
import type { TileChar } from '../level/LevelParser';

describe('growGrid', () => {
  const grid: TileChar[][] = [
    ['G', 'G'],
    ['R', 'R'],
  ];

  it('returns the grid unchanged with zero shift when the target is already in bounds', () => {
    const result = growGrid(grid, 1, 1);
    expect(result).toEqual({ grid, colShift: 0, rowShift: 0 });
  });

  it('grows right when col is beyond the current width', () => {
    const result = growGrid(grid, 3, 0);
    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(0);
    expect(result.grid).toEqual([
      ['G', 'G', '.', '.'],
      ['R', 'R', '.', '.'],
    ]);
  });

  it('grows down when row is beyond the current height', () => {
    const result = growGrid(grid, 0, 3);
    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(0);
    expect(result.grid).toEqual([
      ['G', 'G'],
      ['R', 'R'],
      ['.', '.'],
      ['.', '.'],
    ]);
  });

  it('grows left when col is negative, shifting every existing cell right and reporting colShift', () => {
    const result = growGrid(grid, -2, 0);
    expect(result.colShift).toBe(2);
    expect(result.rowShift).toBe(0);
    expect(result.grid).toEqual([
      ['.', '.', 'G', 'G'],
      ['.', '.', 'R', 'R'],
    ]);
  });

  it('grows up when row is negative, shifting every existing cell down and reporting rowShift', () => {
    const result = growGrid(grid, 0, -1);
    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(1);
    expect(result.grid).toEqual([
      ['.', '.'],
      ['G', 'G'],
      ['R', 'R'],
    ]);
  });

  it('grows both left and up simultaneously for a corner target, reporting both shifts', () => {
    const result = growGrid(grid, -1, -1);
    expect(result.colShift).toBe(1);
    expect(result.rowShift).toBe(1);
    expect(result.grid).toEqual([
      ['.', '.', '.'],
      ['.', 'G', 'G'],
      ['.', 'R', 'R'],
    ]);
  });

  it('preserves every existing cell value at its shifted index after growing left', () => {
    const result = growGrid(grid, -1, 0);
    expect(result.grid[0][result.colShift]).toBe('G');
    expect(result.grid[1][result.colShift + 1]).toBe('R');
  });
});
