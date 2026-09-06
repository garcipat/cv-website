export type TileType =
  | 'groundGrass'
  | 'groundRock'
  | 'wall'
  | 'bridge'
  | 'ladder'
  /** Climbs exactly like `'ladder'` (see Terrain.ts's `isClimbable`) — a
   *  purely visual alternative skin. Renders centered when hanging free
   *  from a solid ceiling, or offset toward whichever side (if any) has
   *  solid terrain next to it (Terrain.ts's `chainAttachment`). */
  | 'chain'
  /** An invisible, non-solid enemy patrol boundary: nothing renders it, and
   *  the player passes straight through, but `EnemyAI.ts` reverses a patrol
   *  that walks into one exactly as if it were a wall — the way a level
   *  author pens an enemy into a stretch of open ground without putting a
   *  visible obstacle there. */
  | 'patrol'
  /** An editor-only marker for a cell on a blueprint's border where another
   *  blueprint may attach (roadmap step 44b). Follows `'patrol'` above
   *  exactly — invisible in normal gameplay rendering, never solid, no
   *  collision behavior — and goes one step further: nothing in the running
   *  game reads it at all. Purely a visual cue for the blueprint's author;
   *  placement (step 44c) validates overlap only and does not read or match
   *  connection points at all — a stamped `'+'` is just another cell. */
  | 'blueprintConnectionPoint'
  | 'bush'
  | 'fence'
  /** Purely decorative cave-dressing tiles from `decorations.png`, never
   *  solid, never form multi-tile runs, and carry no CVData mapping.
   *  `crystalCluster` is a single-fixed-sprite tile (same convention as
   *  `fence` — see StaticObjectsCatalog.ts's `staticObjectEntry`).
   *  `stalactite`/`stalagmite` each cover two size variants (large/twin)
   *  picked automatically by position hash (StaticObjectsCatalog.ts's
   *  `stalactiteEntry`/`stalagmiteEntry`), the same way `bush` already picks
   *  its own size variants — the level author places one tile, not a size
   *  choice. `cobweb` covers both the corner and flat art, with the
   *  corner-vs-flat choice and its rotation auto-detected from neighbouring
   *  solid terrain (Terrain.ts's `cobwebOrientation`). */
  | 'cobweb'
  | 'crystalCluster'
  | 'stalactite'
  | 'stalagmite'
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
