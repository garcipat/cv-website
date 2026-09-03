import { describe, it, expect } from 'vitest';
import { updatePanOffset, centerPanOnSpawn } from './EditorPan';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { TileChar } from '../level/LevelParser';

describe('updatePanOffset', () => {
  it('adds the drag delta to the current offset', () => {
    expect(updatePanOffset({ x: 0, y: 0 }, 10, -5)).toEqual({ x: 10, y: -5 });
  });

  it('accumulates across multiple calls', () => {
    const first = updatePanOffset({ x: 0, y: 0 }, 10, 10);
    const second = updatePanOffset(first, -3, 7);
    expect(second).toEqual({ x: 7, y: 17 });
  });

  it('does not mutate the input offset', () => {
    const current = { x: 0, y: 0 };
    updatePanOffset(current, 5, 5);
    expect(current).toEqual({ x: 0, y: 0 });
  });
});

describe('centerPanOnSpawn', () => {
  it('putsTheSpawnTilesCenterAtTheCanvasCenter', () => {
    // Spawn at col 3, row 2: its center sits at (3.5, 2.5) tiles, so the pan
    // has to shift the grid left/up by that much from the canvas midpoint.
    const grid: TileChar[][] = [
      ['.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.'],
      ['.', '.', '.', 'S', '.'],
    ];

    expect(centerPanOnSpawn(grid, 800, 480)).toEqual({
      x: 400 - 3.5 * RENDERED_TILE_SIZE,
      y: 240 - 2.5 * RENDERED_TILE_SIZE,
    });
  });

  it('spawnAtTheOrigin-stillCentersRatherThanReturningZero', () => {
    expect(centerPanOnSpawn([['S']], 800, 480)).toEqual({
      x: 400 - 0.5 * RENDERED_TILE_SIZE,
      y: 240 - 0.5 * RENDERED_TILE_SIZE,
    });
  });

  it('noSpawnMarker-fallsBackToTheUnpannedOrigin', () => {
    // A grid can legitimately be spawn-less mid-edit (the marker was erased
    // and not yet repainted); centering on nothing must not produce NaN.
    expect(centerPanOnSpawn([['.', 'G']], 800, 480)).toEqual({ x: 0, y: 0 });
  });
});
