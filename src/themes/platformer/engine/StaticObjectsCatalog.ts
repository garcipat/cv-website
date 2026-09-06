import type { ChainAttachment, VerticalRunRole } from '../level/Terrain';

export interface StaticObjectEntry {
  sx: number;
  sy: number;
}

/** One or more sprite variants per role. A cell's variant is picked
 *  deterministically from its own column and row (see `pickVariant`) so
 *  neighbouring cells of the same role don't all look identical once a
 *  role gains more than one variant — with exactly one variant per role
 *  today, every position resolves to that single entry. */
const BUSH_OR_TREE_VARIANTS: Record<VerticalRunRole, StaticObjectEntry[]> = {
  only: [
    { sx: 16, sy: 48 },
    { sx: 16, sy: 64 },
    { sx: 16, sy: 80 },
    { sx: 16, sy: 96 },
  ],
  bottom: [{ sx: 0, sy: 80 }],
  middle: [{ sx: 0, sy: 64 }],
  top: [{ sx: 0, sy: 48 }],
};

const FENCE_VARIANTS: StaticObjectEntry[] = [{ sx: 32, sy: 64 }];

/**
 * One fixed sprite for `crystalCluster`, from the separate `decorations.png`
 * sheet (see `sprites/sheets.ts`'s `DECORATIONS_SHEET`) — same "one variant per
 * role" convention as `FENCE_VARIANTS` above: it never forms multi-tile runs
 * and never varies by position, so it's a length-1 array rather than a
 * `VerticalRunRole`-keyed record like `BUSH_OR_TREE_VARIANTS`.
 */
const CRYSTAL_CLUSTER_VARIANTS: StaticObjectEntry[] = [{ sx: 32, sy: 0 }];

/**
 * The corner and flat cobweb sprites, from `decorations.png`. Unlike
 * `crystalCluster`/`stalactite`/`stalagmite`, which of these two draws is NOT
 * picked from position hash — it's driven entirely by
 * `Terrain.ts`'s `cobwebOrientation` (does this cell sit in a corner formed by
 * two adjacent solid neighbours?), so each is kept as its own named single
 * entry rather than routed through `pickVariant`.
 */
export const COBWEB_CORNER_ENTRY: StaticObjectEntry = { sx: 0, sy: 0 };
export const COBWEB_FLAT_ENTRY: StaticObjectEntry = { sx: 16, sy: 0 };

/**
 * Size variants for `stalactite`/`stalagmite` — a level author places one
 * tile each; which size (large or twin) renders at a given cell is picked
 * deterministically from its own position (see `pickVariant`), the same way
 * `BUSH_OR_TREE_VARIANTS`'s `only` role already picks among 4 bush sizes.
 */
const STALACTITE_VARIANTS: StaticObjectEntry[] = [
  { sx: 48, sy: 0 }, // large
  { sx: 0, sy: 16 }, // twin
];
const STALAGMITE_VARIANTS: StaticObjectEntry[] = [
  { sx: 16, sy: 16 }, // large
  { sx: 32, sy: 16 }, // twin
];

/** One hand-drawn chain sprite, sized to its own true pixel dimensions —
 *  unlike every other `StaticObjectEntry` here, chain art is NOT 16x16:
 *  the artist's link pieces don't divide evenly into a 16px tile (a link's
 *  true vertical repeat is 6px, and 16 isn't a multiple of 6), so each piece
 *  keeps its native width/height rather than being forced into a fixed grid
 *  cell. `chainRunPieces` below stacks these directly, letting a shaft's
 *  total height come from the pieces' own sizes rather than the tile grid. */
