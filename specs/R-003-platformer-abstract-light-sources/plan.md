# Implementation Plan: Platformer Abstract Light Sources

**Branch**: `R-003-platformer-abstract-light-sources` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/R-003-platformer-abstract-light-sources/spec.md`

## Summary

R-003 is the lighting slice of the Platformer Architecture Refactor. It introduces one
`LightSource` concept so the wall torches and the player's carried light are two adapters onto a
single render contract, collapses the four near-duplicated punch/glow blocks in `drawDarkness`
into two generic loops, and makes `localDarknessAt` and `drawEnemyEyes` consume the same
`readonly LightSource[]`. The torch light half (finding **X5**) moves out of `engine/Lighting.ts`
into `entities/Torch.ts`, and the player light half moves out of `engine/Lighting.ts` /
`engine/Renderer.ts` into `entities/Player.ts`.

Nothing observable changes — the acceptance bar is **byte-for-byte behavior preservation**
(FR-016/SC-005). Concretely the feature:

1. Adds a leaf `contracts/lighting.ts` exporting the `LightSource` type (`x`, `y`, `radius`,
   `color`, `intensity`, `glowMidAlpha`, `punchHole`).
2. Adds `torchLightSource(torch, worldElapsed): LightSource` in `entities/Torch.ts` and moves the
   torch light constants/formulas (`TorchLight`, `TORCH_LIGHT_RADIUS_PX`, `TORCH_PULSE_AMPLITUDE`,
   `TORCH_PULSE_PERIOD_SECONDS`, `TORCH_GLOW_COLOR`, `torchLightRadius`, `torchPulseScale`,
   `torchGlowStrengthAt`) there from `engine/Lighting.ts`.
3. Adds a player light adapter plus the held-torch geometry in `entities/Player.ts`, and moves
   `PLAYER_LIGHT_RADIUS_PX`, `PLAYER_GLOW_COLOR`, `PLAYER_GLOW_INTENSITY`, `playerGlowStrengthAt`
   there from `engine/Lighting.ts`; `heldTorchLightPosition` and the held-torch offsets/scale move
   out of `engine/Renderer.ts`, which now consumes the player module's geometry.
4. Rewrites `drawDarkness` / `localDarknessAt` / `drawEnemyEyes` to take one
   `readonly LightSource[]`; `drawDarkness` drops `worldElapsed` and `playerLight`,
   `localDarknessAt` drops `worldElapsed` and `playerLight`, `drawEnemyEyes` drops `playerLight`
   and keeps `worldElapsed` (eye bob).
5. Migrates every consumer (`PlatformerPage` render loop, `PlatformerState.torchPositions` type,
   `caveLightingPreview`, `EditorCanvas`) to the single list, assembling it per frame only when
   `darknessLevel > 0` (FR-019).

The plan follows the dependency-layer invariants R-001 established (`contracts/` stays a strict
leaf; no `entities/ → engine/`; no `level/ → engine/`; no `engine/ → state`) — see
[specs/R-001-platformer-core-contracts/contracts/layer-boundaries.md](../R-001-platformer-core-contracts/contracts/layer-boundaries.md)
and [docs/PlatformerArchitectureAnalysis.md](../../docs/PlatformerArchitectureAnalysis.md)
Phase 1 findings **L2** (lighting is torch-shaped), **L3** (fog duplicates falloff/hash — already
resolved by R-002) and **X5** (Torch.ts + the torch half of Lighting.ts are one concept split).

## Technical Context

**Language/Version**: TypeScript (strict mode, no `any`) in a Vite + React 19 project. The
platformer theme lives under `src/themes/platformer/` and follows the pure-module / co-located-test
conventions described in [docs/Architecture.md](../../docs/Architecture.md).

**Primary Dependencies**: None added — this is a pure refactor. Existing: `@preact/signals-react`,
React 19, Tailwind CSS 4, Vitest. No new runtime or dev dependency (constitution Principle V).

**Storage**: N/A. No JSON, level, marker, torch-strength, or `localStorage` shape changes
(FR-018). No data migration.

**Testing**: Vitest + React Testing Library + jsdom, per
[docs/TestingGuide.md](../../docs/TestingGuide.md). Every `engine/`/`entities/`/`editor/` module
keeps a co-located `.test.ts`. Existing tests are **relocated and updated only where a signature
changed** — never weakened, skipped, or deleted (FR-016). Moved helper tests follow their subject
(`torchLightRadius`/`torchPulseScale`/`torchGlowStrengthAt` → `entities/Torch.test.ts`;
`playerGlowStrengthAt` + `heldTorchLightPosition` → `entities/Player.test.ts`). New adapters
(`torchLightSource`, player adapter, the generic pass behavior) are TDD'd first.

**Target Platform**: Browser (static site; the platformer renders to a `<canvas>` in the web app).

**Project Type**: Web application (a self-contained game theme inside the CV website).

**Performance Goals**: The game loop is frame-driven (60 fps target); the refactor must not add
per-frame allocation and must be strictly cheaper or equal: `FR-019` skips the light-list assembly
and both passes at `darknessLevel <= 0`, and unifying four loops into two removes duplicated
gradient creation. No formula output changes.

**Constraints**:

- **Byte-for-byte behavior preservation** — the only sanctioned body changes are the two-loop
  collapse, the torch/player adapter extractions, the `playerLight` → `LightSource` widening, the
  dropped `worldElapsed` parameters, and the torch-light/player-light moves (spec Assumptions).
- **Layer invariants** (R-001): `contracts/lighting.ts` is a strict leaf; no `entities/ → engine/`;
  no `level/ → engine/`; no `engine/ → state`; `engine/Lighting.ts` stays pure and DOM-free. The
  move adds one legal same-layer edge, `entities/Player.ts → entities/Torch.ts` (the held-torch
  frame dimensions `TORCH_FRAME_WIDTH`/`TORCH_FRAME_HEIGHT`), which neither direction of R-001's
  forbidden edges covers.
- **One falloff formula** — `shared/math.ts`'s `radialFalloffAt` is the single implementation;
  `localDarknessAt`, `torchGlowStrengthAt`, and `playerGlowStrengthAt` all delegate to it (FR-010),
  so the retained per-kind helpers are wrappers, not a second copy of the math.
- **One home per concept** — no compatibility re-export that preserves the old `torchPositions` /
  `TorchLight` / `heldTorchLightPosition` paths.
- **No gameplay, balance, visual, or level-data change** (spec Out of Scope).

**Scale/Scope**: 4 user stories, ~8 production modules touched, 8 test files migrated. The largest
single change is the `drawDarkness` four-block → two-loop collapse; the mechanical majority is
import retargeting.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Outcome | Notes |
| --- | --- | --- |
| **I. Typed Data Architecture** | ✅ PASS | No `src/data/` JSON is touched. `contracts/lighting.ts` is fully typed with a 7-field `LightSource` interface; adapters return that type; TypeScript strict with no `any`. `TorchLight` moves from `engine/` to `entities/` unchanged in shape. |
| **II. Testing (NON-NEGOTIABLE)** | ✅ PASS | Behavior-preserving refactor: the full existing suite passes with signatures/imports updated and moved-helper tests relocated to their subject's file (FR-016). New pure adapters and the generic pass behavior are TDD'd (Vitest + RTL + jsdom, `{method}-{condition}-{expected-result}` naming — [docs/TestingGuide.md](../../docs/TestingGuide.md)). No test is deleted, skipped, or weakened. |
| **III. Code Quality & Component Standards** | ✅ PASS | No UI components or shadcn/ui changes. New modules use named arrow-function exports, matching the platformer's existing pure-module style. No default exports introduced. |
| **IV. No Feature Bloat** | ✅ PASS | A discrete, spec'd refactor feature (`R-003`) with its own spec folder; it adds no new capability and no new emitter — it removes duplication and the torch-shaped coupling. `docs/Features.md` will be updated on completion per the feature-tracking convention. |
| **V. Performance & Static Delivery** | ✅ PASS | No new dependency; no per-frame allocation added (one array replaces four loops; `FR-019` skips even that when bright). Bundle may shrink. No formula output change. |

**Gate result**: No violations. Proceeding without complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/R-003-platformer-abstract-light-sources/
├── plan.md              # This file
└── spec.md              # Input specification
```

