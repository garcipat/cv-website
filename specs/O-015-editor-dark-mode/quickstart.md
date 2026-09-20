# Quickstart: Editor Dark Mode

Manual verification after implementation. Run `npm run dev`, open
`/platformer/editor`, and use the editor toolbar. Only **Save** is a dev-only
affordance; everything else works on the built site too.

## Prerequisites

- `npm install`
- `npm test` (all existing + new tests green)
- `npm run dev`

## 1. The toggle and its persistence (User Story 1)

1. Open the editor in its default light appearance.
2. **Expect**: a single dark-mode icon control in the toolbar (moon icon),
   `aria-pressed="false"`; hovering or keyboard-focusing it shows
   `Dark mode: off`.
3. Activate the control.
4. **Expect**: the whole editor switches to dark; the control shows a sun icon
   with `aria-pressed="true"` and its tooltip reads `Dark mode: on`.
5. Reload the page.
6. **Expect**: the editor is still dark.
7. Activate the control again, then reload.
8. **Expect**: the editor is light again, and stays light after the reload.
9. Clear `localStorage` (or use a fresh profile) and open the editor.
10. **Expect**: it opens light by default. Set
    `localStorage['platformer-editor-appearance'] = '"blue"'` and reload.
11. **Expect**: it still opens light (invalid value resolves to light).
12. Rapidly toggle the control a dozen times, then reload.
13. **Expect**: no flicker, and the editor matches the last chosen appearance.

## 2. Dark everywhere and still readable (User Story 2)

1. Turn dark mode on and inspect the editor page and header.
2. **Expect**: both are dark with legible text.
3. Inspect the toolbar and the tile palette.
4. **Expect**: panels, tile swatches, labels, selected (blue-ringed) and hover
   states are all legible against the dark surfaces.
5. Open the save dialog (dev server), the export dialog, and the level/blueprint
   selector.
6. **Expect**: each renders dark with legible text and controls — no bright
   island, including the portaled dialog/select/tooltip surfaces.
7. Watch the save-status text after a successful save.
8. **Expect**: legible against the dark toolbar.
9. Inspect the canvas backdrop.
10. **Expect**: dark rather than the daylight sky, with grid lines and tile art
    still readable against it.
11. Set the site-wide theme to each of Space, Terminal, and Platformer in turn,
    then return to the editor.
12. **Expect**: the editor's dark appearance is unchanged (it is editor-owned) —
    every surface fully dark, with no unresolved/blank token. This catches a
    `var(--color-ctp-*)` leak, which would only resolve under the IDE theme.
13. Switch back to the light appearance.
14. **Expect**: the exact pre-feature platformer-daylight look — light chrome,
    daylight canvas backdrop, no darkness.
15. Spot-check contrast: label/body text against its surface meets WCAG AA
    (≥ 4.5:1), and button/control boundaries ≥ 3:1.

## 3. The cave-lighting preview (User Story 3)

1. With any level open, add one or more wall torches and place the spawn (`S`).
2. Turn dark mode on.
3. **Expect**: the whole canvas is darkened and every torch shows a warm, soft
   light pool punching through the gloom; the spawn's small carried glow is
   visible.
4. Place a living enemy (green or purple slime) in a dark area away from a
   torch.
5. **Expect**: the enemy is marked by a small pair of glowing yellow eyes.
6. Remove the spawn marker.
7. **Expect**: the canvas is still fully dark and the torches still light their
   pools — only the player's carried glow is gone.
8. While dark, place/remove a torch and move the spawn.
9. **Expect**: the preview updates live without a reload.
10. Switch the canvas to Blueprint.
11. **Expect**: dark chrome and dark backdrop, but **no** cave-lighting preview.
12. With dark mode on, paint a background piece while the Background layer is
    active.
13. **Expect**: the darkness is dimmed along with the foreground, so the piece
    being painted stays visible; grid lines, sign badges, patrol and
    connection-point markers, and a pending placement preview all stay legible.
14. Drag-paint a stroke with dark mode on.
15. **Expect**: per-cell feedback stays under 200 ms with no dropped cell.
16. Export the layout and save the level with dark mode on, then repeat with it
    off.
17. **Expect**: the exported text and the saved file are identical (SC-005).

## 4. Built site, no dev server (FR-014)

1. Run `npm run build && npm run preview` and open the editor from the preview
   URL.
2. **Expect**: the toggle, its persistence, the dark chrome, and the cave
   preview all work exactly as in development — the feature is purely
   client-side. Only the **Save** affordance is dev-only.

## Automated coverage expected

| Area | Test file | What it proves |
| --- | --- | --- |
| Storage validator | `src/lib/utils.test.ts` | valid value kept; invalid/absent → default; existing callers unchanged |
| Preview inputs | `editor/caveLightingPreview.test.ts` | always `EDITOR_PREVIEW_DARKNESS` (0.8), spawn → carried light, no spawn → null, spawn position irrelevant, torch discovery, grid not mutated |
| Toggle control | `editor/EditorToolbar.test.tsx` | present in both canvases, `aria-pressed`, tooltip name + state, click toggles/persists |
| Preview rendering | `editor/EditorCanvas.test.tsx` | dark ⇒ darkness/eyes/held-torch calls (with or without cave background); light or blueprint ⇒ none; dark backdrop token |
| Page behaviour | `editor/LevelEditorPage.test.tsx` | reload restores the appearance; theme changes do not; attribute set/removed; export/save unchanged with dark on |
