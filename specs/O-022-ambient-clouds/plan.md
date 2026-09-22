# Implementation Plan: Ambient Background Clouds

**Branch**: `O-022-ambient-clouds` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-022-ambient-clouds/spec.md`

## Summary

The platformer's backdrop gets one more decorative layer: a handful of soft white
clouds that drift **right to left across the open sky at their own pace, with a small
camera parallax**,
each at its own speed and height, so the scene stays alive while the player stands
still. A cloud that leaves the left edge re-enters from the right with a new speed,
shape and starting offset, so the procession never visibly loops.

The technical approach is a single new **pure engine module**,
`engine/AmbientClouds.ts`, that owns the cloud shapes, the seeded variation, the
population density and the drift/lifecycle math. The layer is drawn at the backdrop's
own uniform `BACKGROUND_RENDER_SCALE` with a small camera-linked parallax shift matching
the painted clouds/hills band (its own drift is camera-independent), immediately after
`drawBackgroundLayers` and behind every other element. It reuses the existing backdrop band geometry (extracted
from `BackgroundLayers.ts` as a small pure helper so the sky band has one source of
truth), reuses the already-authored `public/sprites/ambient_clouds.png` sheet, adds
**no runtime dependency and no new data file**, and honours `prefers-reduced-motion`
by drawing the clouds without advancing them.

This follows [docs/Architecture.md](../../docs/Architecture.md) (signals/canvas
themes, typed data, no backend, no new dependency) and
[docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest unit tests for pure
engine modules; `{method}-{condition}-{expectedResult}` naming).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`) + React 19
**Primary Dependencies**: Vite 6+, Preact Signals (`@preact/signals-react`), Canvas 2D API, Tailwind CSS 4 + shadcn/ui. **No new runtime dependency.**
**Storage**: N/A — static site. The cloud population and density are **constants in the engine module**, not level data (spec Assumption "Density is a constant, not per-level data"). No persistence, no new JSON.
**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md). TDD is mandatory (constitution Principle II). New pure module gets unit tests written first; the existing `BackgroundLayers.test.ts` gains geometry-helper coverage.
**Target Platform**: Static web (browser), desktop + mobile, reached via the `/platformer` route.
**Project Type**: Single static web app — a canvas game theme (`src/themes/platformer/`) inside the CV site.
**Performance Goals**: 60 fps (SC-004). The layer is O(number of ambient clouds) — at most a handful per frame — with no per-pixel JS and no per-frame canvas allocation.
**Constraints**: No backend/API/DB; no new dependency; strict TypeScript; clouds confined to the open sky and drawn behind terrain/entities/background tiles/HUD (FR-010/FR-011); cloud x rounded to whole pixels (FR-009); omitted when the sprite art has not loaded or the sky band is too short (FR-012/FR-013); frozen with the world during pause/death; stationary under reduced motion (FR-014). Render order is authoritative in [contracts/rendering.md](./contracts/rendering.md).
**Scale/Scope**: One feature. One new pure engine module (+ tests), a small extraction of the backdrop band geometry, one sheet registration, and edits to five existing files (`BackgroundLayers.ts`, `BackgroundLayers.test.ts`, `sheets.ts`, `PlatformerPage.tsx`, `PlatformerPage.test.tsx`).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Gate | Status | Notes |
| --- | --- | --- | --- |
| I. Typed Data Architecture | Types declared before use; no `any`; typed data imported directly | ✅ PASS | New `AmbientCloud`, `CloudField`, `CloudSourceRect`, `BackgroundBandGeometry` interfaces are declared in the engine modules before use. No CV data changes — density/shapes are engine constants, not JSON. |
| II. Testing (NON-NEGOTIABLE) | Tests written and reviewed before implementation; all tests pass; `{method}-{condition}-{expectedResult}` naming; Vitest + RTL + jsdom | ✅ PASS | `engine/AmbientClouds.test.ts` (new) covers population, drift independence, respawn variation, containment, rounding, reduced motion, degradation. `engine/BackgroundLayers.test.ts` gains band-geometry cases. TDD: tests first. |
| III. Code Quality & Component Standards | Named arrow exports, typed props inline, `cn()` for conditional classes, CLI-managed shadcn/ui only, named exports | ✅ PASS | New module exports named functions/consts only. No component props added; no shadcn component touched or added. |
| IV. No Feature Bloat | Feature originates from a spec in `specs/`; tracked in `docs/Features.md`; no roadmap step lists | ✅ PASS | O-022 is already registered in `docs/Features.md` with this spec folder and its `O022 --> O009` dependency. On completion the node is marked done per the repo convention. |
| V. Performance & Static Delivery | No unjustified dependency; performance considered; assets optimized | ✅ PASS | Zero new dependencies. Existing `ambient_clouds.png` (185×32, 4 shapes) is small and already prepared; work is O(cloud count). |

**Post-Phase-1 re-check**: All five gates still pass. The design adds no
dependency, no backend, no `any`, no new data file and no shadcn edits; it extracts
one pure geometry helper so the sky band has a single source of truth. See
[research.md](./research.md) for decisions and rejected alternatives.

**Complexity Tracking**: No violations — the table is intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/O-022-ambient-clouds/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── ambient-clouds.md
│   └── rendering.md
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── engine/
│   ├── BackgroundLayers.ts       # EDIT: extract pure `backgroundBandGeometry(canvasHeight)`
│   ├── BackgroundLayers.test.ts  # EDIT: band-geometry coverage
│   ├── AmbientClouds.ts          # NEW: shapes, seeded variation, population, drift/lifecycle math + draw
│   ├── AmbientClouds.test.ts     # NEW: unit tests (TDD, written first)
│   ├── Renderer.ts               # (unchanged — the new draw pass lives with its own module)
│   └── CanvasSize.ts             # (unchanged — play-area width already derived here)
├── entities/sprites/
│   └── sheets.ts                 # EDIT: register AMBIENT_CLOUDS_SHEET (loading only)
└── PlatformerPage.tsx            # EDIT: own the cloud field, step it in the playing tick, draw the layer

public/sprites/
└── ambient_clouds.png            # EXISTING (currently untracked): 185×32, 4 cloud shapes
```

**Structure Decision**: Single static web app. All work lands inside the existing
`src/themes/platformer/` tree, following the established split of concerns: pure
math and catalogs in `engine/`, asset registration in `entities/sprites/sheets.ts`,
orchestration + canvas ownership in `PlatformerPage.tsx`. Keeping the ambient-cloud
draw pass in its own module (rather than `Renderer.ts`) mirrors how
`BackgroundLayers.ts` already owns the backdrop's draw pass; `Renderer.ts` remains
the module that maps *world* coordinates to canvas coordinates, which this
mostly screen-space layer deliberately does not need.

## Complexity Tracking

> No constitution violations — nothing to justify.
