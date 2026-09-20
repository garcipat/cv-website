# Implementation Plan: Editor Dark Mode

**Branch**: `O-015-editor-dark-mode` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/O-015-editor-dark-mode/spec.md`

## Summary

The Level Editor gains its own persisted light/dark appearance. A single icon
control in O-016's toolbar flips the editor between the game's daylight look and
a dark palette; the choice is stored under the editor's own key and survives a
reload, independently of the site-wide theme. While the dark appearance is
active the level canvas additionally previews O-010's cave lighting — the scene
is always darkened to the editor's own preview value (`EDITOR_PREVIEW_DARKNESS`,
0.8, lighter than the game's `MAX_DARKNESS`) with the game's torch light pools,
the spawn's carried glow, and enemy eye markers — and is view-only so it can
never change an export or a save.

The technical approach has three parts: (1) the editor **owns its palette** by
pinning the shadcn CSS variables through a `data-editor-appearance` attribute
and a dedicated stylesheet, so dialogs/selects/tooltips (which portal out of the
editor tree) are covered too and the site-wide theme's palette cannot leak into
the editor's tokens — the editor keeps the app's attribute→token-block mechanism
and leaves Tailwind's `dark:` variant untouched (research D13/D14);
(2) the appearance is one validated localStorage-backed signal in
`editorState.ts`, exposed through `editorActions`; (3) the preview is a new
**pure** `editor/caveLightingPreview.ts` module that reuses `Lighting.ts`'s
constants and the existing `Renderer.ts` draw passes unchanged, composed
into `EditorCanvas`'s existing single redraw effect. This follows
[docs/Architecture.md](../../docs/Architecture.md) (signals over context, typed
data, pure `src/lib/` utilities, canvas rendering, no backend) and
[docs/TestingGuide.md](../../docs/TestingGuide.md) (Vitest unit tests for pure
modules, RTL + jsdom component tests, `{method}-{condition}-{expectedResult}`
naming, 100% coverage for `src/lib/`).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`) + React 19
**Primary Dependencies**: Vite 6+, Preact Signals (`@preact/signals-react`), Tailwind CSS 4 + shadcn/ui (Dialog/Select/Tooltip/Button, CLI-managed), Canvas 2D API, `lucide-react` (already used by the toolbar). **No new runtime dependency.**
**Storage**: Browser `localStorage` only — one new key, `platformer-editor-appearance` (`'light' | 'dark'`). Existing editor keys keep their identity (FR-003, O-016 FR-022). No backend, no API, no DB.
**Testing**: Vitest + React Testing Library + jsdom, per [docs/TestingGuide.md](../../docs/TestingGuide.md). TDD mandatory (constitution Principle II). The pure preview module and the `src/lib/` validator get 100%-covered unit tests; toolbar/canvas behaviour is component-tested through the existing `levelEditorPage` page object.
**Target Platform**: Static web (browser), desktop + mobile, at `/platformer/editor`. Dark mode is client-side and works identically on the built site (FR-014).
**Project Type**: Single static web app — the editor inside `src/themes/platformer/editor/`, the game engine in `src/themes/platformer/engine/`.
**Performance Goals**: Toggle and every edit-time redraw stay under 200 ms (constitution Principle V, FR-018); the preview is recomputed only on an edit/toggle (no game loop, FR-013) and its overlay work is O(visible torches). Drag-paint must keep per-cell feedback under 200 ms with no dropped cell (FR-018).
**Constraints**: The editor's appearance MUST NOT depend on the site-wide theme (`data-theme`) (FR-004, SC-007); the preview MUST be view-only — exports, saves and gameplay are byte-identical with dark mode on or off (FR-010, FR-016, SC-005); the light appearance with no preview MUST restore the pre-feature daylight look (FR-007, SC-004); no new in-game lighting rules or constants (the preview's own darkness value is preview-only) (FR-016); no ARIA additions beyond the toolbar's existing icon-control pattern (spec Assumption); no new runtime dependency.
**Scale/Scope**: One feature. One new stylesheet, one new pure preview module, one `src/lib/` extension, and edits to ~8 editor files plus the test suites.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Gate | Status | Notes |
| --- | --- | --- | --- |
| I. Typed Data Architecture | Types declared before use; no `any`; typed data imported directly | ✅ PASS | `EditorAppearance` union and the `CaveLightingPreview` interface are declared in their modules before use. The persisted value is validated, never `any`. No runtime parsing, no API. |
| II. Testing (NON-NEGOTIABLE) | Tests written and reviewed before implementation; all pass; `{method}-{condition}-{expectedResult}` naming; Vitest + RTL + jsdom | ✅ PASS | New pure modules (`editor/caveLightingPreview.ts`) and the `createLocalStorageSignal` validator get unit tests first; toggle/persistence/preview behaviour is component-tested via the page object. Existing editor tests are preserved and extended, never weakened (FR-015). |
| III. Code Quality & Component Standards | Named arrow exports, typed props inline, `cn()` for conditional classes, CLI-managed shadcn/ui only, named exports | ✅ PASS | New code uses named arrow exports with inline props. The toggle reuses the existing `Button` + `Tooltip` + `toolbarIconClass()`/`cn()` language. No shadcn component is edited or added. |
| IV. No Feature Bloat | Feature originates from a spec in `specs/`; tracked in `docs/Features.md`; no roadmap step lists | ✅ PASS | O-015 is registered in `docs/Features.md` with this spec; the scope is exactly what the spec's Assumptions fix. No new capability beyond the toggle, the dark palette and the view-only preview. |
| V. Performance & Static Delivery | No unjustified dependency; performance considered; assets optimized | ✅ PASS | Zero new dependencies, zero new assets (the preview reuses existing draw passes and the existing sprite sheets). The preview runs only on edit/toggle, not per frame; the offscreen darkness layer is reused across redraws. |

