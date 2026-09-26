# Feature Specification: Platformer Renderer Split

**Feature Branch**: `R-009-platformer-renderer-split`

**Created**: 2026-09-26

**Status**: Draft

**Input**: GitHub issue #97 — "R-009: Platformer Renderer Split". Split the platformer's ~1,900-line `engine/Renderer.ts` into a scene/world renderer (`SceneRenderer`) and a HUD/screen renderer (`HudRenderer`); collapse the four per-kind HUD counters and their width/X helpers into one generic `drawHudCounter`; consume the already-generic `drawPickups` (R-006) and R-015's stateless-tile draw registry rather than adding a second dispatch; change no visible pixel.

**Depends on**: [R-003 Platformer Abstract Light Sources](../R-003-platformer-abstract-light-sources/spec.md) (shipped: the `LightSource` abstraction and the lighting passes that replaced the per-kind `torches`/`playerLight` special cases), [R-004 Platformer Transient Effect Registry](../R-004-platformer-transient-effect-registry/spec.md) (shipped: the transient-effect registry and its `engine/effects/drawEffects.ts` draw passes, so the effect draws are already out of `Renderer.ts`), [R-006 Platformer Pickup Unification](../R-006-platformer-pickup-unification/spec.md) (shipped: the generic `drawPickups` with per-kind `drawLayer`, which this feature consumes as the single pickup pass), [R-007 Platformer Registry Dispatch Completion](../R-007-platformer-registry-dispatch-completion/spec.md) (shipped: `drawBlocks`/`drawEnemies`/`drawHazards` reached through their registries rather than per-kind draw branches), [R-008 Platformer Placeable World Items](../R-008-platformer-placeable-world-items/spec.md) (shipped: `drawDeployableItems` with per-kind `drawLayer` bands and the registry-backed chest/bomb/ladder draws), and [O-014 Background Tile Rework](../O-014-platformer-background-tiles/spec.md) (shipped: the background-tile draw pass and its material-family lookup).

