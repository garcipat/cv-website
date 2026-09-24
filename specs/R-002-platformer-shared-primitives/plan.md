# Implementation Plan: Platformer Shared Primitives & Dedup

**Branch**: `R-002-platformer-shared-primitives` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/R-002-platformer-shared-primitives/spec.md`

## Summary

R-002 is the "Phase 0" deduplication slice of the Platformer Architecture Refactor. It introduces the shared bottom-layer math primitives and the four remaining shared modules the later refactors (R-003 lighting, R-004 effects) build on, then removes low-risk duplication and dead code. Nothing observable changes — the acceptance bar is **byte-for-byte behavior preservation** (FR-024, SC-006).

Concretely, the feature:

1. Adds a pure-leaf `shared/math.ts` (six primitives) and retargets every inline re-implementation (~9 `clamp01`, 4 `smoothstep`, 4 position-hash, 2 `shake`, and the inline `lerp`/`pulse` sites) to it.
2. Extracts one `findLandingRow` downward scan into `engine/Standable.ts` and routes the bomb, ladder, and falling-stalactite scans through it with caller-supplied predicates.
3. Extracts a shared `TileAtlas` type + helpers imported by both `GroundAtlas` and `BackgroundAtlas`, and a shared `pickVariant` (backed by `hash2D`) shared by both decor catalogs.
4. Extracts one `layoutFile.ts` validation/parsing module used by all four raw-file consumers — which fixes the only user-visible bug in the phase (torch markers dropped on editor reload).
5. Derives `HazardKind`/`BlockKind` from their registries (matching the enemy pattern) so adding a kind is one registry line.
6. Merges/removes dead code: `EnemyAI` shim, `IrisTransition`, `Contact`+`Outcome`, `coinFrameSource`, and the dormant placed-fruit `PickupType`.

The plan follows the dependency-layer invariants R-001 established (`contracts/` stays a strict leaf; no `level/ → engine/`; no `engine/ → state`) — see [docs/PlatformerArchitectureAnalysis.md](../../docs/PlatformerArchitectureAnalysis.md) Phase 0 (L4, L5, L6, P3, M4, M5, Group X) and the authoritative project conventions in [docs/Architecture.md](../../docs/Architecture.md) and [docs/TestingGuide.md](../../docs/TestingGuide.md).

## Technical Context

**Language/Version**: TypeScript (strict mode, no `any`) in a Vite 6 + React 19 project. The platformer theme lives under `src/themes/platformer/` and follows the pure-module / co-located-test conventions described in [docs/Architecture.md](../../docs/Architecture.md).
**Primary Dependencies**: None added — this is a pure refactor. Existing: `@preact/signals-react`, React 19, Tailwind CSS 4, Vitest. No new runtime or dev dependency (constitution Principle V: bundle size must not regress).
**Storage**: N/A. No JSON data, level, or localStorage shape changes. Authored levels, markers, torch strengths, and tuning are unchanged (Assumptions: "No data migration"). The editor's `localStorage` marker-grid signal keeps its storage keys; only its validation is corrected.
**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md). Every `engine/`/`entities/`/`level/` module carries a co-located `.test.ts`. This feature relocates existing tests (never deletes or weakens them) and adds co-located unit tests for the new pure modules (`shared/math`, `TileAtlas`, `layoutFile`, `findLandingRow`), matching the existing test-naming pattern.
**Target Platform**: Browser (static site; the platformer renders to a `<canvas>` in the web app).
**Project Type**: Web application (a self-contained game theme inside the CV website).
**Performance Goals**: The game loop is frame-driven (60 fps target); the refactor must not add per-frame allocation or change any formula output. `hash2D`/`pickVariant`/`findLandingRow` are all O(1) or O(depth) and are already called at the same frequencies today.
**Constraints**:
- **Byte-for-byte behavior preservation** — the only sanctioned body changes are deduplication, import retargeting, the Contact/Outcome + IrisTransition merges, and dead-code removal (spec Assumptions).
- **Layer invariants** (R-001 FR-025): `contracts/` remains a strict leaf (imports nothing from `engine/`/`entities/`/`level/`/state); no `level/ → engine/` edge; no `engine/ → state` edge.
- **One home per primitive** — no compatibility re-exports that preserve a duplicated/obsolete path (FR-023).
- **No gameplay, balance, visual, or level-data change** (spec Out of Scope).
**Scale/Scope**: 6 user stories, ~15–20 modules touched. Largest single dedup is the math primitives (~15 call sites across `engine/` and `entities/`). Story 6 is pure cleanup and runs last (lowest risk).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Outcome | Notes |
| --- | --- | --- |
| **I. Typed Data Architecture** | ✅ PASS | No `src/data/` JSON is touched. All new modules (`shared/math.ts`, `TileAtlas`, `layoutFile.ts`, kind unions) are fully typed with TypeScript strict and no `any`. Type derivations (`keyof typeof`) tighten typing rather than loosen it (FR-016/FR-017). |
| **II. Testing (NON-NEGOTIABLE)** | ✅ PASS | Behavior-preserving refactor: the full existing suite passes with import paths updated and tests relocated only (FR-024). New pure modules are TDD'd — co-located unit tests written first, then the module (Vitest + RTL + jsdom, `{method}-{condition}-{expected-result}` naming — see [docs/TestingGuide.md](../../docs/TestingGuide.md)); retarget/merge tasks are green-to-green (the existing suite is the guard). No test is deleted, skipped, or weakened. |
| **III. Code Quality & Component Standards** | ✅ PASS | No UI components or shadcn/ui changes. All new modules use named arrow-function exports, matching the platformer's existing pure-module style. No default exports introduced. |
| **IV. No Feature Bloat** | ✅ PASS | This is a discrete, spec'd refactor feature (`R-002`), tracked as its own spec folder. It adds no new capability — it removes duplication/dead code. `docs/Features.md` will be updated on completion per the feature-tracking convention. |
| **V. Performance & Static Delivery** | ✅ PASS | No new dependency; no per-frame allocation added. Shared primitives are pure and O(1)/O(depth). Bundle size may shrink slightly (dead-code removal), never grow. |

**Gate result**: No violations. Proceeding without complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/R-002-platformer-shared-primitives/
├── plan.md              # This file
├── research.md          # Phase 0 output — primitive signatures, call-site inventory, discrepancies resolved
├── data-model.md        # Phase 1 output — modules, types, and relationships
├── quickstart.md        # Phase 1 output — verification steps
├── contracts/           # Phase 1 output — interface contracts for the new shared modules
│   ├── math.md
│   ├── landing-row.md
│   ├── tile-atlas.md
│   ├── layout-file.md
│   └── kind-unions.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by this command)
```

