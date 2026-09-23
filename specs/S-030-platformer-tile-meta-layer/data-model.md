# Phase 1 Data Model: Platformer Tile Meta Layer

This feature introduces one new layer (the tile meta layer), one typed per-cell datum (a
marker), and one ordered hint catalog. It removes two members from the existing terrain
vocabulary, removes one hazard character and adds one sign character, and adds an optional
`markers` field to the level and blueprint storage shapes. Everything the running game and
the editor render is either the layer itself or derived from it.

## Entity: `MarkerEntry` (a closed discriminated union)

A marker's value — what it means and the data it carries. Declared in
`src/themes/platformer/level/LevelData.ts`.

| Variant | Value shape | Meaning | Consumer |
| --- | --- | --- | --- |
| `patrolBoundary` | `{ kind: 'patrolBoundary' }` | An invisible, non-solid enemy patrol boundary. An enemy reverses when its visible leading edge reaches it, exactly as it did as a `patrol` tile. | `movement/patrol.ts` (`stepHorizontal`), at runtime. |
| `connectionPoint` | `{ kind: 'connectionPoint' }` | An editor-only marker on a blueprint's border, noting where another room may attach. | Nothing in the running game; the editor and the placement preview only. |
| `fallingStalactite` | `{ kind: 'fallingStalactite' }` | A presence-only variant marker on a `⊤` tile that makes the decorative stalactite shake and drop. | `entities/hazards/FallingStalactite.ts`, via marker-derived placements. |
| `sign` | `{ kind: 'sign'; hintId: HintId }` | A sign standing on a `T` cell; its value is the hint key it shows. | `SignMapper.placeSigns` → the in-game hint bubble; the editor badge/tooltip. |

**Validation**:
- Every variant is reachable from a runtime path; the union is the only marker value shape
  (FR-023). No `any`, no free-form JSON.
- `hintId` is a `HintId` key (`src/themes/platformer/types.ts`; import-only, not edited), resolved through the active locale at runtime,
  never literal translated text (FR-024).
- Adding a kind is one union member plus its own editor presentation.

## Entity: `MarkerGrid` (the runtime layer, derived)

The tile meta layer as the running game reads it — a dense grid aligned 1:1 with
`LevelDef.terrain`. Stored only transiently; **never** persisted densely.

| Field | Type | Rules |
| --- | --- | --- |
| `markers` | `(MarkerEntry \| null)[][]` | Row-major `[row][col]`; `null` means empty. May be absent on a `LevelDef` (no markers). |

**Validation / invariants**:
- Same bounds as `terrain` when present.
- `markerAt(level, col, row)` returns `null` for out-of-bounds, a missing grid, or an empty
  cell — the same forgiving contract `backgroundAt` has.
- A cell carries at most one marker (FR-003/FR-004).

## Entity: `MarkerPlacement` (a stored marker)

One marker as written in a level/blueprint file. Declared in `level/LevelData.ts`.

| Field | Type | Rules |
| --- | --- | --- |
| `col` | `number` | Column relative to the cropped `layout`'s origin. |
| `row` | `number` | Row relative to the cropped `layout`'s origin. |
| `marker` | `MarkerEntry` | The typed value. An unrecognised `kind` is ignored on load (FR-016); an unknown sign `hintId` falls back to `DEFAULT_HINT_ID` (FR-027). |

**Validation / invariants**:
- At most one entry per `(col, row)`; a later duplicate replaces an earlier one.
- An entry whose `(col, row)` is outside the layout's bounds is ignored.
- A file with no markers omits the `markers` field entirely (FR-014).

## Entity: `HintCatalog` (the sign hint order)

Declared in the new `src/themes/platformer/level/HintCatalog.ts`.

| Export | Type | Rules |
| --- | --- | --- |
| `HINT_IDS` | `readonly HintId[]` | The registered hints in stable order. Preserves the old `SIGN_CHARS` digits: `1` `bridgeDropThrough`, `2` `ladderClimbUp`, `3` `fragileRockBreaksFromBelow`, `4` `chestNeedsKey`, `5` `openAllChestsHaveFun`, `6` `bomb`. |
| `DEFAULT_HINT_ID` | `HintId` | `HINT_IDS[0]` — the hint a `T` with no `sign` marker resolves to (FR-027) and the sign tool paints fresh (FR-030). |
| `hintCode(hintId)` | `string` | `String(index + 1)` → `'1'`–`'6'`, the editor badge code (FR-028). |
| `nextHintId(hintId)` | `HintId` | Wraps through `HINT_IDS`; the sign tool's re-click cycle (FR-030). |
| `isHintId(value)` | `value is HintId` | Forgiving validation of a stored marker's `hintId`. |

## Entity: legacy migration vocabulary

Declared in `level/LevelParser.ts`. The **only** place a marker character exists.

