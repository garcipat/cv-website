# Phase 1 Data Model — R-010 Platformer Mapper & Editor Unification

**Feature**: `R-010-platformer-mapper-editor-unification` | **Date**: 2026-09-27

R-010 is a refactor: **no persisted data changes.** Level/blueprint JSON, `localStorage` editor
keys, sprites, tuning and translations are untouched. This document describes the new in-code
types/shapes the refactor introduces or relocates, and the invariants they must satisfy. Exact
signatures live in the [contracts](./contracts/); this is the model view.

---

## 1. `LayoutFile` — the one raw file shape (FR-013)

```ts
// level/LayoutFile.ts  (NEW)
export interface LayoutFile {
  name?: string;
  layout: readonly string[];              // one string per row, one char per column
  background?: readonly string[];         // optional; same row shape
  markers?: readonly MarkerPlacement[];   // optional; sparse tile meta layer
}
```

| Consumer | Relation |
| --- | --- |
| `LevelEntry` (`level/levelRegistry.ts`) | `extends LayoutFile { id: string; name: string }` — no redeclared `layout`/`background`/`markers`. |
| `Blueprint` (`level/BlueprintData.ts`) | `extends LayoutFile { id: string; name: string }` — same. |
| `level/layoutFile.ts` (M4 validation home) | `isLayout`/`isBackground`/`isMarkers`/`idFromPath`/`parse*Modules` unchanged; imports/uses `LayoutFile`. |
| `LevelDef` (`level/LevelData.ts`) | **Not** the same type — the parsed runtime artifact (`terrain`, `width`, `height`, `background?`, `markers?`). Deliberately not conflated. |

**Invariant**: exactly one declaration of `layout`/`background`/`markers` in the file-shape family.

## 2. Grid→layout adapter output (FR-002/FR-010)

```ts
// editor/ops/gridLayout.ts  (NEW)
gridToLayout(grid: TileChar[][]): readonly string[]                  // whole grid → rows
markerGridToPlacements(markers: MarkerGrid): MarkerPlacement[]       // dense → sparse
previewLevelDef(grid: TileChar[][], markers: MarkerGrid): LevelDef   // parseLevel(adapter output)
```

The rows are produced by the **same** generic crop primitive (`cropLayoutToBox`) the export path
uses; `gridToLayout(grid)` is that primitive applied to the grid's full bounding box.

**Invariant**: `gridToLayout` is the only editor function that derives raw layout rows from a grid;
`cropLayoutToBox` is the only row-serializer.

## 3. Shared layout-character walk (FR-010)

```ts
// level/layoutChars.ts  (NEW)
walkLayout(layout: readonly string[], visit: (cell: { char: string; col: number; row: number }) => void): void
layoutWidth(layout: readonly string[]): number
```

| Caller | Still returns |
| --- | --- |
| `LevelParser.parseLevel` | `LevelDef` (terrain + marker layer + unknown-char warning) |
| `editor/ops/importLayout.importLayout` | `TileChar[][]` (legacy-marker migration) |

**Invariant**: one walk; the per-path mapping stays with each caller.

## 4. Mapper placement contract (FR-003/FR-004/FR-005)

```ts
// level/placement.ts  (NEW)
export interface MarkerPosition { col: number; row: number }

export interface PlaceAtMarkersDescriptor<M extends MarkerPosition, P> {
  idPrefix: string;
  id?: (marker: M, index: number) => string;             // sign/hazard/chest id override
  build: (marker: M, index: number) => Omit<P, 'id' | 'x' | 'y'>;
}
export function placeAtMarkers<M extends MarkerPosition, P>(
  markers: readonly M[], descriptor: PlaceAtMarkersDescriptor<M, P>,
): P[];   // id = id?.(m,i) ?? `${idPrefix}-${m.col}-${m.row}`; x/y = tileToPixel(m.col,m.row)

export interface FactPoolPlacement extends MarkerPosition {
  id: string; x: number; y: number;
  fact?: CollectedFact; extraFacts?: CollectedFact[];
}
export function placeWithFactPool<M extends MarkerPosition, P extends FactPoolPlacement>(
  markers: readonly M[],
  pool: readonly CollectedFact[],
  descriptor: { idPrefix: string; build: (marker: M, index: number) => Omit<P, keyof FactPoolPlacement> },
): P[];   // slice = pool[revealedFactCountFor(i,n,|pool|) .. revealedFactCountFor(i+1,n,|pool|))
```

