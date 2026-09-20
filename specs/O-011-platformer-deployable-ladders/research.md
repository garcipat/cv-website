# Phase 0 Research: Platformer Deployable Ladders

The spec's Clarifications session already settled the behavioural questions.
These decisions cover the remaining implementation choices, including three
ambiguities the spec leaves open: the terrain character, the exact trigger cell
check, and how deployment's lifetime interacts with the existing theme-switch
reset.

## D1 — The tile model: two new `TileType` members, one character

**Decision**: Add two members to the `TileType` union in `level/LevelData.ts`:

- `ladderBundle` — the author-placeable rolled bundle. Placed by the character
  `@`. Non-solid, **not** climbable, standable from above only.
- `ropeLadder` — one deployed rung cell. **Never** author-placeable and has no
  level character; it exists only in the effective (runtime-overridden) grid.
  Climbable exactly like `ladder`/`chain`.

Only `ladderBundle` is registered in `TERRAIN_CHARS` and `TileChar`; `ropeLadder`
is deliberately absent from both, because a level file must never contain it.

**Rationale**: Reusing the existing `isClimbable`/`isStandableLadderTop`
predicates is what the spec's FR-006 demands ("behaves exactly like an
authored ladder"), and those predicates take a bare `TileType`. A distinct
`ropeLadder` type lets the deployed shaft reuse every one of them with no new
climbing code, while still being visually distinct (`tileSource` returns `null`
and a dedicated pass draws the rope art).

**Alternatives considered**:

- *Override a cell's effective tile to `ladder`/`chain`* — rejected: the
  renderer would then draw wooden/chain art under the rope art, so the deployed
  shaft could never be visually distinct (spec FR-015) without a fragile
  full-coverage overlay.
- *Make `isClimbable`/`isSolid` take `(level, col, row)` plus an override map* —
  rejected: it changes the signature of every predicate and every call site in
  `Physics.ts` for one feature, and duplicates predicate logic. The effective
  grid keeps predicates as pure functions of a tile value.
- *A single `ropeLadder` type for both rolled and deployed states* — rejected:
  the rolled bundle is standable-but-not-climbable while a deployed rung is
  climbable; one type cannot express both without state-dependent predicates.

## D2 — The runtime override is a derived `LevelDef`, used by physics only

**Decision**: `engine/DeployableLadder.ts` exports
`applyDeployedLadders(level, states): LevelDef`. It returns `level` **unchanged**
when no bundle is deployed (the common case); otherwise it shallow-copies the
terrain rows and writes `ropeLadder` into every cell of each completed bundle's
shaft (`row … landRow` at its column). A `computed` in `PlatformerState.ts`
(`activeLevel`) derives this from `currentLevel` + `deployableLadderStates`, and
`PlatformerPage.tsx` passes `activeLevel.value` to `stepPlayerPhysics` only.

Rendering continues to read the **raw** `currentLevel`; the dedicated
`drawDeployableLadders` pass (D7) draws the rope art over it.

**Rationale**: Physics is the only consumer that must see a deployed rung as
climbable and a rolled/deploying bundle as standable. Enemies treat both as
non-solid (as they already treat `ladder`), and lighting/camera never read
terrain. Keeping the effective grid out of the renderer avoids a double draw and
keeps all rope art in one pass. Because climbability is all-or-nothing at
completion (FR-007: a partial shaft is never climbable), the effective grid only
changes on the completing tick — the unroll animation is purely a render
concern.

**Alternatives considered**:

- *Mutate `LevelDef.terrain` in place when a bundle deploys* — rejected: tiles
  are stateless by design and `currentLevel` is a `computed` over the editable
  layout; mutating it would corrupt the editor round-trip and the reset story.
- *Rebuild the whole level on every tick* — rejected: needless allocation and
  change-detection churn; the `computed` only recomputes when the layout or the
  states change, and the no-deployed fast path allocates nothing.
- *Thread the override into the renderer too* — rejected: the renderer needs the
  rolled/deploying/deployed phases and 8 px step progress, which a tile grid
  cannot express; a dedicated pass is clearer.

## D3 — Per-bundle state, and its lifetime

