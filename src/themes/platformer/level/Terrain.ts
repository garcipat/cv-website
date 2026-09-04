import type { LevelDef, TileType } from './LevelData';

export const TILE_SIZE = 16;
export const RENDER_SCALE = 2;
export const RENDERED_TILE_SIZE = TILE_SIZE * RENDER_SCALE;

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
 * Whether the player can climb this tile — currently only `'ladder'`.
 * Deliberately NOT part of `isSolid`: a ladder never blocks horizontal
 * movement or counts as ground; `Physics.ts`'s climbing branch is the only
 * place vertical movement through a ladder tile is resolved.
 */
export function isClimbable(tile: TileType): boolean {
  return tile === 'ladder';
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
