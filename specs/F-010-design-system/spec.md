# Feature Specification: Design System

**Feature Branch**: `F-010-design-system`
**Created**: 2026-06-20
**Status**: Ready
**Input**: Design system covering typography, spacing, colors, component tokens — shared foundation for IDE, 3D Room, and Retro Terminal themes.

## Approach: Token-Only

Themes share shadcn/ui components via CSS variable overrides. Each theme redefines the same CSS custom properties (`--background`, `--primary`, `--font-sans`, `--radius`, etc.) — only the values differ. Components use Tailwind utilities that reference these variables, rendering in the active theme's style automatically.

## Token Architecture

### Shared tokens (in `src/styles/base.css`)

Tokens that all themes share (may optionally override):

| Token | Purpose | Overridable? |
|---|---|---|
| `--radius` base | Border radius scale via `@theme` inline | Yes |
| Spacing scale | Tailwind default (4px grid) | No |
| Breakpoints | Tailwind default (`sm`/`md`/`lg`/`xl`) | No |
| `--font-size-*` | Typography size scale via `@theme` inline | Yes — `[data-theme]` selector has higher specificity than `@theme inline`'s `:root` vars, so theme values win via natural CSS cascade |

### Theme-scoped tokens (per theme CSS file)

Each theme defines these under `[data-theme="<id>"]`:

| Token | Purpose |
|---|---|
| `--background` / `--foreground` | Page surface and text |
| `--card` / `--card-foreground` | Card/panel surfaces |
| `--primary` / `--primary-foreground` | Primary actions, emphasis |
| `--secondary` / `--secondary-foreground` | Secondary elements |
| `--muted` / `--muted-foreground` | Subdued elements |
| `--accent` / `--accent-foreground` | Accent/highlight |
| `--destructive` / `--destructive-foreground` | Destructive actions |
| `--border` / `--input` / `--ring` | Borders and focus rings |
| `--font-sans` / `--font-heading` | Typography families |
| `--sidebar-*` | IDE-specific sidebar tokens (used by F-014) |
| `--chart-*` | Chart/data-vis colors |

Themes may also define custom tokens for effects (e.g., `--scanline-opacity`, `--glow-color`, `--perspective-depth`).

## Theme Switching Mechanism

State management uses `@preact/signals-react` (already the project standard, documented in Architecture.md). The localStorage-persisted signal pattern via `createLocalStorageSignal` (from `@/lib/utils.ts`) is used for persisting theme selection.

The `currentTheme` signal (in `src/state/theme.ts`) controls theme application:

```ts
// Sync signal to DOM
document.documentElement.dataset.theme = currentTheme.value
// → <html data-theme="terminal">
```

- **CSS scoping**: Each theme's variables are nested under `[data-theme="<id>"]` in CSS
- **Instant switching**: All theme CSS is bundled at build-time — no network requests

```css
[data-theme="terminal"] {
  --background: oklch(0.1 0.02 130);
  --foreground: oklch(0.8 0.15 130);
  --font-sans: 'Fira Code', monospace;
}
```

- Persistence via `createLocalStorageSignal`
- Default theme: `"ide"` (or fallback to `:root`)

## Component Strategy

### Shared shadcn/ui components

- All shadcn components added once via CLI to `src/components/ui/`
- Imported and used by all themes without modification
- Tailwind utility classes → CSS variables → theme-specific visual

### Optional theme-specific wrappers

If a theme needs extra behavior (animation, effects), it wraps the shared component:

```tsx
// src/themes/terminal/components/TerminalButton.tsx
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const TerminalButton = ({ className, ...props }: ButtonProps) => (
  <Button className={cn("animate-scanline-glow", className)} {...props} />
)
```

Themes that don't need customization import from `@/components/ui/` directly.

## Typography

### Shared scale (in `base.css`)

```css
@theme inline {
  --font-size-display: 3.5rem;
  --font-size-h1: 2.5rem;
  --font-size-h2: 2rem;
  --font-size-h3: 1.5rem;
  --font-size-body: 1rem;
  --font-size-small: 0.875rem;
}
```

