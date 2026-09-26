# Implementation Plan: Platformer Renderer Split

**Branch**: `R-009-platformer-renderer-split` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/R-009-platformer-renderer-split/spec.md`

## Summary

Split the platformer's ~1,911-line `src/themes/platformer/engine/Renderer.ts` into two
engine-render modules — `SceneRenderer.ts` (every world-space draw pass) and `HudRenderer.ts`
(every screen-space draw pass, the shared HUD position constants and the generic HUD counter) —
placed under a new `engine/render/` grouping (analysis §4.1 / F7, the Phase 7 render-folder
landing; moving the atlases/catalogs into that grouping stays out of scope). Collapse the four
per-kind counter drawers and their four width/X helpers into one declarative-descriptor
`drawHudCounter` plus one `hudCounterWidth`/`hudCounterX` measurer pair, keeping the
chest→key→bomb X-chaining and group-hiding rules pixel-identical and keeping the measurement
helper publicly exported for the key-collection flying-text target. Consume R-006's single
`drawPickups` unchanged and either consume R-015's tile registry (once it lands) or relocate the
existing `tileSource`/`drawTerrain` path byte-for-byte. Split the ~3,800-line `Renderer.test.ts`
to mirror the two modules, update every consumer import, add an automated structural guard test,
and change no visible pixel.

## Technical Context

**Language/Version**: TypeScript ~6.0.2 (strict mode, no `any`) · React 19 · Vite 8

**Primary Dependencies**: Canvas 2D API only for the renderer modules; Vitest 4 + React Testing
Library + jsdom for tests. No new runtime dependency is introduced (Constitution V).

**Storage**: N/A — static site; the platformer's levels/sprites/tuning are typed data and are
unchanged. No data migration (spec "No data migration").

**Testing**: Vitest + React Testing Library + jsdom, per
[docs/TestingGuide.md](../../docs/TestingGuide.md): `{method}-{condition}-{expected-result}`
naming, `// Arrange/Act/Assert` sections, 100% for pure utilities and 80%+ components. The
renderer modules are DOM-free pure draw functions tested against a fake `CanvasRenderingContext2D`
(as `engine/effects/testContext.ts` already does); the guard test reads the module sources.

**Target Platform**: Static browser build (no backend); the renderer runs against
`CanvasRenderingContext2D`.

**Project Type**: Single static web app; feature code under
`src/themes/platformer/`.

**Performance Goals**: No change. Frame allocation and pass count must be identical to today —
the split is module boundaries only; the page keeps owning the per-frame allocation and call order.

**Constraints**:
- Pixel-identical output: every pass's depth/order, every HUD position/spacing/constant value, the
  counter text and group-hiding rules, and the editor preview output are unchanged (FR-010).
- `engine/render/SceneRenderer.ts` and `engine/render/HudRenderer.ts` MUST NOT import each other
  (FR-001), enforced by an automated guard test (FR-015).
- No second tile registry and no renderer-local tile-kind dispatch (FR-008).
- No widened dependency edges: `contracts/` stays a leaf, no new `level/ → engine/`, no new
  `engine/ → state/` (FR-012). The renderer modules stay engine-layer and receive plain values.
- No compatibility barrel/alias/re-export preserving `engine/Renderer.ts` (FR-009).
- No auto-commit (constitution workflow; `.specify/extensions.yml` `before_plan`/`after_plan`
  git.commit hooks are optional and are not executed by this command).

**Scale/Scope**: One ~1,911-line source module → two modules + a thin shared-helper home; four
counter drawers + four helpers → one generic drawer + one measurer pair; one ~3,800-line test
file → two mirrored test files (+ a shared test helper if needed); seven consumer/mock sites
(`PlatformerPage.tsx`, `EditorCanvas.tsx`, `Renderer.test.ts`, `EditorCanvas.test.tsx`,
`LevelEditorPage.test.tsx`, `EditorToolbar.test.tsx`, `PlatformerPage.test.tsx`) re-pointed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from [.specify/memory/constitution.md](../../.specify/memory/constitution.md), with
[Architecture.md](../../docs/Architecture.md) and [TestingGuide.md](../../docs/TestingGuide.md)
as authoritative conventions:

| Principle / Gate | Outcome | Evidence / mitigation |
| --- | --- | --- |
| **I. Typed Data Architecture** — types before data, strict, no `any` | PASS | The only new type is the exported `HudCounterDescriptor`/`HudCounterIcon` union in `HudRenderer.ts` (no data files touched). Strict mode holds; no `any`. The refactor does not touch `src/data/` or CV types. |
| **II. Testing (NON-NEGOTIABLE)** — TDD, all tests pass, naming/coverage | PASS | The ~3,800-line renderer suite migrates assertions unchanged (FR-011); consolidated counters are re-expressed against the generic form (never weakened/skipped/deleted); a new guard test covers the structural invariants. Tests are authored/updated before implementation moves land. |
| **III. Code Quality & Component Standards** — named exports, PascalCase types, camelCase functions | PASS | New modules use named exports only; `SceneRenderer`/`HudRenderer` are module names; descriptor types are PascalCase interfaces, functions camelCase. No React component or shadcn change. |
| **IV. No Feature Bloat** — spec-originated, minimal, no exploratory change | PASS | Originates from issue #97 with a ratified spec; scope is fixed to the module split + generic counter + guard. The `engine/render/` grouping is the R-009 portion of F7; moving atlases/catalogs, R-015's registry and R-012's HUD model are explicitly out of scope. No new counter/HUD/art/gameplay. |
| **V. Performance & Static Delivery** — no unjustified deps, load/perf budget | PASS | No dependency added; no new pass, allocation or asset. Bundle change is a code move only. |
| **Workflow: manual browser check for visible behaviour** | PASS (planned) | Because the spec is behaviour-preserving, the manual browser pass (SC-005) compares against the pre-refactor build; it is a required verification step in `quickstart.md`, not part of this planning command. |
| **Workflow: layer/dependency edges (R-001)** | PASS | FR-012: renderer modules remain engine-layer; `contracts/` stays a leaf; no `level/ → engine/` or `engine/ → state/` edge is added. |
| **Workflow: no auto-commit** | PASS | No commit is made by this command. |

