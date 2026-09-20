# Phase 0 Research: Editor Dark Mode

Every NEEDS CLARIFICATION from the plan's Technical Context is resolved below.
The spec's own Assumptions already settled the behavioural questions (scope,
default, probe, preview scope, static preview); these decisions cover the
remaining implementation choices.

## D1 — How the editor owns its palette independently of the site-wide theme

**Decision**: Pin the editor's palette with a `data-editor-appearance="light" |
"dark"` attribute set on the document element (`<html>`) while the editor page is
mounted, and define the shadcn token overrides for both appearances in a new
`src/styles/themes/editor.css` imported after the per-theme files.

- `EditorWorkspace` sets/removes `document.documentElement.dataset.editorAppearance`
  in an effect keyed on the appearance signal, cleaning up on unmount.
- `editor.css` defines `[data-editor-appearance='light']` and
  `[data-editor-appearance='dark']` blocks covering the tokens the editor
  actually consumes (`--background`, `--foreground`, `--card`,
  `--popover`, `--muted`, `--border`, `--input`, `--ring`, `--primary`,
  `--secondary`, `--accent`, `--destructive` and their `-foreground` pairs)
  plus a dedicated `--editor-canvas-backdrop`.
- Because both selectors target the same element as `[data-theme='…']` and
  `editor.css` is imported last, the editor blocks win the cascade regardless of
  the visitor's site theme (FR-004, SC-007).

**Rationale**: shadcn `Dialog`, `Select` and `Tooltip` content is rendered
through a portal at `document.body`, outside the editor's DOM subtree. A
wrapper-scoped class would not reach those surfaces, so the save/export dialogs
and the level/blueprint selector would stay light (FR-005). An attribute on
`<html>` cascades to every portal for free. It is safe to place it globally
because `App.tsx` renders the editor as the only page on `/platformer/editor`,
and the effect removes the attribute on unmount so no other route is affected.

**Alternatives considered**:

- *A scoped wrapper class plus the same attribute on every portal root*
  (DialogContent/SelectContent/TooltipContent) — rejected: many fragile
  touch-points, and any future portaled component would silently miss the theme.
- *Repointing the global Tailwind `dark:` custom variant at the editor
  attribute* (`@custom-variant dark (&:is([data-editor-appearance='dark'] *))`)
  — rejected: `src/index.css:16` is a global definition, so it would repurpose
  the conventional `.dark` trigger app-wide for an editor-only concern. Today
  that changes nothing observable (nothing applies `.dark`), but it would
  silently break any future site-wide dark mode or OS-preference dark until that
  feature defined its own variant. See D13 for why the `dark:` utilities are
  deliberately left inert.
- *A `.dark` class on the editor root driving the existing `dark:` variants* —
  rejected: it would not reach portaled content, and because the editor must pin
  *both* appearances (FR-004) it would still need a second light trigger; see
  D13.
- *Toggling `data-theme` itself* — rejected: it would overwrite the visitor's
  site-wide selection, violating FR-004/FR-017.

## D2 — Where the appearance lives, and how an invalid stored value resolves

**Decision**: Add `editorAppearanceSignal` to `editorState.ts`:

```ts
export type EditorAppearance = 'light' | 'dark';
export const editorAppearanceSignal = createLocalStorageSignal<EditorAppearance>(
  'platformer-editor-appearance',
  'light',
  (value): value is EditorAppearance => value === 'light' || value === 'dark',
);
```

Extend `createLocalStorageSignal` in `src/lib/utils.ts` with an optional
`isValid?: (value: unknown) => boolean` predicate; a stored value that fails the
predicate (or fails to parse) falls back to the default. `toggleEditorAppearance`
/ `setEditorAppearance` live in `editorActions.ts`.

**Rationale**: FR-003 requires an absent or unreadable stored value to resolve to
light, and a plain `createLocalStorageSignal` would happily return `"blue"` or
`42` for a JSON-valid-but-wrong value. A validator on the existing helper keeps
the fix in one shared, 100%-covered `src/lib/` function and leaves every existing
caller unchanged. The signal itself remains the single source of truth (O-016
FR-016/FR-017).

**Alternatives considered**:

- *A one-off editor-local signal factory* — rejected: duplicates the
  localStorage try/catch/JSON logic that already lives in `src/lib/utils.ts`.
- *Coercing on read with a `computed`* — rejected: the invalid value would stay
  in the writable signal and be re-persisted, and the "unreadable → light" rule
  would be split across two places.

## D3 — The toggle control and where it sits in the toolbar

**Decision**: One icon button in `EditorToolbar`, rendered through the existing
`Tooltip`/`TooltipTrigger` pattern (the same wrapper the Undo/Save/Export/Try
actions use), styled with `toolbarIconClass(active)`:

- `data-testid="editor-appearance-toggle"`, `aria-pressed={isDark}`.
- Icon: `MoonIcon` when light (the action it offers), `SunIcon` when dark.
- Tooltip text names the control **and** its current state, e.g.
  `Dark mode: on` / `Dark mode: off` (FR-002).
- Placed in its own group immediately after the canvas Level/Blueprint toggle
  group and before the actions divider, grouping it with the other mode toggles
  while keeping it a single control.

**Rationale**: FR-001/FR-002 require a *single* control following the toolbar's
icon-control language, discoverable on hover and keyboard focus. The existing
`IconAction`/`ToolbarToggleGroup` patterns already provide exactly this (tooltip
+ `aria-pressed` + blue ring), so no new visual language is introduced.

**Alternatives considered**:

- *A two-option Light/Dark segmented group* — rejected: FR-001 says one control;
  a pair would also duplicate what the pressed state already communicates.
- *A `Select`/menu* — rejected: heavier than a toggle and inconsistent with the
  layer/canvas toggles.

## D4 — The dark palette's values

**Decision**: The **light** block copies the platformer theme's daylight token
values (the editor's documented light baseline). The **dark** block uses the IDE
theme's Catppuccin Mocha values, **inlined as resolved `oklch()`/hex literals** —
never `var(--color-ctp-*)`. Those variables are declared *inside*
`[data-theme='ide']` (`ide.css:1-18`), so a copied `var(--color-ctp-base)` would
resolve to nothing under any other visitor theme and the editor would lose its
palette (FR-004/SC-007). For the same reason, `--muted-foreground` is set to
Catppuccin Mocha's subtext1 (`#a6adc8`) rather than the IDE theme's
`var(--color-ctp-subtext)` — an undefined variable (`ide.css:32`). Both blocks
also define `--editor-canvas-backdrop`: daylight sky in light, a deep
desaturated navy in dark.