| Legacy char | Migrates to | Terrain result |
| --- | --- | --- |
| `P` | `{ kind: 'patrolBoundary' }` | `'empty'` |
| `+` | `{ kind: 'connectionPoint' }` | `'empty'` |
| `1`–`6` | `{ kind: 'sign', hintId }` (per `HINT_IDS`) | `'empty'` (the sign's layout char is now `T`) |
| `T` | `{ kind: 'fallingStalactite' }` | `⊤` — **only when the file is pre-feature** (see below) |
| `T` | `{ kind: 'sign', hintId }` / default | `'empty'` — when the file is new-format (FR-025/FR-027) |

**The `T` generation rule** (FR-015 vs FR-025/FR-027):
- `storedMarkers === undefined` (the file has no `markers` field) ⇒ pre-feature ⇒ `T` is
  the falling-stalactite hazard.
- `storedMarkers` present (even `[]`) ⇒ new-format ⇒ `T` is the sign character; its hint is
  the cell's `sign` marker, or `DEFAULT_HINT_ID` when absent.
- An explicit `sign` marker at a `T` cell always wins, so a new-format file is never
  re-interpreted as pre-feature.

## Entity: `LevelDef` (extended)

`src/themes/platformer/level/LevelData.ts`.

| Field | Type | Rules |
| --- | --- | --- |
| `terrain` | `TileMap` | Unchanged; no longer ever contains `patrol`/`blueprintConnectionPoint`, and a falling stalactite is a `stalactite` tile, not a `T` char. |
| `width` / `height` | `number` | Unchanged. |
| `background` | `BackgroundGrid?` | Unchanged. |
| `markers` | `MarkerGrid?` | NEW. Optional; absent when the level has no markers. |

**Validation**:
- `parseLevel(layout, storedMarkers?)` builds `markers` by (1) lifting legacy `P`/`+`/
  digits/`T` out of `layout` and writing `'empty'` (or `⊤` for a legacy `T`) in their
  terrain cell (FR-015), then (2) applying `storedMarkers` on top, ignoring unknown kinds
  and out-of-bounds entries (FR-016).
- Removing `patrol`/`blueprintConnectionPoint` from `TileType` forces `TILE_FOG_EXEMPT`,
  `Renderer.tileSource`'s exhaustive switch, and every tile test to be updated at compile
  time.

## Entity: `Blueprint` (extended)

`src/themes/platformer/level/BlueprintData.ts`.

| Field | Type | Rules |
| --- | --- | --- |
| `id` / `name` | `string` | Unchanged. |
| `layout` | `readonly string[]` | Terrain/entity/sign/hazard characters; a legacy layout's `P`/`+`/digits/`T` are lifted on load. |
| `background` | `readonly string[]?` | Unchanged. |
| `markers` | `readonly MarkerPlacement[]?` | NEW. Optional; absent when the room has no markers. |

**Validation**:
- `isBlueprint` gains a `markers` shape check: when present, an array whose entries each
  have numeric `col`/`row` and a `marker` object with a string `kind`; a malformed `markers`
  costs only that field (the same forgiving behaviour `background` has).
- `blueprintCells(layout)` returns terrain cells only.
- `blueprintMarkers(blueprint)` returns the marker placements relative to the room's
  top-left corner.

## Entity: `LevelEntry` (extended)

`src/themes/platformer/level/levelRegistry.ts`.

| Field | Type | Rules |
| --- | --- | --- |
| `id` / `name` / `layout` / `background` | unchanged | — |
| `markers` | `readonly MarkerPlacement[]?` | NEW; validated forgivingly, exactly like `background`. A missing field means the level is pre-feature (the `T` generation rule). |

## Entity: `EditorTool` / `MarkerTool` (extended)

`src/themes/platformer/editor/editorState.ts` — the palette's selection type.

```ts
export type MarkerTool = 'patrolBoundary' | 'connectionPoint' | 'fallingStalactite';
export type EditorTool = TileChar | MarkerTool;
```

| Tool | Kind | What a click writes |
| --- | --- | --- |
| `patrolBoundary` | `MarkerTool` | `{kind:'patrolBoundary'}` marker only; terrain untouched. |
| `connectionPoint` | `MarkerTool` | `{kind:'connectionPoint'}` marker only; blueprint canvas only (FR-007/FR-010). |
| `fallingStalactite` | `MarkerTool` | `⊤` terrain + `{kind:'fallingStalactite'}` marker (FR-031). |
| `T` | `TileChar` (sign) | `T` terrain + a `sign` marker: default hint fresh, next hint on re-click (FR-030). |
| `⊤` | `TileChar` (decorative) | `⊤` terrain only, no marker (FR-031). |
| `.` (Eraser) | `TileChar` | Clears terrain, and with it any marker that describes that tile (a sign, a falling stalactite); a patrol boundary or connection point stays (FR-002). |
| right-click | gesture | A pure marker tool clears its own marker; the sign/falling tools clear their tile and marker together (FR-010/FR-030/FR-031); terrain tools erase terrain. |

**Validation / invariants**:
- A pure marker tool writes only to the marker grid; a terrain/entity/hazard tool writes
  only to the terrain grid; a background tool writes only to the background grid (FR-013).
- The sign and falling-stalactite tools are the two variant tools that write a terrain char
  **and** their own marker; they never write another marker.
- Selecting a marker tool never changes which terrain layer is active (FR-009).
- The eraser gesture (right-click) clears the selected kind's cell.

## Entity: editor marker grid (persisted session state)

`src/themes/platformer/editor/editorState.ts`.

| Signal | Type | Storage key | Default |
| --- | --- | --- | --- |
| `editorMarkerSignal` | `(MarkerEntry \| null)[][]` | `platformer-editor-markers` | empty grid |
| `editorBlueprintMarkerSignal` | `(MarkerEntry \| null)[][]` | `platformer-editor-blueprint-markers` | empty grid |
| `editorMarkerGridSignal` | derived | — | the active canvas's grid |

**Validation / invariants**:
- Persisted on the same debounce as the terrain/background grids (FR-012); a persisted grid
  is validated by a forgiving shape guard on load (the one untyped boundary).
- Aligned 1:1 with the active terrain grid; shifted by terrain growth exactly as the
  background grid is (D9).
- Marker paint never grows the grid; an out-of-bounds click is a no-op (FR-010).
- Stale persisted state holding legacy characters inside the terrain grid is **not**
  migrated (spec Edge Case); the affected keys can be cleared, matching the existing policy.

## Entity: `CroppedLevel` (extended)

`src/themes/platformer/editor/cropLevelForExport.ts`.

| Field | Type | Rules |
| --- | --- | --- |
| `layout` | `readonly string[]` | Cropped to the combined content box. |
| `background` | `readonly string[]` | Cropped to the same box. |
| `markers` | `readonly MarkerPlacement[]` | NEW. Serialized relative to the same box origin; empty when there are none. |

**Validation / invariants**:
- The combined box is the tightest rectangle over every non-`.` terrain cell **and** every
  non-null marker cell (FR-017).
- A marker on a cell with no terrain is inside the box and survives the crop.
- An all-empty level still exports `layout: ['.']`, `background: []`, `markers: []`.

## State transitions

The tile meta layer has no runtime state machine. Its transitions are editor actions:

```
empty cell  --pure marker tool click-->        cell holds the tool's marker
cell marked --same pure tool click-------->     cell holds the same marker (idempotent)
cell marked --different pure tool click--->     cell holds the new marker (replaced; FR-003)
cell marked --erase gesture, marker tool-->     empty cell (marker cleared)
empty cell  --sign tool click-------------->    T terrain + {sign, DEFAULT_HINT_ID}
sign cell   --sign tool click-------------->    T terrain + {sign, nextHintId}
T cell      --erase gesture (sign tool)--->     empty terrain, sign marker cleared (sign removed)
⊤ cell      --falling tool click----------->    ⊤ terrain + {fallingStalactite}
⊤ cell      --decorative tool click-------->    ⊤ terrain, no marker
sign/falling cell --eraser or other terrain tool --> replaced terrain, stale marker cleared (FR-002)
```

At runtime, a marker is read-only: `markerAt` is a pure lookup and nothing mutates
`LevelDef.markers`.

## Relationships

```
level/blueprint file
  { layout, background?, markers?: [{col,row,marker}] }
        │
        │ parseLevel(layout, storedMarkers)  — lifts legacy P/+/1-6/T (FR-015)
        ▼
   LevelDef.terrain[][]  +  LevelDef.markers: (MarkerEntry|null)[][]
        │                              │
        │ editor import (migrated)     │ markerAt(level, col, row)
        ▼                              ▼
  editor marker grid ((MarkerEntry|null)[][])
        │                              ├─ movement/patrol.ts → reverses at a patrolBoundary (FR-021)
        │ paintMarkerCell (no grow)   ├─ findSignTiles(layout, markers) → signPlacements → hint bubble (FR-032)
        │ eraseMarkerCell             └─ findHazardTiles(layout, markers) → hazardPlacements → shake/drop (FR-032)
        │
        │ cropLevelForExport(grid, background, markers)
        ▼
   { layout, background, markers }  ──save──▶  { ..., markers: [{col,row,marker}] }

Blueprint ──blueprintMarkers()──▶ markers relative to the room
        └── commitPlacement/placeBlueprint ──▶ level marker grid at the anchor (FR-018/FR-020)
```

## Constants and conventions

| Name | Value / rule | Meaning |
| --- | --- | --- |
| `MarkerEntry` | 4-member union | The only marker value shape (FR-023). |
| `SIGN_CHAR` | `'T'` | The one sign layout character; resolves to `'empty'` terrain (FR-025). |
| `HINT_IDS` | ordered 6 `HintId`s | Badge code, cycle and default order (FR-027/FR-028/FR-030). |
| `DEFAULT_HINT_ID` | `HINT_IDS[0]` | A `T` with no `sign` marker (FR-027). |
| empty marker cell | `null` in `MarkerGrid` | Same split `BackgroundGrid` already uses. |
| storage field | `markers` | Omitted entirely when empty (FR-014). |
| `T` generation | `storedMarkers === undefined` ⇒ legacy | The only disambiguator between the old hazard `T` and the new sign `T`. |
| crop box | terrain **∪** markers | FR-017. |
| overlap check | terrain only | FR-019. |
| runtime `HAZARD_TYPES` | keeps `fallingStalactite` | Behavior registry; only char discovery moves to the layer. |
