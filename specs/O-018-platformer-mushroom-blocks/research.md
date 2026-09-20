# Phase 0 Research: Platformer Bouncy Mushroom Blocks

The spec's Clarifications session already settled the two behavioural questions
(the covered-cap rule, and the launch strength). These decisions cover the
remaining implementation choices, including the one the spec explicitly leaves
to the plan — special-case the mushroom in the existing predicates, or start a
terrain-kind registry — plus the art-role mapping, the bounce plumbing and the
squash.

## D1 — Special-case the mushroom in the existing predicates (no registry)

**Decision**: Do **not** introduce a terrain-kind registry. Add one predicate,
`isStandableMushroomCap(level, col, row)`, to `level/Terrain.ts` and consult it
from `engine/Physics.ts`'s ground scan, exactly as `isStandableLadderTop` and
`isStandableLadderBundleTop` are consulted today. `isSolid`/`isClimbable` stay
untouched, so the mushroom is non-solid and non-climbable for free.

**Rationale**: The spec's Open Requirements leaves this open and requires only
that the behaviour hold either way. Every existing one-way kind (bridge, a
ladder shaft's standable top rung, the rolled rope-ladder bundle) is a
special-cased predicate; a registry would be a cross-cutting refactor of
`Terrain.ts`, `Physics.ts`, `Renderer.ts` and every predicate consumer for one
new tile, which contradicts the constitution's **No Feature Bloat** and
**Performance/Static Delivery** principles for no behavioural gain. The
"terrain kinds do not own their own rules" gap (recorded in F-018) therefore
stays open, as the spec permits; the mushroom is one more predicate beside its
predecessors, and a future feature may still lift them all into a registry.

**Alternatives considered**:

- *A `TerrainKind` registry owning solidity/standability/art* — rejected as
  out of scope and high-risk: it touches every predicate call site and every
  tile's rendering for a feature that needs one new one-way term. The spec says
  the behaviour must hold either way; the minimal change is chosen.
- *Extend `isSolid` with the mushroom and special-case the exclusions* —
  rejected: the mushroom must block nothing horizontally or from below, and
  `isSolid` is the plain "blocks movement" test; adding it there would require
  threading an exclusion through the horizontal and ceiling scans the way
  `bridge` already is, which is strictly more code than one ground-only
  predicate.

## D2 — The tile model: two `TileType` members, two characters

**Decision**: Add two members to the `TileType` union in
`level/LevelData.ts`:

- `bouncyMushroom` — the red bouncy mushroom, placed by the character `§`
  (section sign, U+00A7). Non-solid, non-climbable, a vertical run whose top cap
  is standable from above only when the cell above is not solid.
- `decorativeMushroom` — the small non-solid dressing mushroom, placed by `s`.
  Never solid, never standable, never bounces.

Both are registered in `TERRAIN_CHARS` and `TileChar`. Because `§` is not a
valid JS identifier, its `TERRAIN_CHARS` key is quoted (`'§': 'bouncyMushroom'`)
and its `TileChar` member is `| '§'`; `s` is a valid identifier, so its key
stays unquoted (`s: 'decorativeMushroom'`) with the union member `| 's'`.

**Rationale**: `§` and `s` are unused by all four foreground level maps
(`TERRAIN_CHARS`/`ENTITY_CHARS`/`SIGN_CHARS`/`HAZARD_CHARS`) and do not collide
with any existing terrain character (`.` `G` `R` `#` `B` `H` `I` `P` `+` `n`
`N` `X` `c` `⊤` `⊥` `¥` `@`). They are the user's chosen glyphs: `§` is
visually unmistakable in a layout string, and `s` reads as a small mushroom.
`s` also appears in `BACKGROUND_CHARS` as `surfaceStone`, which is allowed
because the background is a **separate layer** whose characters may overlap the
foreground ones — the existing `c` already means `crystalCluster` in the
foreground and `charcoal` in the background — so this is not a missed collision.
The two kinds are distinct types because one has a one-way standable cap and the
other has no behaviour at all — a single type cannot express both without
state-dependent predicates.

**Alternatives considered**:

- *One `mushroom` type plus a decorative flag* — rejected: tiles are stateless
  values; a flag would make standability depend on cell content, contradicting
  the "art role is a pure function of neighbours" model.
- *`f`/`y` (fungus) glyphs* — rejected in favour of the chosen `§`/`s`.

## D3 — Cap standability: `isStandableMushroomCap`

**Decision**: Add to `level/Terrain.ts`, mirroring `isStandableLadderTop`:

```ts
export function isStandableMushroomCap(level: LevelDef, col: number, row: number): boolean {
  const above = tileAt(level, col, row - 1);
  return tileAt(level, col, row) === 'bouncyMushroom'
    && above !== 'bouncyMushroom'
    && !isSolid(above);
}
```

A cell is a standable cap when it **is** a bouncy mushroom, it is the **top**
of its run (no same-kind cell directly above), and the cell directly above is
**not solid** (FR-005/FR-006). `tileAt` already returns `'empty'` out of bounds,
so a cap in the level's top row is correctly standable. It takes the level and
a coordinate, not a bare tile, exactly like `isStandableLadderTop` — it is a
property of a cell in context.

**Rationale**: This is a line-for-line analogue of `isStandableLadderTop`
(`isClimbable` → "same kind"), which is the established precedent for a
"standable top with no room to stand" rule. `isSolid` includes `bridge`, so a
bridge directly above a cap makes it non-standable — consistent with the ladder
precedent. The predicate is used both as a ground term in `Physics.ts` and by
the renderer-agnostic bounce query (D5).

**Alternatives considered**:

- *Always standable regardless of the cell above* — rejected by the spec's
  Clarifications (Option A); a covered cap can never be reached from above.
- *Standable but non-bouncy when covered (Option C)* — rejected by the spec;
  nothing special should happen where no landing can occur.

## D4 — Art roles from the sheet (`mushroom.png`)

**Decision**: Map the four `verticalRunRole`s to the existing
`public/sprites/mushroom.png` (64×64, a 4×4 grid of 16 px cells). Cap-bearing
art uses only the red cap variant (row 0). The one exception is the `bottom`
foot at `(48, 16)`: that cell lives in row 1, which is the *orange* variant's
row, but it holds only the shared, colour-neutral tan stem/foot art — pixel
sampling gives `195,170,131` / `153,125,87` plus the same dark outline, with no
orange cap pixels — identical in palette to the red row's own plain stalk at
`(48, 0)`. Reading it is therefore not an orange-variant use and does not
contradict FR-003's "only the red variant of the art is used": the foot shape is
drawn once on the sheet and reused for every cap colour.

| Role | Meaning | Cell | `sx` | `sy` |
| --- | --- | --- | --- | --- |
| `only` | complete mushroom (cap + stem + foot) | col 0, row 0 | 0 | 0 |
| `top` | cap + straight stem connector | col 1, row 0 | 16 | 0 |
| `middle` | plain straight stem | col 3, row 0 | 48 | 0 |
| `bottom` | stem + foot | col 3, row 1 | 48 | 16 |
| *(decorative)* | small complete mushroom | col 2, row 0 | 32 | 0 |

The cap occupies native rows 0–10 of the `only`/`top` cells and the stem/foot
rows 11–15, so the cap/stem split is `MUSHROOM_CAP_SOURCE_HEIGHT = 11`. The
`middle`/`bottom` cells are stem-only (no cap). The `bottom` cell's row-1
provenance is explained above: its art is the shared tan foot, not the orange
variant.

**Rationale**: Pixel inspection of the sheet confirms these regions — `only`
has a short stem with two side feet, `top` has a stem running to the cell's
bottom edge (a connector), `middle` is a plain stalk, `bottom` is the stalk
with a flared foot, and `col 2` is the small complete mushroom sitting in the
lower part of its cell. Reusing `verticalRunRole` (the bush/tree helper) makes
the role a pure function of neighbours with no stored per-cell role (FR-002/
FR-015). Pixel-sampling the sheet shows the `top` connector and the `middle`/`bottom`
stalk are both 8 px wide, so a multi-cell run's stem reads as one straight,
unbroken line; only the `bottom` cell's foot flares wider (its extra ~12 opaque
pixels).