**Pending dependency**: [R-015 Platformer Tile Module Registry](https://github.com/garcipat/cv-website/issues/111). Phase 3's tile registry owns the stateless terrain draw dispatch (`STATIC_TILE_TYPES`-style `draw`) and the `tileSource` + `drawTerrain` collapse (including the 12-parameter signature). R-009 MUST NOT build a second tile registry; it consumes R-015's registry where the terrain path is concerned and otherwise relocates that path unchanged.

**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 7 (renderer split), finding **L1** (`Renderer.ts` is a god module that knows every concrete entity/decor type — the registry half now lands in R-015, the renderer-split half is this feature), **L6** (`GroundAtlas`/`BackgroundAtlas` near-duplicates — already resolved in Phase 0 and only preserved), finding **D9** (HUD composition hardcoded by kind — the HUD *model* stays with R-012; this feature only separates the HUD drawing module), the north-star abstractions one-line sketches (`SceneRenderer`/`HudRenderer`), and the proposed folder tree §4.1 (`engine/render/Renderer.ts → SceneRenderer / HudRenderer`).

## Clarifications

### Session 2026-09-26

- Q: After the four per-kind counter drawers and their helpers are collapsed into one generic counter, how should the key-collection flying-text popup learn where the key counter sits (today it calls `keyCounterX` outside the render loop, ~`PlatformerPage.tsx:1334`, asserted in `PlatformerPage.test.tsx`)? → A: Expose the generic counter's measurement and X-chaining functions publicly; the flying-text target and its tests call the generic form exactly as they call `keyCounterX` today.
- Q: Should the generic counter descriptor carry an explicit icon advance width so the one drawer and one measurer reproduce both the cropped-sheet counter's fixed 32px slot and the standalone-image counters' intrinsic scaled width? → A: Yes — the descriptor carries an explicit icon advance width (the layout slot text starts after and the width measurer uses); the cropped-sheet counter uses the fixed slot, standalone-image counters use their intrinsic scaled width.
- Q: When the production renderer module is split, should the ~3,800-line `Renderer.test.ts` be split to mirror the new module files or stay as one file with only its import updated? → A: Split the tests to mirror the modules — move each describe block to the test file beside the renderer it covers (plus a shared test file only if needed), assertions unchanged.
- Q: Should the two structural invariants — neither renderer imports the other (FR-001) and no per-kind counter drawer remains (FR-005/SC-002) — be enforced by an automated guard test or only by manual search/review? → A: Add an automated guard test that fails if either invariant regresses; SC-001/SC-002 are backed by it rather than manual-only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The world and the HUD each have their own renderer module (Priority: P1)

Today a single `engine/Renderer.ts` holds two unrelated jobs. It owns every world-space pass — background tiles, terrain, deployable items, signs, pickups, blocks, hazards, crumbling floors, checkpoints and their twinkles, the player, the held torch, the water foreground, fog, darkness and enemy eyes — and it *also* owns every screen-space pass — the hearts row, the four counter groups, the low-health glow, the iris overlay and the restart prompt. Every consumer (`PlatformerPage.tsx`, `EditorCanvas.tsx`, the tests) imports from that one file no matter which half it needs. After this feature the world passes live in a scene renderer and the HUD passes live in a HUD renderer, with only genuinely shared drawing helpers in a common home, and neither renderer imports the other.

**Why this priority**: This is the issue's headline instruction ("split `Renderer.ts` into `SceneRenderer` + `HudRenderer`") and the L1 renderer-half finding. It is the structural prerequisite for R-012's HUD model extraction and for the `engine/render/` grouping in the target tree.

**Independent Test**: Search the theme for the old combined module — it no longer exists as the home of both jobs. Confirm every world-space draw is exported by the scene renderer and every screen-space draw by the HUD renderer, that the two modules do not import each other, and that `PlatformerPage.tsx`/`EditorCanvas.tsx`/the tests import each symbol from the correct module.

**Acceptance Scenarios**:

1. **Given** the scene renderer, **When** its exports are inspected, **Then** it owns the world-space passes (background tiles, terrain, deployable items, signs, pickups, blocks, hazards, crumbling floors, checkpoints, checkpoint twinkles, player, held torch, water foreground, fog, darkness, enemy eyes) and exposes no hearts/counter/iris/restart/low-health HUD pass.
2. **Given** the HUD renderer, **When** its exports are inspected, **Then** it owns the screen-space passes (hearts, the persistent counters, low-health glow, iris overlay, restart prompt) and exposes no world-space pass.
3. **Given** both modules, **When** their import graphs are inspected, **Then** neither imports the other, and anything they genuinely share (a colour/alpha helper, a source-rect helper, a HUD position constant) lives in a common home rather than being copied.
4. **Given** the page's render loop, **When** a frame is drawn, **Then** the page calls scene passes from the scene renderer and HUD passes from the HUD renderer in exactly today's order.

---

### User Story 2 - One generic counter draws every persistent HUD counter (Priority: P1)

Today four near-identical counter drawers coexist — `drawCollectibleCounter`, `drawChestCounter`, `drawKeyCounter`, `drawBombCounter` — plus four layout helpers (`chestCounterWidth`, `keyCounterX`, `keyCounterWidth`, `bombCounterX`). They differ only in the icon source (a cropped frame of a shared sheet versus a standalone image at its own aspect ratio), an optional vertical nudge and icon size, whether the text is `N / M` or just `N`, and the text gap. After this feature ONE generic counter drawer plus a declarative counter descriptor covers every persistent counter, and the X-position of each counter is derived from the measured width of the previous generic counter. The page names no counter kind in its HUD path.

**Why this priority**: It is the issue's "generic `drawPickups` + `drawHudCounter` replace the per-kind wrappers" instruction, and it is what makes the HUD renderer more than a file move — without it the HUD half is still a per-kind dispatch.

**Independent Test**: Search the theme for the per-kind counter drawers and the width/X helpers — they are gone, replaced by one generic counter drawer plus one width measurer. Confirm the chest, key and bomb counters still appear at the same positions with the same text, that the chest→key→bomb X-chaining still matches today at every digit count, and that no caller names a counter kind.

**Acceptance Scenarios**:

1. **Given** a counter descriptor, **When** it is drawn through the generic counter, **Then** it can express both icon geometries (a cropped sheet frame with an optional y-offset and display size, and a standalone image scaled to a target height), both text formats (`N / M` and bare `N`), and a per-counter text gap.
2. **Given** the page's HUD path, **When** the chest, key and bomb counters render, **Then** each is built from a descriptor and drawn by the one generic counter, and the key/bomb X positions chain off the measured width of the preceding generic counter exactly as today.
3. **Given** a counter whose group is hidden at zero (the key and bomb groups), **When** the count is zero, **Then** the group is not drawn and the following group keeps today's position, exactly as `keyCounterX`/`bombCounterX` compute it.
4. **Given** a search of the HUD renderer, **When** it is inspected, **Then** no per-kind counter drawer or per-kind width/X helper remains as a second path.

---

### User Story 3 - The scene renderer consumes the pickup and tile registries instead of per-kind wrappers (Priority: P2)

The pickup half is already a registry after R-006: one `drawPickups` dispatches each pickup kind to its own `draw` at its own draw band, and the renderer holds no per-kind pickup wrapper. The terrain half is not: `tileSource` and `drawTerrain` still branch per tile kind, with `drawTerrain` taking twelve positional parameters. R-015 owns the stateless-tile registry that folds those into `STATIC_TILE_TYPES[tile].draw(...)` and collapses the parameter list. After this feature the scene renderer's pickup pass is R-006's single `drawPickups` and its terrain pass consumes R-015's tile registry — the renderer holds no tile-kind dispatch of its own.

**Why this priority**: It is the issue's explicit "consume the R-015 registry rather than building its own" boundary and completes the L1 registry story for the renderer half. It is P2 rather than P1 because the module split and the generic counter can land independently of whether R-015 has merged.

**Independent Test**: Search the scene renderer for per-kind pickup draw wrappers (there must be none — `drawPickups` is the one pass). Then check the terrain path: it either consumes R-015's tile registry (if R-015 has landed) or is the existing `tileSource`/`drawTerrain` relocated unchanged, and in neither case is there a renderer-local tile registry.

**Acceptance Scenarios**:

1. **Given** the scene renderer, **When** pickups are drawn, **Then** R-006's single `drawPickups` is the only pickup pass and no `drawKeyPickups`/`drawHeartPickups`/`drawBombPickups`/`drawBonusFruits`-style wrapper exists.
2. **Given** R-015 has landed, **When** terrain is drawn, **Then** the scene renderer dispatches through R-015's tile registry and no `tileSource`/`drawTerrain` per-kind branch remains in the renderer.
3. **Given** R-015 has not landed, **When** terrain is drawn, **Then** the existing `tileSource`/`drawTerrain` path is relocated unchanged (same signature and output) and no second tile registry is introduced.

---

### User Story 4 - The migration is invisible in-game (Priority: P1)

This is a refactor of already-shipped rendering, so the acceptance bar is that nothing the visitor sees changes: the same terrain, background, signs, pickups, blocks, hazards, crumbling floors, checkpoints, player, held torch, water, fog, darkness and enemy eyes at the same depths in the same order; the same hearts, counters, low-health glow, iris and restart prompt at the same positions. Draw order is the fragile part: the page interleaves scene and HUD bands (terrain-level deployables, pickups below blocks, bombs after blocks, chest after crumbling floors, effects between the world bands, then the HUD), and a split that moves a pass into the wrong module or changes a call site's order can visibly shift depth.

**Why this priority**: It is the acceptance bar for every refactor in this phase and the verification story that runs last over the combined change.

**Independent Test**: Play a level and a level editor preview against the pre-refactor build and compare visually: cave darkness and torch pools, fog, water, checkpoints, the counter row at 0/1/multi-digit totals, the key/bomb group hiding at zero, low health, death iris and restart prompt. Separately unit-test each relocated draw and the generic counter.

**Acceptance Scenarios**:

1. **Given** the game render loop, **When** a frame renders, **Then** every pass runs at exactly the depth and order it occupies today relative to terrain, background tiles, signs, deployables, pickups, blocks, hazards, crumbling floors, checkpoints, the player, fog, darkness, enemy eyes and the HUD.
2. **Given** the editor preview, **When** a frame renders, **Then** the terrain, background, signs, deployables, darkness, enemy eyes and held-torch passes are identical to today.
3. **Given** the persistent HUD, **When** the chest/key/bomb groups render at varying totals, **Then** the icons, text, spacing and positions are pixel-identical to today, including the group-hiding rules at zero.
4. **Given** the existing renderer, page, HUD and editor tests, **When** they run after the change, **Then** their assertions are unchanged except for module/import changes, and the production build succeeds.

---

### Edge Cases

- ✅ **A pass is both "world" and "HUD".** The low-health glow, iris overlay and restart prompt are screen-space overlays drawn with the HUD elements, not world objects; the hearts row and counters are HUD. The split must place all of these in the HUD renderer. The debug overlay is already its own module (`DebugOverlay.ts`) and stays there.
- ✅ **Helpers are not actually shared across the two renderers.** No drawing helper is imported by both new modules: `drawTintedSprite` and `withAlpha` are scene-only, and the outlined-text helpers (`fillTextWithOutline`, `RESTART_PROMPT_FONT_FAMILY`) already live in `engine/textDraw.ts`, shared by the HUD renderer and the R-004 effect modules. A duplicated helper would be a second path; anything genuinely shared lives in one home (`textDraw.ts`, or a new `engine/render/renderHelpers.ts` if ever needed), never copied into both modules.
- ✅ **HUD constants keep their values; only their home moves.** The page imports `HEARTS_START_X`, `CHEST_COUNTER_X`, `CHEST_COUNTER_Y`, `KEY_COUNTER_Y`, `RESTART_PROMPT_FONT_URL` and the descriptor constants `CHEST_COUNTER_ICON_HEIGHT`, `CHEST_COUNTER_TEXT_GAP`, `KEY_COUNTER_ICON_HEIGHT`, `BOMB_COUNTER_ICON_HEIGHT`; the tests import `LOW_HEALTH_GLOW_WIDTH_PX`, `LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS`, `CHEST_COUNTER_ICON_HEIGHT`, `CHEST_COUNTER_TEXT_GAP`, `HEARTS_START_X`, `KEY_COUNTER_Y`; `HUD_GROUP_GAP` is exported but imported by neither today (value-stable). Their exact values must not change and the importable ones must stay importable; only their module home may move.
- ✅ **The chest→key→bomb X chain depends on measured text width.** The key X is the chest X plus the chest counter's *measured* width plus the gap, and the bomb X adds the key counter's measured width only while keys are shown. The generic counter's width measure must reproduce this, including the key-hidden case.
- ✅ **A counter is currently production-dead.** `drawCollectibleCounter` is exported and tested but has no production caller (the modern persistent HUD is chest/key/bomb; coin/fruit/enemy/crate appear as transient popups owned by R-004). Folding it into the generic counter is allowed and expected; its tests must be covered by the generic counter's tests rather than left asserting a removed symbol.
- ✅ **The `drawTerrain` signature is twelve positional parameters.** R-015 owns collapsing it to a context object. If R-015 has not landed, R-009 must not partially collapse it; the signature moves unchanged.
- ✅ **`drawHudCounter` must not become a giant options bag with per-kind branches.** The descriptor must be declarative data (icon source and sizing, text, gap), not a `switch` on a counter name inside the generic drawer.
- ✅ **The split must not introduce a forbidden import edge.** The renderer modules stay in the engine layer: no `level/ → engine/`, and no `engine/ → state/`. State stays wired by the page; the renderers receive plain values.
- ✅ **A non-draw consumer needs a counter's on-screen X.** The key-collection flying-text effect target (`PlatformerPage.tsx`, ~line 1334) and `PlatformerPage.test.tsx` call `keyCounterX` outside the render loop; the generic counter's measure/X-chain functions stay exported and the target calls the generic form with the same chest values, so the popup still lands on the key counter.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `engine/Renderer.ts` MUST be split into a scene/world renderer module and a HUD/screen renderer module. The combined module MUST no longer exist as the home of both jobs. The two modules MUST NOT import each other.
- **FR-002**: The scene renderer MUST own every world-space draw pass currently in `Renderer.ts`: background tiles, terrain, deployable items, signs, pickups, blocks, hazards, crumbling floors, checkpoints, checkpoint twinkles, the player, the held torch, the water foreground, fog, darkness and enemy eyes.
- **FR-003**: The HUD renderer MUST own every screen-space draw pass currently in `Renderer.ts`: the hearts row, every persistent counter, the low-health glow, the iris overlay and the restart prompt.
- **FR-004**: Drawing helpers and constants genuinely shared by both renderers MUST live in ONE common home and MUST NOT be duplicated. HUD constants MUST keep their exact values, stay importable by every current consumer, and move only their module home: the page imports `HEARTS_START_X`, `CHEST_COUNTER_X`, `CHEST_COUNTER_Y`, `KEY_COUNTER_Y`, `RESTART_PROMPT_FONT_URL` and the descriptor constants `CHEST_COUNTER_ICON_HEIGHT`, `CHEST_COUNTER_TEXT_GAP`, `KEY_COUNTER_ICON_HEIGHT`, `BOMB_COUNTER_ICON_HEIGHT`; the tests import `LOW_HEALTH_GLOW_WIDTH_PX`, `LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS`, `CHEST_COUNTER_ICON_HEIGHT`, `CHEST_COUNTER_TEXT_GAP`, `HEARTS_START_X`, `KEY_COUNTER_Y`; `HUD_GROUP_GAP` is imported by neither today but MUST stay a value-stable shared constant.
- **FR-005**: Exactly ONE generic HUD counter drawer MUST replace the per-kind counter drawers (`drawCollectibleCounter`, `drawChestCounter`, `drawKeyCounter`, `drawBombCounter`). Its input MUST be declarative descriptor data covering: the icon (a cropped sheet frame with optional source rect/size and an optional y-offset and display size, OR a standalone image scaled to a target height), that icon's explicit advance width (the layout slot the text starts after and the width measurer uses — the cropped-sheet counter advances by its fixed slot, standalone-image counters by their intrinsic scaled width), the text format (with an optional denominator, i.e. `N / M` or `N`), and the icon-to-text gap. The drawer MUST NOT branch on a counter kind, and the drawer and the single width measurer (FR-006) MUST read the same advance width rather than re-deriving it.
- **FR-006**: Exactly ONE generic counter width measurer and ONE generic X-chain function MUST together replace the per-kind width/X helpers (`chestCounterWidth`, `keyCounterX`, `keyCounterWidth`, `bombCounterX`). The page MUST build each persistent counter from state as a descriptor and draw it through the generic path, computing the next counter's X from the preceding generic counter's measured width plus the shared gap, preserving today's group-hiding rule (the key and bomb groups draw only above zero, and a hidden group does not advance the next X). The generic measurement and X-chaining functions MUST stay exported so non-draw consumers that need a counter's on-screen position — notably the key-collection flying-text target in `PlatformerPage.tsx` and its tests — obtain it through the generic helpers rather than a removed per-kind helper.
- **FR-007**: The single pickup draw pass MUST be R-006's generic `drawPickups` (called at its existing per-kind `drawLayer` bands). No per-kind pickup draw wrapper may exist in the scene renderer.
- **FR-008**: The terrain draw pass MUST consume R-015's stateless-tile draw registry once R-015 has landed — the scene renderer MUST NOT hold a renderer-local tile-kind dispatch. If R-015 has not landed, the existing `tileSource`/`drawTerrain` path MUST be relocated unchanged (same signature, output and parameter list). In no case may R-009 introduce a second tile registry.
- **FR-009**: The old combined `Renderer.ts` MUST be removed and all consumers (`PlatformerPage.tsx`, `EditorCanvas.tsx`, `Journal.tsx` comments, and every test) MUST be updated to import each symbol from the renderer that owns it. No compatibility barrel, alias or re-export MAY preserve the old single module's dual role.
- **FR-010**: Player-visible rendering MUST be preserved exactly: every pass's draw order and depth, every HUD position and spacing, every drawing constant value, the counter text and group-hiding rules, and the editor preview output MUST be unchanged. No new render pass, art, layout or tuning change is allowed.
- **FR-011**: All existing tests MUST migrate and MUST pass; assertions MUST be unchanged wherever only a module home or import path changed, and tests for a consolidated symbol MUST be rewritten against the generic form, never weakened, skipped or deleted. The ~3,800-line `Renderer.test.ts` MUST be split to mirror the new module files — each renderer's tests in a test file beside the renderer they cover (plus a shared test file only if genuinely needed) — moving describe blocks without changing their assertions. The production build MUST succeed.
- **FR-012**: The change MUST NOT widen R-001's forbidden edges: `contracts/` stays a leaf, no new `level/ → engine/`, and no new `engine/ → state/`. The renderer modules stay engine-layer and receive plain values; the page keeps the state wiring.
- **FR-013**: Whether the two renderer modules live flat under `engine/` or under a render grouping such as `engine/render/` (analysis §4.1, F7) is a planning decision; the module responsibilities and names (`SceneRenderer`, `HudRenderer`) and the no-cross-import and no-per-kind-dispatch rules are requirements. Moving the atlases/catalogs into that grouping is out of scope (F7, not this feature).
- **FR-014**: `drawHudCounter` MUST remain general enough that a future counter with a new icon or text format is a new descriptor and call site, not a new drawer; and the scene renderer MUST remain free of HUD knowledge. No new counter kind, HUD element or gameplay is introduced by this refactor.
- **FR-015**: An automated guard test MUST assert the two structural invariants this split creates: the scene renderer and the HUD renderer do not import each other, and none of the removed per-kind counter drawers or width/X helpers exists as a separate production path. The guard MUST fail the suite if either invariant regresses (backing SC-001/SC-002 rather than relying on manual search alone).

### Key Entities

- **Scene renderer (`SceneRenderer`)**: the module owning all world-space draw passes; consumes R-006's `drawPickups`, the block/enemy/hazard/deployable registries, the lighting/effect outputs (R-003/R-004) and R-015's tile registry, and receives plain values from the page.
- **HUD renderer (`HudRenderer`)**: the module owning all screen-space draw passes (hearts, counters, low-health glow, iris, restart prompt); owns the shared HUD position constants.
- **Shared render helpers**: the common home for the few drawing helpers/constants both renderers need (e.g. the tinted-sprite/alpha helper and the HUD position constants), so neither module copies the other's code.
- **Generic HUD counter descriptor**: the declarative data describing one persistent counter — icon source/sizing, an explicit icon advance width, optional y-offset, text (optionally with a denominator) and text gap — consumed by the one `drawHudCounter` and the one width measurer, which both read the same advance width.
- **R-006 `drawPickups`**: the shipped generic pickup pass, consumed unchanged as the single pickup draw.
- **R-015 tile registry**: the pending stateless-tile draw dispatch consumed by the terrain pass; not built here.

## Success Criteria *(mandatory)*

- **SC-001**: A search of the theme finds the world passes and the HUD passes in two separate modules, no combined module holding both, and no import edge between the two renderer modules — enforced automatically by FR-015's guard test.
- **SC-002**: A search finds exactly one generic HUD counter drawer plus one generic width measurer/X-chain pair; `drawCollectibleCounter`/`drawChestCounter`/`drawKeyCounter`/`drawBombCounter`/`chestCounterWidth`/`keyCounterX`/`keyCounterWidth`/`bombCounterX` no longer exist as separate production paths — enforced automatically by FR-015's guard test.
- **SC-003**: A search finds R-006's `drawPickups` as the only pickup pass in the scene renderer, and either a consuming call into R-015's tile registry or the relocated-but-unchanged `tileSource`/`drawTerrain` path — with no renderer-local tile registry either way.
- **SC-004**: The full test suite passes and the production build succeeds, satisfying FR-010's behaviour-preservation bar.
- **SC-005**: A manual browser pass over the game and the editor preview confirms no visible change: darkness/torch pools, fog, water, checkpoints, counter positions at zero/one/multi-digit totals, the key/bomb group-hiding, low health, death iris and restart prompt.
- **SC-006**: R-001's forbidden edges are not widened (`contracts/` still a leaf, no new `level/ → engine/` or `engine/ → state/`).
- **SC-007**: Adding a persistent counter is a new descriptor and call site only, and adding a world pass touches only the scene renderer — neither requires editing the other renderer.

## Assumptions

- **The exact module paths are planning decisions; the responsibilities are not.** The issue names `SceneRenderer` + `HudRenderer`; the analysis §4.1 places them under `engine/render/`. Whether the flat `engine/` files or the `engine/render/` grouping land now is left to planning, but the two responsibilities, the module names, the no-cross-import rule and the no-per-kind-dispatch rule are fixed. Moving the atlases and catalogs into the grouping is F7 work and out of scope.
- **The generic counter must cover all four existing drawers, including the production-dead `drawCollectibleCounter`.** All four currently live in `Renderer.ts` and are exported/tested; the issue says the generic counter replaces the per-kind wrappers. `drawCollectibleCounter` has no production caller (the persistent HUD is chest/key/bomb; coin/fruit/enemy/crate are R-004 popups), so folding it in is straightforward, and its tests must be re-expressed against the generic counter rather than left asserting a removed symbol.
- **The counter descriptor is declarative data, not an options bag with kind branches.** The four drawers differ only in icon geometry/sizing, an optional y-offset, the text format and the text gap; the generic drawer expresses those as data so a new counter is a descriptor, not a new drawer (FR-005/FR-014).
- **HUD constants keep their values; only their home moves.** `PlatformerPage.tsx` reads `HEARTS_START_X`, `CHEST_COUNTER_X`, `CHEST_COUNTER_Y`, `KEY_COUNTER_Y`, `RESTART_PROMPT_FONT_URL` and the descriptor constants `CHEST_COUNTER_ICON_HEIGHT`, `CHEST_COUNTER_TEXT_GAP`, `KEY_COUNTER_ICON_HEIGHT`, `BOMB_COUNTER_ICON_HEIGHT`; the tests read `LOW_HEALTH_GLOW_WIDTH_PX`, `LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS`, `CHEST_COUNTER_ICON_HEIGHT`, `CHEST_COUNTER_TEXT_GAP`, `HEARTS_START_X` and `KEY_COUNTER_Y`; `HUD_GROUP_GAP` is exported but imported by neither today. Every value is unchanged (FR-004).
- **Low-health glow, iris overlay and restart prompt are HUD/screen passes.** They render in screen space alongside the HUD and move with the HUD renderer. The debug overlay and camera dead-zone overlay stay in `DebugOverlay.ts`.
- **Effect draws stay in R-004's `engine/effects/drawEffects.ts`.** The transient-effect draw passes already left `Renderer.ts`; this feature does not move them and does not merge them into either renderer.
- **R-015 is a pending dependency, not a blocker for the split.** The module split and the generic counter land independently of the tile registry. The terrain path either consumes R-015's registry if it has landed or is relocated unchanged; R-009 never builds a tile registry.
- **The page keeps the orchestration.** Draw order is preserved by keeping the page's call sequence intact while updating which module each symbol comes from; this feature does not extract a HUD model or move pass ordering into the renderers (that is R-012/D9).
- **Layer invariants continue to hold.** `contracts/` stays a leaf; the renderers are engine-layer and import from `contracts/`, `level/` value helpers and the entity registries only as `Renderer.ts` does today; no `engine/ → state/` edge is added.
- **Player-visible behaviour is preserved exactly; only structure moves.** The sanctioned changes are the two-renderer split, the shared-helper home, and the generic counter — never a change to draw order, depth, positions, spacing, counters, text, or editor preview output.
- **No data migration.** Shipped levels, sprites, tuning and translations are unchanged; only TypeScript module homes, imports and the counter API move.

## Out of Scope

- The stateless tile-module registry, the `STATIC_TILE_TYPES`-style tile draw dispatch, the `tileSource`/`drawTerrain` fold and the 12-parameter signature collapse — **R-015**.
- The HUD model and the page's hardcoded popup-label/counter composition extraction (finding D9) — **R-012**; this feature only separates the HUD drawing module and generalises the persistent counter.
- The `GroundAtlas`/`BackgroundAtlas` near-duplicate merge (L6) — already Phase 0/R-002.
- The `engine/render/` folder grouping for the atlases, catalogs and layer modules (F7) — except for wherever the two renderer modules themselves land, decided in planning.
- Per-domain state stores, `PlayerDamageSystem`, `BombSystem`, `AssetLoader` and the other god-file decompositions — **R-011/R-012**.
- The transient-effect registry and its draw passes — **R-004** (already shipped).
- Mapper/editor unification — **R-010**; sprite asset/atlas organisation — **R-013**; the layer-boundary lint guard — **R-014**.
- Any new render pass, counter kind, HUD element, art, gameplay, balance, level data or translation change.
