import { describe, it, expect } from 'vitest';
import { paintCell } from './paintCell';
import type { TileChar } from '../level/LevelParser';

describe('paintCell', () => {
  it('writes the tool into the target cell, overwriting whatever was there', () => {
    const grid: TileChar[][] = [['G', 'G']];
    const result = paintCell(grid, 1, 0, 'R');
    expect(result.grid).toEqual([['G', 'R']]);
    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(0);
  });

  it('does not mutate the input grid', () => {
    const grid: TileChar[][] = [['G', 'G']];
    paintCell(grid, 1, 0, 'R');
    expect(grid).toEqual([['G', 'G']]);
  });

  it('grows the grid when painting out of bounds, remapping the target into the grown grid', () => {
    const grid: TileChar[][] = [['G']];
    const result = paintCell(grid, -1, 0, 'R');
    expect(result.colShift).toBe(1);
    expect(result.grid).toEqual([['R', 'G']]);
  });

  it('places a spawn marker normally when none exists yet', () => {
    const grid: TileChar[][] = [['.', '.']];
    const result = paintCell(grid, 0, 0, 'S');
    expect(result.grid).toEqual([['S', '.']]);
  });

  it('clears the previous spawn cell when placing a new spawn marker elsewhere', () => {
    const grid: TileChar[][] = [['S', '.']];
    const result = paintCell(grid, 1, 0, 'S');
    expect(result.grid).toEqual([['.', 'S']]);
  });

  it('is a no-op when re-placing the spawn marker on its own cell', () => {
    const grid: TileChar[][] = [['S', '.']];
    const result = paintCell(grid, 0, 0, 'S');
    expect(result.grid).toEqual([['S', '.']]);
  });

  it('does not clear an existing spawn when painting a non-spawn tool', () => {
    const grid: TileChar[][] = [['S', '.']];
    const result = paintCell(grid, 1, 0, 'G');
    expect(result.grid).toEqual([['S', 'G']]);
  });
});
