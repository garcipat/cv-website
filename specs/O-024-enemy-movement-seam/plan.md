# Implementation Plan: Enemy Movement & Animation Seam + Bee

**Branch**: `O-024-enemy-movement-seam` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-024-enemy-movement-seam/spec.md`; authoritative design in [design.md](./design.md)

## Summary

Today every enemy shares one hardcoded movement routine (`stepEnemyPatrol`,
`engine/EnemyAI.ts`) and one hardcoded animation table (`ENEMY_ANIMATIONS`,
`entities/enemies/EnemyAnimation.ts`). This feature makes **how an enemy moves**
and **how it animates** per-kind choices, then ships the first flying enemy — a
**bee** — as the seam's end-to-end proof.

The technical approach is a **refactor behind a seam, not a behavior change**:

- A new `entities/enemies/movement/` folder defines a `MovementStrategy<S>` /
  `MovementContext` contract plus three concrete strategies: **`patrol`**
  (the existing ground behavior, extracted verbatim), **`fly`** (horizontal
  patrol with **no ledge check** + a sinusoidal vertical bob around the
  placement row), and **`chase`** (proximity-reactive pursuit, shipped tested
  but used by no kind).
- `EnemyType<S>` gains `movement: MovementStrategy<S>` and
  `defaultAnimState: string`; `patrolSpeedMultiplier` moves into the patrol
  strategy's config. The shared game loop applies `typeOf(enemy).movement.step(...)`
  instead of one routine.
- Each kind's `sprite.animations` becomes the source of truth for frames;
  `EnemyAnimState` widens to `string`; a requested state missing from a kind's
  table falls back to that kind's `defaultAnimState` (never throws, never blank).
- The bee (`entities/enemies/Bee.ts`, sheet `public/sprites/bee.png`, already
  present) is one new module plus one registry line, with a `q` level marker and
  editor-palette entry. It uses `fly`, is stompable like a green slime, drops
  nothing and counts toward nothing.
- The per-kind frame inset gains a **bottom** margin (`hitboxPaddingNative`
  `{ side, top, bottom }`): the bee's opaque art floats inside its 24×24 cell, so
  the collision box and render anchor are derived from the visible art's bottom
  edge. The slimes declare `bottom: 0` and are bit-for-bit unchanged.

The design follows [docs/Architecture.md](../../docs/Architecture.md) (typed
data, signals over context, canvas rendering, no backend) and
[docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest unit tests for pure
`engine/`/`entities/` modules, RTL/jsdom for the editor and page).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`) + React 19
**Primary Dependencies**: Vite 6+, Preact Signals (`@preact/signals-react`), Canvas 2D API, Tailwind CSS 4 + shadcn/ui. **No new runtime dependency.**
**Storage**: N/A — static site. All new state is the existing in-memory enemy signals (`enemyStates`); the bee adds no stored state. The level editor's localStorage/JSON persistence is unchanged. No migration.
**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md). TDD is mandatory (constitution Principle II). The movement strategies, animation resolution and the bee's combat contract are pure and unit-tested with no DOM; the marker/palette/reset paths are covered by `LevelParser.test.ts` / `EnemyMapper.test.ts` / `paletteTiles.test.ts` / `gridRenderState.test.ts` / `PlatformerState.test.ts`; the full step loop and authoring round-trip are covered by `PlatformerPage.test.tsx` and `EditorCanvas.test.tsx`.
**Target Platform**: Static web (browser), desktop + mobile, reached via `/platformer` and `/platformer/editor`.
**Project Type**: Single static web app — a canvas game theme (`src/themes/platformer/`) inside the CV site.
**Performance Goals**: 60 fps. The per-tick enemy step stays O(live enemies); each strategy is O(1) per enemy (patrol/fly scan a bounded number of tile rows; chase is arithmetic). The fly bob is computed from the shared `worldAnimElapsed` clock — no new timer or allocation beyond the existing per-tick state spread.
**Constraints**: No backend/API/DB; no new dependencies; strict TypeScript. Slime movement/animation MUST be **bit-for-bit unchanged** (SC-001). Enemies stay **non-solid**; the bee's bob never affects terrain collision (it is an obstacle by contact, not geometry). No enemy gravity, no enemy attacks. The bee must not count toward `levelTotals.enemies`/`enemiesDefeated` (both already filter `type === 'slimeGreen'`), the journal, or completion. `chase` ships used by no registered kind.
**Scale/Scope**: One feature. ~5 new modules + tests (`movement/MovementStrategy.ts`, `movement/patrol.ts`, `movement/fly.ts`, `movement/chase.ts`, `entities/enemies/Bee.ts`), one new sheet registration, one new level marker letter (`q`) and one new palette entry, and edits to ~15 existing files across `entities/`, `engine/`, `level/`, `editor/`, `PlatformerState.ts`, `PlatformerPage.tsx`, and the platformer docs.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Gate | Status | Notes |
| --- | --- | --- | --- |
| I. Typed Data Architecture | Types declared before use; no `any`; typed data imported directly | ✅ PASS | `MovementContext`, `MovementStrategy<S>`, the strategy configs, `BeeState` and the widened `EnemyType<S>` are declared in their own modules before consumers. `EnemyDef['type']` widens to the registry's `EnemyTypeKey` via a **type-only** import (no runtime cycle, no data parsing). No new `any`; the only cast remains the existing, documented `typeOf` registry dispatch. |
| II. Testing (NON-NEGOTIABLE) | Tests written and reviewed before implementation; all pass; `{method}-{condition}-{expectedResult}` naming; Vitest + RTL + jsdom | ✅ PASS | Strategy units (`patrol`, `fly`, `chase`), per-type animation + fallback, a registry/movement contract test, a fixture-kind end-to-end test, and bee combat/integration tests are written first. Existing `EnemyAI.test.ts` patrol characterization passes **unedited** (SC-001). `PlatformerPage.test.tsx` / `PlatformerState.test.ts` / `EnemyContact.contract.test.ts` regressions guard the refactor. |
| III. Code Quality & Component Standards | Named arrow exports, typed props inline, `cn()` for conditional classes, CLI-managed shadcn/ui only, named exports | ✅ PASS | New modules export named functions/consts/types; strategies are pure functions. No shadcn component is added, edited, or copy-pasted. Existing `Palette.tsx`/`EditorCanvas.tsx`/`EditorCanvasPane.tsx` patterns are extended, not restructured. |
| IV. No Feature Bloat | Feature originates from a spec in `specs/`; tracked in `docs/Features.md`; no roadmap step lists | ✅ PASS | O-024 is registered in `docs/Features.md` (node marked done on completion, per the completion-tracking convention). Scope is fixed by the spec's Out of Scope (no other enemy kinds, no gravity, no chase on a shipped kind, no bee variants/audio/rewards). |
| V. Performance & Static Delivery | No unjustified dependency; performance considered; assets optimized | ✅ PASS | Zero new dependencies. `bee.png` is already authored (3.7 KB pixel art) and is discovered by the existing registry-driven loader (one registry line). Per-tick cost is unchanged in order and bounded; the bob reads the existing shared clock. |

