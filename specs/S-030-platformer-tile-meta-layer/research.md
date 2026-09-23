# Phase 0 Research: Platformer Tile Meta Layer

The spec's Clarifications session settled the behavioural questions (markers may share a
cell with foreground content; markers never grow the canvas; the layer is the "tile meta
layer" and its entries are "markers"; a marker's value is a typed discriminated union).
These decisions cover the remaining implementation choices: how a marker's value is
represented once it leaves the terrain grid, how the layer is stored and migrated, how a
sign's hint and a falling stalactite's variant move off their characters, how the editor
paints and presents them without a second canvas mode, and how a blueprint's markers
travel with the room.

The guiding constraint is FR-001/FR-015: every piece of per-cell content the terrain grid
encodes today — the enemy patrol boundary (`P`), the blueprint connection point (`+`), a
sign's hint (digits `1`–`6`) and the falling-stalactite variant (`T`) — must stop being a
character, and every existing level/blueprint must load with the same markers and the same
effective gameplay.

## D1 — A marker is a typed discriminated union, not a character

**Decision**: Introduce a closed, typed value union and its grid/storage companions in
`level/LevelData.ts`:

```ts
export type MarkerEntry =
  | { kind: 'patrolBoundary' }
  | { kind: 'connectionPoint' }
  | { kind: 'fallingStalactite' }
  | { kind: 'sign'; hintId: HintId };

export type MarkerGrid = (MarkerEntry | null)[][]; // row-major [row][col]

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
  markers?: MarkerGrid; // NEW
}
```

The runtime cell type is `MarkerEntry | null`; the sparse storage entry is
`MarkerPlacement`. There is no per-cell character vocabulary for markers any more —
legacy characters exist only inside the migration map (D5).

**Rationale**: FR-023 requires each kind to declare exactly the data it needs and forbids
untyped per-cell JSON. Three kinds are presence-only; a sign carries a `hintId`. A union
states that directly, and adding a kind is one union member plus its editor presentation.
A parallel character map would need a second untyped lookup and could not express the
sign's value without a second side table.

**Alternatives considered**:

- *Keep a single `MarkerChar` per cell (`P`/`+`/`1`–`6`/`T`) plus side data* — rejected:
  it re-creates the character-encoding problem FR-023 removes, and the sign's hint would
  still need an out-of-band lookup.
- *A generic `Record<string, unknown>` value* — rejected by FR-023 and the constitution's
  no-`any` rule; nothing would be exhaustively checkable.
- *Store the marker kind name as a string without a union* — rejected: a typo would only
  surface at runtime, and `switch` exhaustiveness on the renderer/editor would be lost.

## D2 — The legacy markers leave `TileType`, and `T` changes owner

**Decision**:

- Remove `'patrol'` and `'blueprintConnectionPoint'` from `TileType` (and from
  `TILE_FOG_EXEMPT` in `level/LevelData.ts`).
- Remove `T` from `HAZARD_CHARS`. The falling stalactite is no longer a hazard
  *character*; it is a `fallingStalactite` marker on the decorative `⊤` tile (FR-026).
- Add `SIGN_CHAR = 'T'` (replacing the six-key `SIGN_CHARS`): one uniform character for
  every sign, resolving to `'empty'` terrain exactly as sign characters do today
  (FR-025).
- The runtime `HAZARD_TYPES` registry (`entities/hazards/index.ts`) **keeps** the
  `fallingStalactite` behavior module. `HAZARD_TYPES` maps a `HazardKind` to its behavior,
  not a character to a hazard; removing it would break the existing shake-and-drop module.
  Only the *discovery* of a falling stalactite moves from `HAZARD_CHARS` to the marker
  layer (D7).
- `TERRAIN_CHARS` loses `P`/`+`; `TileChar` loses `'P'`/`'+'`. The module-load shared-key
  guard gains `SIGN_CHAR` (as the sign owner) and is updated for the removed keys, so no
  character can mean both a terrain tile and a sign.

