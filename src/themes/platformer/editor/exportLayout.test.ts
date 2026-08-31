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

  it('exportLayout(importLayout(LEVEL_1_LAYOUT)) deep-equals LEVEL_1_LAYOUT', () => {
    expect(exportLayout(importLayout(LEVEL_1_LAYOUT))).toEqual(LEVEL_1_LAYOUT);
  });
});
