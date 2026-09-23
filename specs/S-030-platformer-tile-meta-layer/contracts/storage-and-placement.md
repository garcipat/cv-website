# Contract: storage, crop, migration and blueprint placement

Covers the on-disk shape in `src/themes/platformer/level/` and the save/crop/placement code
in `src/themes/platformer/editor/`. It implements FR-014–FR-020 and FR-022.

## The stored shapes

```ts
// levelRegistry.ts
export interface LevelEntry {
  readonly id: string;
  readonly name: string;
  readonly layout: readonly string[];
  readonly background?: readonly string[];
  readonly markers?: readonly MarkerPlacement[]; // NEW
}

// BlueprintData.ts
export interface Blueprint {
  id: string;
  name: string;
  layout: readonly string[];
  background?: readonly string[];
  markers?: readonly MarkerPlacement[]; // NEW
}
```

```json
{
  "name": "Cave Run",
  "layout": [".T.", "GGG"],
  "background": ["...", ".c."],
  "markers": [
    { "col": 1, "row": 0, "marker": { "kind": "sign", "hintId": "bridgeDropThrough" } },
    { "col": 2, "row": 0, "marker": { "kind": "fallingStalactite" } }
  ]
}
```

- `markers` is omitted entirely when there are none (FR-014): an unmarked level's file is
  byte-for-byte what it is today.
- `markers` is a sparse entry list of typed `MarkerPlacement` objects, never a dense grid
  and never a character (FR-014/FR-023).
- Coordinates are relative to the cropped `layout`'s origin.

## Validation (forgiving load)

- `levelRegistry.parseLevelModules` / `blueprintRegistry.parseBlueprintModules` add a
  `markers` shape check: when present it must be an array whose entries each carry a numeric
  `col` and `row` and a `marker` object with a string `kind`. A malformed `markers` costs
  only that field — the level/room still loads (matching how `background` is handled).
- `parseMarkers` ignores an entry whose `marker.kind` is unknown (FR-016) or whose
  `(col, row)` is outside the layout; a `sign` whose `hintId` is not a `HintId` falls back
  to `DEFAULT_HINT_ID` (FR-027 edge case).
- A legacy file whose `layout` still contains `P`/`+`/`1`–`6` loads with those markers
  lifted into the layer and the terrain there emptied (FR-015). A legacy `T` becomes a `⊤`
  tile + `fallingStalactite` marker because the file has no `markers` field (the `T`
  generation rule, D5).

## Migration — `level/LevelParser.ts` + `editor/importLayout.ts`

- `parseLevel(layout, storedMarkers?)` is the single runtime migration point (see
  [tile-meta-layer.md](./tile-meta-layer.md)).
- The editor's `importLayout`/load path performs the same lift once, producing a
  `TileChar[][]` where a legacy digit is `T`, a legacy `T` hazard is `⊤`, and a marker grid
  populated with the lifted values. The next save writes the new shape.
- The editor's Try (`tryLayout`) writes `currentLayout`, `currentBackgroundLayout` and
  `currentMarkers`; the game then reads the migrated layer through `currentLevel`.
- Effective gameplay is identical whether a marker came from an old `layout` character or
  the new `markers` field (FR-022), because both resolve to the same `MarkerEntry` read by
  `markerAt`/`findSignTiles`/`findHazardTiles`.

## Crop — `editor/exportLayout.ts` and `editor/cropLevelForExport.ts`

```ts
export interface CroppedLevel {
  layout: readonly string[];
  background: readonly string[];
  markers: readonly MarkerPlacement[]; // NEW
}

export function cropLevelForExport(
  grid: TileChar[][],
  background: BackgroundChar[][],
  markers: (MarkerEntry | null)[][],
): CroppedLevel;
```

