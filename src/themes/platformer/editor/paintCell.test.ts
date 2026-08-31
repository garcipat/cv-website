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

describe('paintCell — sign markers', () => {
  it('paintingSignToolOnEmptyCell-placesTheFirstUnusedRegisteredHint', () => {
    // Only '1' (bridgeDropThrough) is registered today, so this is
    // necessarily a same-digit assertion until a second hint exists — see
    // the next test for the actually-interesting "skip what's already
    // placed" case once there's something to skip.
    const grid: TileChar[][] = [['.', '.']];

    const result = paintCell(grid, 1, 0, '1');

    expect(result.grid[0][1]).toBe('1');
  });

  it('clickingAnAlreadyPlacedSign-cyclesToTheNextRegisteredHint', () => {
    // With only one hint registered, cycling a lone placed sign is
    // necessarily a same-digit no-op — this test documents that behavior
    // explicitly rather than leaving it unasserted, so a future second
    // SIGN_CHARS entry (which would make this actually cycle somewhere new)
    // has an existing test it visibly changes instead of silently gaining
    // new behavior nothing ever exercised.
    const grid: TileChar[][] = [['1', '.']];

    const result = paintCell(grid, 0, 0, '1');

    expect(result.grid[0][0]).toBe('1');
  });

  it('paintingSignToolOnEmptyCell-doesNotDisturbAnUnrelatedExistingSign', () => {
    const grid: TileChar[][] = [['1', '.']];

    const result = paintCell(grid, 1, 0, '1');

    // Today's single-hint registry means the second sign is forced to reuse
    // '1' too (the documented "every registered hint is already used
    // elsewhere" fallback) — but the FIRST sign must be left completely
    // untouched by painting the second one.
    expect(result.grid[0][0]).toBe('1');
    expect(result.grid[0][1]).toBe('1');
  });

  it('paintingNonSignTool-behavesExactlyAsBefore', () => {
    const grid: TileChar[][] = [['1', '.']];

    const result = paintCell(grid, 1, 0, 'G');

    expect(result.grid[0][1]).toBe('G');
    expect(result.grid[0][0]).toBe('1'); // unrelated cell untouched
  });
});
