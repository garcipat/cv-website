import type { HintId } from '../types';

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
  /** A wall-mounted torch — purely decorative, non-solid cave dressing.
   *  Unlike every other decorative tile it animates: its flame cycles through
   *  a 4-frame sparkle loop, with each cell's phase derived deterministically
   *  from its own grid position plus the shared world clock (see
   *  `engine/Torch.ts`'s `torchFrameIndex`). It carries no per-instance state. */
  | 'torch'
  /** A curled-up rope-ladder bundle the player deploys with Up — an
   *  author-placeable terrain tile (`@`). Non-solid and not climbable, but
   *  standable from above only (see Terrain.ts's `isStandableLadderBundleTop`),
   *  so a character can stand on a rolled bundle. Its deployed shaft writes the
   *  `ropeLadder` tile below it at runtime (see engine/DeployableLadder.ts). */
  | 'ladderBundle'
  /** A deployed rope-ladder rung cell — never author-placeable; it exists only
   *  in the effective grid `applyDeployedLadders` produces from a completed
   *  bundle. Climbable exactly like `ladder`/`chain` (see Terrain.ts's
   *  `isClimbable`), so every climbing consumer treats it identically. */
  | 'ropeLadder'
  /** The red bouncy mushroom. Non-solid and non-climbable: passable from the
   *  side and from below. Its top cap is one-way ground — standable from above
   *  only while the cell directly above is not solid (Terrain.ts's
   *  `isStandableMushroomCap`). Art role (only/top/middle/bottom) is derived
   *  from its vertical run by `verticalRunRole`, like `bush`. */
  | 'bouncyMushroom'
  /** The small non-solid dressing mushroom. No behaviour of any kind: never
   *  solid, never standable, never bounces. Art is a single fixed cell. */
  | 'decorativeMushroom'
  /** Ground that cracks and shakes underfoot, breaks apart into falling
   *  debris after a fixed cycle, and reforms after a fixed delay (O-023).
   *  Solid while at rest or cracking; non-solid while broken or reforming.
   *  Its art top-aligns within its cell and is only half a tile tall — its
   *  solid region matches that height exactly rather than the full cell
   *  (see Terrain.ts's `CRUMBLING_FLOOR_SOLID_HEIGHT` and Physics.ts's
   *  ceiling branch). Per-cell cycle state (`engine/CrumblingFloor.ts`) is
   *  the only runtime state this tile kind carries — the grid cell itself
   *  never changes. */
  | 'crumblingFloor'
  | 'empty';

/**
 * Whether a terrain tile stays visible through cave fog (O-028) even on a
 * cave-family background cell — declared once, exhaustively, as a lookup
 * `Record` (the same pattern `BACKGROUND_MATERIAL_FAMILY` above uses for
 * `BackgroundMaterialId`), so a new `TileType` member forces an explicit
 * choice here at compile time rather than silently inheriting whatever an
 * unrelated helper (e.g. `isSolid`) happens to say. Exempt today: solid
 * rock/structure (`groundGrass`/`groundRock`/`wall`/`bridge`) — a cave's
 * walls and floor carry no information a visitor could act on, so leaving
 * them visible reads as "you can see the cave's shape, not what's inside
 * it." Every other tile (open space, ladders, decorations, blocks-in-
 * waiting...) stays fogged, since any of them could be the thing worth
 * hiding until the player is actually inside.
 */
export const TILE_FOG_EXEMPT: Record<TileType, boolean> = {
  groundGrass: true,
  groundRock: true,
  wall: true,
  bridge: true,
  ladder: false,
  chain: false,
  bush: false,
  fence: false,
  cobweb: false,
  crystalCluster: false,
  stalactite: false,
  stalagmite: false,
  torch: false,
  ladderBundle: false,
  ropeLadder: false,
  bouncyMushroom: false,
  decorativeMushroom: false,
  crumblingFloor: false,
  empty: false,
};

/** Whether `tile` should be skipped by cave fog — see `TILE_FOG_EXEMPT`. */
export function isFogExempt(tile: TileType): boolean {
  return TILE_FOG_EXEMPT[tile];
}

