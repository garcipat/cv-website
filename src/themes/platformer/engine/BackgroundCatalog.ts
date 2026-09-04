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

function block(variant: Variant, col: number, widthTiles: number, heightTiles: number): BackgroundCatalogEntry {
  return {
    sx: col * TILE_SIZE,
    sy: VARIANT_BASE_SY[variant] + BLOCK_ROW_OFFSET,
    widthTiles,
    heightTiles,
  };
}

export const BACKGROUND_CATALOG: Record<BackgroundPieceId, BackgroundCatalogEntry> = {
  dirtBlock3x3: block('dirt', 0, 3, 3),
  dirtColumnA: block('dirt', 5, 1, 3),
  charcoalBlock3x3: block('charcoal', 0, 3, 3),
  charcoalColumnA: block('charcoal', 5, 1, 3),
};

export function backgroundCatalogEntry(pieceId: BackgroundPieceId): BackgroundCatalogEntry {
  return BACKGROUND_CATALOG[pieceId];
}
