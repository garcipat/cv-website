import { describe, it, expect } from 'vitest';
import {
  EDITOR_PREVIEW_DARKNESS,
  caveLightingPreview,
  torchLightsFromGrid,
} from './caveLightingPreview';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { TileChar } from '../level/LevelParser';

const SPAWN_GRID: TileChar[][] = [
  ['.', '.', '.'],
  ['.', 'S', '.'],
  ['.', '.', '.'],
];

describe('caveLightingPreview', () => {
  it('caveLightingPreview-withNoSpawn-returnsMaxDarknessAndNoPlayerLight', () => {
    const preview = caveLightingPreview([
      ['.', '.'],
      ['.', '.'],
    ]);

    expect(preview.darknessLevel).toBe(EDITOR_PREVIEW_DARKNESS);
    expect(preview.playerLight).toBeNull();
  });

  it('caveLightingPreview-withASpawn-returnsMaxDarknessAndTheCarriedLight', () => {
    const preview = caveLightingPreview(SPAWN_GRID);

    expect(preview.darknessLevel).toBe(EDITOR_PREVIEW_DARKNESS);
    expect(preview.playerLight).not.toBeNull();
  });

  it('caveLightingPreview-regardlessOfSpawnPosition-returnsMaxDarkness', () => {
    const moved: TileChar[][] = [
      ['S', '.', '.'],
      ['.', '.', '.'],
      ['.', '.', '.'],
    ];

    expect(caveLightingPreview(SPAWN_GRID).darknessLevel).toBe(EDITOR_PREVIEW_DARKNESS);
    expect(caveLightingPreview(moved).darknessLevel).toBe(EDITOR_PREVIEW_DARKNESS);
  });

  it('caveLightingPreview-doesNotMutateItsArgument', () => {
    const grid = SPAWN_GRID.map((row) => [...row]);

    caveLightingPreview(grid);

    expect(grid).toEqual(SPAWN_GRID);
  });

  it('torchLightsFromGrid-withNoTorchTiles-returnsEmpty', () => {
    expect(
      torchLightsFromGrid([
        ['.', 'G'],
        ['#', 'B'],
      ]),
    ).toEqual([]);
  });

  it('torchLightsFromGrid-withTorchTiles-returnsTheirWorldCentres', () => {
    const torches = torchLightsFromGrid([
      ['.', '¥'],
      ['¥', '.'],
    ]);

    expect(torches).toEqual([
      {
        col: 1,
        row: 0,
        x: RENDERED_TILE_SIZE + RENDERED_TILE_SIZE / 2,
        y: RENDERED_TILE_SIZE / 2,
      },
      {
        col: 0,
        row: 1,
        x: RENDERED_TILE_SIZE / 2,
        y: RENDERED_TILE_SIZE + RENDERED_TILE_SIZE / 2,
      },
    ]);
  });
});
