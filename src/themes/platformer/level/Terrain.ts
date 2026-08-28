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

/**
 * The row index of the first empty-tile-above-solid-tile position in the
 * given column (top to bottom), or null if the column has no such surface at
 * all (e.g. a bottomless pit, or a column whose only solid tile is already at
 * the top with nothing exposed above it).
 */
export function groundRowForColumn(level: LevelDef, col: number): number | null {
  for (let row = 0; row < level.height - 1; row++) {
    if (!isSolid(tileAt(level, col, row)) && isSolid(tileAt(level, col, row + 1))) {
      return row;
    }
  }
  return null;
}

/**
 * Every column index that has at least one empty tile directly above a solid
 * tile — i.e. a column an object can stand in. Shared by
 * CollectibleMapper.ts and EnemyMapper.ts so both place their objects using
 * the same "walkable column" definition.
 */
export function groundColumns(level: LevelDef): number[] {
  const cols: number[] = [];
  for (let col = 0; col < level.width; col++) {
    if (groundRowForColumn(level, col) !== null) {
      cols.push(col);
    }
  }
  return cols;
}
