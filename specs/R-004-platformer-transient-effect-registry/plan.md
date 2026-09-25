# Implementation Plan: Platformer Transient Effect Registry (R-004)

**Branch**: `R-004-platformer-transient-effect-registry` | **Date**: 2026-09-25 | **Spec**: [`specs/R-004-platformer-transient-effect-registry/spec.md`](./spec.md)

**Input**: Feature specification from `/specs/R-004-platformer-transient-effect-registry/spec.md` (GitHub issue #92)

## Summary

Unify the platformer theme's transient visuals behind one `TransientEffect<S>` concept, one `activeEffects` collection, one `advanceEffects(activeEffects, dt)`, and one registry-driven draw pass that preserves each family's pipeline depth; extract the four timed-tile machines onto one pure shared core; back the sparkle/splatter/debris producers with one shared particle-list emitter; and relocate the floor-spike and falling-stalactite state machines into `entities/hazards/` beside their views.

**Primary technical approach** (all decisions recorded in [`research.md`](./research.md)):

- **Effect home**: a new `engine/effects/` directory replaces `engine/CollectionEffects.ts` — `transientEffect.ts` (base + collection advance), `effectRegistry.ts`, one module per effect kind (each owning its start/tick/derive/**draw**), `particles.ts`, `drawEffects.ts` (the single layer-filtered dispatch), and an `index.ts` barrel. **Not** a single `engine/effects.ts` file and **not** the F7 `features/effects/` target (F7 is explicitly later work in this spec's Assumptions).
- **Timed-tile core home**: a new pure leaf `shared/timedTile.ts` (sibling of the R-002 `shared/math.ts`), so the `engine/` mushroom/crumbling machines **and** the relocated `entities/hazards/` machines consume it without adding any new `entities/ → engine/` edge. It also exports the dependency-free `GridTimerState` shape (`{ col, row, elapsed }`) that the relocated falling-stalactite machine uses for its `crumblingFloorStates` parameter, so the merge does not import `engine/CrumblingFloor`.
- **Hazards**: `engine/FloorSpike.ts` merges into `entities/hazards/FloorSpike.ts`; `engine/FallingStalactite.ts` merges into `entities/hazards/FallingStalactite.ts`; `entities/hazards/phases.ts` is folded into those two modules and deleted.
- **Text helper**: `fillTextWithOutline` (and the shared pixel font-family constant) extract to a small `engine/textDraw.ts` so effect modules can draw text without importing the god `Renderer.ts` and without a cycle.
- **No new dependencies, no data migration, no gameplay/visual change.** The only sanctioned changes are the unification, the two extractions, the hazard relocation, and import retargeting.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`), React 19, Vite 6, Node/npm. Matches [docs/Architecture.md](../../docs/Architecture.md) and [AGENTS.md](../../AGENTS.md).

**Primary Dependencies**: React 19, `@preact/signals-react` (state), Canvas 2D (rendering). Test stack: Vitest + React Testing Library + jsdom per [docs/TestingGuide.md](../../docs/TestingGuide.md). **No new runtime dependency is added** (constitution Principle V).

**Storage**: N/A — static site, no backend. Platformer content stays in typed data (`src/data/`) and level-layout files; R-004 changes no data (FR-015).

**Testing**: Vitest (unit) + RTL/jsdom (component/page). Per constitution Principle II, tests are written/updated before implementation; existing tests may be updated **only** for changed import paths, signatures, or file locations — never weakened, skipped, or deleted (FR-014). New coverage: registry contract, `advanceEffects` boundaries + filtered advance, timed-tile core, particle byte-identity, hazard relocation.

**Target Platform**: Browser (static site), Canvas 2D game loop.

**Project Type**: Single front-end project; theme modules under `src/themes/platformer/`; tests co-located.

**Performance Goals**: No regression to the 60 fps canvas loop. The single draw pass iterates a handful of registry entries × the (small) active list per frame — O(kinds × effects) with tiny constants. Bundle should be neutral or smaller (two modules deleted, one small helper added).

**Constraints**:
- R-001 dependency-layer invariants hold: `contracts/` stays a strict leaf; no new `level/ → engine/`; no new `engine/ → state/`; the `level/ → entities/` hazard-phase edge must still resolve (FR-013).
- Behaviour is **byte-for-byte preserved**: counts, positions, order, opacity curves, reset scope, and pipeline depth unchanged (FR-005/FR-014/FR-016).
- No new effect kinds, gameplay, visuals, tuning, or level data (FR-019); no compatibility re-export or second code path (FR-018).
- No folder reorganisation beyond the hazard move; the F7 `engine/render/` + `features/` split is later work.
- No auto-commits; no auto-advance to `/speckit.tasks` or implementation.

**Scale/Scope**: Platformer theme only. 8 effect families unified, 4 timed-tile machines share a core, 2 hazard state machines relocated (2 files deleted), 1 effects directory added, 1 pure core added, 1 text helper added, 3 files removed (`CollectionEffects.ts`, `engine/FloorSpike.ts`, `engine/FallingStalactite.ts`) plus `entities/hazards/phases.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Evidence / Mitigation |
| --- | --- | --- |
| **I. Typed Data Architecture** | PASS | No CV content or `src/data/` change (FR-015). All new structures (`TransientEffect<S>`, registry entry, timed-tile config) are fully typed with no `any`; types are declared in the module that owns them before use. |
| **II. Testing (NON-NEGOTIABLE)** | PASS | Tests are updated alongside each move/signature change and new tests added (registry contract, advance boundaries, timed-tile core, particle byte-identity, hazard relocation). No test is weakened/skipped/deleted (FR-014). Vitest + RTL + jsdom, kebab-case `{method}-{condition}-{expected-result}` naming, Arrange/Act/Assert. |
| **III. Code Quality & Component Standards** | PASS | Named arrow-function exports, no default exports, PascalCase types / camelCase functions. No React component, Tailwind, or shadcn/ui surface is introduced, so those clauses are not triggered. |
| **IV. No Feature Bloat** | PASS | Work is a specified refactor (R-004) with a spec in `specs/`; it adds no gameplay/feature and only unifies/relocates shipped code (FR-019). `docs/Features.md` dependency-diagram update happens at completion, not planning. |
| **V. Performance & Static Delivery** | PASS | No new dependency; bundle neutral/smaller; the draw dispatch is trivial and behaviour-preserving; static delivery unchanged. |
| **Workflow: layer invariants (R-001)** | PASS | `contracts/` remains a leaf; the only new folder is `engine/effects/` (inside the existing engine layer); the timed-tile core is a `shared/` leaf; the hazard move retargets `level/` and `engine/` imports to `entities/hazards/` (allowed `level/ → entities/`, `engine/ → entities/`), adding no `level/ → engine/` or `engine/ → state/` edge. |
| **Workflow: manual browser check** | PASS (planned) | SC-007 requires a manual browser pass over a level exercising every effect and the editor preview; the plan's quickstart includes it. |
| **Workflow: no auto-commit / no auto-advance** | PASS | Planning creates no commit and does not invoke `/speckit.tasks` or `/speckit.implement`. |

**Gate result: PASS.** No violations, so the Complexity Tracking table is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/R-004-platformer-transient-effect-registry/
├── plan.md              # This file
├── research.md          # Phase 0 — design decisions (module homes, layering, reset, boundaries)
├── data-model.md        # Phase 1 — entities, relationships, validation rules
├── quickstart.md        # Phase 1 — runnable validation guide
├── contracts/           # Phase 1 — interface contracts
│   ├── effects-registry.md
│   ├── timed-tile-core.md
│   ├── particle-producer.md
│   └── hazard-modules.md
├── checklists/
│   └── requirements.md  # Existing (16/16)
└── spec.md              # Existing
# tasks.md is NOT created by /speckit.plan
```

### Source Code (repository root — platformer theme)

```text
src/themes/platformer/
├── engine/
│   ├── effects/                     # NEW — replaces engine/CollectionEffects.ts
│   │   ├── index.ts                 # public barrel (single import site)
│   │   ├── transientEffect.ts       # TransientEffect<S>, EffectRenderContext, advanceEffects, clearEffectsByResetScope, effectCount
│   │   ├── effectRegistry.ts        # kind → { create, tick?, draw, expired, layer, resetScope, keyOf? }
│   │   ├── particles.ts             # shared particle-list producer (sparkle/splatter/debris)
│   │   ├── drawEffects.ts           # the single layer-filtered draw pass
│   │   ├── flyingText.ts                # FlyingTextEffect family (start / 4-phase tick / derive / draw)
│   │   ├── counterPopup.ts          # CounterPopupEffect family (keyed slot, null sentinel, draw)
│   │   ├── puff.ts                  # PuffEffect family (start / default tick / drawSparkleBurst)
│   │   ├── healAura.ts              # HealAuraEffect family (player-anchored, derive / draw)
│   │   ├── hitSplatter.ts           # HitSplatterEffect family (start / derive / draw)
│   │   ├── fadeOutText.ts           # FadeOutTextEffect family (draw)
│   │   ├── explosion.ts             # ExplosionEffect family (frame derive / draw)
│   │   └── debris.ts                # DebrisEffect family (layers, crumbleDebrisLayers, derive / draw)
│   ├── textDraw.ts                  # NEW — fillTextWithOutline + shared pixel font-family (from Renderer)
│   ├── Renderer.ts                  # MODIFIED — effect draws + text helper removed
│   ├── Collision.ts                 # MODIFIED — retarget hazard machine imports
│   ├── Collision.test.ts            # MODIFIED — retarget type imports
│   ├── CrumblingFloor.ts            # MODIFIED — route through shared/timedTile.ts
│   ├── MushroomSquash.ts            # MODIFIED — route through shared/timedTile.ts
│   ├── CollectionEffects.ts         # DELETED (content split into engine/effects/*)
│   ├── FloorSpike.ts                # DELETED (merged into entities/hazards/FloorSpike.ts)
│   ├── FloorSpike.test.ts           # DELETED (merged into entities/hazards/FloorSpike.test.ts)
│   ├── FallingStalactite.ts         # DELETED (merged into entities/hazards/FallingStalactite.ts)
│   └── FallingStalactite.test.ts    # DELETED (merged into entities/hazards/FallingStalactite.test.ts)
├── shared/
│   ├── math.ts                      # unchanged (clamp01/lerp/shakeOffsetX consumed)
│   └── timedTile.ts                 # NEW — arm / advance / elapsedFor / shakeOffsetX core + GridTimerState shape
├── entities/
│   └── hazards/
│       ├── FloorSpike.ts            # MODIFIED — view + full state machine + phase vocab (merged)
│       ├── FallingStalactite.ts     # MODIFIED — view + full state machine + phase vocab (merged); crumbling-floor param via shared/timedTile GridTimerState
│       ├── phases.ts                # DELETED (folded into the two hazard modules)
│       ├── index.ts                 # MODIFIED — exports retarget
│       ├── FloorSpike.test.ts       # MODIFIED — + merged machine tests
│       └── FallingStalactite.test.ts # MODIFIED — + merged machine tests
├── level/
│   └── HazardMapper.ts              # MODIFIED — phase types from entities/hazards modules
├── state/
│   └── rewards.ts                   # MODIFIED — retarget effect imports; spawn via registry
├── PlatformerState.ts               # MODIFIED — one activeEffects; timed-tile + effect wiring; reset scope
├── PlatformerPage.tsx               # MODIFIED — one tick, one draw dispatch at the pipeline points
├── PlatformerState.test.ts          # MODIFIED — import paths + unified-collection assertions
├── PlatformerPage.test.tsx          # MODIFIED — import paths + row assertions
└── editor/                          # no direct machine imports found; verified during implementation
```

**Structure Decision**: Single project. The effect subsystem becomes one self-contained directory `engine/effects/` so "a new effect is one module plus one registry line" (FR-002/US6). The timed-tile core is a dependency-free `shared/` leaf so it can serve both `engine/` and the relocated `entities/hazards/` machines without widening any cross-folder edge; it also exports the neutral `GridTimerState` shape so the relocated falling-stalactite machine types its `crumblingFloorStates` parameter without importing `engine/CrumblingFloor`. The two hazard state machines merge into their existing view modules under `entities/hazards/`, matching the enemy/block "one kind, one module" pattern (analysis §4.1 F2 "rides with" row). `contracts/` is untouched (strict leaf).

## Key Design Decisions (resolved in planning)

Full rationale and alternatives are in [`research.md`](./research.md); the durable interfaces are in [`contracts/`](./contracts/).

1. **`TransientEffect<S>` + registry home = `engine/effects/` directory.** Rejected: single `engine/effects.ts` (keeps an 8-family grab bag, no home for the extractions) and `features/effects/` (the F7 target, explicitly later work per spec Assumptions).
2. **Timed-tile core home = `shared/timedTile.ts`.** Pure leaf; avoids the new `entities/hazards/ → engine/` edge that `engine/timedTile.ts` would create and the cross-family reach that `entities/hazards/timedTile.ts` would create. It also owns the dependency-free `GridTimerState` (`{ col, row, elapsed }`) that `FallingStalactite`'s merged module uses for its crumbling-floor parameter, so the move adds no `engine/CrumblingFloor` import (FR-013).
3. **One dispatch, four pipeline invocations.** `drawEffects(rc, layer, effects)` is the single pass; the page invokes it at `midWorld` (heal aura), `worldEffects` (flyingText → puff → debris → splatter → fade-out text, in today's order), `aboveWorld` (explosions), and `hudLast` (counter popups). Depth and intra-layer order are preserved exactly (FR-005/US5-4).
4. **Per-kind reset scope is registry metadata.** Only `fadeOutText` is `'death'`-scoped (cleared by `resetGame()`); every other kind is `'progress'`-scoped (cleared only by `resetGameProgress()`), preserving FR-006/US5-5. The four timed-tile arrays remain separately cleared by `resetGame()`.
5. **Keyed slot via registry `keyOf`.** Counter popups replace in place by `labelKey`; all other kinds append (FR-016/US5-1).
6. **Per-kind expiry boundaries are explicit.** Six families expire on `elapsed > duration` (default); `flyingText` expires on `phase === 'done'`; the counter popup's `tick` returns the `null` sentinel at `elapsed >= duration` (FR-004/FR-007).
7. **Filtered advance preserves the dying lead-in.** `advanceEffects(activeEffects.value, dt, { kinds: ['hitSplatter'] })` ticks/prunes only hit splatters and leaves the rest frozen (US5-3).
8. **`activeEffects` is the one collection name**; the old flying-text-only signal is retargeted to count flying-text effects for the slot allocator (`effectCount('flyingText')`), and no parallel store survives (FR-003/FR-018).
9. **Hazard phase vocabulary folds into the hazard modules** and `entities/hazards/phases.ts` is deleted; `level/HazardMapper.ts` imports the phase types from `entities/hazards/FloorSpike.ts` / `FallingStalactite.ts` (allowed `level/ → entities/` edge). The pre-existing `entities/hazards/ → engine/` helper imports (`findLandingRow`, `StaticObjectsCatalog` geometry) are preserved, not widened (FR-013).
10. **Text helper extracted to `engine/textDraw.ts`** so per-kind effect draws can own their rendering without importing `Renderer.ts` and without a cycle.

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.
