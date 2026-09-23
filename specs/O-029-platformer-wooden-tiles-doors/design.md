# Platformer Wooden Tiles & Doors — Design Rationale

Why this feature is shaped the way [spec.md](./spec.md) describes. What follows is only the
reasoning; behavior lives in the spec.

Source idea: GitHub issue [garcipat/cv-website#70](https://github.com/garcipat/cv-website/issues/70),
"Idea: Wooden tiles and doors" — flagged as needing clarification before it could be scoped.
Clarified in brainstorming: wood needed both a solid foreground material and a non-solid
background material, and a door needed to be genuinely interactable/openable rather than
decorative or a room transition.

## Two separate wood tiles, not one material with two looks

"Wood" is asked for twice over — once as something to stand on, once as something to see behind
the level — and this codebase already keeps those two notions in entirely separate systems:
foreground `TileType` (solid, collision-relevant, `level/LevelData.ts`) and the O-014 background
mass (non-solid, painted behind everything, its own grid and its own open set of materials). There
is no shared "material" abstraction between them to hang one wood definition off of, and inventing
one to save an art asset would be new plumbing this feature doesn't otherwise need. So wood becomes
two independent additions, one per system, each following its system's own existing rules rather
than a new cross-cutting concept.

## Solid wood: `groundRock`'s shape, not `groundGrass`'s

Foreground terrain has exactly two precedents for "a solid material with more than one sprite":
`groundGrass`'s full 16-entry neighbour-mask autotiling (continuous borders, a grass overlay pass)
and `groundRock`'s plain two-sprite exposed/buried lookup with no neighbour awareness at all. Wood
was explicitly scoped to skip autotiling ("keep it easy" — a single tile that doesn't connect to
its neighbours), which rules out the `groundGrass` shape entirely: that machinery exists to solve a
continuity problem this tile doesn't have. `groundRock`'s shape is a direct fit as-is — a new
`groundWood` member in the `TileType` union, exposed-top/buried sprites chosen by
`isTopExposed`, no new predicate, no new atlas table. The only new work is the art itself and the
`TileType`/`LevelParser`/`Renderer`/palette wiring `Terrain.md`'s "Adding a tile" steps 1–3 and 7–8
already lay out for exactly this shape of tile.

## Wood background: the open material set absorbs it for free

O-014 already declared background materials an *open set defined by the art sheet*, not a
hardcoded pair — "materials are an open set... family stays the fixed two-value axis." Adding
`wood` is therefore not a design decision about mechanism, only a content decision: one more
entry in `background_tiles.png`'s material layout, one more `family: 'surface'` assignment (it
belongs with `dirt`/`rust`/`surfaceStone` as an aboveground material, not with the cave family
`charcoal`/`maroon`/`caveStone` O-010 reads for lighting treatment), and one more row in whatever
background-decor accents O-014's position-hashed catalog already places. No code path this feature
touches needs to know wood is new at all — it is simply another value flowing through machinery
built to take one.

## Door: paired tiles with runtime override, not a new entity category

A door needs to be **solid while closed** and **interact-triggered to open**. Every existing
interactable was checked against that pair and each fails one half:

- **Blocks** (`BlockType`) are solid and stateful, but triggered by a *hit from a specific
  contact side*, not by standing nearby and pressing a key. Re-purposing `triggerSides` to mean
  "interact key pressed while adjacent" would stretch a hit-detection concept to cover an
  unrelated input, for a one-off.
- **Chest**, the codebase's only existing interact-key-driven entity, is never solid — "not a
  solid obstacle, so the character walks over and beside it" is load-bearing to how chests are
  placed and approached. Making chests solid would ripple into every existing chest in every
  saved level.

