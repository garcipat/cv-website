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

export function isTopExposed(level: LevelDef, col: number, row: number): boolean {
  return !isSolid(tileAt(level, col, row - 1));
}

export function tileToPixel(col: number, row: number): { x: number; y: number } {
  return { x: col * RENDERED_TILE_SIZE, y: row * RENDERED_TILE_SIZE };
}
