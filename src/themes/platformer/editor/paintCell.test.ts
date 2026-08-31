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
    const grid: TileChar[][] = [['.', '.']];

    const result = paintCell(grid, 1, 0, '1');

    expect(result.grid[0][1]).toBe('1');
  });

  it('clickingAnAlreadyPlacedSign-cyclesToTheNextRegisteredHint', () => {
    // Now genuinely exercised: 5 hints are registered (SIGN_CHARS '1'-'5'),
    // so cycling the lone placed sign moves to the next digit, not a
    // same-digit no-op.
    const grid: TileChar[][] = [['1', '.']];

    const result = paintCell(grid, 0, 0, '1');

    expect(result.grid[0][0]).toBe('2');
  });

  it('cyclingRepeatedly-walksThroughEveryRegisteredHintInOrderThenWrapsAround', () => {
    let grid: TileChar[][] = [['1', '.']];
    const seen: TileChar[] = [];
    for (let i = 0; i < 5; i++) {
      const result = paintCell(grid, 0, 0, '1');
      seen.push(result.grid[0][0]);
      grid = result.grid;
    }

    expect(seen).toEqual(['2', '3', '4', '5', '1']);
  });

  it('paintingSignToolOnEmptyCell-doesNotDisturbAnUnrelatedExistingSign-andSkipsTheAlreadyUsedHint', () => {
    const grid: TileChar[][] = [['1', '.']];

    const result = paintCell(grid, 1, 0, '1');

    // '1' is already used elsewhere on the map, so the new sign gets the
    // next unused hint ('2') instead of duplicating '1' — and the first
    // sign is left completely untouched.
    expect(result.grid[0][0]).toBe('1');
    expect(result.grid[0][1]).toBe('2');
  });

  it('everyRegisteredHintAlreadyUsedElsewhere-fallsBackToReusingTheStartingDigit', () => {
    // Edge case from the doc comment: once every registered hint (1-5) is
    // already placed somewhere else, a new placement has nothing unused
    // left to grab and falls back to the tool's own starting digit rather
    // than leaving the cell unpainted.
    const grid: TileChar[][] = [['1', '2', '3', '4', '5', '.']];

    const result = paintCell(grid, 5, 0, '1');

    expect(result.grid[0][5]).toBe('1');
  });

  it('paintingNonSignTool-behavesExactlyAsBefore', () => {
    const grid: TileChar[][] = [['1', '.']];

    const result = paintCell(grid, 1, 0, 'G');

    expect(result.grid[0][1]).toBe('G');
    expect(result.grid[0][0]).toBe('1'); // unrelated cell untouched
  });
});
