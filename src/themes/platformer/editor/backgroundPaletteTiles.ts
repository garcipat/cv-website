import type { TileSpriteSpec } from './paletteTiles';
import { BACKGROUND_CATALOG } from '../engine/BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';

const SHEET = '/sprites/terrain_.png';
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
