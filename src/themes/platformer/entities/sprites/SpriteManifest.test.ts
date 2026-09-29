import { describe, expect, it } from 'vitest';
import { SPRITE_MANIFEST } from './SpriteManifest';
import { collectSheetSources } from './SpriteSheet';
import { ENEMY_TYPES } from '../enemies';
import { PICKUP_TYPES } from '../pickups';
import { BLOCK_TYPES } from '../blocks';
import { DEPLOYABLE_ITEM_TYPES } from '../deployableItems';
import { chestDeployableItem } from '../chests';
import { CHECKPOINT_FLAG_SHEET } from '../Checkpoint';
import {
  KEY_SHEET,
  CRACK_OVERLAY_SHEET,
  CRUMBLE_FLOOR_SHEET,
  CRUMBLE_CRACKS_SHEET,
  DECORATIONS_SHEET,
  EXPLOSION_SHEET,
  SPEAR_SHEET,
  FLOOR_SPIKE_SHEET,
  BACKGROUND_LAYERS_SHEET,
  BACKGROUND_LAYER_GRASS_SHEET,
  BACKGROUND_LAYER_RIVER_SHEET,
  AMBIENT_CLOUDS_SHEET,
  BACKGROUND_TILES_SHEET,
  STATIC_OBJECTS_SHEET,
  TORCH_SHEET,
  MUSHROOM_SHEET,
  GROUND_ATLAS_SHEET,
  WORLD_TILESET_SHEET,
  CHEST_CLOSED_SHEET,
  HEARTS_SHEET,
  COIN_SHEET,
  FRUIT_SHEET,
  BOMB_SHEET,
  SLIME_GREEN_SHEET,
} from './sheets';
import { RESTART_PROMPT_FONT_FAMILY } from '../../engine/textDraw';
import { RESTART_PROMPT_FONT_URL } from '../../engine/render/HudRenderer';

const manifestSources = () => SPRITE_MANIFEST.images.map((entry) => entry.src);

describe('SpriteManifest', () => {
  it('registryWalk-coversEveryRegistryDerivedPrimarySheet', () => {
    // Arrange
    const expected = collectSheetSources([
      ...Object.values(ENEMY_TYPES).map((t) => t.sprite),
      ...Object.values(PICKUP_TYPES).map((t) => t.sprite),
      ...Object.values(BLOCK_TYPES).map((t) => t.sprite),
      ...Object.values(DEPLOYABLE_ITEM_TYPES).map((t) => t.sprite),
      chestDeployableItem.closed,
      chestDeployableItem.open,
      { sheet: KEY_SHEET, renderScale: 1, animations: {} },
      { sheet: CRACK_OVERLAY_SHEET, renderScale: 1, animations: {} },
      { sheet: CRUMBLE_FLOOR_SHEET, renderScale: 1, animations: {} },
      { sheet: CRUMBLE_CRACKS_SHEET, renderScale: 1, animations: {} },
      { sheet: DECORATIONS_SHEET, renderScale: 1, animations: {} },
    ]);

    // Act
    const sources = manifestSources();

    // Assert
    for (const src of expected) {
      expect(sources).toContain(src);
    }
  });

  it('handListedAssets-areAllPresent', () => {
    // Arrange — the frozen hand-listed coverage the page load block carried.
    const handListed = [
      '/sprites/knight.png',
      '/sprites/knight2.png',
      EXPLOSION_SHEET.src,
      SPEAR_SHEET.src,
      FLOOR_SPIKE_SHEET.src,
      HEARTS_SHEET.src,
      COIN_SHEET.src,
      FRUIT_SHEET.src,
      BOMB_SHEET.src,
      CHEST_CLOSED_SHEET.src,
      CHECKPOINT_FLAG_SHEET.src,
      WORLD_TILESET_SHEET.src,
      GROUND_ATLAS_SHEET.src,
      BACKGROUND_TILES_SHEET.src,
      STATIC_OBJECTS_SHEET.src,
      BACKGROUND_LAYERS_SHEET.src,
      BACKGROUND_LAYER_GRASS_SHEET.src,
      BACKGROUND_LAYER_RIVER_SHEET.src,
      AMBIENT_CLOUDS_SHEET.src,
      TORCH_SHEET.src,
      MUSHROOM_SHEET.src,
      SLIME_GREEN_SHEET.src,
    ];

    // Act
    const sources = manifestSources();

    // Assert
    for (const src of handListed) {
      expect(sources).toContain(src);
    }
  });

  it('images-areDedupedBySource', () => {
    // Arrange
    const sources = manifestSources();

    // Act
    const unique = new Set(sources);

    // Assert
    expect(unique.size).toBe(sources.length);
  });

  it('entries-defaultTheirKeyToTheSourcePath', () => {
    // Arrange / Act / Assert — the lookup contract is path-keyed, so today
    // every entry's effective key is its `src`.
    for (const entry of SPRITE_MANIFEST.images) {
      expect(entry.key ?? entry.src).toBe(entry.src);
    }
  });

  it('journalImage-isDeliberatelyAbsent', () => {
    // Arrange / Act / Assert — journal.png is a DOM <img>, not a canvas draw.
    expect(manifestSources()).not.toContain('/sprites/journal.png');
  });

  it('spearAndRestartPromptFont-areManifestEntries', () => {
    // Arrange / Act / Assert
    expect(manifestSources()).toContain(SPEAR_SHEET.src);
    expect(SPRITE_MANIFEST.fonts).toEqual([
      { family: RESTART_PROMPT_FONT_FAMILY, url: RESTART_PROMPT_FONT_URL },
    ]);
  });

  it('manifestAndItsParts-areFrozen', () => {
    // Arrange / Act / Assert
    expect(Object.isFrozen(SPRITE_MANIFEST)).toBe(true);
    expect(Object.isFrozen(SPRITE_MANIFEST.images)).toBe(true);
    expect(Object.isFrozen(SPRITE_MANIFEST.fonts)).toBe(true);
    expect(SPRITE_MANIFEST.images.every((entry) => Object.isFrozen(entry))).toBe(true);
    expect(SPRITE_MANIFEST.fonts.every((entry) => Object.isFrozen(entry))).toBe(true);
  });

  it('imageList-coversAtLeastTheThirtyOneFrozenAssetsAndEverySourceIsSpritesPrefixed', () => {
    // Arrange / Act / Assert — a hard floor on the coverage list so a
    // silently-dropped category fails here rather than only in production.
    expect(manifestSources().length).toBeGreaterThanOrEqual(31);
    expect(manifestSources().every((src) => src.startsWith('/sprites/'))).toBe(true);
  });
});