**Rationale**: The IDE theme already maps the complete shadcn token set to a
dark palette that is proven legible in this codebase, so reusing those values
gives the dark editor a tested contrast baseline with no new colour design. The
light block reproduces the platformer values the editor already shows under the
platformer theme, satisfying "restore the pre-feature daylight look" (FR-007).
Inlining the values makes the dark palette identical whichever `data-theme` is
active (D12/T015 assert this). The dark values live only in `editor.css`, so
they cannot leak into the game or another theme (spec Assumption).

**Alternatives considered**:

- *A bespoke editor-only dark palette* — rejected: new, untested contrast
  choices for no user-visible gain over an existing proven dark palette.
- *Referencing `[data-theme='ide']`'s variables from the dark block* — rejected:
  CSS cannot conditionally inherit another attribute selector's custom
  properties, and doing so would re-couple the editor to `data-theme`.

## D5 — The static, always-on, preview-specific darkness value

**Decision**: While the preview is active, `darknessLevel` is always
`EDITOR_PREVIEW_DARKNESS` (0.8) — a fixed **target**, not an eased value — with
no dependence on the spawn's position or the background placements. The spawn is
consulted only for
`playerLight = heldTorchLightPosition(synthesizePlayerState(grid))`, which is
`null` when the grid has no `S`. This is computed in the new pure
`editor/caveLightingPreview.ts`; the easing helper `nextDarknessLevel` is **not**
used because the editor has no game loop.

**Rationale**: FR-009 (as revised) makes dark mode always preview the cave look,
so the scene darkens the moment the author toggles it rather than only once the
spawn happens to sit inside a painted cave — the earlier spawn-probe model made
the feature appear inert on a normal level. FR-013 still requires a static
preview with no game loop, so the value is the fixed target and every draw pass
is called with `worldElapsed = 0`. The depth is deliberately lighter than the
game's `MAX_DARKNESS` (≈ 0.97): in play the camera follows the player, so their
carried light is always on screen, whereas the editor's viewport can sit away
from any light and at full darkness the level would read as a black rectangle.
`EDITOR_PREVIEW_DARKNESS` is a preview-only value and does not change the in-game
lighting (FR-016).