### Source Code (repository root)

The platformer theme is a single self-contained tree under `src/themes/platformer/`. No new
top-level project and no folder re-organisation (that is F7, later work). The change is confined
to that tree and preserves R-001's layer boundaries.

```text
src/themes/platformer/
├── contracts/
│   ├── lighting.ts                 # NEW — the LightSource type (leaf; imports nothing)
│   └── ... (geometry, DrawContext, capabilities, counters, Outcome, PhysicsConfig, ...)
├── entities/
│   ├── Torch.ts                    # MODIFIED — gains TorchLight, torch light constants/formulas, torchLightSource (X5)
│   ├── Torch.test.ts               # MODIFIED — absorbs the moved torch light helper tests + new adapter tests
│   ├── Player.ts                   # MODIFIED — gains player light constants/adapter + held-torch geometry/constants
│   └── Player.test.ts              # MODIFIED — absorbs playerGlowStrengthAt + heldTorchLightPosition tests + new adapter tests
├── engine/
│   ├── Lighting.ts                 # MODIFIED — drops both light halves; keeps darkness/fog/eyes + generic localDarknessAt
│   ├── Lighting.test.ts            # MODIFIED — drops moved helper tests; localDarknessAt now tested with LightSource[]
│   ├── Renderer.ts                 # MODIFIED — generic drawDarkness/drawEnemyEyes; drops heldTorchLightPosition; consumes player geometry
│   └── Renderer.test.ts            # MODIFIED — call signatures updated; moved heldTorchLightPosition tests relocated
├── editor/
│   ├── caveLightingPreview.ts      # MODIFIED — returns { darknessLevel, lights: LightSource[] }
│   ├── caveLightingPreview.test.ts # MODIFIED — torches/playerLight assertions become lights
│   ├── EditorCanvas.tsx            # MODIFIED — passes preview.lights to both passes; zoom-only drawDarkness
│   ├── EditorCanvas.test.tsx       # MODIFIED — Renderer mock drops heldTorchLightPosition; light-call expectations updated
│   ├── EditorToolbar.test.tsx      # MODIFIED — Renderer mock drops heldTorchLightPosition
│   └── LevelEditorPage.test.tsx    # MODIFIED — Renderer mock drops heldTorchLightPosition
├── PlatformerState.ts              # MODIFIED — torchPositions imports TorchLight from entities/Torch
└── PlatformerPage.tsx              # MODIFIED — assembles LightSource[] per frame (FR-019); drops heldTorchLightPosition
                                    # (PlatformerPage.test.tsx unchanged — imports only unchanged HUD constants from Renderer)
```

**Structure Decision**: The single-project platformer tree is retained. The one new module is
`contracts/lighting.ts` (the shared render-vocabulary leaf, alongside `WorldType`/`geometry`/
`DrawContext`). The torch light half joins its subject in `entities/Torch.ts`; the player light
half and held-torch geometry join their subject in `entities/Player.ts`. `engine/Lighting.ts`
keeps only what is not light-kind-specific (darkness easing/clamping, the cave-cell probe, fog,
the enemy-eye math) plus the now-generic `localDarknessAt`. This keeps every R-001 edge direction
(`entities/ → contracts/`, `engine/ → entities/`, `engine/ → contracts/`; no `entities/ → engine/`).

## Complexity Tracking

> No constitution violations — this table is intentionally empty.
