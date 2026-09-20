import type { BackgroundMaterialId } from '../level/LevelData';

/**
 * `background_tiles.png` holds 16px tiles on a 19px stride (16px tile plus a
 * 3px transparent gutter) — same convention as `GroundAtlas.ts`'s
 * `ATLAS_STRIDE`. Six materials are stacked vertically, each a 4-column by
 * 3-row block; `BACKGROUND_ATLAS_ROW_PITCH` is the vertical distance from one
 * material's block to the next (`3*16 + 2*3` for the three gutter-separated
 * rows, plus the extra 6px gap between materials — see data-model.md).
 */
export const BACKGROUND_ATLAS_STRIDE = 19;
export const BACKGROUND_ATLAS_ROW_PITCH = 60;

/** Quarter-turns clockwise applied when drawing — reused from GroundAtlas.ts's
 *  own convention rather than redeclared with different semantics. */
export type QuarterTurns = 0 | 1 | 2 | 3;

export interface BackgroundAtlasEntry {
  sx: number;
  sy: number;
  rotation: QuarterTurns;
}

/** Each material's row index (0-5) within the sheet, top to bottom. */
const BACKGROUND_MATERIAL_ROW_INDEX: Record<BackgroundMaterialId, number> = {
  dirt: 0,
  rust: 1,
  surfaceStone: 2,
  caveStone: 3,
  maroon: 4,
  charcoal: 5,
};

/** Per-material 4x3 grid coordinates (see data-model.md's sheet layout table):
 *  gy 0-2 (corner/edge/corner, edge/middle/edge, corner/edge/corner rows),
 *  gx 0-3 (the four shapes tiled across each row, with column 3 holding the
 *  strip-cap/strip-body/isolated shapes). */
function cell(materialIndex: number, gx: number, gy: number): { sx: number; sy: number } {
  return {
    sx: gx * BACKGROUND_ATLAS_STRIDE,
    sy: materialIndex * BACKGROUND_ATLAS_ROW_PITCH + gy * BACKGROUND_ATLAS_STRIDE,
  };
}

/**
 * The shared mask -> (gx, gy, rotation) shape, identical for every material
 * (data-model.md's 16-entry mask table) — only the material's row index
 * changes which physical tiles these coordinates land on. Six physical tiles
 * per material (isolated, corner, edge, middle, stripCap, stripBody) cover
 * all 16 masks: the four corner and four edge orientations are each authored
 * directly in the sheet (rotation 0), while stripCap/stripBody are reused
 * across multiple masks via an actual rotation (see data-model.md's note on
 * corner/edge rotation).
 */
const MASK_SHAPE: Record<number, { gx: number; gy: number; rotation: QuarterTurns }> = {
  // Column 4 (gx 3) holds three physical shapes whose sheet order doesn't
  // match their (gx, gy) "slot" name in data-model.md: row 0 is actually the
  // isolated tile (bordered on all 4 sides), row 1 is actually the strip-cap
  // shape (bordered on 3 sides, open on 1), and row 2 is the strip-body shape
  // — but authored with its open sides running left/right, not top/bottom,
  // so its own rotation-0 already means "connects left+right" (mask 10), and
  // one quarter turn is what produces "connects up+down" (mask 5) — the
  // reverse of what the slot names suggest. Verified directly against the
  // sheet's pixel borders (each tile's border/open sides), not assumed from
  // the original authoring plan.
  0: { gx: 3, gy: 0, rotation: 0 }, // isolated
  1: { gx: 3, gy: 1, rotation: 2 }, // strip-cap shape, 180 (up only)
  2: { gx: 3, gy: 1, rotation: 3 }, // strip-cap shape, 270 (right only)
  3: { gx: 0, gy: 2, rotation: 0 }, // corner BL (up+right)
  4: { gx: 3, gy: 1, rotation: 0 }, // strip-cap shape (down only)
  5: { gx: 3, gy: 2, rotation: 1 }, // strip-body shape, 90 (up+down)
  6: { gx: 0, gy: 0, rotation: 0 }, // corner TL (right+down)
  7: { gx: 0, gy: 1, rotation: 0 }, // edge L (up+right+down)
  8: { gx: 3, gy: 1, rotation: 1 }, // strip-cap shape, 90 (left only)
  9: { gx: 2, gy: 2, rotation: 0 }, // corner BR (up+left)
  10: { gx: 3, gy: 2, rotation: 0 }, // strip-body shape (left+right)
  11: { gx: 1, gy: 2, rotation: 0 }, // edge B (up+right+left)
  12: { gx: 2, gy: 0, rotation: 0 }, // corner TR (down+left)
  13: { gx: 2, gy: 1, rotation: 0 }, // edge R (up+down+left)
  14: { gx: 1, gy: 0, rotation: 0 }, // edge T (right+down+left)
  15: { gx: 1, gy: 1, rotation: 0 }, // middle (fully interior)
};

/**
 * Built once from `MASK_SHAPE` x every material's row index, rather than
 * repeating the 16-entry table six times (data-model.md explicitly calls
 * this deduplication out).
 */
const BACKGROUND_ATLAS: Record<BackgroundMaterialId, Record<number, BackgroundAtlasEntry>> =
  Object.fromEntries(
    (Object.keys(BACKGROUND_MATERIAL_ROW_INDEX) as BackgroundMaterialId[]).map((material) => {
      const materialIndex = BACKGROUND_MATERIAL_ROW_INDEX[material];
      const table = Object.fromEntries(
        Object.entries(MASK_SHAPE).map(([mask, { gx, gy, rotation }]) => [
          mask,
          { ...cell(materialIndex, gx, gy), rotation },
        ]),
      );
      return [material, table];
    }),
  ) as Record<BackgroundMaterialId, Record<number, BackgroundAtlasEntry>>;

/**
 * Looks up the sprite + rotation for `material` at the given 4-bit neighbour
 * mask (0-15). Throws for a mask outside that range, mirroring
 * `groundAtlasCell`'s throw-on-missing contract — `backgroundNeighbourMask`
 * only ever produces a value in [0, 15], so this should never happen in
 * practice.
 */
export function backgroundAtlasCell(material: BackgroundMaterialId, mask: number): BackgroundAtlasEntry {
  const entry = BACKGROUND_ATLAS[material]?.[mask];
  if (!entry) {
    throw new Error(`No background atlas entry for material "${material}" mask ${mask}`);
  }
  return entry;
}
