import { TILE_SIZE } from '../level/Terrain';
import type { BackgroundPieceId } from '../level/LevelData';

export interface BackgroundCatalogEntry {
  sx: number;
  sy: number;
  widthTiles: number;
  heightTiles: number;
}

type Variant = 'dirt' | 'charcoal';

const VARIANT_BASE_SY: Record<Variant, number> = {
  dirt: 0,
  charcoal: 80,
};

const BLOCK_ROW_OFFSET = 32;
const SPLIT_PIECE_BOTTOM_ROW_OFFSET = 48;

function block(
  variant: Variant,
  col: number,
  widthTiles: number,
  heightTiles: number,
  rowOffset: number = BLOCK_ROW_OFFSET,
): BackgroundCatalogEntry {
  return {
    sx: col * TILE_SIZE,
    sy: VARIANT_BASE_SY[variant] + rowOffset,
    widthTiles,
    heightTiles,
  };
}

export const BACKGROUND_CATALOG: Record<BackgroundPieceId, BackgroundCatalogEntry> = {
  dirtBlock3x3: block('dirt', 0, 3, 3),
  dirtBlockTop2x1: block('dirt', 3, 2, 1),
  dirtBlockBottom2x2: block('dirt', 3, 2, 2, SPLIT_PIECE_BOTTOM_ROW_OFFSET),
  dirtColumnTop1x1: block('dirt', 5, 1, 1),
  dirtColumnBottom1x2: block('dirt', 5, 1, 2, SPLIT_PIECE_BOTTOM_ROW_OFFSET),
  charcoalBlock3x3: block('charcoal', 0, 3, 3),
  charcoalBlockTop2x1: block('charcoal', 3, 2, 1),
  charcoalBlockBottom2x2: block('charcoal', 3, 2, 2, SPLIT_PIECE_BOTTOM_ROW_OFFSET),
  charcoalColumnTop1x1: block('charcoal', 5, 1, 1),
  charcoalColumnBottom1x2: block('charcoal', 5, 1, 2, SPLIT_PIECE_BOTTOM_ROW_OFFSET),
};

export function backgroundCatalogEntry(pieceId: BackgroundPieceId): BackgroundCatalogEntry {
  return BACKGROUND_CATALOG[pieceId];
}