### Theme-specific fonts

Each theme overrides `--font-sans` and `--font-heading`:

| Theme | Font |
|---|---|
| IDE | `--font-sans`: Geist Variable (current default) |
| 3D Room | Inter |
| Terminal | `--font-sans`: Fira Code, `--font-heading`: VT323 |

## File Organization

```
src/
├── index.css                    # @import "tailwindcss"
│                                # @import "./styles/base.css"
│                                # @import "./styles/themes/ide.css"
│                                # @import "./styles/themes/space.css"
│                                # @import "./styles/themes/terminal.css"
├── styles/
│   ├── base.css                 # Shared: @theme inline (spacing, radius, font-size)
│   └── themes/
│       ├── ide.css              # [data-theme="ide"] variables
│       ├── space.css            # [data-theme="space"] variables + 3D effects
│       └── terminal.css         # [data-theme="terminal"] variables + scanlines/CRT
├── components/
│   ├── ui/                      # shadcn components (CLI-managed, shared)
│   └── ThemeSwitcher.tsx        # Theme selector UI
├── themes/
│   ├── ide/                     # IDE layout + IDE-specific components
│   ├── space/                   # 3D Room layout + space-specific components
│   └── terminal/                # Terminal layout + terminal-specific components
├── state/
│   └── theme.ts                 # currentTheme signal + data-theme sync
└── App.tsx                      # Renders active theme layout
```

## Theme-Specific Visual Effects

### IDE theme
- File tree sidebar, tab bar, editor pane, status bar
- Syntax-highlighted code display
- Layout components in `src/themes/ide/`
- Uses shared shadcn tokens for panels, borders, fonts

### 3D Room theme (`space`)
- Floating panels with CSS transforms and perspective
- Parallax depth on scroll (via scroll event handlers)
- Custom tokens: `--perspective-depth`, `--float-duration`
- Effects in `space.css` + scroll JS in layout component

### Retro Terminal theme
- CRT monitor effect: scanlines (CSS pseudo-element + animation)
- Green phosphor color palette
- Custom tokens: `--scanline-opacity`, `--glow-color`, `--crt-curve`
- Effects in `terminal.css`

## User Scenarios & Testing

### User Story 1 - Themes Share Components (Priority: P1)

A developer adds a shadcn Button component and expects it to render with each theme's distinct styling without any per-theme code.

**Acceptance Scenarios**:
1. **Given** the Button component is added to `src/components/ui/`, **When** the active theme is IDE, **Then** the Button renders with IDE theme colors and fonts.
2. **Given** the same Button component, **When** the active theme switches to Terminal, **Then** the Button renders with Terminal theme colors and monospace font.
3. **Given** the same Button component, **When** the active theme switches to 3D Room, **Then** the Button renders with 3D Room theme colors.

### User Story 2 - Theme Switching (Priority: P1)

A user selects a different theme from a theme switcher and expects the entire page to update instantly.

**Acceptance Scenarios**:
1. **Given** a theme switcher UI, **When** the user selects "Retro Terminal", **Then** `document.documentElement` has `data-theme="terminal"`, all CSS variable-driven styles update, and no full page reload occurs.
2. **Given** the user selects a theme, **When** they close and reopen the browser, **Then** the previously selected theme persists.

### User Story 3 - Theme-Specific Effects (Priority: P2)

Theme-specific visual effects are established per theme (scanlines for Terminal, parallax/3D transforms for Space, IDE components in F-014).

**Acceptance Scenarios**:
1. **Given** the Terminal theme is active, **When** rendering any content, **Then** scanline overlay and CRT glow effect are visible.
2. **Given** the 3D Room theme is active, **When** scrolling the page, **Then** elements have parallax depth movement.

### Edge Cases

