# Feature Specification: Platformer State Stores & Asset/HUD Extraction

**Feature Branch**: `R-012-state-stores-asset-hud`

**Created**: 2026-09-29

**Status**: Draft

**Input**: GitHub issue #100 — "R-012: Platformer State Stores & Asset/HUD Extraction". Decompose the `PlatformerState`/`PlatformerPage` god-files into per-domain stores and extracted asset/HUD/lifecycle services. This is an architecture refactor: the game must play exactly as it does today.

**Depends on**: [R-001 Platformer Core Contracts & Dependency Layers](../R-001-platformer-core-contracts/spec.md) (shipped: the `contracts/` leaf layer and the layer-boundary contract — no `contracts/ → engine/`, no `engine/ → state/`), [R-004 Platformer Transient Effect Registry](../R-004-platformer-transient-effect-registry/spec.md) (shipped: the transient-effect registry whose `resetScope` the resets must keep honouring), [R-009 Platformer Renderer Split](../R-009-platformer-renderer-split/spec.md) (shipped: `SceneRenderer`/`HudRenderer`, the generic `drawHudCounter`/`hudCounterX`/counter-descriptor vocabulary, and the renderer structural guard whose non-vacuous style this feature's separate guard follows), [R-010 Platformer Mapper & Editor Unification](../R-010-platformer-mapper-editor-unification/spec.md) (shipped: `state/levelSession.ts` owns the live layout signals; the `*Mapper` place functions whose shape this feature's torch mapper follows), [R-011 Platformer Player Damage & Bomb Systems](../R-011-platformer-player-damage-bomb-systems/spec.md) (shipped: the hit-effect resolver and `BombSystem` — the remaining page bulk is now lifecycle, asset and HUD wiring).

**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 9 "God-file decomposition (systems + stores)"; finding **D7** (`resetGame`/`resetGameProgress` manually enumerate ~20–28 signals each, with subtle per-domain rules), finding **D8** (~300 lines of `loadImage` chains, 20+ per-sheet refs, and a module-level `setSpearTipMask` side effect embedded in the mount effect), finding **D9** (HUD composition hardcoded by kind: popup icon order/sprites, counter X-chaining), finding **D10** (the state layer reads raw level-marker vocabulary directly), and §4.1's target tree (`state/` per-domain stores; `engine/` generic runtime services).

## Clarifications

### Session 2026-09-29

- Q: Should sprites still appear one at a time as each image finishes loading, or is it acceptable for the whole sprite set to appear at once when loading completes? → A: Keep per-asset progressive reveal — the loader reports each asset as it resolves and the page repaints per asset, exactly as today; the loader therefore exposes per-asset notification, not only a single ready promise.
- Q: Which raw-marker reads must be replaced by typed placements — just the state layer's torch list, or also the editor's cave-lighting preview and the `tiles/stalactite.ts` lookup? → A: State layer **and** the editor's cave-lighting preview share one `level/` torch mapper, so game lighting and preview cannot drift. Editor marker-authoring paths (`paintMarkerCell`, the `EditorCanvas` marker overlay/inspection) and `tiles/stalactite.ts`'s tile-activation lookup are out of scope; the guard covers the state layer and the cave-lighting preview.
- Q: Where should the per-frame HUD model be built, given the page must no longer name a popup label's sprite frame? → A: In a dedicated HUD-model module (state-side) that owns the counter/popup descriptor table and reads the state signals; the page only calls it and passes the result to `HudLayout`/`HudRenderer`. The model is therefore unit-testable without a canvas and SC-003 is verifiable by search.
- Q: How should the mandatory manual browser comparison be produced for this behaviour-preserving refactor? → A: The project owner performs the manual check at the end (they confirm the game behaves the same). The feature's tasks stop at a green full suite, lint and production build; the manual comparison is a hand-off item before approval, not an agent task.
- Q: Where should R-012's structural guard test live? → A: One **new feature-local** guard file asserting every R-012 shape (no reset coordinator, no page `loadImage`/`loadFont`/per-sheet refs, no inline HUD composition or counter-X arithmetic, no raw-marker read in the state layer or the cave-lighting preview, no widened layer edges). R-009's `engine/render/guard.test.ts` stays untouched; this feature follows its non-vacuous frozen-expectation style rather than extending it.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Each state domain owns its own reset (Priority: P1)

Today two functions carry every reset rule in the game: `resetGame()` (`PlatformerState.ts:1138-1191`) writes ~22 signals individually, and `resetGameProgress()` (`:1214-1252`) writes ~20 more, each with its own subtle rule — enemies are *revived in place* through `reviveEnemy` (so per-instance session state such as `rewardGiven` survives) rather than rebuilt; blocks whose kind declares `restoredOnRespawn` are rebuilt and carry their `rewardGiven` flag across from the prior instance with the same id; the four hazard-timer arrays are cleared by hand one by one; only the effects whose registry `resetScope` is `'death'` are filtered out of `activeEffects`; `deployableItems` is filtered by each kind's `resetScope`; the full reset must clear `activeCheckpointId` **before** it delegates to the respawn reset so the respawn sees no active checkpoint. Adding a new signal, a new restorable block kind or a new reset-scoped item means remembering to edit one of these two long functions — and forgetting is silent. After this feature each domain (player/camera, blocks, enemies, collectibles, deployable items, hazard timers, checkpoints, effects/progress, level session) exposes its own `reset(respawn)` / `resetFull()` hook and the two public seams become a short ordered fan-out; each domain owns its own rule and a new domain adds itself in one place.

