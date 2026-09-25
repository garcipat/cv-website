# Implementation Plan: Platformer Pickup Unification

**Branch**: `R-006-platformer-pickup-unification` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/R-006-platformer-pickup-unification/spec.md`

> **Re-plan (2026-09-25, after spec amendment).** This plan was regenerated after the spec gained
> its collect-once clarification: **`collected: boolean` on the shared `Pickup` model is the single
> collect-once mechanism**, every kind is stored and flagged (nothing is removed on collect), the
> old per-kind `PickupDisposition = 'remove' | 'flag' | 'dedup'` vocabulary and the external
> `collectedCollectibleIds` set are deleted, and permanence is expressed **only** by array reset
> scope. This plan, [research.md](./research.md), [data-model.md](./data-model.md),
> [contracts/](./contracts/) and [quickstart.md](./quickstart.md) all reflect that amendment.

## Summary

R-006 is the Phase 4 "Pickup Unification" slice of the Platformer Architecture Refactor (issue #94;
analysis findings **D1**, **X6/F9**, **L1**). It gives every pickup a shared discriminator so the
engine dispatches generically instead of naming pickup kinds, and colocates each pickup family's
state/constants with its `PickupType` view. Nothing player-visible changes: the acceptance bar is
**byte-for-byte behaviour preservation** (FR-009/FR-010, SC-004/SC-005).

Concretely, the feature:

1. Adds a shared `Pickup` base (`id`, stored `x`/`y`, `kind`, **`collected: boolean`**) to a new
   `contracts/Pickup.ts`, beside `PickupKind`. `level/CollectibleMapper`'s `CollectiblePlacement`
   composes it with `kind: 'coin'`, replacing its `spriteType: 'coin'` field. `collected` is the one
   collect-once flag every kind and the placed coin share.
2. Collapses each pickup family to exactly one self-contained module under `entities/pickups/`
   (`Coin`, `Fruit`, `Key`, `Heart`, `Bomb`), owning both its state/constants and its `PickupType`
   view, and deletes the top-level `entities/{Fruit,Coin,KeyPickup,HeartPickup,BombPickup}.ts`.
3. Gives `PickupType<S>` a spawn seam and a collect seam (`spawn`, `onPickup`, plus the eligibility
   metadata the two generic paths need: an optional per-kind `isCollectible` extra gate and an
   optional `maxPerTick` cap; `drawLayer` for the draw band), so the page no longer names a pickup
   kind. `onPickup` returns **only consequences** (facts, counter, heal, bombs, banked key, flying
   text) — there is no `disposition`, no `self`, and no per-kind remove/flag special case.
4. Replaces the five family-specific collision functions with one generic `checkPickupCollisions`,
   whose base eligibility gate is the shared `!state.collected` (plus each kind's extra gate), and
   the five draw wrappers with one generic `drawPickups` (**invoked at the three draw bands that
   preserve the current ordering**; visibility is the shared `!state.collected`, so it takes no
   collected-id set). `editor/EditorCanvas` becomes a second caller of `drawPickups`, so no
   `drawCollectibles` symbol remains.
5. Keeps the already-retired dormant placed-fruit vocabulary retired while keeping the live
   question-mark reward `'fruit'` kind working.
6. Holds the level-derived base coins as **mutable, flag-carrying state** in `PlatformerState`
   (re-derived on level change / by `resetGameProgress()`), so a placed coin's `collected` flag
   persists across death/respawn without the deleted external id set. Permanence is expressed
   **only** by array reset scope.

**Documented deviation from issue #94 (required):** issue #94's literal wording asks to drop the
`'fruit'` member of `PickupKind` and the placed-fruit `PickupType`. R-006 deliberately does **not**
remove the live `'fruit'` kind, and `entities/pickups/Fruit.ts` survives as the merged reward-fruit
module. R-006 retires only the already-dead placed-fruit artifacts. This is mandated by the spec's
Clarifications, FR-006, US4 and Assumptions and is recorded in
[research.md](./research.md#r2--the-fruit-kind-stays-a-deliberate-deviation-from-issue-94). See
"Documented Deviation" below.

**Precision on draw depth:** no pickup grouping may collapse the draw bands. The *authoritative*
requirement is FR-003's "draw depth/order relative to blocks, terrain, enemies, effects and the
water foreground" / US1-AC3's "invoked at the depths needed to preserve the current draw order and
depth relative to ... enemies". The current page draws coins **before** enemies but keys/hearts/bombs
**after** enemies, so order preservation needs **three** bands: fruit before blocks, coins after
mid-world effects but before enemies, key/heart/bomb after enemies. The spec (Clarifications,
US1-AC3, FR-003) states these three bands. Recorded in
[research.md](./research.md#r8--drawpickups--per-type-index-and-the-actual-draw-bands).

**Precision on collect-once:** SC-008 is the bar. Exactly one mechanism exists — `collected` on the
shared `Pickup` model — and a future permanent pickup kind needs no new machinery: it composes
`Pickup` (and so gets `collected`) and simply is not cleared from its array on death/respawn. There
is no `collectedCollectibleIds`, no per-kind removal, and no per-kind flag special case anywhere.
Recorded in [research.md](./research.md#r7--one-generic-checkpickupcollisions) and
[research.md](./research.md#r9--page-and-state-dispatch-pickupstores--pickupgroups).

## Technical Context

**Language/Version**: TypeScript (strict mode, no `any`) in a Vite 6 + React 19 project. The
platformer theme lives under `src/themes/platformer/` and follows the pure-module / co-located-test
conventions in [docs/Architecture.md](../../docs/Architecture.md).

**Primary Dependencies**: None added — this is a pure refactor. Existing: `@preact/signals-react`,
React 19, Tailwind CSS 4, Vitest. No new runtime or dev dependency (constitution Principle V:
bundle size must not regress; dead-code removal may shrink it slightly).

**Storage**: N/A. No JSON data, level, marker, sprite asset, or `localStorage` shape change
(Assumptions: "No data migration"). Only TypeScript types and module homes move. The one
state-holding change is in memory: the level-derived base coins gain a mutable, flag-carrying signal
in `PlatformerState` (see "Technical approach — the mutable base-coin signal" below).

**Testing**: Vitest + React Testing Library + jsdom, per
[docs/TestingGuide.md](../../docs/TestingGuide.md). Every `engine/`/`entities/`/`level/` module
carries a co-located `.test.ts`. This feature **relocates and restructures** existing tests (never
deletes, weakens or skips them — FR-010/SC-004/SC-008) and adds co-located unit tests for the new
contract/dispatch seams. The two most affected suites are `engine/Collision.test.ts` (five family
collision describes → one generic API) and `engine/Renderer.test.ts` (five draw-wrapper describes →
one `drawPickups`); the collection-storage change also reshapes the coin-dedup and reset-scope
scenarios in `PlatformerState.test.ts` and `PlatformerPage.test.tsx`. Every existing scenario,
eligibility gate and reset scope stays asserted — see "Test Migration & Restructuring" below.

**Target Platform**: Browser (static site; the platformer renders to a `<canvas>` in the web app).

**Project Type**: Web application (a self-contained game theme inside the CV website).

**Performance Goals**: The game loop is frame-driven (60 fps target). The generic paths must not add
per-frame allocation beyond what exists today: `checkPickupCollisions` re-uses the existing
`overlappingTriggers` helper and returns the same per-kind id/state lists; `drawPickups` keeps the
current allocate-one-`typeCounts`-object-per-call shape. The fruit's stored `y` is updated in
`tickFruit`, i.e. the same site that already maps the array each tick. The mutable base-coin signal
is written only when a coin is collected (one map per hit kind per tick, the same shape as the old
`collectedCollectibleIds` set write) and when `resetGameProgress()` re-derives it — `levelTotals`
deliberately keeps reading the pure `collectiblePlacements` computed so a coin collect does not
invalidate the totals.

**Constraints**:
- **Byte-for-byte behaviour preservation** — the only sanctioned changes are the discriminator
  addition, the unified `collected` flag (retained entries instead of removal / an external id set),
  the generic dispatch, the colocation moves, the spawn/collect seam, the retirement of dead
  placed-fruit vocabulary, and the corresponding import/name updates (spec Assumptions).
- **One collect-once mechanism** (FR-002/SC-008): `collected` on the shared `Pickup` model is the
  only collect-once state. No `collectedCollectibleIds`, no per-kind removal, no per-kind flag
  special case. Permanence is array reset scope alone: `resetGame()` keeps the coin/fruit/key arrays
  (flags intact) and clears the heart/bomb arrays + placed bombs; `resetGameProgress()` clears every
  pickup array and re-derives the placed coins uncollected.
- **Layer invariants** (R-001 FR-002/FR-008/FR-010, SC-007): `contracts/` stays a strict leaf
  (imports nothing from `engine/`/`entities/`/`level/`/state, only itself and the shared top-level
  `types.ts`); no new `level/ → engine/`, no new `engine/ → state/`, no `contracts/ → level/`/
  `contracts/ → entities/` edge. The shared `Pickup` base and `PickupKind` both stay `contracts/`
  leaves; `entities/pickups/Coin.ts`'s existing `level/CollectibleMapper` import is unchanged.
- **Per-kind arrays stay** (Clarifications — draw-depth/collection answer): no merged collection;
  each family keeps its own signal array, reset scope and counter.
- **One home per concept** — no compatibility re-export, alias or second code path for a removed
  function or moved module (FR-011).
- **No gameplay, tuning, visual, level-data or translation change** (FR-009; spec Out of Scope).
- **No auto-commits** (constitution Development Workflow; AGENTS.md).

**Scale/Scope**: 5 user stories, ~20 production modules touched, 5 modules deleted, 2 modules created
under `contracts/`, ~14 test files updated. The largest single change is the page's collect/spawn path
(`PlatformerPage.tsx` ~1385–1567 and ~2039–2084) being replaced by the generic outcome applier and
`PickupType.spawn`.

### Technical approach — the mutable base-coin signal

The base coin placements are **level-derived** (`collectiblePlacements = computed(() =>
placeCollectibles(COIN_TILES.value))`), so they are recomputed whenever the level changes and are a
`computed`, not writable state. Under the amended spec a placed coin's `collected` flag must live on
its own state and survive death/respawn, and the external `collectedCollectibleIds` set is gone — so
`PlatformerState` must hold the base coins mutably:

- Keep `collectiblePlacements` as the **pure, level-derived** placements. It is still the source for
  `levelTotals`'s coin count (which the doc comment deliberately keeps uninvalidated by pot drops).
- Add `baseCoinPlacements = signal<CollectiblePlacement[]>`, **initialised** from
  `collectiblePlacements.value` (each entry normalised to `collected: false`) and **re-derived** on
  level change by `resetGameProgress()` (the editor's Try button already routes
  `currentLayout`/`currentMarkers` changes through `resetGameProgress()` — see
  `editor/editorActions.ts` — so that is the re-derivation seam; no signals effect is introduced).
- `spawnedCoinPlacements` stays the signal for coin-pot drops (each entry gains `collected`).
- `allCollectiblePlacements = computed(() => [...baseCoinPlacements.value,
  ...spawnedCoinPlacements.value])` remains the single read view for collision/draw/totals.

This is exactly the spec's FR-006 requirement ("`PlatformerState` MUST hold the coin state as mutable,
flag-carrying state, re-derived when the level changes and on full reset") and is the only new
mutable signal the feature introduces.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Outcome | Notes |
| --- | --- | --- |
| **I. Typed Data Architecture** | ✅ PASS | No `src/data/` JSON is touched. All new/changed types (`Pickup` — including `collected`, `PickupGroups`, the `PickupType` seam, `PickupHit`, the collect outcome vocabulary) are fully typed under TypeScript strict with no `any`. `PickupKind` remains a `contracts/` leaf vocabulary and `PICKUP_TYPES` stays pinned to it via `Record<PickupKind, PickupType<Pickup>>`, so a kind added to one side without the other fails to compile (FR-001). |
| **II. Testing (NON-NEGOTIABLE)** | ✅ PASS | Behaviour-preserving refactor: the full existing suite passes with import paths and API/state shapes migrated only (FR-010). The generic collision/draw seams are TDD'd with tests that assert each existing scenario and eligibility gate (Vitest, `{method}-{condition}-{expected-result}` naming — [docs/TestingGuide.md](../../docs/TestingGuide.md)). The collection-storage change legitimately reshapes the coin-dedup and reset-scope tests (retained + flagged entries, no id set) but **every** existing scenario, gate and reset scope stays asserted — no test is deleted, skipped or weakened. The plan explicitly enumerates the two restructured suites and the reshaped storage tests below. Coverage targets unchanged (100% `src/lib/`, 80%+ `src/components/`; the platformer is neither, so the bar is "all existing assertions preserved and green"). |
| **III. Code Quality & Component Standards** | ✅ PASS | No UI component or shadcn/ui change. New modules use named arrow-function exports; no default exports introduced. The `PickupType` contract uses method syntax deliberately (see research R6) so the registry widening keeps strict typing without `any`. |
| **IV. No Feature Bloat** | ✅ PASS | A discrete, spec'd refactor feature (`R-006`) with its own spec folder. It adds no player-facing capability; it removes dispatch special-cases, dead vocabulary, the external collected-id set and the per-kind disposition machinery. `docs/Features.md`'s dependency diagram is updated on completion per AGENTS.md. |
| **V. Performance & Static Delivery** | ✅ PASS | No new dependency; no per-frame allocation added beyond the current shape; dead-code removal may shrink the bundle. The generic paths iterate the same arrays at the same frequencies; the mutable coin signal is written once per collection and on full reset. |
| **Development Workflow** | ✅ PASS | Feature branch/PR flow; no auto-commits. Because the platformer has visible behaviour, SC-005's manual browser pass is a required review step in addition to the test suite (constitution: "a passing test suite is not evidence that the change looks or feels right"). |

**Gate result**: No violations. Proceeding without complexity tracking.

_Post-Phase-1 re-check_: PASS, unchanged — the design introduced only leaf-safe `contracts/` types,
one mutable signal in the state layer (no new dependency edge), and no change to tuning/gates/reset
scopes. See the closing section of [research.md](./research.md#r11--layer-and-constitution-re-check).

## Project Structure

### Documentation (this feature)

```text
specs/R-006-platformer-pickup-unification/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — resolved decisions + code-validated findings
├── data-model.md        # Phase 1 output — types, module map, relationships
├── quickstart.md        # Phase 1 output — build/test/inspect + manual browser pass
├── contracts/           # Phase 1 output — interface contracts
│   ├── pickup-contracts.md   # Pickup base (incl. collected) + PickupKind + CollectiblePlacement
│   ├── pickup-type.md        # PickupType<S> seam + collect outcome vocabulary
│   └── generic-dispatch.md   # checkPickupCollisions + drawPickups + page/editor wiring
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by this command)
```

### Source Code (repository root)

The platformer theme is a single self-contained tree under `src/themes/platformer/`. No new
top-level project is added; the change is confined to that tree.

```text
src/themes/platformer/
├── contracts/
│   ├── Pickup.ts                   # NEW — shared Pickup base (id, x, y, kind, collected)
│   │                               #       + PickupGroups (leaf)
│   ├── PickupOutcome.ts            # NEW — PickupReveal/PickupOutcome/PickupCollisionContext/
│   │                               #       PickupContext (leaf; NO PickupDisposition, NO self)
│   ├── PickupKind.ts               # UNCHANGED — 'coin'|'fruit'|'key'|'heart'|'bomb' (FR-006: fruit stays)
│   └── ... (capabilities, counters, DrawContext, geometry, Outcome, PhysicsConfig, SpriteLookup, WorldType)
├── entities/
│   ├── Fruit.ts                    # DELETED — merged into pickups/Fruit.ts
│   ├── Fruit.test.ts               # DELETED — relocated/merged into pickups/Fruit.test.ts
│   ├── Coin.ts                     # DELETED — merged into pickups/Coin.ts
│   ├── Coin.test.ts                # DELETED — relocated/merged into pickups/Coin.test.ts
│   ├── KeyPickup.ts                # DELETED — merged into pickups/Key.ts
│   ├── KeyPickup.test.ts           # DELETED — relocated/merged into pickups/Key.test.ts
│   ├── HeartPickup.ts              # DELETED — merged into pickups/Heart.ts
│   ├── HeartPickup.test.ts         # DELETED — relocated/merged into pickups/Heart.test.ts
│   ├── BombPickup.ts               # DELETED — merged into pickups/Bomb.ts
│   ├── BombPickup.test.ts          # DELETED — relocated/merged into pickups/Bomb.test.ts
│   ├── Health.ts                   # UNCHANGED (not a pickup)
│   ├── Torch.ts                    # UNCHANGED (not a pickup)
│   ├── sprites/sheets.ts           # MODIFIED — sheet geometry literal for KEY/COIN/FRUIT (breaks the
│   │                               #   new sheets↔pickups cycle, research R4); still imports Health
│   ├── enemies/SlimePurple.ts      # MODIFIED — KEY_FRAME_* import retargets to pickups/Key
│   ├── CollectiblesSummary.ts      # UNCHANGED (counters, not a pickup)
│   └── pickups/
│       ├── PickupType.ts           # MODIFIED — adds spawn/isCollectible?/maxPerTick?/onPickup/
│       │                           #   drawLayer; S extends Pickup; isVisible REMOVED
│       ├── index.ts                # MODIFIED — PICKUP_TYPES: Record<PickupKind, PickupType<Pickup>>
│       ├── index.test.ts           # MODIFIED — kind/collected assertions; import paths
│       ├── PickupType.test.ts      # MODIFIED — import paths + sheet/constant agreement assertions
│       ├── Coin.ts                 # MERGED — entities/Coin.ts + current view; kind:'coin'
│       ├── Coin.test.ts            # MOVED/MERGED — entities/Coin.test.ts
│       ├── Fruit.ts                # MERGED — entities/Fruit.ts + current view; kind:'fruit', stored y,
│       │                           #   collected
│       ├── Fruit.test.ts           # MOVED/MERGED — entities/Fruit.test.ts
│       ├── Key.ts                  # MERGED — entities/KeyPickup.ts + current view; kind:'key',
│       │                           #   collected from Pickup (no inline field)
│       ├── Key.test.ts             # MOVED/MERGED — entities/KeyPickup.test.ts
│       ├── Heart.ts                # MERGED — entities/HeartPickup.ts + current view; kind:'heart'
│       ├── Heart.test.ts           # MOVED/MERGED — entities/HeartPickup.test.ts
│       ├── Bomb.ts                 # MERGED — entities/BombPickup.ts + current view; kind:'bomb'
│       └── Bomb.test.ts            # MOVED/MERGED — entities/BombPickup.test.ts
├── engine/
│   ├── Collision.ts                # MODIFIED — five family fns → one checkPickupCollisions
│   ├── Collision.test.ts           # RESTRUCTURED — see "Test Migration & Restructuring"
│   ├── Renderer.ts                 # MODIFIED — five draw wrappers → one drawPickups
│   └── Renderer.test.ts            # RESTRUCTURED — see "Test Migration & Restructuring"
├── level/
│   ├── CollectibleMapper.ts        # MODIFIED — CollectiblePlacement composes Pickup, kind:'coin',
│   │                               #   collected; spriteType removed
│   └── CollectibleMapper.test.ts   # MODIFIED — spriteType → kind/collected
├── editor/
│   ├── gridRenderState.ts          # MODIFIED — synthesizeCollectiblePlacements emits
│   │                               #   kind:'coin', collected:false
│   ├── gridRenderState.test.ts     # MODIFIED — spriteType → kind/collected
│   ├── EditorCanvas.tsx            # MODIFIED — routes through drawPickups (all placements
│   │                               #   collected:false; no collected-id set)
│   ├── EditorCanvas.test.tsx       # MODIFIED — drawCollectibles mock → drawPickups (no id set)
│   ├── EditorToolbar.test.tsx      # MODIFIED — Renderer mock rename
│   └── LevelEditorPage.test.tsx    # MODIFIED — Renderer mock rename; `collectedCollectibleIds`
│                                   #   fixtures → base-coin `collected` flags; Try re-derives base coins
├── components/
│   ├── Journal.tsx                 # MODIFIED — collected-collectible count → coin `collected` flags;
│   │                               #   spriteType → kind; COIN_*/FRUIT_* import retargets
│   └── Journal.test.tsx            # MODIFIED — collectedCollectibleIds fixtures → base-coin flags;
│                                   #   spriteType → kind
├── PlatformerState.ts              # MODIFIED — mutable baseCoinPlacements + pickupStores/pickupGroups;
│   │                               #   collectedCollectibleIds DELETED; spriteType → kind; reset scopes
├── PlatformerState.test.ts         # MODIFIED — base-coin flag persistence/re-derivation;
│   │                               #   collectedCollectibleIds tests re-expressed
├── PlatformerPage.tsx              # MODIFIED — generic draw/collision/spawn/collect; no kind names
└── PlatformerPage.test.tsx         # MODIFIED — kind/collected-shape updates; scenarios preserved
```

**Structure Decision**: The single-project platformer tree is retained. The shared base goes to
`contracts/` (spec Clarification Q8: shared vocabulary, so `level/CollectibleMapper` and every pickup
module reach it downward without a new `level/ → entities/` edge or a file cycle). Each pickup family
merges into one module under the existing `entities/pickups/` folder (spec Clarification Q7 / US3).
The two generic dispatch functions stay in `engine/` (`Collision.ts`, `Renderer.ts`), mirroring how
blocks/enemies/hazards already dispatch. The per-kind live arrays and the new kind→store registry
stay in the state layer (`PlatformerState.ts`) — that is where signals live and where R-011/R-012
will later decompose them. No folder re-organisation; this feature only adds/merges modules, adds one
mutable coin signal, and retargets imports, preserving R-001's layer boundaries.

## Documented Deviation from Issue #94

Issue #94's literal wording asks to **drop the `'fruit'` member of `PickupKind`** and to drop
`entities/pickups/Fruit.ts` as part of retiring the placed-fruit path. R-006 deliberately keeps both:

- The only live fruit today is the question-mark block's spawned reward (renamed from `bonusFruit` by
  R-002 FR-022). `PICKUP_TYPES.fruit` is used by the fruit's collision check and drawing,
  `RewardEffects.spawnPickup` and `BlockMapper`'s question-mark outcome, and `PlatformerPage`'s fruit
  tick/reveal. Dropping `'fruit'` would break the registry and `spawnPickup` and would force a
  reward-vocabulary change that belongs to R-007 (analysis D2).
- R-002 FR-022 already removed the dormant pieces (`CollectibleMarkerPositions.fruit`, the
  `placeCollectibles` fruit branch, `entities/BonusFruit.ts`). R-006 finishes the remaining
  placed-fruit cleanup (`CollectiblePlacement.spriteType → kind: 'coin'`) and merges
  `entities/Fruit.ts`'s reward-fruit helpers into `entities/pickups/Fruit.ts`, which stays as the
  live reward kind's one module. Under the amended spec the reward fruit's collect-once behaviour is
  the shared `collected` flag (it is retained and flagged rather than removed) — the kind itself is
  unchanged.

This deviation is **spec-mandated** (Clarifications session 2026-09-25, FR-006, US4-AC3, Assumptions)
and must not be "fixed" during implementation. The issue's literal bullet is superseded, not executed.

## Test Migration & Restructuring

FR-010/SC-004/SC-008 require that every existing test assertion is preserved — never weakened, skipped
or deleted. Two suites are **necessarily restructured** because the merged five-into-one functions
change the call surface, and the collection-storage scenarios in the collision/renderer/state suites
**legitimately change shape** because the unified `collected` flag replaces the external id set and
per-kind removal. Every existing scenario, eligibility gate and reset scope MUST stay asserted around
the new generic API and the new flag-based form:

- **`engine/Collision.test.ts`** (obligation): the five `checkCollectibleCollisions` /
  `checkFruitCollisions` / `checkKeyPickupCollisions` / `checkHeartPickupCollisions` /
  `checkBombPickupCollisions` describes become `checkPickupCollisions` scenarios. The plan's contract
  (see [contracts/generic-dispatch.md](./contracts/generic-dispatch.md)) keeps each call mapped to the
  same input and outcome, so each existing `it` is re-expressed with the generic signature and the
  same expected ids/eligibility semantics. The eligibility gates that MUST remain individually
  asserted are: coin collect-once (an entry with `collected: true` is excluded; two uncollected
  placements returned in order — this REPLACES the old `collectedIds` set fixture with a flagged
  entry, and is not a weakened assertion); fruit rise gate (`elapsed >=
  FRUIT_RISE_DURATION_SECONDS`, mid-rise excluded); key collect-once (`collected: true` excluded);
  heart `hitPoints < MAX_HALF_HEARTS` (full-health excluded); bomb capacity clamp (`max(0, cap -
  count)` in array order, none at the cap). The crouched/standing head-band scenario ("every consumer
  reads the one crouched box") keeps asserting the same coin overlap outcome.
- **`engine/Renderer.test.ts`** (obligation): the `drawCollectibles` / `drawFruits` / `drawKeyPickups`
  / `drawHeartPickups` / `drawBombPickups` describes become `drawPickups` scenarios, and the
  collected-skip assertions are re-expressed as `collected: true` entries (no id set argument). Each
  existing visual assertion is preserved: coin frame/bob/size/index-stability and collected-skip;
  fruit rise position (drawn at its stored y) and pre-block band; key non-square size/bottom
  anchoring and collected-skip; heart/bomb size/offset and the empty-array no-op; and the combined
  visual-order test keeps asserting the same draw sequence via the new three-band calls.
- **`PlatformerState.test.ts` / `PlatformerPage.test.tsx`** (storage-shape change): the
  `collectedCollectibleIds` tests are re-expressed as base-coin `collected`-flag behaviour —
  collecting a placed coin flags it in `baseCoinPlacements` and it persists across `resetGame()`;
  `resetGameProgress()` re-derives the base coins uncollected and clears the spawned/dropped arrays;
  the coin-pacing `collectedBefore` count comes from flagged entries, not the set. Every existing
  reset-scope assertion (coins/fruits/keys persist on death; hearts/bombs + placed bombs clear;
  full reset clears all) stays asserted; no `it.skip`/`xit`/deleted `describe` is permitted for any
  migrated scenario.

All other affected tests are mechanical (`spriteType → kind`, `collected` field added to fixtures,
moved import paths, mock renames). `PlatformerPage.test.tsx`'s pickup scenarios (coin collection/
pacing, key bank + flag, heart heal/full-health, bomb cap, spawn-from-block, reset scopes) keep their
assertions, updated only to the new state shapes. New coverage asserts the SC-008 guarantee: exactly
one collect-once mechanism, and a pick-up of any kind is retained + flagged.

## Complexity Tracking

> No constitution violations — this table is intentionally empty.

## Verification (Phase 1 exit)

Phase 0 and Phase 1 outputs are complete: [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/](./contracts/), [quickstart.md](./quickstart.md). The post-design Constitution Check
re-evaluation is recorded at the end of `research.md`. The next command (`/speckit.tasks`) turns this
design into an ordered task list; implementation and the manual browser pass (SC-005) follow only when
explicitly invoked.
