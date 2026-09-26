import type { SignHintId } from './HintCatalog';
import type { TorchStrength } from '../tiles/torch';
import type { TILE_MODULES } from '../tiles/registry';

/**
 * Every shipped tile kind, derived from the tile module registry: adding a kind
 * is one module plus one registry line, never an edit here. The per-kind
 * contract (capabilities, rules, appearance, declared state) lives in
 * `tiles/TileModule.ts` and each kind's module under `tiles/`.
 */
export type TileType = keyof typeof TILE_MODULES;

export type TileMap = TileType[][];

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
  | { kind: 'sign'; hintId: SignHintId }
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
