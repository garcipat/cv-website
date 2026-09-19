import type { TileSpriteSpec } from './paletteTiles';
import { BACKGROUND_CATALOG, backgroundPieceFamily } from '../engine/BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';
import { TERRAIN_BACKGROUND_SHEET } from '../entities/sprites/sheets';

const SHEET = TERRAIN_BACKGROUND_SHEET.src;
const SHEET_WIDTH = 128;
const SHEET_HEIGHT = 320;

function spriteFor(pieceId: BackgroundPieceId): TileSpriteSpec {
  const entry = BACKGROUND_CATALOG[pieceId];
  return {
    sheet: SHEET,
    sheetWidth: SHEET_WIDTH,
    sheetHeight: SHEET_HEIGHT,
    sx: entry.sx,
    sy: entry.sy,
    frameWidth: entry.widthTiles * 16,
    frameHeight: entry.heightTiles * 16,
  };
}

const PIECE_IDS = Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[];

export const BACKGROUND_PALETTE_SPRITES: Record<BackgroundPieceId, TileSpriteSpec> = Object.fromEntries(
  PIECE_IDS.map((pieceId) => [pieceId, spriteFor(pieceId)]),
) as Record<BackgroundPieceId, TileSpriteSpec>;

export const BACKGROUND_PALETTE_LABELS: Record<BackgroundPieceId, string> = {
  dirtBlock3x3: 'Dirt Block (3×3)',
  dirtBlockTop2x1: 'Dirt Block Top (2×1)',
  dirtBlockBottom2x2: 'Dirt Block Bottom (2×2)',
  dirtColumnTop1x1: 'Dirt Column Top (1×1)',
  dirtColumnBottom1x2: 'Dirt Column Bottom (1×2)',
  charcoalBlock3x3: 'Charcoal Block (3×3)',
  charcoalBlockTop2x1: 'Charcoal Block Top (2×1)',
  charcoalBlockBottom2x2: 'Charcoal Block Bottom (2×2)',
  charcoalColumnTop1x1: 'Charcoal Column Top (1×1)',
  charcoalColumnBottom1x2: 'Charcoal Column Bottom (1×2)',
};

/** One labelled, collapsible group of background pieces in the editor's
 *  background palette (contracts/editor-palette.md). */
export interface BackgroundPaletteSection {
  title: string;
  pieceIds: BackgroundPieceId[];
}

/**
 * The background palette's Surface/Cave split (FR-020/FR-021). Membership is
 * derived from each piece's own catalog `family` — never hand-listed — so a
 * new piece lands in the right section automatically. A single module-level
 * constant computed once gives every call site the same stable order (Surface
 * first, then Cave).
 */
export const BACKGROUND_PALETTE_SECTIONS: readonly BackgroundPaletteSection[] = [
  {
    title: 'Surface',
    pieceIds: PIECE_IDS.filter((pieceId) => backgroundPieceFamily(pieceId) === 'surface'),
  },
  {
    title: 'Cave',
    pieceIds: PIECE_IDS.filter((pieceId) => backgroundPieceFamily(pieceId) === 'cave'),
  },
];
