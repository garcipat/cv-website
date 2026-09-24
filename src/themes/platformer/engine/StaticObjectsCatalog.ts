import type { ChainAttachment, VerticalRunRole } from '../level/Terrain';
import { hash2D } from '../shared/math';

export interface StaticObjectEntry {
  sx: number;
  sy: number;
  /** Source crop size in native sheet pixels — omitted (and treated as the
   *  standard 16x16 tile) for every entry whose art actually fills a whole
   *  cell. Only the hand-spaced `decorations.png` entries below set these
   *  explicitly: that sheet's icons now have real gaps between them and
   *  aren't all exactly 16x16, so a fixed 16x16 crop would clip them —
   *  Renderer.ts reads these (falling back to 16) instead of hardcoding
   *  TILE_SIZE for every decoration draw. */
  width?: number;
  height?: number;
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
const CRYSTAL_CLUSTER_VARIANTS: StaticObjectEntry[] = [{ sx: 33, sy: 0, width: 18, height: 18 }];

/**
 * The corner and flat cobweb sprites, from `decorations.png`. Unlike
 * `crystalCluster`/`stalactite`/`stalagmite`, which of these two draws is NOT
 * picked from position hash — it's driven entirely by
 * `Terrain.ts`'s `cobwebOrientation` (does this cell sit in a corner formed by
 * two adjacent solid neighbours?), so each is kept as its own named single
 * entry rather than routed through `pickVariant`.
 */
export const COBWEB_CORNER_ENTRY: StaticObjectEntry = { sx: 0, sy: 0, width: 16, height: 16 };
export const COBWEB_FLAT_ENTRY: StaticObjectEntry = { sx: 17, sy: 0, width: 16, height: 17 };

/**
 * Size variants for `stalactite`/`stalagmite` — a level author places one
 * tile each; which size (large or twin) renders at a given cell is picked
 * deterministically from its own position (see `pickVariant`), the same way
 * `BUSH_OR_TREE_VARIANTS`'s `only` role already picks among 4 bush sizes.
 */
const STALACTITE_VARIANTS: StaticObjectEntry[] = [
  { sx: 51, sy: 0, width: 16, height: 17 }, // large
  { sx: 0, sy: 19, width: 16, height: 16 }, // twin
];
const STALAGMITE_VARIANTS: StaticObjectEntry[] = [
  { sx: 17, sy: 17, width: 16, height: 18 }, // large
  { sx: 34, sy: 25, width: 16, height: 10 }, // twin
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

/** The rope-ladder sheet's pieces. `ROPE_BUNDLE` is the rolled 16x16 parcel;
 *  the other four are 16x8 half-tile pieces the deployed shaft stacks. */
export const ROPE_BUNDLE: ChainPieceRect = { sx: 0, sy: 0, width: 16, height: 16 };
export const ROPE_TOP_CAP: ChainPieceRect = { sx: 16, sy: 0, width: 16, height: 8 };
export const ROPE_STEP: ChainPieceRect = { sx: 16, sy: 8, width: 16, height: 8 };
export const ROPE_BOTTOM_CAP: ChainPieceRect = { sx: 16, sy: 24, width: 16, height: 8 };

/**
 * Composes the full vertical sequence of pieces for a COMPLETED deployed rope
 * ladder, given the number of rung cells BELOW the bundle cell
 * (`shaftCellCount`). The bundle cell itself is drawn as `ROPE_TOP_CAP` (its
 * deployed top-rung appearance), then two `ROPE_STEP`s per cell below, with
 * the very last piece replaced by `ROPE_BOTTOM_CAP`. A zero-length landing
 * (`shaftCellCount === 0`) is `[ROPE_TOP_CAP, ROPE_BOTTOM_CAP]` — a lone rung
 * cell, cap over cap.
 */
export function ropeLadderShaftPieces(shaftCellCount: number): ChainPieceRect[] {
  if (shaftCellCount <= 0) return [ROPE_TOP_CAP, ROPE_BOTTOM_CAP];
  const pieces: ChainPieceRect[] = [ROPE_TOP_CAP];
  // 2n + 1 steps, so replacing the last with the bottom cap leaves exactly
  // 2n steps between the two caps — the full (n + 1)-cell shaft.
  for (let cell = 0; cell < shaftCellCount; cell++) {
    pieces.push(ROPE_STEP, ROPE_STEP);
  }
  pieces.push(ROPE_STEP);
  pieces[pieces.length - 1] = ROPE_BOTTOM_CAP;
  return pieces;
}

/**
 * Picks a variant deterministically from a cell's grid position — the shared
 * home of the position-hashed variant picker (`BackgroundDecorCatalog.ts`
 * imports this rather than keeping its own copy). Backed by `shared/math.ts`'s
 * `hash2D(col, row)`; the two large unrelated multipliers in that hash scramble
 * the low bits enough that adjacent columns don't fall into an obvious short
 * repeating sequence.
 */
export function pickVariant<T>(variants: readonly T[], col: number, row: number): T {
  // Every variants array today is a non-empty literal declared above, but
  // nothing in the types enforces that. Guard explicitly rather than
  // letting `% 0` produce NaN and silently index to `undefined` — that
  // would only surface later as a confusing "undefined.sx" crash deep in
  // the render loop, far from the actual cause.
  if (variants.length === 0) {
    throw new Error('pickVariant: no variants provided');
  }
  const hash = hash2D(col, row);
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

/**
 * Whether the decoration at `(col, row)` renders the twin variant (the second
 * `STALACTITE_VARIANTS` entry), using the same position hash as
 * `stalactiteEntry` so a falling-stalactite hazard's variant always matches
 * the decoration at its cell (O-027 research D7).
 */
export function isStalactiteTwin(col: number, row: number): boolean {
  return pickVariant(STALACTITE_VARIANTS, col, row) === STALACTITE_VARIANTS[1];
}

/**
 * The two stalactites of the twin variant (`decorations.png`, region
 * `sx=0, sy=19, w=16, h=16`), split exactly at x=8. The left one is taller
 * (the larger); the right one is shorter. A falling-stalactite hazard on a
 * twin cell uses whichever half its column parity selects (even → left,
 * odd → right) for both its sprite and its half-tile hitbox (O-027 FR-019).
 */
export const TWIN_LEFT_RECT: Required<StaticObjectEntry> = { sx: 0, sy: 19, width: 8, height: 16 };
export const TWIN_RIGHT_RECT: Required<StaticObjectEntry> = { sx: 8, sy: 19, width: 8, height: 10 };

/** Picks a `stalagmite` tile's large-vs-twin sprite deterministically from its
 *  own position — see `STALAGMITE_VARIANTS`'s doc comment. */
export function stalagmiteEntry(col: number, row: number): StaticObjectEntry {
  return pickVariant(STALAGMITE_VARIANTS, col, row);
}

/** The cap rows of an `only`/`top` mushroom cell (from `mushroom.png`'s 16px
 *  grid); rows 11-15 are the stem/connector. Only the cap sub-rect moves during
 *  the squash dip, so the split height lives here as the single source of
 *  truth the renderer reads. */
export const MUSHROOM_CAP_SOURCE_HEIGHT = 11;

/**
 * The four art cells of a `bouncyMushroom` vertical run, from the red row of
 * `mushroom.png` (see `MUSHROOM_SHEET`). `middle` is the plain stalk and
 * `bottom` is the stalk with its flared foot — the one cross-row read, at
 * (48, 16), whose cell holds only the shared colour-neutral tan foot art (see
 * `sheets.ts`'s `MUSHROOM_SHEET` doc comment). Addressed by sx/sy, never by
 * frame index.
 */
const MUSHROOM_ROLE_ENTRIES: Record<VerticalRunRole, StaticObjectEntry> = {
  only: { sx: 0, sy: 0 },
  top: { sx: 16, sy: 0 },
  middle: { sx: 48, sy: 0 },
  bottom: { sx: 48, sy: 16 },
};

/** The sprite rect for a bouncy mushroom's run role. */
export function mushroomEntry(role: VerticalRunRole): StaticObjectEntry {
  return MUSHROOM_ROLE_ENTRIES[role];
}

/** Whether a run role carries a cap (`only`/`top`) and therefore needs the
 *  cap/stem split the squash dip animates. */
export function mushroomHasCap(role: VerticalRunRole): boolean {
  return role === 'only' || role === 'top';
}

/** The small decorative mushroom's fixed cell (col 2, row 0 of the red row of
 *  `mushroom.png`) — drawn whole, never split and never squashed. */
export const MUSHROOM_DECORATIVE_ENTRY: StaticObjectEntry = { sx: 32, sy: 0 };