**Post-Phase-1 re-check**: All five gates still pass. The design introduces no
new dependency, no backend, no `any`, no shadcn edits, and no new stored state.
The seam is a pure refactor of shared behavior (the slimes' patrol is moved
behind it, not rewritten), which is what makes SC-001's "identical results"
assertable. See [research.md](./research.md) for the decisions and rejected
alternatives, and [contracts/](./contracts/) for the seam and bee contracts.

**Complexity Tracking**: No violations — the table is intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/O-024-enemy-movement-seam/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (already present)
├── design.md            # Authoritative pre-spec design (already present)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── movement-strategy.md
│   ├── patrol.md
│   ├── fly.md
│   ├── chase.md
│   ├── enemy-animation.md
│   ├── bee.md
│   └── enemy-kind-extension.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── entities/
│   ├── enemies/
│   │   ├── movement/
│   │   │   ├── MovementStrategy.ts        # NEW: MovementContext + MovementStrategy<S>
│   │   │   ├── patrol.ts                  # NEW: patrolMovement({ speedMultiplier, geometry })
│   │   │   ├── patrol.test.ts             # NEW: migrated EnemyAI patrol cases (same reference values)
│   │   │   ├── fly.ts                     # NEW: flyMovement({ speed, bobAmplitude, bobPeriod, geometry })
│   │   │   ├── fly.test.ts                # NEW: bob bound/period, wall/patrol reversal, no ledge check
│   │   │   ├── chase.ts                   # NEW: chaseMovement({ speed, detectRange, ... })
│   │   │   ├── chase.test.ts              # NEW: idle when absent/out of range, pursue + face when in range
│   │   │   └── contract.test.ts           # NEW: registry contract + fixture-kind end-to-end + fallback
│   │   ├── EnemyType.ts                   # EDIT: + movement, + defaultAnimState, - patrolSpeedMultiplier
│   │   ├── EnemyAnimation.ts              # EDIT: EnemyAnimState -> string; resolveAnimation/enemyFrameIndex(sprite, state, frame, fallback)
│   │   ├── shared.ts                      # EDIT: baseEnemyState/baseRevive take default anim state + animations
│   │   ├── shared.test.ts                 # EDIT: migrate to the config-object signature (T011)
│   │   ├── drawSpriteSheetEntity.ts       # EDIT: per-kind frames/fallback + anchor the draw by the bottom inset (FR-019)
│   │   ├── spriteSheetHitbox.ts           # EDIT: box height subtracts the bottom inset so the box matches the visible art (FR-019)
│   │   ├── SlimeGreen.ts                  # EDIT: movement patrol, defaultAnimState 'walk', hitboxPaddingNative bottom: 0
│   │   ├── SlimePurple.ts                 # EDIT: movement patrol, defaultAnimState 'walk', hitboxPaddingNative bottom: 0
│   │   ├── SlimePurple.test.ts            # VERIFY: unchanged (string animState already valid; no patrolSpeedMultiplier use)
│   │   ├── Bee.ts                         # NEW: BeeState + the bee EnemyType (fly, 1 HP, no reward)
│   │   ├── Bee.test.ts                    # NEW: create/revive/box/stomp-vs-side contract/flight integration
│   │   └── index.ts                       # EDIT: register bee -> EnemyState widens
│   ├── Enemy.ts                           # EDIT: advanceEnemyAnimation reads typeOf(enemy).sprite; + enemyHitboxBottomPadding; enemyTileOffsetY adds the bottom inset; drop walkAnimFrameCount re-export
│   ├── Enemy.test.ts                      # EDIT: per-type config assertions use movement/defaultAnimState; box/anchor bottom-inset parity (SC-009)
│   ├── sprites/sheets.ts                  # EDIT: BEE_SHEET registration (192x168, 24x24 cells, 8 cols)
│   └── WorldType.test.ts                  # EDIT: box/draw conformance picks up bee automatically (may add bee anchor)
├── engine/
│   ├── EnemyAI.ts                         # EDIT: stepEnemyPatrol -> thin compatibility wrapper (SC-001); keep stepEnemyHitReaction (revert to defaultAnimState)
│   ├── EnemyAI.test.ts                    # UNCHANGED: patrol characterization passes as-is (SC-001)
│   └── EnemyContact.contract.test.ts      # UNCHANGED: bee contact parity is asserted from a bee-specific test
├── level/
│   ├── LevelParser.ts                     # EDIT: EntityKind += 'enemyBee'; ENTITY_CHARS 'q' -> enemyBee; TileChar += 'q'; findBeeTiles
│   ├── LevelParser.test.ts                # EDIT: char mapping + finder + TileChar sync
│   ├── level.ts                           # EDIT: BEE_TILES computed; shipped layout gains one `q` over a gap
│   ├── EnemyMapper.ts                     # EDIT: EnemyMarkerPositions.bee + placeBees + placeEnemies wiring
│   └── EnemyMapper.test.ts                # EDIT: bee placement is plain/position-derived
├── editor/
│   ├── paletteTiles.ts                    # EDIT: 'q' sprite crop (bee fly frame) + label + description
│   ├── paletteTiles.test.ts               # EDIT: new entry coverage
│   ├── gridRenderState.ts                 # EDIT: synthesize bee states from 'q'
│   ├── gridRenderState.test.ts            # EDIT: bee synthesis
│   ├── EditorCanvas.tsx                   # EDIT: EditorImages.bee + drawContext sprite entry
│   ├── EditorCanvasPane.tsx               # EDIT: EMPTY_IMAGES.bee + IMAGE_SOURCES entry
│   ├── Palette.test.tsx                   # VERIFY: entity count derives from ENTITY_CHARS — no edit
│   └── PaletteTile.test.tsx               # VERIFY: no change expected
├── types.ts                               # EDIT: EnemyDef['type'] -> EnemyTypeKey (type-only import)
├── types.test.ts                          # VERIFY: unrelated to EnemyDef (isSkillCategoryFact) — no change
├── PlatformerState.ts                     # EDIT: enemyPlacements passes BEE_TILES.value
├── PlatformerState.test.ts                # EDIT: bee placement seeded; totals/defeated exclude bees
├── PlatformerPage.tsx                     # EDIT: build movementCtx; stepEnemy uses typeOf(enemy).movement; bee sheet loads via registry
└── PlatformerPage.test.tsx                # EDIT: bee flies over a gap, stomp/side contact, no counter contribution