**Rationale**: A cell holds exactly one terrain character, so a terrain layout can never
express "wall **and** marker". Removing the two markers from `TileType` is what makes the
invariant enforceable — no terrain paint path can accidentally write one, and
`Renderer.tileSource`'s exhaustiveness check forces every consumer to be revisited at
compile time. Removing `T` from `HAZARD_CHARS` frees the character for the sign (FR-026),
and keeping the runtime behavior registered preserves "the same shake-and-drop" (FR-032).

**Alternatives considered**:

- *Remove `fallingStalactite` from `HAZARD_TYPES` too* — rejected: that registry is the
  behavior dispatch (`typeOf` → `FallingStalactite.ts`), not a character map; removing it
  would leave a marker with no behavior and break SC-008.
- *Keep `patrol`/`blueprintConnectionPoint` as `TileType` members and add the layer
  alongside* — rejected: violates FR-001, leaves two homes for one marker, and lets a
  marker be silently replaced by painting terrain over it.
- *Give the sign its own new character instead of reusing `T`* — rejected by FR-025/FR-026;
  the freed `T` is the point of the change.

## D3 — The runtime layer is a dense `MarkerGrid` read through `markerAt`

**Decision**: `parseLevel` attaches an optional `markers` grid to the `LevelDef`, aligned
1:1 with `terrain`, and `level/Terrain.ts` gains:

```ts
export function markerAt(level: LevelDef, col: number, row: number): MarkerEntry | null;
```

`markerAt` returns `null` for an out-of-bounds coordinate, a missing `markers` field, or an
empty cell — the same forgiving contract `backgroundAt` already has.

**Rationale**: Alignment is an editor and runtime property (FR-004), and a dense grid is
the smallest code change that gives O(1) cell lookup: it mirrors `BackgroundGrid`/
`backgroundAt` exactly, so no new access pattern is invented. The level grid is at most a
few hundred columns by a few dozen rows, so a dense `null`-filled grid costs nothing at
runtime. Storage is the only place FR-014 forbids density, and that is D4's concern.

**Alternatives considered**:

- *Sparse runtime map keyed `"col,row"`* — rejected: every lookup would parse/format a key
  or hold a `Map`, and `LevelDef` already demonstrates the dense-grid convention
  (`background`); the alignment requirement makes a dense grid the natural shape.
- *Fold markers into `terrain` as a new composite cell type* — rejected: it would force
  every terrain predicate (`isSolid`, `isClimbable`, neighbour masks, autotiling) to
  understand a wrapper, for a value none of them should read.
- *Thread a separate `markers` argument through `MovementContext`* — rejected: `LevelDef`
  is already passed whole to enemy movement, and markers are a property of the level, not
  of one tick.

## D4 — Storage is a sparse, typed `markers` entry list, omitted when empty

**Decision**: A saved level/blueprint gains an optional `markers` field: a list of
`MarkerPlacement` entries whose coordinates are relative to the cropped `layout`'s own
origin (the same space `layout`/`background` already share).

```json
{
  "name": "Cave Run",
  "layout": [".T.", "GGG"],
  "background": ["...", ".c."],
  "markers": [
    { "col": 1, "row": 0, "marker": { "kind": "sign", "hintId": "bridgeDropThrough" } },
    { "col": 4, "row": 0, "marker": { "kind": "patrolBoundary" } }
  ]
}
```

- The field is omitted entirely when there are no markers, so an unmarked level's file is
  byte-for-byte what it is today (FR-014).
- A single marker adds one typed object, not a grid of empty cells (FR-014).
- An entry whose `marker.kind` is unknown is skipped without failing the load (FR-016); an
  entry outside the layout's bounds is skipped too; a `sign` with an unknown `hintId`
  falls back to the default hint (FR-027/edge case).

