/**
 * Shared native-pixel sprite-crop shapes for the tile layer. Both are
 * pure structural types relocated from `engine/StaticObjectsCatalog.ts` when
 * its tables were distributed to their owning tile modules; kept in one small
 * tile-layer leaf so `chain.ts`/`ropeLadder.ts` and the decoration modules can
 * share them without importing each other.
 */

/**
 * One decoration sprite's crop in native sheet pixels. `width`/`height` are
 * omitted (and treated as the standard 16x16 tile) for every entry whose art
 * fills a whole cell; only hand-spaced sheets (e.g. `decorations.png`) set them
 * explicitly, since that sheet's icons have real gaps between them and aren't
 * all exactly 16x16.
 */
export interface StaticObjectEntry {
  sx: number;
  sy: number;
  width?: number;
  height?: number;
}

/**
 * One chain/rope-ladder piece rect, sized to its own true pixel dimensions
 * unlike a `StaticObjectEntry`, these pieces are NOT 16x16: the artist's link
 * pieces don't divide evenly into a 16px tile, so the compositing helpers stack
 * them by their native sizes rather than a fixed grid.
 */
export interface ChainPieceRect {
  sx: number;
  sy: number;
  width: number;
  height: number;
}