docs/themes/platformer/Enemies.md          # EDIT: movement seam, per-kind animation, bee, "adding an enemy"
docs/themes/platformer/LevelFormat.md      # EDIT: `q` entity-marker row
docs/Features.md                           # EDIT (on completion): prefix O024 node with ✅ + `class O024 done`
```

**Structure Decision**: Single static web app. All work lands inside the existing
`src/themes/platformer/` tree, following the established split of concerns: pure
per-kind declarations in `entities/enemies/` (movement strategies and the bee
alongside the slime modules), generic type-independent behavior in
`entities/Enemy.ts` and `engine/`, level mapping in `level/`, authoring in
`editor/`, per-instance session state in `PlatformerState.ts`, and orchestration
+ canvas ownership in `PlatformerPage.tsx`.

The one structural constraint is the **existing import direction**: `Enemy.ts`
depends on `entities/enemies/` through `ENEMY_TYPES`, so nothing under
`entities/enemies/` may import `Enemy.ts` (that would be a load-order cycle —
the reason `spriteSheetHitbox.ts` and `drawSpriteSheetEntity.ts` already compute
geometry from the `SpriteDescriptor` directly). The movement strategies follow
the same rule: they receive the kind's `sprite` + `hitboxPaddingNative` in their
config and compute size/offsets themselves, so `movement/patrol.ts` never
imports `Enemy.ts` or `ENEMY_TYPES`. This is the key decision that keeps
"add a kind" a local change. See [research.md](./research.md) D1.

## Complexity Tracking

> No constitution violations — nothing to justify.
