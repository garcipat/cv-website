# Implementation Plan: Platformer Core Contracts & Dependency Layers

**Branch**: `R-001-platformer-core-contracts` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/R-001-platformer-core-contracts/spec.md`

## Summary

Extract a new leaf `contracts/` layer under `src/themes/platformer/` holding the shared
contracts currently scattered across `entities/` and `engine/`; break the
`level/ → engine/` import cycle by relocating `Box`, the whole torch module, and
the hazard phase vocabulary; and remove the `engine/ → PlatformerState` inversion
by moving `RewardReveal` into the state layer. This is a pure structural change:
values, shapes, and gameplay behaviour are preserved. Only import paths change,
plus three type-only "vocabulary" extractions and one generic parameter on
`DrawContext` needed to keep `contracts/` a strict leaf. No new dependencies, no
automated boundary test (per spec clarification) — verified by the documented
manual import inspection in [quickstart.md](./quickstart.md), the existing test
suite, the production build, and a browser pass.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, no `any`), React 19
**Primary Dependencies**: none added — Vite 8, `@preact/signals-react`, Tailwind 4 already present
**Storage**: N/A (static site; typed JSON under `src/data/` unchanged)
**Testing**: Vitest 4 + React Testing Library + jsdom (`npm test`); build `npm run build` (`tsc -b && vite build`); lint `npm run lint`
**Target Platform**: static web (browser, no backend)
**Project Type**: single static SPA
**Performance Goals**: no regression — module-path-only moves, no new code on the per-frame path
**Constraints**: behaviour-preserving; `contracts/` MUST be a strict leaf; existing tests pass with import-path updates only (FR-011); no `any`; no new runtime dependency
**Scale/Scope**: ~40 modules relocated/retargeted under `src/themes/platformer/`; ~100 import sites updated; 3 new type-only vocabulary modules (`contracts/SpriteLookup.ts`, `contracts/PickupKind.ts`, `contracts/counters.ts`) plus `entities/hazards/phases.ts`

Authoritative conventions applied from
[docs/Architecture.md](../../docs/Architecture.md) (signals over Context, typed
data, static site, theme isolation) and
[docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest + RTL + jsdom,
`{method}-{condition}-{expected-result}` naming, Arrange/Act/Assert). The move map
and layer model live in [data-model.md](./data-model.md); the dependency
invariants in [contracts/layer-boundaries.md](./contracts/layer-boundaries.md).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                   | Outcome | Notes                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Typed Data Architecture**              | PASS    | No `src/data/` or `src/types/` change. Strict mode and the no-`any` rule are preserved; the only `unknown` introduced is the default type parameter on `DrawContext<TPotPlan = unknown>`, which is narrower than `any`.                                                                                                                                |
| **II. Testing (NON-NEGOTIABLE)**            | PASS\*  | Behaviour-preserving refactor: existing tests are the contract and MUST pass unmodified except for import paths (FR-011). No new tests are authored; the spec explicitly excludes an automated boundary test (clarification/assumption). Manual browser verification of a cave level + a reward reveal is required (SC-003), per the constitution's manual-check rule. |
| **III. Code Quality & Component Standards** | PASS    | Named exports only, preserved. No components, shadcn/ui, or `cn()` change. Module casing follows the existing convention (PascalCase type/class modules; camelCase registry/function modules). No `any`.                                                                                                                                                |
| **IV. No Feature Bloat**                    | PASS    | The work has a spec (`specs/R-001-platformer-core-contracts/`) and is tracked as **R-001** in `docs/Features.md`'s dependency map. On completion, mark the node `✅ R-001` and add `class R001 done`. It is a discrete refactor unit, not a step list.                                                                                                       |
| **V. Performance & Static Delivery**        | PASS    | No dependency added; no bundle-size growth expected. Moves change import paths only; the per-frame work is unchanged.                                                                                                                                                                                                                                    |

\* Exception documented, not a violation: TDD's "tests before implementation" is
satisfied by the existing suite for a move-only refactor; any behaviour change
would require new tests before code. The spec's clarification deliberately defers
boundary verification to a one-time manual inspection rather than a new automated
test.

**Post-design re-check (after Phase 1)**: unchanged — the design introduces no
new dependency and no behaviour change. The one shape change (`DrawContext`'s
generic pot-plan parameter) is type-level only and keeps Principle I satisfied
(`unknown`, never `any`). All five principles remain PASS.

## Project Structure

### Documentation (this feature)

```text
specs/R-001-platformer-core-contracts/
├── plan.md                          # This file (/speckit.plan command output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output — layer model + move map
├── quickstart.md                    # Phase 1 output — manual verification
├── contracts/
│   └── layer-boundaries.md          # Phase 1 output — dependency contract
└── tasks.md                         # Phase 2 output (/speckit.tasks — NOT here)
```

### Source Code (repository root)

Target layout after R-001 (moved files marked `←`; new files marked `NEW`):

```text
src/themes/platformer/
├── contracts/                            # NEW leaf layer — contracts + primitives, no upward imports
│   ├── WorldType.ts                 # ← entities/WorldType.ts
│   ├── capabilities.ts              # ← entities/capabilities.ts
│   ├── geometry.ts                  # ← entities/geometry.ts (+ Box from engine/Collision.ts)
│   ├── Outcome.ts                   # ← engine/Outcome.ts
│   ├── Contact.ts                   # ← engine/Contact.ts
│   ├── DrawContext.ts               # ← engine/DrawContext.ts (generic over the pot plan)
│   ├── PhysicsConfig.ts             # ← engine/PhysicsConfig.ts
│   ├── SpriteLookup.ts              # NEW — extracted from entities/sprites/SpriteSheet.ts
│   ├── PickupKind.ts                # NEW — extracted from entities/pickups/index.ts
│   └── counters.ts                  # NEW — CounterKey + CounterPopupLabelKey
├── entities/
│   ├── Torch.ts                     # ← engine/Torch.ts (+ TorchStrength from level/LevelData.ts)
│   ├── hazards/phases.ts            # NEW — FloorSpike/FallingStalactite phase + timer shapes
│   ├── pickups/index.ts             # PICKUP_TYPES conforms to contracts/PickupKind
│   ├── CollectiblesSummary.ts       # CounterKey imported from contracts/counters
│   ├── sprites/SpriteSheet.ts       # SpriteLookup imported from contracts/SpriteLookup
│   ├── WorldType.test.ts            # conformance test, stays in entities/
│   └── capabilities.test.ts         # conformance test, stays in entities/
├── engine/
│   ├── Collision.ts                 # Box imported from contracts/geometry
│   ├── FloorSpike.ts                # phase/timer shapes imported from entities/hazards/phases
│   ├── FallingStalactite.ts         # phase/timer shapes imported from entities/hazards/phases
│   ├── Lighting.ts / Renderer.ts    # torch imports from entities/Torch
│   └── CollectionEffects.ts         # CounterPopupLabelKey from contracts/counters
├── level/
│   ├── LevelData.ts                 # TorchStrength from entities/Torch
│   ├── LevelParser.ts               # torch module from entities/Torch
│   ├── HazardMapper.ts              # phases from entities/hazards/phases
│   └── SignMapper.ts                # Box from contracts/geometry
├── state/rewards.ts                 # ← engine/RewardReveal.ts
├── PlatformerState.ts               # torch/hazard/counter paths updated
└── PlatformerPage.tsx               # draw-context + reward-reveal paths updated
```

**Structure Decision**: A single new leaf folder `contracts/` is added under the
platformer theme; the existing `entities/`, `engine/`, and `level/` folders stay
in place and only their imports change. Two new homes are added — the `state/`
module and a single new file `entities/Torch.ts` — plus one new module inside the
existing `entities/hazards/`. This keeps the change local to `src/themes/platformer/` and
matches the analysis doc's proposed folder structure without starting the
out-of-scope `engine/render/` + `features/` split.

## Complexity Tracking

> No constitutional violations to justify. The single intentional shape change
> (`DrawContext`'s generic pot-plan parameter) is required by FR-002/FR-003 and is
> documented in [research.md](./research.md) §2.
