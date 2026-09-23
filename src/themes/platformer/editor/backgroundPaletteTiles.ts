import type { TileSpriteSpec } from './paletteTiles';
import { backgroundAtlasCell } from '../engine/BackgroundAtlas';
import { BACKGROUND_MATERIAL_FAMILY, backgroundMaterialFamily } from '../level/LevelData';
import type { BackgroundMaterialId } from '../level/LevelData';
import { BACKGROUND_CHARS } from '../level/LevelParser';
import type { BackgroundChar } from '../level/LevelParser';
import { BACKGROUND_TILES_SHEET } from '../entities/sprites/sheets';

const SHEET = BACKGROUND_TILES_SHEET.src;
const SHEET_WIDTH = 73;
const SHEET_HEIGHT = 354;

/** Fully-isolated (mask 0) sprite — bordered on all four sides — as the
 *  palette preview. A palette swatch has no real neighbours to autotile
 *  against, and the mask-15 "middle" tile has no border at all, so it reads
 *  as an indistinct texture crop at swatch size; the isolated tile's closed
 *  border reads clearly as "this material" instead. */
const ISOLATED_MASK = 0;

function spriteFor(material: BackgroundMaterialId): TileSpriteSpec {
  const entry = backgroundAtlasCell(material, ISOLATED_MASK);
  return {
    sheet: SHEET,
    sheetWidth: SHEET_WIDTH,
    sheetHeight: SHEET_HEIGHT,
    sx: entry.sx,
    sy: entry.sy,
    frameWidth: 16,
    frameHeight: 16,
  };
}

const MATERIAL_IDS = Object.keys(BACKGROUND_MATERIAL_FAMILY) as BackgroundMaterialId[];

export const BACKGROUND_PALETTE_SPRITES: Record<BackgroundMaterialId, TileSpriteSpec> = Object.fromEntries(
  MATERIAL_IDS.map((material) => [material, spriteFor(material)]),
) as Record<BackgroundMaterialId, TileSpriteSpec>;

/**
 * The inverse of `BACKGROUND_CHARS` (`LevelParser.ts`) — every material's own
 * paint character, one entry per key of `BACKGROUND_MATERIAL_FAMILY`. The
 * palette groups swatches by material (Surface/Cave family, sprite, label)
 * exactly as before O-014's storage revision, but what a swatch's click
 * actually *selects* is now a `BackgroundChar` (the same "tool" shape
 * `editorSelectedToolSignal`/`selectTool` already have for foreground), not a
 * `BackgroundMaterialId` — this is the one place that translates between the
 * two.
 */
export const BACKGROUND_MATERIAL_CHAR: Record<BackgroundMaterialId, BackgroundChar> = Object.fromEntries(
  Object.entries(BACKGROUND_CHARS).map(([char, material]) => [material, char]),
) as Record<BackgroundMaterialId, BackgroundChar>;

export const BACKGROUND_PALETTE_LABELS: Record<BackgroundMaterialId, string> = {
  dirt: 'Dirt',
  rust: 'Rust',
  surfaceStone: 'Surface Stone',
  charcoal: 'Charcoal',
  maroon: 'Maroon',
  caveStone: 'Cave Stone',
  wood: 'Wood',
};

/** One labelled, collapsible group of background materials in the editor's
 *  background palette (FR-011). */
export interface BackgroundPaletteSection {
  title: string;
  materialIds: BackgroundMaterialId[];
}

/**
 * The background palette's Surface/Cave split (FR-011). Membership is
 * derived from each material's own `backgroundMaterialFamily` — never
 * hand-listed — so a new material lands in the right section automatically.
 * A single module-level constant computed once gives every call site the
 * same stable order (Surface first, then Cave).
 */
export const BACKGROUND_PALETTE_SECTIONS: readonly BackgroundPaletteSection[] = [
  {
    title: 'Surface',
    materialIds: MATERIAL_IDS.filter((material) => backgroundMaterialFamily(material) === 'surface'),
  },
  {
    title: 'Cave',
    materialIds: MATERIAL_IDS.filter((material) => backgroundMaterialFamily(material) === 'cave'),
  },
];