**Why this priority**: This is D7, the issue's first named deliverable, and the largest source of "forgot to reset X" defects. It is P1 because every other story in this file moves signals into the same per-domain homes.

**Independent Test**: Search `PlatformerState.ts` (and its successors) for the longhand reset shape — there is no remaining coordinator that assigns per-signal reset values one domain at a time. Confirm `resetGame`/`resetGameProgress` delegate to per-domain hooks in a fixed order, and that every existing reset/respawn/level-change test passes with unchanged assertions.

**Acceptance Scenarios**:

1. **Given** a new restorable block kind is added to the registry, **When** the player dies, **Then** the block is restored by the block domain's own `reset(respawn)` hook without any edit to a central coordinator.
2. **Given** a death/respawn, **When** the reset runs, **Then** enemies are revived through `reviveEnemy` on the existing objects (not rebuilt), `rewardGiven` survives, the four hazard-timer arrays are emptied, `'death'`-scoped effects are removed while other effects keep fading, and `'progress'`-scoped deployables persist — exactly as today.
3. **Given** a full Reset Game, **When** it runs, **Then** checkpoint memory is cleared first, the respawn pass runs, and then the progress-only domains (facts, journal section, coins/blocks/enemies rebuild, ending-screen latches, pickups, ladders/chests) are cleared — with the same final state as today.
4. **Given** `lifecycleState`, `collectedFacts`, the collected pickup flags and checkpoint memory, **When** `resetGame` runs, **Then** none of them are touched (only the full reset clears facts and progress).

---

### User Story 2 - Every sprite is loaded from one manifest by one loader (Priority: P1)

Today the page's mount effect ends with ~290 lines (`PlatformerPage.tsx:2189-2479`) of ~23 individual `loadImage(...).then(img => ref.current = img).catch(...)` chains, 20+ dedicated image refs declared beside them, plus a registry walk for enemy sheets and a module-level side effect (`setSpearTipMask(mask)` at `:2324`) executed from inside the effect. Every chain re-implements the same "if cancelled return, assign ref, render()" shape and repeats its own fallback comment. After this feature a `SpriteManifest` states which images the theme needs (keyed the way the existing `SpriteLookup` is keyed) and one `AssetLoader` loads them, producing a populated `SpriteLookup` plus per-asset progress notifications and a ready notification; the page holds one lookup, not twenty refs, and no module-level state is mutated from the mount effect.

**Why this priority**: This is D8 and P1 because it is pure mechanical removal of page bulk with a clear data seam, and every HUD/render consumer already reads assets through a keyed lookup.

