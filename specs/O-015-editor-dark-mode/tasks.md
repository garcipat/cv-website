---
description: 'Task list for Editor Dark Mode (O-015)'
---

# Tasks: Editor Dark Mode

**Input**: Design documents from `/specs/O-015-editor-dark-mode/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution Principle II (NON-NEGOTIABLE) and FR-015 make TDD
mandatory here: tests are written first, must fail, then implementation follows.
Test names use `{method}-{condition}-{expectedResult}` (docs/TestingGuide.md).

**Organization**: Tasks are grouped by user story so each story is independently
implementable and testable. Stories are delivered in priority order (P1 → P2 → P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names its exact file path

## Path Conventions

Single static web app. All work is inside the existing tree:

- Editor feature code: `src/themes/platformer/editor/`
- Shared pure utilities: `src/lib/`
- Palette/styles: `src/styles/themes/` + `src/index.css`
- Feature docs: `docs/Features.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the editor-owned stylesheet and register it in the global
CSS entry so the appearance attribute has a token surface to select (research
D1/D4/D14).

- [x] T001 [P] Create `src/styles/themes/editor.css` with the `[data-editor-appearance='light']` block pinning the platformer daylight shadcn token values (copy `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring` from `src/styles/themes/platformer.css`) plus `--editor-canvas-backdrop` set to the daylight sky value (research D4, contracts/editor-appearance.md)
- [x] T002 Add `@import './styles/themes/editor.css';` to `src/index.css` immediately after the `./styles/themes/platformer.css` import (line 14) so `[data-editor-appearance='…']` wins the cascade at equal specificity (research D1/D14, FR-004)

**Checkpoint**: The stylesheet loads and the light baseline is pinned.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The validated storage helper and the appearance signal that every
user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Add failing unit tests for the optional `isValid` predicate in `src/lib/utils.test.ts` — `createLocalStorageSignal-withValidPredicateAndStoredValue-keepsIt`, `-withInvalidStoredValue-fallsBackToDefault`, `-withoutStoredValue-usesDefaultWithoutCallingPredicate`, and a case proving existing callers that omit `isValid` are unchanged (research D2/D12, FR-003)
- [x] T004 Implement the optional `isValid?: (value: unknown) => boolean` third parameter on `createLocalStorageSignal` in `src/lib/utils.ts`: a stored value that fails the predicate is treated exactly like a missing/unparseable value and the default is used; omitting it preserves current behaviour (depends on T003, contracts/editor-appearance.md)
- [x] T005 [P] Add failing tests for `editorAppearanceSignal` in `src/themes/platformer/editor/editorState.test.ts` — `editorAppearanceSignal-withNoStoredValue-defaultsToLight`, `-withInvalidStoredValue-resolvesToLight`, `-withValidStoredDarkValue-initialisesDark`, and a write persists under `platformer-editor-appearance` (data-model.md, FR-003)
- [x] T006 Add `export type EditorAppearance = 'light' | 'dark'` and `export const editorAppearanceSignal = createLocalStorageSignal<EditorAppearance>('platformer-editor-appearance', 'light', (value): value is EditorAppearance => value === 'light' || value === 'dark')` to `src/themes/platformer/editor/editorState.ts`, keeping it the single home for editor state (depends on T004, T005; O-016 FR-016)

**Checkpoint**: Appearance state exists, is validated, and persists. User stories can begin.

---

## Phase 3: User Story 1 - One control switches the editor to a dark appearance, and it remembers (Priority: P1) 🎯 MVP

**Goal**: A single toolbar control flips the editor's appearance and the choice
survives a reload, independently of the site-wide theme.

**Independent Test**: Open the editor, activate the dark-mode control, confirm
`aria-pressed` flips and `document.documentElement[data-editor-appearance]`
changes, reload, and confirm the appearance is restored; activate it again and
confirm light returns and also survives a reload (quickstart §1).

### Tests for User Story 1 ⚠️ Write these FIRST and confirm they FAIL