**Decision**: Add `deployableLadderPlacements` (a `computed` mapping each `@`
cell to a `DeployableLadderState` via `createDeployableLadderState(currentLevel,
col, row)`) and `deployableLadderStates` (a plain `signal`, seeded once from the
placements) to `PlatformerState.ts`, following the `checkpointPlacements` /
`checkpointStates` split exactly.

- `resetGame()` (death/respawn) does **not** touch `deployableLadderStates` —
  deployment survives a respawn (FR-013).
- `resetGameProgress()` (Reset Game, the editor's Try, and the theme-switch
  mount effect) rebuilds them from `deployableLadderPlacements` — a bundle is
  rolled back up.

**Rationale**: The state is per-instance session state, exactly like
`blockStates`/`chestStates`, and those already follow the
placements-computed/state-signal split with the same reset seams.

**Resolved ambiguity — theme switch**: The spec's Assumption says deployment
survives a theme switch, but the shipped theme-switch reset
(`PlatformerPage.tsx`'s mount effect) calls `resetGameProgress()`, which resets
blocks and chests too. FR-013's operative clause is "MUST share the lifetime of
the game's other session state (blocks, chests)"; the Assumption's claim that
blocks/chests survive a theme switch is not what the code does. To genuinely
share their lifetime, deployment is cleared at the same seam. If a future
feature makes blocks/chests survive a theme switch, deployment follows
automatically. This is recorded rather than silently diverging from the
Assumption.

**Alternatives considered**:

- *Preserve deployment across a theme switch by not clearing it in
  `resetGameProgress`* — rejected: it would give deployment a different lifetime
  from blocks/chests, contradicting FR-013's "share the lifetime", and would
  leave stale deployed shafts over a layout that the mount effect may just have
  replaced via `?level=`.
- *Store deployment on the `LevelDef`* — rejected: `LevelDef` is derived from
  the layout and has no place for mutable session state.

## D4 — Deploy trigger and Up-key precedence

**Decision**: A pure `ladderBundleForPlayer(level, states, player)` returns the
first **rolled** bundle that is:

- in a column the player's hitbox spans, **and**
- at the player's feet row **or** the row directly above it, **and**
- only when `player.grounded`.

The "feet row or one above" pair is the concrete form of the spec's "occupies
the bundle's own cell or the cell directly above it" for a two-tile-tall
character: standing *on* the bundle puts its cell at the feet row, and standing
on the ground with the bundle at body height puts it one row above the feet.

In the game-loop tick, after `interactPressed` (the edge-triggered Up/W press
the chest/hint code already computes) this is checked **before** chest opening
and hint revealing. On a match, `beginDeploy` moves that state to `deploying`
and both the chest-open and hint-reveal blocks are skipped for that press
(FR-017). Holding Up afterwards is harmless: the bundle is not climbable while
rolled/deploying, and the press is edge-triggered so it cannot re-fire.

**Rationale**: Up already climbs, opens chests, drops through bridges and
reveals hints; the spec requires a rolled bundle's deploy to take precedence
only when its own conditions are met. Reusing the already-consumed
`interactPressed` keeps one definition of "the interact press" and guarantees
the deploy cannot also open a chest or show a hint in the same tick.

**Alternatives considered**:

- *Handle the trigger inside `Physics.ts`* — rejected: physics is a pure
  movement step with no access to the interact edge, chest/hint precedence, or
  signals; the trigger is orchestration.
- *Trigger on the held Up (`climbUpHeld`)* — rejected: holding Up while walking
  onto a bundle would deploy it unintentionally, and FR-003/FR-017 describe a
  deliberate press.

## D5 — Unroll timing and the step-based reveal

**Decision**: `UNROLL_SECONDS = 0.5`, a fixed duration regardless of shaft
length (FR-004). `advanceDeployableLadder(state, dt)` accumulates `elapsed`
while `deploying` and flips to `deployed` once it reaches `UNROLL_SECONDS`. The
reveal is measured in **8 native-pixel steps** (`LADDER_STEP_NATIVE_PX = 8`,
two per 16 px tile): `totalStepCount = (landRow - row) * 2` and
`revealedStepCount = floor(totalStepCount * clamp(elapsed / UNROLL_SECONDS, 0,
1))`. A zero-length landing has `totalStepCount = 0` and still takes the full
`UNROLL_SECONDS` before the bundle sprite flips (SC-004: "whether the shaft is
one tile or twenty"). The tick runs only in the `playing` phase, so a paused
game freezes the unroll (spec Edge Case).

**Rationale**: A fixed duration is explicitly required, and a step count derived
purely from `elapsed` keeps the animation stateless (no per-frame progress
writes beyond `elapsed`) and exactly unit-testable. Measuring in 8 px steps
matches the spec's sprite-sheet design, so a long shaft reveals faster per step
rather than taking proportionally longer.

**Alternatives considered**:

- *One cell revealed per tick/at a fixed cells-per-second rate* — rejected: it
  makes a long shaft take proportionally longer, contradicting FR-004, and the
  sheet is built from 8 px steps, not whole cells.
- *An easing curve* — rejected: the spec only asks for a short, visible,
  fixed-duration reveal; a linear step reveal is simplest and matches the art.

## D6 — The landing scan

**Decision**: `ladderLandingRow(level, col, row)` starts at `row + 1` and walks
down while the cell is **not** solid, stopping before the first solid cell or at
the level's last row; it returns the last non-solid row reached, or `row` itself
when `row + 1` is solid or `row` is the bottom row. It uses `isSolid` from
`Terrain.ts`, so a `bridge` counts as solid (spec FR-005) and the level's bottom
is the fallback.

**Rationale**: `isSolid` is the one authoritative "this stops a fall" predicate
and already includes `bridge`; `tileAt` returns `'empty'` out of bounds, so the
scan needs no special bottom handling beyond bounding by `level.height`. A
zero-length landing (`landRow === row`) is a first-class result, not an error
(FR-010).

**Alternatives considered**:

- *Scan for `isSolidExcludingBridge`* — rejected by the spec clarification: a
  bridge stops the unroll.
- *Treat out-of-bounds as solid* — rejected: the spec says the unroll stops at
  the level's bottom, and a bottom-row bundle has nowhere to go; the bounded
  loop already expresses that.

## D7 — Rendering the bundle, the unroll and the deployed shaft

**Decision**: Register `ROPE_LADDER_SHEET` (`/sprites/rope_ladder.png`, 32×32)
in `entities/sprites/sheets.ts`, load it in both `PlatformerPage.tsx` and
`LevelEditorPage.tsx`, and draw everything through one new
`drawDeployableLadders(ctx, level, states, ropeSheet, originX, originY)` pass.
`tileSource` returns `null` for both `ladderBundle` and `ropeLadder`, so the
generic terrain path never draws them. Sprite rects and the shaft piece plan
live in `StaticObjectsCatalog.ts` next to the chain pieces:

- `ROPE_BUNDLE` = (0, 0, 16×16) — the rolled bundle.
- `ROPE_TOP_CAP` = (16, 0, 16×8) — the deployed top cap.
- `ROPE_STEP` = (16, 8, 16×8) — the repeat unit (also at 16, 16).
- `ROPE_BOTTOM_CAP` = (16, 24, 16×8).

Per state:

- **rolled / deploying**: draw `ROPE_BUNDLE` at the bundle cell; then draw
  `revealedStepCount` `ROPE_STEP` pieces downward starting one full cell below
  the bundle (native y = bundle cell y + 16), 8 px per step, never past the
  landing cell's bottom.
- **deployed**: draw `ROPE_TOP_CAP` then `ROPE_STEP` in the bundle cell, then
  two `ROPE_STEP` pieces per cell below, replacing the final piece with
  `ROPE_BOTTOM_CAP` — so rungs stay evenly spaced at any shaft length.

**Rationale**: The sheet is hand-authored flat 2D pixel art and already matches
the spec's regions. Keeping the rects and the composition in
`StaticObjectsCatalog.ts` mirrors `chainRunPieces`, and keeping the phase logic
in the pure module keeps the draw pass a thin consumer. Drawing the bundle from
the dedicated pass (rather than from `drawTerrain`) is what lets the bundle cell
switch from rolled to top cap without the rolled sprite showing through.

**Alternatives considered**:

- *A per-cell `tileSource` sprite* — rejected: the deployed shaft is a
  composited run whose top cap/step/bottom cap depend on the run, and the unroll
  is a sub-tile reveal a per-cell lookup cannot express.
- *Drawing the rope art in `drawTerrain`'s tile loop* — rejected: `drawTerrain`
  would need the per-bundle phase and progress, and the raw-vs-effective split
  from D2 would double-draw.

## D8 — Editor landing preview and palette entry

**Decision**: The editor draws each `@` cell's bundle sprite and a faint
landing marker on `ladderLandingRow`'s cell, using a new editor-only helper; the
marker never runs in game (only `EditorCanvas.tsx` calls it). The palette gains
one `@` entry in `PALETTE_TILE_SPRITES` (the rolled bundle crop),
`PALETTE_TILE_LABELS` ("Rope Ladder Bundle") and `PALETTE_TILE_DESCRIPTIONS`
(what pressing Up does). `ladderBundle` is a terrain tile, so it lands in the
palette's **Terrain** group automatically; no `DECORATION_CHARS` change.

**Rationale**: FR-016 requires the landing cell to be visible in the editor
only, and the palette is a data table keyed by `TileChar`, so one entry per map
is all that is needed (matching how `torch` was added). The editor synthesizes
rolled states for all bundles via a new `synthesizeLadderBundleStates(grid)` in
`gridRenderState.ts`, reusing the same draw pass as the game.

**Alternatives considered**:

- *Computing the landing row in `EditorCanvas` inline* — rejected: duplicates
  the scan; the pure `ladderLandingRow` is the one definition.
- *A special palette section for bundles* — rejected: it is ordinary placeable
  terrain, so the Terrain group is correct.

## D9 — Documentation updates (the spec's `Terrain.md` reference)

**Decision**: Update `docs/themes/platformer/Terrain.md` with the two new
`TileType` members, the new `isStandableLadderBundleTop` predicate, and a new
**"Runtime overrides"** section documenting `applyDeployedLadders` — this is the
"how a tile's runtime override is resolved" knowledge the spec's Key Entities
section points at. Update `docs/themes/platformer/LevelFormat.md`'s terrain
character table with `@` → `ladderBundle`.

**Rationale**: The spec explicitly states this is code knowledge that lives in
`Terrain.md`; leaving it undocumented would make the doc claim false. The
`ropeLadder` type is intentionally not a level character, so `LevelFormat.md`
documents only `@`.

**Alternatives considered**:

- *Leaving the docs for later* — rejected: the spec makes `Terrain.md` the
  authoritative home of this mechanism, so the plan must keep it true.

## D10 — Character choice `@`

**Decision**: Use `@` for `ladderBundle`.

**Rationale**: It is unused by all four level maps (`TERRAIN_CHARS`,
`ENTITY_CHARS`, `SIGN_CHARS`, `HAZARD_CHARS`), it does not collide with the
existing `H` (ladder) / `I` (chain), and the user chose it. The spec leaves the
character open; `LevelFormat.md` is updated accordingly.

**Alternatives considered**: `%` — unused and reads like a rolled bundle, but
the user preferred `@`; `L` — rejected as confusable with the existing
ladder/chain family and less visually distinct in a layout string.

## Dependencies (existing code this builds on)

- **S-008 Platformer Ladders & Climbing** — supplies `isClimbable`,
  `isStandableLadderTop`, the climb state and vertical camera follow; the
  deployed `ropeLadder` cells reuse all of it unchanged.
- **O-010 Platformer Cave Lighting** — supplies the
  `playerOccupiedCell`/`PlayerState` conventions and the darkness tick pattern
  the new per-tick advance mirrors.
- **F-019 Platformer Level Editor** — supplies the palette tables and
  `EditorCanvas`, which gain the bundle entry and the landing marker.
- **O-001 Platformer Checkpoints** — supplies the
  placements-computed/state-signal/reset split this feature's state copies.