**Post-Phase-1 re-check**: re-evaluated after design (see end of this document). No violations, so
**Complexity Tracking is empty** and no exception is claimed.

## Project Structure

### Documentation (this feature)

```text
specs/R-009-platformer-renderer-split/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── renderer-modules.md
│   └── hud-counter.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/themes/platformer/
├── engine/
│   ├── Renderer.ts            # DELETED (FR-009) — no barrel, alias or re-export remains
│   ├── Renderer.test.ts       # SPLIT into the two test files under render/ (FR-011)
│   ├── textDraw.ts            # KEPT — the preserved shared outlined-text home (fillTextWithOutline,
│   │                          #        RESTART_PROMPT_FONT_FAMILY); imported by HUD + effect modules
│   ├── GroundAtlas.ts         # unchanged (stays flat; F7 grouping is out of scope)
│   ├── BackgroundAtlas.ts     # unchanged
│   ├── StaticObjectsCatalog.ts# unchanged
│   ├── BackgroundDecorCatalog.ts # unchanged
│   ├── Lighting.ts            # unchanged (scene)
│   ├── CrumblingFloor.ts      # unchanged (scene)
│   └── render/                # NEW grouping (R-009 F7 render portion)
│       ├── SceneRenderer.ts        # NEW — all world-space passes + scene-only helpers
│       ├── SceneRenderer.test.ts   # NEW — world-pass describes moved from Renderer.test.ts
│       ├── HudRenderer.ts          # NEW — all screen-space passes, HUD constants, generic counter
│       ├── HudRenderer.test.ts     # NEW — HUD-pass describes moved from Renderer.test.ts
│       ├── renderTestContext.ts    # NEW (only if needed) — shared fake-canvas/placement helpers
│       └── guard.test.ts           # NEW — FR-015 structural guard
├── PlatformerPage.tsx         # imports re-pointed (scene + HUD symbols)
├── PlatformerPage.test.tsx    # imports re-pointed (HEARTS_START_X/hudCounterX/KEY_COUNTER_Y/
│                              #        LOW_HEALTH_GLOW_WIDTH_PX; key-flying-text target)
├── editor/
│   ├── EditorCanvas.tsx       # imports re-pointed (scene symbols)
│   ├── EditorCanvas.test.tsx  # vi.mock + dynamic imports re-pointed
│   ├── LevelEditorPage.test.tsx # vi.mock + import re-pointed
│   └── EditorToolbar.test.tsx # vi.mock re-pointed
└── (all other platformer files unchanged)
```

**Structure Decision**: The two renderer modules land in the new `engine/render/` grouping
(analysis §4.1, the render half of F7 / Phase 7). The renderer's own dependencies — the atlases,
catalogs, `Lighting`, `CrumblingFloor` and the layers — stay where they are; moving them into the
grouping stays F7/out of scope (spec FR-013 + Out of Scope). `engine/textDraw.ts` remains the
single shared outlined-text home. No new shared drawing-helper module is required because, after
the split, no drawing helper is imported by *both* renderer modules (every private helper maps to
exactly one module — see `data-model.md`); the only cross-cutting helper (outlined text) already
lives in `textDraw.ts` and is imported by the HUD renderer and the effect modules, never copied.
See `research.md` D1/D3 for the full decision and the rejected flat-`engine/` alternative.

## Complexity Tracking

> Empty — no Constitution Check violations require justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(none)_  |            |                                     |

## Post-Design Constitution Check (after Phase 1)

Re-evaluated against `research.md`, `data-model.md` and `contracts/`:

| Gate | Post-design outcome |
| --- | --- |
| I. Typed Data | PASS — new descriptor types are strict, no `any`; no data files touched. |
| II. Testing | PASS — test-split map (research D4) mirrors modules; assertions unchanged; guard test specified (research D5). |
| III. Code Quality | PASS — named exports; no component/shadcn change. |
| IV. No Feature Bloat | PASS — scope bounded to the split + generic counter + guard; desktop folder grouping limited to the two modules the spec sanctions. |
| V. Performance | PASS — no dependency, pass, allocation or asset change. |
| FR-001/FR-015 | PASS — no-cross-import invariant + guard specified in `contracts/renderer-modules.md`. |
| FR-004 | PASS — helper-home map in `data-model.md` shows no helper duplicated; `textDraw.ts` preserved. |
| FR-005/FR-006/FR-014 | PASS — one declarative descriptor drawer + one measurer; exact fields in `contracts/hud-counter.md`. |
| FR-008 | PASS — decision D6: consume R-015 when landed, else relocate `tileSource`/`drawTerrain` unchanged; never a second registry. |
| FR-012 | PASS — no widened edges. |