- [x] T007 [US1] Extend `src/themes/platformer/editor/LevelEditorPage.page.ts` with `toolbar.appearanceToggle`, `toolbar.queryAppearanceToggle`, an `editorAppearanceAttribute` getter for `document.documentElement.dataset.editorAppearance`, and a `toggleAppearance()` interaction helper (contracts/editor-appearance.md)
- [x] T008 [P] [US1] Add failing action tests in `src/themes/platformer/editor/editorActions.test.ts` — `toggleEditorAppearance-fromLight-setsDarkAndPersists`, `-fromDark-setsLightAndPersists`, `setEditorAppearance-withEachLiteral-writesTheSignal`, and `toggleEditorAppearance-whenRepeatedNeverLeavesSignalAndStorageOutOfStep` (FR-003, spec Edge Case "Rapid toggling")
- [x] T009 [P] [US1] Add failing toolbar tests in `src/themes/platformer/editor/EditorToolbar.test.tsx` — `toolbar-whenLevelCanvas-showsTheAppearanceToggle`, `-whenBlueprintCanvas-showsTheAppearanceToggle`, `appearanceToggle-whenLight-hasAriaPressedFalseAndNamesDarkModeOff`, `-whenDark-hasAriaPressedTrueAndNamesDarkModeOn`, `-whenKeyboardFocused-revealsTheTooltipWithItsState`, and a click toggles the signal (FR-001/FR-002, contracts/editor-appearance.md)
- [x] T010 [P] [US1] Add failing page tests in `src/themes/platformer/editor/LevelEditorPage.test.tsx` — `editor-whenStoredAppearanceIsDark-rendersDarkOnMount`, `editor-whenToggledToDarkAndRemounted-restoresDark`, `editor-whileMounted-setsTheAppearanceAttributeOnHtml`, and `editor-onUnmount-removesTheAppearanceAttribute` (data-model.md invariants, FR-003)

### Implementation for User Story 1

- [x] T011 [US1] Add `setEditorAppearance(appearance: EditorAppearance)` and `toggleEditorAppearance()` to `src/themes/platformer/editor/editorActions.ts`, importing `editorAppearanceSignal`; no other module writes the signal directly (depends on T008, contracts/editor-appearance.md)
- [x] T012 [US1] Add the single dark-mode icon control to `src/themes/platformer/editor/EditorToolbar.tsx`: add an `appearance: EditorAppearance` prop, render one icon button (`data-testid="editor-appearance-toggle"`, `aria-pressed={appearance === 'dark'}`, `MoonIcon` when light / `SunIcon` when dark, tooltip `Dark mode: off` / `Dark mode: on`, `toolbarIconClass(active)`) in its own group after the canvas Level/Blueprint group and before the actions divider, wired to `toggleEditorAppearance` (depends on T009, T011; FR-001/FR-002, research D3)
- [x] T013 [US1] In `src/themes/platformer/editor/EditorWorkspace.tsx`, read `editorAppearanceSignal.value`, pass it to `EditorToolbar`, and add an effect (import `useEffect`) that sets `document.documentElement.dataset.editorAppearance` from the signal while mounted and deletes it on unmount (depends on T010, T012; data-model.md, FR-004)

**Checkpoint**: User Story 1 is fully functional and independently testable — toggle, persistence, and attribute lifecycle all work.

---

## Phase 4: User Story 2 - The dark editor is dark everywhere and still readable (Priority: P2)

**Goal**: The whole editor chrome and the canvas backdrop turn dark with legible
text and controls, and the look is unaffected by the site-wide theme.

**Independent Test**: Turn dark mode on and walk every surface — page, header,
toolbar, palette, both dialogs, both selectors, status text, canvas backdrop —
confirming each is dark and legible; change the site-wide theme and confirm the
editor is unchanged (quickstart §2).

### Tests for User Story 2 ⚠️ Write these FIRST and confirm they FAIL

- [x] T014 [P] [US2] Export `readGameBackgroundColor` from `src/themes/platformer/editor/EditorCanvas.tsx` (currently module-private at :130) so it can be imported, then add failing tests in `src/themes/platformer/editor/EditorCanvas.test.tsx` — `readGameBackgroundColor-whenEditorBackdropTokenIsSet-returnsIt` and `-whenTokenIsMissing-fallsBackToTheDaylightConstant` (FR-006, research D4/D11)
- [x] T015 [P] [US2] Add failing page tests in `src/themes/platformer/editor/LevelEditorPage.test.tsx` — `editor-whenCurrentThemeChanges-keepsItsOwnAppearanceValueAndAttribute`, `editor-whenDarkAndAPortaledDialogIsOpen-keepsTheAttributeOnHtmlSoPortalsInheritThePalette`, `editor-whenDarkWithANonIdeSiteTheme-resolvesTheDarkPaletteFromItsOwnBlock` (guards against `var(--color-ctp-*)` leakage), and `editor-whenMounted-neverWritesTheDataThemeAttribute` (FR-004/FR-005/FR-017, SC-007)

### Implementation for User Story 2