**Post-Phase-1 re-check**: All five gates still pass. The design adds no
dependency, no backend, no `any`, no shadcn edits, and no new asset; the
preview is a composition of existing pure functions and existing render passes.
See [research.md](./research.md) for the decisions and rejected alternatives.

**Complexity Tracking**: No violations — the table is intentionally omitted.

## Project Structure

### Documentation (this feature)

```text
specs/O-015-editor-dark-mode/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── editor-appearance.md
│   └── cave-lighting-preview.md
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
src/
├── styles/
│   └── themes/
│       └── editor.css                      # NEW: editor light/dark token blocks + canvas backdrop
├── lib/
│   ├── utils.ts                            # EDIT: optional `isValid` on createLocalStorageSignal
│   └── utils.test.ts                       # EDIT: invalid stored value falls back to the default
├── themes/platformer/
│   ├── editor/
│   │   ├── editorState.ts                  # EDIT: EditorAppearance type + validated appearance signal
│   │   ├── editorState.test.ts             # EDIT: default / invalid / persist coverage
│   │   ├── editorActions.ts                # EDIT: setEditorAppearance / toggleEditorAppearance
│   │   ├── editorActions.test.ts           # EDIT: toggle / set + rapid-toggle coverage
│   │   ├── caveLightingPreview.ts          # NEW: pure spawn-probe + torch discovery + preview inputs
│   │   ├── caveLightingPreview.test.ts     # NEW: unit tests (TDD, written first)
│   │   ├── EditorWorkspace.tsx             # EDIT: own the appearance attribute + pass appearance down
│   │   ├── EditorToolbar.tsx               # EDIT: single dark-mode icon control with tooltip
│   │   ├── EditorCanvasPane.tsx            # EDIT: thread `appearance` to the canvas
│   │   ├── EditorCanvas.tsx                # EDIT: cave preview pass + affordance redraw + backdrop token
│   │   ├── EditorCanvas.test.tsx           # EDIT: preview draw-order / dark-backdrop coverage
│   │   ├── EditorToolbar.test.tsx          # EDIT: toggle presence, aria-pressed, tooltip
│   │   ├── LevelEditorPage.test.tsx        # EDIT: toggle + persistence + independence from `theme`
│   │   └── LevelEditorPage.page.ts         # EDIT: expose the new control/attribute testids
│   └── engine/                             # no change (Lighting/Renderer reused as-is)
└── index.css                               # EDIT: import styles/themes/editor.css after the theme files
```

**Structure Decision**: Single static web app. All work lands inside the
existing `src/themes/platformer/editor/` tree, with the one shared extension in
`src/lib/utils.ts` and the palette in `src/styles/themes/`. This preserves the
established split: `editorState.ts` is the sole home for editor state
(O-016 FR-016), `editorActions.ts` is the only mutation surface, and
`EditorWorkspace`/`EditorToolbar`/`EditorCanvasPane` stay presentational
containers. `engine/Lighting.ts` and `engine/Renderer.ts` are **not modified** —
the preview composes their existing pure functions and draw passes, so the
in-game cave lighting is provably untouched (FR-016). The preview module is
pure and canvas-free so it is unit-testable without a DOM.

> Note: the stylesheet is imported from `src/index.css` (the single global CSS
> entry); the tree above names it as `styles/themes/editor.css` to match the
> existing per-theme files.

## Complexity Tracking

> No constitution violations — nothing to justify.
