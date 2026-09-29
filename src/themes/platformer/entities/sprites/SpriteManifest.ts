import { collectSheetSources } from './SpriteSheet';
import type { SpriteDescriptor } from './SpriteSheet';
import {
  KEY_SHEET,
  CRACK_OVERLAY_SHEET,
  CRUMBLE_FLOOR_SHEET,
  CRUMBLE_CRACKS_SHEET,
  WORLD_TILESET_SHEET,
  CHEST_CLOSED_SHEET,
  GROUND_ATLAS_SHEET,
  BACKGROUND_TILES_SHEET,
  STATIC_OBJECTS_SHEET,
  BACKGROUND_LAYERS_SHEET,
  BACKGROUND_LAYER_GRASS_SHEET,
  BACKGROUND_LAYER_RIVER_SHEET,
  AMBIENT_CLOUDS_SHEET,
  DECORATIONS_SHEET,
  MUSHROOM_SHEET,
  TORCH_SHEET,
  EXPLOSION_SHEET,
  SPEAR_SHEET,
  FLOOR_SPIKE_SHEET,
} from './sheets';
import { ENEMY_TYPES } from '../enemies';
import { PICKUP_TYPES } from '../pickups';
import { BLOCK_TYPES } from '../blocks';
import { DEPLOYABLE_ITEM_TYPES } from '../deployableItems';
import { chestDeployableItem } from '../chests';
import { CHECKPOINT_FLAG_SHEET } from '../Checkpoint';

/**
 * One image the canvas render path needs. `key` defaults to `src`, so the
 * lookup's path-keyed contract (see `contracts/SpriteLookup.ts`) is unchanged
 * even though a non-identity key can be expressed later.
 */
export interface SpriteManifestEntry {
  readonly src: string;
  readonly key?: string;
}

/** One font the canvas text path needs — a family plus its file URL. */
export interface FontManifestEntry {
  readonly family: string;
  readonly url: string;
}

/**
 * Every image and font the platformer's canvas render path loads, as pure
 * data. Built at module load, with no I/O and no state write — the loader
 * (`engine/AssetLoader.ts`) turns it into a live path-keyed `SpriteLookup`.
 */
export interface SpriteManifest {
  readonly images: readonly SpriteManifestEntry[];
  readonly fonts: readonly FontManifestEntry[];
}

/**
 * The restart-prompt font's family/URL. These literals intentionally mirror
 * `engine/textDraw.ts`'s `RESTART_PROMPT_FONT_FAMILY` and
 * `engine/render/HudRenderer.ts`'s `RESTART_PROMPT_FONT_URL`: the manifest is
 * an `entities/` module and a manifest entry is pure data, so it cannot import
 * the engine constants that describe the same asset. `SpriteManifest.test.ts`
 * asserts the two stay equal.
 */
const RESTART_PROMPT_FAMILY = 'ByteBounce';
const RESTART_PROMPT_URL = '/fonts/bytebounce.medium.ttf';

/**
 * The player/player-jump sheets have no registry of their own (the player is
 * not an `ENEMY_TYPES` entry), so their sources stay hand-listed exactly as
 * the page hand-listed them.
 */
const PLAYER_SHEET_SRC = '/sprites/knight.png';
const PLAYER_JUMP_SHEET_SRC = '/sprites/knight2.png';

/**
 * Secondary/sequence sheets that are no type's primary descriptor — they
 * cannot be discovered by walking a registry, so they are hand-listed here,
 * matching the page's own `collectSheetSources` walk.
 */
const REGISTRY_DESCRIPTORS: readonly SpriteDescriptor[] = [
  ...Object.values(ENEMY_TYPES).map((t) => t.sprite),
  ...Object.values(PICKUP_TYPES).map((t) => t.sprite),
  ...Object.values(BLOCK_TYPES).map((t) => t.sprite),
  ...Object.values(DEPLOYABLE_ITEM_TYPES).map((t) => t.sprite),
  chestDeployableItem.closed,
  chestDeployableItem.open,
  // The purple slime's held-key shine-through.
  { sheet: KEY_SHEET, renderScale: 1, animations: {} },
  // The crate's secondary crack overlay.
  { sheet: CRACK_OVERLAY_SHEET, renderScale: 1, animations: {} },
  { sheet: CRUMBLE_FLOOR_SHEET, renderScale: 1, animations: {} },
  { sheet: CRUMBLE_CRACKS_SHEET, renderScale: 1, animations: {} },
  { sheet: DECORATIONS_SHEET, renderScale: 1, animations: {} },
];

/**
 * The distinct image sources, in a fixed order, each exactly once. The
 * registry walk comes first (so a type registered later still loads), then
 * the hand-listed secondary/sequence sheets, the directly-read single-image
 * sheets and the atlases/background layers.
 */
const IMAGE_SOURCES: readonly string[] = [
  ...collectSheetSources(REGISTRY_DESCRIPTORS),
  // Player sheets — not registry-discovered.
  PLAYER_SHEET_SRC,
  PLAYER_JUMP_SHEET_SRC,
  // Standalone single-image sheets the HUD/terrain draw directly.
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
  CHEST_CLOSED_SHEET.src,
  CHECKPOINT_FLAG_SHEET.src,
  // Sequence/test sheets no registry walks.
  EXPLOSION_SHEET.src,
  SPEAR_SHEET.src,
  FLOOR_SPIKE_SHEET.src,
];

const uniqueImageSources: readonly string[] = [...new Set(IMAGE_SOURCES)];

/**
 * THE declarative image + font list the platformer loads. Frozen: no consumer
 * may mutate it, and adding a sprite is one entry here.
 *
 * `/sprites/journal.png` is deliberately absent — it is a DOM `<img>` in the
 * page's JSX, never a canvas draw, so the render path never loads it.
 */
export const SPRITE_MANIFEST: SpriteManifest = Object.freeze({
  images: Object.freeze(uniqueImageSources.map((src) => Object.freeze({ src }))),
  fonts: Object.freeze([Object.freeze({ family: RESTART_PROMPT_FAMILY, url: RESTART_PROMPT_URL })]),
});
