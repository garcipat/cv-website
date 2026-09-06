# Platformer Level Format

The on-disk and in-code shape of a platformer level: the ASCII layout array, the
characters that may appear in it, the two tile layers, and the JSON files the level
editor writes.

Everything here is defined by code, and the code is the authority:

| Concern | Source |
|---|---|
| Character maps and the `TileChar` union | `src/themes/platformer/level/LevelParser.ts` |
| `TileType`, `LevelDef`, `BackgroundPlacement` | `src/themes/platformer/level/LevelData.ts` |
| The shipped level's layout and its structure notes | `src/themes/platformer/level/level.ts` |
| Saved-level discovery and validation | `src/themes/platformer/level/levelRegistry.ts` |
| Blueprint shape, discovery and validation | `src/themes/platformer/level/BlueprintData.ts`, `blueprintRegistry.ts` |
| Solidity and climbability predicates | `src/themes/platformer/level/Terrain.ts` |

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

`parseLevel` throws on any character that is not a key of one of the four maps below.

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

Decorative tiles never form multi-tile runs and carry no CV-data mapping. The two
invisible kinds — `patrol` and `blueprintConnectionPoint` — still occupy the cell, so
painting one over a wall replaces the wall rather than overlaying it.

See [Terrain.md](Terrain.md) for the tile API, autotiling and multi-cell runs.

## Entity characters

`ENTITY_CHARS` in `src/themes/platformer/level/LevelParser.ts`; each value is an
`EntityKind`. Every entity marker sits on `empty` terrain and is therefore never solid.

| Char | Places (`EntityKind`) | Notes |
|---|---|---|
| `S` | `spawn` | The player's start tile. Required — `findSpawnTile` throws if the layout has none. |
| `M` | `enemyGreen` | Green slime. Zipped in reading order against course-derived enemy defs; reveals a Courses fact when stomped. |
| `m` | `enemyPurple` | Purple slime. Bigger, slower, tougher; carries no CV fact and drops a key on defeat. |
| `o` | `coin` | Walk-over coin. Purely positional — which skill-category fact it reveals is resolved from a shared pool at pickup time, not bound at placement. |
| `=` | `crate` | Destroyable block, hit from below. Reveals an Education, Activities or Languages fact. |
| `Q` | `questionMark` | Destroyable block, hit from below. Carries no fact of its own; pops a bonus fruit into the tile directly above, so it must be placed under open space. |
| `F` | `fragileRock` | Destroyable block, hit from below. No reward — level-design filler and surface plugs. |
| `u` | `coinPot` | Container block destroyed by landing on top; drops a coin. Lowercase, a small urn-shaped glyph, unlike every other entity marker. Adjacent pots merge visually into one bunch. |
| `p` | `potionPot` | Container block destroyed by landing on top; drops a heart pickup that heals half a heart. No fact. Implemented but not placed in the shipped level. |
| `$` | `chest` | Treasure chest, opened with Arrow Up while standing on it and only with a key in hand. Zipped one-per-Experience-entry against CV data. |

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

`hazardType` is carried on every entry rather than hardcoded elsewhere, so a second
hazard kind needs one entry here plus a registry line in
`src/themes/platformer/entities/hazards/index.ts`.

## `TileChar`

`TileChar` (`LevelParser.ts`) is the union of every legal layout character — all four
maps' keys, 34 characters in total. It is written out by hand rather than derived with
`keyof typeof`: the maps are annotated `Record<string, … | undefined>` so lookups can
index by a plain `string`, which would widen a derived union to `string` and remove all
type safety. A test asserts every map key appears in the union.

`TileChar` is also the editor grid's cell type — `editorLevelSignal` holds a
`TileChar[][]`.

## The two tile layers

A level has two independent layers.

**Foreground** is the layout array itself: terrain, entity, sign and hazard characters.
This is the layer physics, collision and gameplay read.

**Background** is a separate list of decorative stone pieces painted behind the terrain,
so platforms read as solid mass rather than as shapes floating over flat sky. It is
purely decorative: nothing in collision or physics ever reads it, only the renderer and
the level editor do. It is freeform placement rather than autotiled — each entry anchors
one multi-tile art piece at a top-left cell.

```ts
interface BackgroundPlacement {
  pieceId: BackgroundPieceId; // which art piece
  col: number;               // anchor cell, top-left
  row: number;
}
```

`BackgroundPieceId` (`LevelData.ts`) currently covers two materials, dirt and charcoal,
in five footprints each: `dirtBlock3x3`, `dirtBlockTop2x1`, `dirtBlockBottom2x2`,
`dirtColumnTop1x1`, `dirtColumnBottom1x2`, and the matching `charcoal*` five. Each
piece's pixel rect and tile footprint live in
`src/themes/platformer/engine/BackgroundCatalog.ts`.

The level editor's Foreground/Background toggle chooses which layer clicks target; it is
independent of the Level/Blueprint toggle that chooses which canvas is active.

## `LevelDef`

What `parseLevel` produces and what the engine consumes:

```ts
interface LevelDef {
  terrain: TileType[][];            // row-major, [row][col]
  width: number;                    // tiles, derived from the layout
  height: number;                   // tiles, the layout's length
  background?: BackgroundPlacement[];
}
```

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
  "background": [{ "pieceId": "dirtBlock3x3", "col": 4, "row": 9 }]
}
```

- The **filename stem is the level's `id`** (`cave-run.json` → `cave-run`); `name` is
  what the dropdown shows and falls back to the id when missing or empty.
- `background` is optional.
- Validation is deliberately forgiving: a file that is not an object, or whose `layout`
  is not a non-empty array of strings, is skipped entirely — that level simply does not
  appear and every other one still loads. A malformed `background` costs only that field.
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
  background?: BackgroundPlacement[];
}
```

The shape is deliberately the same one a saved level has, so the export crop, the
importer, `parseLevel` and blueprint placement all apply unchanged, with the same
per-character mapping. Validation goes through `isBlueprint` and is as forgiving as the
level registry's.

Two differences from levels:

- **No built-in entries.** Nothing ships as a blueprint; the dropdown's blank option is
  `BLANK_BLUEPRINT` — id and name `new`, layout `['.']`.
- **No spawn.** A blueprint is a room, not a level, so it carries no `S`.

The folder ships empty apart from a `.gitkeep`.

## Caveat: stale editor state in `localStorage`

The level editor persists its working state to `localStorage` — the grid
(`platformer-editor-level`, a `TileChar[][]`), the selected tool
(`platformer-editor-selected-tool`, a single `TileChar`), the background placements, the
blueprint canvas and its background, the active layer, the canvas mode, and the loaded
level/blueprint names (`src/themes/platformer/editor/editorLevelState.ts`).

Several layout characters were remapped at one point, and there is **no migration path**.
A browser profile that opened the editor before that remap still holds the old letters in
those keys, and they now mean something else or nothing at all — a stale
`platformer-editor-selected-tool` can select an unexpected tool, and a stale grid can
carry characters that no longer parse. The fix is to clear the `platformer-editor-*`
keys for that origin and reload; the game itself is unaffected, since the played layout
is an in-memory signal that resets to the shipped level on every page load.