**Alternatives considered**:

- *Reuse `MAX_DARKNESS` verbatim* — rejected after the author tried it: the
  editor rendered near-black with no light in view. The game can afford full
  darkness because its camera never leaves the player's light.
- *Keep the spawn-probe (darkness only when the spawn's foot cell is over a
  cave-family placement)* — rejected by the author after trying it: the editor
  starts with no background placements and the shipped spawn on the surface, so
  dark mode looked broken. See the spec's "Always-dark preview (decided)"
  assumption.
- *A per-frame fade tick in the editor* — rejected: introduces a game loop into
  the editor (FR-013) and makes the preview non-deterministic to test.

## D6 — Discovering the preview's torch light sources

**Decision**: A pure `torchLightsFromGrid(grid): TorchLight[]` scans the editor's
`TileChar[][]` for cells whose `TERRAIN_CHARS[char] === 'torch'` and maps each to
its world-space centre via `tileToPixel` plus half a rendered tile — the same
conversion `PlatformerState.ts`'s `torchPositions` uses.

**Rationale**: The editor holds a `TileChar[][]`, while `findTorchTiles` expects a
`readonly string[]` layout. A typed scan mirrors the existing editor
`synthesize*` helpers (`gridRenderState.ts`) and keeps the preview module
canvas-free and unit-testable. Torches stay stateless (O-013), so no new state
is introduced.

**Alternatives considered**:

- *Joining the grid into strings and calling `findTorchTiles`* — rejected: a
  pointless round-trip that also re-parses terrain the editor already has typed.
- *Reusing `PlatformerState.torchPositions`* — rejected: it is derived from
  `currentLayout` (the in-memory game level), not the editor's live grid, so it
  would not update as the author paints.

## D7 — Where the preview sits in the editor canvas draw order

**Decision**: Keep the existing draw sequence and insert the preview between the
world content and the editor affordances:

1. Backdrop fill, grid lines, background tiles (unchanged).
2. Inside the existing foreground-alpha block: terrain → ladder ghost/bundle →
   signs → sign badges → patrol/connection markers → collectibles → hazards →
   enemies → blocks → chests → checkpoints → player, then, **when the preview is
   active**, the held torch, `drawDarkness(...)` and `drawEnemyEyes(...)`.
3. After the alpha block: re-draw the editor affordances (grid lines, sign
   badges, patrol and connection markers) at full opacity **only when the
   preview is active**, then the pending placement preview (unchanged, always
   last).

**Rationale**: FR-012 requires grid lines, sign badges, patrol/connection
markers and the pending placement to stay legible over the preview; because the
existing code draws the markers *under* the world and the grid lines *under*
everything, the darkness overlay would cover them. Re-drawing them above the
overlay only when the preview is active keeps the light appearance byte-for-byte
unchanged (FR-007, SC-004) while satisfying FR-012 in dark mode. Drawing the
preview inside the alpha block means the existing background-layer dimming
(`globalAlpha = 0.2`) composes with it automatically, so neither effect hides
the layer being painted (spec Edge Case, FR-012). The placement preview stays
last so a pending placement is never obscured.

**Alternatives considered**:

- *Restructuring the whole draw order to put affordances last always* — rejected:
  it would draw grid lines and markers over tiles in light mode too, breaking
  SC-004.
- *Drawing the preview after the alpha block* — rejected: the darkness would then
  sit at full strength over a background-layer painting session and hide the
  pieces being painted.

## D8 — The offscreen layer canvas and the static clock

**Decision**: `EditorCanvas` owns a reused `HTMLCanvasElement` ref for the
darkness layer, resized to the editor canvas each redraw and passed to
`drawDarkness`. Both `drawDarkness` and `drawHeldTorch` are called with
`worldElapsed = 0`, so the preview is drawn at rest (the torch shows its
deterministic per-cell phase frame, FR-013).

**Rationale**: `drawDarkness` needs an offscreen layer to punch `destination-out`
light holes; reusing one canvas avoids per-redraw allocation, mirroring
`PlatformerPage.tsx`'s ownership of `darknessLayerRef`. A zero clock makes the
preview deterministic (same input → same pixels) and testable, and is exactly
"the torch flame shown at rest".

**Alternatives considered**:

- *A fresh offscreen canvas per redraw* — rejected: needless allocation on every
  paint stroke.
- *An animated clock* — rejected: FR-013 forbids continuous animation.