- [x] T016 [US2] Add the `[data-editor-appearance='dark']` block to `src/styles/themes/editor.css` with the IDE theme's Catppuccin Mocha shadcn token values **inlined as resolved `oklch()`/hex literals** (the same 19 tokens plus `--editor-canvas-backdrop` set to a deep desaturated navy). Do **not** write `var(--color-ctp-*)` — those are scoped to `[data-theme='ide']` (`ide.css:1-18`) and resolve to nothing under any other visitor theme (FR-004/SC-007). Map `--muted-foreground` to subtext1 (`#a6adc8`), not the IDE theme's undefined `var(--color-ctp-subtext)` (`ide.css:32`). The dark values stay editor-only (depends on T001, T015; FR-005, research D4)
- [x] T017 [US2] Update `readGameBackgroundColor()` in `src/themes/platformer/editor/EditorCanvas.tsx` to read `--editor-canvas-backdrop` (falling back to `FALLBACK_BACKGROUND_COLOR`) instead of `--background`, so the canvas backdrop follows the editor appearance (depends on T014, T016; FR-006)
- [x] T018 [US2] Run the quickstart §2 dark-mode walk and, for any editor surface still using a hardcoded colour instead of a semantic token, switch it to the matching shadcn token utility in `src/themes/platformer/editor/` (e.g. `EditorToolbar.tsx`, `Palette.tsx`, `LevelSelect.tsx`, `BlueprintSelect.tsx`, `EditorSaveDialog.tsx`) — never edit CLI-managed shadcn components (FR-005, research D13/D14)

**Checkpoint**: Dark mode covers every surface legibly and is provably independent of `data-theme`.

---

## Phase 5: User Story 3 - Dark mode previews how the cave will look in play (Priority: P3)

**Goal**: While dark, the level canvas previews the game's cave lighting —
darkness, torch pools, player glow, enemy eyes — driven by the same spawn probe,
live on every edit, and strictly view-only.

**Independent Test**: Paint a cave background area with a torch, place the spawn
inside it, turn dark mode on, and confirm the canvas shows darkness with a torch
pool, the player's glow, and enemy eye markers; move the spawn to open ground and
confirm the cave darkness disappears (quickstart §3).

### Tests for User Story 3 ⚠️ Write these FIRST and confirm they FAIL

- [x] T019 [P] [US3] Create failing unit tests in `src/themes/platformer/editor/caveLightingPreview.test.ts` — `caveLightingPreview-withNoSpawn-returnsMaxDarknessAndNoPlayerLight`, `-withASpawn-returnsMaxDarknessAndTheCarriedLight`, `-regardlessOfSpawnPosition-returnsMaxDarkness`, `-doesNotMutateItsArgument`, `torchLightsFromGrid-withNoTorchTiles-returnsEmpty`, and `-withTorchTiles-returnsTheirWorldCentres` (data-model.md, contracts/cave-lighting-preview.md)
- [x] T020 [P] [US3] Add failing tests in `src/themes/platformer/editor/EditorCanvas.test.tsx` — `canvas-whenDarkAndSpawnInsideACave-callsDrawDarknessDrawEnemyEyesAndDrawHeldTorchAtRest`, `canvas-whenLight-doesNotCallTheCavePasses`, `canvas-whenBlueprintMode-doesNotCallTheCavePassesEvenWhenDark`, `canvas-whenPreviewActive-redrawsGridLinesSignBadgesAndMarkersAboveTheOverlay`, and `canvas-whenSpawnOutsideEveryCave-doesNotCallDrawDarkness` (FR-008/FR-009/FR-011/FR-012/FR-013, contracts/cave-lighting-preview.md). Extend the existing `vi.mock('../engine/Renderer')` factory in that file to export `drawDarkness`, `drawEnemyEyes`, and `drawHeldTorch` — it currently exports none of them
- [x] T021 [P] [US3] Add a failing page test in `src/themes/platformer/editor/LevelEditorPage.test.tsx` — `editor-withDarkModeOn-exportsAndSavesTheSameLayoutAsWithItOff` (FR-010/FR-016, SC-005)

### Implementation for User Story 3

- [x] T022 [US3] Create the pure module `src/themes/platformer/editor/caveLightingPreview.ts`: export the `CaveLightingPreview` interface, `torchLightsFromGrid(grid: TileChar[][]): TorchLight[]` (scan via `TERRAIN_CHARS[char] === 'torch'`, centre at `tileToPixel` + `RENDERED_TILE_SIZE / 2`), and `caveLightingPreview(grid): CaveLightingPreview` returning `darknessLevel = EDITOR_PREVIEW_DARKNESS` (0.8, a preview-only constant) unconditionally and `playerLight = heldTorchLightPosition(synthesizePlayerState(grid))` (`null` when there is no spawn) — never throws, never mutates (depends on T019; FR-008/FR-009/FR-016, research D5/D6)
- [x] T023 [US3] Thread the appearance through `src/themes/platformer/editor/EditorWorkspace.tsx` → `EditorCanvasPane.tsx` → `EditorCanvas.tsx`: add `appearance: EditorAppearance` to `EditorCanvasPaneProps` and `EditorCanvasProps`, and pass `isBlueprintMode` to `EditorCanvas` so the preview gate has it (depends on T020, research D9/D10)
- [x] T024 [US3] Implement the preview in `src/themes/platformer/editor/EditorCanvas.tsx`: add a reused offscreen `HTMLCanvasElement` ref for the darkness layer, compute `caveLightingPreview(grid)` inside the existing single redraw effect, and when `appearance === 'dark' && !isBlueprintMode && preview.darknessLevel > 0` draw `drawHeldTorch`, `drawDarkness`, and `drawEnemyEyes` (with `synthesizeEnemyStates(grid)` and `worldElapsed = 0`) inside the existing foreground-alpha block after `drawPlayer`, then re-draw grid lines, sign badges and the two tile-marker passes at full opacity above the overlay; keep the pending placement preview last and add `appearance` to the effect dependency list (depends on T022, T023; FR-008/FR-010/FR-012/FR-013, research D7/D8)