- ✅ What happens when a theme is selected but its CSS variables are not defined? → **Resolved**: Each theme file is loaded at build time; all themes define the same set of variables. If a variable is missing, the `:root` (fallback) value is used.
- ✅ Flash of Unstyled Content (FOUC) before JS hydrates? → **Resolved**: A blocking `<script>` in `index.html` `<head>` reads `localStorage` and sets `document.documentElement.dataset.theme` before first paint.
- ✅ Rapid theme switching in quick succession? → **Resolved**: CSS variable swapping is synchronous and immediate. No debounce needed.
- ✅ What if `localStorage` is full, disabled, or throws? → **Resolved**: `createLocalStorageSignal` wraps the `localStorage` call in try/catch and silently falls back to the default value.
- ✅ What if a stored theme ID is invalid or refers to a removed theme? → **Resolved**: `currentTheme` signal validates the stored value against the known themes list; if not found, falls back to the default theme ID.

## Requirements

### Functional Requirements

- **FR-001**: System MUST define a shared set of CSS custom properties for colors, fonts, spacing, and border radius that all themes use.
- **FR-002**: System MUST scope each theme's variable overrides under a `[data-theme="<id>"]` CSS selector.
- **FR-003**: System MUST apply the active theme by setting `data-theme` attribute on `<html>` element.
- **FR-004**: System MUST bundle all theme CSS at build time for instant switching without network requests.
- **FR-005**: System MUST persist the user's theme selection to `localStorage` via `createLocalStorageSignal`.
- **FR-006**: System MUST provide a shared shadcn/ui component library in `src/components/ui/` usable by all themes without modification.
- **FR-007**: System MUST allow each theme to optionally wrap shared components with theme-specific behavior using a wrapper pattern.
- **FR-008**: System MUST define a shared typography scale (`--font-size-display`, `--font-size-h1`, etc.) that themes can override.
- **FR-011**: System MUST implement `createLocalStorageSignal<T>(key: string, defaultValue: T): Signal<T>` in `src/lib/utils.ts` that creates a Preact Signal synced to `localStorage`.
- **FR-012**: System MUST prevent FOUC by including a blocking `<script>` in `index.html` `<head>` that reads `localStorage.getItem('theme')` and sets `document.documentElement.dataset.theme` before first paint.
- **FR-013**: System MUST define the `currentTheme` signal and theme type in `src/state/theme.ts` with the following contract:

```ts
type ThemeId = 'ide' | 'space' | 'terminal'

interface Theme {
  id: ThemeId
  label: string        // Display name (e.g., "IDE", "3D Room")
}

const themes: Theme[]  // All available themes
const currentTheme: Signal<ThemeId>  // Persisted to localStorage
```

### Key Entities

- **Theme Token**: A CSS custom property whose value is overridden per theme (e.g., `--primary`, `--font-sans`).
- **Theme CSS File**: A stylesheet scoped to `[data-theme="<id>"]` that defines variable overrides and effect CSS for a single theme.
- **Theme Wrapper**: An optional component that imports a shared shadcn component and adds theme-specific class names or behavior.

## Success Criteria

- **SC-001**: A shared Button component renders with distinct, correct styling in all three themes without any per-theme code.
- **SC-002**: Theme switching completes in under 16ms (within one frame) — measured via `performance.now()` around `data-theme` attribute change.
- **SC-003**: Total CSS bundle size for all three themes' CSS variable definitions is under 5 KB gzipped.
- **SC-004**: Adding a new theme requires only: a new CSS file in `src/styles/themes/`, registering it in `src/state/theme.ts`, and optionally theme-specific components.

## Assumptions

- Three themes exist: IDE, 3D Room ("space"), Retro Terminal ("terminal").
- shadcn/ui components are the shared component foundation — no alternative base component library.
- Theme-specific layout structures (file tree UI for IDE, typed commands for Terminal, floating panels for 3D Room) are complex enough to warrant their own component trees and will be implemented in their respective features (F-014, S-006, S-005).
- The active theme is persisted to localStorage and restored on page load.
- State management uses `@preact/signals-react` (project standard, per Architecture.md).
- `createLocalStorageSignal` is built as part of F-010 (FR-011) and will be available in `src/lib/utils.ts`.
- New themes can be added later without modifying existing components.