## D9 — Keeping the preview live as the author edits

**Decision**: Thread `appearance` from `EditorWorkspace` →
`EditorCanvasPane` → `EditorCanvas`, and add it to the existing single draw
effect's dependency list alongside `grid`, `backgroundPlacements` and
`activeLayer`. The preview inputs are recomputed inside that effect from the
current `grid` and `backgroundPlacements`.

**Rationale**: FR-009 requires moving the spawn, painting cave pieces, or
placing/removing torches to update the preview without a reload. The editor
already redraws on every one of those changes through the same effect, so adding
one dependency is the whole mechanism — no new effect, no second source of
truth, and it keeps paint feedback under 200 ms (FR-018).

**Alternatives considered**:

- *A separate effect keyed only on the preview inputs* — rejected: two effects
  painting the same canvas risks order-dependent flicker and double work.
- *A `computed` preview signal* — rejected: the preview inputs are cheap to
  derive and are already read inside the draw effect; a signal would add
  indirection without a second consumer.

## D10 — Blueprint canvas and non-level surfaces

**Decision**: The cave preview is gated on `!isBlueprintMode && appearance ===
'dark'`. The blueprint canvas still receives the dark chrome and the dark
backdrop through the shared palette/attribute, but never a cave-lighting
preview. The `Try`/export/save paths are untouched.

**Rationale**: FR-011 — a blueprint has no spawn probe, so a lighting preview
would be meaningless. The dark chrome is a property of the page, not of the
canvas, so it applies in both modes. Keeping the export/save paths untouched is
what makes FR-010/FR-016 hold by construction (the preview only reads state and
draws to the canvas).

**Alternatives considered**:

- *A preview on the blueprint canvas using a default probe* — rejected by the
  spec's Assumptions and FR-011.

## D11 — Regression safety for the light appearance

**Decision**: The preview passes are the game's own draw functions, which all
return immediately when `darknessLevel <= 0` (`drawDarkness`, `drawEnemyEyes`,
`drawHeldTorch`). In the light appearance the darkness value is 0, so none of
them runs and the light frame is the pre-feature frame. The light token block
reproduces the platformer daylight values, so the editor's light look matches
the daylight baseline the feature documents.

**Rationale**: FR-007/SC-004 require the light appearance to be the exact
pre-feature look. The existing "full-brightness fast path" (O-010 D10) makes
that true by construction rather than by tuning. One deliberate, spec-decided
change is noted: the editor now owns its light baseline (the daylight palette)
rather than inheriting whatever `data-theme` the visitor chose; this is required
by FR-004/SC-007 and is called out in the spec's Assumptions.

**Alternatives considered**:

- *Drawing a zero-alpha overlay in light mode* — rejected: needless work and a
  risk of a residual tint, exactly as O-010 D10 concluded.

## D12 — Test strategy

**Decision**: TDD, with the following coverage:

- `src/lib/utils.test.ts` — the new `isValid` predicate: valid stored value kept,
  invalid stored value falls back, predicate not called for a missing key,
  existing behaviour unchanged.
- `editor/caveLightingPreview.test.ts` — pure: always `EDITOR_PREVIEW_DARKNESS`,
  with a spawn → a carried light, without one → `null`; spawn position does not
  change the darkness; torch discovery matches `tileToPixel` centres; the grid
  is not mutated.
- `EditorToolbar.test.tsx` — the control exists in both canvases, `aria-pressed`
  tracks the appearance, the tooltip names it and its state, clicking toggles
  and persists.
- `EditorCanvas.test.tsx` — with the appearance dark, `drawDarkness`/
  `drawEnemyEyes` are called with `EDITOR_PREVIEW_DARKNESS` and the torch list and
  `drawHeldTorch` at rest, whether or not any cave background exists; in light
  mode they are not; the blueprint canvas never previews.
- `LevelEditorPage.test.tsx` — reload restores the chosen appearance; the
  appearance survives changing `currentTheme`; the appearance attribute is set on
  `document.documentElement` while mounted and removed on unmount; export/save
  output is unchanged with dark mode on (SC-005).

**Rationale**: Follows [docs/TestingGuide.md](../../docs/TestingGuide.md) — pure
logic in `src/lib/` and `editor/` gets fast unit tests, user-visible behaviour
goes through the existing page object. The `Renderer` module is already mocked in
the editor suites, so the new draw calls are asserted through those mocks.

