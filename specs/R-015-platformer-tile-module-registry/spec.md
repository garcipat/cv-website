# Feature Specification: Platformer Tile Module Registry

**Feature Branch**: `R-015-platformer-tile-module-registry`

**Created**: 2026-09-27

**Status**: Draft

**Input**: GitHub issue #111 — "R-015: Platformer Tile Module Registry". Give every tile kind one self-contained module — appearance, behaviour rules, and registered transient state — under a new `tiles/` folder, so adding or changing a tile is a one-module edit instead of a change across the level/render/physics/editor files.

**Depends on**: [R-001 Platformer Core Contracts & Dependency Layers](../R-001-platformer-core-contracts/spec.md) (shipped: the `contracts/` leaf layer and the layer invariants this structure must not widen) and [R-004 Platformer Transient Effect Registry](../R-004-platformer-transient-effect-registry/spec.md) (shipped: the unified transient-effect lifecycle and the shared `shared/timedTile.ts` core the stateful tiles already route through). The tile kinds themselves are shipped by [F-015 Platformer Theme](../F-015-platformer-theme/spec.md), [O-011 Deployable Ladders](../O-011-platformer-deployable-ladders/spec.md), [O-018 Mushroom Blocks](../O-018-platformer-mushroom-blocks/spec.md), [O-023 Crumbling Floor](../O-023-platformer-crumbling-floor/spec.md), and [O-027 Falling Stalactite](../O-027-platformer-falling-stalactite/spec.md).

**Relationship to shipped work**: This feature subsumes the `STATIC_TILE_TYPES { key, draw }` draw registry that R-009 deferred to it (the shipped form is `TILE_MODULES`, whose entries carry `char` + `draw` where `STATIC_TILE_TYPES` imagined `key` + `draw`). R-009 is implemented on the unmerged `R-009-platformer-renderer-split` branch (commit `d5c60114`, not yet on `main`): it deliberately relocates the existing `tileSource`/`drawTerrain` path unchanged and consumes R-015's registry once it lands, rather than building a second tile registry. So R-015 owns the static-tile registry half and R-009 narrows to the `SceneRenderer`/`HudRenderer` split. It closes the F-018 open gap recorded in `docs/themes/platformer/Terrain.md` ("terrain kinds still do not own their own rules … a future feature may still lift these predicates into a registry"). R-008's deployable ladder and R-010's editor palette consume the tile-module contract rather than inventing their own.

**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 3 "Tile module registry (R-015)", §3.5 (the tile / grid-object / actor / marker taxonomy), §4.1 (proposed folder structure), and the "Adding a tile" recipe in [`docs/themes/platformer/Terrain.md`](../../docs/themes/platformer/Terrain.md).

## Clarifications

### Session 2026-09-27

