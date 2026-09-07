# Platformer Terrain

The tile API: what a `TileType` is, how a tile's behavior and its appearance are decided
separately, how autotiling and multi-cell runs work, and what it takes to add a new tile.

The level file's character table — which ASCII character places which tile — lives in
[LevelFormat.md](LevelFormat.md) and is not repeated here. This document starts one step
later, at the `TileType` those characters resolve to.

A tile is not an entity. Entities (the player, enemies, blocks, chests, pickups, signs)
are instances with state, described in [Entities.md](Entities.md). A tile is a value in a
2D array: `LevelDef.terrain[row][col]`, defined in
`src/themes/platformer/level/LevelData.ts`. It has no identity, no per-instance state,
and nothing about it can change at runtime. Everything a tile does — how it collides, how
it draws, which variant of its art appears — is derived on demand from its type and its
neighbours.

## The `TileType` union

Declared in `src/themes/platformer/level/LevelData.ts`.

| Member | Meaning |
|---|---|
| `groundGrass` | Solid earth. Grows a grass top on every cell whose upper edge is exposed. The only tile that autotiles against its neighbours. |
| `groundRock` | Solid stone. Two sprites only — an exposed-top variant and a buried one. |
| `wall` | Solid block, one fixed sprite, no neighbour awareness. |
| `bridge` | A thin walkway: solid from above and from the side, passable from below, and droppable-through on Down. See the one-way contract below. |
| `ladder` | Non-solid but climbable. A shaft's topmost rung is standable from above. |
| `chain` | Climbs exactly like `ladder`; a purely visual alternative skin. Its art is composited per run rather than per cell — see [Multi-cell runs](#multi-cell-runs-chain-as-the-worked-example). |
| `patrol` | An invisible, non-solid enemy patrol boundary. Nothing renders it in game and the player passes straight through, but `EnemyAI.ts` reverses a patrolling enemy that walks into one as if it were a wall. |
| `blueprintConnectionPoint` | An editor-only marker on a blueprint's border cell, noting where another blueprint may attach. Invisible in game, never solid, and nothing in the running game reads it. Placement validates overlap only and does not match connection points. |
| `bush` | Decorative, non-solid. Stacking bush cells vertically grows a tree: the run's role (root / trunk / canopy / lone bush) picks the sprite. |
| `fence` | Decorative, non-solid, one fixed sprite. |
| `cobweb` | Decorative, non-solid. Corner-vs-flat art and rotation are auto-detected from neighbouring solid terrain. |
| `crystalCluster` | Decorative, non-solid, one fixed sprite. |
| `stalactite` | Decorative, non-solid. Two size variants (large / twin) picked by position hash. |
| `stalagmite` | Decorative, non-solid. Two size variants picked the same way. |
| `empty` | Air. Out-of-bounds reads also resolve to `empty` — see `tileAt` below. |

`tileAt(level, col, row)` in `src/themes/platformer/level/Terrain.ts` is the only sanctioned
way to read a cell. It returns `'empty'` for any coordinate outside the grid, which is what
lets every neighbour-inspecting helper below probe freely past the level's edges without
bounds-checking first.

Geometry constants live in the same file: `TILE_SIZE` (16, the native art size),
`RENDER_SCALE` (2), and `RENDERED_TILE_SIZE` (32, the on-screen size every collision and
draw coordinate is expressed in). `tileToPixel(col, row)` converts a grid cell to its
top-left rendered pixel.

## The three behavioral axes

A tile is classified along three independent axes. A tile may sit on more than one — a
`ladder` is climbable and non-solid; a `bush` is neither. The axes are expressed as
predicates in `src/themes/platformer/level/Terrain.ts`, and `src/themes/platformer/engine/Physics.ts`
consults those predicates rather than comparing tile types directly. That indirection is
what let `chain` ship as a pure art variant with no physics code of its own.

### Solid

`isSolid(tile)` is true for `groundGrass`, `groundRock`, `wall` and `bridge`. It is the
plain "this blocks movement" test, used for horizontal wall collision and for landing.

`isSolidExcludingBridge(tile)` is identical except that `bridge` is not solid. It is the
one-way half of the bridge contract.

Decorative tiles are deliberately absent from both. A `bush`, `fence`, `cobweb`,
`crystalCluster`, `stalactite` or `stalagmite` is walked through freely.

### Climbable

`isClimbable(tile)` is true for `ladder` and `chain`, and nothing else. A climbable tile is
deliberately **not** solid: it never blocks horizontal movement and never counts as ground.
`Physics.ts`'s climbing branch is the only place vertical movement through one is resolved,
and it checks the feet row only — so a climb ends close to the shaft's top edge rather than
overshooting until the head clears it.

`isStandableLadderTop(level, col, row)` is the one exception. It is true when the cell is
climbable and the cell directly above it is neither climbable (the shaft continues) nor
solid (there would be no room to stand). Such a cell is solid **from above only**:
`Physics.ts`'s ground scan treats it as ground, so the character can climb out onto it,
land on it from a fall, step off it sideways, or press Down to climb back in. `isSolid` is
untouched — the rung still blocks nothing horizontally and no climb passing through it is
interrupted. A dead-end shaft (solid ceiling directly above the top rung) keeps the plain
climb-until-the-feet-leave-the-ladder behavior.

Note that this predicate takes the level and a coordinate, not a bare tile: it is a
property of a cell in context, not of a tile type.

### The one-way bridge contract

A `bridge` is solid in exactly two of the four approach directions, and the split is
carried entirely by which of the two solidity predicates `Physics.ts` picks at each site:

- **Landing from above** and **walking into it from the side** use `isSolid` — a bridge
  behaves like any other terrain.
- **Rising into it from below** always uses `isSolidExcludingBridge` — the character's head
  passes straight through.
- **Dropping through it** — while grounded on a bridge with Down held, `Physics.ts` sets
  `isDroppingThroughBridge` on the player, and the ground scan switches to
  `isSolidExcludingBridge` until the character lands on something else, which clears the
  flag.

The horizontal scan has one extra subtlety: it compares the hitbox's edge column *before*
this frame's move against the column *after* it. If they are the same, the hitbox was
already inside that column (mid pass-through, or mid drop-through), so a bridge there is
not a new sideways collision and must not block; only a genuinely new column treats a
bridge as a wall.

### Decorative

Decorative tiles appear in no predicate at all. They exist only in the renderer, and
`isSolid`/`isClimbable` returning false for them is what makes them non-solid — there is no
explicit "decorative" flag. `patrol` and `blueprintConnectionPoint` are non-solid in the
same way, but are also invisible: `Renderer.ts`'s `tileSource` returns `null` for both, and
only the level editor draws anything for them (`src/themes/platformer/editor/EditorCanvas.tsx`'s
`drawTileMarkers`).

## Autotiling `groundGrass`

Ground is drawn in two independent passes over the same cell. This is the central
structural fact about terrain rendering: **grass is an overlay, not part of the ground
tile.** No cell in the ground atlas carries grass of its own.

### Pass one — the four-neighbour mask

`neighbourMask(level, col, row)` in `Terrain.ts` builds a 4-bit number from the cell's
orthogonal neighbours:

| Bit | Constant | Value |
|---|---|---|
| Up | `NEIGHBOUR_UP` | 1 |
| Right | `NEIGHBOUR_RIGHT` | 2 |
| Down | `NEIGHBOUR_DOWN` | 4 |
| Left | `NEIGHBOUR_LEFT` | 8 |

A **set** bit means that neighbour is terrain this tile merges with, so the edge continues
and is drawn without a border ("open"). A **clear** bit means that edge faces open space and
is drawn with its dark border ("closed").

Continuity is tested with `isSolidExcludingBridge`, not `isSolid`: a bridge counts as open
space, because it is a thin walkway you can see past, so ground beside or beneath one must
read exactly as if it faced air.

`groundAtlasCell(mask)` in `src/themes/platformer/engine/GroundAtlas.ts` maps each of the 16
masks to a `GroundAtlasEntry` — `sx`, `sy`, a `rotation` in quarter-turns clockwise, and a
`kind` of `'bright'` or `'dark'`. The table is pure data, so re-pointing a shape (or swapping
the whole sheet for another material) is an edit to values only. `groundTileKind(mask)`
states the banding rule independently of the table — a tile whose top edge faces open space
is the exposed surface and is bright, anything with terrain above it is buried and dark —
and a test asserts every table entry agrees with it, so editing the rule surfaces exactly
which entries need re-pointing.

`Renderer.ts`'s `drawGroundTile` applies the entry's rotation about the cell's own centre.
Quarter turns move a border onto an adjacent edge and are only used on cells whose artwork
is flat enough to survive it; a half turn is used to flip a vertical brightness ramp
end-for-end.

The atlas sheet (`tile_atlas.png`) has a 3px transparent gutter between tiles, so a cell's
origin steps by `ATLAS_STRIDE` (19) while the source rect drawn from it stays `TILE_SIZE`
square.

### Pass two — the grass overlay

Immediately after the ground cell is drawn, `drawTerrain` checks the mask's UP bit. If it is
clear, the cell is an exposed surface and a grass sprite is drawn over the ground cell's top
`GRASS_SOURCE_HEIGHT` (9) native pixels; the rest of the grass sprite's cell is transparent,
so the ground beneath shows through.

Which grass sprite is chosen comes from `grassCell(position)` in `GroundAtlas.ts`, keyed by
a horizontal run position (`left`, `middle`, `right`, `single`) computed by
`horizontalRunPosition` with `Renderer.ts`'s local `isGrassSurface` as the continuity test.
Grass continues into a horizontal neighbour only when that neighbour is itself a
grass-topped surface cell: a `groundRock` neighbour, or a `groundGrass` one that is buried
because the terrain steps up, caps the run instead. `isGrassSurface` reads exposure from the
mask's UP bit rather than from `isTopExposed`, so a bridge overhead counts as open space here
exactly as it does when the ground cell is chosen.

The two passes are keyed on different things — the ground cell on a 4-bit mask of solidity,
the grass on a horizontal run of a stricter material test — and neither table knows about the
other. That is why the ground sheet needs one cell per mask rather than one per
mask-times-grass-state, and why changing which materials grow grass is an edit to
`isGrassSurface` alone.

`isTopExposed(level, col, row)` remains as the plain "nothing solid directly above" test and
still serves `groundRock`'s two-sprite lookup in `Renderer.ts`'s `tileSource`.

## Run helpers

Three helpers in `Terrain.ts` classify a cell's position within a run of like neighbours.
Their results feed sprite selection only; none of them affects physics.

`horizontalRunPosition(level, col, row, matches)` returns a `RunPosition`
(`'single' | 'left' | 'middle' | 'right'`) by inspecting the two horizontal neighbours. The
`matches` callback decides continuity, so the same traversal serves bridges (same tile type
— see `bridgeRunPosition`, which picks the ramp-down / low / ramp-up sprite) and grass (same
type *and* top-exposed).

`verticalRunRole(level, col, row, tile)` returns a `VerticalRunRole`
(`'only' | 'bottom' | 'middle' | 'top'`) from the two vertical neighbours. Unlike the
horizontal helper it never counts a run's full length, so an arbitrarily tall stack costs no
more to classify than a lone tile. `bush` uses it to become a tree: `bushOrTreeEntry(role, col, row)`
in `src/themes/platformer/engine/StaticObjectsCatalog.ts` maps the role to a sprite family.

`cobwebOrientation(level, col, row)` returns `{ corner, rotation }`, auto-detecting whether
the cell sits in a corner formed by two *adjacent* solid sides (up+left, up+right,
down+right, down+left — opposite pairs are not corners) and how many quarter-turns clockwise
to apply. Checked in that order, first match wins, which also resolves the ambiguous case of
three or four solid sides by preferring up+left. With no adjacent solid pair it falls back to
the flat sprite, for which `rotation` is unused.

### Position-hashed variants

`StaticObjectsCatalog.ts`'s `pickVariant(variants, col, row)` chooses among a role's sprite
variants deterministically from the cell's own column and row, so neighbouring cells of the
same role do not all look identical. The hash multiplies each coordinate by a large
unrelated constant (`Math.imul` keeps this in 32-bit integer math) before XOR-ing, because a
plain `(col * a + row * b) % n` would cycle through a short, visibly repeating sequence as
columns advance. It throws on an empty variants array rather than letting `% 0` produce `NaN`
and surface later as a confusing crash deep in the render loop.

Callers: `bushOrTreeEntry` (four bush sizes for the `only` role), `staticObjectEntry` for
`fence` and `crystalCluster` (one variant each), and `stalactiteEntry` / `stalagmiteEntry`
(large / twin). A level author places one tile; the size is never a level-file choice.

## Multi-cell runs — chain as the worked example

Every tile described so far draws one sprite into one cell. `chain` does not. Its art is
composited as a single continuous stack of native-sized pieces spanning the whole shaft, and
that stack is drawn entirely by the run's **top** cell.

### Why the pieces do not fit the grid

The chain art's link pieces are not 16x16. A link's true vertical repeat is 6px, and 16 is
not a multiple of 6, so forcing each cell to hold one 16px slice would visibly cut links
mid-body at every tile boundary. Instead each piece keeps its own native width and height —
`ChainPieceRect` in `StaticObjectsCatalog.ts` carries `sx`, `sy`, `width`, `height`, unlike
the plain `StaticObjectEntry` used by every other static object, which is implicitly 16x16 —
and the shaft's total height comes from the pieces' own sizes rather than from the tile grid.

### Attachment classification

`chainAttachment(level, col, row)` in `Terrain.ts` classifies a run's **top** cell as
`'ceiling' | 'left' | 'right' | 'floating'`, in that priority order:

1. A solid tile directly above wins `'ceiling'`, even when a side is *also* solid (a shaft
   in a corner).
2. Otherwise a solid tile to the left gives `'left'`.
3. Otherwise a solid tile to the right gives `'right'`.
4. Otherwise `'floating'` — a distinct case, not a reuse of `'ceiling'`, with its own plain
   hookless sprite family.

The attachment picks the sprite family for the whole run below it, and has no bearing on
physics: `isClimbable` treats every chain tile identically regardless of attachment.

### Run length and piece composition

`chainRunLength(level, col, row)` counts consecutive `chain` cells downward from the given
cell, returning 1 when the cell below is not `chain`. It is only ever called with the cell at
the top of a run.

`chainRunPieces(attachment, runLength)` in `StaticObjectsCatalog.ts` composes the vertical
sequence to draw:

- A 1-tile shaft is just that attachment's **cap** — a rounded, closed end. The
  wall-hugging families' hook shape only makes sense at the point of attachment, so the same
  cap serves both "the whole shaft" and "the literal bottom of a longer one".
- A longer shaft stacks the attachment's **continues** piece (which connects downward), then
  as many copies of the shared plain `CHAIN_MIDDLE` piece as fit in the native-pixel budget
  `runLength * 16`, then the shared plain `CHAIN_BOTTOM` cap.

`CHAIN_MIDDLE` and `CHAIN_BOTTOM` are attachment-independent: only a shaft's top cell needs
to show which wall, if any, it hangs from.

The fit is deliberately **capped rather than exact**. The loop only appends another middle
piece while the running height plus that piece plus the bottom cap still fits the budget, so
a shaft can end a few pixels short of its nominal grid height. Stopping short is chosen over
overflowing into whatever tile sits below the shaft — the renderer draws tiles top-to-bottom,
so an overflow would in practice be painted over by that tile, but the shortfall is chosen
explicitly rather than relying on that.

### Only the top cell draws

In `Renderer.ts`'s `drawTerrain`, the `chain` branch first checks
`tileAt(level, col, row - 1) !== 'chain'`. Every cell that fails this test is skipped
entirely — it is part of a shaft already drawn from above. The top cell then walks the piece
list, drawing each into a running `drawY`, and clamps against
`capY = destY + runLength * RENDERED_TILE_SIZE` so no piece can spill past the shaft's last
cell; a piece whose remaining room is zero or negative ends the loop.

Sprite-less-by-design tiles use the same skip mechanism at a different site: `tileSource`
returns `null` for `chain` (drawn by the run branch), for `groundGrass` (drawn by the atlas
path), for `patrol` and `blueprintConnectionPoint` (invisible), and for the decorative tiles
when their sheet is not loaded.

### The wall gap and vertical offset

`CHAIN_WALL_GAP` in `Renderer.ts` is `2 * RENDER_SCALE` native pixels, used in two distinct
ways, and only for `'left'` and `'right'` shafts — a ceiling or floating shaft has no wall
edge and is always centred in its cell.

- **Vertically**, the top piece of a wall-attached shaft starts this far *below* the cell's
  own top. Its hook art carries no top-side neck margin the way the ceiling and floating
  pieces do, so without the offset it reads as sitting visibly higher than a ceiling-attached
  shaft's top at the same row.
- **Horizontally**, in `chainPieceDestX(attachment, isTopPiece, destX, renderedWidth)`, every
  piece *below* the top one is offset this far in from the wall beside it. The `left`/`right`
  pieces are 7px wide rather than the 5px of `ceiling`/`floating`; the extra width is a
  connector bar baked into the art that reads as "hooks onto the wall". The top piece draws
  flush against its side, because that gap is already baked into its own artwork — that is
  what makes the hook read as attached. The plain, symmetric pieces below it have no such
  built-in gap, so the constant is added there instead, landing them at the same offset the
  top piece's art already reads as.

## Hitbox insets

Some art does not fill its tile edge to edge, and resolving a horizontal collision at the raw
tile boundary would stop the character a visible gap away from the sprite. The horizontal wall
scan in `src/themes/platformer/engine/Physics.ts` therefore resolves against a per-cell inset
rather than the tile edge.

Every plain terrain tile contributes an inset of **0** — the exact tile boundary. A non-zero
inset comes only from a block occupying the cell, via `hitboxInsetXForBlock(blockKind)`
(`src/themes/platformer/entities/Block.ts`, reading `BlockType.hitboxInsetX`); the coin pot is
the shipped example. See [Blocks.md](Blocks.md) for the block side of that field.

The mechanism matters here because terrain and blocks share one scan. For each row the
hitbox spans, the scan takes the **minimum** inset across every solid row in that column, not
the first one found. A generous inset only applies safely when every solid row in the same
column tolerates it — otherwise the character could resolve to a position still embedded in a
different row's full-tile terrain in that same column. Resolution is then
`rightCol * RENDERED_TILE_SIZE + minInset - PLAYER_SIDE_PADDING - HITBOX_WIDTH` on the
rightward branch, and the mirror of that on the leftward one.

Should a terrain tile ever need an inset of its own — art narrower than its cell that should
still be solid — this scan is the single site to extend: give the tile a source of inset
values alongside the block lookup and feed it into the same minimum.

## Adding a tile

Every step below is a real file. Steps 4–6 are conditional on what the tile does; the rest
are always required. Follow the repository's test-first rule — write the failing test in the
relevant `*.test.ts` before each production edit.

1. **`src/themes/platformer/level/LevelData.ts`** — add the member to the `TileType` union,
   with a doc comment saying what it is and pointing at whichever helper decides its
   appearance. `Renderer.ts`'s `tileSource` has an exhaustiveness check
   (`const _exhaustive: never = type`), so the build fails until step 3 handles the new member.

2. **`src/themes/platformer/level/LevelParser.ts`** — add the character to `TERRAIN_CHARS`,
   and the same character to the `TileChar` union below it. `TileChar` is hand-maintained
   rather than derived (the maps are typed `Record<string, … | undefined>`, so `keyof typeof`
   would widen to plain `string` and carry no safety); a test asserts every map key appears in
   the union. Document the character in [LevelFormat.md](LevelFormat.md).

3. **`src/themes/platformer/engine/Renderer.ts`** — decide how it draws:
   - *One fixed sprite from `world_tileset.png`*: return its `sx`/`sy` from `tileSource`.
   - *Neighbour- or run-dependent art*: add the lookup to `Terrain.ts` or
     `StaticObjectsCatalog.ts` and add a branch to `drawTerrain`, returning `null` from
     `tileSource` with a comment saying which branch owns it.
   - *Invisible*: return `null` with a comment, following `patrol`.
   If the art comes from a new image, register it in
   `src/themes/platformer/entities/sprites/sheets.ts` and load it in both
   `src/themes/platformer/PlatformerPage.tsx` and
   `src/themes/platformer/editor/LevelEditorPage.tsx`, then thread the image through
   `drawTerrain`'s optional parameters the way `staticObjects` and `decorations` already are.

4. **`src/themes/platformer/level/Terrain.ts`** — only if the tile is solid or climbable. Add
   it to `isSolid` (and therefore to `isSolidExcludingBridge`) or to `isClimbable`. Adding it
   to `isClimbable` is enough to make it climb like a ladder, including the standable-top
   behavior, because every consumer goes through these predicates rather than comparing tile
   types.

5. **`src/themes/platformer/engine/Physics.ts`** — only if the tile needs behavior no existing
   predicate expresses. A direction-dependent rule (a second one-way tile, say) needs its own
   predicate in `Terrain.ts` and a call site here; a plain solid or climbable tile needs no
   change at all.

6. **`src/themes/platformer/engine/GroundAtlas.ts`** — only if the tile autotiles. That means a
   16-entry mask table plus, if it grows an overlay, a run-position table and its own
   continuity predicate in `Renderer.ts`.

7. **`src/themes/platformer/editor/paletteTiles.ts`** — add an entry to `PALETTE_TILE_SPRITES`
   (a crop into a sheet, or `null` for an invisible tile), `PALETTE_TILE_LABELS` (a
   human-readable name) and `PALETTE_TILE_DESCRIPTIONS` (what the tile does in the finished
   level). An invisible tile also needs a distinct glyph in `PALETTE_TILE_GLYPHS`, since every
   sprite-less tile renders as the same empty bordered square.

8. **`src/themes/platformer/editor/Palette.tsx`** — a purely decorative tile joins
   `DECORATION_CHARS` so it lands in the Decorations group; anything else falls into Terrain
   automatically. An invisible marker belongs in `toolKeys` alongside the patrol boundary
   rather than in Terrain, and if it is blueprint-only, gate it on `canvasMode` the way the
   connection point is.

9. **`src/themes/platformer/editor/EditorCanvas.tsx`** — only for an invisible tile: add a
   `drawTileMarkers` call with its tint and glyph, so an author is not painting cells they
   cannot see.

10. **Tests** — `Terrain.test.ts` for any new predicate or classifier, `Renderer.test.ts` for
    the draw branch, `LevelParser.test.ts` for the character mapping (the map/`TileChar`
    sync test covers it automatically), `Physics.test.ts` for any collision change, and
    `paletteTiles.test.ts` for the palette entries.
