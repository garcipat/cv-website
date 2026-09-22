import type { LevelDef, TileType, BackgroundMaterialId } from './LevelData';

export const TILE_SIZE = 16;
export const RENDER_SCALE = 2;
export const RENDERED_TILE_SIZE = TILE_SIZE * RENDER_SCALE;

/**
 * Native... no — RENDERED px height of a crumbling floor tile's solid
 * region (O-023): its art top-aligns within its cell and is only half a
 * tile tall, and its collision matches that exactly rather than the full
 * cell every other solid tile uses. This is the tile's "vertical hitbox
 * inset" — the first one in this codebase; every existing inset
 * (`hitboxInsetXForBlock`) is horizontal and block-only. `Physics.ts`'s
 * ceiling (rising-from-below) branch is the only place this is consulted —
 * landing on it from above needs no special handling, since its solid
 * region's TOP edge still sits at the ordinary tile-top line.
 */
export const CRUMBLING_FLOOR_SOLID_HEIGHT = RENDERED_TILE_SIZE / 2;

export function tileAt(level: LevelDef, col: number, row: number): TileType {
  if (row < 0 || row >= level.height || col < 0 || col >= level.width) {
    return 'empty';
  }
  return level.terrain[row][col];
}

export function isSolid(tile: TileType): boolean {
  return (
    tile === 'groundGrass' ||
    tile === 'groundRock' ||
    tile === 'wall' ||
    tile === 'bridge'
  );
}

/**
 * Whether a tile counts as solid for the two "bridge is special" collision
 * cases: rising into it from below (always excluded), and falling through it
 * while actively dropping through (Physics.ts's isDroppingThroughBridge
 * flag). Identical to `isSolid` for every tile except `bridge` — a bridge is
 * solid from above (landing) and the side (walking into it) like any other
 * terrain, but never blocks these two specific directions/states.
 */
export function isSolidExcludingBridge(tile: TileType): boolean {
  return isSolid(tile) && tile !== 'bridge';
}

/**
 * Whether the player can climb this tile — `'ladder'` and its purely visual
 * `'chain'` skin (roadmap step 38) behave identically here and everywhere
 * else in this file/Physics.ts, which is exactly why `'chain'` needs no
 * physics code of its own: every consumer of `isClimbable`/
 * `isStandableLadderTop` already goes through these two functions rather
 * than checking `tile === 'ladder'` directly.
 * Deliberately NOT part of `isSolid`: a climbable tile never blocks
 * horizontal movement or counts as ground; `Physics.ts`'s climbing branch is
 * the only place vertical movement through one is resolved.
 */
export function isClimbable(tile: TileType): boolean {
  return tile === 'ladder' || tile === 'chain' || tile === 'ropeLadder';
}

/**
 * Whether this tile is a ladder shaft's topmost tile with open space above
 * it — the one ladder tile the character can actually stand ON. A shaft's
 * top rung is solid from above only: you climb out of the shaft onto it,
 * land on it when falling from above, and can step off it sideways or press
 * Down to climb back in. Every other ladder tile
 * stays fully passable, and even the top one never blocks horizontal
 * movement or a climb passing through it (`isSolid` is deliberately
 * untouched — `Physics.ts` consults this separately, exactly like it does
 * for `bridge`'s one-way behavior).
 *
 * "Open space above" excludes both a continuing ladder (that tile isn't the
 * top) and a solid tile (there'd be no room to stand — the character would
 * end up embedded in it, so such a dead-end shaft keeps the plain
 * climb-until-the-feet-leave-the-ladder behavior).
 */
export function isStandableLadderTop(level: LevelDef, col: number, row: number): boolean {
  const above = tileAt(level, col, row - 1);
  return isClimbable(tileAt(level, col, row)) && !isClimbable(above) && !isSolid(above);
}

/**
 * Whether a rolled `ladderBundle` cell at (col, row) is standable from above.
 * Deliberately UNCONDITIONAL on the cell above — unlike `isStandableLadderTop`,
 * a bundle is a solid little parcel the character stands ON regardless of what
 * is overhead (FR-002/FR-009), and it must stay standable throughout its
 * unroll so a character standing on it when it deploys does not fall. It is
 * never `isSolid` (so it blocks nothing horizontally) and never `isClimbable`
 * (so a rolled bundle cannot be climbed); Physics.ts consults this predicate
 * exactly like it consults `isStandableLadderTop`, as a one-way ground term.
 */
export function isStandableLadderBundleTop(level: LevelDef, col: number, row: number): boolean {
  return tileAt(level, col, row) === 'ladderBundle';
}

/**
 * Whether a `bouncyMushroom` cell at (col, row) is the standable, one-way
 * ground cap of its vertical run — true only for the run's topmost cell, and
 * only when the cell directly above it is not solid (FR-005/FR-006). Mirrors
 * `isStandableLadderTop`: the mushroom is never `isSolid` (so it blocks
 * nothing horizontally and nothing from below) and never `isClimbable`, and
 * `Physics.ts` consults this separately as a one-way ground term. A cap with
 * a solid tile directly above has no room to land, so it is not standable —
 * and out-of-bounds above resolves to `'empty'` via `tileAt`, so a cap in the
 * level's top row is standable.
 */
