# Implementation Plan: Platformer Deployable Ladders

**Branch**: `O-011-platformer-deployable-ladders` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-011-platformer-deployable-ladders/spec.md`

## Summary

A rolled **rope-ladder bundle** is a new author-placeable terrain tile (`@`). A
grounded character standing on the bundle — or one tile above it — presses Up to
deploy it: the bundle unrolls downward over a fixed ~0.5 s, filling every empty
cell below it down to the first solid tile (a `bridge` counts) or the level's
bottom, and then behaves exactly like an authored `ladder`/`chain` for the rest
of the run. Deployment is one-way, survives death/respawn, and is rolled back
only by the existing session-reset points (Reset Game / the editor's Try / the
theme-switch mount reset), sharing the lifetime of blocks and chests.

The technical approach is the first **runtime terrain override** in this
codebase: tiles stay stateless values in `LevelDef.terrain`, and a per-bundle
deployment state lives in a signal alongside the other per-instance session
state. A pure `engine/DeployableLadder.ts` module computes the landing row,
advances the unroll clock, and derives an **effective `LevelDef`** in which every
completed bundle's cells become a new `ropeLadder` tile type (climbable through
the existing `isClimbable`/`isStandableLadderTop` predicates). The effective
level is handed to `stepPlayerPhysics` only; rendering reads the raw level plus
the bundle state through a dedicated `drawDeployableLadders` pass fed by the new
`public/sprites/rope_ladder.png` sheet. This follows
[docs/Architecture.md](../../docs/Architecture.md) (typed data, signals over
context, canvas rendering, no backend) and
[docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest unit tests for pure
engine modules, RTL tests for the editor palette/canvas).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`) + React 19
**Primary Dependencies**: Vite 6+, Preact Signals (`@preact/signals-react`), Canvas 2D API, Tailwind CSS 4 + shadcn/ui. **No new runtime dependency.** One new image asset, `public/sprites/rope_ladder.png` (32×32, already authored to the spec's sheet layout).
**Storage**: N/A — static site. Deployment lives in an in-memory signal; the level editor keeps persisting to localStorage / level JSON exactly as today. No new persistence, no migration.
**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md). TDD is mandatory (constitution Principle II); the pure engine module is unit-tested with no DOM.
**Target Platform**: Static web (browser), desktop + mobile, reached via `/platformer` and `/platformer/editor`.
**Project Type**: Single static web app — a canvas game theme (`src/themes/platformer/`) inside the CV site.
**Performance Goals**: 60 fps. The unroll tick and effective-grid derivation are O(bundles) (not O(level)), the render pass is O(visible bundles + revealed 8 px steps), and `applyDeployedLadders` returns the *same* `LevelDef` object when nothing is deployed so the common case allocates nothing.
**Constraints**: No backend/API/DB; no new dependencies; strict TypeScript; tiles MUST stay stateless values (no general per-tile animation framework — the override is scoped to bundles only, per spec Assumptions); the rolled bundle is standable from above but never solid or climbable; a `bridge` stops the unroll; deployment freezes with the world while paused/dying; the editor landing marker MUST NOT render in game.
**Scale/Scope**: One feature. One new pure engine module (+ tests), one new sprite sheet registration, two new `TileType` members, and edits to ~15 existing files across `level/`, `engine/`, `editor/`, `PlatformerState.ts` and `PlatformerPage.tsx`, plus two theme docs.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Gate | Status | Notes |
| --- | --- | --- | --- |
| I. Typed Data Architecture | Types declared before use; no `any`; typed data imported directly | ✅ PASS | Two new members added to the `TileType` union in `level/LevelData.ts`; `DeployableLadderState`/`DeployableLadderPhase` declared in the new typed engine module before any consumer. No runtime parsing, no API, no `any`. |
| II. Testing (NON-NEGOTIABLE) | Tests written and reviewed before implementation; all tests pass; `{method}-{condition}-{expectedResult}` naming; Vitest + RTL + jsdom | ✅ PASS | `engine/DeployableLadder.test.ts` covers landing, timing, override and trigger math first; `Terrain.test.ts`/`Physics.test.ts` cover the new predicates/collision; `LevelParser.test.ts`/`paletteTiles.test.ts` cover the character; `Renderer.test.ts` covers the draw pass; `EditorCanvas.test.tsx` covers the landing marker. |
| III. Code Quality & Component Standards | Named arrow exports, typed props inline, `cn()` for conditional classes, CLI-managed shadcn/ui only, named exports | ✅ PASS | New modules export named functions/consts. `Palette.tsx`/`EditorCanvas.tsx` keep their existing patterns; no shadcn component is added or edited. |
| IV. No Feature Bloat | Feature originates from a spec in `specs/`; tracked in `docs/Features.md`; no roadmap step lists | ✅ PASS | O-011 is already registered in `docs/Features.md` (its spec link is set on completion, per the completion-tracking convention). The runtime override is deliberately single-purpose (spec Assumptions/Out of Scope explicitly forbid a general per-tile framework). |
| V. Performance & Static Delivery | No unjustified dependency; performance considered; assets optimized | ✅ PASS | Zero new dependencies. One 379-byte, 32×32 pixel-art PNG. The override is allocation-free until a bundle deploys, and the draw pass is O(visible bundles). |