**Rationale**: FR-014 explicitly rejects a dense per-cell grid, and an entry list is the
minimal sparse encoding of "only the markers that are actually present". Storing the typed
`MarkerEntry` (not a character) is what FR-023 requires; it also makes a stored marker
self-describing in a hand-edited file. Relative-to-crop coordinates are required because
`layout` is cropped on save, and `background` is cropped to the same origin.

**Alternatives considered**:

- *A dense `string[]` marker layout mirroring `background`* — rejected by FR-014 and
  FR-023: it would bloat with empty cells and re-introduce a character vocabulary.
- *A `{ "col,row": <marker> }` object* — rejected: less readable in a hand-editable file
  and inconsistent with how every other layer stores coordinates.
- *Storing a marker as its legacy character in the entry* — rejected: the layer is typed;
  a character would need a second lookup and could not carry the sign's `hintId`.

## D5 — Migration happens at load time, and the `T` overloading is resolved by generation

**Decision**: `parseLevel(layout, storedMarkers?)` performs the lift:

1. Legacy marker characters still present in `layout` are resolved through a migration map
   and their terrain cell is written as `'empty'`: `P` → `{kind:'patrolBoundary'}`,
   `+` → `{kind:'connectionPoint'}`, a digit `1`–`6` → `{kind:'sign', hintId}` (FR-015).
   These are recognised legacy characters, so the unknown-character warning does not fire
   for them.
2. `storedMarkers` entries are then applied on top (a new-format file has none in
   `layout`); an entry with an unrecognised `kind` or out-of-bounds coordinate is ignored
   (FR-016).
3. **`T` disambiguation.** A `T` cell is a sign (FR-025) when the file is new-format and a
   legacy falling-stalactite hazard (FR-015) when it is pre-feature. The generation signal
   is the `markers` field: `storedMarkers === undefined` (a file with no `markers` field)
   is pre-feature, so `T` → `⊤` terrain + `{kind:'fallingStalactite'}`; `storedMarkers`
   present (even `[]`) is new-format, so `T` is a sign whose hint is the cell's `sign`
   marker, or `DEFAULT_HINT_ID` when the marker is absent (FR-027). An explicit `sign`
   marker at a `T` cell always wins, so a new-format file is never re-interpreted.

`currentLevel` (`level/level.ts`) is the single consumer that merges the level's layout and
its explicit marker field, exactly as it already merges `currentLayout` and
`currentBackgroundLayout`:

```ts
export const currentMarkers = signal<readonly MarkerPlacement[] | undefined>(undefined);
export const currentLevel = computed<LevelDef>(() => {
  const terrain = parseLevel(currentLayout.value, currentMarkers.value);
  return { ...terrain, background: parseBackgroundLayout(...) };
});
```

`currentMarkers` is deliberately `undefined` for a pre-feature level (the shipped level is
updated to the new shape, so it is defined there) so `parseLevel` can tell the two
generations apart. The editor's load path migrates a legacy `LevelEntry` into a new-shape
grid + marker grid once (D8); the editor's Try writes `currentMarkers` alongside
`currentLayout`/`currentBackgroundLayout`.

**Rationale**: FR-015 wants migration "at load time" and FR-022 wants the effective
gameplay identical either way; both fall out of reading the legacy characters through the
same migration map the new field uses. The `markers`-field signal is the only reliable
generation marker available, because the character `T` itself is genuinely ambiguous
between the two generations. There is no separate one-time conversion pass to get out of
sync, and a file saved before this feature keeps working indefinitely.

**Alternatives considered**:

- *Treat every bare `T` as a legacy falling stalactite* — rejected by FR-027 (a hand-edited
  new-format `T` must load as a sign showing the default hint).
- *Treat every `T` as a sign* — rejected by FR-015/User Story 5 (a pre-feature falling
  stalactite must keep falling).
- *A migration script over the JSON files* — rejected: files are user-authored and the
  forgiving-load policy already handles old shapes at read time; a script would add a
  second, divergent code path.
- *Migrate the editor's persisted `localStorage` grid too* — rejected by the spec's Edge
  Case: local working state is explicitly not migrated (same policy as every prior remap);
  the affected keys can be cleared.