Neither shape fits, but the codebase already has a precedent for the actual combination needed —
**a terrain tile, placed and solid like any other, whose solidity changes at runtime through a
small per-instance state map and an effective-grid pass** — because O-011's deployable rope-ladder
bundle is exactly that: `ladderBundle` is an ordinary solid-until-triggered tile, `PlatformerState.ts`
holds a `DeployableLadderState` per bundle, and `applyDeployedLadders` returns an effective
`LevelDef` with completed bundles' cells rewritten as climbable — described in `Terrain.md` as a
**deliberate, narrow exception** to "nothing about a tile changes at runtime," not a general
per-tile animation framework. A door state (`DoorState`: open/closed per placed pair, keyed by
position) is a second instance of that same narrow exception, not a new one — `applyOpenedDoors`
mirrors `applyDeployedLadders`'s shape: solid `doorLeft`/`doorRight` cells rewritten to a passable
tile once open. Unlike a rope-ladder bundle's one-way `rolled → deployed` progression, a door's flip
is reversible — the interact handler calls the same toggle on either state, so `DoorState` only ever
holds `'open' | 'closed'` rather than growing a transitional phase the way deploying does.

### Enemies read the same effective grid, not a second mechanism

O-011 scoped `activeLevel` to a single consumer deliberately — "only `stepPlayerPhysics` consumes
this." A door breaks that scoping on purpose: it must block (or admit) enemy movement exactly as it
does the player's, per the clarified requirement, and enemy movement does not currently read
`activeLevel` at all — `stepHorizontal` is called today against the raw `currentLevel`, with a
separate `blockedTiles` list layered on top purely to tell enemies about live block instances (whose
positions the static grid can't express, since `LevelParser.ts` resolves a block marker to `'empty'`
terrain). A door is not like a block in that respect: it *is* an ordinary pair of grid cells, just
ones whose solidity can flip, which is exactly what `activeLevel` already exists to express. So the
door's own solidity flows through `activeLevel` for both consumers — enemy movement's `level` param
switches from `currentLevel.value` to `activeLevel.value`, the same value `stepPlayerPhysics` already
reads — rather than teaching `blockedTiles` a second, differently-shaped kind of entry to carry door
state as live positions instead of grid cells. `blockedTiles` keeps meaning exactly one thing (live
block instances); `activeLevel` keeps meaning exactly one thing (the grid with every runtime tile
override applied), now read by two call sites instead of one. `Terrain.md`'s "two deliberate
exceptions" framing is still accurate for what *can* change a tile at runtime (ladder bundles, now
also doors) — this only widens who is required to look at the result.

Opening carries no key cost and reveals no CV fact — a door is a traversal gate, not a collectible.
That puts it closer in spirit to a rock (blocks a route, no CV mapping) than to a chest (the
CV-content objective the key economy exists to gate). Tying a second interact-and-key mechanic to
the same key pool chests already use would make keys serve two unrelated purposes with no way for
a visitor to tell which a given key press will consume, for no stated benefit in the source idea.

### A shared `applyTerrainOverrides` helper, not a second copy of the same plumbing

`DeployableLadder.ts`'s `applyDeployedLadders` has a shape that has nothing to do with ladders
specifically: filter per-instance states down to the ones currently affecting the grid: if none,
return the input `level` by reference (so the common no-override case allocates nothing): otherwise
clone `level.terrain` exactly once (`level.terrain.map((row) => [...row])`) and write into that one
clone for every affected state. `applyOpenedDoors` needs precisely that shape — filter to states
where `phase === 'open'`, write each open pair's two cells — differing from the ladder version only
in *which* states qualify and *which* cells each one writes. Writing a second, separately-tested copy
of the filter/clone-once/identity-when-empty logic would be exactly the kind of duplication this
codebase's own conventions warn against (`pickVariant`'s shared home rather than one per decoration
kind, `drawBlockTile`/`potRenderPlan` shared across block kinds). Since this feature is the second
caller of that shape, not the first, it is the right moment to lift the shared part out — a small
`applyTerrainOverrides(level, states, isActive, cellsFor)` helper (`isActive: (state) => boolean`,
`cellsFor: (state) => Iterable<{ col, row, tile }>`) that owns the filter/clone/identity mechanics
once, called by both `applyDeployedLadders` (unchanged behavior, now expressed through the shared
helper) and the new `applyOpenedDoors`. `activeLevel` composes both:
`applyOpenedDoors(applyDeployedLadders(currentLevel.value, ladderStates), doorStates)`.

