import { signal, computed } from '@preact/signals-react';
import type { LevelDef, MarkerPlacement } from '../level/LevelData';
import { LEVEL_1_LAYOUT, LEVEL_1_BACKGROUND, LEVEL_1_MARKERS } from '../level/level';
import {
  parseLevel,
  parseBackgroundLayout,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findBeeTiles,
  findCoinTiles,
  findCrateTiles,
  findQuestionMarkTiles,
  findFragileRockTiles,
  findCoinPotTiles,
  findPotionPotTiles,
  findBombPotTiles,
  findChestTiles,
  findCheckpointTiles,
  findSignTiles,
  findHazardTiles,
  findTorchTiles,
  findLadderBundleTiles,
} from '../level/LevelParser';

/**
 * The live level session — the raw layout / background / marker layers the game
 * currently renders and simulates against, plus every value derived from them.
 * Seeded from the shipped level (`level/level.ts`) and overwritten only by the
 * Level Editor's Try button (`editor/editorActions.ts`). In-memory only (never
 * localStorage), so a reload always falls back to the shipped level. Kept in
 * one module so a test can mock the whole session with any level it needs
 * instead of depending on the shipped level's content.
 */
export const currentLayout = signal<readonly string[]>(LEVEL_1_LAYOUT);
export const currentBackgroundLayout = signal<readonly string[]>(LEVEL_1_BACKGROUND);
export const currentMarkers = signal<readonly MarkerPlacement[] | undefined>(LEVEL_1_MARKERS);

export const currentLevel = computed<LevelDef>(() => {
  const terrain = parseLevel(currentLayout.value, currentMarkers.value);
  return {
    ...terrain,
    background: parseBackgroundLayout(currentBackgroundLayout.value, terrain.width, terrain.height),
  };
});

export const SPAWN_TILE = computed(() => findSpawnTile(currentLayout.value));
export const ENEMY_TILES_GREEN = computed(() => findGreenEnemyTiles(currentLayout.value));
export const ENEMY_TILES_PURPLE = computed(() => findPurpleEnemyTiles(currentLayout.value));
export const BEE_TILES = computed(() => findBeeTiles(currentLayout.value));
export const COIN_TILES = computed(() => findCoinTiles(currentLayout.value));
export const CRATE_TILES = computed(() => findCrateTiles(currentLayout.value));
export const QUESTIONMARK_TILES = computed(() => findQuestionMarkTiles(currentLayout.value));
export const FRAGILE_ROCK_TILES = computed(() => findFragileRockTiles(currentLayout.value));
export const COIN_POT_TILES = computed(() => findCoinPotTiles(currentLayout.value));
export const POTION_POT_TILES = computed(() => findPotionPotTiles(currentLayout.value));
export const BOMB_POT_TILES = computed(() => findBombPotTiles(currentLayout.value));
export const CHEST_TILES = computed(() => findChestTiles(currentLayout.value));
export const CHECKPOINT_TILES = computed(() => findCheckpointTiles(currentLayout.value));
export const SIGN_TILES = computed(() =>
  findSignTiles(currentLayout.value, currentLevel.value.markers),
);
export const HAZARD_TILES = computed(() =>
  findHazardTiles(currentLayout.value, currentLevel.value.markers),
);
export const TORCH_TILES = computed(() => findTorchTiles(currentLayout.value));
export const LADDER_BUNDLE_TILES = computed(() => findLadderBundleTiles(currentLayout.value));
