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
    tile === 'platform' ||
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
 * Whether the player can climb this tile (roadmap step 23) — currently only
 * `'ladder'`. Deliberately NOT part of `isSolid`: a ladder never blocks
 * horizontal movement or counts as ground; `Physics.ts`'s climbing branch is
 * the only place vertical movement through a ladder tile is resolved.
 */
export function isClimbable(tile: TileType): boolean {
  return tile === 'ladder';
}

export function isTopExposed(level: LevelDef, col: number, row: number): boolean {
  return !isSolid(tileAt(level, col, row - 1));
}

export function tileToPixel(col: number, row: number): { x: number; y: number } {
  return { x: col * RENDERED_TILE_SIZE, y: row * RENDERED_TILE_SIZE };
}

/**
 * Position of a `bridge` tile within its horizontal run of contiguous
 * bridge tiles, used to pick the ramp-down/low/ramp-up sprite. A lone
 * bridge tile (no bridge neighbor on either side) is 'single'.
 */
export type BridgeRunPosition = 'single' | 'left' | 'middle' | 'right';

export function bridgeRunPosition(level: LevelDef, col: number, row: number): BridgeRunPosition {
  const leftIsBridge = tileAt(level, col - 1, row) === 'bridge';
  const rightIsBridge = tileAt(level, col + 1, row) === 'bridge';

  if (!leftIsBridge && !rightIsBridge) return 'single';
  if (!leftIsBridge && rightIsBridge) return 'left';
  if (leftIsBridge && !rightIsBridge) return 'right';
  return 'middle';
}