| Mapper | Today | After |
| --- | --- | --- |
| `CollectibleMapper.placeCollectibles` | inline `forEach` | `placeAtMarkers(coinMarkers, { idPrefix:'coin', build: () => ({ kind:'coin', collected:false }) })` |
| `CheckpointMapper.placeCheckpoints` | `markers.map` | `placeAtMarkers(markers, { idPrefix:'checkpoint', build: m => ({ col:m.col, row:m.row }) })` |
| `SignMapper.placeSigns` | `markers.map` | `placeAtMarkers(markers, { idPrefix:'sign', id:(m)=>`sign-${m.hintId}-${m.col}-${m.row}`, build:m=>({ hintId:m.hintId }) })` |
| `HazardMapper.placeHazards` | `markers.map` | `placeAtMarkers(markers, { idPrefix:'hazard', id:(m)=>`hazard-${m.hazardType}-${m.col}-${m.row}`, build:m=>({ hazardType:m.hazardType, facing:m.facing, col:m.col, row:m.row }) })` |
| `EnemyMapper.placePurpleSlimes`/`placeBees` | `markers.map` | `placeAtMarkers(..., { idPrefix:'enemy-slimePurple'/'enemy-bee', build:()=>({ type }) })` |
| `EnemyMapper.placeGreenSlimes` | own slice loop | `placeWithFactPool(..., { idPrefix:'enemy-slimeGreen', build:()=>({ type:'slimeGreen' }) })` |
| `BlockMapper.placeCrates` | own slice loop | `placeWithFactPool(..., { idPrefix:'crate', build:()=>({ blockKind:'crate' }) })` |
| `BlockMapper` fragileRock/coinPot/potionPot/bombPot | `for..of push` | `placeAtMarkers` per kind |
| `BlockMapper` questionMark zip | inline `forEach` | `placeAtMarkers(markers, { idPrefix:'qmark', id:(m,i)=>defs[i]?.id ?? `qmark-${m.col}-${m.row}`, build:(m,i)=>defs[i] ? {...defs[i]} : { blockKind:'questionMark' } })` |
| `ChestMapper.placeChests` | `defs.forEach` | `placeAtMarkers(markers.slice(0, defs.length), { idPrefix:'chest', id:(m,i)=>defs[i].id, build:(m,i)=>({ ...defs[i], col:m.col, row:m.row }) })` |

**Invariants**: `placeAtMarkers` is the only marker→placement loop in `level/*Mapper.ts`;
`placeWithFactPool` delegates to it; every id is byte-identical to today (SC-002).

## 5. Id vocabulary + CV fact flattening (FR-006)

```ts
// level/ids.ts  (NEW)
export function slugify(label: string): string;                  // moved verbatim from CollectibleMapper
export function slugId(prefix: string, ...parts: string[]): string;  // `${prefix}-${slugify(parts.join('-'))}`

// level/cvFacts.ts  (NEW)
export function cvFact(
  sectionId: SectionId, sectionLabel: string,
  sourceType: CollectedFact['sourceType'], id: string,
  data: CVItemData | SkillCategoryFact,
): CollectedFact;   // the one { id, sectionId, sectionLabel, data, sourceType } constructor
```

**Invariants**: `slugify` is declared exactly once (no re-export from `CollectibleMapper.ts`); no
mapper imports `slugify` from another mapper.

## 6. Palette descriptor (FR-007/FR-008)

```ts
// editor/ops/paletteTiles.ts  (NEW shape; TileSpriteSpec unchanged)
export type PaletteGroup = 'terrain' | 'decoration' | 'entities' | 'hazards' | 'tools' | 'blueprints';
export interface PaletteTool {
  label: string;
  description: string;
  sprite: TileSpriteSpec | null;
  glyph?: string;
  group: PaletteGroup;
}
export const PALETTE_TOOLS: Record<EditorTool, PaletteTool>;

export interface TerrainPaletteTool extends PaletteTool {
  tileType: TileType;
  char: string;          // module.char, from TILE_MODULES
  fogExempt: boolean;    // module.fogExempt, from TILE_MODULES
  drawBand: TileDrawBand;// module.drawBand, from TILE_MODULES
}
export function terrainPaletteTools(): TerrainPaletteTool[];  // enumerates TILE_MODULES
```