- Q: Should the new tile layer be a peer `tiles/` folder beside `entities/`, or should it absorb the terrain pieces of `level/`? → A: A peer `tiles/` folder beside `entities/`; the pure grid readers (`tileAt`, geometry, `neighbourMask`, run helpers) stay in `level/` and the tile modules import them.
- Q: Should each tile module expose context-dependent rule/draw hooks over `(level, col, row, context)`, or declare only static capabilities while the context readers stay shared in `level/`? → A: Context-dependent hooks live on the module (FR-005), with the pure grid readers in `level/` called by those hooks.
- Q: Should a stateful tile declare its transient state through the existing `shared/timedTile.ts` core, or register it through R-004's transient-effect registry? → A: Route through the existing `shared/timedTile.ts` core; R-004 keeps the sole lifecycle and the effect registry is not involved (the R-004 keyed timed-tile family stays separate, and the `neverDeclaresAMushroomSquashKind` guard test and `TransientEffectRecipe.md` stay valid).
- Q: For tile-specific art/state that currently lives in `entities/` (the bouncy mushroom), should that code move into the `tiles/` module, or should `tiles/` import it from `entities/`? → A: Move tile-specific code (the bouncy-mushroom cap art and squash timer currently in `entities/blocks/Mushroom.ts`) into its `tiles/` module; `tiles/` is self-contained and imports no `entities/`.
- Q: Should `TileType`/`TileChar` be derived from the tile registry, or remain explicit unions in `level/` that the registry must cover? → A: Derive both from the registry (`TileType = keyof typeof TILE_MODULES`, `TileChar`/`TERRAIN_CHARS` from each module's declared char); `level/` imports `tiles/` for the derivation (the accepted mutual edge).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - One tile kind is one self-contained module (Priority: P1)

A developer adding or changing a tile kind today edits five or six files. The kind's "identity" is split across `level/LevelData.ts` (the `TileType` union), `level/LevelParser.ts` (`TERRAIN_CHARS` and the `TileChar` union), `level/Terrain.ts` (the behaviour predicates), `engine/Physics.ts` (the one-way and standable special cases), `engine/Renderer.ts` plus `engine/GroundAtlas.ts`/`engine/StaticObjectsCatalog.ts` (appearance), and the editor's `paletteTiles.ts`. After this feature each tile kind is one module under a new `tiles/` folder that owns its draw, its behaviour rules, and its declared transient state, and a tile-kind registry maps each `TileType`/`TileChar` to that module — so a tile change is a one-module edit plus at most one registry line.

**Why this priority**: This is the feature's whole point (the F-018 gap and the "L1 registry half") and the structural contract R-008, R-009 and R-010 are waiting to consume.

**Independent Test**: Search the theme for the per-kind tile edits — every shipped `TileType` resolves to exactly one module under `tiles/` and one registry entry; adding a throwaway tile kind requires only a new module plus one registry line, with no edit to `level/Terrain.ts`, `engine/Physics.ts`, `engine/Standable.ts`, `engine/Renderer.ts`, `level/LevelParser.ts` or the editor palette.

**Acceptance Scenarios**:

1. **Given** the platformer theme, **When** a `TileType` member is looked up, **Then** it resolves to exactly one self-contained module under `tiles/` that owns that kind's draw and behaviour rules.
2. **Given** the tile-kind registry, **When** it is inspected, **Then** it maps every `TileType` and every author-placeable `TileChar` to its module, and it is exhaustive both at compile time and at runtime (a missing entry fails the build/test, never silently falls back).
3. **Given** a new tile kind, **When** it is added following the recipe, **Then** the only files edited are the new `tiles/` module and one registry line.

---

### User Story 2 - Tile rules live with the kind, not in scattered predicates (Priority: P1)

Today `level/Terrain.ts` holds `isSolid`/`isSolidExcludingBridge`/`isClimbable`/`isStandableLadderTop`/`isStandableLadderBundleTop`/`isStandableMushroomCap`, `engine/Physics.ts` hard-codes the bridge drop-through and crumbling-floor half-height special cases, and `engine/Standable.ts` composes the ground-term union by naming each special tile. After this feature each rule is declared by its tile kind's module, the registry is the single dispatch point, and `Physics.ts`/`Standable.ts`/`Terrain.ts` consume the registry instead of comparing tile types.

**Why this priority**: It removes the "smeared across five places" behaviour half of the problem and is what lets a future one-way or standable tile ship as one module.

**Independent Test**: Search `engine/Physics.ts`, `engine/Standable.ts` and `level/Terrain.ts` for bare `=== '<tileType>'` rule comparisons — they are gone (only registry lookups and generic grid reads remain); every existing behaviour predicate's observable result is unchanged.

**Acceptance Scenarios**:

1. **Given** a tile kind, **When** its solidity / climbability / standability / one-way behaviour is needed, **Then** it comes from that kind's module through the registry, not from a `switch`/`if` over tile types in an engine or level module.
2. **Given** the bouncy mushroom cap, the ladder shaft top, the rolled ladder bundle and the bridge, **When** each one-way/standable rule is exercised, **Then** the same cells are standable, the same cells are passable, and the bridge drop-through behaves identically to before.
3. **Given** a context-dependent rule (a ladder's standable top, a mushroom's standable cap, a cell's autotiled appearance), **When** the module declares it, **Then** the contract can express "this depends on the level and the cell's coordinate", not only the bare tile type.

---

### User Story 3 - A stateful tile declares its state; R-004 owns the lifecycle (Priority: P2)

Two shipped tiles carry transient runtime state: the bouncy mushroom's cosmetic cap squash (currently `entities/blocks/Mushroom.ts`, moving into its `tiles/` module) and the crumbling floor's crack/break/reform cycle (`engine/CrumblingFloor.ts`). Today that state lives in bespoke per-kind modules wired into `PlatformerState.ts` and the page tick. After this feature a stateful tile **declares** its transient state through its tile module (key shape, duration, prune/re-arm policy, phase/offset mapping, routed through R-004's shared `shared/timedTile.ts` core), while R-004 stays the sole owner of the collection/tick/reset lifecycle — the tile module does not grow a second lifecycle or a parallel store.

**Why this priority**: §3.5 makes "does the kind carry state?" a capability of one kind, not a second registry, and the issue explicitly defers the lifecycle to R-004. It is P2 because it follows the rule/draw extraction.

**Independent Test**: Inspect the stateful tiles' modules — each declares its state descriptor and delegates arm/advance/prune to `shared/timedTile.ts`; the only store, tick and reset remain the existing `PlatformerState.ts` signals and the R-004 core. No new signal, tick call or reset list is introduced by this feature.

**Acceptance Scenarios**:

1. **Given** the bouncy mushroom and the crumbling floor, **When** their modules are inspected, **Then** each declares its transient-state shape, duration and re-arm/prune policy, and neither re-implements arm/advance/prune boilerplate.
2. **Given** the game loop, **When** the tile state is advanced/reset, **Then** it still flows through the existing R-004-owned collection, tick and reset path, byte-for-byte as before.
3. **Given** a *stateless* tile kind, **When** it is registered, **Then** it declares no state capability and no state entry is created for it.

---

### User Story 4 - Appearance dispatches through the module (Priority: P2)

`engine/Renderer.ts`'s `drawTerrain` is a chain of per-tile `if` branches (`groundGrass` atlas path, `bush`, `fence`, `cobweb`, `crystalCluster`, `stalactite`, `stalagmite`, `torch`, the two mushrooms, the composited `chain` run) plus a `tileSource` `switch` with an exhaustiveness guard, and `engine/GroundAtlas.ts`/`engine/StaticObjectsCatalog.ts` hold the sprite tables. After this feature each tile kind's module owns its `draw`, the renderer dispatches to the registry, and the sprite tables a kind needs live with (or are reached by) that module — so adding a tile does not add a branch to the render loop.

**Why this priority**: This is the registry half R-009 consumes; leaving it out would keep the renderer a per-tile `switch` and fail the "one-module edit" goal.

**Independent Test**: Inspect `drawTerrain` — it iterates cells and dispatches to the tile module's `draw`, with no per-`TileType` branches; every tile renders pixel-identically to before, including grass autotiling, bush/tree runs, cobwebs, bridge run sprites, torches, both mushrooms, chain shafts and the crumbling floor.

**Acceptance Scenarios**:

1. **Given** the render loop, **When** a cell is drawn, **Then** the appearance comes from the cell's tile module `draw`, not from a per-tile branch in `drawTerrain` or a growing `tileSource` `switch`.
2. **Given** a multi-cell run kind (`chain`, `bush`, `bouncyMushroom`, `crumblingFloor`, `bridge`), **When** it draws, **Then** its run/compositing logic lives with its module and its output is unchanged.
3. **Given** a tile whose art depends on per-cell transient state (`crumblingFloor`, `bouncyMushroom`), **When** it draws, **Then** the module's `draw` receives the state it needs, at the same pipeline depth as today.

---

### User Story 5 - The restructuring is invisible (Priority: P1)

This is a pure restructuring of already-shipped code, so the acceptance bar is that nothing a visitor or a level author sees changes: every tile collides, stands, bounces, breaks and draws exactly as before; levels and blueprints parse identically; the editor preview and palette are unchanged; and the deployable ladder still unrolls the same shaft. The north-star folder tree does not include a `tiles/` folder, so this adds a new structural layer without changing behaviour.

**Why this priority**: It is the constraint that makes the refactor safe (the issue's "behaviour is byte-for-byte preserved") and the acceptance bar for every other story.

**Independent Test**: Run the full suite and build, then play a level exercising every tile axis (grass autotiling, rock, wall, bridge drop-through, ladder and chain climb and standable tops, the rolled ladder bundle, the bouncy mushroom cap bounce and squash, the crumbling floor cycle, torches, decor, fog) and diff against the pre-refactor build; separately confirm the editor preview and palette are untouched.

**Acceptance Scenarios**:

1. **Given** the same level data, **When** the game runs, **Then** tile collision, standability, one-way behaviour, bounce, crumbling timing, rendering and fog are unchanged in every observable respect.
2. **Given** the editor, **When** a tile is previewed or placed, **Then** behaviour and appearance are unchanged (the palette may still be rewired only by R-010).
3. **Given** the full test suite and the production build, **When** they run, **Then** they pass/succeed with only import-path and module-home edits — no test deleted, skipped or weakened.

---

### User Story 6 - Documented recipe for adding a tile (Priority: P3)

The "Adding a tile" recipe in `docs/themes/platformer/Terrain.md` currently lists ten steps across the union, char table, renderer, `tileSource`, predicates, `Physics.ts`, `GroundAtlas.ts`, the palette tables and tests. After this feature the recipe is one module plus one registry line, and the F-018 "open gap" note in that document is closed.

**Why this priority**: It is the payoff of the abstraction and directly requested; documentation carries no runtime risk and can land last.

**Independent Test**: Follow the recipe to add a throwaway tile kind with only a new module and one registry line; confirm it parses, renders, and reports the rules it declares, with no other edit.

**Acceptance Scenarios**:

1. **Given** the recipe, **When** a developer follows it, **Then** the only files they edit are the new tile module and one registry entry.
2. **Given** the recipe, **When** it is read, **Then** it names the tile module contract (draw, rule capabilities, state declaration), where the registry lives, and how the union/char table derive from it.
3. **Given** `docs/themes/platformer/Terrain.md`, **When** it is read, **Then** the "terrain kinds still do not own their own rules" open gap is recorded as closed by this feature.

---

### Edge Cases

- ✅ **A tile's rule depends on context, not just its type.** `isStandableLadderTop`, `isStandableLadderBundleTop`, `isStandableMushroomCap`, `neighbourMask`, `verticalRunRole`, `cobwebOrientation` and `isTopExposed` all read the level and a cell coordinate, and `isGrassSurface`/`bridgeRunPosition` select run sprites. The module contract MUST let a rule and a draw be `(level, col, row, context) => …`, not only `(tile) => …`; the pure-grid readers may stay in `level/Terrain.ts` and be imported by the modules.
- ✅ **`crumblingFloor` is solid only in part of its cell and only in some phases.** Its solid region is the top half (`CRUMBLING_FLOOR_SOLID_HEIGHT`) and it is non-solid while broken/reforming. The module contract MUST express both a per-phase solidity and a vertical inset, and `Physics.ts`'s ceiling branch and the horizontal wall scan MUST keep resolving at the same plane.
- ✅ **The bouncy mushroom's squash is cosmetic.** The squash dip never affects collision, standability or bounce strength (FR-011/FR-015 of O-018). Declaring it as transient state MUST NOT let it leak into any rule.
- ✅ **`chain` draws a whole run from its top cell** and `bouncyMushroom`/`bush` classify vertical runs; `bridge` and `crumblingFloor` pick horizontal run sprites. Run classification stays shared, but the per-kind selection lives with the kind's module and its output MUST be unchanged.
- ✅ **`ropeLadder` is not author-placeable.** It exists only in the effective grid `applyDeployedRopeLadders` derives from bundle state. The registry MUST cover it as a tile kind (it is climbable like `ladder`/`chain`) without exposing it as a palette/parse char.
- ✅ **`ladderBundle` and its deployed shaft are a grid object, not a plain tile.** The bundle's runtime deployment state and its `ladderBundle`/`ropeLadder` interaction are R-008's `WorldInteractableType`; R-015 only makes the tile-kind side of that interaction (standable-from-above, climbable `ropeLadder`) available through the registry and MUST NOT fold the deployment lifecycle into a tile module.
- ✅ **`empty` is a tile kind but not a placed decoration.** `tileAt` returns `'empty'` out of bounds; the registry MUST include it (or the dispatch MUST otherwise handle it) so exhaustiveness holds, without giving it any draw.
- ✅ **Markers are not tiles.** The tile meta layer (`MarkerEntry`) is separate; the registry and `tiles/` MUST NOT absorb markers, and `tileAt` must never return one.
- ✅ **Fog exemption is a second per-kind lookup.** `TILE_FOG_EXEMPT` is keyed by every `TileType`; it MUST stay exhaustive when the registry is the source of kinds, whether it moves onto the module or continues to derive from the registry.
- ✅ **The editor palette is consumed, not rewritten here.** R-010 owns palette unification; R-015 MUST expose a tile→module contract the palette can read, but MUST NOT change editor behaviour or build a second palette table. If R-010 has not landed, `paletteTiles.ts` stays as-is.
- ✅ **`STATIC_TILE_TYPES` never shipped.** R-009 deferred the draw registry to R-015 (its unmerged branch relocates the terrain path unchanged), so there is no legacy draw registry to preserve; R-015 creates the tile registry fresh and R-009 later consumes it.
- ✅ **No compatibility re-exports.** A former predicate, `tileSource` branch, or per-kind draw path MUST NOT survive as a thin alias or second dispatch path preserving the scattered structure. (A registry-delegating thin wrapper such as `level/Terrain.ts`'s `isSolid` → `isSolidTile` is permitted: it holds no per-kind logic and delegates to the one registry implementation — contract §3.)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A new `tiles/` layer MUST exist under `src/themes/platformer/` in which each shipped tile kind is one self-contained module owning (a) its `draw`, (b) its behaviour rules, and (c) any declared transient state.
- **FR-002**: A tile-kind registry MUST map every `TileType` (and every author-placeable `TileChar`) to its tile module. `TileType` and `TileChar`/`TERRAIN_CHARS` MUST be derived from the registry (e.g. `TileType = keyof typeof TILE_MODULES`) rather than declared as hand-maintained unions, so adding a kind is a module plus a registry line. The registry MUST be exhaustive against a **frozen list of the shipped kind names**: `satisfies Record<string, TileModule>` type-checks each entry and the FR-014 guard MUST assert the registry key set equals that frozen list, so removing a kind cannot silently shrink `TileType`. It MUST be the single source that drives the tile kind membership used by the rules, the renderer dispatch and the char table.
- **FR-003**: Adding or changing a tile MUST be one module edit plus at most one registry line. The "Adding a tile" recipe MUST collapse to that (see FR-015).
- **FR-004**: Tile behaviour rules MUST be owned by the kind's module and reached through the registry, replacing the scattered `isSolid`/`isSolidExcludingBridge`/`isClimbable`/`isStandable*` predicates and the bridge/crumbling special cases. `level/Terrain.ts`, `engine/Physics.ts` and `engine/Standable.ts` MUST consume the registry rather than compare `TileType` values directly for per-kind rules.
- **FR-005**: The module contract MUST express context-dependent rules and art as hooks over `(level, col, row, context)` — covering standable ladder tops, standable mushroom caps, standable bundles, autotiling/neighbour masks, and run-dependent sprites — not only a bare `(tile)` check.
- **FR-006**: Tile appearance MUST dispatch through the registry: `engine/Renderer.ts`'s terrain draw MUST iterate cells and invoke each kind's `draw` rather than branch on `TileType`, and the per-kind sprite tables MUST live with (or be reached from) the owning module.
- **FR-007**: A tile that carries transient state MUST declare that state through its module (key shape, duration, prune/re-arm policy and phase/offset mapping) using R-004's shared `shared/timedTile.ts` core. R-004's collection/tick/reset lifecycle MUST remain the sole lifecycle; no tile module MAY introduce a second lifecycle, parallel signal, tick call or reset list.
- **FR-008**: The tile registry MUST own the static-tile registry half of R-009's plan (the `STATIC_TILE_TYPES { key, draw }` idea, shipped as `TILE_MODULES` entries with `char` + `draw`); R-009 and R-008 and R-010 MUST be able to consume the registry/contract rather than build their own.
- **FR-009**: The tile-module contract MUST expose the palette read-model R-010 needs — per kind, `char` (where author-placeable), `fogExempt`, `drawBand` and whether it carries a `draw` hook, via `TILE_MODULES` — so R-010 can build the palette from the registry alone; R-015 MUST NOT change editor behaviour and MUST NOT build a competing palette registry. The guard asserts no second tile/palette table exists (SC-008).
- **FR-010**: Behaviour MUST be byte-for-byte preserved: tile rules, collision surfaces, standability, one-way behaviour, bounce, crumbling timing, appearance, sprite variants, tuning and level/blueprint data are unchanged. This is a restructuring of already-shipped code.
- **FR-011**: R-001's layer invariants MUST hold: `tiles/` MUST NOT introduce a `level/ → engine/` edge or an `engine/ → state/` edge, and `contracts/` MUST stay a leaf. `tiles/` MUST NOT import `engine/` (which would make `level/ → tiles/ → engine/` a transitive `level/ → engine/` path) and MUST NOT import `entities/`: tile-specific code currently in `entities/` (the bouncy-mushroom cap art and squash timer) moves into the tile module rather than being imported across. Any new mutual folder relationship (e.g. `level/ ↔ tiles/`, mirroring R-001's accepted `level/ ↔ entities/`) MUST be explicit and MUST NOT widen a forbidden edge.
- **FR-012**: No new tile kinds, gameplay, visuals, tuning, level data or editor behaviour MAY be introduced.
- **FR-013**: All existing tests MUST migrate (module home/import path only where that is all that changed) and pass; no test may be deleted, skipped or weakened. The production build MUST succeed.
- **FR-014**: An automated guard test MUST enforce the structural invariants of FR-002 (exactly one module per shipped tile kind; an exhaustive registry against the frozen kind list) and FR-004/FR-011/FR-018 (no remaining per-`TileType` rule branches in `engine/Physics.ts`, `engine/Standable.ts` or `level/Terrain.ts` beyond registry dispatch; no compatibility re-export; R-001's forbidden edges absent, plus no `tiles/ → entities/` or `tiles/ → engine/` edge). The guard MUST fail the suite if any invariant regresses.
- **FR-015**: The "Adding a tile" recipe in `docs/themes/platformer/Terrain.md` MUST be updated to the one-module-plus-one-registry-line form, and the F-018 "terrain kinds still do not own their own rules" open gap MUST be recorded as closed.
- **FR-016**: Markers (the tile meta layer) MUST remain outside the tile registry and `tiles/`; `tileAt` MUST never return a marker.
- **FR-017**: `chain`'s whole-run compositing, the vertical-run kinds (`bush`, `bouncyMushroom`), the horizontal-run kinds (`bridge`, `crumblingFloor`) and the `ropeLadder` effective-grid override MUST continue to work through the module contract with unchanged output.
- **FR-018**: No compatibility re-export, alias, or second code path MAY preserve a now-registry-dispatched per-tile rule, `tileSource` branch, or per-kind draw entry point. A registry-delegating thin wrapper in `level/Terrain.ts` (e.g. `isSolid` delegating to `isSolidTile`) is not a compatibility alias — it holds no per-kind logic.

### Key Entities

- **`tiles/` layer**: the new per-kind tile-module layer (the tile-side mirror of `entities/`'s one-folder-per-family pattern).
- **Tile module**: one per tile kind; owns the kind's `draw`, its behaviour rule hooks, and its declared transient state.
- **Tile-kind registry**: the exhaustive `TileType`/`TileChar` → tile-module map that drives kind membership, rules, draw dispatch and the char table.
- **Behaviour capability hooks**: the registry-reached rule hooks (solid, one-way/bridge exclusion, climbable, standable variants) replacing the scattered `isSolid`/`isClimbable`/`isStandable*` predicates.
- **Transient-state declaration**: a stateful kind's declared key shape/duration/re-arm/prune/phase mapping, routed through R-004's `shared/timedTile.ts` core; the lifecycle stays R-004's.
- **Static-tile draw registry**: the `{ key, draw }` dispatch R-009's plan named, now owned here.
- **Shared grid readers**: `tileAt`, geometry constants, `neighbourMask`, run helpers — pure level-side primitives the tile modules reuse.
- **R-004 lifecycle** and **R-001 contracts**: the external shipped contracts this feature consumes and must not widen.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — One module per kind**: every shipped `TileType` resolves to exactly one module under `tiles/` and exactly one registry entry; the registry key set equals the frozen list of the 19 shipped kind names (so a search finds zero shipped kinds without a module and zero duplicate registrations even though `TileType` is derived).
- **SC-002 — Adding a tile is one module plus one registry line**: adding a throwaway tile kind touches only a new module and one registry entry — zero edits to `level/Terrain.ts`, `engine/Physics.ts`, `engine/Standable.ts`, `engine/Renderer.ts`, `level/LevelParser.ts`, `level/LevelData.ts` or the editor palette.
- **SC-003 — No scattered rule branches remain**: a search of `engine/Physics.ts`, `engine/Standable.ts` and `level/Terrain.ts` finds no remaining per-`TileType` rule comparison outside the registry dispatch (the machine-checkable form of FR-004; the two exempt run classifiers are `bridgeRunPosition`/`chainRunLength`).
- **SC-004 — One lifecycle**: the stateful tiles declare their state through their modules and still flow through the existing R-004-owned collection/tick/reset; a search finds no new signal, tick call or reset list introduced by this feature.
- **SC-005 — Behaviour preserved**: the full test suite passes and the production build succeeds; a manual browser pass over a level exercising grass autotiling, rock/wall, bridge drop-through, ladder/chain climb and standable tops, the rolled ladder bundle, the bouncy mushroom bounce/squash, the crumbling floor cycle, torches, decor and fog shows no visible or behavioural difference; the editor preview and palette are unchanged.
- **SC-006 — Layers intact**: a dependency inspection finds no new `level/ → engine/` edge, no new `engine/ → state/` edge, no `tiles/ → entities/` edge, and `contracts/` still a leaf; the FR-014 guard test fails the suite if any of these regress.
- **SC-007 — Recipe collapses and the gap closes**: the documented "Adding a tile" recipe is one module plus one registry line (demonstrated by SC-002), and `docs/themes/platformer/Terrain.md` records the F-018 gap as closed.
- **SC-008 — Downstream registry is consumable**: R-009's static-tile registry half and R-010's palette can both read the tile-module contract without introducing a competing registry (verified by the contract exposing per-kind `char`/`fogExempt`/`drawBand`/`draw` and by the absence of a second tile table).

## Assumptions

- **`tiles/` sits beside `entities/` as a peer layer (confirmed 2026-09-27).** The issue offers "beside `entities/`" or "absorbs the terrain pieces of `level/`". This spec takes the peer-folder default, matching the issue's "tile-side mirror of the `entities/` one-folder-per-family pattern": the pure grid readers (`tileAt`, geometry, `neighbourMask`, run helpers) stay in `level/` and tile modules import them; `TileType`/`TileChar` are derived from the registry (`level/` imports `tiles/` for that derivation, the accepted mutual edge). This creates an accepted `level/ ↔ tiles/` mutual folder relationship mirroring R-001's accepted `level/ ↔ entities/`; it MUST NOT widen a forbidden edge. The exact folder name and registry module are planning decisions; the one-module-per-kind and exhaustive-registry rules are not.
- **`tiles/` imports no `entities/` (confirmed 2026-09-27).** Tile-specific code that currently lives in `entities/` — the bouncy-mushroom cap art and squash timer in `entities/blocks/Mushroom.ts` — moves into its tile module, so the tile layer is self-contained and the only mutual relationship is the accepted `level/ ↔ tiles/`.
- **Context-dependent rules are expressed as hooks (confirmed 2026-09-27).** Following §3.5 (a tile is a stateless grid value whose behaviour is derived from its type and neighbours), a kind's rules and draw take the level and cell coordinate; the contract need not model identity or per-instance state for stateless kinds.
- **Transient state is declared by the kind, owned by R-004.** Per the issue and §3.5, "the grid object declares its state and R-004 owns its lifecycle". The mushroom squash deliberately stays out of the transient-effect registry (the exclusion recorded with R-004's timed-tile core) and continues to route through the shared timed-tile core; the crumbling floor likewise. R-015 MUST NOT create a second timed-tile framework.
- **The passive/active split is a capability, not two registries.** A kind either declares state or it does not; there is one registry, not a passive registry plus an active registry.
- **`STATIC_TILE_TYPES` never shipped.** R-009's implementation deferred it to R-015, so R-015 creates the tile registry and R-009 later consumes it rather than the reverse.
- **The `ropeLadder` kind is registry-covered but not palette/parse-exposed.** It is a tile kind produced only by the effective grid; the registry includes it for rule/draw exhaustiveness while the char/palette surface continues to exclude it.
- **Behaviour is byte-for-byte preserved; no data migration.** The only sanctioned changes are the module extraction, the registry, the dispatch rewiring, and import retargeting — never a change to gameplay, tuning, art, level data or editor behaviour.
- **The editor palette rewiring is R-010.** R-015 exposes the contract and leaves `paletteTiles.ts` behaviour untouched; R-010 consumes it and MUST NOT build a competing tile registry.
- **Tests are the safety net.** The existing `Terrain`/`Physics`/`Standable`/`Renderer`/`GroundAtlas`/`StaticObjectsCatalog`/`Mushroom`/`CrumblingFloor`/`LevelParser`/`paletteTiles` tests are the behavioural contract; they migrate with their modules and are extended by the FR-014 guard test.
- **Layer invariants continue to hold.** `contracts/` stays a leaf; `level/` never reaches into `engine/`; `engine/` never imports state (R-001).

## Out of Scope

- The `SceneRenderer`/`HudRenderer` split — **R-009**; it consumes this feature's static-tile registry and does not rebuild it.
- Mapper/editor unification and the editor palette rewrite — **R-010**; it consumes the tile-module contract for the palette and must not build a competing registry.
- The `WorldItemType`/`DeployableItemType` placeable-world-item unification and the bomb subsystem — **R-008**; the deployable ladder consumes the tile contract but the deployment lifecycle stays there.
- Registry-dispatch completion (`onDefeat`, `onCollect`, counter metadata) — **R-007**; the grid-object/actor split beyond the stateless-tile end rides with R-007/R-008/R-015 and is not settled here.
- Per-domain state stores and the `PlatformerState.ts`/`PlatformerPage.tsx` decomposition — **R-011/R-012**.
- Sprite asset/atlas organisation — **R-013**.
- The layer-boundary lint guard — **R-014**.
- New tile kinds, gameplay, visuals, tuning, level data or editor behaviour.
- The wider `engine/render/` + `features/` folder reorganisation (F7) beyond creating `tiles/`.