## D6 — Hints gain an ordered catalog, a default and a short code

**Decision**: A new pure `level/HintCatalog.ts` owns the sign hint order that `SIGN_CHARS`
used to carry:

```ts
export const HINT_IDS: readonly HintId[] = [
  'bridgeDropThrough', 'ladderClimbUp', 'fragileRockBreaksFromBelow',
  'chestNeedsKey', 'openAllChestsHaveFun', 'bomb',
];
export const DEFAULT_HINT_ID: HintId = HINT_IDS[0];
export function hintCode(hintId: HintId): string;   // '1'..'6' (index + 1)
export function nextHintId(hintId: HintId): HintId; // wraps through HINT_IDS
export function isHintId(value: unknown): value is HintId;
```

The order preserves the old `SIGN_CHARS` digits (`1` = `bridgeDropThrough` … `6` = `bomb`),
so the editor badge codes and the migration of legacy digits both read the same numbering.

**Rationale**: The hint's identity is now data on the marker, but three things still need
an ordering: the editor badge's short code (FR-028), the sign tool's cycle (FR-030) and the
default fallback (FR-027). Keeping it as one explicit ordered list (rather than deriving
from `Object.keys` of an i18n object) keeps the codes stable across locales and makes the
default explicit.

**Alternatives considered**:

- *Derive the order from `Translation['platformer']['hints']`'s key order* — rejected: the
  translation object's order is not a contract and could change with an i18n edit.
- *Use the `hintId` string itself as the badge* — rejected: the badge is a small corner
  glyph (FR-028); a short 1–6 code is legible, and reusing the old digits keeps continuity
  with what authors saw before.

## D7 — The runtime discovers signs and falling stalactites from the layer

**Decision**:

- `findSignTiles(layout, markers?)` scans the layout for `SIGN_CHAR` (`T`) and pairs each
  cell with `markers?.[row]?.[col]` when it is a `sign`, else `DEFAULT_HINT_ID` (FR-027).
- `findHazardTiles(layout, markers?)` stays the **single** hazard-discovery entry point. It
  scans the layout for the character hazards and the marker grid for
  `{kind:'fallingStalactite'}`, returning one combined reading-order list of the same
  `{col,row,hazardType,facing}` shape it always returned. Callers never split the sources.
- `level.ts` composes them:

```ts
export const SIGN_TILES = computed(() => findSignTiles(currentLayout.value, currentLevel.value.markers));
export const HAZARD_TILES = computed(() =>
  findHazardTiles(currentLayout.value, currentLevel.value.markers),
);
```