| Old table | Fate |
| --- | --- |
| `PALETTE_TILE_SPRITES` | folds into `PaletteTool.sprite` |
| `PALETTE_TILE_GLYPHS` | folds into `PaletteTool.glyph` |
| `PALETTE_TILE_DESCRIPTIONS` | folds into `PaletteTool.description` |
| `PALETTE_TILE_LABELS` | folds into `PaletteTool.label` |
| `Palette.tsx` `DECORATION_CHARS` local grouping | folds into `PaletteTool.group` |
| `TERRAIN_CHARS`-derived membership | kept, but sourced via `terrainPaletteTools()`/`TILE_MODULES` |

**Invariants**: R-015's `TILE_MODULES` is read, never extended; no palette-local tile registry or
second tile-kind table; every `EditorTool` has exactly one descriptor entry; the rendered label,
description, sprite, glyph and grouping are unchanged.

## 7. Generic paint & crop primitives (FR-009/FR-010)

```ts
// editor/ops/paintGrid.ts  (NEW)
stampGridCells<T>(grid: T[][], cells: readonly { col: number; row: number; value: T }[], emptyValue: T, grow?: boolean): GrowResult<T>
paintGridCell<T>(grid: T[][], col: number, row: number, value: T, emptyValue: T, grow?: boolean): GrowResult<T>

// editor/ops/exportLayout.ts  (generalized; names kept)
cropLayoutToBox<T>(grid: T[][], box: BoundingBox | null, emptyValue: T): readonly string[]
boundingBoxOfContent<T>(grid: T[][], emptyValue: T): BoundingBox | null
unionBoxes(a, b): BoundingBox | null
exportLayout(grid: TileChar[][]): readonly string[]
```

| Per-layer behaviour | Expressed as |
| --- | --- |
| foreground paint | `paintGridCell(..., grow=true)` + spawn/hazard rules in `paintCell` |
| background paint | `paintGridCell(..., grow=true)` |
| marker paint/erase | `paintGridCell(..., grow=false)` |
| blueprint placement | `stampGridCells(..., explicit cells)` |
| blueprint background rebase | `stampGridCells(..., cells where value !== '.')` |
| export / preview rows | `cropLayoutToBox` (sub-rectangle / full grid) |

**Invariants**: one paint primitive; one row-serializer; `cropLevelForExport` is a wrapper, not a
parallel crop loop.

## 8. Generic save module (FR-011)

```ts
// editor/dev/saveFile.ts  (NEW)
export interface SaveResult { written: boolean; path?: string; error?: string }
export function saveFile(opts: { endpoint: string; fileName: string; contents: string }): Promise<SaveResult>;
export function downloadFile(fileName: string, contents: string): void;

// editor/dev/layoutFileJson.ts  (NEW)
export function layoutFileJson(name: string, layout: readonly string[], background: readonly string[], markers?: readonly MarkerPlacement[]): string;
```

| Target | Endpoint | File name | JSON |
| --- | --- | --- | --- |
| level | `SAVE_LEVEL_ENDPOINT` | `levelFileName(name)` (unchanged) | `layoutFileJson(...)` |
| blueprint | `SAVE_BLUEPRINT_ENDPOINT` | `blueprintFileName(name)` (unchanged `'new'`→`'new-1'` guard) | `layoutFileJson(...)` |

**Invariants**: one POST-with-download implementation; identical slug, `hasBackgroundContent`
rule and fallback; produced JSON byte-identical.

## 9. Editor concern split (FR-014)

| Folder | Contents | Must not contain |
| --- | --- | --- |
| `editor/` | React UI (`.tsx`), `editorState.ts` (signals + tool type unions), `editorActions.ts` (controller) | pure transforms |
| `editor/ops/` | pure transforms (D11 list) | React/`.tsx`, UI-module imports |
| `editor/dev/` | save + endpoint + dev-environment modules | React/`.tsx` |

## 10. Guard-test model (FR-017)

The structural invariants above are machine-checked by `editor/editorStructure.test.ts`; see
[contracts/layer-invariants.md](./contracts/layer-invariants.md) §3 for the exact checks. The guard
fails the suite on any regression (SC-009).
