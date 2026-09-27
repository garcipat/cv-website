# Contract — Grid Pipeline (adapter, layout-character walk, crop)

**Feature**: `R-010-platformer-mapper-editor-unification`
**Requirements**: FR-002, FR-010; SC-004
**Consumers**: `level/LevelParser.ts`, `editor/ops/importLayout.ts`, `editor/ops/gridLayout.ts`,
`editor/ops/exportLayout.ts`, `editor/ops/cropLevelForExport.ts`, `editor/ops/previewPlacements.ts`

---

## 1. Layout-character walk (one home: `level/layoutChars.ts`)

```ts
export interface LayoutCell { char: string; col: number; row: number }
export function walkLayout(layout: readonly string[], visit: (cell: LayoutCell) => void): void;
export function layoutWidth(layout: readonly string[]): number;
```

Rules:

- `layoutWidth` = `Math.max(0, ...row.length)`; missing trailing cells are skipped (both callers
  already treat a short row as padded empty).
- `parseLevel` (returns `LevelDef`) and `importLayout` (returns `TileChar[][]`) both iterate via
  `walkLayout`; neither may contain its own `for row … for col …` character loop.
- The per-path mapping (terrain/entity/sign/hazard + unknown-char warning vs `TileChar` +
  legacy-marker migration) stays with each caller; signatures are deliberately not unified.

## 2. Grid→layout adapter (one home: `editor/ops/gridLayout.ts`)

```ts
export function gridToLayout(grid: TileChar[][]): readonly string[];
export function markerGridToPlacements(markers: MarkerGrid): MarkerPlacement[];
export function previewLevelDef(grid: TileChar[][], markers: MarkerGrid): LevelDef;
```

Rules:

- `gridToLayout` serializes the **whole** rectangular grid to rows via `cropLayoutToBox` (the one
  generic row-serializer, §3). It is the **only** editor function that derives raw layout rows from
  a grid; the export path uses the same serializer.
- `gridToLayout(grid)` MUST equal `cropLayoutToBox(grid, {minRow:0,maxRow:grid.length-1,minCol:0,maxCol:width-1}, '.')`.
- `previewLevelDef` = `parseLevel(gridToLayout(grid), markerGridToPlacements(markers))`. Markers are
  always passed (even `[]`) so `parseLevel`'s `T`-generation rule maps a bare `T` to `'empty'`
  (sign), not the decorative `stalactite`.
- The finders (`findGreenEnemyTiles`, `findCoinTiles`, `findCrateTiles`, `findChestTiles`,
  `findCheckpointTiles`, `findSignTiles`, `findHazardTiles`, `findLadderBundleTiles`, …) receive
  `gridToLayout(grid)`; sign/hazard finders additionally receive the `MarkerGrid`.
- Chest preview def padding (OQ-1): `previewPlacements` calls
  `placeChests(padChestDefs(mapCVDataToChests(cv), chestMarkers), chestMarkers)` with
  `chestMarkers = findChestTiles(layout)`, where `padChestDefs` appends placeholder-fact defs until
  the def count equals `chestMarkers.length`, so every `$` marker previews and stays deletable. The
  runtime passes the unpadded def list; the finder and place function remain the shared ones (no
  preview-local placement logic).

## 3. Generic grid-crop primitive (one home: `editor/ops/exportLayout.ts`)

```ts
export function boundingBoxOfContent<T>(grid: T[][], emptyValue: T): BoundingBox | null;
export function unionBoxes(a: BoundingBox | null, b: BoundingBox | null): BoundingBox | null;
export function cropLayoutToBox<T>(grid: T[][], box: BoundingBox | null, emptyValue: T): readonly string[];
export function exportLayout(grid: TileChar[][]): readonly string[];
```

Rules:

- `cropLayoutToBox` is the **one** grid sub-rectangle → rows serializer (`null` box ⇒ `['.']`;
  ragged cells read as `emptyValue`). It is generic over the cell type so the foreground
  (`TileChar`, empty `'.'`) and background (`BackgroundChar`, empty `'.'`) share it.
- `cropLevelForExport` keeps its public shape `{ layout, background, markers }` and its exact
  current semantics (box = union of non-`.` foreground cells and non-null markers; all-empty ⇒
  `layout: ['.']`, `background: []`, `markers: []`), but obtains **both** `layout` and `background`
  from `cropLayoutToBox` rather than serializing them itself. It may still walk the box to collect
  the sparse marker layer (that loop only reads `markers` and shifts coordinates), but it MUST
  define no character/background row-serialization loop.
- `exportLayout(grid)` = `cropLayoutToBox(grid, boundingBoxOfContent(grid, '.'), '.')`.
- The registries (`levelRegistry`/`blueprintRegistry`) parse layouts and never crop; the "shared
  with the runtime registries" clause of FR-010 applies to the §1 walk only.
