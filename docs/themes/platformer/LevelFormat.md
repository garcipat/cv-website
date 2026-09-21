# Platformer Level Format

The on-disk and in-code shape of a platformer level: the ASCII layout array, the
characters that may appear in it, the two tile layers, and the JSON files the level
editor writes.

Everything here is defined by code, and the code is the authority:

| Concern | Source |
|---|---|
| Character maps, the `TileChar`/`BackgroundChar` unions, `parseBackgroundLayout` | `src/themes/platformer/level/LevelParser.ts` |
| `TileType`, `LevelDef`, `BackgroundGrid`, `BackgroundMaterialId` | `src/themes/platformer/level/LevelData.ts` |
| The shipped level's layout and its structure notes | `src/themes/platformer/level/level.ts` |
| Saved-level discovery and validation | `src/themes/platformer/level/levelRegistry.ts` |
| Blueprint shape, discovery and validation | `src/themes/platformer/level/BlueprintData.ts`, `blueprintRegistry.ts` |
| Solidity and climbability predicates | `src/themes/platformer/level/Terrain.ts` |
| Background neighbour-mask autotiling | `src/themes/platformer/engine/BackgroundAtlas.ts` |

## The layout array

A level layout is a `readonly string[]` — one string per row, one character per tile.
`parseLevel` (`LevelParser.ts`) turns it into a `LevelDef`.

- **Row ordering is top-first.** `layout[0]` is the topmost row on screen; the last
  element is the bottom-most.
- **The array is bottom-anchored.** The renderer and camera
  (`src/themes/platformer/engine/Renderer.ts`, `Camera.ts`) pin the level's last row to
  the bottom of the canvas and scroll vertically once the level is taller than the
  viewport. Adding a row to the end therefore digs deeper; adding one to the front adds
  sky.
- **No leading empty sky rows.** A layout starts at the topmost row that actually
  contains something. Empty rows above the tallest feature only add unused vertical
  space, and the editor's export crops them away, so they are never written down. In
  the shipped level this means the layout's own row indices sit two below the
  conceptual row numbers in `level.ts`'s structure comment.
- **Every row is the same width.** Width is the level's tile width and is read from the
  layout itself, never hardcoded — `parseLevel` takes the longest row as the width and
  right-pads every shorter row with `'empty'`. Writing every row out to full width keeps
  the file honest: a column index means the same thing in every row, so the level's shape
  is readable directly from the source, and a short row cannot silently shift what sits
  above or below it.
- **Height is the array's length.** Both `width` and `height` come from the data, which
  is what lets the parser handle any layout of any size, and be tested without the real
  level.

An unrecognized character (not a key of any of the four maps below) is read as `'empty'`
and logged once per distinct character via `console.warn` — `parseLevel` does not throw,
so a level authored against a newer palette (or a hand-edited layout with a typo) still
loads and plays.

### Terrain, entity, sign and hazard markers

A cell holds exactly one character, and that character means exactly one thing: the four
maps are checked for overlapping keys at module load, and a shared key throws at import
time.

Terrain characters resolve to their `TileType`. Entity, sign and hazard characters
resolve to `'empty'` terrain — the marker says *what starts here*, not *what the ground
is*, and the ground under any marker is always empty. Their positions are read back out
of the raw layout by the `find*` functions in `LevelParser.ts`.

## Terrain characters

`TERRAIN_CHARS` in `src/themes/platformer/level/LevelParser.ts`; each value is a
`TileType` from `LevelData.ts`. "Solid" means `Terrain.ts`'s `isSolid` returns true;
"climbable" means `isClimbable` does.

