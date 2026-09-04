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
  | 'bush'
  | 'fence'
  | 'empty';

export type TileMap = TileType[][];

export interface LevelDef {
  terrain: TileMap;
  width: number;
  height: number;
  background?: BackgroundPlacement[];
}

export type BackgroundPieceId =
  | 'dirtBlock3x3'
  | 'dirtBlockTop2x1'
  | 'dirtBlockBottom2x2'
  | 'dirtColumnTop1x1'
  | 'dirtColumnBottom1x2'
  | 'charcoalBlock3x3'
  | 'charcoalBlockTop2x1'
  | 'charcoalBlockBottom2x2'
  | 'charcoalColumnTop1x1'
  | 'charcoalColumnBottom1x2';

/** One stone piece anchored at its top-left cell. Purely decorative — never
 *  read by collision/physics; only the renderer and the Level Editor
 *  consume it. See BackgroundCatalog.ts for each piece's pixel rect and
 *  tile footprint. */
export interface BackgroundPlacement {
  pieceId: BackgroundPieceId;
  col: number;
  row: number;
}