**Alternatives considered**:

- *Compositing the cap and a separate stem column like `chain`* — rejected: the
  sheet already supplies per-role cells; only the squash needs a split, and only
  within the cap-bearing cell (D8).
- *A new sprite sheet* — rejected: the spec says both mushrooms come from one
  tileset and the asset already exists.

## D5 — Bounce detection: a pure post-physics query, no `PlayerState` change

**Decision**: Detect the landing **after** `stepPlayerPhysics`, with a new
exported pure function in `engine/Physics.ts`:

```ts
export function playerOnMushroomCap(level: LevelDef, player: PlayerState): { col: number; row: number } | null
```

- Returns `null` unless `player.grounded`.
- Computes the feet row (`floor((y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING) /
  RENDERED_TILE_SIZE)`) and the player's **centre** column
  (`floor((x + PLAYER_RENDERED_SIZE / 2) / RENDERED_TILE_SIZE)`).
- Returns `{ col, row }` when `isStandableMushroomCap(level, centerCol, footRow)`.

`Physics.ts`'s `columnIsGround` gains `isStandableMushroomCap(level, col,
footRow)` so the cap is one-way ground (the character lands on it instead of
falling through). No new field is added to `PlayerState`.

**Rationale**: A grounded player whose centre is over a standable cap has
landed on that cap — whether they fell onto it or walked onto it at the same
height (User Story 1, scenario 5). Because the game loop immediately launches
them, `grounded` is true for exactly the tick of contact; the next tick's
`vy < 0` branch leaves `grounded` false, so the query fires once per contact and
a cap can never be rested on. Using the **centre** column (not "any spanned
column") avoids a bounce when only a sliver of the 24 px hitbox clips an
adjacent cap while the character is really standing on neighbouring solid
ground. Not touching `PlayerState` avoids editing ~16 fixture literals and
every `Physics.ts` return path, and keeps the change to the ground scan plus one
query.

**Alternatives considered**:

- *A per-tick `landedOnMushroomCap` field on `PlayerState` (the
  `blockContacts` pattern)* — rejected: it forces a new required field through
  `playerStateAtTile`, `synthesizePlayerState`, four `Physics.ts` returns and
  ~16 test fixtures for information the caller can derive from the returned
  position, and `grounded` already carries the "this tick's landing" signal.
- *Detect inside `stepPlayerPhysics` and apply the bounce there* — rejected:
  the block-pot bounce is applied to the returned state **after** physics, so a
  bounce applied inside physics would be silently overwritten by a same-tick
  pot landing; the aggregation (D6) belongs in one place, the caller.
- *A `!prev.grounded && next.grounded` edge check* — rejected: it misses the
  walk-onto-a-cap-at-the-same-height case (User Story 1, scenario 5), where the
  character is already grounded.

## D6 — Bounce strength, application and cross-source aggregation

**Decision**: Add `mushroomBounceVelocity: -650` to `PHYSICS_CONFIG`
(`engine/PhysicsConfig.ts`). In `PlatformerPage.tsx`, after `stepPlayerPhysics`
and after the existing block-bounce loop, fold the mushroom into the same
`strongerBounce` aggregation:

```ts
const cap = playerOnMushroomCap(activeLevel.value, next);
let bounceVelocity: number | undefined = blockBounceVelocity; // hoisted out of the block loop
if (cap) bounceVelocity = strongerBounce(bounceVelocity, PHYSICS_CONFIG.mushroomBounceVelocity);
if (bounceVelocity !== undefined) {
  next = { ...next, vy: bounceVelocity, bounceAscending: true };
}
if (cap) mushroomSquashStates.value = startMushroomSquash(mushroomSquashStates.value, cap.col, cap.row);
```

The existing block loop keeps computing its own `bounceVelocity`; it is hoisted
so the mushroom can join it before the single application.

**Rationale**: `-650` at gravity `1200` peaks at `650² / (2 · 1200) ≈ 176 px ≈
5.5 tiles` — the spec's chosen "dedicated super-jump", ~1.6× the normal jump's
peak, clearly stronger than the stomp (`-330`) and pot (`-220`) bounces so the
mushroom always wins a same-instant tie. `bounceAscending: true` is the
established protection from `stepPlayerPhysics`'s variable-jump-height cut, and
the launch never scales with fall speed because it is a fixed impulse written
over the landing's resolved `vy`. `strongerBounce` (the existing "most negative
wins" rule) is reused rather than re-derived, so a pot landing and a mushroom
landing in one tick produce a single, strongest impulse, never a sum (FR-009).

An enemy stomp cannot co-occur with a mushroom landing: the stomp bounce is
applied **before** physics, so the character is already rising (`vy < 0`) when
physics runs and the ground scan never sees the cap — matching the spec's "a
bounce can never be triggered while the character is already rising". The
stomp's own value is therefore superseded, not summed.

Tunneling invariant: `650 · MAX_DT = 650 / 30 ≈ 21.7 < 32` (`RENDERED_TILE_SIZE`).

**Alternatives considered**:

- *Reuse `potBounceVelocity`* — rejected by the spec: a launch weaker than the
  character's own jump would make the standable cap pointless.
- *Scale the impulse with fall speed* — rejected by FR-007: the launch must be
  identical regardless of fall speed or height.
- *Apply the mushroom bounce before the block loop* — rejected: a same-tick pot
  would overwrite it; the aggregation must happen once, after all sources.

## D7 — The cap squash: a small pure module and one new signal

**Decision**: Add `engine/MushroomSquash.ts` (pure, canvas-free, DOM-free):

```ts
export interface MushroomSquashState { col: number; row: number; elapsed: number }
export const MUSHROOM_SQUASH_DURATION_SECONDS = 0.1;
export const MUSHROOM_SQUASH_DIP_PX = 2;            // rendered px
export function startMushroomSquash(states, col, row): MushroomSquashState[];
export function advanceMushroomSquashes(states, dt): MushroomSquashState[];
export function mushroomSquashDip(state): number;   // DIP * (1 - clamp(elapsed/DURATION, 0, 1))
export function mushroomSquashDipAt(states, col, row): number;
```

`PlatformerState.ts` gains `mushroomSquashStates = signal<MushroomSquashState[]>([])`
and `tickMushroomSquashes(dt)` (advance + prune), called in the `playing` tick
alongside `tickDarkness`/`tickDeployableLadders`. `resetGame()` sets the signal
to `[]` (FR-015: a dip is cleared on respawn).

**Rationale**: The squash is the only mutable state the feature introduces, and
the spec demands it be transient and cosmetic. A `{ col, row, elapsed }` entry
per recently-bounced cap is the minimal shape ("which cap, and how long ago").
Keying by cell and **replacing** any existing entry for that cell makes a
landing on an already-mid-squash cap restart the dip rather than queue a second
one (FR-011). A linear return from `2` rendered px to `0` over `0.1 s` is a
brief, visible dip that starts at maximum on the contact instant (the character
is launched immediately). Both constants are game feel, not requirements.

**Alternatives considered**:

- *Deriving the dip from a start timestamp + the world clock* — rejected: it
  still needs a list of active squashes to prune, and `elapsed` is simpler to
  unit-test and freezes naturally with the `playing`-only tick.
- *Animating via a new sprite frame* — rejected by FR-010: no new sprite
  frames; the existing cap art is translated.
- *Storing the squash on `LevelDef`/the tile* — rejected: tiles are stateless.

## D8 — Rendering: a `drawTerrain` branch with a split cap

**Decision**: Register `MUSHROOM_SHEET` (`/sprites/mushroom.png`, 64×64) in
`entities/sprites/sheets.ts` and draw both kinds from a new branch in
`drawTerrain`'s existing cell loop (after the torch branch, before the generic
`tileSource` lookup). `tileSource` gains `case 'bouncyMushroom'` and
`case 'decorativeMushroom'`, both returning `null` (the exhaustiveness check
forces these). `drawTerrain` gains two trailing optional parameters:
`mushroom: HTMLImageElement | null = null` and
`mushroomSquashes: readonly MushroomSquashState[] = []`.

- `decorativeMushroom`: draw the whole `(32, 0)` cell at `destY`.
- `bouncyMushroom`: `role = verticalRunRole(level, col, row, 'bouncyMushroom')`;
  for `middle`/`bottom` draw the whole role cell; for `only`/`top` draw the
  **stem** sub-rect (`sy + 11`, height `5`) at `destY + 11·RENDER_SCALE`, then
  the **cap** sub-rect (`sy`, height `11`) at `destY + dip`, where
  `dip = mushroomSquashDipAt(mushroomSquashes, col, row)`.

**Rationale**: `drawTerrain` is already the single pass that maps terrain to
canvas, and it already threads optional sheets (`staticObjects`, `decorations`,
`torch`) and a per-cell animated lookup (`worldElapsed`); the mushroom follows
the same convention, so no second full-grid pass is added. Splitting the cap
from the stem within the same sprite is exactly what FR-010 requires (the cap
moves, the stem stays), needs no new art, and only affects the two cap-bearing
roles. The mushroom art fills its 16 px cell horizontally, so the standable
surface (the full tile width, `Physics.ts`'s raw tile boundary) matches what the
player sees (FR-016); stems present no collision at all.

**Alternatives considered**:

- *A dedicated `drawMushroomTiles` pass (the `drawDeployableLadders` shape)* —
  rejected: it would add a second full-grid iteration per frame and duplicate
  the `tileSource` exhaustiveness handling for no benefit; the mushroom has no
  composited run or sub-tile reveal.
- *Drawing the whole cap-bearing sprite and translating it* — rejected: the
  stem would detach from the cell below (or the foot would lift off the ground)
  during the dip.
- *A new cap-only sprite* — rejected by FR-010.

## D9 — Editor: palette entries, grouping and sheet loading

**Decision**:

- `editor/paletteTiles.ts`: `§` → the `(0, 0)` complete-mushroom crop of
  `mushroom.png`, label "Bouncy Mushroom", description "Land on its cap to be
  launched upward; walk and jump through it freely"; `s` → the `(32, 0)` small
  mushroom crop, label "Small Mushroom" (decorative) — deliberately distinct
  from "Bouncy Mushroom" so the two are never confused in the palette — with
  description "Small mushroom; purely decorative, no effect".
- `editor/Palette.tsx`: add `'s'` to `DECORATION_CHARS` so the decorative
  mushroom lands in the **Decoration** group; `'§'` is ordinary terrain and
  falls into **Terrain** automatically.
- `EditorCanvasPane.tsx`: add `mushroom: HTMLImageElement | null` to
  `EditorImages`/`EMPTY_IMAGES` and `{ key: 'mushroom', src:
  MUSHROOM_SHEET.src }` to `IMAGE_SOURCES`; `EditorCanvas.tsx` passes
  `images.mushroom` to `drawTerrain` (squashes omitted → default `[]`, static
  preview).
- `PlatformerPage.tsx`: add a `mushroomRef` and load `MUSHROOM_SHEET.src`,
  following the `DECORATIONS_SHEET`/`ROPE_LADDER_SHEET` convention.

**Rationale**: The palette tables are keyed by `TileChar`, so one entry per map
plus the group membership is all that is needed (matching how `torch` and `@`
were added). Both kinds round-trip through the existing layout/character
machinery with no new storage (FR-017/FR-018).

**Alternatives considered**:

- *A dedicated palette group for mushrooms* — rejected: the bouncy mushroom is
  ordinary terrain and the small one is ordinary decoration; the existing groups
  already express the distinction.

## D10 — Documentation updates

**Decision**: Update `docs/themes/platformer/Terrain.md` — add `bouncyMushroom`
and `decorativeMushroom` to the `TileType` table, add `isStandableMushroomCap`
to the one-way/standable section beside `isStandableLadderTop`, note the
mushroom in the run-helpers section, and describe the cap-squash as the one
piece of transient per-cell state. Update
`docs/themes/platformer/LevelFormat.md`'s terrain character table with `§` →
`bouncyMushroom` and `s` → `decorativeMushroom`.

**Rationale**: The spec's Requirements preamble points at `Terrain.md` and
`LevelFormat.md` as the authoritative home of the tile contract; leaving them
stale would make the spec's own reference false. The spec's Open Requirements
also makes `Terrain.md` the place to record that the registry gap remains open.

**Alternatives considered**: *Leaving the docs for later* — rejected for the
same reason as in O-011: the spec names these files as the contract's home.

## Dependencies (existing code this builds on)

- **F-015 Platformer Theme** — the game loop, `stepPlayerPhysics`, the one-way
  terrain model, the level format and the editor all exist; this feature adds
  terrain kinds to that world.
- **O-003 Platformer Tile Layers / F-019 Level Editor** — the palette tables
  (`PALETTE_TILE_SPRITES`/`LABELS`/`DESCRIPTIONS`, `DECORATION_CHARS`), the
  editor canvas and the sprite-loading convention, which gain the two entries.
- **F-018 Platformer Blocks** — records the "terrain kinds do not own their own
  rules" gap this feature deliberately leaves open (D1).
- **O-011 Platformer Deployable Ladders** — supplies the most recent precedent
  for a new terrain kind with a dedicated sheet, a one-way predicate and a
  per-cell transient state signal with the `resetGame` lifetime seam.
- **`engine/Outcome.ts`** — supplies `strongerBounce`, reused for the
  cross-source bounce aggregation (D6).
