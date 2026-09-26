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
| `bush` | Decorative, non-solid. Stacking bush cells vertically grows a tree: the run's role (root / trunk / canopy / lone bush) picks the sprite. |
| `fence` | Decorative, non-solid, one fixed sprite. |
| `cobweb` | Decorative, non-solid. Corner-vs-flat art and rotation are auto-detected from neighbouring solid terrain. |
| `crystalCluster` | Decorative, non-solid, one fixed sprite. |
| `stalactite` | Decorative, non-solid. Two size variants (large / twin) picked by position hash. A `{ kind: 'fallingStalactite' }` marker on this tile (O-027) makes it shake and drop; the tile itself renders untinted in game (see [LevelFormat.md](./LevelFormat.md#the-tile-meta-layer)). |
| `stalagmite` | Decorative, non-solid. Two size variants picked the same way. |
| `torch` | Decorative, non-solid cave dressing. Its flame animates through a 4-frame sparkle loop — each cell's frame is a pure function of its grid position and the shared world clock (`tiles/torch.ts`'s `torchFrameIndex`), so neighbouring torches flicker out of phase and the tile carries no per-instance state. |
| `ladderBundle` | A curled-up rope-ladder bundle (`@`), the author-placeable O-011 tile. Non-solid, not climbable, but standable from above (the `ladderBundle` module's `standableAt`, reached through `isStandableTileAt`). A grounded character presses Up while on or one cell above it to deploy it. |
| `ropeLadder` | A deployed rope-ladder rung cell. **Never author-placeable** — it exists only in the effective grid `applyDeployedLadders` derives from bundle state (see [Runtime overrides](#runtime-overrides)). Climbable exactly like `ladder`/`chain`. |
| `bouncyMushroom` | The red bouncy mushroom (`§`). Non-solid and non-climbable: passable from the side and from below. Its top cap is one-way ground (the `bouncyMushroom` module's `standableAt`, reached through `isStandableTileAt`) and launches the character with a fixed super-jump on every downward landing. A vertical run reads as one mushroom — cap / connector / stem / foot — via `verticalRunRole`, like `bush`. |
| `decorativeMushroom` | The small non-solid dressing mushroom (`s`). No behaviour of any kind: never solid, never standable, never bounces. A single fixed sprite. |
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
`ladder` is climbable and non-solid; a `bush` is neither.

Since R-015 each tile kind is one self-contained module under
`src/themes/platformer/tiles/`, and `src/themes/platformer/tiles/registry.ts`
(`TILE_MODULES`) is the single dispatch point. `src/themes/platformer/engine/Physics.ts`
and `level/Terrain.ts` consult the registry's dispatch helpers rather than comparing tile
types directly; the old `level/Terrain.ts` predicates survive only as thin, per-kind-logic-free
wrappers (`isSolid` → `isSolidTile`, `isClimbable` → `isClimbableTile`). That indirection is
what let `chain` ship as a pure art variant with no physics code of its own.

### Solid

`isSolidTile(tile)` (registry dispatch, re-exported from `Terrain.ts` as the thin `isSolid`)
is true for the modules declaring `solid: true` — `groundGrass`, `groundRock`, `wall` and
`bridge`. It is the plain "this blocks movement" test, used for horizontal wall collision
and for landing.

`isSolidExcludingOneWay(tile)` (the relocated `isSolidExcludingBridge`) is identical except
that a kind declaring `oneWay: true` — `bridge` — is not solid. It is the one-way half of
the bridge contract.

Decorative tiles declare no capability flags at all. A `bush`, `fence`, `cobweb`,
`crystalCluster`, `stalactite`, `stalagmite` or `torch` is walked through freely.

### Climbable

The `ladder`, `chain` and `ropeLadder` modules declare `climbable: true`, read through
`isClimbableTile(tile)` (the thin `isClimbable` wrapper). A climbable tile is deliberately
**not** solid: it never blocks horizontal movement and never counts as ground.
`Physics.ts`'s climbing branch is the only place vertical movement through one is resolved,
and it checks the feet row only — so a climb ends close to the shaft's top edge rather than
overshooting until the head clears it.

The one exception is the shaft's standable top, declared by the climbable kinds' own module
`standableAt` hook and reached through the registry's single
`isStandableTileAt(level, col, row, ctx)` dispatcher (R-015 removed
`isStandableLadderTop`). It is true when the cell is climbable and the cell directly above
it is neither climbable (the shaft continues) nor solid (there would be no room to stand).
Such a cell is solid **from above only**: `Physics.ts`'s ground scan treats it as ground, so
the character can climb out onto it, land on it from a fall, step off it sideways, or press
Down to climb back in. It blocks nothing horizontally and no climb passing through it is
interrupted. A dead-end shaft (solid ceiling directly above the top rung) keeps the plain
climb-until-the-feet-leave-the-ladder behavior.

Note that these hooks take the level and a coordinate, not a bare tile: they are properties
of a cell in context, not of a tile type.

The `bouncyMushroom` module declares its own `standableAt` for the analogous one-way
mushroom-cap ground term (R-015 removed `isStandableMushroomCap`). It is true when the cell
is a `bouncyMushroom`, the cell directly above is **not** a `bouncyMushroom` (so this is the
run's top), and that cell above is not solid (there would be no room to land). A covered cap
is not standable, but its art role is unchanged — nothing special happens where no landing
can occur. Neither mushroom kind blocks horizontally or from below.

Standability is evaluated per column, exactly like the ladder top: `Physics.ts`'s ground
scan tests every column the hitbox spans. The **bounce**, however, is defined by the
player's **centre** column (FR-007): `playerOnMushroomCap` in `Physics.ts` returns the cap
only for a grounded player whose centre column is over a standable cap, so a landing on
the exact seam beside a cap rests on its corner without bouncing.

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
explicit "decorative" flag.

The patrol boundary and the blueprint connection point are no longer `TileType` members at
all: they live on the **tile meta layer** (see
[LevelFormat.md](./LevelFormat.md#the-tile-meta-layer)), which is why they are invisible
and non-solid by construction — `tileAt` never returns a marker, and the renderer never
walks the marker grid. Only the level editor draws a glyph for them
(`src/themes/platformer/editor/EditorCanvas.tsx`'s `drawTileMarkers`).

### Markers are not terrain

The tile meta layer's accessor lives beside `tileAt` in the same file:

```ts
markerAt(level, col, row): MarkerEntry | null
```

It returns `null` for an out-of-bounds coordinate, a missing `markers` field, or an empty
cell — the same forgiving contract `backgroundAt` has. Because a marker is never a
`TileType`, none of the predicates below ever see one: a marked wall stays solid, a marked
empty cell stays walkable, and a patrol boundary reverses an enemy without blocking the
player (`movement/patrol.ts` reads it through `markerAt`).

## Runtime overrides

Every tile above is a stateless value: what it does is derived purely from its
type and its neighbours, and nothing about it changes at runtime. There are two
deliberate exceptions — the O-011 deployable rope ladder's effective-grid
override, and the O-018 bouncy mushroom's transient cap squash.

A rolled `ladderBundle` (`@`) is an ordinary terrain tile. A grounded character
standing on it — or one cell above it — presses Up to deploy it. A per-bundle
`DeployableLadderState` (in `PlatformerState.ts`, alongside the other
per-instance session state) tracks the bundle's phase (`rolled` → `deploying` →
`deployed`). `engine/DeployableLadder.ts`'s `applyDeployedLadders(level, states)`
is a pure function that returns an **effective `LevelDef`** in which every
completed bundle's cells are written as the `ropeLadder` tile type — climbable
through the registry's `isClimbableTile`/`isStandableTileAt` helpers, with no new
climbing code of its own.

The split is deliberate: only `stepPlayerPhysics` reads the effective grid
(`PlatformerState.ts`'s `activeLevel`); rendering and every other subsystem keep
reading the raw `currentLevel`, and the deploy pass draws the rope art itself
(`Renderer.ts`'s `drawDeployableItems`). `applyDeployedLadders` returns the
**same** `level` object when nothing is deployed, so the common case allocates
nothing. This mechanism is scoped to bundles only — it is deliberately not a
general per-tile animation or state framework (see the O-011 spec's Assumptions
and Out of Scope).

### The bouncy mushroom's cap squash

The one other piece of transient state is the cosmetic cap dip that plays after a
bounce (O-018). It is **not** a tile override: the `bouncyMushroom` cells in the grid
never change. `tiles/bouncyMushroom.ts` owns a small pure list of
`{ col, row, elapsed }` entries — one per recently-bounced cap — held in
`PlatformerState.ts`'s `mushroomSquashStates` signal, advanced and pruned each `playing`
tick by `tickMushroomSquashes`, and cleared by `resetGame()`. The renderer reads
`mushroomSquashDipAt` only to shift the cap sub-rect downward; the squash never affects
collision, standability or bounce strength (FR-011/FR-015).

**Gap closed by R-015.** Terrain kinds now own their own rules: each kind is one module
under `src/themes/platformer/tiles/` declaring its capability flags and its
`standableAt`/`solidRegionAt` hooks, and `tiles/registry.ts`'s exhaustive `TILE_MODULES`
map is the single dispatch point every one-way kind (`bridge`, a ladder shaft's standable
top, the rolled bundle, the bouncy mushroom's cap, the crumbling floor's phase-aware
solidity) is reached through. The F-018 "terrain kinds still do not own their own rules"
open gap is therefore recorded as **closed** by R-015; a new kind is one module plus one
registry line (see [Adding a tile](#adding-a-tile)).

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

`groundAtlasCell(mask)` in `src/themes/platformer/tiles/groundGrass.ts` maps each of the 16
masks to a `GroundAtlasEntry` — `sx`, `sy`, a `rotation` in quarter-turns clockwise, and a
`kind` of `'bright'` or `'dark'`. The table is pure data, so re-pointing a shape (or swapping
the whole sheet for another material) is an edit to values only. `groundTileKind(mask)`
states the banding rule independently of the table — a tile whose top edge faces open space
is the exposed surface and is bright, anything with terrain above it is buried and dark —
and a test asserts every table entry agrees with it, so editing the rule surfaces exactly
which entries need re-pointing.

`src/themes/platformer/tiles/groundGrass.ts`'s `draw` applies the entry's rotation about the
cell's own centre (through the shared `tiles/draw.ts` `drawRotatedTile`).
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

Which grass sprite is chosen comes from `grassCell(position)` in `tiles/groundGrass.ts`, keyed by
a horizontal run position (`left`, `middle`, `right`, `single`) computed by
`horizontalRunPosition` with the module's local `isGrassSurface` as the continuity test.
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
still serves `groundRock`'s two-sprite lookup in `tiles/groundRock.ts`'s `draw`.

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
in `src/themes/platformer/tiles/bush.ts` maps the role to a sprite family.
`bouncyMushroom` uses it the same way, through `mushroomEntry(role)` / `mushroomHasCap(role)`:
the run's top cell carries the cap (and is the only one-way ground), interior cells are plain
stem, and the bottom cell carries the foot.

`cobwebOrientation(level, col, row)` returns `{ corner, rotation }`, auto-detecting whether
the cell sits in a corner formed by two *adjacent* solid sides (up+left, up+right,
down+right, down+left — opposite pairs are not corners) and how many quarter-turns clockwise
to apply. Checked in that order, first match wins, which also resolves the ambiguous case of
three or four solid sides by preferring up+left. With no adjacent solid pair it falls back to
the flat sprite, for which `rotation` is unused.

### Position-hashed variants

`src/themes/platformer/shared/variants.ts`'s `pickVariant(variants, col, row)` chooses among a role's sprite
variants deterministically from the cell's own column and row, so neighbouring cells of the
same role do not all look identical. The hash multiplies each coordinate by a large
unrelated constant (`Math.imul` keeps this in 32-bit integer math) before XOR-ing, because a
plain `(col * a + row * b) % n` would cycle through a short, visibly repeating sequence as
columns advance. It throws on an empty variants array rather than letting `% 0` produce `NaN`
and surface later as a confusing crash deep in the render loop.

Callers: `tiles/bush.ts`'s `bushOrTreeEntry` (four bush sizes for the `only` role),
`fenceEntry` / `crystalClusterEntry` (one variant each), and `stalactiteEntry` /
`stalagmiteEntry` (large / twin). A level author places one tile; the size is never a
level-file choice.

`isStalactiteTwin(col, row)` reuses that same `pickVariant` hash to tell whether a cell's
`stalactite` decoration resolves to the twin variant, so the O-027 falling-stalactite
hazard (a `fallingStalactite` marker on a `⊤` tile) is guaranteed to render the exact
variant the decoration would at that cell.
The twin's two halves are exported as `TWIN_LEFT_RECT` / `TWIN_RIGHT_RECT` (split at x=8;
left is the taller/larger one) — the hazard detaches exactly one of them, left on an even
column and right on an odd one, keeping the other hanging.

## Multi-cell runs — chain as the worked example

Every tile described so far draws one sprite into one cell. `chain` does not. Its art is
composited as a single continuous stack of native-sized pieces spanning the whole shaft, and
that stack is drawn entirely by the run's **top** cell.

### Why the pieces do not fit the grid

The chain art's link pieces are not 16x16. A link's true vertical repeat is 6px, and 16 is
not a multiple of 6, so forcing each cell to hold one 16px slice would visibly cut links
mid-body at every tile boundary. Instead each piece keeps its own native width and height —
`ChainPieceRect` in `src/themes/platformer/tiles/spriteRects.ts` carries `sx`, `sy`, `width`, `height`, unlike
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
physics: `isClimbableTile` treats every chain tile identically regardless of attachment.

### Run length and piece composition

`chainRunLength(level, col, row)` counts consecutive `chain` cells downward from the given
cell, returning 1 when the cell below is not `chain`. It is only ever called with the cell at
the top of a run.

`chainRunPieces(attachment, runLength)` in `src/themes/platformer/tiles/chain.ts` composes the vertical
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

In `src/themes/platformer/tiles/chain.ts`'s `draw` (invoked by `drawTerrain`'s
band-filtered dispatch), the `chain` draw first checks
`tileAt(level, col, row - 1) !== 'chain'`. Every cell that fails this test is skipped
entirely — it is part of a shaft already drawn from above. The top cell then walks the piece
list, drawing each into a running `drawY`, and clamps against
`capY = destY + runLength * RENDERED_TILE_SIZE` so no piece can spill past the shaft's last
cell; a piece whose remaining room is zero or negative ends the loop.

A visible kind's `draw` decides for itself whether a cell has anything to draw: the
`chain` module returns early for every cell but the run's top, the `groundGrass` module
owns its atlas path, and the decoration modules return early when their sheet is not
loaded. Markers are not in the terrain grid at all, so a tile `draw` never sees one.

### The wall gap and vertical offset

`CHAIN_WALL_GAP` (computed in `tiles/chain.ts`) is `2 * RENDER_SCALE` native pixels, used in two distinct
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

Since R-015 every tile kind is one self-contained module under
`src/themes/platformer/tiles/`, and the exhaustive `TILE_MODULES` map in
`src/themes/platformer/tiles/registry.ts` is the single dispatch point. Adding a tile is
therefore **one new module plus one registry line** — no edit to `level/Terrain.ts`,
`engine/Physics.ts`, `engine/Standable.ts`, `engine/Renderer.ts`, `level/LevelParser.ts`,
`level/LevelData.ts` or the editor palette. Follow the repository's test-first rule: write
the failing test first.

1. **Add `src/themes/platformer/tiles/<kind>.ts`.** Declare a module object that
   `satisfies TileModule` (the contract in `tiles/TileModule.ts`) with:
   - `char` — the level character it is parsed from (omit for a registry-only kind such as
     `ropeLadder`), and `fogExempt`;
   - `drawBand` — `'terrain'` (the default pass), `'afterHazards'` (a state/phase layer such
     as the crumbling floor) or `'deployable'` (drawn by R-008's deployable pass);
   - any capability flags it has (`solid`, `oneWay`, `climbable`, `dropThrough`);
   - any context-dependent rule hooks (`standableAt`, `solidRegionAt`);
   - a `draw(rc: TileDrawContext)` when it is visible (read the resolved images from
     `rc.images` — a `tiles/` module never imports `entities/sprites/`);
   - a `state` descriptor when it carries transient grid state, routed through
     `shared/timedTile.ts` (R-004 owns the lifecycle — never a second signal or tick).

2. **Add one line to `TILE_MODULES` in `tiles/registry.ts`.** That is the whole
   registration. `TileType` (`keyof typeof TILE_MODULES`), `TERRAIN_CHARS` and
   `TILE_FOG_EXEMPT` derive from it automatically, so the parser, the fog pass and the
   built-in palette all pick the tile up with no further edit.

3. **Tests.** The module's rules/art have their own `tiles/<kind>.test.ts` (moved with the
   module if it already had one). `tiles/registry.test.ts` already asserts the registry is
   exhaustive against the frozen kind list, the char/fog tables derive correctly, the layer
   invariants hold, and no per-kind rule branch survives in `Physics.ts`/`Standable.ts`/
   `Terrain.ts` — so a bad registration fails the suite.

4. **Only if the art needs a brand-new image**, register it in
   `src/themes/platformer/entities/sprites/sheets.ts`, load it in
   `PlatformerPage.tsx`/`EditorCanvasPane.tsx`, and add a role to `TerrainImages`
   (`tiles/TileModule.ts`) threaded through the two render passes.

5. **Only if the editor should expose the tile directly**, add its palette entry in
   `src/themes/platformer/editor/paletteTiles.ts` (a crop into a sheet, or `null` for an
   invisible tile) — R-010 will later read this from `TILE_MODULES` instead. Document the
   character in [LevelFormat.md](LevelFormat.md).
