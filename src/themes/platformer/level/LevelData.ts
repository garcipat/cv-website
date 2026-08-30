export type TileType =
  | 'groundGrass'
  | 'groundRock'
  | 'platform'
  | 'wall'
  | 'bridge'
  | 'ladder'
  | 'empty';

export type TileMap = TileType[][];

export interface LevelDef {
  terrain: TileMap;
  width: number;
  height: number;
}