`SignMapper.placeSigns` and `HazardMapper.placeHazards` are unchanged — they already take
`{col,row,hintId}` / `{col,row,hazardType,facing}` lists, so the runtime tooltip/i18n path
(`PlatformerPage.tsx`'s `currentUI.value.platformer.hints[hintId]`) and the
shake-and-drop path are untouched (FR-032).

**Rationale**: FR-021/FR-032 require the running game to read this content from the layer.
Composing the existing `find*`/`place*` pipelines with marker-derived positions keeps the
downstream mappers, the renderer and the collision code unchanged — the change is confined
to discovery.

**Alternatives considered**:

- *Make `⊤` a `HazardKind`-bearing tile* — rejected: it would give the decorative tile a
  second meaning and break its own art path; the marker is the variant.
- *Keep `T` in `HAZARD_CHARS` and also allow a sign `T`* — rejected: one character cannot
  mean both, and the shared-key guard would throw.

## D8 — The editor keeps a typed marker grid and paints it with marker tools

**Decision**: The editor gains a marker grid per canvas, mirroring the background grid:

- `editorMarkerSignal` / `editorBlueprintMarkerSignal`: debounced localStorage signals of
  `(MarkerEntry | null)[][]`, persisted like terrain/background (FR-012) and validated by a
  forgiving shape guard on load (the one untyped boundary).
- `editorMarkerGridSignal`: a derived signal selecting the active canvas's marker grid.
- `paintMarkerCell(markers, col, row, marker)` and `eraseMarkerCell(markers, col, row)`:
  pure single-cell writes that **never grow the grid** (FR-010). An out-of-bounds click is
  a no-op, unlike `paintCell`/`paintBackgroundCell`.
- `applyMarkerPaint(next)`: writes the active canvas's marker signal, marks it dirty, clears
  the save result and the placement snapshot (no growth shift, since markers never grow).
- The selected-tool type becomes `EditorTool = TileChar | MarkerTool`, where
  `MarkerTool = 'patrolBoundary' | 'connectionPoint' | 'fallingStalactite'`.
  - A **pure marker tool** (`patrolBoundary`, `connectionPoint`) writes only its own
    marker, whatever `activeLayer` is, leaving terrain untouched (FR-009/FR-010/FR-013).
  - The **sign tool** is the `T` `TileChar`: it paints `T` terrain plus a `sign` marker —
    the default hint on a fresh cell, or the next hint when clicked again on an existing
    sign (FR-030). A right-click clears only the sign marker (leaving a bare `T`, which
    resolves to the default hint).
  - The **falling-stalactite tool** paints `⊤` terrain plus a `fallingStalactite` marker;
    the **decorative-stalactite tool** is the `⊤` `TileChar` and paints `⊤` alone
    (FR-031).
- No terrain/entity/hazard/background tool ever writes a marker, and no marker tool writes
  a different marker (FR-013, as resolved in the plan's Constitution Check).

**Rationale**: A dense editor grid is the natural shape for cell-addressed painting, and it
is exactly what `background` already does — the same `growGrid`/`shiftBackgroundGrid`
patterns are reused, except that markers deliberately do not grow. Making markers a *tool*
(not a canvas mode) is FR-009's explicit requirement, and the existing palette already
presents the markers in its Tools group, so this is mostly a change of what a click writes.

**Ordering invariant**: when a sign/falling tool grows the terrain grid, the marker write
must use the post-growth coordinates. `applyPaint(result)` shifts the marker grid by the
growth synchronously, and the marker write is applied after it (reading the now-shifted
grid at `col + colShift`), so the marker lands on the same cell the terrain did.

**Alternatives considered**:

- *A separate "tile meta layer" mode or a third canvas* — explicitly rejected by FR-009.
- *Make the Eraser tool clear every marker it passes over* — rejected: a patrol boundary or
  connection point is independent of its terrain (FR-002) and must survive erasing the tile
  under it. The eraser clears only a marker that describes the tile being erased (a sign, a
  falling stalactite), and a pure marker tool's own erase gesture clears its own marker.
- *A sparse editor map* — rejected: it would need its own paint/shift/grow bookkeeping and
  would not share the background grid's conventions.

## D9 — Growth shifts the marker grid the same way it shifts the background grid

**Decision**: Whenever a terrain paint or a blueprint placement grows the grid left/up, the
marker grid is prepended with empty rows/columns by the same `colShift`/`rowShift`, using
the existing `shiftBackgroundGrid` shape. Right/down growth needs no shift (new cells
already read as `null`). Marker paint itself never grows, so it never shifts.

**Rationale**: FR-004 requires markers to stay aligned to the terrain grid. The marker grid
is aligned to the *current* terrain grid, so a left/up growth that renumbers terrain columns
must renumber markers identically or a marker would silently drift onto a different cell.
This is the exact invariant `shiftBackgroundGrid` already maintains for the background
layer.

**Alternatives considered**:

- *Leave the marker grid unshifted* — rejected: markers would render one column/row off
  after any leftward/upward growth, violating alignment.
- *Store markers as absolute world coordinates in the editor too* — rejected: the editor
  grid is index-addressed everywhere else; a second coordinate space invites drift.

## D10 — Blueprints carry their markers, and placement stamps them

**Decision**:

- `Blueprint` gains `markers?: readonly MarkerPlacement[]`; a legacy blueprint whose
  `layout` still holds `P`/`+`/digits/`T` migrates at load, exactly like a level (FR-015).
- `blueprintCells(layout)` keeps returning **terrain** cells only (a migrated layout no
  longer contains marker characters, so this is automatic).
- A new `blueprintMarkers(blueprint)` returns the blueprint's marker placements relative to
  its own top-left corner.
- `commitPlacement`/`placeBlueprint` stamp the blueprint's markers into the level's marker
  grid at the placement's anchor, overwriting any marker already there (FR-018/FR-020).
  `blueprintFit` is untouched and stays terrain-only: a marker never blocks a placement and
  is never checked (FR-019).
- `PlacementSnapshot` gains the level marker grid so Undo restores markers with the terrain.
- The placement preview includes the blueprint's marker cells, so an author sees the
  connection points before committing.

**Rationale**: FR-018/FR-020 make markers part of what a room *is*; stamping them alongside
terrain is the only way a placed room's border reads correctly. Keeping the overlap check
terrain-only is FR-019's explicit rule and is also what `blueprintFit` already does once
markers are not terrain cells.

**Alternatives considered**:

- *Include markers in the overlap check* — rejected by FR-019.
- *Store the blueprint's markers as terrain characters in its cropped layout* — rejected:
  that is the pre-feature shape and is exactly what cannot coexist with terrain.

## D11 — The crop is marker-aware

**Decision**: `cropLevelForExport(grid, background, markers)` computes one bounding box over
**both** non-`.` terrain cells and non-null marker cells (FR-017), then crops the layout and
the background to that box and serializes the markers relative to its origin. `exportLayout`
is refactored to accept that precomputed box (a small pure helper, `cropLayoutToBox`, plus a
`unionBoxes`) so the three layers cannot drift apart. An isolated marker in an empty cell
therefore expands the box to include its cell and survives the save (FR-017).

**Rationale**: The background layer already crops to the foreground's box; markers now
participate in defining that box, because a marker is content. A single combined box is what
guarantees `layout`, `background` and `markers` stay cell-aligned.

**Alternatives considered**:

- *Crop markers to the terrain-only box and clamp/drop those outside* — rejected by FR-017:
  a marker on an empty cell beyond the terrain box would be silently lost on save.
- *Compute the box three times independently* — rejected: three sources of truth that can
  disagree; the background crop already warns against exactly this.

## D12 — The editor presents each marker's content

**Decision** (FR-008/FR-028/FR-029):

- `drawTileMarkers` is re-pointed from scanning `grid` for `P`/`+` to scanning the marker
  grid for `{kind:'patrolBoundary'}`/`{kind:'connectionPoint'}`, drawing the existing
  glyphs and tints over the terrain and independently of the active layer.
- `drawSignBadges` scans the marker grid for `sign` entries and draws `hintCode(hintId)`
  (`1`–`6`) in the tile's top-left corner — the badge sources its code from the marker, not
  from a layout digit.
- `drawTileTint` scans the marker grid for `{kind:'fallingStalactite'}` and washes the `⊤`
  cell's art with the existing red tint (`PALETTE_TILE_SPRITES['T'].tint`, moved to the
  falling-stalactite tool's presentation). The decorative `⊤` stays untinted.
- A hover tooltip on a marked cell names the marker and its value; for a sign it shows the
  hint's own text via `currentUI.value.platformer.hints[hintId]` — the same translation the
  in-game hint bubble reads (FR-029).
- The placement preview includes the blueprint's marker cells via `blueprintMarkers`.

**Rationale**: FR-008 already required a distinct glyph per marker; FR-028 extends it to
each marker's *content* (a sign's hint code, a falling stalactite's tint) and FR-029 makes
the full value readable on hover. Reusing the existing draw helpers keeps the editor's look
consistent and needs no new asset.

**Alternatives considered**:

- *Show the hint text directly on the tile* — rejected: the canvas is a pixel grid; a short
  code plus a hover tooltip is the legible combination the spec asks for.
- *A shadcn tooltip component* — rejected: the tooltip is positioned in canvas/pan space,
  not over a DOM element; a plain overlay matches the existing placement preview.

## D13 — Documentation and completion tracking

**Decision**: Update `docs/themes/platformer/LevelFormat.md` (the four-map model becomes
terrain/entity/hazard plus a typed tile meta layer; the `markers` field; the `T` sign
character; `T` removed from hazards; the migration and the `T` overloading rule; the "two
tile layers" section becomes three; and an **"Adding a new marker kind"** recipe — FR-035)
and `docs/themes/platformer/Terrain.md` (remove
`patrol`/`blueprintConnectionPoint` from the `TileType` table and the decorative-tiles
paragraph; document `markerAt`; note `⊤` + marker). The recipe mirrors the walkthrough
`Terrain.md` already gives for adding a tile: it lists every touch-point a new kind needs —
the `MarkerEntry` union member, the storage shape, any load-time migration for a replaced
character, the runtime consumer, the editor tool and its presentation, and the tests — so
the layer's extension path is documented rather than inferred. On completion (implementation
**and** tests), update `docs/Features.md`'s dependency diagram for S-030 per the repository
convention.

**Rationale**: Both docs currently state that the two markers are terrain tiles and that
`P`/`+` occupy the cell — claims this feature makes false. The constitution makes the docs
part of the deliverable.

**Alternatives considered**: leaving the docs for later — rejected: they are the
authoritative description of the level format, and the spec changes that format.

## D14 — Export displays the complete level JSON

**Decision** (FR-033/FR-034): `EditorToolbar.tsx`'s Export dialog renders
`levelFileJson(loadedName, cropped.layout, cropped.background, cropped.markers)` in its
read-only textarea, and the copy control copies exactly that text. The previous
`formatRows`/`// LEVEL_1_BACKGROUND` rendering is removed.

**Rationale**: the old export showed the layout rows plus a background comment, a shape that
has no place to put a marker — so including markers in the export forces a representation
change. Reusing the save serializer means the exported text and the written file are
byte-identical by construction (FR-034) and there is one JSON shape to keep correct, not
two. Amends F-019's export display (its FR-019).

**Alternatives considered**:

- *Keep the row format and append a `// MARKERS` block* — rejected: it is not the file's
  shape, so copying it still needs manual assembly, and the spec asks for the complete JSON.
- *A second serializer for export* — rejected: two serializers would drift, exactly what
  FR-034 forbids.

## Dependencies (existing code this builds on)

- **F-019 Platformer Level Editor** — supplies the editor grid signals, `paintCell`/
  `paintBackgroundCell`, the palette tables, `EditorCanvas`'s marker drawing, and
  `cropLevelForExport`; this feature splits markers out of all of them.
- **O-006 Platformer Blueprints** — supplies the `Blueprint` shape, `blueprintCells`/
  `blueprintFit`/`placeBlueprint`, and the placement preview; this feature adds markers to
  the shape and the stamp.
- **O-014 Platformer Background Tiles** — supplies the sparse-vs-dense storage precedent
  (`string[]` background layout, `parseBackgroundLayout`, `shiftBackgroundGrid`) this
  feature mirrors for markers.
- **F-017 Platformer Enemies / O-024 Enemy Movement Seam** — supplies
  `movement/patrol.ts`'s `stepHorizontal`, whose `patrol`-tile check becomes a `markerAt`
  check with no change to the turn geometry.
- **O-027 Platformer Falling Stalactite** — supplies the `fallingStalactite` runtime
  behavior (`entities/hazards/FallingStalactite.ts`) and its editor tint; this feature keeps
  the behavior and changes only how its placement is discovered.
- **O-003 Platformer Tile Layers** — the tile/layer vocabulary this feature extends.
