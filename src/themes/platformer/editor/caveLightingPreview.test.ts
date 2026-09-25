import { describe, it, expect } from 'vitest';
import {
  EDITOR_PREVIEW_DARKNESS,
  caveLightingPreview,
  torchLightsFromGrid,
} from './caveLightingPreview';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { TileChar } from '../level/LevelParser';
import { PLAYER_LIGHT_RADIUS_PX, PLAYER_GLOW_COLOR } from '../entities/Player';
import { TORCH_GLOW_COLOR } from '../entities/Torch';

const SPAWN_GRID: TileChar[][] = [
  ['.', '.', '.'],
  ['.', 'S', '.'],
  ['.', '.', '.'],
];

const TORCH_GRID: TileChar[][] = [
  ['.', '¥'],
  ['.', '.'],
];

describe('caveLightingPreview', () => {
  it('caveLightingPreview-withNoSpawnAndNoTorch-returnsMaxDarknessAndNoLights', () => {
    const preview = caveLightingPreview([
      ['.', '.'],
      ['.', '.'],
    ]);

    expect(preview.darknessLevel).toBe(EDITOR_PREVIEW_DARKNESS);
    expect(preview.lights).toEqual([]);
  });

  it('caveLightingPreview-withASpawn-returnsMaxDarknessAndTheCarriedLight', () => {
    const preview = caveLightingPreview(SPAWN_GRID);

    expect(preview.darknessLevel).toBe(EDITOR_PREVIEW_DARKNESS);
    expect(preview.lights).toHaveLength(1);
    expect(preview.lights[0]).toMatchObject({
      radius: PLAYER_LIGHT_RADIUS_PX,
      color: PLAYER_GLOW_COLOR,
      glowMidAlpha: 0.3,
      punchHole: true,
    });
  });

  it('caveLightingPreview-withATorch-resolvesItsLightAtTimeZero', () => {
    const preview = caveLightingPreview(TORCH_GRID);

    expect(preview.lights).toHaveLength(1);
    expect(preview.lights[0]).toMatchObject({
      x: RENDERED_TILE_SIZE + RENDERED_TILE_SIZE / 2,
      y: RENDERED_TILE_SIZE / 2,
      color: TORCH_GLOW_COLOR,
      intensity: 1,
      glowMidAlpha: 0.35,
      punchHole: true,
    });
    expect(preview.lights[0].radius).toBeGreaterThan(0);
  });

  it('caveLightingPreview-withATorchAndASpawn-listsTheTorchThenTheCarriedLight', () => {
    const grid: TileChar[][] = [
      ['.', '¥'],
      ['.', 'S'],
    ];

    const preview = caveLightingPreview(grid);

    expect(preview.lights).toHaveLength(2);
    expect(preview.lights[0].color).toBe(TORCH_GLOW_COLOR);
    expect(preview.lights[1].color).toBe(PLAYER_GLOW_COLOR);
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
        strength: 5,
      },
      {
        col: 0,
        row: 1,
        x: RENDERED_TILE_SIZE / 2,
        y: RENDERED_TILE_SIZE + RENDERED_TILE_SIZE / 2,
        strength: 5,
      },
    ]);
  });

  it('torchLightsFromGrid-withAStrengthMarker-usesThatStrength', () => {
    const torches = torchLightsFromGrid([['¥']], [[{ kind: 'torch', strength: 9 }]]);
    expect(torches[0]?.strength).toBe(9);
  });

  it('torchLightsFromGrid-withNoMarker-usesTheDefaultStrength', () => {
    const torches = torchLightsFromGrid([['¥']]);
    expect(torches[0]?.strength).toBe(5);
  });
});
