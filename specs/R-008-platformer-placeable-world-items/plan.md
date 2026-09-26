# Implementation Plan: Platformer Placeable World Items

**Branch**: `R-008-platformer-placeable-world-items` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)
**Input**: GitHub issue #96 — "R-008: Platformer Placeable World Items". Feature specification from
`/specs/R-008-platformer-placeable-world-items/spec.md`.

> This plan was regenerated to align with the spec's 2026-09-26 clarification session, which added
> the `SpawnedType<S>` / `WorldInteractableType<S>` subtypes, resolved X7 by folding the chest into
> the world-interactable family, and renamed the shipped `DeployableLadder*` vocabulary to
> `RopeLadder*`.

## Summary

R-008 is the Phase 6 "Placeable deployable items" slice of the Platformer Architecture Refactor
(GitHub issue #96; analysis findings **P1**, **P2**, **X7**, plus **P3** as a preserved invariant).
It gives the level's player-affected objects — a placed bomb, a live rope ladder and an opened chest
— **one umbrella registry** (`DeployableItemType<S>`), **one live collection** (`deployableItems`),
**one tick**, **one draw dispatch** and **one interaction dispatch**; folds the bomb's two runtime
faces (held pickup + placed lit item) into **one module home**; folds the chest into the
`WorldInteractableType` subtype so the chest family is reachable from **one import path** (resolving
X7 by folding, not by keeping a one-member family); and keeps the shipped `Standable.findLandingRow`
as the single downward landing scan. Nothing player-visible changes: the acceptance bar is
**behaviour preservation** (FR-011, SC-007).

Concretely, the feature:

1. Adds a `DeployableItemType<S>` umbrella registry contract for the level's player-affected objects.
   It composes the shipped `WorldType<S>` (`key` + `draw`) and adds a shared state base
   (`id`/`col`/`row`/world `x`/`y`/`kind`), a primary `sprite` descriptor, a per-kind `drawLayer`
   band, a `resetScope`, and an **optional** `box(state)` — deliberately **not** the required
   `Boxed<S>`. It carries optional `step`, `onTick` (late consequence), `onPlayerInteract` and
   `effectiveTerrainCells` hooks. A new leaf `contracts/DeployableItemKind.ts` owns the
   `'bomb' | 'ladder' | 'chest'` vocabulary; `DEPLOYABLE_ITEM_TYPES` joins the
   `entities/WorldType.test.ts` conformance suite and the page's `collectSheetSources` discovery list.
2. Specialises the umbrella into **two subtypes**: `SpawnedType<S>` (the player spawns it at runtime
   — a required `spawn`/creation entry point and a required `step`; today the placed bomb) and
   `WorldInteractableType<S>` (placed in the level and activated by the player — a required
   `onPlayerInteract` and `interactionPriority`, an optional `step` and effective-terrain hook;
   today the rope ladder and the chest).
3. Replaces `placedBombs` + `deployableLadderStates` + `chestStates` with **one** live
   `deployableItems` collection discriminated by `kind`, seeded from the authored ladder bundles and
   chest placements. The per-kind reset scopes are preserved through a registry `resetScope` field:
   bombs clear on death/respawn; ladder and chest live state is rebuilt only on a full progress
   reset, so a deployed ladder and an open chest survive a death.
4. Adds **one** `tickDeployableItems` (early, pre-physics, at the ladder's current site) that advances
   every entry through its own `step`, and **one** `applyDeployableItemConsequences` (late,
   post-physics, pre-persist, at the bomb's current site) that dispatches each kind's late hook. That
   hook **returns** a declarative `DeployableItemOutcome` (`{ disposition, blasts? }`) — never a
   page-supplied capability — and the pass returns the requested `BlastRequest`s for the page to
   resolve. There is no `DeployableItemApi`; the page contains no per-kind deployable-item
   step/draw/interaction branch.
5. Adds **one** `drawDeployableItems` dispatch, invoked at the three bands the kinds occupy today (the
   ladder's terrain-level band; the placed bomb's after-blocks band; the chest's after-crumbling-floor
   band) via a per-kind `drawLayer`, mirroring R-006's `PickupType.drawLayer`.
6. Adds **one** `proposeDeployableItemInteraction` dispatch that offers an activation to the
   `WorldInteractableType` entries by `interactionPriority` (the rope-ladder bundle outranks the
   chest, preserving today's precedence) and returns declarative data (`{ activate?, hint? }`). One
   generic applier in the page replaces the ladder's deploy block and the chest's open/hint block.
7. Folds `engine/PlacedBomb.ts` + `entities/pickups/Bomb.ts` into **one** module
   (`entities/deployableItems/Bomb.ts`) owning both faces — the placed `SpawnedType<PlacedBombState>`
   (state machine, fuse frames, fall/landing, removal) and the held `PICKUP_TYPES.bomb` view — over
   one shared constants/sprite set. The bomb-pot drop keeps routing through `PICKUP_TYPES.bomb`.
8. Moves `engine/DeployableLadder.ts` and its renderer into `entities/deployableItems/RopeLadder.ts`
   and renames its vocabulary to `RopeLadder*`, so the ladder owns its `step`, its draw, its
   `onPlayerInteract` deploy trigger and its effective-terrain application (a registry
   `effectiveTerrainCells` hook folded into `activeLevel`).
9. Folds the chest into the `WorldInteractableType` family: `entities/Chest.ts` is absorbed into
   `entities/chests/Chest.ts`, the singular `CHEST_TYPE` becomes `chestDeployableItem`, a
   `WorldInteractableType<ChestState>` entry registered in `DEPLOYABLE_ITEM_TYPES.chest`, and the chest
   family (state, helpers, constants and view) collapses behind one import path. X7 is resolved by
   folding.
10. Keeps `Standable.findLandingRow` as the single downward landing scan, with each deployable-item
    kind supplying its own solidity predicate and off-by-one mapping (already true after R-002; R-008
    only preserves it).

**Precision on the two-phase tick.** The spec's 2026-09-26 clarification resolves the ordering
tension: the single `tickDeployableItems` runs at the ladder's early (pre-physics) site so a deploy
completes into `activeLevel` before the same tick's collision reads it, while each kind's consequence
hook runs at the bomb's late (post-physics, pre-persist) site so a blast lands on the same tick's
`next` player state. The bomb's `step` (fuse + fall) is pure and was already position-independent of
the player (a bomb is non-solid), so moving its advance to the early site changes no cross-tick
observable. The ladder has no late-phase consequence: its lifecycle **is** its `step` (early) and its
terrain application is the pure `effectiveTerrainCells` derivation the early site's stepped state
drives. See [research.md](./research.md#r4--the-two-phase-tick-step-early-consequences-late).

**The interaction dispatch is data-returning.** The chest's activation has side effects beyond its
own state (a key cost and a fact reveal), so it returns a declarative
`DeployableItemInteractionOutcome` (`{ kind: 'activate', state, keyCost?, reveal? }`) that one generic
page applier resolves, mirroring `PickupOutcome`. A chest the player stands on with no key returns
`{ kind: 'blocked', hint: 'noKeyForChest' }`, so the existing "no key" speech bubble is still driven
without the page naming a chest kind (the hint type is `level/HintCatalog`'s `BubbleMessageId`, a
downward dependency that keeps `entities/` free of a `state/` import).

**Documented boundary (honest).** A brand-new deployable-item kind is one module plus one registry
line for the page's tick/draw/interaction dispatch, the sprite loader, `Renderer.ts` and
`Collision.ts` (FR-001/SC-003). A kind that mutates the effective terrain adds its
`effectiveTerrainCells` hook in the same module — no state-layer edit. A kind that needs a *new* live
collection or a new consequence outcome type the shared applier must interpret is outside SC-003's
enumeration, exactly as R-006's research R9 recorded for a new pickup family; the three current kinds
need neither. The chest's **secondary** open sheet stays hand-listed in the loader (as secondary
sheets do for every family); only its primary (closed) sheet is discovered by the registry walk.

## Technical Context

**Language/Version**: TypeScript (strict mode, no `any`) in a Vite 6 + React 19 project. The
platformer theme lives under `src/themes/platformer/` and follows the pure-module / co-located-test
conventions in [docs/Architecture.md](../../docs/Architecture.md).

**Primary Dependencies**: None added — this is a pure refactor. Existing: `@preact/signals-react`,
React 19, Tailwind CSS 4, Vitest. No new runtime or dev dependency (constitution Principle V: bundle
size must not regress; dead-code removal may shrink it slightly).

**Storage**: N/A. No JSON data, level, marker, sprite asset, or `localStorage` shape change (spec
Assumptions: "No data migration"). Only TypeScript types, module homes, hook signatures and in-memory
signal wiring change. `ChestPlacement` gains `col`/`row` (markers already carry them; no data change).

**Testing**: Vitest + React Testing Library + jsdom, per
[docs/TestingGuide.md](../../docs/TestingGuide.md). Every `engine/`/`entities/`/`level/` module
carries a co-located `.test.ts`. This feature **relocates and restructures** existing tests (never
deletes, weakens or skips them — FR-012/SC-006) and adds co-located unit tests for the new
contract/registry/dispatch seams. The most affected suites are `engine/Renderer.test.ts` (three
hand-wired draw describes → one `drawDeployableItems`), `engine/PlacedBomb.test.ts` and
`engine/DeployableLadder.test.ts` (moved into the deployable-item family), `engine/Collision.test.ts`
(the chest describe moves to the chest family), and the placed-bomb/ladder/chest reset-scope and
interaction scenarios in `PlatformerState.test.ts` / `PlatformerPage.test.tsx`. See "Test Migration &
Restructuring" below.

**Target Platform**: Browser (static site; the platformer renders to a `<canvas>` in the web app).

**Project Type**: Web application (a self-contained game theme inside the CV website).

**Performance Goals**: The game loop is frame-driven (60 fps target). The generic paths must not add
per-frame allocation beyond what exists today: `tickDeployableItems` maps the collection once (the
three current paths already map their arrays once); `drawDeployableItems` iterates the collection
once per band (three band-filtered passes, mirroring the three current per-kind passes);
`proposeDeployableItemInteraction` allocates nothing unless an interactable matches;
`applyDeployableItemConsequences` allocates a survivor array only when a bomb is removed and a
returned-blast array only when one detonates; `applyDeployableItemTerrain` returns the **same**
`level` object (identity) when no ladder is deployed, preserving `activeLevel`'s existing
nothing-allocated fast path.

**Constraints**:
- **Behaviour preservation** — the only sanctioned changes are the umbrella registry + subtypes, the
  single collection/tick/draw/interaction, the two-phase consequence split, the bomb one-home
  consolidation, the ladder module move/rename, the chest fold, and the corresponding import/name
  updates (spec Assumptions).
- **Layer invariants** (R-001 FR-002/FR-008/FR-010, spec FR-014, SC-008): `contracts/` stays a strict
  leaf (the new `DeployableItemKind` union imports nothing); no new `level/ → engine/`; no new
  `engine/ → state/`; the deployable-items collection, its tick, its consequence applier and its
  interaction dispatch stay state/page-layer wiring (or pure `entities/` calculations) that the engine
  consumes.
- **One home per concept** — no compatibility re-export or alias for the deleted
  `placedBombs`/`deployableLadderStates`/`chestStates` signals, the hand-wired page passes, the old
  `drawPlacedBombs`/`drawDeployableLadders`/`drawChests` functions, the split bomb modules, or the
  chest's second import path (FR-013).
- **The bomb-pot drop route is unchanged** — `bombPot.drop: 'bomb'` still resolves through the
  generic `PICKUP_TYPES.bomb` spawn path; no second bomb spawn route and no duplicate constant set
  (FR-008).
- **No gameplay, tuning, visual, level-data or translation change** (FR-011; spec Out of Scope).
- **R-015 owns the stateless tile** — R-008 MUST NOT build a second tile registry; the rolled
  `ladderBundle` tile's stateless contract stays out of scope.
- **No auto-commits** (constitution Development Workflow; AGENTS.md).

**Scale/Scope**: 4 user stories, ~13 production modules changed, 4 modules deleted, 5 modules created
(one contract, four deployable-item family modules). The largest single changes are
`PlatformerPage.tsx`'s bomb block (~1975–2094) being replaced by the
`applyDeployableItemConsequences` declarative-outcome dispatch and its returned-blast resolution, the
ladder/chest interaction block (~1404–1438) being replaced by the shared interaction dispatch, and
the renderer's three hand-wired passes being replaced by `drawDeployableItems`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Outcome | Notes |
| --- | --- | --- |
| **I. Typed Data Architecture** | ✅ PASS | No `src/data/` JSON is touched. All new/changed types (`DeployableItemType`, `SpawnedType`, `WorldInteractableType`, `DeployableItemState`, `DeployableItemDrawLayer`, `DeployableItemTickContext`, `DeployableItemInteractContext`, `DeployableItemOutcome`, `DeployableItemInteractionOutcome`, `DeployableItemReveal`, `DeployableSpawnContext`, `TerrainCellWrite`, `BlastRequest`, the extended `PlacedBombState`/`RopeLadderState`, the re-based `ChestState`) are fully typed under TypeScript strict with no `any`. `DeployableItemKind` is a `contracts/` leaf vocabulary and `DEPLOYABLE_ITEM_TYPES` is pinned to it via a `Record<DeployableItemKind, DeployableItemType<DeployableItemState>>` annotation, so a kind added to one side without the other fails to compile (FR-001). R-008 follows the established theme-local type convention (types under `src/themes/platformer/`, matching the existing theme modules); the constitution's `src/types/` rule governs CV content data, not theme internals. |
| **II. Testing (NON-NEGOTIABLE)** | ✅ PASS | Behaviour-preserving refactor: the full existing suite passes with import paths and API/state shapes migrated only (FR-012). The new contract/registry/dispatch seams are TDD'd with tests that assert each existing scenario (Vitest, `{method}-{condition}-{expected-result}` naming — [docs/TestingGuide.md](../../docs/TestingGuide.md)). The move to a discriminated `deployableItems` collection legitimately changes the *shape* of the deployable-item fixtures, but **every** existing scenario, landing rule, reset scope, interaction precedence and blast consequence stays asserted — no test is deleted, skipped or weakened. The plan enumerates each migrated suite below. Coverage targets unchanged (100% `src/lib/`, 80%+ `src/components/`; the platformer is neither, so the bar is "all existing assertions preserved and green"). |
| **III. Code Quality & Component Standards** | ✅ PASS | No UI component or shadcn/ui change. New modules use named exports; no default exports. The `DeployableItemType` contract declares its members with **method syntax** (mirroring `PickupType`) so a concrete `DeployableItemType<PlacedBombState>` stays assignable to the widened `DeployableItemType<DeployableItemState>` under `strictFunctionTypes` with no `any`. |
| **IV. No Feature Bloat** | ✅ PASS | A discrete, spec'd refactor feature (`R-008`) with its own spec folder. It adds no player-facing capability and no new placeable content; it removes dispatch special-cases, three parallel live arrays, three hand-wired page passes, a split bomb concept and a second chest import path. `docs/Features.md`'s dependency diagram is updated on completion per AGENTS.md. |
| **V. Performance & Static Delivery** | ✅ PASS | No new dependency; no per-frame allocation added beyond the current shape; dead-code removal may shrink the bundle. `activeLevel` keeps its identity fast path when nothing is deployed; the late consequence applier allocates only on an actual removal. |
| **Development Workflow** | ✅ PASS | Feature branch/PR flow; no auto-commits. Because the platformer has visible behaviour, SC-007's manual browser pass is a required review step in addition to the test suite (constitution: "a passing test suite is not evidence that the change looks or feels right"). |

**Gate result**: No violations. Proceeding without complexity tracking.

_Post-Phase-1 re-check_: PASS, unchanged — the design introduced only a leaf `contracts/` vocabulary,
new `entities/` family modules, a state-layer collection/dispatch, and pure `entities/` interaction
calculations, with no new forbidden dependency edge, no tuning change and no reset-scope change. See
the closing section of [research.md](./research.md#r14--layer-and-constitution-re-check).

## Project Structure

### Documentation (this feature)

```text
specs/R-008-platformer-placeable-world-items/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — resolved decisions + code-validated findings
├── data-model.md        # Phase 1 output — types, collection, module map, relationships
├── quickstart.md        # Phase 1 output — build/test/inspect + manual browser pass
├── contracts/           # Phase 1 output — interface contracts
│   ├── deployable-item-type.md     # DeployableItemType<S> + subtypes + state base + hooks + outcomes
│   ├── generic-dispatch.md         # DEPLOYABLE_ITEM_TYPES + tick/consequences/draw/interaction + wiring
│   └── chest-family.md             # the one-import-path chest fold + sheet-cycle + landing invariant
├── checklists/
│   └── requirements.md  # spec-quality checklist (/speckit.checklist output)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by this command)
```

### Source Code (repository root)

The platformer theme is a single self-contained tree under `src/themes/platformer/`. No new top-level
project is added; the change is confined to that tree.

```text
src/themes/platformer/
├── contracts/
│   ├── DeployableItemKind.ts            # NEW — leaf union 'bomb' | 'ladder' | 'chest'
│   └── ... (unchanged: WorldType, Pickup, PickupKind, DrawContext, geometry,
│            Outcome, counters, capabilities, PhysicsConfig, SpriteLookup, lighting)
├── entities/
│   ├── deployableItems/                 # NEW family folder (player-affected low-count objects)
│   │   ├── DeployableItemType.ts        # NEW — DeployableItemType<S>, SpawnedType<S>,
│   │   │                               #   WorldInteractableType<S>, DeployableItemState,
│   │   │                               #   draw layer, TerrainCellWrite, tick/interact contexts,
│   │   │                               #   DeployableItemOutcome, DeployableItemInteractionOutcome,
│   │   │                               #   DeployableItemReveal, BlastRequest, DeployableSpawnContext
│   │   ├── index.ts                    # NEW — DEPLOYABLE_ITEM_TYPES + applyDeployableItemTerrain
│   │   │                               #   + proposeDeployableItemInteraction
│   │   ├── index.test.ts               # NEW — registry key/kind conformance, terrain fold,
│   │   │                               #   interaction priority/hint
│   │   ├── Bomb.ts                     # NEW — the bomb's ONE home (placed face + held face);
│   │   │                               #   merges engine/PlacedBomb.ts + entities/pickups/Bomb.ts
│   │   ├── Bomb.test.ts                # MOVED/MERGED — engine/PlacedBomb.test.ts +
│   │   │                               #   entities/pickups/Bomb.test.ts
│   │   ├── RopeLadder.ts               # NEW — the ladder's live face + draw; moves
│   │   │                               #   engine/DeployableLadder.ts + Renderer's ladder draw
│   │   └── RopeLadder.test.ts          # MOVED — engine/DeployableLadder.test.ts (+ moved draw cases)
│   ├── pickups/
│   │   ├── Bomb.ts                     # DELETED — merged into deployableItems/Bomb.ts
│   │   ├── Bomb.test.ts                # DELETED — merged into deployableItems/Bomb.test.ts
│   │   ├── index.ts                    # MODIFIED — imports the held face from ../deployableItems/Bomb
│   │   ├── index.test.ts               # MODIFIED — bomb import path retargets
│   │   ├── PickupType.ts               # UNCHANGED — the held-face contract
│   │   └── Coin.ts                     # UNCHANGED — consumer of coinBobOffset by the bomb home
│   ├── chests/                         # MODIFIED — the one-import-path chest family
│   │   ├── index.ts                    # MODIFIED — re-exports the whole family (state + view)
│   │   ├── Chest.ts                    # MODIFIED — absorbs entities/Chest.ts (state/helpers +
│   │   │                               #   constants); owns chestDeployableItem as a WorldInteractableType
│   │   ├── ChestType.ts                # MODIFIED — ChestType extends WorldInteractableType<ChestState>
│   │   ├── Chest.test.ts               # MOVED/MERGED — entities/Chest.test.ts + moved
│   │   │                               #   chestPlayerIsStandingOn / drawChests cases
│   │   └── index.test.ts               # MODIFIED — sheet/constant agreement + registry conformance
│   ├── Chest.ts                        # DELETED — merged into chests/Chest.ts
│   ├── Chest.test.ts                   # MOVED — merged into chests/Chest.test.ts
│   ├── WorldType.test.ts               # MODIFIED — DEPLOYABLE_ITEM_TYPES joins the conformance suite
│   └── sprites/sheets.ts               # MODIFIED — chest sheet geometry local literals (cycle break)
├── engine/
│   ├── PlacedBomb.ts                   # DELETED — merged into entities/deployableItems/Bomb.ts
│   ├── PlacedBomb.test.ts              # DELETED — moved to entities/deployableItems/Bomb.test.ts
│   ├── DeployableLadder.ts             # DELETED — moved to entities/deployableItems/RopeLadder.ts
│   ├── DeployableLadder.test.ts        # DELETED — moved to entities/deployableItems/RopeLadder.test.ts
│   ├── Renderer.ts                     # MODIFIED — drawPlacedBombs/drawDeployableLadders/drawChests
│   │                                   #   DELETED; drawDeployableItems added
│   ├── Renderer.test.ts                # MODIFIED — three hand-wired draw describes → drawDeployableItems
│   ├── Standable.ts                    # UNCHANGED (P3 preserved)
│   ├── Collision.ts                    # MODIFIED — chestPlayerIsStandingOn + chest imports DELETED
│   └── Collision.test.ts               # MODIFIED — chest describe moves to the chest family
├── editor/
│   ├── EditorCanvas.tsx                # MODIFIED — ladder + chest passes route through
│   │                                   #   drawDeployableItems
│   ├── EditorCanvas.test.tsx           # MODIFIED — draw mock names → drawDeployableItems
│   ├── EditorToolbar.test.tsx          # MODIFIED — Renderer mock rename
│   ├── LevelEditorPage.test.tsx        # MODIFIED — Renderer mock rename
│   ├── gridRenderState.ts              # MODIFIED — ladder/chest state import paths + kind/col/row
│   └── gridRenderState.test.ts         # MODIFIED — synthesized states carry kind/col/row
├── level/
│   └── ChestMapper.ts                  # MODIFIED — ChestPlacement gains col/row
├── PlatformerState.ts                  # MODIFIED — deployableItems + tickDeployableItems +
│                                       #   applyDeployableItemConsequences + activeLevel via
│                                       #   applyDeployableItemTerrain + chest count projections;
│                                       #   old signals DELETED; reset scopes
├── PlatformerState.test.ts             # MODIFIED — deployable-item reset scopes + tick/consequence +
│                                       #   interaction
├── PlatformerPage.tsx                  # MODIFIED — no deployable-item kind name in tick/draw/interaction;
│                                       #   bomb block + interaction block rewritten
└── PlatformerPage.test.tsx             # MODIFIED — deployableItems fixtures with kind; moved fixtures
```

**Structure Decision**: The single-project platformer tree is retained. The new player-affected family
goes to `entities/deployableItems/`, mirroring the existing family folders (`entities/pickups/`,
`entities/blocks/`, `entities/hazards/`) and keeping the registry pattern uniform. The
`DeployableItemKind` vocabulary goes to `contracts/` as a strict leaf, exactly as `PickupKind` does.
The shared collection, its tick and its consequence applier stay in the state/page layer (where
signals and page-local closures live) — that is the R-011/R-012 decomposition seam. The bomb's two
faces share one module because the spec mandates one home; the pickup registry consumes its held face
from `entities/deployableItems/Bomb.ts` (a single documented `entities/`-peer edge). The ladder's
module moves out of `engine/` because it now owns its draw (pulled from `Renderer.ts`) and
`entities/ → engine/` edges are already established by `entities/hazards/FallingStalactite.ts`'s
`engine/Standable` import. The chest family collapses into the existing `entities/chests/` folder and
its type view becomes a `WorldInteractableType` entry. The `sprites/sheets.ts` chest cycle is broken
the same way R-006 broke it for the pickup sheets. `engine/Collision.ts` loses its chest-special-case,
which is what makes "a new kind needs no `Collision.ts` edit" true. No folder re-organisation beyond
the one new family folder; R-001's layer boundaries are preserved.

## Test Migration & Restructuring

FR-012/SC-006 require that every existing test assertion is preserved — never weakened, skipped or
deleted. Several suites are **necessarily restructured** because three hand-wired paths move behind
one registry and three live collections merge; the deployable-item fixtures **legitimately change
shape** (a shared `deployableItems` array with `kind`-discriminated entries instead of three
kind-specific arrays) while every scenario, landing rule, reset scope, interaction precedence and
blast consequence stays asserted.

- **`engine/Renderer.test.ts`** (obligation): the `drawPlacedBombs`, `drawDeployableLadders` and
  `drawChests` describes become `drawDeployableItems` scenarios — band filtering (`'terrain'` vs
  `'afterBlocks'` vs `'afterCrumblingFloors'`), the no-kind-name dispatch, and the renderer's per-kind
  draw delegation. The per-kind **visual** assertions move to the kinds' own module tests: the bomb's
  fuse-frame/scale/falling-position assertions to `entities/deployableItems/Bomb.test.ts`; the
  ladder's rolled/deploying/deployed shaft-piece assertions to
  `entities/deployableItems/RopeLadder.test.ts`; the chest's open/closed sprite assertions to
  `entities/chests/Chest.test.ts`. No visual assertion is dropped — each is re-expressed against the
  kind's `draw` (the same function the dispatch calls).
- **`engine/DeployableLadder.test.ts` → `entities/deployableItems/RopeLadder.test.ts`** and
  **`engine/PlacedBomb.test.ts` → `entities/deployableItems/Bomb.test.ts`** (relocation): every
  existing `describe`/`it` moves with the module, renamed only for the `RopeLadder*`/`spawn` vocabulary
  changes. The bomb suite also absorbs `entities/pickups/Bomb.test.ts`'s pickup-face cases (spawn
  id/convention, box/bob/frame, `maxPerTick` capacity, `onPickup`). New cases assert the one-home
  guarantee: the held face and the placed face share the same `BOMB_SHEET` descriptor and the same
  fuse/fall constants. New ladder cases assert the `onPlayerInteract` eligibility and the
  `effectiveTerrainCells` derivation (re-expressing `ladderBundleForPlayer`/`applyDeployedLadders`).
- **`engine/Collision.test.ts`** (relocation): the `chestPlayerIsStandingOn` describe moves to
  `entities/chests/Chest.test.ts`, re-expressed against the chest entry's `onPlayerInteract` (the same
  closed-chest overlap scenarios: closed → activate/blocked, open → no match, empty → no match).
  `Collision.ts` keeps only the generic `overlappingTriggers`/pickup/hazard paths.
- **`PlatformerState.test.ts` / `PlatformerPage.test.tsx`** (storage-shape change): every
  `placedBombs.value = [...]` fixture becomes a `deployableItems.value = [...]` fixture whose entries
  carry `kind: 'bomb'`; every `deployableLadderStates.value` fixture becomes a `kind: 'ladder'` entry;
  every `chestStates.value` fixture becomes a `kind: 'chest'` entry. The reset-scope assertions are
  re-expressed and must stay individually asserted: a death/respawn removes every live bomb (without
  exploding it) and keeps the ladder and chest entries; Reset Game rebuilds the ladder entries rolled
  and the chest entries closed and drops any bomb. The bomb scenarios (placement tile/id convention,
  occupied-tile no-op, no-bombs bubble, fall under gravity, landing on ground/bridge/crumbling floor,
  detonation timing/blast/damage/knockback, fell-out removal), the ladder scenarios (deploy trigger,
  one-way unroll cadence/landing, effective terrain, survive-death) and the chest scenarios (open
  trigger, key cost, fact reveal, open state, chests counter, all-chests-open completion, no-key hint)
  keep their assertions, updated only to the merged state shape and the `entity`/`state` helpers.
- **`entities/WorldType.test.ts`**: `...Object.values(DEPLOYABLE_ITEM_TYPES)` joins the `draw`
  conformance list; a new case asserts each registry key equals its entry's `key` and its states'
  `kind`. `DEPLOYABLE_ITEM_TYPES` is **not** added to the `box`-conformance list (box is optional); the
  chest keeps its explicit `chestDeployableItem.box` membership and the existing chest-box cases.
- **`entities/chests/index.test.ts`**: keeps the closed/open sheet assertions; adds the sheet/constant
  agreement assertions for the local-literal cycle break, and asserts the entry's `key`/`kind` and
  `interactionPriority`.
- **`editor/*`**: `drawDeployableLadders`/`drawChests` mocks and assertions → `drawDeployableItems`;
  `synthesizeLadderBundleStates` emits `kind:'ladder'` + `x`/`y`; `synthesizeChestStates` emits
  `kind:'chest'` + `col`/`row`.

New co-located coverage: `entities/deployableItems/index.test.ts` (registry `key`/`kind` conformance,
`applyDeployableItemTerrain` identity/fold/order, `proposeDeployableItemInteraction` priority/hint);
`entities/deployableItems/Bomb.test.ts` (the one-home guarantee); `entities/chests/Chest.test.ts` (the
chest entry's `onPlayerInteract`); `engine/Renderer.test.ts` (`drawDeployableItems` band filter +
delegation); `PlatformerState.test.ts` (the two-phase dispatch, the per-kind reset scopes and the
interaction dispatch). No `it.skip`/`xit` or deleted `describe` is permitted for any migrated
scenario; only the bomb/ladder test files' own relocation and the pickup test merge remove a file.

All other affected tests are mechanical (import paths, a `kind`/`col`/`row` field added to fixtures,
mock renames, `DEPLOYABLE_ITEM_TYPES` joining the conformance list). `PlatformerPage.test.tsx` may use
a test-local `deployableItemsOfKind(items, 'bomb')` helper to keep its placed-bomb assertions
readable; that helper lives in the test file, not production.

## Complexity Tracking

> No constitution violations — this table is intentionally empty.

## Verification (Phase 1 exit)

Phase 0 and Phase 1 outputs are complete: [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md). The
post-design Constitution Check re-evaluation is recorded at the end of `research.md`. The next command
(`/speckit.tasks`) turns this design into an ordered task list; implementation and the manual browser
pass (SC-007) follow only when explicitly invoked.