### Source Code (repository root)

The platformer theme is a single self-contained tree under `src/themes/platformer/`. No new top-level project is added; the change is confined to that tree.

```text
src/themes/platformer/
├── shared/                         # NEW — pure-logic leaf (sibling of contracts/)
│   └── math.ts                     # NEW — clamp01, smoothstep, lerp, hash2D, pulse, shakeOffsetX
├── contracts/                      # R-001 bottom layer (existing)
│   ├── Outcome.ts                  # MODIFIED — absorbs Contact.ts (Story 6, FR-020)
│   ├── Contact.ts                  # DELETED — folded into Outcome.ts
│   ├── PickupKind.ts               # MODIFIED — drops dead 'fruit' + 'bonusFruit'; 'fruit' now names the reward (FR-022)
│   └── ... (capabilities, counters, DrawContext, geometry, PhysicsConfig, SpriteLookup, WorldType)
├── engine/
│   ├── Standable.ts                # MODIFIED — gains findLandingRow (FR-007)
│   ├── TileAtlas.ts                # NEW — QuarterTurns, ATLAS_STRIDE, TileAtlasEntry, atlasCell (FR-009)
│   ├── GroundAtlas.ts              # MODIFIED — imports TileAtlas (FR-010)
│   ├── BackgroundAtlas.ts          # MODIFIED — imports TileAtlas (FR-010)
│   ├── StaticObjectsCatalog.ts     # MODIFIED — exports shared pickVariant (FR-011)
│   ├── BackgroundDecorCatalog.ts   # MODIFIED — imports pickVariant (FR-011)
│   ├── Lighting.ts                 # MODIFIED — reuses smoothstep/hash2D/clamp01 (FR-005)
│   ├── CrumblingFloor.ts           # MODIFIED — clamp01 + shakeOffsetX (FR-006)
│   ├── FallingStalactite.ts        # MODIFIED — findLandingRow + shakeOffsetX (FR-006/FR-008)
│   ├── DeployableLadder.ts         # MODIFIED — findLandingRow + clamp01 (FR-008)
│   ├── PlacedBomb.ts               # MODIFIED — findLandingRow (FR-008)
│   ├── BlockAI.ts                  # MODIFIED — clamp01 (FR-003)
│   ├── MushroomSquash.ts           # MODIFIED — clamp01 (FR-003)
│   ├── CollectionEffects.ts        # MODIFIED — clamp01 + lerp (FR-003)
│   ├── GameLifecycle.ts            # MODIFIED — absorbs IrisTransition math (FR-019)
│   ├── IrisTransition.ts           # DELETED (FR-019)
│   ├── EnemyAI.ts                  # DELETED — hitReaction migrated; patrol shim removed (FR-018)
│   ├── Renderer.ts                 # MODIFIED — the two pulse waves (FR-003)
│   ├── Collision.ts                # MODIFIED — Contact/Outcome import retarget (FR-020)
│   └── ...
├── entities/
│   ├── Torch.ts                    # MODIFIED — torchPhase uses hash2D (FR-003)
│   ├── Block.ts                    # MODIFIED — BlockKind derived from BLOCK_TYPES (FR-017)
│   ├── Fruit.ts                    # MODIFIED — gains the fruit entity (merged from BonusFruit.ts); FRUIT_* constants stay (FR-022)
│   ├── BonusFruit.ts               # DELETED — merged into Fruit.ts (FR-022)
│   ├── Coin.ts                     # MODIFIED — coinFrameSource removed (FR-021)
│   ├── hazards/
│   │   ├── index.ts                # MODIFIED — HazardKind = keyof typeof HAZARD_TYPES (FR-016)
│   │   └── FloorSpike.ts           # MODIFIED — clamp01 (FR-003, extra site)
│   ├── enemies/shared.ts           # MODIFIED — stepEnemyHitReaction migrated here (FR-018)
│   ├── blocks/index.ts             # MODIFIED — gains BlockKind = keyof typeof BLOCK_TYPES export (FR-017)
│   └── pickups/
│       ├── index.ts                # MODIFIED — fruit = renamed bonusFruit; PICKUP_TYPES drops old 'fruit' (FR-022)
│       ├── Fruit.ts                # RENAMED from BonusFruit.ts — the question-mark reward pickup, key 'fruit' (FR-022)
│       └── BonusFruit.ts           # DELETED — renamed to Fruit.ts (FR-022)
├── level/
│   ├── layoutFile.ts               # NEW — isLayout/isBackground/isMarkers/idFromPath/parsers (FR-012)
│   ├── levelRegistry.ts            # MODIFIED — imports from layoutFile.ts (FR-013)
│   ├── BlueprintData.ts            # MODIFIED — imports from layoutFile.ts (FR-013)
│   ├── blueprintRegistry.ts        # MODIFIED — imports from layoutFile.ts (FR-013)
│   ├── LevelParser.ts              # MODIFIED — normalizeMarkerEntry exported; HAZARD_CHARS typed (FR-014/FR-016)
│   └── CollectibleMapper.ts        # MODIFIED — spriteType narrows to 'coin'; placeCollectibles drops fruit (FR-022)
├── editor/
│   └── editorState.ts              # MODIFIED — marker validation delegates to complete validator (FR-014)
├── types.ts                        # MODIFIED — BlockDef.blockKind imports BlockKind (FR-017)
├── PlatformerState.ts              # MODIFIED — placeCollectibles(COIN_TILES.value) (FR-022)
└── PlatformerPage.tsx              # MODIFIED — EnemyAI/IrisTransition/coinFrameSource import retargets (FR-018/FR-019/FR-021)
```

**Structure Decision**: The single-project platformer tree is retained. New shared modules are placed by the spec's Assumptions: `shared/math.ts` (a new pure-leaf `shared/` folder, sibling to `contracts/`), `engine/Standable.ts` + `engine/TileAtlas.ts` (render/physics-specific), and `level/layoutFile.ts` (raw-file vocabulary the editor already consumes from `level/`). No folder re-organisation (that is R-003–R-013's concern); this feature only adds modules and retargets imports, preserving R-001's layer boundaries.

## Complexity Tracking

> No constitution violations — this table is intentionally empty.
