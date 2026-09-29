# Implementation Plan: R-012 Platformer State Stores, Asset Loader & HUD Extraction

**Branch**: `R-012-state-stores-asset-hud` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/R-012-state-stores-asset-hud/spec.md` (GitHub issue #100).

## Summary

R-012 is a behaviour-preserving refactor of shipped platformer code. It lands five slices, all of
which are *moves of live code into named homes*, never redesigns:

1. **Per-domain stores + reset hooks (US1/US6).** `PlatformerState.ts` (1,252 lines today) loses the
   two longhand reset coordinators and the state it holds; the state moves into the twelve domain
   `state/` modules (plus the state-side `state/hudModel.ts`) that plan OQ-1 settles from the spec's
   nine domains, each exporting its own `reset(respawn)` (respawn
   pass) and `resetFull()` (full pass) hook. `PlatformerState.ts` survives as the **assembly root**
   that re-exports the moved-but-live state and defines the two frozen public seams, whose bodies
   become a three-phase ordered fan-out: clear checkpoint memory → respawn pass → progress-only
   pass.
2. **`SpriteManifest` + `AssetLoader` (US2).** The page's ~290-line block of ~23 `loadImage`/
   `loadFont` chains, 20+ per-sheet refs and the in-effect `setSpearTipMask` call collapse into one
   declarative manifest (`entities/sprites/SpriteManifest.ts`) and one loader
   (`engine/AssetLoader.ts`) that fills one path-keyed `SpriteLookup`, notifies per asset, and
   isolates per-asset failure. `PlatformerPage.tsx` (2,580 lines today) holds one lookup, not twenty
   refs, and contains zero `loadImage(`/`loadFont(` calls.
3. **Typed torch placements (US3).** `level/TorchMapper.ts` produces `TorchPlacement[]`
   (`col`/`row`/`x`/`y`/`strength`, the existing `TorchLight` shape) through the same
   `placeAtMarkers`-family convention as `placeBlocks`/`placeEnemies`. The state layer's
   `torchPositions` and the editor's cave-lighting preview both consume it, so the state layer stops
   reading `marker.kind`/`marker.strength` and the preview stops re-deriving torch strength.
4. **HUD model + layout (US4).** `state/hudModel.ts` builds the whole HUD as data (hearts; the
   chest→key→bomb counter slots with icon identity/count/total/visibility; the four counter-popup
   icons) and owns the sprite descriptors; `engine/render/HudLayout.ts` owns the counter vocabulary,
   measurement and X-chaining; `HudRenderer` draws. The page neither names a popup sprite frame nor
   chains a counter X.
5. **Lifecycle controller (US5, last).** `PlatformerSession.ts` (app layer, next to the page) owns
   canvas sizing, the game loop, input creation/destruction, resize/keydown listeners, asset loading,
   the phase transitions and the per-phase gating. The page supplies its world-step/render function
   and keeps the canvas element, the overlay JSX and the composition; `GameLifecycle.ts`'s pure
   transition functions remain the single source of the phase state machine.

Every fragile invariant is preserved and machine-checked: the two reset seam names/signatures/
observable effects, the checkpoint-before-respawn-then-progress ordering, revive-in-place vs rebuild,
`restoredOnRespawn`, `'death'` vs `'progress'` reset scopes, per-asset (never unit) asset failure,
progressive reveal, path-keyed `SpriteLookup`, pixel-identical HUD metrics, and R-001/R-015 layer
edges. One new feature-local guard test (`stateStructure.test.ts`) fails the suite if any removed
shape returns.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, no `any`) + React 19; Vite 8 bundler;
`@preact/signals-react` 3 for state.

**Primary Dependencies**: Existing platformer modules only — `engine/SpriteLoader.ts`,
`engine/FontLoader.ts`, `engine/GameLifecycle.ts`, `engine/GameLoop.ts`, `engine/Input.ts`,
`engine/CanvasSize.ts`, `engine/render/HudRenderer.ts`, `engine/effects/**` (R-004 registry),
`entities/sprites/{sheets,SpriteSheet}.ts`, `entities/hazards/SpearArt.ts`, `tiles/torch.ts`,
`level/{Terrain,LevelData,LevelParser,placement}.ts`, `state/levelSession.ts`,
`editor/ops/caveLightingPreview.ts`. **No new dependency.**

**Storage**: N/A — static site, no backend, no persisted change. The new `state/` stores are
in-memory module signals exactly like today's `PlatformerState.ts` signals (never `localStorage`;
only the editor's own state is persisted, and it is untouched).

**Testing**: Vitest + React Testing Library + jsdom; guard tests use test-only `node:fs` scanning
(R-009/R-010/R-011/R-015 precedent). The page suite already stubs `global.Image`
(`PlatformerPage.test.tsx`'s `MockTilesetImage`, `:218-229`) and the editor suites already mock
`../engine/SpriteLoader`, so the loader is exercised against the existing image stub without new
mocking infrastructure. Commands: `npm test`, `npm run build`, `npm run lint`. Conventions from
[docs/TestingGuide.md](../../docs/TestingGuide.md) (`{method}-{condition}-{expected-result}`,
Arrange/Act/Assert) and [docs/Architecture.md](../../docs/Architecture.md) (signals over Context,
typed data, shadcn untouched) are authoritative and applied throughout.

**Target Platform**: Browser (static build served as pre-rendered HTML/CSS/JS).

**Project Type**: Single static web application — one self-contained theme at
`src/themes/platformer/`.

**Performance Goals**: No regression. The loader keeps today's non-blocking, progressively-revealing
behaviour (one repaint per resolved asset, `allSettled` only for the ready notification); the HUD
model, layout and renderer replace per-frame work of the same order; bundle size MUST NOT grow
materially (modules increase, page/state line count falls).

**Constraints**:

- **Behaviour is frozen** (FR-003…FR-006, FR-009, FR-012, FR-015, FR-017): identical reset
  ordering and reachable state, identical asset fallbacks and progressive reveal, identical torch
  values, identical HUD pixels/metrics/visibility, identical lifecycle timings and per-phase gating.
- **Frozen public API**: `resetGame()` and `resetGameProgress()` keep their names, signatures and
  observable effects — the page, `editor/editorActions.ts` and two large suites call them.
- **Layer invariants** (FR-018, R-001 + R-015): `contracts/` stays a leaf; no new `level/ → engine/`;
  no new `engine/ → state/`; `tiles/ → entities/|engine/` stays absent. The loader and HUD layout are
  engine-layer pure modules over plain values; the HUD-model module is state-side; the lifecycle
  controller is app-layer because `engine/ → state/` is forbidden.
- **No test is deleted, skipped or weakened** (FR-021, SC-009). Baseline measured before planning:
  **195 test files / ≈4,048 `it()` cases** across `src/`, of which `PlatformerState.test.ts` has 161,
  `PlatformerPage.test.tsx` 245, `HudRenderer.test.ts` 31, `SceneRenderer.test.ts` 210,
  `guard.test.ts` 7, `GameLifecycle.test.ts` 40.
- **The manual browser comparison is the owner's** (FR-022, spec Clarification 2026-09-29): the
  implementation obligation ends at a green suite, lint and production build; the hand-off item is
  the owner's before/after comparison.

**Scale/Scope**: `PlatformerState.ts` 1,252 lines → 12 domain `state/` modules + `state/hudModel.ts`
(13 modules under `state/`) + an assembly root; `PlatformerPage.tsx` 2,580 lines (spec SC-005) → page
+ `PlatformerSession.ts` + manifest/loader + HUD model/layout; 1 level mapper; 1 new guard test.
Authoritative conventions:
[docs/Architecture.md](../../docs/Architecture.md), [docs/TestingGuide.md](../../docs/TestingGuide.md),
[R-001 layer-boundaries](../R-001-platformer-core-contracts/contracts/layer-boundaries.md),
[R-015 layer-invariants](../R-015-platformer-tile-module-registry/contracts/layer-invariants.md).

### Open Issues / Risks

- **OQ-1 — The spec's nine domains settle at ten domains / twelve domain modules (+ `state/hudModel.ts`
  = thirteen modules under `state/`).** The spec's nine domains are
  preserved as *concepts*; the split lands as: player/camera → `state/playerStore.ts`; level session →
  `state/levelSession.ts` (unchanged) + `state/levelPlacements.ts` + `state/levelTotals.ts`; blocks →
  `blockStore.ts`; enemies → `enemyStore.ts`; collectibles/pickups → `collectibleStore.ts`;
  deployable items → `deployableItemStore.ts`; hazard timers → `hazardTimerStore.ts`; checkpoints →
  `checkpointStore.ts`; effects → `effectStore.ts`; effects/progress' progress half →
  `progressStore.ts`. `state/hudModel.ts` is the HUD model, not a domain. The canonical count used
  everywhere in this feature is therefore **13 modules under `state/`**: the twelve domain/level-view
  modules above (including the unchanged `state/levelSession.ts`) plus `state/hudModel.ts`. The spec
  explicitly leaves
  the exact number/boundaries to planning (Assumptions) and the invariant that matters is FR-001
  (no coordinator enumerates per-signal writes).
- **OQ-2 — The HUD X-chain is deliberately asymmetric, and the existing suite pins it.**
  Today's render closure always measures the chest slot (so a hidden chest still advances the key's
  X), while a hidden key does *not* advance the bomb's X
  (`HudRenderer.test.ts`'s `keyHidden-bombTakesTheKeyCountersXBecauseTheHiddenGroupDoesNotAdvance`).
  FR-014 already states this per-slot rule (each model slot declares whether a hidden group still
  advances the next X — today the chest slot does, while key/bomb do not), and FR-015/SC-003 require
  pixel-identity, so the two agree by construction rather than conflicting.
  Design: each counter slot in the HUD model carries `advancesWhenHidden` (today: chest `true`,
  key/bomb `false`) and `HudLayout` applies a single generic chain algorithm over it. This keeps the
  layout generic, keeps the per-group policy in data, and reproduces both behaviours exactly. The
  layout contract records the two cases and the existing test must pass unchanged.
- **OQ-3 — `state/levelSession.ts` is an explicit, documented exemption from the raw-marker-type
  check.** It owns the live marker-layer signal (`currentMarkers: readonly MarkerPlacement[]`) and
  passes `currentLevel.value.markers` to the `level/` tile finders; §4.1 of the design reference puts
  it under `state/`, and FR-001 forbids the new stores duplicating it. The guard therefore scans
  `PlatformerState.ts`, the new store/model/totals/placements modules and
  `editor/ops/caveLightingPreview.ts` for `marker.kind`/`marker.strength`/`markerAt(` and for raw
  marker *field* reads, and exempts `state/levelSession.ts` as the raw-layer container — which never
  reads a marker's fields itself. The guard asserts that exemption positively, so it is visible at
  review rather than hidden in a regex.
- **OQ-4 — The lifecycle controller is app-layer, not `engine/`.** It must read/write `state/`
  signals and `engine/ → state/` is forbidden, so `PlatformerSession.ts` lives beside
  `PlatformerPage.tsx` (the layer contract's top box: "`PlatformerPage.tsx` / `editor/` /
  `components/`"). It is delivered last, per the spec's sequencing assumption, because it is only
  clean once US1–US4 have emptied the mount effect. **Confirmed by the project owner on 2026-09-29**
  (previously an interpretation flagged for review): FR-016's
  "mount/tick/unmount orchestration" is read as *the loop, listeners, input, sizing, asset loading and
  phase transitions/gating*, with the frame body injected by the page (`onFrame(dt, gates)`) — the
  alternative (moving the ~1,500 lines of world-step/render composition into the controller too) is
  rejected because SC-005 requires extracted code to land in named services rather than in one new
  god-file. Should this ever be revisited, the gate table and the session surface stay unchanged and
  only `onFrame`'s contents relocate.
- **OQ-5 — Page-test imports move, assertions do not.** `PlatformerPage.test.tsx` imports
  `scaledImageCounter`/`hudCounterX`/`CHEST_COUNTER_X` from `HudRenderer` to compute expected X
  positions (e.g. `measurementChestDescriptor`). Those symbols' home moves to `HudLayout`, so those
  imports migrate; the expected numbers and assertions are unchanged. Same class of change as R-009's
  renderer-split migration.
- **OQ-6 — Two image consumers that are not the renderer must read through the lookup.** The render
  path passes images directly to `drawPlayer`, `drawCheckpoints`, `drawHeldTorch`, `drawTerrain`/
  `drawWaterForeground`/`drawSigns` and the HUD drawers. All of them read the loader's path-keyed
  lookup (`/sprites/knight.png`, `/sprites/knight2.png`, `/sprites/hearts.png`,
  `/sprites/chest_closed.png`, `/sprites/key.png`, `/sprites/world_tileset.png`, the checkpoint flag
  sheet…). `/sprites/journal.png` stays a plain DOM `<img>` and is deliberately not a manifest entry.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                               | Status          | Evidence / Mitigation                                                                                                                                                                                                                                                                          |
| --------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Typed Data Architecture              | PASS            | No `src/data/` or persisted change and no CV content type touched, so the `src/types/` rule has no new subject; the new platformer type shapes (`HudModel`, `SpriteManifest`, `TorchPlacement`) are declared in their theme modules exactly as the shipped platformer types are (`src/themes/platformer/types.ts` and module-local interfaces), strict with no `any`, and are typed data rather than callback bags (FR-013 explicitly forbids draw closures). |
| II. Testing (NON-NEGOTIABLE)            | PASS            | TDD ordering per task; ≥≈4,048 existing cases migrate with unchanged assertions (only module/import/search-path updates); new unit suites for the loader, manifest, torch mapper, HUD model, HUD layout and domain resets; the FR-020 guard is non-vacuous. No test deleted, skipped or weakened. |
| III. Code Quality & Component Standards | PASS            | Named arrow-function exports, typed props, `cn()` and shadcn/ui untouched — this feature adds no component and no dependency. PascalCase types / camelCase functions preserved.                                                                                                                    |
| IV. No Feature Bloat                    | PASS            | A specified `R-NNN` refactor from an existing spec; no gameplay, tuning, art, level-data or HUD redesign; the lifecycle controller is the last slice of *this* feature, not a follow-on workstream. `docs/Features.md`'s dependency node is marked done only when implementation and tests are done. **Scope decision (recorded at analysis, accepted by the project owner 2026-09-29):** the five-slice decomposition (US1–US5) is kept inside the one bounded `R-NNN` feature tracked by issue #100 — the slices are the spec's own user stories inside the feature registry, not a step list scheduling work outside it, and splitting them would fragment the single behaviour-preservation gate (FR-022/SC-008). |
| V. Performance & Static Delivery        | PASS (measured) | No dependency added; net source lines fall sharply; per-frame work is the same order (one HUD model build + one layout pass replaces today's inline composition); the loader keeps one repaint per resolved asset. Bundle size is **measured**, not assumed: T001 records the pre-change production bundle size and T044 compares the post-change build against it (the constitution's monitoring rule). |
| Dev Workflow: manual browser check      | PASS (required) | FR-022/SC-008: the owner's before/after browser comparison of HUD pixels, asset fallbacks, death/Reset-Game resets and all lifecycle phases is the approval gate.                                                                                                                               |
| Dev Workflow: no auto-commit            | PASS            | Work is left uncommitted for review; no commit is made by the implementation.                                                                                                                                                                                                                   |
| Dev Workflow: no auto-advance           | PASS            | This plan is the only Spec Kit step run; `tasks` is the user's explicit next invocation.                                                                                                                                                                                                        |
| R-001/R-015 layer invariants (FR-018)   | PASS            | `contracts/` stays a leaf; no new `level/ → engine/`; no new `engine/ → state/`; `tiles/` gains no `entities/`/`engine/` edge. The loader/layout are engine pure modules; the HUD model is state-side; the session is app-layer. Guard-enforced.                                               |

No violations — Complexity Tracking is empty.

_Post-design re-check (after Phase 1):_ PASS. Concretely: `entities/sprites/SpriteManifest.ts` imports
only `entities/` + `contracts/`; `engine/AssetLoader.ts` imports `engine/` + `entities/` (for
`SpearArt`'s mask installer) and no `state/`; `engine/render/HudLayout.ts` imports `contracts/` and
`engine/render/HudRenderer.ts` **type-only** (erased), so the runtime edge is one-way
`HudRenderer → HudLayout`; `state/hudModel.ts` imports `engine/render/HudLayout.ts`,
`contracts/counters.ts`, `entities/sprites/sheets.ts` and its sibling stores — a permitted
`state/ → engine/` edge; `level/TorchMapper.ts` imports `level/` + `tiles/` only (no `engine/`);
`PlatformerSession.ts` sits at app level and imports anything below it, including `state/`. No
forbidden edge is added, and no gate outcome changes.

## Project Structure

### Documentation (this feature)

```text
specs/R-012-state-stores-asset-hud/
├── spec.md                          # The feature specification (behaviour contract)
└── plan.md                          # This file
```

> The Phase 0/1 working artifacts (`research.md`, `data-model.md`, `quickstart.md`,
> `contracts/`, `checklists/`) and the generated `tasks.md` are not kept in this folder —
> only `spec.md` and `plan.md` are, matching `R-009` and this repo's pruned-specs
> convention. The behaviour they described is implemented and covered by the tests.

### Source Code (repository root)

```text
src/themes/platformer/
├── contracts/
│   ├── counters.ts                     # UNCHANGED — CounterKey/CounterPopupLabelKey consumed by hudModel
│   ├── SpriteLookup.ts                 # UNCHANGED — the path-keyed image map (contract frozen)
│   └── DrawContext.ts                  # UNCHANGED — sprites: SpriteLookup
├── level/
│   ├── TorchMapper.ts                  # NEW — TorchPlacement + placeTorches(torchTiles, level)
│   ├── TorchMapper.test.ts             # NEW
│   └── Terrain.ts                      # UNCHANGED — markerAt stays a level-layer helper
├── tiles/
│   └── torch.ts                        # UNCHANGED — TorchLight/TorchStrength/light maths
├── engine/
│   ├── SpriteLoader.ts                 # UNCHANGED — the loadImage primitive the loader uses
│   ├── FontLoader.ts                   # UNCHANGED — the loadFont primitive the loader uses
│   ├── AssetLoader.ts                  # NEW — manifest → lookup + per-asset/ready notifications
│   ├── AssetLoader.test.ts             # NEW
│   ├── GameLifecycle.ts                # UNCHANGED — the phase state machine and its timings
│   └── render/
│       ├── HudRenderer.ts              # MODIFIED — draws the model/layout; keeps drawHearts/iris/glow/prompt
│       ├── HudLayout.ts                # NEW — counter vocabulary, measurement, X-chain, drawHud
│       ├── HudLayout.test.ts           # NEW
│       ├── HudRenderer.test.ts         # MODIFIED — same assertions; layout imports move here
│       └── guard.test.ts               # UNCHANGED — R-009's guard is not extended
├── entities/
│   └── sprites/
│       ├── sheets.ts                   # UNCHANGED
│       ├── SpriteSheet.ts              # UNCHANGED — collectSheetSources/frameSource reused
│       ├── SpriteManifest.ts           # NEW — the declarative image + font list
│       └── SpriteManifest.test.ts      # NEW — coverage/dedup frozen expectations
├── editor/ops/
│   └── caveLightingPreview.ts          # MODIFIED — consumes placeTorches
├── state/
│   ├── levelSession.ts                 # UNCHANGED — the live raw layers + tile finders (OQ-3 exemption)
│   ├── playerStore.ts                  # NEW — player/camera/darkness/fog + respawn target
│   ├── blockStore.ts                   # NEW — blockPlacements/blockStates/cratesDestroyed
│   ├── enemyStore.ts                   # NEW — enemyPlacements/enemyStates/enemiesDefeated
│   ├── collectibleStore.ts             # NEW — coins/fruits/hearts/keys/bombs + pickup stores
│   ├── deployableItemStore.ts          # NEW — chests/ladders/bombs + activeLevel + tick/consequences
│   ├── hazardTimerStore.ts             # NEW — hazards + the four timer collections
│   ├── checkpointStore.ts              # NEW — checkpoints + activeCheckpointId + respawn placement
│   ├── effectStore.ts                  # NEW — activeEffects + spawnEffect + bubble refresh
│   ├── progressStore.ts                # NEW — facts/journal/ending latches/controlsOverlayDismissed/lifecycleState
│   ├── levelPlacements.ts              # NEW — signPlacements + torchPositions (no live state, no reset)
│   ├── levelTotals.ts                  # NEW — the one cross-store derived totals module
│   └── hudModel.ts                     # NEW — buildHudModel(sprites): HudModel
├── PlatformerState.ts                  # MODIFIED — assembly root + the two frozen reset seams
├── PlatformerSession.ts                # NEW — lifecycle controller (US5, delivered last)
└── PlatformerPage.tsx                  # MODIFIED — canvas, overlay JSX, composition, handlers
```

**Structure Decision**: The single-project layout of §4.1 of
[docs/PlatformerArchitectureAnalysis.md](../../docs/PlatformerArchitectureAnalysis.md) is followed as
written: stores and signals stay under `state/` (with `levelSession.ts` untouched), generic runtime
services under `engine/`, level parsing/placement under `level/`, and the app layer keeps
`PlatformerPage.tsx`. Two additions are deliberate and documented: `state/hudModel.ts` (state-side so
it may read signals — FR-013/FR-018) and `PlatformerSession.ts` at the theme root, because a
lifecycle controller that reads state cannot live in `engine/` (R-001's `engine/ → state/` ban). The
new guard test `stateStructure.test.ts` sits at the theme root beside `PlatformerState.test.ts`
because it spans the page, `state/`, `editor/ops/` and the layer edges — the same position
`editorStructure.test.ts` (spans `editor/`) and `hitStructure.test.ts` (spans damage sites) take.

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