export interface ChainPieceRect {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/**
 * Four sprite families (one per `ChainAttachment`), each with a "cap" piece
 * (rounded/closed end, used alone when a shaft is exactly 1 tile, or as the
 * literal bottom of a longer one — the wall-hugging families' hook shape
 * only makes sense at a shaft's point of attachment, so the SAME cap serves
 * both roles) and a "continues" piece (used at the top of a shaft when more
 * chain follows below it, connecting into `CHAIN_MIDDLE`/`CHAIN_BOTTOM`).
 * `left`/`right`'s pieces are 7px wide (not 5, like `ceiling`/`floating`) —
 * the extra width is a horizontal bar baked into the art itself that reads
 * as "hooks onto the wall beside it", so `chainRunPieces`'s caller draws
 * them flush against that side of the tile rather than centered.
 */
const CHAIN_CAP: Record<ChainAttachment, ChainPieceRect> = {
  ceiling: { sx: 91, sy: 101, width: 5, height: 13 },
  left: { sx: 99, sy: 102, width: 7, height: 12 },
  right: { sx: 110, sy: 102, width: 7, height: 12 },
  floating: { sx: 119, sy: 102, width: 5, height: 12 },
};
const CHAIN_CONTINUES: Record<ChainAttachment, ChainPieceRect> = {
  ceiling: { sx: 91, sy: 120, width: 5, height: 16 },
  left: { sx: 99, sy: 121, width: 7, height: 15 },
  right: { sx: 110, sy: 121, width: 7, height: 15 },
  floating: { sx: 119, sy: 121, width: 5, height: 15 },
};

/** Plain, hookless, seamlessly-tileable-on-both-ends middle segment — reused
 *  for every attachment, since only a shaft's top cell needs to show which
 *  wall (if any) it's connected to. Repeated as many times as fit in the
 *  space between the top and bottom pieces. */
const CHAIN_MIDDLE: ChainPieceRect = { sx: 128, sy: 118, width: 5, height: 18 };

/** Plain, hookless bottom cap for a shaft LONGER than 1 tile — cut mid-body
 *  at its own top (so it connects seamlessly under `CHAIN_MIDDLE` or any
 *  attachment's `CHAIN_CONTINUES` piece) with a proper rounded terminator at
 *  the bottom. Distinct from `CHAIN_CAP`: that family's hook shapes are only
 *  meaningful where a shaft actually touches its wall (the top), so a long
 *  shaft's bottom always uses this plain cap regardless of attachment. */
const CHAIN_BOTTOM: ChainPieceRect = { sx: 137, sy: 118, width: 5, height: 15 };

/**
 * Composes the full vertical sequence of sprites for a chain shaft's TOP
 * cell to draw (see Renderer.ts — only the top cell of a run draws
 * anything). A 1-tile shaft is just its attachment's cap. A longer one
 * stacks: the attachment's "continues" piece, then as many `CHAIN_MIDDLE`
 * pieces as fit in the remaining native-pixel budget (`runLength * 16`),
 * then `CHAIN_BOTTOM` — deliberately capped rather than exact, since these
 * pieces' heights don't divide evenly into `16 * runLength`; better to stop
 * a few pixels short than overflow into whatever tile is below the shaft
 * (Renderer.ts draws tiles top-to-bottom, so an overflow would just get
 * silently painted over by that tile anyway, never visible — this is about
 * not relying on that, and choosing the shortfall deliberately instead).
 */
export function chainRunPieces(attachment: ChainAttachment, runLength: number): ChainPieceRect[] {
  if (runLength <= 1) return [CHAIN_CAP[attachment]];

  const pieces: ChainPieceRect[] = [CHAIN_CONTINUES[attachment]];
  let usedHeight = CHAIN_CONTINUES[attachment].height;
  const nativeBudget = runLength * 16;

  while (usedHeight + CHAIN_MIDDLE.height + CHAIN_BOTTOM.height <= nativeBudget) {
    pieces.push(CHAIN_MIDDLE);
    usedHeight += CHAIN_MIDDLE.height;
  }
  pieces.push(CHAIN_BOTTOM);
  return pieces;
}

function pickVariant<T>(variants: readonly T[], col: number, row: number): T {
  // Every variants array today is a non-empty literal declared above, but
  // nothing in the types enforces that. Guard explicitly rather than
  // letting `% 0` produce NaN and silently index to `undefined` — that
  // would only surface later as a confusing "undefined.sx" crash deep in
  // the render loop, far from the actual cause.
  if (variants.length === 0) {
    throw new Error('pickVariant: no variants provided');
  }
  // A plain `(col * a + row * b) % n` cycles through variants in a fixed
  // order as col increases by 1 (period `n`) — visually that reads as
  // "small, medium, large, small, medium, large, ..." rather than varied,
  // especially when `n` is small (like 4 bush sizes). Multiplying by two
  // large, unrelated constants (Math.imul keeps this in 32-bit int math)
  // before XOR-ing scrambles the low bits enough that adjacent columns
  // don't fall into an obvious short repeating sequence.
  const hash = (Math.imul(col, 374761393) ^ Math.imul(row, 668265263)) >>> 0;
  const index = hash % variants.length;
  return variants[index];
}

export function bushOrTreeEntry(role: VerticalRunRole, col: number, row: number): StaticObjectEntry {
  return pickVariant(BUSH_OR_TREE_VARIANTS[role], col, row);
}

const STATIC_OBJECT_VARIANTS: Record<'fence' | 'crystalCluster', StaticObjectEntry[]> = {
  fence: FENCE_VARIANTS,
  crystalCluster: CRYSTAL_CLUSTER_VARIANTS,
};

export function staticObjectEntry(tile: 'fence' | 'crystalCluster', col: number, row: number): StaticObjectEntry {
  return pickVariant(STATIC_OBJECT_VARIANTS[tile], col, row);
}

/** Picks a `stalactite` tile's large-vs-twin sprite deterministically from its
 *  own position — see `STALACTITE_VARIANTS`'s doc comment. */
export function stalactiteEntry(col: number, row: number): StaticObjectEntry {
  return pickVariant(STALACTITE_VARIANTS, col, row);
}

/** Picks a `stalagmite` tile's large-vs-twin sprite deterministically from its
 *  own position — see `STALAGMITE_VARIANTS`'s doc comment. */
export function stalagmiteEntry(col: number, row: number): StaticObjectEntry {
  return pickVariant(STALAGMITE_VARIANTS, col, row);
}
