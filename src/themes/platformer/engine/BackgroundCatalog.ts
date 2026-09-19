import { TILE_SIZE } from '../level/Terrain';
import type { BackgroundPieceFamily, BackgroundPieceId } from '../level/LevelData';

export interface BackgroundCatalogEntry {
  sx: number;
  sy: number;
  widthTiles: number;
  heightTiles: number;
  /** Intrinsic darkening family (FR-001/FR-021): `'cave'` pieces darken the
   *  view, `'surface'` pieces do not. */
  family: BackgroundPieceFamily;
}

type Variant = 'dirt' | 'charcoal';

/** `dirt` pieces are surface, `charcoal` pieces are cave — the one mapping
 *  that turns the catalog's existing art variant into its darkening family. */
const VARIANT_FAMILY: Record<Variant, BackgroundPieceFamily> = {
  dirt: 'surface',
  charcoal: 'cave',
};

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
    family: VARIANT_FAMILY[variant],
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

/**
 * A `pieceId` reaching this function at runtime isn't guaranteed to be a
 * *current* `BackgroundPieceId` — it can come from `localStorage` or a saved
 * level JSON file written before a catalog trim. Returns `undefined` for an
 * unrecognized id rather than throwing; callers (see `drawBackgroundTiles`)
 * must handle that case instead of assuming the entry always exists.
 */
export function backgroundCatalogEntry(pieceId: BackgroundPieceId): BackgroundCatalogEntry | undefined {
  return BACKGROUND_CATALOG[pieceId];
}

/**
 * A piece's intrinsic darkening family — the single fact the lighting pass
 * reads to decide whether a covered cell darkens (FR-001/FR-021). Mirrors
 * `backgroundCatalogEntry`'s stale-id contract: an id written before a
 * catalog trim resolves to `undefined` rather than throwing, and a caller must
 * treat `undefined` as "does not darken".
 */
export function backgroundPieceFamily(pieceId: BackgroundPieceId): BackgroundPieceFamily | undefined {
  return BACKGROUND_CATALOG[pieceId]?.family;
}
