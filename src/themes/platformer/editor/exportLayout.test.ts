import { describe, it, expect, vi } from 'vitest';
import { exportLayout } from './exportLayout';
import { importLayout } from './importLayout';
import { parseLevel } from '../level/LevelParser';
import { LEVEL_1_LAYOUT } from '../level/level';
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

  it('checkpointMarker-roundTripsVerbatimThroughImportAndExport', () => {
    const layout = ['C.S', 'GGG'];
    const grid = importLayout(layout);
    expect(grid[0][0]).toBe('C');
    expect(exportLayout(grid)).toEqual(layout);
    expect(() => parseLevel(exportLayout(grid))).not.toThrow();
  });

  it('mushroomChars-roundTripVerbatimThroughImportAndExport', () => {
    // A vertical `§` run plus a decorative `s`.
    const layout = ['§.S', '§.s', 'GGG'];
    const grid = importLayout(layout);
    expect(grid[0][0]).toBe('§');
    expect(grid[1][0]).toBe('§');
    expect(grid[1][2]).toBe('s');
    expect(exportLayout(grid)).toEqual(layout);
  });

  it('mushrooms-resolveThroughParseLevelWithNoUnknownCharacterWarning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const layout = ['§.S', '§.s', 'GGG'];

    const level = parseLevel(layout);

    expect(level.terrain[0][0]).toBe('bouncyMushroom');
    expect(level.terrain[1][0]).toBe('bouncyMushroom');
    expect(level.terrain[1][2]).toBe('decorativeMushroom');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('exportLayout(importLayout(LEVEL_1_LAYOUT)) keeps every row since LEVEL_1_LAYOUT (post ladder-shaft rows) has no longer any leading/trailing all-"." row, only an interior one (which stays, per crop semantics)', () => {
    // Content-cropping (this function's own job) is unconditional — spec
    // SC-010 — so it applies the same way to freshly-loaded data as to
    // anything the developer paints and erases down to this shape. As of
    // this writing LEVEL_1_LAYOUT's only all-'.' row sits between two
    // content rows (interior, not leading/trailing), so nothing is cropped;
    // the expected value is importLayout's own right-padded rows re-joined,
    // not the raw (jagged) LEVEL_1_LAYOUT constant.
    const paddedRows = importLayout(LEVEL_1_LAYOUT).map((row) => row.join(''));
    expect(exportLayout(importLayout(LEVEL_1_LAYOUT))).toEqual(paddedRows);
  });
});