This is deliberately smaller than a `TerrainKind` registry — `Terrain.md`'s "Open gap" note already
records that a full registry lifting `isSolid`/`isClimbable`/one-way predicates out of `Physics.ts`
is a known, larger, and still-open gap, explicitly left alone by every feature so far including this
one. `applyTerrainOverrides` only touches the narrower "runtime tile override" shape those two
features already share, not the broader predicate-dispatch question — it makes the *existing*
two-instance pattern honest about being one mechanism instead of two coincidentally similar ones,
without pre-building machinery for hypothetical future tile kinds this feature doesn't need.

### `applyInteract`: one dispatch, not a fourth hand-written block

`PlatformerPage.tsx`'s tick already has two hand-written "stand near X, press
interact, X decides what happens" blocks — the ladder bundle's deploy trigger
and the chest's open trigger — with a sign's hint bubble as a close third
(its *interact effect* is `startHintTooltip`, a one-shot transition exactly
like the other two; its per-tick animation and its exit-when-not-overlapping
branch are a separate, already-independent concern, the same way the ladder
bundle's own per-tick `advanceDeployableLadder` is independent of its
one-shot `beginDeploy`). A door would be a fourth copy of the same shape.
Three near-identical hand-written blocks was already a lot; a fourth is the
point where the duplication itself becomes a design problem, not a matter of
taste — this is the same "second (now fourth) caller of the same shape, right
moment to lift it out" reasoning that justified `applyTerrainOverrides`.

Each kind's *detection* geometry differs (ladder bundle: proximity above;
chest: overlap; door: adjacent-but-not-overlapping, since a closed door is
solid; sign: overlap) and each kind's *effect* touches its own state (and,
for chest, `collectedKeys` and `revealFact`) — so the shared part isn't "one
function that knows about all four," it's a thin common shape each kind
already expresses through its own pure functions (`ladderBundleForPlayer`/
`beginDeploy`, `chestPlayerIsStandingOn`/`openChest`, the new
`doorPlayerIsAdjacentTo`/`toggleDoor`, `checkSignOverlap`/`startHintTooltip`),
wired through one small adapter interface:

```ts
interface Interactable {
  kind: string;
  findCandidate(player: PlayerState): string | null;
  applyInteract(candidateId: string): void;
}
```

`applyInteract(interactables: readonly Interactable[], player): boolean`
tries each in a fixed priority order and stops at the first match — a direct
data-driven replacement for the sequential `if`/`!bundleDeployedThisTick`
guards already in `PlatformerPage.tsx`, preserving the same "first match
wins, one press does one thing" behavior. Each kind's own pure logic
(`toggleDoor`, `beginDeploy`, `openChest`, `startHintTooltip`) is untouched —
the adapters are thin closures built once in `PlatformerPage.tsx`, over the
same live signals the hand-written blocks already read and write. Priority
order matches today's implicit order plus the door slotted in: ladder bundle
(must gate the others) → door → chest → sign (read-only, so it never needs to
win against anything, same as today).

