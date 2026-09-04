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
  dirtColumnA: 'Dirt Column A',
  charcoalBlock3x3: 'Charcoal Block (3×3)',
  charcoalColumnA: 'Charcoal Column A',
};