| Char | Places (`TileType`) | Behavior |
|---|---|---|
| `.` | `empty` | Nothing — open air. |
| `G` | `groundGrass` | Solid. The default material; autotiled, with a grass overlay wherever the tile is top-exposed. |
| `R` | `groundRock` | Solid. Stone accent material — bedrock, cave floors, exposed rock faces. |
| `#` | `wall` | Solid. |
| `B` | `bridge` | Solid one-way: blocks landing from above and walking into it from the side, but never blocks rising into it from below or an active drop-through (`isSolidExcludingBridge`). |
| `H` | `ladder` | Climbable, never solid. Its topmost tile with open space above is standable (`isStandableLadderTop`). |
| `I` | `chain` | Climbable, never solid. Behaves identically to `ladder` everywhere; a purely visual alternative skin whose attachment side is derived from neighbouring solid terrain. |
| `P` | `patrol` | Invisible, non-solid enemy patrol boundary. Nothing renders it and the player passes through, but `EnemyAI.ts` reverses a patrol that walks into one as if it were a wall. |
| `+` | `blueprintConnectionPoint` | Invisible, editor-only marker on a blueprint's border cell. Never solid, never rendered in gameplay, and read by nothing in the running game — including blueprint placement, which validates overlap only. |
| `n` | `bush` | Decorative, non-solid. Picks its own size variant; stacking grows it into a tree. |
| `N` | `fence` | Decorative, non-solid. Single fixed sprite. |
| `X` | `cobweb` | Decorative, non-solid cave dressing. Corner-vs-flat art and its rotation are auto-detected from neighbouring solid terrain (`Terrain.ts`'s `cobwebOrientation`). |
| `c` | `crystalCluster` | Decorative, non-solid cave dressing. Single fixed sprite. |
| `⊤` | `stalactite` | Decorative, non-solid cave dressing. Size variant (large/twin) picked by position hash. |
| `⊥` | `stalagmite` | Decorative, non-solid cave dressing. Size variant (large/twin) picked by position hash. |
| `¥` | `torch` | Decorative, non-solid cave dressing. Its flame animates through a 4-frame sparkle loop; each cell's phase is derived from its grid position plus the shared world clock (`engine/Torch.ts`). |
| `@` | `ladderBundle` | A curled-up rope-ladder bundle (O-011). Non-solid and not climbable, but standable from above (`isStandableLadderBundleTop`); a grounded character presses Up while on or one cell above it to unroll a `ropeLadder` shaft down to the first solid tile below. |
| `§` | `bouncyMushroom` | Non-solid and not climbable: passable from the side and from below. Its top cap is one-way ground (`isStandableMushroomCap`) and launches the character with a fixed super-jump on every downward landing, with a brief cosmetic cap dip. A vertical run reads as one mushroom — cap / connector / stem / foot — via `verticalRunRole`. The character is the section sign; it is not a valid JS identifier, so its `TERRAIN_CHARS` key is quoted (`'§'`). |
| `s` | `decorativeMushroom` | Non-solid and not climbable dressing mushroom. Never standable, never bounces, never awards anything — a single fixed sprite. (`s` is also a `BACKGROUND_CHARS` key, meaning `surfaceStone`; the background is a separate layer, so the overlap is allowed.) |

Decorative tiles never form multi-tile runs and carry no CV-data mapping. The two
invisible kinds — `patrol` and `blueprintConnectionPoint` — still occupy the cell, so
painting one over a wall replaces the wall rather than overlaying it.

The `ropeLadder` `TileType` a bundle deploys has **no** level character — it is never
author-placeable, existing only in the effective grid the running game derives from
bundle state (`engine/DeployableLadder.ts`'s `applyDeployedLadders`).

See [Terrain.md](Terrain.md) for the tile API, autotiling and multi-cell runs.

## Entity characters

`ENTITY_CHARS` in `src/themes/platformer/level/LevelParser.ts`; each value is an
`EntityKind`. Every entity marker sits on `empty` terrain and is therefore never solid.

| Char | Places (`EntityKind`) | Notes |
|---|---|---|
| `S` | `spawn` | The player's start tile. Required — `findSpawnTile` throws if the layout has none. |
| `M` | `enemyGreen` | Green slime. Each marker owns a proportional slice of the course pool by position; reveals a Courses fact when stomped. |
| `m` | `enemyPurple` | Purple slime. Bigger, slower, tougher; carries no CV fact and drops a key on defeat. |
| `o` | `coin` | Walk-over coin. Purely positional — which skill-category fact it reveals is resolved from a shared pool at pickup time, not bound at placement. |
| `=` | `crate` | Destroyable block, hit from below. Reveals an Education, Activities or Languages fact. |
| `Q` | `questionMark` | Destroyable block, hit from below. Carries no fact of its own; pops a bonus fruit into the tile directly above, so it must be placed under open space. |
| `F` | `fragileRock` | Destroyable block, hit from below. No reward — level-design filler and surface plugs. |
| `u` | `coinPot` | Container block destroyed by landing on top; drops a coin. Lowercase, a small urn-shaped glyph, unlike every other entity marker. Adjacent pots of **any** kinds (`u`/`p`) merge visually into one bunch. |
| `p` | `potionPot` | Container block destroyed by landing on top; drops a heart pickup that heals half a heart. No fact. Adjacent pots of **any** kinds (`u`/`p`) merge visually into one bunch. Implemented but not placed in the shipped level. |
| `$` | `chest` | Treasure chest, opened with Arrow Up while standing on it and only with a key in hand. Zipped one-per-Experience-entry against CV data. |
| `C` | `checkpoint` | Checkpoint flag. Non-solid; stepping onto it with solid ground directly below raises it once and makes that cell the active respawn point for the rest of the run. Carries no CV fact. Not placed in the shipped level — authorable in the editor only. |

See [Enemies.md](Enemies.md) and [Blocks.md](Blocks.md) for the entity APIs.

## Sign characters

`SIGN_CHARS` in `src/themes/platformer/level/LevelParser.ts`; each value is a `HintId`
from `src/themes/platformer/types.ts`. Signs are non-solid props standing on `empty`
terrain.

Unlike entity markers, a sign's content is hand-authored rather than derived from CV
data, so the character itself carries the hint's identity. That is what lets rows and
columns be added, removed or reordered without ever scrambling which sign shows which
text. The map is capped at digits `1`–`9` as an accepted constraint.

| Char | Shows (`HintId`) | Notes |
|---|---|---|
| `1` | `bridgeDropThrough` | Hold Down to drop through a bridge. |
| `2` | `ladderClimbUp` | Ladders are climbed with Up/Down. |
| `3` | `fragileRockBreaksFromBelow` | Fragile rocks break when hit from underneath. |
| `4` | `chestNeedsKey` | A chest cannot be opened without a key. |
| `5` | `openAllChestsHaveFun` | Opening every chest ends the run. |

## Hazard characters

`HAZARD_CHARS` in `src/themes/platformer/level/LevelParser.ts`; each value is a
`{ hazardType: HazardKind; facing: HazardFacing }` pair. Hazards are non-solid and sit
on `empty` terrain; touching any part of the tile damages the player regardless of which
face was touched, so the facing selects the sprite only.

| Char | Places | Facing | Notes |
|---|---|---|---|
| `^` | `spike` | `up` | Floor spikes. |
| `v` | `spike` | `down` | Ceiling spikes. |
| `<` | `spike` | `left` | Mounted on a wall to the right of the tile. |
| `>` | `spike` | `right` | Mounted on a wall to the left of the tile. |
| `A` | `floorSpike` | `up` | Delayed-trigger hazard (O-021); floor-only, no facing cycle. |

`hazardType` is carried on every entry rather than hardcoded elsewhere, so a second
hazard kind needs one entry here plus a registry line in
`src/themes/platformer/entities/hazards/index.ts`.

`floorSpike` (`'A'`) is a second `HazardKind` sibling to `spike`, added by O-021. Unlike
`spike`, it carries live per-instance cycle state (`HazardPlacement.floorSpikePhase`,
merged in per-tick from `PlatformerState.ts`'s `floorSpikeTimerStates` via
`hazardPlacementsForTick()`) rather than being purely static — its `box()`/`draw()`
(`entities/hazards/FloorSpike.ts`) read that phase to decide hazardous area and sprite
frame. See [specs/O-021-platformer-floor-spikes/spec.md](../../../specs/O-021-platformer-floor-spikes/spec.md)
for the trigger/cycle behavior itself.

## `TileChar`

`TileChar` (`LevelParser.ts`) is the union of every legal layout character — all four
maps' keys, 41 characters in total. It is written out by hand rather than derived with
`keyof typeof`: the maps are annotated `Record<string, … | undefined>` so lookups can
index by a plain `string`, which would widen a derived union to `string` and remove all
type safety. A test asserts every map key appears in the union.

`TileChar` is also the editor grid's cell type — `editorLevelSignal` holds a
`TileChar[][]`.

## The two tile layers

A level has two independent layers.

**Foreground** is the layout array itself: terrain, entity, sign and hazard characters.
This is the layer physics, collision and gameplay read.

**Background** is a dense per-cell grid aligned 1:1 with the terrain grid (O-014), so a
filled region reads as one continuous autotiled mass behind the terrain rather than as
scattered stamped pieces or shapes floating over flat sky. It is purely decorative:
nothing in collision or physics ever reads it, only the renderer and the level editor
do. Unlike the pre-O-014 freeform placement list, every cell is independently
addressable — no footprint, no anchor, exactly like `terrain` itself.

```ts
type BackgroundGrid = (BackgroundMaterialId | null)[][]; // row-major, [row][col]
```

`null` means empty (the parallax/void backdrop shows through); a material id means that
cell is filled with that material. This is the shape `BackgroundAtlas`/`drawBackgroundTiles`/
`isCellDarkening` consume — it is no longer what gets *stored*, see "Background storage"
below.

### Background characters

`BACKGROUND_CHARS` in `src/themes/platformer/level/LevelParser.ts` — the background
layer's own analogue of `TERRAIN_CHARS`, one character per `BackgroundMaterialId`:

| Char | Material (`BackgroundMaterialId`) | Family |
|---|---|---|
| `.` | *(empty — not a `BACKGROUND_CHARS` key; see below)* | — |
| `d` | `dirt` | `surface` |
| `r` | `rust` | `surface` |
| `s` | `surfaceStone` | `surface` |
| `c` | `charcoal` | `cave` |
| `m` | `maroon` | `cave` |
| `v` | `caveStone` | `cave` |

`'.'` is deliberately not a key of `BACKGROUND_CHARS` itself — there is no
`BackgroundMaterialId` for "empty", `null` fills that role in `BackgroundGrid` — so it
(and any other character `BACKGROUND_CHARS` doesn't recognize) simply falls through to
`parseBackgroundLayout`'s unrecognized-character branch, which resolves to `null`
silently, with no warning: an unrecognized background character is purely decorative,
never a level-breaking authoring mistake worth surfacing the way an unrecognized
foreground character is (`parseLevel`'s `console.warn`).

`BackgroundChar` (`LevelParser.ts`) is the union of `'.'` plus every `BACKGROUND_CHARS`
key — the background layer's analogue of `TileChar`, and also the editor's background
grid's own cell type: `editorBackgroundSignal`/`editorBlueprintBackgroundSignal` hold a
`BackgroundChar[][]`, the exact parallel `editorLevelSignal`'s `TileChar[][]` already is
for the foreground.

### Background storage: a `string[]` layout, not a stored grid

Since O-014's storage-unification revision, `background` is stored (in saved level and
blueprint JSON, and in `LEVEL_1_BACKGROUND`) as a `readonly string[]` layout — the exact
same one-character-per-cell shape `layout` itself has, via `BACKGROUND_CHARS` above —
rather than as a `BackgroundGrid` directly.

```ts
function parseBackgroundLayout(
  layout: readonly string[],
  terrainWidth: number,
  terrainHeight: number,
): BackgroundGrid;
```

`parseBackgroundLayout` (`LevelParser.ts`) turns a stored background layout into the
`BackgroundGrid` the engine/renderer consume, mirroring `parseLevel`'s terrain-building
loop — the same relationship `TileMap` has to `layout`. It always clamps/pads its result
to exactly `terrainWidth` x `terrainHeight` rather than trusting the stored layout's own
size: a background layout shorter or narrower than the terrain reads as empty beyond its
own bounds (the same out-of-bounds-is-`null` contract `backgroundAt` already has), and
one taller or wider than the terrain never lets background draw past where no terrain
exists — both are resolved once at parse time rather than left for the renderer to
bounds-check per cell.

Before this revision, `background` was stored as a JSON array-of-arrays of material-name
strings (`[[null, "charcoal", null], ...]`) — the `BackgroundGrid` shape directly. That
shape is gone; every saved-file example and validator below reflects the current
`string[]` shape.

`BackgroundMaterialId` (`LevelData.ts`) is an open set of named materials, each with an
intrinsic `BackgroundMaterialFamily` (`'surface' | 'cave'`) that decides whether it
darkens the view (O-010's cave lighting). Six materials ship today:

| Material | Family |
|---|---|
| `dirt` | `surface` |
| `rust` | `surface` |
| `surfaceStone` | `surface` |
| `charcoal` | `cave` |
| `maroon` | `cave` |
| `caveStone` | `cave` |

Rendering computes a 4-bit same-material neighbour mask per cell (`Terrain.ts`'s
`backgroundNeighbourMask`, mirroring `neighbourMask` for terrain) and looks it up in
`engine/BackgroundAtlas.ts`'s per-material mask table — a different material, an empty
cell, or an out-of-bounds cell all count as a non-connecting (closed) neighbour, so
adjacent materials never visually merge. A fully-interior cell (mask value covering all
four sides) may additionally show a deterministic rock decoration from
`engine/BackgroundDecorCatalog.ts`.

The level editor's Foreground/Background toggle chooses which layer clicks target; it is
independent of the Level/Blueprint toggle that chooses which canvas is active. Painting
and erasing a background cell (`editor/paintBackgroundCell.ts`) works exactly like
painting foreground terrain — a single-cell write, growing the grid the same way, no
footprint/overlap reasoning.

## `LevelDef`

What `parseLevel` produces and what the engine consumes:

```ts
interface LevelDef {
  terrain: TileType[][];            // row-major, [row][col]
  width: number;                    // tiles, derived from the layout
  height: number;                   // tiles, the layout's length
  background?: BackgroundGrid;
}
```

`background` MAY be smaller than `terrain`'s own bounds — any cell outside the grid's
own bounds (or a missing `background` field entirely) reads as `null` via
`Terrain.ts`'s `backgroundAt`, the same out-of-bounds-is-empty convention `tileAt`
already uses.

## Saved level files

Saved levels are JSON files in `src/themes/platformer/level/levels/`, picked up at build
time by `levelRegistry.ts` via `import.meta.glob` and offered in the level editor's level
dropdown. The editor's **Save** button writes straight into that folder while the dev
server is running (`vite/levelWritePlugin.ts`); with no dev server behind the page, Save
falls back to downloading the file, which is then moved in by hand. Saved levels are
committed like any other source file.

```json
{
  "name": "Cave Run",
  "layout": [".S.", "GGG"],
  "background": ["...", ".c."]
}
```

- The **filename stem is the level's `id`** (`cave-run.json` → `cave-run`); `name` is
  what the dropdown shows and falls back to the id when missing or empty.
- `background` is optional, and when present is only written when it holds at least one
  non-`'.'` character — a level with an all-empty background layout keeps the same shape
  it had before the background layer existed.
- Validation is deliberately forgiving: a file that is not an object, or whose `layout`
  is not a non-empty array of strings, is skipped entirely — that level simply does not
  appear and every other one still loads. `background` is validated with the same "array
  of strings" shape check `layout` gets (it may legally be empty, unlike `layout`) — a
  malformed `background` costs only that field. This includes both pre-storage-
  unification-revision shapes: the pre-O-014 flat placement-list format (an array of
  `{pieceId, col, row}` objects) and the O-014 array-of-arrays `BackgroundGrid` format
  (`[[null, "charcoal", null], ...]`) both fail the `string[]` shape check — their rows
  are objects/arrays, not strings — and the level simply loads with no background field
  at all. A `background` string containing a character `BACKGROUND_CHARS` doesn't
  recognize passes this shape check (the character itself is a `parseBackgroundLayout`
  concern, resolved to empty at load time, not a load-time rejection reason).
- The two built-in entries, `main` (the shipped level) and `empty` (the three-tile
  scratch grid), live in code as `BUILT_IN_LEVELS` rather than as files, come first in
  the dropdown, and cannot be removed.

The folder also carries its own `README.md` describing the same contract for whoever
opens it directly.

## Saved blueprint files

A blueprint is a named, reusable room authored on the editor's second canvas. Blueprints
are JSON files in `src/themes/platformer/level/blueprints/`, discovered the same way by
`blueprintRegistry.ts`.

```ts
interface Blueprint {
  id: string;                       // slug; also the saved file's stem
  name: string;
  layout: readonly string[];
  background?: readonly string[];
}
```

The shape is deliberately the same one a saved level has, so the export crop, the
importer, `parseLevel`/`parseBackgroundLayout` and blueprint placement all apply
unchanged, with the same per-character mapping. Validation goes through `isBlueprint` and is as forgiving as the
level registry's.

Two differences from levels:

- **No built-in entries.** Nothing ships as a blueprint; the dropdown's blank option is
  `BLANK_BLUEPRINT` — id and name `new`, layout `['.']`.
- **No spawn.** A blueprint is a room, not a level, so it carries no `S`.

The folder ships empty apart from a `.gitkeep`.

## Caveat: stale editor state in `localStorage`

The level editor persists its working state to `localStorage` — the grid
(`platformer-editor-level`, a `TileChar[][]`), the selected tool
(`platformer-editor-selected-tool`, a single `TileChar`), the background grid
(`platformer-editor-background`, a `BackgroundChar[][]`), the blueprint canvas and its
background, the active layer, the canvas mode, and the loaded level/blueprint names
(`src/themes/platformer/editor/editorState.ts` + `editorActions.ts`).

Old saved levels/blueprints using either the pre-O-014 flat `BackgroundPlacement[]`
format or the pre-storage-unification-revision array-of-arrays `BackgroundGrid` format
load with an empty background layout — no attempt is made to convert either older shape
to the current `string[]` layout (FR-013).

Several layout characters were remapped at one point, and there is **no migration path**.
A browser profile that opened the editor before that remap still holds the old letters in
those keys, and they now mean something else or nothing at all — a stale
`platformer-editor-selected-tool` can select an unexpected tool, and a stale grid can
carry characters that no longer parse. The fix is to clear the `platformer-editor-*`
keys for that origin and reload; the game itself is unaffected, since the played layout
is an in-memory signal that resets to the shipped level on every page load.