This does not touch `applyOpenedDoors`/`applyDeployedLadders` at all — those
answer a different question ("what does the effective grid look like right
now") and keep running every tick regardless of input, exactly as before.
`applyInteract` only replaces the *detection-and-one-shot-effect* half of the
tick, upstream of them.

### Two leaves, two adjacent cells, not one wide entity

The door's art is two 16×26px leaves — each exactly one tile wide. That is what makes the
tile-pair shape work at all: a single wider-than-one-cell entity (the way `Chest` already handles
being wider than its cell) would need new multi-cell placement and interaction-radius logic; two
ordinary one-cell tiles placed side by side, each independently solid, need none. `doorLeft` and
`doorRight` are deliberately separate `TileType` members rather than one type with an
attachment-style role (the way `chain` picks a family from `chainAttachment`): a door has no
variable-length run to classify, just a fixed pair, so the extra indirection a role lookup exists
to support would have nothing to do. Interacting near *either* leaf opens *both* — they are one
door to the player — which the door-state lookup enforces by keying both leaf positions to the
same `DoorState` entry rather than by any rule in `Terrain.ts` itself.

### Rendering taller than the tile: bleed, not squeeze

The leaf art (26px tall) exceeds `TILE_SIZE` (16px). Chest resolves an oversize sprite by scaling
it down to fit its cell exactly, because a chest can be approached and read from any angle in open
ground and never has a neighbour it depends on. A door is different: it is authored into a wall
opening, where the cell above it is expected to be empty by construction (that is what makes it a
doorway rather than a solid wall), and `FloorSpike` already establishes the precedent for a tile
whose art deliberately bleeds past its own cell into a neighbour that the level's construction
already keeps clear (there, below; here, above) rather than being constrained to fit. Squeezing the
door to one tile tall would fight the art's proportions for no reason the level format doesn't
already accommodate — a level author places a door the same deliberate way they'd place a
free-standing torch or sign, with the space its art needs left open.

### Open art already exists — no new sprites required

`staticObjects.png` already contains both states: two single-leaf sprites (open, hinge pegs on
both edges so the same crop can serve either side) and the flush two-leaf closed arrangement,
sitting adjacent in the sheet. This is why the door needed no new hand-drawn art and no
slide/rotate rendering trick to fake an open state from closed-only art — both crops are named
`StaticObjectEntry` values in `StaticObjectsCatalog.ts`, exactly like `COBWEB_CORNER_ENTRY`/
`COBWEB_FLAT_ENTRY` already name two fixed crops from one sheet for two fixed states, and the
renderer picks between them by `DoorState` the same way it picks between `chest_closed.png`/
`chest_open.png` by `ChestVisualState` — swapping which crop is drawn, not compositing or
transforming one crop into two looks.

## Assets needed

Only the two wood terrain additions need new art; the door needs none. Counts below follow
directly from the shapes chosen above, not from a separate art-planning pass.

### `groundWood` — 2 new 16×16 sprites

One exposed-top sprite, one buried sprite — exactly the two `groundRock` already needs for the
same shape (`isTopExposed`, no mask table). Palette should read as the same wood family already
on-screen in `world_tileset.png`'s crate art, so it doesn't visually compete with an existing
material. Added to a free pair of cells in `world_tileset.png` if room remains, otherwise a small
dedicated sheet (`ground_wood.png`) following the `CRUMBLE_FLOOR_SHEET` precedent for a
terrain material that outgrew the shared sheet.

### Wood background material — 9 new 16×16 sprites

`BackgroundAtlas.ts`'s `MASK_SHAPE` maps all 16 neighbour masks onto a fixed 3×3 grid per
material (corner/edge/corner × edge/middle/edge × corner/edge/corner, `gx`/`gy` 0-2) — the other
7 masks are the same 9 shapes rotated, not drawn separately. So one material is always exactly 9
cells, regardless of which material. Per O-014's flat rule, every cell of the material uses the
same tone (no neighbour-driven brightness split), so these 9 need no light/dark variants either.
Added as a 7th row to `background_tiles.png`, same wood palette as `groundWood` so the solid
platform and the backdrop behind it read as the same material at different depths.

### Door — 0 new sprites

Both leaf states already exist in `staticObjects.png` (see above) and only need new
`StaticObjectEntry` crops in `StaticObjectsCatalog.ts`, not new pixels.
