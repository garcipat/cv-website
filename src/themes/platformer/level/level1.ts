import type { LevelDef, TileMap, TileType } from './LevelData';

const WIDTH = 20;
const HEIGHT = 12;
const GRASS_ROCK_BOUNDARY_COL = 12; // columns < this use groundGrass, >= use groundRock
const PIT_COLS = [2, 3];

function emptyGrid(width: number, height: number): TileMap {
  return Array.from({ length: height }, () => Array<TileType>(width).fill('empty'));
}

function buildLevel1(): LevelDef {
  const terrain = emptyGrid(WIDTH, HEIGHT);

  for (let col = 0; col < WIDTH; col++) {
    if (PIT_COLS.includes(col)) continue;

    const groundType: TileType = col < GRASS_ROCK_BOUNDARY_COL ? 'groundGrass' : 'groundRock';
    terrain[HEIGHT - 2][col] = groundType;
    terrain[HEIGHT - 1][col] = groundType;
  }

  for (const col of PIT_COLS) {
    terrain[HEIGHT - 2][col] = 'bridge';
    // terrain[HEIGHT - 1][col] stays 'empty' -- the pit
  }

  terrain[7][8] = 'platform';
  terrain[7][9] = 'platform';
  terrain[7][10] = 'platform';

  terrain[7][15] = 'wall';
  terrain[8][15] = 'wall';
  terrain[9][15] = 'wall';

  return { terrain, width: WIDTH, height: HEIGHT };
}

export const level1: LevelDef = buildLevel1();