**Checkpoint**: All three stories are independently functional; the preview follows every edit and never affects exports or saves.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Completion tracking, full verification, and the manual walkthrough.

- [x] T025 [P] Update `docs/Features.md` for O-015: prefix the dependency-diagram node (`O015["O-015: Editor Dark Mode"]` → `O015["✅ O-015: Editor Dark Mode"]`) and add `class O015 done`. This file is a dependency map only — it has no feature checkbox list and no Implementation Status table, so those two AGENTS.md steps do not apply here (issues remain the source of truth)
- [x] T026 Run the full gate from the repository root: `npm test`, `npm run lint`, and `npm run build` — all must pass with no new warnings
- [x] T027 Verify 100% coverage for the touched pure modules (`src/lib/utils.ts`, `src/themes/platformer/editor/caveLightingPreview.ts`) per docs/TestingGuide.md, adding any missing edge cases
- [x] T028 Run the full [quickstart.md](./quickstart.md) manual validation (persistence + rapid toggle, every dark surface, theme independence, cave preview and blueprint gating, export/save parity with dark on and off, and the built-site check in §4 via `npm run build && npm run preview`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational; deliver in priority order
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on other stories
- **User Story 2 (P2)**: After Foundational — builds on US1's control/attribute but its own tests stay independently runnable
- **User Story 3 (P3)**: After Foundational — builds on US1/US2 (appearance + dark canvas) but its pure module and draw-order tests are independently runnable

### Within Each User Story

- Tests are written first and MUST fail before implementation
- Page-object locators before the tests that use them
- Pure module before canvas composition
- Story complete before moving to the next priority

### Parallel Opportunities

- T001/T002 touch different files and can run together
- T003 and T005 are independent test files and can run together
- Within US1: T008, T009, T010 are three different test files and can run together
- Within US3: T019, T020, T021 are three different test files and can run together
- T025 (docs) is independent of T026–T028 and can run any time after the stories land

---

## Parallel Example: User Story 1

```bash
# After T007 (page object), launch the three test files together:
Task: "Add failing action tests in src/themes/platformer/editor/editorActions.test.ts"
Task: "Add failing toolbar tests in src/themes/platformer/editor/EditorToolbar.test.tsx"
Task: "Add failing page tests in src/themes/platformer/editor/LevelEditorPage.test.tsx"
```

## Parallel Example: User Story 3

```bash
# Launch the pure-module and canvas test files together:
Task: "Create failing unit tests in src/themes/platformer/editor/caveLightingPreview.test.ts"
Task: "Add failing canvas tests in src/themes/platformer/editor/EditorCanvas.test.tsx"
Task: "Add a failing export/save parity page test in src/themes/platformer/editor/LevelEditorPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: toggle, persistence, and attribute lifecycle work independently
5. Demo the toggle if ready

### Incremental Delivery

1. Setup + Foundational → appearance state exists and persists
2. Add US1 → toggle + persistence (MVP)
3. Add US2 → full dark chrome + dark canvas backdrop, theme-independent
4. Add US3 → live, view-only cave-lighting preview
5. Each story adds value without weakening the previous one (FR-015)

---

## Notes

- [P] tasks touch different files with no incomplete dependencies
- Tests are mandatory (constitution Principle II, FR-015) and use the `{method}-{condition}-{expectedResult}` naming convention
- Never weaken or delete an existing assertion to make dark mode pass (FR-015)
- No new runtime dependency, no new in-game lighting constant (only the preview-only `EDITOR_PREVIEW_DARKNESS`), and no shadcn component edits (research D13, FR-016)
- `engine/Lighting.ts` and `engine/Renderer.ts` are reused unchanged — the preview composes their existing pure functions and draw passes
- The preview only reads `grid`/`backgroundPlacements`, so exports and saves are byte-identical with dark mode on or off (FR-010, SC-005)