**Post-Phase-1 re-check**: All five gates still pass. The design introduces no
new dependency, no backend, no `any`, and no shadcn edits. See
[research.md](./research.md) for the decisions and rejected alternatives.

**Complexity Tracking**: No violations — the table is intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/O-011-platformer-deployable-ladders/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── deployable-ladder.md
│   ├── terrain-override.md
│   └── rendering-editor.md
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── level/
│   ├── LevelData.ts                 # EDIT: add `ladderBundle` + `ropeLadder` to TileType
│   ├── LevelParser.ts               # EDIT: `@` -> ladderBundle in TERRAIN_CHARS + TileChar; findLadderBundleTiles
│   ├── LevelParser.test.ts          # EDIT: character mapping + finder + TileChar sync
│   ├── Terrain.ts                   # EDIT: ropeLadder is climbable; isStandableLadderBundleTop
│   ├── Terrain.test.ts              # EDIT: new predicate cases
│   └── level.ts                     # EDIT: LADDER_BUNDLE_TILES computed
├── engine/
│   ├── DeployableLadder.ts          # NEW: pure state, landing scan, timing, effective-grid override
│   ├── DeployableLadder.test.ts     # NEW: unit tests (TDD, written first)
│   ├── StaticObjectsCatalog.ts      # EDIT: rope-ladder sprite rects + ropeLadderShaftPieces
│   ├── StaticObjectsCatalog.test.ts # EDIT: piece-plan coverage
│   ├── Renderer.ts                  # EDIT: tileSource null cases + drawDeployableLadders
│   ├── Renderer.test.ts             # EDIT: bundle/steps/caps draw coverage
│   ├── Physics.ts                   # EDIT: ground scan treats the bundle top as standable
│   └── Physics.test.ts              # EDIT: standable bundle, climbable deployed shaft
├── entities/sprites/
│   └── sheets.ts                    # EDIT: ROPE_LADDER_SHEET registration
├── editor/
│   ├── paletteTiles.ts              # EDIT: `@` sprite/label/description
│   ├── paletteTiles.test.ts         # EDIT: `@` entries
│   ├── gridRenderState.ts           # EDIT: synthesizeLadderBundleStates
│   ├── EditorCanvas.tsx             # EDIT: draw bundles + landing marker; rope image
│   ├── EditorCanvas.test.tsx        # EDIT: landing-marker coverage
│   └── LevelEditorPage.tsx          # EDIT: load the rope sheet into EditorImages
├── PlatformerState.ts               # EDIT: bundle placements/states, activeLevel, tick, reset wiring
├── PlatformerState.test.ts          # EDIT: seeding + reset lifetime
├── PlatformerPage.tsx               # EDIT: deploy trigger, tick, effective level for physics, draw + load sheet
└── PlatformerPage.test.tsx          # EDIT: deploy-trigger + wiring coverage
```

**Structure Decision**: Single static web app. All work lands inside the
existing `src/themes/platformer/` tree, following the established split of
concerns: pure math/state in `engine/` and `level/`, per-instance session state
in `PlatformerState.ts`, orchestration + canvas ownership in
`PlatformerPage.tsx`, authoring in `editor/`. The runtime override is a pure
function in `engine/DeployableLadder.ts` (canvas-free, DOM-free), so it is
unit-testable without a browser; `Renderer.ts` remains the only module that maps
world coordinates to canvas coordinates.

## Complexity Tracking

> No constitution violations — nothing to justify.
