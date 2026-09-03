export type TileType =
  | 'groundGrass'
  | 'groundRock'
  | 'wall'
  | 'bridge'
  | 'ladder'
  /** An invisible, non-solid enemy patrol boundary: nothing renders it, and
   *  the player passes straight through, but `EnemyAI.ts` reverses a patrol
   *  that walks into one exactly as if it were a wall — the way a level
   *  author pens an enemy into a stretch of open ground without putting a
   *  visible obstacle there. */
  | 'patrol'
  | 'empty';

export type TileMap = TileType[][];

export interface LevelDef {
  terrain: TileMap;
  width: number;
  height: number;
}
