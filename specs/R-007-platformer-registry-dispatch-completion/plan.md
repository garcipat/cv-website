# Implementation Plan: Platformer Registry Dispatch Completion

**Branch**: `R-007-platformer-registry-dispatch-completion` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/R-007-platformer-registry-dispatch-completion/spec.md`

## Summary

R-007 is the Phase 5 "Registry Dispatch Completion" slice of the Platformer Architecture Refactor
(issue #95; analysis findings **D2**, **D3**). It closes the last places the platformer engine
hand-codes a kind switch instead of dispatching through a family registry. Nothing player-visible
changes: the acceptance bar is **byte-for-byte behaviour preservation** (FR-010, US3, SC-005/SC-006).

Concretely, the feature:

1. Gives `EnemyType` an **optional** `onDefeat(enemy, defeat)` hook that fires a defeated enemy's
   consequences through a supplied `defeat` API (spawn pickup / reveal fact / bump counter), deletes
   `ItemKind` and re-types `heldItem` to `PickupKind | null`, and moves the defeat gating into one
   shared reward applier (`state/enemyRewards.ts`) that owns the unconditional puff and the
   `rewardGiven`/`deathEffectGiven` flags — so `PlatformerPage.tsx` no longer names any enemy or drop
   kind and no longer imports `spawnKeyPickup` (D2).
2. Gives `HazardType` `knocksBack: boolean`, a `withTickState(placement, timers)` merge hook, and an
   `armTriggerRects?(hazard, timers)` trigger hook (plus a caller-supplied `HazardTickContext`
   bundle), so `hazardPlacementsForTick`, `Collision.ts`'s hazard-trigger detection, and the page's
   hazard-damage block all stop branching on `hazardType` (D3).

**Honest boundaries (recorded, not deviations).** A brand-new *armed-then-cycle hazard* still declares
its timer signal + a `hazardTimerStores` entry in `PlatformerState.ts` (where signals live), exactly as
R-006 records for a new pickup *family*; the detection/merge/knockback layers need no edit. The shared
reward applier's `bumpCounter` flush computes the numerator as `enemiesDefeated.value`, exact today
because `'enemies'` is the only counter an enemy defeat bumps. Both are stated in
[research.md](./research.md#r5) / [research.md](./research.md#r9).

## Technical Context

**Language/Version**: TypeScript (strict mode, no `any`) in a Vite 6 + React 19 project. The
platformer theme lives under `src/themes/platformer/` and follows the pure-module / co-located-test
conventions in [docs/Architecture.md](../../docs/Architecture.md).

**Primary Dependencies**: None added — this is a pure refactor. Existing: `@preact/signals-react`,
React 19, Tailwind CSS 4, Vitest. No new runtime or dev dependency (constitution Principle V).

**Storage**: N/A. No JSON data, level, marker, sprite asset, or `localStorage` shape change
(Assumptions: "No data migration"). Only TypeScript types, hook signatures and module homes move.

**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md).
Every `engine/`/`entities/`/`level/` module carries a co-located `.test.ts`. This feature **relocates
and restructures** existing tests (never deletes, weakens or skips them — FR-011/SC-005) and adds
co-located unit tests for the new hooks/applier/metadata. The most affected suites are
`engine/Collision.test.ts` (two hazard-trigger describes → one `checkHazardArmTriggers`),
`PlatformerState.test.ts` (`hazardPlacementsForTick`/`levelTotals`/`cratesDestroyed`/`enemiesDefeated`
→ generic forms), `PlatformerPage.test.tsx` (enemy-defeat and hazard-damage blocks → applier/hook
forms), and `entities/enemies/index.test.ts` ("heldItem drop wiring" → "onDefeat wiring"). See
"Test Migration & Restructuring" below.

**Target Platform**: Browser (static site; the platformer renders to a `<canvas>` in the web app).

**Project Type**: Web application (a self-contained game theme inside the CV website).

**Performance Goals**: The game loop is frame-driven (60 fps target). The generic paths must not add
per-frame allocation beyond what exists today: `checkHazardArmTriggers` re-uses the existing
`aabbOverlap`/`playerHitbox` helpers and returns the same ids; `hazardPlacementsForTick` allocates one
`HazardTickContext` per call (the current code already allocates one mapped placement array per call);
`applyEnemyDefeats` allocates one `DefeatApi` per fresh defeat and one `Set` per tick — the same shape
as the current inline loop's per-tick bookkeeping. `levelTotals` iterates the same placement arrays at
the same computed-invalidation frequency (still one combined computed off `currentLayout` + `currentCV`).

**Constraints**:
- **Byte-for-byte behaviour preservation** — the only sanctioned changes are the two dispatch moves,
  the `ItemKind`→`PickupKind` unification, the shared applier, the hazard hooks + trigger relocation,
  and the corresponding import/name updates (spec Assumptions).
- **Layer invariants** (R-001 FR-002/FR-008/FR-010, SC-008; FR-013): `contracts/` stays a strict leaf;
  no new `level/ → engine/`, no new `engine/ → state/`, no new `entities/ → state/` edge. The
  `withTickState`/`armTriggerRects` hooks read only their parameters; `HazardTickContext` types its
  crumbling-floor input as `GridTimerState` (not `engine/CrumblingFloor`) and its blocks as
  `BlockPlacement` (not `BlockState`).
- **One home per concept** — no compatibility re-export, alias or second code path for a removed
  function or moved module (FR-012).
- **No gameplay, tuning, visual, level-data or translation change** (FR-010; spec Out of Scope).
- **No auto-commits** (constitution Development Workflow; AGENTS.md).

**Scale/Scope**: 3 user stories, ~13 production modules touched, 1 module created
(`state/enemyRewards.ts`), 0 deleted modules (only symbols are deleted), ~11 test files updated. The
largest single change is the page's enemy-defeat block (`PlatformerPage.tsx` ~1272–1367) being replaced
by a one-line `applyEnemyDefeats` call.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Outcome | Notes |
| --- | --- | --- |
| **I. Typed Data Architecture** | ✅ PASS | No `src/data/` JSON is touched. All new/changed types (`DefeatApi`, `onDefeat`, `knocksBack`, `withTickState`, `armTriggerRects`, `HazardTickContext`) are fully typed under TypeScript strict with no `any`. `ItemKind` is deleted, not weakened. |
| **II. Testing (NON-NEGOTIABLE)** | ✅ PASS | Behaviour-preserving refactor: the full existing suite passes with import paths and hook/API shapes migrated only (FR-011). The new hooks/applier/metadata are TDD'd with co-located unit tests asserting every existing scenario, gate and ordering rule (Vitest, `{method}-{condition}-{expected-result}` naming). No test is deleted, skipped or weakened; the plan enumerates the restructured suites and the reshaped assertions below. |
| **III. Code Quality & Component Standards** | ✅ PASS | No UI component or shadcn/ui change. New modules use named arrow-function exports; no default exports introduced. Hook members use method syntax / plain `(…) => …` arrows consistent with the existing registries. |
| **IV. No Feature Bloat** | ✅ PASS | A discrete, spec'd refactor feature (`R-007`) with its own spec folder. It adds no player-facing capability; it removes hand-coded kind switches and dead vocabulary (`ItemKind`). `docs/Features.md`'s dependency diagram is updated on completion per AGENTS.md. |
| **V. Performance & Static Delivery** | ✅ PASS | No new dependency; no per-frame allocation added beyond the current shape (see Performance Goals); dead-code removal may shrink the bundle. |
| **Development Workflow** | ✅ PASS | Feature branch/PR flow; no auto-commits. Because the platformer has visible behaviour, SC-006's manual browser pass is a required review step in addition to the test suite (constitution: "a passing test suite is not evidence that the change looks or feels right"). |

**Gate result**: No violations. Proceeding without complexity tracking.

_Post-Phase-1 re-check_: PASS, unchanged — the design introduced only leaf-safe `contracts/` types
(`DefeatApi` in `Outcome.ts`), one new state-layer module (`state/enemyRewards.ts`, no new dependency
edge), and kind-owned hooks that read only their parameters. See
[research.md](./research.md#r12--layer-and-constitution-re-check).

## Project Structure

### Documentation (this feature)

```text
specs/R-007-platformer-registry-dispatch-completion/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — resolved decisions + code-validated findings
├── data-model.md        # Phase 1 output — types, module map, relationships
├── quickstart.md        # Phase 1 output — build/test/inspect + manual browser pass
├── contracts/           # Phase 1 output — interface contracts
│   ├── enemy-defeat.md      # DefeatApi + EnemyType.onDefeat + shared applier
│   └── hazard-dispatch.md   # knocksBack / withTickState / armTriggerRects + HazardTickContext
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by this command)
```

### Source Code (repository root)

The platformer theme is a single self-contained tree under `src/themes/platformer/`. No new top-level
project is added; the change is confined to that tree.

```text
src/themes/platformer/
├── contracts/
│   └── Outcome.ts                       # MODIFIED — adds DefeatApi (leaf; already imports
│                                        #   CollectedFact/PickupKind/CounterPopupLabelKey)
├── entities/
│   ├── enemies/
│   │   ├── EnemyType.ts                 # MODIFIED — ItemKind DELETED; heldItem: PickupKind|null;
│   │   │                                #   onDefeat?(enemy, defeat)
│   │   ├── SlimePurple.ts               # MODIFIED — heldItem stays 'key' (re-typed); adds onDefeat
│   │   ├── SlimeGreen.ts                # MODIFIED — adds onDefeat (reveal facts + bump 'enemies')
│   │   ├── Bee.ts                       # UNCHANGED — no onDefeat, heldItem null
│   │   └── index.test.ts                # MODIFIED — "heldItem drop wiring" → "onDefeat wiring"
│   ├── hazards/
│   │   ├── HazardType.ts                # MODIFIED — knocksBack; withTickState?; armTriggerRects?;
│   │   │                                #   HazardTickContext (bundle)
│   │   ├── Spike.ts                     # MODIFIED — knocksBack: true
│   │   ├── Spear.ts                     # MODIFIED — knocksBack: true
│   │   ├── FloorSpike.ts                # MODIFIED — knocksBack: false; withTickState; armTriggerRects
│   │   │                                #   (floorSpikeTriggerBox moves here from Collision.ts)
│   │   └── FallingStalactite.ts         # MODIFIED — knocksBack: false; withTickState; armTriggerRects
├── state/
│   └── enemyRewards.ts                  # NEW — applyEnemyDefeats + EnemyDefeatContext (the shared
│                                        #   applier: puff + rewardGiven/deathEffectGiven + DefeatApi)
├── engine/
│   └── Collision.ts                     # MODIFIED — checkHazardArmTriggers replaces
│                                        #   checkFloorSpikeTriggers/checkFallingStalactiteTriggers +
│                                        #   floorSpikeTriggerBox (all deleted)
├── PlatformerState.ts                   # MODIFIED — hazardPlacementsForTick uses withTickState;
│   │                                    #   armHazardTrigger + hazardTimerStores; drops 6 helper imports
├── PlatformerState.test.ts              # MODIFIED — generic-form assertions (same numeric expectations)
├── PlatformerPage.tsx                   # MODIFIED — defeat block → applyEnemyDefeats; damage →
│   │                                    #   typeOf(hazard).knocksBack; arming → checkHazardArmTriggers
│   │                                    #   + armHazardTrigger; drops spawnKeyPickup import
└── PlatformerPage.test.tsx              # MODIFIED — applier/hook forms; scenarios preserved
```

**Structure Decision**: The single-project platformer tree is retained. The `DefeatApi` joins the
existing `contracts/Outcome.ts` (the one home for contact/hit vocabulary, whose doc comment already
promises the `onDefeat(entity, world)` shape). The shared applier goes to `state/` beside
`rewards.ts` (`RewardReveal`), where signals live and where R-011/R-012 will later decompose them. The
hazard bundle and hooks live in `entities/hazards/` (kind-owned, parameter-only). No folder
re-organisation; this feature only adds one state module, extends the enemy + hazard registries +
`Outcome.ts`, and deletes symbols, preserving R-001's layer boundaries.

## Test Migration & Restructuring

FR-011/SC-005 require that every existing test assertion is preserved — never weakened, skipped or
deleted. Four suites are **necessarily restructured** because the merged/re-homed functions change the
call surface, and their scenarios are re-expressed around the new hooks/metadata with the **same
numeric/behavioural expectations**:

- **`engine/Collision.test.ts`** (obligation): `checkFloorSpikeTriggers` and
  `checkFallingStalactiteTriggers` describes become `checkHazardArmTriggers` scenarios. Each existing
  `it` is re-expressed with the generic signature and the same expected ids, preserving the gates that
  MUST remain asserted: floor spike eligibility (only an at-rest spike arms; an already-armed spike is
  excluded), stalactite eligibility (only a hanging stalactite arms; armed is excluded), and the
  detection-zone overlap geometry (the same cell-rect assertions).
- **`PlatformerState.test.ts`** (obligation): `hazardPlacementsForTick` tests assert the merged
  placement via the kind's `withTickState` (same phase/extension/offset/shake values).
- **`PlatformerPage.test.tsx`** (obligation): the enemy-defeat describe asserts the applier form — a
  purple slime's `onDefeat` spawns the key through the defeat API (not `spawnKeyPickup`), a green
  slime's reveals facts and bumps the counter once, a bee puffs and rewards nothing, and the revived
  slime puffs but drops nothing; the `spawnKeyPickup` import/fixture at line ~1695 is removed. The
  hazard-damage describe asserts `knocksBack`-driven knockback with the crouch suppression unchanged.
- **`entities/enemies/index.test.ts`** (obligation): the "heldItem drop wiring" describe becomes
  "onDefeat wiring" — `slimePurple` has an `onDefeat` that spawns its held key, `slimeGreen` has one
  that reveals facts and bumps `'enemies'`, `bee` has none; the `heldItem === 'key'`/`null` assertions
  stay (re-typed `PickupKind`).

New co-located coverage: `state/enemyRewards.test.ts` (fresh defeat invokes `onDefeat` once; puff is
unconditional; `rewardGiven`/`deathEffectGiven` are set for every defeated id; the bump dedupes per key
and reads the tick-final numerator); `entities/hazards/{FloorSpike,FallingStalactite,Spike,Spear}.test.ts`
(`knocksBack`, `withTickState` byte-identical merge, `armTriggerRects` armed-fold). All other
affected tests are mechanical (import paths, `heldItem` type, mock renames).

## Complexity Tracking

> No constitution violations — this table is intentionally empty.

## Verification (Phase 1 exit)

Phase 0 and Phase 1 outputs are complete: [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/](./contracts/), [quickstart.md](./quickstart.md). The post-design Constitution Check
re-evaluation is recorded at the end of `research.md`. The next command (`/speckit.tasks`) turns this
design into an ordered task list; implementation and the manual browser pass (SC-006) follow only when
explicitly invoked.