**Alternatives considered**:

- *Testing pixel output* — rejected: jsdom has no real canvas; the codebase
  asserts draw calls against mocked renderers throughout.
- *An end-to-end screenshot test* — rejected: no such infrastructure exists and
  the constitution's manual browser check covers the "looks right" half.

## D13 — Why the editor does not use Tailwind's `dark:` variant

**Decision**: The editor is themed with the same mechanism every existing theme
uses — an attribute on `<html>` selecting a CSS-variable block — and the
`@custom-variant dark` at `src/index.css:16` is left exactly as it is.

**Rationale**: The shadcn components do carry `dark:` utilities
(`button.tsx:8,14,18,20`, `select.tsx:42`), but in this app they are inert: they
key off a `.dark` class that nothing ever applies, because all four themes
switch by overriding the shadcn variables under `[data-theme='…']` instead.
Leaving them inert in the editor is therefore *consistent* with every other
theme, not a gap. The editor's dark styling comes from the
`[data-editor-appearance='dark']` token block, which drives the same semantic
utilities (`bg-background`, `bg-card`, `text-muted-foreground`) the components
already use. The only thing forgone is a few opacity accents (e.g.
`dark:bg-input/30` on outline buttons and select triggers), and even those
resolve to `color-mix(…, var(--input) 30%, transparent)` — they would follow the
editor's own `--input` anyway, so the visual difference is negligible. The
constitution also forbids editing CLI-managed shadcn components, so adding a new
`editor-dark:` variant to them is not an option.

**Alternatives considered**:

- *Define a new `editor-dark:` variant and use it in the components* — rejected:
  the components use `dark:`, not `editor-dark:`, so this would mean editing
  CLI-managed shadcn files (constitution Principle III forbids it).
- *Extend the variant to match both `.dark` and the editor attribute*
  (`&:is(.dark *, [data-editor-appearance='dark'] *)`) — rejected: it still
  couples the global variant to the editor for a negligible gain; a future site
  dark mode can extend the variant when it actually exists.

## D14 — Neutralising theme-scoped component rules in the editor

**Decision**: `editor.css` is imported after the theme files, so its
`[data-editor-appearance='…']` blocks beat `[data-theme='…']` at equal
specificity and override every shadcn token the editor consumes. The attribute
is set *in addition to* `data-theme` (which stays whatever the visitor chose),
so theme-scoped component rules still match; any that reference an overridden
token resolve through the editor's values and stay correct — e.g.
`platformer.css:63`'s
`[data-theme="platformer"] [data-slot="select-trigger"] { background-color:
var(--card); }` picks up the editor's dark `--card`.

**Rationale**: FR-004/SC-007 require the editor's palette to be independent of
the visitor's theme. Pinning the tokens on `<html>` achieves that for every
token-driven surface. The residual risk is a theme rule that sets a *hardcoded*
colour on a class the editor actually uses (e.g. `ide.css`'s
`.menu-hover`/`.tree-hover`/`.editor-font`, `space.css`'s `.star-twinkle`); the
editor's own markup does not use those helper classes today. D12's test that the
editor's palette is unchanged when `currentTheme` changes would catch a
regression here.

**Alternatives considered**:

- *Removing `data-theme` while the editor is mounted* — rejected: it would fight
  `currentTheme`'s own subscriber (`src/state/theme.ts:39`), which rewrites
  `data-theme` on every change, and any imperfect restore would leak into other
  routes.
- *Copying every theme's hardcoded helper rules into an editor reset* — rejected:
  whack-a-mole for rules the editor never matches.

## Dependencies (existing code this builds on)

- **O-016 Editor UI Rework** (implemented) — supplies the toolbar that hosts the
  toggle and the tiles-only palette the dark palette must cover.
- **O-010 Cave Lighting** (implemented) — supplies `heldTorchLightPosition`,
  `drawDarkness`, `drawEnemyEyes` and `drawHeldTorch`, reused unchanged. The
  preview does **not** reuse `MAX_DARKNESS`/`isCellDarkening` (D5); it adds its
  own preview-only `EDITOR_PREVIEW_DARKNESS`.
- **F-019 Level Editor** (implemented) — supplies `EditorCanvas`'s single redraw
  effect, `editorState`/`editorActions`, and the `levelEditorPage` page object.
- **F-012 Theme System** (implemented) — supplies `data-theme` and the token
  system the editor's own appearance layers over without depending on.