- The bounding box is the tightest rectangle over every non-`.` terrain cell **and** every
  non-null marker cell (FR-017). `exportLayout.ts` gains `unionBoxes` and a
  `cropLayoutToBox(grid, box)` so all three layers share one origin; `exportLayout(grid)`
  keeps its current behaviour as `cropLayoutToBox(grid, boundingBoxOfContent(grid, '.'))`.
- `layout` and `background` are cropped to that box; `markers` are serialized relative to
  its origin as `MarkerPlacement[]`.
- An all-empty grid exports `layout: ['.']`, `background: []`, `markers: []`.
- A marker on a cell with no terrain is inside the box and survives the crop (FR-017).

## Save — `editor/saveLevelFile.ts` / `saveBlueprintFile.ts`

```ts
export const levelFileJson = (
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[],
): string;

export const saveLevel = async (
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[],
): Promise<SaveLevelResult>;
```

- `markers` is included only when non-empty, mirroring `hasBackgroundContent`.
- The blueprint equivalents change identically.
- The dev-server write plugins take the already-serialized `contents`, so they need no
  change.

## Export display — `editor/EditorToolbar.tsx`

The Export dialog displays the **complete level JSON**, not the layout rows it showed before
(FR-033). It calls the same `levelFileJson(loadedName, cropped.layout, cropped.background,
cropped.markers)` the Save path uses (FR-034), so the text in the textarea and the text a
save writes are byte-identical; the copy control copies exactly that text. The JSON carries
all three layers — foreground `layout`, `background` (only when it holds content), and
`markers` (only when present). The `// LEVEL_1_BACKGROUND`-style rendering and its
`formatRows` helper are removed.

- The dialog remains level-only (the toolbar hides Export in blueprint mode); a blueprint's
  complete JSON is reachable through its Save control.
- The `name` shown is the loaded level's name, matching what Save prefills.
- Amends [F-019](../../F-019-platformer-level-editor/spec.md)'s export display (its FR-019),
  which could not represent markers.

## Blueprint placement

```ts
// editor/blueprintCells.ts
export function blueprintCells(layout: readonly string[]): readonly BlueprintCell[]; // terrain only

// editor/placeBlueprint.ts
export function blueprintMarkers(
  blueprint: Blueprint,
): readonly { row: number; col: number; marker: MarkerEntry }[];

export function placeBlueprintMarkers(
  markers: (MarkerEntry | null)[][],
  blueprintMarkers: readonly { row: number; col: number; marker: MarkerEntry }[],
  anchorCol: number,
  anchorRow: number,
): (MarkerEntry | null)[][];
```

- `blueprintCells` returns terrain cells only; after migration a layout no longer contains
  marker characters, so this is automatic.
- `blueprintFit` is unchanged and terrain-only: a marker alone never blocks a placement, and
  a placement never removes terrain because of a marker (FR-019).
- `placeBlueprintMarkers` writes each marker at `anchor + (col, row)`, replacing whatever
  marker was there (FR-018/FR-020). It never grows the grid — a placement's growth is
  already applied to the level grid before stamping, and markers only ever land inside the
  placed room's own extent.
- The placement preview includes the blueprint's marker cells so a connection point is
  visible before committing.

## Tests

- `level/levelRegistry.test.ts` / `blueprintRegistry.test.ts` — `markers` is parsed and
  validated forgivingly; a malformed `markers` costs only the field; a missing field means
  pre-feature.
- `editor/exportLayout.test.ts` / `cropLevelForExport.test.ts` — the box includes a marker
  on an empty cell; markers serialize relative to the origin; an unmarked crop is unchanged.
- `editor/saveLevelFile.test.ts` / `saveBlueprintFile.test.ts` — `markers` omitted when
  empty, present when not; the typed object shape round-trips.
- `editor/placeBlueprint.test.ts` — markers stamped at the anchor; an existing marker is
  replaced; no marker is written outside the room.
- `editor/blueprintFit.test.ts` — a marker in the target grid does not block a placement.
- `editor/editorActions.test.ts` — a level saved with markers round-trips through
  `loadLevel`, including the legacy migration.
