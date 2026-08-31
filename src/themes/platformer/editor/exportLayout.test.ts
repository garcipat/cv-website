import { describe, it, expect } from 'vitest';
import { exportLayout } from './exportLayout';
import { importLayout } from './importLayout';
import { parseLevel } from '../level/LevelParser';
import { LEVEL_1_LAYOUT } from '../level/level1';
import type { TileChar } from '../level/LevelParser';

describe('exportLayout', () => {
  it('joins each row into a string, matching the grid exactly when fully painted', () => {
    const grid: TileChar[][] = [
      ['G', 'G', 'S'],
      ['R', 'R', 'R'],
    ];
    expect(exportLayout(grid)).toEqual(['GGS', 'RRR']);
  });

  it('crops to the tightest bounding box containing every non-"." cell', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.', '.'],
      ['.', 'G', 'S', '.'],
      ['.', 'R', 'R', '.'],
      ['.', '.', '.', '.'],
    ];
    expect(exportLayout(grid)).toEqual(['GS', 'RR']);
  });

  it('returns [\'.\'] when every cell is "."', () => {
    const grid: TileChar[][] = [
      ['.', '.'],
      ['.', '.'],
    ];
    expect(exportLayout(grid)).toEqual(['.']);
  });

  it('round-trips through parseLevel without throwing', () => {
    const grid: TileChar[][] = [
      ['.', 'S', '.'],
      ['G', 'G', 'G'],
    ];
    expect(() => parseLevel(exportLayout(grid))).not.toThrow();
  });

  it('exportLayout(importLayout(LEVEL_1_LAYOUT)) crops away LEVEL_1_LAYOUT\'s leading blank row, keeping every real tile', () => {
    // LEVEL_1_LAYOUT has a deliberate leading all-'.' row (game rendering
    // margin) and no other padding — content-cropping (this function's own
    // job) removes exactly that row on export, even for unedited data.
    // This is a ruling recorded in the SDD ledger: cropping is unconditional
    // (spec SC-010), so it applies the same way to freshly-loaded data as to
    // anything the developer paints and erases down to this shape.
    expect(exportLayout(importLayout(LEVEL_1_LAYOUT))).toEqual(LEVEL_1_LAYOUT.slice(1));
  });
});