export function isStandableMushroomCap(level: LevelDef, col: number, row: number): boolean {
  const above = tileAt(level, col, row - 1);
  return tileAt(level, col, row) === 'bouncyMushroom' && above !== 'bouncyMushroom' && !isSolid(above);
}

export function isTopExposed(level: LevelDef, col: number, row: number): boolean {
  return !isSolid(tileAt(level, col, row - 1));
}

/**
 * Neighbour-mask bits. A SET bit means the neighbour on that side is terrain
 * this tile merges with, so the edge continues and is drawn WITHOUT a border
 * ("open"). A CLEAR bit means that edge faces open space and is drawn WITH
 * its dark border ("closed").
 *
 * A `bridge` counts as open space, not terrain: it is a thin walkway you can
 * see past, so ground beside or beneath one must read exactly as if it faced
 * air. That is why this uses `isSolidExcludingBridge` rather than `isSolid`,
 * and why the UP bit is NOT equivalent to `isTopExposed` for a bridge — that
 * helper still serves `groundRock`, whose rendering is unchanged.
 */
export const NEIGHBOUR_UP = 1;
export const NEIGHBOUR_RIGHT = 2;
export const NEIGHBOUR_DOWN = 4;
export const NEIGHBOUR_LEFT = 8;

export function neighbourMask(level: LevelDef, col: number, row: number): number {
  return (
    (isSolidExcludingBridge(tileAt(level, col, row - 1)) ? NEIGHBOUR_UP : 0) |
    (isSolidExcludingBridge(tileAt(level, col + 1, row)) ? NEIGHBOUR_RIGHT : 0) |
    (isSolidExcludingBridge(tileAt(level, col, row + 1)) ? NEIGHBOUR_DOWN : 0) |
    (isSolidExcludingBridge(tileAt(level, col - 1, row)) ? NEIGHBOUR_LEFT : 0)
  );
}

export function tileToPixel(col: number, row: number): { x: number; y: number } {
  return { x: col * RENDERED_TILE_SIZE, y: row * RENDERED_TILE_SIZE };
}

/**
 * The background material at `(col, row)`, or `null` for an empty cell.
 * Out-of-bounds and a missing `background` field both resolve to `null`,
 * mirroring `tileAt`'s out-of-bounds-returns-`'empty'` contract. The grid MAY
 * be smaller than `terrain`'s own bounds (FR-013's dropped-on-load empty
 * grid, or an editor grid grown less far than the foreground) — any cell
 * outside the grid's own bounds is `null` too, never an out-of-bounds throw.
 */
export function backgroundAt(level: LevelDef, col: number, row: number): BackgroundMaterialId | null {
  const gridRow = level.background?.[row];
  if (!gridRow) return null;
  return gridRow[col] ?? null;
}

/**
 * A 4-bit same-material neighbour mask for the background cell at
 * `(col, row)`, computed the same way `neighbourMask` computes it for
 * terrain — but counting only a same-material neighbour as connected
 * (FR-004). A different material, an empty cell, or an out-of-bounds cell
 * all count as closed, which falls out for free from strict equality against
 * `backgroundAt`'s own `null`-safe result: `null !== 'dirt'`, and
 * `'charcoal' !== 'dirt'`, so neither an empty neighbour nor a
 * different-material one is ever mistaken for a connection.
 */
export function backgroundNeighbourMask(level: LevelDef, col: number, row: number): number {
  const material = backgroundAt(level, col, row);
  return (
    (backgroundAt(level, col, row - 1) === material ? NEIGHBOUR_UP : 0) |
    (backgroundAt(level, col + 1, row) === material ? NEIGHBOUR_RIGHT : 0) |
    (backgroundAt(level, col, row + 1) === material ? NEIGHBOUR_DOWN : 0) |
    (backgroundAt(level, col - 1, row) === material ? NEIGHBOUR_LEFT : 0)
  );
}

export type RunPosition = 'single' | 'left' | 'middle' | 'right';

/**
 * Position of a tile within a horizontal run of neighbours the caller
 * considers continuous. `matches` decides continuity, so the same traversal
 * serves bridges (same tile type) and grass (same type AND top-exposed).
 */
export function horizontalRunPosition(
  level: LevelDef,
  col: number,
  row: number,
  matches: (level: LevelDef, col: number, row: number) => boolean,
): RunPosition {
  const left = matches(level, col - 1, row);
  const right = matches(level, col + 1, row);

  if (!left && !right) return 'single';
  if (!left && right) return 'left';
  if (left && !right) return 'right';
  return 'middle';
}

/**
 * Position of a `bridge` tile within its horizontal run of contiguous
 * bridge tiles, used to pick the ramp-down/low/ramp-up sprite. A lone
 * bridge tile (no bridge neighbour on either side) is 'single'.
 */