**Independent Test**: Search `PlatformerPage.tsx` for `loadImage(`/`loadFont(` — zero matches; search it for per-sheet image refs (`tilesetRef`, `groundAtlasRef`, `heartsSpriteRef`, …) — none survive as page-local refs. Confirm the assets still appear at runtime and that a deliberately-failing asset still degrades to the same fallback (the feature's art simply does not render; the page is not blank) as before.

**Acceptance Scenarios**:

1. **Given** the manifest, **When** the loader runs, **Then** it resolves a populated lookup keyed by source path containing every image the renderer, HUD and effects consume — including the registry-discovered enemy/ladder/chest sheets — with no hand-listed ref per sheet.
2. **Given** one asset fails to load, **When** the loader finishes, **Then** only that asset is absent, every other asset is present, and the page keeps rendering exactly as today (no thrown error, no blank page).
3. **Given** the spear art, **When** its sheet arrives, **Then** the tip mask is installed by the loader/manifest owner rather than by a statement inside the page's mount effect.
4. **Given** an unmount mid-load, **When** a load resolves afterwards, **Then** it does not write to page or module state.

---

### User Story 3 - The state layer speaks typed placements, not raw marker vocabulary (Priority: P2)

Today `torchPositions` (`PlatformerState.ts:251-263`) reads the level's raw marker layer directly — `markerAt(...)?.kind === 'torch'` and `marker.strength` — so the state layer must know the marker vocabulary and a marker's fields; the editor's cave-lighting preview (`editor/ops/caveLightingPreview.ts:53`) repeats the same rule and its own `DEFAULT_TORCH_STRENGTH` fallback, so the two can drift. After this feature a typed placement (`TorchPlacement`, carrying `col`/`row`/`x`/`y`/`strength`) is produced by a `level/` mapper in the same shape as the shipped `placeBlocks`/`placeEnemies`/`placeCheckpoints` mappers, and both the state layer and the editor preview consume it.

**Why this priority**: This is D10 and it is the enabler that lets the HUD/lighting model be built from typed data rather than from level-format knowledge. It is P2 because it is small and its consumer (US4) is P2.

**Independent Test**: Search the state layer and the editor's cave-lighting preview for marker-kind/marker-field access (`marker.kind`, `marker.strength`, `markerAt(`) — none remains, and both get their torch lights from the one `level/` mapper. Confirm the game's light list and the editor preview produce identical lights for the same parsed input, and that the other marker-derived placements (checkpoints, hazards, enemies, chests, collectibles) are unchanged.

**Acceptance Scenarios**:

1. **Given** a torch marker with no explicit strength, **When** the typed placement is produced, **Then** it carries the same default strength and the same pixel centre as today.
2. **Given** a marker of an unknown or newer kind, **When** placements are produced, **Then** it is ignored exactly as today (no crash, no extra placement).
3. **Given** the state modules' imports, **When** they are inspected, **Then** no store imports the raw marker type — `state/levelSession.ts` is the documented exemption because it owns the raw marker-layer signal and forwards it to the `level/` finders.
4. **Given** the same parsed level and markers, **When** the game's light list and the editor's cave-lighting preview are derived, **Then** both come from the same mapper and produce identical lights.

---

### User Story 4 - The HUD is composed from a model and laid out by a layout (Priority: P2)

Today the render closure hardcodes the HUD: the counter-popup icon set is built inline as a fixed four-entry list naming each label key and its exact sprite frame (`SLIME_GREEN_SHEET` frame 2 at `:749-750`, `blockFrameSource('crate')` at `:753-756`, coin/fruit frames), the persistent counters are constructed inline one after another, and each one's X position is chained by hand from the previous counter's measured width with a per-group visibility rule that is asymmetric (the chest slot always advances the key's X; a hidden key does not advance the bomb's X — `PlatformerPage.tsx:978-999`). After this feature a HUD **model** describes the whole HUD as data (hearts, each counter's icon/count/total/visibility, each popup label's icon) built in one dedicated model module from state, and `HudRenderer`/`HudLayout` consume it: the renderer draws, the layout decides placement and group hiding, and the page neither names a sprite frame nor chains a counter X.

**Why this priority**: This is D9 and it is the last slice the issue names before the lifecycle controller ("do this LAST"). It is P2 because the persistent-counter half already has a generic drawer (R-009); this finishes the composition seam.

**Independent Test**: Confirm the page's render closure no longer constructs per-kind counter descriptors, no longer names a popup label's sprite frame, and no longer chains counter X positions; confirm the HUD's rendered pixels are unchanged (same icon sizes, icon heights, gaps, Y row, visibility rules and group-hiding behaviour) by comparing against the pre-change build.

**Acceptance Scenarios**:

1. **Given** full health, no chests, no keys and no carried bombs, **When** the HUD draws, **Then** only the hearts row is visible at the same coordinates as today.
2. **Given** chests exist, keys have been collected and bombs are carried, **When** the HUD draws, **Then** chest → key → bomb appear in the same order, at the same X positions, with the same measured widths and inter-group gap as today, and the frozen asymmetry holds: a hidden chest still advances the key's X, while a hidden key does not advance the bomb's X.
3. **Given** a collected coin, fruit, enemy or crate, **When** its counter popup draws, **Then** it uses the same icon, frame, size and vertical nudge as today.
4. **Given** a HUD model value, **When** the renderer is invoked with it directly in a unit test, **Then** it draws that model without reading any game state.

---

### User Story 5 - A lifecycle controller owns the phase and the wiring (Priority: P3)

Today one mount effect (`PlatformerPage.tsx:570-2491`, ~1,900 lines) owns canvas sizing, the game loop, input creation/destruction, resize/keydown listeners, the asset loads, scene rebuilds, and every lifecycle phase transition: `introState`, `startDeath`, `tickLifecycle`, `pauseForJournal`, `resumeFromJournal`, `showEndingScreen`, `dismissEndingScreen`, plus the death/respawn/restart decisions and the phase gating that decides which parts of the tick and render run. After this feature a lifecycle controller owns the phase transitions and the mount/tick/unmount orchestration; the page keeps the canvas element, the overlay JSX and the composition, and the phase-gating decisions are asked of the controller rather than re-derived inline.

**Why this priority**: The issue names it last ("Do this LAST") and it is the highest-churn, lowest-standalone-value slice: it is only clean once US1–US4 have emptied the effect of everything else. It is P3 and may be delivered as the final slice of this feature.

**Independent Test**: Confirm the phase transitions are decided in one controller module rather than inline at scattered call sites, that the pure transition functions in `GameLifecycle.ts` remain the single source of the phase state machine, and that intro → playing → dying → awaitingRestart → playing, journal pause/resume and the ending screen all behave identically (including which parts of the tick/render are skipped per phase).

**Acceptance Scenarios**:

1. **Given** a fresh mount, **When** the game starts, **Then** it plays the same `intro` iris-in and reaches `playing` with the same timing as today.
2. **Given** a lethal hit, **When** the player dies, **Then** the death animation, iris close and `awaitingRestart` prompt run identically, and the restart re-enters `intro` at the respawn point.
3. **Given** the journal is opened and closed, **When** the phase pauses and resumes, **Then** physics/render behaviour while paused is unchanged.
4. **Given** every chest is opened, **When** the ending screen shows and is dismissed, **Then** the phase returns to `playing` exactly as today.
5. **Given** the page source, **When** it is inspected, **Then** it contains no direct `lifecycleState.value` assignment and no phase re-derived from the signal — every transition and gate is asked of the controller.

---

### User Story 6 - The refactor changes nothing the player sees (Priority: P1)

This is a refactor of already-shipped gameplay, so the acceptance bar is that the game plays identically: the same HUD pixels and visibility rules, the same asset fallbacks, the same reset/respawn semantics and ordering, the same death/respawn/restart/journal/ending behaviour, the same level-change behaviour. The fragile parts are the **ordering** (checkpoint memory cleared before the respawn pass; the respawn pass before the progress-only pass) and the **per-domain rules** (revive-in-place vs rebuild, `restoredOnRespawn`, `'death'` vs `'progress'` reset scopes, marker-strength defaults).

**Why this priority**: It is the binding condition of every R-NNN refactor and the verification story that runs last over the combined change.

**Independent Test**: Play a level against the pre-refactor build and compare: the HUD at zero and after collecting chests/keys/bombs/coins/fruits/enemies/crates, the same after a death/respawn, the same after Reset Game, the same after a death with a collected key and an open chest, a death mid-hazard-cycle, a level change through the editor's Try, and the ending screen. Separately, run the existing suites untouched and build the production bundle.

**Acceptance Scenarios**:

1. **Given** the full existing test suite, **When** it runs after the change, **Then** every assertion is unchanged except for module/import/search-path updates, and the production build and TypeScript strict build succeed with no `any`.
2. **Given** a structural guard test, **When** it runs, **Then** it fails if a longhand reset coordinator, an inline `loadImage`/`loadFont` chain in the page, an inline per-kind HUD descriptor/X-chain, or a raw-marker read in the state layer or the cave-lighting preview reappears.
3. **Given** the HUD, **When** any game state is rendered, **Then** every icon, counter, popup, prompt and overlay appears at the same coordinates and with the same visibility as before.
4. **Given** an asset load failure, **When** the page renders, **Then** it degrades exactly as today (the feature's art is missing; everything else, including the background fill, still shows).

---

### Edge Cases

- ✅ **The two public reset seams keep their names and semantics.** `resetGame()` (death/respawn) and `resetGameProgress()` (full Reset Game / editor Try / theme-switch mount) are called from the page, the editor and the tests; the refactor moves the *rules* into domains but MUST NOT rename, reorder the observable effect of, or split either seam. — Resolved: both names, signatures and observable effects are frozen public API.
- ✅ **`resetFull` is not "respawn plus everything".** It is the ordered composition today: clear checkpoint memory → run the respawn pass → clear progress-only state. The checkpoint-before-respawn ordering is load-bearing and MUST be preserved. — Resolved: the three-phase order is a hard requirement (FR-003).
- ✅ **`controlsOverlayDismissed` is deliberately not reset by either seam** (the page's mount effect resets it on a theme switch). It MUST NOT be pulled into a domain reset. — Resolved: excluded from both domain resets (FR-006).
- ✅ **Revive vs rebuild is per-domain and load-bearing.** Enemies revive in place; the full reset rebuilds them. Blocks only rebuild the `restoredOnRespawn` kinds on respawn, carrying `rewardGiven`; the full reset rebuilds all of them. `deployableItems` filters by `resetScope`, so an open chest and a deployed rope ladder survive a death while a placed bomb does not. — Resolved: per-domain revive/rebuild split is preserved verbatim (FR-004/FR-005).
- ✅ **Effects are scope-filtered, not blanket-cleared.** The respawn pass removes only `'death'`-scoped effects (puffs, heal auras, splatters, debris, explosions, flying text and counter popups keep fading); the full reset empties the collection. — Resolved: `'death'`-scope filter on respawn, full clear on full reset (FR-004/FR-005).
- ✅ **Asset failure is per-asset and non-fatal.** Each asset's absence degrades only its own feature; the loader MUST NOT reject as a unit or block the loop. — Resolved: isolated per-asset failure (FR-009).
- ✅ **The `SpriteLookup` key contract is unchanged.** Assets are keyed by source path (`SpriteLookup`), because the renderer, effects and editor all index by path; the manifest may describe a superset (registry walk) but the resolved lookup MUST stay path-keyed. — Resolved: path-keyed lookup is unchanged, and it is **keyed from creation** (every entry present with `null`) so a frame drawn before readiness skips the sheet rather than handing `undefined` to a strict `=== null` guard and `drawImage` (FR-009).
- ✅ **Module-level side effects are not allowed to move into a different side effect.** The spear tip mask must be installed by the loader/manifest owner as part of loading, not by a statement executing on import or in the page effect. — Resolved: loader/manifest ownership, not import time and not another effect (FR-010).
- ✅ **The raw marker vocabulary stays in `level/`.** The stores must not import the raw marker type — `state/levelSession.ts` is the documented exemption as the raw-layer container — and a marker of an unknown kind is ignored as today. — Resolved: torch mapping moves into `level/` (consumed by both the state layer and the editor's cave-lighting preview), unknown kinds are still ignored, and the guard scans the stores and the preview while positively asserting the `levelSession.ts` exemption (plan OQ-3). Editor marker-authoring paths and `tiles/stalactite.ts` keep their marker access by explicit decision (FR-011/FR-012).
- ✅ **The HUD model is data, not a callback bag.** It describes what to draw (icons, counts, totals, visibility, order); the page must not pass per-kind draw closures, and the renderer must not read game state. — Resolved: plain data, no draw closures, no state reads in the renderer (FR-013).
- ✅ **`PlatformerState.ts` may remain as an assembly/composition module** that re-exports moved-but-live state for existing consumers — that is not a compatibility shim. What MUST NOT survive is a removed longhand reset coordinator, an inline per-signal reset sequence, or a re-export whose only purpose is to preserve an ad-hoc entry point the refactor deleted. — Resolved: assembly root permitted; removed shapes forbidden (FR-019).
- ✅ **No new forbidden import edges.** `contracts/` stays a leaf; no new `level/ → engine/`; no new `engine/ → state/`. The loader and HUD layout are engine-layer pure modules over plain values; the page/state wires and applies them. — Resolved: layer edges unchanged (FR-018), asserted by the guard test.

## Requirements _(mandatory)_

### Functional Requirements

#### Per-domain stores and resets

- **FR-001**: Game state MUST be grouped into per-domain stores (player/camera, level session, blocks, enemies, collectibles/pickups, deployable items, hazard timers, checkpoints, effects/progress), each exposing its own `reset(respawn)` and `resetFull()` hooks. The exact number and boundaries of the domains are settled in planning; the required property is that **no coordinator enumerates per-signal reset writes**. The split MUST preserve the reactive graph — every `computed` keeps importing the real signal it derives from, and startup/subscription behaviour is unchanged. The stores MUST NOT duplicate `state/levelSession.ts`'s level-session signals or the `level/` tile finders; they consume them exactly as `PlatformerState.ts` does today.
- **FR-002**: The two public reset seams MUST remain: `resetGame()` (the death/respawn seam) and `resetGameProgress()` (the full Reset Game seam used by the Reset Game button, the editor's Try and the theme-switch mount). Each MUST delegate to the per-domain hooks in a fixed order and MUST NOT retain a longhand per-signal reset body.
- **FR-003**: The full reset MUST preserve today's composition and ordering: checkpoint memory is cleared **first**, then the respawn pass runs, then the progress-only writes (facts, journal section, coins/blocks/enemies rebuild, ending-screen latches, pickup arrays, ladders/chests). Reversing this order is a behaviour change and MUST NOT happen.
- **FR-004**: The per-domain respawn rules MUST be preserved exactly: revive enemies in place through `reviveEnemy` (preserving per-instance session state such as `rewardGiven`) rather than rebuilding them; rebuild only the blocks whose kind declares `restoredOnRespawn`, carrying the prior instance's `rewardGiven`; clear the four hazard-timer collections; filter `activeEffects` by the `'death'` reset scope; filter deployable items by each kind's `resetScope`; reset the carried-bomb count and clear dropped bomb pickups; clear the dropped-heart collection alongside the pot restoration; reset player, health, camera and the darkness/fog levels.
- **FR-005**: The full-reset-only rules MUST be preserved exactly: clear checkpoint memory and rebuild the checkpoint states; rebuild blocks/enemies/rope-ladders/chests from their level-derived placements; clear the whole effect collection; clear collected facts, the journal section, the ending-screen flags and the pickup arrays; re-derive the base coins uncollected and clear the spawned coins.
- **FR-006**: A reset seam MUST NOT add or remove writes: the set of state values reachable after `resetGame()` and after `resetGameProgress()` MUST be identical to today, including which state is deliberately left untouched (`lifecycleState`, `collectedFacts` and the collected pickup flags on a respawn; `controlsOverlayDismissed` on both). A store's reset MUST write only the signals it owns — a store MUST NOT reach into another store's signals, and cross-domain ordering stays in the coordinator.

#### Asset loading

- **FR-007**: A `SpriteManifest` MUST declare every image the theme's runtime needs as data (the source the loader fetches, and the lookup key the consumers already use), including the images currently discovered by walking the enemy/chest/ladder registries. The manifest MUST cover every asset category the mount effect loads today: the registry-discovered primary sheets, the hand-listed secondary/sequence sheets (explosion, spear, floor spike, crack overlay, crumbling floor, decorations, held key, the chest's open sheet), the player sheets, the tileset and ground/background atlases, the ambient-cloud/background-layer sheets, the static-objects sheet, the torch and mushroom sheets, the HUD sprites (hearts, coin, fruit, `chest_closed`, key), the checkpoint flag, and the custom restart-prompt font. Adding a new sprite MUST be a manifest entry, not a new hand-written load chain.
- **FR-008**: ONE `AssetLoader` MUST consume the manifest and produce a populated `SpriteLookup` plus **per-asset load notifications** and a ready (all-settled) notification. `PlatformerPage.tsx` MUST contain zero `loadImage(...)`/`loadFont(...)` calls and MUST NOT declare a per-sheet image ref for anything the manifest covers; it MUST install/start the loader and pass the loader's lookup into the render path (`DrawContext.sprites` and any directly-read sprite).
- **FR-009**: Loading semantics MUST be preserved: non-blocking; each asset's failure isolated to that asset (never a rejected unit, never a blocked loop, never a blank page); each per-asset notification MUST trigger exactly the redraw/consumer reaction today's per-asset `render()` call triggers, so art still appears **progressively as each asset resolves** rather than in one lump; an unmount mid-load MUST NOT write to state afterwards. The lookup MUST be keyed from creation — every manifest entry present with `null` while pending, and still present with `null` if its load fails — so `SpriteLookup`'s "skip while unloaded" contract holds from the first frame and a consumer drawing before readiness never receives `undefined`.
- **FR-010**: The module-level side effect currently executed inside the mount effect (installing the spear tip mask from the loaded sheet) MUST move to the loader/manifest ownership as part of loading, not to module-import time and not to some other page effect.

#### Typed placements

- **FR-011**: Level markers MUST be converted to typed placements by `level/` mappers in the same shape as `placeBlocks`/`placeEnemies`, and every marker-derived placement the state layer exposes (including torches) MUST be a typed placement. The state layer's stores MUST NOT read `marker.kind`/`marker.strength`/marker fields, and MUST NOT import the raw marker type. `state/levelSession.ts` is the **one documented exemption**: it owns the live marker-layer signal (`currentMarkers`) and forwards it to the `level/` finders, but never reads a marker's fields itself, and FR-001 forbids the stores duplicating it (plan OQ-3). The editor's cave-lighting preview MUST consume the same torch mapper as the state layer rather than re-deriving torch strength from markers. Editor marker-authoring paths (painting/inspecting markers) and `tiles/stalactite.ts`'s tile-activation lookup are explicitly out of scope.
- **FR-012**: Typed placements MUST carry the same values as today, including the marker's default when it carries no strength, the same pixel centre, and the same "unknown marker kind is ignored" behaviour. `parseLevel` already clamps an out-of-range/malformed torch strength to the default, so the mapper consumes the parsed marker and MUST NOT re-normalize differently. The state layer's light list and the editor preview MUST produce identical lights for the same parsed input.

#### HUD model and layout

- **FR-013**: A HUD **model** MUST describe the whole HUD as data — the hearts, each persistent counter's icon identity/count/total/visibility, and each counter-popup label's icon/frame/offset — built in one place from game state by a **dedicated HUD-model module** that owns the counter/popup sprite descriptors. The model MUST be data only: no per-kind draw callbacks and no game-state reads inside the renderer. An icon MAY be absent while its asset is still loading; the model MUST represent that absence and the draw MUST skip it exactly as today. `PlatformerPage.tsx` MUST call the model module rather than assembling the model or naming a sprite frame itself.
- **FR-014**: `HudRenderer`/`HudLayout` MUST consume the model: the renderer draws it, the layout decides placement, group order, group hiding and the X-chain. The chain is **asymmetric and frozen**: each model slot declares whether a hidden group still advances the next X — today the chest slot does (a hidden chest still advances the key's X, because the chest descriptor is always measured), while the key and bomb slots do not (a hidden key does not advance the bomb's X) — and `HudLayout` MUST apply one generic chain algorithm over that per-slot flag rather than re-open-coding the asymmetry (plan OQ-2). `PlatformerPage.tsx` MUST NOT construct per-kind counter descriptors, name a popup label's sprite frame, or chain counter X positions by hand.
- **FR-015**: The drawn HUD MUST be pixel-identical: same icon sizes/frames/heights, same gaps, same vertical row, same counter text formatting, same popup icon order, and the same visibility gates.

#### Lifecycle controller

- **FR-016**: A lifecycle controller MUST own the game's phase transitions and the mount/tick/unmount orchestration currently inline in the page's mount effect; the pure phase state machine in `GameLifecycle.ts` MUST remain the single source of the phase model and its timings, and phase-gating decisions MUST be asked of the controller rather than re-derived inline at call sites. `PlatformerPage.tsx` **MUST NOT assign `lifecycleState.value` directly** and MUST NOT re-derive a phase from the signal (`lifecycleState.value.phase`); it raises intent through the controller's surface (`beginIntro`, `beginDeath`, `advanceLifecycle`, `pauseForJournal`, `resumeFromJournal`, `showEndingScreen`, `dismissEndingScreen`, `restart`) and asks `phase()` for gating. The controller seeds the opening `intro` phase itself when it starts, so the theme-switch mount effect does not seed it either.
- **FR-017**: The lifecycle controller MUST reproduce today's behaviour exactly: the same `intro` → `playing` timing, the same `dying` timeline (death-animation lead-in, iris shrink/hold/close), the same `awaitingRestart` prompt and restart-to-`intro` behaviour, the same journal pause/resume, the same ending-screen show/dismiss, and the same per-phase gating of the tick and render.

#### Structural guarantees

- **FR-018**: The change MUST NOT widen R-001's forbidden edges: `contracts/` stays a leaf, no new `level/ → engine/`, no new `engine/ → state/`. The asset loader and HUD layout/renderer MUST be pure modules over plain values; the HUD-model module is state-side (it reads signals and owns the sprite descriptors), and the page wires the two together.
- **FR-019**: The removed shapes MUST NOT survive: no longhand per-signal reset coordinator, no `loadImage`/`loadFont` chain in the page, no per-sheet page-local image ref covered by the manifest, no inline per-kind HUD descriptor/X-chain in the page, no raw-marker read in the state layer's stores or in the cave-lighting preview (`state/levelSession.ts` excepted as the raw-layer container). A removed helper MUST NOT be preserved by a compatibility barrel, alias or re-export; re-exporting moved-but-live state from an assembly module is permitted.
- **FR-020**: An automated structural guard test MUST fail the suite if FR-018/FR-019 regress (a reintroduced reset coordinator, page-level `loadImage`/`loadFont`, inline HUD composition, raw-marker read in the state layer's stores or in the cave-lighting preview, a direct `lifecycleState.value` assignment in the page, a phase re-derived from the signal, or forbidden import edge). The guard MUST live in **one new feature-local guard test file** (not in R-009's `engine/render/guard.test.ts`), MUST be non-vacuous (frozen expectations) and MUST positively assert the `state/levelSession.ts` raw-layer exemption rather than hiding it in a regex, and MUST follow the project's `{method}-{condition}-{expected-result}` test-naming convention.
- **FR-021**: All existing tests MUST migrate and MUST pass; assertions MUST be unchanged wherever only a module home, import path or internal call shape changed, and a test that covered a consolidated symbol MUST be rewritten against the new form — never weakened, skipped or deleted. The production build and the TypeScript strict build MUST succeed with no `any`.
- **FR-022**: Behaviour MUST be verifiable as unchanged beyond the automated suite: the HUD appearance, asset fallbacks, reset semantics and lifecycle phases MUST be confirmed by the project owner's manual browser check **at the end** (the constitution's manual-check gate for visible-behaviour changes). The implementation obligation stops at a green full suite, lint and production build; the manual comparison is a hand-off item before approval, not an implementation task.

### Key Entities _(include if feature involves data)_

- **Per-domain store**: A self-contained slice of game state (its signals/computeds plus its `reset(respawn)` / `resetFull()` hooks). Domains are player/camera, level session, blocks, enemies, collectibles/pickups, deployable items, hazard timers, checkpoints and effects/progress. Data + behaviour belong to the domain that owns the state.
- **Reset coordinator**: The two thin public seams (`resetGame`, `resetGameProgress`) that fan out to the domain hooks in a fixed order. Today: ~20–28 per-signal writes each. After: an ordered delegation with no per-signal bodies.
- **SpriteManifest**: The declarative list of the theme's runtime images — the load source and the lookup key — including registry-discovered sheets. The single place a new sprite is declared.
- **AssetLoader**: The module that consumes the manifest and produces a populated `SpriteLookup` plus **per-asset progress notifications** and a ready (all-settled) notification, isolating per-asset failures and owning the spear-tip-mask side effect.
- **SpriteLookup** (existing, R-009): The path-keyed image map every renderer/effect/editor consumer already reads. Its key contract is unchanged.
- **Typed placement**: A `col`/`row`/world-position (plus kind-specific fields such as torch `strength`) record produced by a `level/` mapper, consumed by the state layer. Replaces direct marker-vocabulary reads in the state layer and in the editor's cave-lighting preview.
- **HUD model**: The declarative description of the HUD (hearts; persistent counters with icon identity, count, total and visibility; counter-popup label icons) built once from game state by a dedicated HUD-model module that owns the counter/popup sprite descriptors.
- **HudLayout**: The placement/visibility rules over the HUD model (order, X-chaining, group hiding, measured widths).
- **Lifecycle controller**: The owner of phase transitions and mount/tick/unmount orchestration, built on the pure `GameLifecycle` phase model.
- **Existing appliers/registries (unchanged)**: `reviveEnemy`, `toBlockState`/`toChestState`/`toCheckpointState`, the `resetScope` metadata on the effect and deployable registries, and `restoredOnRespawn` on block kinds are consumed, not redesigned.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Neither public reset seam contains a longhand per-signal reset sequence; each domain resets itself through its own hook, and adding a reset-scoped domain is a one-place change (verifiable by search and by the guard test).
- **SC-002**: `PlatformerPage.tsx` contains zero `loadImage(`/`loadFont(` calls and no per-sheet page-local image refs covered by the manifest; asset loading lives entirely in the manifest + loader and the lookup reaches the render path (verifiable by search).
- **SC-003**: The page contains no per-kind counter-descriptor construction, no popup-label sprite-frame naming and no hand-chained counter X positions; the HUD is built as one model by the dedicated HUD-model module and drawn by layout + renderer (verifiable by search).
- **SC-004**: The state layer's stores contain no raw-marker-vocabulary access (`marker.kind`, `marker.strength`, the `markerAt` helper) and no import of the raw marker type — `state/levelSession.ts` is the single documented exemption as the raw-layer container, and it never reads a marker's fields — and the editor's cave-lighting preview gets its torch lights from the same `level/` mapper (verifiable by search and by the guard test).
- **SC-005**: `PlatformerPage.tsx` shrinks materially from its measured 2,580 lines and `PlatformerState.ts` from its measured 1,252 lines, with the extracted code living in named per-domain/loader/HUD/lifecycle modules rather than moving to another god-file.
- **SC-006**: Every existing platformer test passes with unchanged assertions except module/import/search-path updates; the full suite, the production build and the strict TypeScript build are green.
- **SC-007**: A non-vacuous structural guard test fails if any FR-019 shape is reintroduced.
- **SC-008**: The project owner confirms by manual browser check at the end that HUD appearance, asset fallbacks, reset semantics after death and after full reset, and all lifecycle phases behave identically to the pre-change build.
- **SC-009**: No test is deleted, skipped or weakened; the count of reset/respawn/HUD/lifecycle tests is preserved or grown.
- **SC-010**: `PlatformerPage.tsx` contains no `lifecycleState.value` assignment and no `lifecycleState.value.phase` read — every phase transition and gating decision goes through the controller — and the structural guard fails if either shape returns (verifiable by search and by the guard test).
- **SC-011**: The asset lookup is fully keyed with `null` before any asset resolves, so a frame drawn before readiness skips every unloaded sheet instead of throwing (verifiable by unit test; a missing key would otherwise crash `drawImage` in a real browser while the mocked canvas hides it).

## Assumptions

- **The refactor is invisible.** Per the project's R-NNN definition and the user's direction, no gameplay, tuning, art, level-data or HUD-change is allowed. Any actual HUD or asset redesign is a separate future feature.
- **Store granularity default.** The per-domain split above (nine domains) is the informed default taken from the signals the two reset coordinators already touch, grouped by ownership and reset rule. The exact number/boundaries and file layout are settled in planning; the invariant is FR-001 (no coordinator enumerates per-signal writes).
- **`PlatformerState.ts` remains the composition root.** State is imported by the page, the editor, the renderer, the effects and the tests, and §4.1's target tree keeps `PlatformerState.ts` as "shrinks as stores move to `state/`". It may remain as the assembly module that re-exports moved-but-live state; only the removed reset bodies and ad-hoc helpers must be gone (FR-019).
- **Reset-seam names are public API.** `resetGame`/`resetGameProgress` keep their names, signatures and observable effects because the page, the editor and two large test files call them.
- **Asset scope boundary with R-013.** This feature owns the manifest + loader plumbing, the removal of the per-sheet page refs and the removal of the module-level side effect. Re-organising art files, grouping same-size variants, deleting unreferenced leftovers and atlas consolidation are `R-013 Platformer Sprite Asset & Atlas Organization` and are out of scope.
- **`SpriteLookup` stays path-keyed.** The manifest and loader must not change how consumers index images; they only change who loads them and how they are declared.
- **Image loading stays mocked in tests.** The test environment has no real image loading; the loader is designed so its manifest/ordering/failure-isolation logic is unit-testable with the existing image stub, and the page tests' existing asset stubs keep working.
- **HUD appearance is frozen.** Counter/icon sizes, heights, gaps, rows, text formatting, popup order and visibility gates are behaviour, not styling, and must not change.
- **The lifecycle controller is the last slice.** It is the highest-churn, lowest-standalone-value part and depends on US1–US4 having emptied the mount effect; the plan may sequence it last within this feature.
- **Existing tests are the behavioural contract.** The reset/respawn (`PlatformerState.test.ts`), page/HUD/lifecycle (`PlatformerPage.test.tsx`) and renderer (`HudRenderer.test.ts`, `SceneRenderer.test.ts`, `guard.test.ts`) suites already encode the required behaviour and must keep their assertions.
- **The manual behaviour check is the owner's.** The project owner performs the end-of-work browser comparison and confirms the game behaves the same; the implementation is complete when the automated gates are green and the removed shapes are gone.

## Out of Scope

- `R-011 Platformer Player Damage & Bomb Systems` (D5/D6) — already shipped; its resolver and `BombSystem` are consumed, not redesigned.
- `R-013 Platformer Sprite Asset & Atlas Organization` (Group A) — art-file organisation, atlas consolidation, unreferenced-asset cleanup and variant grouping.
- `R-014 Platformer Layer-Boundary Lint Guard` — the standalone lint guard is separate; this feature adds only a feature-local structural guard test (FR-020).
- `R-016 Platformer Abstraction Docs & Docs Restructure` — documentation restructuring.
- The editor's marker-authoring paths (`paintMarkerCell`, the `EditorCanvas` marker overlay/inspection) and `tiles/stalactite.ts`'s tile-activation marker lookup — these keep their marker access; only the state layer and the cave-lighting preview move to the shared typed mapper (see Clarifications).
- Entity-folder reorganisation (`features/`, the grid-object/actor split) beyond what the store extraction requires for clean homes.
- Any gameplay, tuning, HUD-visual, UI-copy or level-data change; any new feature (audio, level selection, new entity kinds).