export type TileMap = TileType[][];

/**
 * A wall torch's light strength, `0`-`9`. `5` is the default
 * (`DEFAULT_TORCH_STRENGTH`): a torch with no marker lights at today's radius,
 * and the other values scale that radius linearly, so `0` is dark and `9` is
 * roughly double.
 */
export type TorchStrength = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * The tile meta layer's value at a cell — a closed, typed discriminated union
 * (FR-023). Each kind declares exactly the data it needs and nothing else; the
 * presence-only kinds carry no payload, while a `sign` carries the `hintId` it
 * shows and a `torch` its `strength`. There is deliberately no per-cell
 * character vocabulary for markers — the only place a marker character exists
 * is the load-time migration map (`LevelParser.ts`'s `LEGACY_MARKER_CHARS`).
 */
export type MarkerEntry =
  | { kind: 'patrolBoundary' }
  | { kind: 'connectionPoint' }
  | { kind: 'fallingStalactite' }
  | { kind: 'sign'; hintId: HintId }
  | { kind: 'torch'; strength: TorchStrength };

/**
 * The tile meta layer as a dense runtime grid, aligned 1:1 with
 * `LevelDef.terrain` — `null` means empty, mirroring `BackgroundGrid`'s own
 * split. A level with no markers omits the field entirely (FR-014); the layer
 * is never persisted densely.
 */
export type MarkerGrid = (MarkerEntry | null)[][];

/**
 * One marker as written in a level/blueprint file: a typed `MarkerEntry` at a
 * cell relative to the cropped `layout`'s own origin. A file stores only the
 * markers that are actually present, never a grid of empty cells (FR-014).
 */
export interface MarkerPlacement {
  col: number;
  row: number;
  marker: MarkerEntry;
}

export interface LevelDef {
  terrain: TileMap;
  width: number;
  height: number;
  background?: BackgroundGrid;
  /** The tile meta layer — absent when the level has no markers. */
  markers?: MarkerGrid;
}

/**
 * A named background material — an open set defined by the art sheet, not
 * hardcoded to a fixed pair (see design.md's "Why materials are an open set,
 * not a hardcoded pair"). Six materials ship: three `surface`, three `cave`.
 */
export type BackgroundMaterialId =
  | 'dirt'
  | 'rust'
  | 'surfaceStone'
  | 'charcoal'
  | 'maroon'
  | 'caveStone';

/**
 * The intrinsic family of a background material — the single fact that
 * decides whether a cell darkens the view when the player stands on it
 * (FR-002). Declared here as the single source of truth; `engine/Lighting.ts`
 * imports it rather than re-declaring it. There is deliberately no per-cell
 * darkening flag — family is intrinsic to the material, not the placement.
 */
export type BackgroundMaterialFamily = 'surface' | 'cave';

/** Every material's intrinsic family (FR-002/FR-003). */
export const BACKGROUND_MATERIAL_FAMILY: Record<BackgroundMaterialId, BackgroundMaterialFamily> = {
  dirt: 'surface',
  rust: 'surface',
  surfaceStone: 'surface',
  charcoal: 'cave',
  maroon: 'cave',
  caveStone: 'cave',
};

/** `BackgroundMaterialId` is a closed union, so unlike the old
 *  `backgroundPieceFamily` this never needs to return `undefined` — every
 *  grid cell is narrowed to the union (or `null`) before anything calls this
 *  (see `BackgroundGrid` below and FR-012). */
export function backgroundMaterialFamily(material: BackgroundMaterialId): BackgroundMaterialFamily {
  return BACKGROUND_MATERIAL_FAMILY[material];
}

/**
 * The background layer as a dense per-cell grid, one entry per terrain cell
 * — `null` means empty (the parallax/void shows through), a material id means
 * that cell is filled with that material (FR-001). Replaces the old freeform
 * `BackgroundPlacement[]` entirely; no footprint, no anchor, every cell is
 * independently addressable exactly like `TileMap`.
 */
export type BackgroundGrid = (BackgroundMaterialId | null)[][];
