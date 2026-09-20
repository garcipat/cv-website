# Contract: Background Engine Public API

This is the surface `tasks.md`'s task boundaries are drawn against — later
tasks depend on these exact names, types, and files existing from earlier
tasks.

## `level/LevelData.ts` (edit)

```ts
export type BackgroundMaterialId =
  | 'dirt' | 'rust' | 'surfaceStone'
  | 'charcoal' | 'maroon' | 'caveStone';

export type BackgroundMaterialFamily = 'surface' | 'cave';

export const BACKGROUND_MATERIAL_FAMILY: Record<BackgroundMaterialId, BackgroundMaterialFamily>;

export function backgroundMaterialFamily(material: BackgroundMaterialId): BackgroundMaterialFamily;

export type BackgroundGrid = (BackgroundMaterialId | null)[][];

export interface LevelDef {
  terrain: TileMap;
  width: number;
  height: number;
  background?: BackgroundGrid;
}
```

Removed from this file: `BackgroundPieceId`, `BackgroundPieceFamily`,
`BackgroundPlacement`.

## `level/Terrain.ts` (edit — additive)

```ts
export function backgroundAt(level: LevelDef, col: number, row: number): BackgroundMaterialId | null;
export function backgroundNeighbourMask(level: LevelDef, col: number, row: number): number; // 0..15
```

`NEIGHBOUR_UP`, `NEIGHBOUR_RIGHT`, `NEIGHBOUR_DOWN`, `NEIGHBOUR_LEFT` already
exist in this file for terrain's own `neighbourMask` — reused as-is, not
redefined.

## `engine/BackgroundAtlas.ts` (new)

```ts
export const BACKGROUND_ATLAS_STRIDE = 19;
export const BACKGROUND_ATLAS_ROW_PITCH = 60;

export type QuarterTurns = 0 | 1 | 2 | 3;  // re-exported from GroundAtlas.ts, not duplicated

export interface BackgroundAtlasEntry {
  sx: number;
  sy: number;
  rotation: QuarterTurns;
}

export function backgroundAtlasCell(material: BackgroundMaterialId, mask: number): BackgroundAtlasEntry;
```

