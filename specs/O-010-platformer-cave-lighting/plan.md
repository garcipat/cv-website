# Implementation Plan: Platformer Cave Lighting

**Branch**: `O-010-cave-lighting` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-010-platformer-cave-lighting/spec.md`

## Summary

Cave areas of the platformer level darken the view while the player stands on a
background piece from the cave/charcoal family, brightening smoothly when they
leave. Wall torches punch soft, warm, radial light pools back through that
darkness, and living enemies in dark spots are marked by a small pair of glowing
yellow eyes. The level editor's background palette is split into **Surface** and
**Cave** sections so authors can tell at a glance which pieces darken.

The technical approach is a single eased **darkness level** derived from the
player's foot cell, rendered as one semi-transparent black overlay composited
through a reusable offscreen canvas: torches are punched out with
`destination-out` radial gradients and re-tinted with additive warm gradients.
No new runtime dependency, no new image asset (the eyes are drawn primitives),
and the whole effect is O(visible torches) per frame. This follows
[docs/Architecture.md](../../docs/Architecture.md) (typed data, signals over
context, canvas rendering, no backend) and
[docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest unit tests for pure
engine modules, RTL component tests for the palette).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`) + React 19
**Primary Dependencies**: Vite 6+, Preact Signals (`@preact/signals-react`), Canvas 2D API, Tailwind CSS 4 + shadcn/ui. **No new runtime dependency.**
**Storage**: N/A — static site. The level layout/background are in-memory signals (`currentLayout` / `currentBackground` in `level/level.ts`); the editor keeps persisting to localStorage / level JSON as today. No new persistence.
**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md). TDD is mandatory (constitution Principle II).
**Target Platform**: Static web (browser), desktop + mobile, reached via the `/platformer` route.
**Project Type**: Single static web app — a canvas game theme (`src/themes/platformer/`) inside the CV site.
**Performance Goals**: 60 fps; SC-006 (several torches + enemies on screen) with no perceptible stutter. Overlay cost is O(visible torches), with no per-pixel JS loops.
**Constraints**: No backend/API/DB; no new dependencies; strict TypeScript; darkness MUST NOT cover HUD/UI (FR-006); darkness freezes with the world during pause/death; darkness capped (~0.85) so the scene stays readable (FR-005); no new sprite art required.
**Scale/Scope**: One feature. One new pure engine module (lighting) plus a palette grouping helper in `editor/`, small edits to ~10 existing files, one new editor palette section split.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Gate | Status | Notes |
| --- | --- | --- | --- |
| I. Typed Data Architecture | Types declared before use; no `any`; typed JSON/data imported directly | ✅ PASS | New `BackgroundPieceFamily` union added to `level/LevelData.ts`; the family is carried on the typed `BackgroundCatalogEntry`. Lighting constants/params are typed. No runtime parsing, no API. |
| II. Testing (NON-NEGOTIABLE) | Tests written and reviewed before implementation; all tests pass; `{method}-{condition}-{expectedResult}` naming; Vitest + RTL + jsdom | ✅ PASS | Pure lighting math (`engine/Lighting.ts`), catalog family, torch discovery, and the palette sections all get unit/component tests written first. Existing `Renderer.test.ts` conventions cover the overlay's no-op-at-full-brightness case. |
| III. Code Quality & Component Standards | Named arrow exports, typed props inline, `cn()` for conditional classes, CLI-managed shadcn/ui only, named exports | ✅ PASS | New modules export named functions/consts. `Palette.tsx` continues to use `PaletteGroup` + `cn()`; no shadcn component is edited or added. |
| IV. No Feature Bloat | Feature originates from a spec in `specs/`; tracked in `docs/Features.md`; no roadmap step lists | ✅ PASS | O-010 is already registered in `docs/Features.md` with this spec. The background-art rework stays a separate feature (O-014), as the spec states. |
| V. Performance & Static Delivery | No unjustified dependency; performance considered; assets optimized | ✅ PASS | Zero new dependencies. One offscreen canvas reused across frames; O(visible torches) work. No new asset. |

**Post-Phase-1 re-check**: All five gates still pass. The design introduces no
new dependency, no backend, no `any`, and no shadcn edits. See
[research.md](./research.md) for the decisions and rejected alternatives.

**Complexity Tracking**: No violations — the table is intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/O-010-platformer-cave-lighting/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── lighting.md
│   ├── rendering.md
│   └── editor-palette.md
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── level/
│   ├── LevelData.ts                 # EDIT: add BackgroundPieceFamily to the type surface
│   └── LevelParser.ts               # EDIT: add findTorchTiles (mirrors the other findXTiles helpers)
├── engine/
│   ├── BackgroundCatalog.ts         # EDIT: carry `family: 'surface' | 'cave'` per entry
│   ├── Lighting.ts                  # NEW: pure darkness/light math + constants
│   ├── Lighting.test.ts             # NEW: unit tests (TDD, written first)
│   ├── Renderer.ts                  # EDIT: drawDarknessOverlay + drawEnemyEyes
│   └── Renderer.test.ts             # EDIT: full-brightness no-op coverage
├── editor/
│   ├── backgroundPaletteTiles.ts    # EDIT: expose surface/cave sections
│   ├── backgroundPaletteTiles.test.ts # EDIT: section membership
│   ├── Palette.tsx                  # EDIT: render Surface and Cave groups on the background layer
│   └── Palette.test.tsx             # EDIT: assert the two sections
├── PlatformerState.ts               # EDIT: darknessLevel signal, torch placements, reset
├── PlatformerPage.tsx               # EDIT: own the offscreen canvas; tick darkness; render overlay + eyes
├── PlatformerState.test.ts          # EDIT: darkness/torch placement coverage
└── level/level.ts                   # EDIT: TORCH_TILES computed (from findTorchTiles)
```

**Structure Decision**: Single static web app. All work lands inside the
existing `src/themes/platformer/` tree, following the established split of
concerns: pure math and catalogs in `engine/` and `level/`, state in
`PlatformerState.ts`, orchestration + canvas ownership in `PlatformerPage.tsx`,
authoring in `editor/`. `Renderer.ts` remains the only module that maps world
coordinates to canvas coordinates; the lighting module is pure and canvas-free
so it is unit-testable without a DOM.

## Complexity Tracking

> No constitution violations — nothing to justify.