export type BridgeRunPosition = RunPosition;

export function bridgeRunPosition(level: LevelDef, col: number, row: number): RunPosition {
  return horizontalRunPosition(level, col, row, (l, c, r) => tileAt(l, c, r) === 'bridge');
}

export type VerticalRunRole = 'only' | 'bottom' | 'middle' | 'top';

/**
 * Classifies `(col, row)`'s position within a vertical run of `tile`-typed
 * cells, by comparing only its immediate neighbours above and below —
 * unlike `horizontalRunPosition`, this never counts a run's full length, so
 * an arbitrarily tall stack (e.g. a tree with no height cap) costs no more
 * to classify than a lone tile. `tileAt` already returns `'empty'` for any
 * out-of-bounds row, so a cell at the top or bottom of the level correctly
 * reads as having no matching neighbour there.
 */
export function verticalRunRole(
  level: LevelDef,
  col: number,
  row: number,
  tile: TileType,
): VerticalRunRole {
  const above = tileAt(level, col, row - 1) === tile;
  const below = tileAt(level, col, row + 1) === tile;

  if (!above && !below) return 'only';
  if (!above && below) return 'top';
  if (above && !below) return 'bottom';
  return 'middle';
}

export type ChainAttachment = 'ceiling' | 'left' | 'right' | 'floating';

/**
 * Where a `chain` shaft's TOP cell reads as attached — decides which sprite
 * family `chainRunPieces` (StaticObjectsCatalog.ts) draws for the whole run
 * below it (see `chainRunLength`). Has no bearing on physics, which treats
 * every chain tile identically regardless of attachment (see `isClimbable`).
 * Checked in this priority order: a solid tile directly above wins
 * ('ceiling') even when a side is ALSO solid (e.g. a shaft corner) — only
 * when nothing solid is above does a solid neighbour to the left or right
 * decide 'left'/'right'. `'floating'` is its own distinct case (not a reuse
 * of 'ceiling') for a chain with nothing solid anywhere around its top cell
 * — it gets its own plain, hookless sprite family.
 */
export function chainAttachment(level: LevelDef, col: number, row: number): ChainAttachment {
  if (isSolid(tileAt(level, col, row - 1))) return 'ceiling';
  if (isSolid(tileAt(level, col - 1, row))) return 'left';
  if (isSolid(tileAt(level, col + 1, row))) return 'right';
  return 'floating';
}

/**
 * How many consecutive `chain` tiles make up the vertical run starting at
 * (col, row) and continuing downward — 1 if the tile below isn't `chain`.
 * Only ever called with (col, row) at the TOP of a run (Renderer.ts checks
 * `tileAt(level, col, row - 1) !== 'chain'` first) since only the top cell
 * of a run draws anything; every other cell in it is skipped.
 */
export function chainRunLength(level: LevelDef, col: number, row: number): number {
  let length = 1;
  while (tileAt(level, col, row + length) === 'chain') length++;
  return length;
}

/**
 * Decides how a `cobweb` tile at (col, row) should render, auto-detected from
 * its 4 orthogonal neighbours' solidity — a level author places one `cobweb`
 * tile and the game picks corner-vs-flat art and rotation, the same way
 * `bushOrTreeEntry` already auto-picks a bush's size.
 *
 * Only an ADJACENT pair of solid sides forms a corner a web can nest into
 * (up+left, up+right, down+right, down+left) — up+down or left+right are
 * opposite sides, not a corner, so a web spanning between them wouldn't read
 * as attached to anything. Checked in that exact order, first match wins,
 * which also resolves the ambiguous case of 3 or 4 solid sides by always
 * preferring up+left. `rotation` is a quarter-turn COUNT (0-3), read the same
 * way `GroundAtlasEntry.rotation` already is by Renderer.ts's
 * `drawGroundTile` (`ctx.rotate((entry.rotation * Math.PI) / 2)` about the
 * cell's own center): the corner sprite's native art already nests into an
 * up+left corner (ceiling above, wall to the left), so up+left is rotation 0
 * and each subsequent pair is one more quarter-turn clockwise. No solid
 * adjacent pair at all means there's nothing for a corner web to attach to,
 * so it falls back to the flat/neutral sprite, for which `rotation` is
 * unused (always drawn plain).
 */
export function cobwebOrientation(
  level: LevelDef,
  col: number,
  row: number,
): { corner: boolean; rotation: 0 | 1 | 2 | 3 } {
  const up = isSolid(tileAt(level, col, row - 1));
  const right = isSolid(tileAt(level, col + 1, row));
  const down = isSolid(tileAt(level, col, row + 1));
  const left = isSolid(tileAt(level, col - 1, row));

  if (up && left) return { corner: true, rotation: 0 };
  if (up && right) return { corner: true, rotation: 1 };
  if (down && right) return { corner: true, rotation: 2 };
  if (down && left) return { corner: true, rotation: 3 };
  return { corner: false, rotation: 0 };
}