`backgroundAtlasCell` throws for a mask outside 0–15 (mirrors
`groundAtlasCell`'s contract) — it is always called with a value
`backgroundNeighbourMask` produced, so this should never happen in practice.

**Consumed by**: `Renderer.ts` (`drawBackgroundTiles`).
**Consumes**: nothing from other new modules — pure, table-driven, no DOM.

## `engine/BackgroundDecorCatalog.ts` (new)

```ts
export interface BackgroundDecorEntry {
  sx: number;
  sy: number;
}

export function backgroundRockEntry(col: number, row: number): BackgroundDecorEntry;
```

Internally calls the same `pickVariant(variants, col, row)` hash function
`StaticObjectsCatalog.ts` defines — duplicated (a handful of lines), not
imported from `StaticObjectsCatalog.ts`, per design.md's rationale for
keeping the two catalogs independent.

**Consumed by**: `Renderer.ts` (`drawBackgroundTiles`), only for cells whose
`backgroundNeighbourMask` is 15.

## `engine/Lighting.ts` (edit)

```ts
// Signature unchanged; implementation replaced.
export function isCellDarkening(level: LevelDef, col: number, row: number): boolean;
```

Old signature took `(background: readonly BackgroundPlacement[], col, row)`
and AABB-scanned placements. New implementation:

```ts
export function isCellDarkening(level: LevelDef, col: number, row: number): boolean {
  const material = backgroundAt(level, col, row);
  return material !== null && backgroundMaterialFamily(material) === 'cave';
}
```

Every call site that passed `level.background` as the first argument now
passes `level` itself — call sites are in `PlatformerState.ts` /
`PlatformerPage.tsx` (wherever the darkness tick reads the player's occupied
cell, per O-010's `data-model.md`).

## `engine/Renderer.ts` (edit)

```ts
// Signature unchanged.
export function drawBackgroundTiles(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  backgroundAtlas: HTMLImageElement,
  originX?: number,
  originY?: number,
): void;
```

New implementation iterates every `(row, col)` in `level.background`'s bounds
(same double-loop shape as `drawTerrain`), and for each non-`null` cell:
1. Compute `backgroundNeighbourMask(level, col, row)`.
2. Look up `backgroundAtlasCell(material, mask)`.
3. Draw via the same rotation-aware helper `drawTerrain` already uses for
   ground tiles (`drawGroundTile`'s `save/translate/rotate/restore` pattern),
   generalized to take an arbitrary atlas image + entry rather than being
   grass-specific — extracted into a shared `drawRotatedTile` helper both
   `drawTerrain` and `drawBackgroundTiles` call, rather than duplicated.
4. If `mask === 15`, additionally draw `backgroundRockEntry(col, row)` from
   a second decor image on top.

**Consumes**: `BackgroundAtlas.backgroundAtlasCell`,
`BackgroundDecorCatalog.backgroundRockEntry`, `Terrain.backgroundAt`,
`Terrain.backgroundNeighbourMask`.

## `editor/paintBackgroundCell.ts` (rewrite)

```ts
export function paintBackgroundCell(
  grid: BackgroundGrid,
  col: number,
  row: number,
  material: BackgroundMaterialId,
): BackgroundGrid;

export function eraseBackgroundCell(
  grid: BackgroundGrid,
  col: number,
  row: number,
): BackgroundGrid;
```

Both grow the grid the same way `paintCell.ts`'s `growGrid` does, then write
(or null out) exactly one cell — no footprint, no overlap search. Replaces
`placeBackgroundPiece`/`eraseBackgroundCell`/`footprintCells`/`coversCell`/
`footprintsOverlap` entirely (all five are deleted).

## `editor/backgroundPaletteTiles.ts` (rewrite)

```ts
export const BACKGROUND_PALETTE_SPRITES: Record<BackgroundMaterialId, TileSpriteSpec>;
export const BACKGROUND_PALETTE_LABELS: Record<BackgroundMaterialId, string>;

export interface BackgroundPaletteSection {
  title: string;
  materialIds: BackgroundMaterialId[];
}
export const BACKGROUND_PALETTE_SECTIONS: readonly BackgroundPaletteSection[];
```

Section derivation logic is unchanged in spirit from today
(`backgroundMaterialFamily(id) === 'surface' | 'cave'`), just keyed on
`BackgroundMaterialId` instead of `BackgroundPieceId`, and each material's
palette swatch is its `middle` (mask-15) sprite from `BackgroundAtlas`
(a representative single-tile preview) rather than a whole stamped piece.

## `editor/EditorCanvas.tsx` (edit)

The `DragState` union's `'paintBackground'` variant changes from carrying
`{ pieceId: BackgroundPieceId | undefined; isErase: boolean }` to
`{ material: BackgroundMaterialId | undefined; isErase: boolean }`. The paint
dispatch changes from `placeBackgroundPiece(...)` /
`eraseBackgroundCell(...)` (old signatures) to the new
`paintBackgroundCell(grid, col, row, material)` /
`eraseBackgroundCell(grid, col, row)` (new signatures above). The preview
`drawImage` call already routes through `drawBackgroundTiles` with a
throwaway `LevelDef` — unchanged, since that function's signature doesn't
change.

## Editor state/action layer (post O-016 rework — `editor/editorState.ts` + `editor/editorActions.ts`)

O-016 (merged to `main` mid-design, see plan.md's Scale/Scope note) replaced
the single `editorLevelState.ts` file this contract originally targeted with
a signals/actions split. The rename surface below is what O-014 must apply
to that current (post-O-016) code, not the pre-O-016 file:

```ts
// editor/editorState.ts
export const editorBackgroundSignal: Signal<BackgroundGrid>;              // was Signal<BackgroundPlacement[]>
export const editorBlueprintBackgroundSignal: Signal<BackgroundGrid>;     // was Signal<BackgroundPlacement[]>
export const editorBackgroundPlacementsSignal: ReadonlySignal<BackgroundGrid>; // consider renaming to editorBackgroundGridSignal — "placements" no longer exist as a concept
export const editorSelectedBackgroundPieceSignal: Signal<BackgroundMaterialId | null>; // rename to editorSelectedBackgroundMaterialSignal
export interface PlacementSnapshot {
  grid: TileChar[][];
  background: BackgroundGrid;   // was BackgroundPlacement[]
}
```

```ts
// editor/editorActions.ts
export const selectBackgroundMaterial = (material: BackgroundMaterialId): void; // was selectBackgroundPiece(pieceId)
export const applyBackgroundPaint = (next: BackgroundGrid): void;               // was (next: BackgroundPlacement[])
// shiftBackgroundPlacements (grid-growth handling) is renamed shiftBackgroundGrid and
// reimplemented as an array/row-shift over BackgroundGrid, not a per-placement coordinate rebase
const shiftBackgroundGrid = (target: Signal<BackgroundGrid>, colShift: number, rowShift: number): void;
```

`editor/EditorCanvasPane.tsx`, `editor/EditorWorkspace.tsx`, and
`editor/EditorSidebar.tsx` each pass these renamed signals/actions through as
props (`backgroundPlacements` -> `backgroundGrid`,
`selectedBackgroundPiece`/`onSelectBackgroundPiece` ->
`selectedBackgroundMaterial`/`onSelectBackgroundMaterial`) with no other
structural change — the O-016 rework's component boundaries (canvas pane,
sidebar, workspace composition) stay exactly as they are; only the
background-related prop types flow through renamed.

`editor/Palette.tsx` already renders `BACKGROUND_PALETTE_SECTIONS` from
`backgroundPaletteTiles.ts` section-by-section — that part of O-016's rework
is unaffected in shape, only its element type changes from
`BackgroundPieceId` to `BackgroundMaterialId`.
