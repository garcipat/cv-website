# Contract: Editor appearance (state, actions, palette, toolbar control)

The editor's light/dark appearance is **editor-owned** state. This contract
covers the persisted value, the actions that mutate it, the DOM attribute and
CSS token surface that project it, and the toolbar control that exposes it.
Nothing here depends on `data-theme` or on the site-wide `currentTheme` signal
(FR-004, FR-017, SC-007).

## Type and signal (`editor/editorState.ts`)

```ts
export type EditorAppearance = 'light' | 'dark';

/**
 * The editor's own light/dark look, persisted under its own key. Defaults to
 * 'light'; an absent or invalid stored value also resolves to 'light' (FR-003).
 */
export const editorAppearanceSignal: Signal<EditorAppearance>;
```

- Storage key: `platformer-editor-appearance` (FR-003). Distinct from every
  existing editor key; no migration.
- Persisted through `createLocalStorageSignal<EditorAppearance>(key, 'light',
  isEditorAppearance)`, where `isEditorAppearance` accepts only the two literals.
- `src/lib/utils.ts` gains an optional third parameter:

  ```ts
  export function createLocalStorageSignal<T>(
    key: string,
    defaultValue: T,
    isValid?: (value: unknown) => boolean,
  ): Signal<T>;
  ```

  When `isValid` is supplied, a stored value that fails it is treated exactly
  like a missing/unparseable value and the default is used. Omitting `isValid`
  preserves the current behaviour for every existing caller.

## Actions (`editor/editorActions.ts`)

```ts
export const setEditorAppearance = (appearance: EditorAppearance): void;
export const toggleEditorAppearance = (): void;
```

- `setEditorAppearance` writes the signal (persisting immediately).
- `toggleEditorAppearance` flips `'light'` ⇄ `'dark'`; repeated toggling must
  never leave the signal and the stored value out of step (FR-003, spec Edge
  Case "Rapid toggling").
- No other module writes `editorAppearanceSignal.value` directly (O-016
  FR-016/FR-017).

## DOM attribute and palette (`EditorWorkspace.tsx`, `styles/themes/editor.css`)

- While mounted, `EditorWorkspace` sets
  `document.documentElement.dataset.editorAppearance = editorAppearanceSignal.value`
  and removes the attribute on unmount.
- `editor.css` is imported from `src/index.css` **after** the per-theme files and
  defines:

  ```css
  [data-editor-appearance='light'] {
    /* platformer daylight token values + --editor-canvas-backdrop: daylight sky */
  }
  [data-editor-appearance='dark'] {
    /* Catppuccin Mocha values INLINED as oklch()/hex literals — never
       var(--color-ctp-*), which are scoped to [data-theme='ide'] (FR-004/SC-007).
       --muted-foreground uses subtext1 (#a6adc8), not the IDE theme's undefined
       var(--color-ctp-subtext). + --editor-canvas-backdrop: deep navy */
  }
  ```

- Tokens overridden: `--background`, `--foreground`, `--card`,
  `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`,
  `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`,
  `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`,
  `--destructive-foreground`, `--border`, `--input`, `--ring`, and
  `--editor-canvas-backdrop`.
- Because the attribute is on `<html>`, portaled `Dialog`/`Select`/`Tooltip`
  content inherits the tokens too (FR-005). Because `editor.css` loads after the
  theme files, `[data-editor-appearance='…']` beats `[data-theme='…']` at equal
  specificity (FR-004, SC-007).
- The attribute is set **in addition to** `data-theme`, and the global
  `@custom-variant dark` (`src/index.css:16`) is **not** modified: the editor
  deliberately does not use Tailwind's `dark:` utilities, which are inert for
  every theme in this app (research D13/D14). Theme-scoped component rules that
  reference an overridden token stay correct because the token block wins.
- `EditorCanvas`'s `readGameBackgroundColor()` reads `--editor-canvas-backdrop`
  (falling back to the daylight sky constant), so the canvas backdrop follows the
  appearance (FR-006).

## Toolbar control (`EditorToolbar.tsx`)

`EditorToolbar` receives `appearance: EditorAppearance` and calls
`toggleEditorAppearance` (the same state-as-props/actions pattern as every other
control).

| Property | Value |
| --- | --- |
| `data-testid` | `editor-appearance-toggle` |
| `aria-pressed` | `true` iff appearance is `'dark'` |
| Icon | `MoonIcon` when light, `SunIcon` when dark |
| Tooltip text | `Dark mode: off` / `Dark mode: on` (name **and** current state, FR-002) |
| Classes | `toolbarIconClass(active)` — the existing icon-control language |
| Placement | Its own group after the canvas toggle group, before the actions divider |
| Visibility | Both canvases (the dark chrome is a page property, not a canvas one) |

## Invariants (asserted by tests)

1. A missing, unparseable or invalid stored value initialises to `'light'`.
2. Toggling persists the new value under `platformer-editor-appearance`, and a
   remount reads it back.
3. Changing `currentTheme` (the site-wide theme) never changes
   `editorAppearanceSignal.value` nor the editor's palette (FR-004, SC-007).
4. The `data-editor-appearance` attribute is present while mounted and absent
   after unmount.
5. `aria-pressed` always equals `appearance === 'dark'`; the tooltip always names
   both the control and its state.
