# Platformer Step 1: Theme Skeleton + Floating Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register a new `platformer` theme that renders a full-viewport, resizing `<canvas>` element with floating theme/locale controls on top, so the theme is reachable, escapable, and visually verifiable in the browser — with no game logic yet.

**Architecture:** Follow the existing theme-registration pattern used by `ide`/`space`/`terminal`: add `'platformer'` to the `ThemeId` union and `themes[]` list in `src/state/theme.ts`, give it its own CSS token file under `src/styles/themes/`, add a `PlatformerPage` component registered in `App.tsx`'s `themePages` map, and reuse the existing `ThemeSelect`/`LanguageSelect` primitives inside a theme-local `FloatingControls` component (same composition as the Space theme's).

**Tech Stack:** React 19, TypeScript strict, Preact Signals (`@preact/signals-react`), Tailwind CSS 4 (CSS custom properties per theme), Vitest + React Testing Library + jsdom.

**Spec:** [specs/S-006-platformer-theme/spec.md](../../../specs/S-006-platformer-theme/spec.md) (FR-001, FR-004, FR-025), roadmap step 1 in [specs/S-006-platformer-theme/roadmap.md](../../../specs/S-006-platformer-theme/roadmap.md)

## Global Constraints

- TypeScript strict mode, no `any` types, no `@ts-ignore` (constitution Principle I / spec SC-007).
- Named arrow function exports, props interfaces in the same file, `cn()` from `@/lib/utils` for conditional classes, named exports only (constitution Principle III).
- shadcn/ui components are CLI-managed only — this plan reuses existing `Select` primitives, it does not add new ones.
- Tests use Vitest + React Testing Library + jsdom; test names follow `{method}-{Condition}-{ExpectedResult}` where practical (constitution Principle II).
- No backend, no API calls, no new dependencies.
- Floating controls render top-right (per spec FR-025's HUD layout — hearts top-left, controls top-right — overriding the inconsistent "top-left" wording in User Story 8).

---

### Task 1: Register `platformer` as a valid `ThemeId`

**Files:**
- Modify: `src/state/theme.ts`
- Modify: `src/components/ThemeSelect.tsx:12`
- Modify: `src/themes/terminal/terminal-commands.ts:47`
- Modify: `src/i18n/locales/en.json` (`themes` block, `terminal.errors.invalidTheme`)
- Modify: `src/i18n/locales/de.json` (`themes` block, `terminal.errors.invalidTheme`)
- Test: `src/state/theme.test.ts`
- Test: `src/themes/terminal/terminal-commands.test.ts`

**Interfaces:**
- Produces: `ThemeId` now includes `'platformer'`; `themes: Theme[]` (from `src/state/theme.ts`) includes `{ id: 'platformer', label: 'Platformer' }`. All later tasks import `ThemeId`/`currentTheme` from `src/state/theme.ts` unchanged otherwise.

- [ ] **Step 1: Write the failing test for `theme.ts`**

Append to `src/state/theme.test.ts` (below the existing `describe` block — do not touch the existing tests, they're a separate self-contained contract check):

```ts
import { themes, type ThemeId } from './theme';

describe('platformer theme registration', () => {
  it('themes array includes platformer with a non-empty label', () => {
    const platformer = themes.find((t) => t.id === 'platformer');
    expect(platformer).toBeDefined();
    expect(platformer?.label).toBeTruthy();
  });

  it('ThemeId type accepts "platformer"', () => {
    const id: ThemeId = 'platformer';
    expect(id).toBe('platformer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/state/theme.test.ts`
Expected: FAIL — `platformer` is not found in `themes` (and/or a TypeScript error on the `ThemeId` assignment).

- [ ] **Step 3: Update `src/state/theme.ts`**

```ts
export type ThemeId = 'ide' | 'space' | 'terminal' | 'platformer';
```

```ts
export const themes: Theme[] = [
  { id: 'ide', label: 'IDE' },
  { id: 'space', label: 'Space' },
  { id: 'terminal', label: 'Retro Terminal' },
  { id: 'platformer', label: 'Platformer' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/state/theme.test.ts`
Expected: PASS

- [ ] **Step 5: Update `ThemeSelect.tsx` theme list**

In `src/components/ThemeSelect.tsx:12`, change:

```ts
const themeIds: ThemeId[] = ['ide', 'space', 'terminal'];
```

to:

```ts
const themeIds: ThemeId[] = ['ide', 'space', 'terminal', 'platformer'];
```

- [ ] **Step 6: Write the failing test for the terminal `:theme platformer` command**

Add to `src/themes/terminal/terminal-commands.test.ts`, near the existing `:theme` command tests (around the `executeCommand-theme-terminal-returns-theme-terminal` test):

```ts
it('executeCommand-theme-platformer-returns-theme-platformer', () => {
  const input = ':theme platformer';
  const result = executeCommand(input, mockContext); // use the same mockContext the surrounding tests use
  expect(result).toEqual({ type: 'theme', themeId: 'platformer' });
});
```

Check the existing `:theme terminal`/`:theme space` tests just above for the exact `mockContext`/helper argument shape used in this file and match it — don't invent a new signature.

- [ ] **Step 7: Run test to verify it fails**

Run: `npm run test -- src/themes/terminal/terminal-commands.test.ts`
Expected: FAIL — `:theme platformer` is rejected as an invalid theme.

- [ ] **Step 8: Update `VALID_THEMES` in `terminal-commands.ts`**

In `src/themes/terminal/terminal-commands.ts:47`, change:

```ts
export const VALID_THEMES: ThemeId[] = ['ide', 'space', 'terminal'];
```

to:

```ts
export const VALID_THEMES: ThemeId[] = ['ide', 'space', 'terminal', 'platformer'];
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test -- src/themes/terminal/terminal-commands.test.ts`
Expected: PASS

- [ ] **Step 10: Add the `platformer` translation key and update the error message (en)**

In `src/i18n/locales/en.json`, in the `themes` block (around line 14-19):

```json
"themes": {
  "ide": "IDE",
  "space": "Space",
  "terminal": "Retro Terminal",
  "platformer": "Platformer",
  "select": "Select theme"
},
```

In the same file, update `terminal.errors.invalidTheme` (around line 78):

```json
"invalidTheme": "Invalid theme '{theme}'. Valid themes: ide, space, terminal, platformer.",
```

- [ ] **Step 11: Add the `platformer` translation key and update the error message (de)**

In `src/i18n/locales/de.json`, in the `themes` block (around line 14-19):

```json
"themes": {
  "ide": "IDE",
  "space": "Space",
  "terminal": "Retro Terminal",
  "platformer": "Platformer",
  "select": "Design auswählen"
},
```

Update the matching `terminal.errors.invalidTheme` entry in `de.json` the same way, in German, listing all four theme ids.

- [ ] **Step 12: Run the full test suite and typecheck**

Run: `npm run test -- src/state/theme.test.ts src/themes/terminal/terminal-commands.test.ts && npx tsc --noEmit`
Expected: All PASS, zero type errors (adding a JSON key changes the `Translation` type derived via `typeof enJson`, so a missing key in `de.json` would fail the build here).

- [ ] **Step 13: Commit**

```bash
git add src/state/theme.ts src/state/theme.test.ts src/components/ThemeSelect.tsx src/themes/terminal/terminal-commands.ts src/themes/terminal/terminal-commands.test.ts src/i18n/locales/en.json src/i18n/locales/de.json
git commit -m "feat(platformer): register platformer as a valid theme id"
```

---

### Task 2: Platformer theme CSS tokens

**Files:**
- Create: `src/styles/themes/platformer.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: when `document.documentElement.dataset.theme === 'platformer'`, the shadcn token set (`--background`, `--foreground`, `--card`, `--border`, etc.) resolves to platformer-specific values. Later tasks (PlatformerPage, FloatingControls) rely on these tokens resolving instead of falling through to unset/transparent values.

- [ ] **Step 1: Create the token file**

Create `src/styles/themes/platformer.css`:

```css
[data-theme="platformer"] {
  /* Background & Foreground — retro sky blue, dark navy text */
  --background: oklch(0.72 0.11 232);
  --foreground: oklch(0.22 0.03 255);

  /* Card — off-white panel, e.g. for floating controls */
  --card: oklch(0.98 0.005 232);
  --card-foreground: oklch(0.22 0.03 255);

  /* Popover */
  --popover: oklch(0.98 0.005 232);
  --popover-foreground: oklch(0.22 0.03 255);

  /* Primary — Mario-red accent for buttons/highlights */
  --primary: oklch(0.6 0.19 25);
  --primary-foreground: oklch(0.98 0 0);

  /* Secondary — grass green */
  --secondary: oklch(0.58 0.15 145);
  --secondary-foreground: oklch(0.98 0 0);

  /* Muted */
  --muted: oklch(0.85 0.04 232);
  --muted-foreground: oklch(0.4 0.03 255);

  /* Accent — coin gold */
  --accent: oklch(0.82 0.15 85);
  --accent-foreground: oklch(0.22 0.03 255);

  /* Destructive */
  --destructive: oklch(0.6 0.2 25);
  --destructive-foreground: oklch(0.98 0 0);

  /* Border, Input, Ring */
  --border: oklch(0.4 0.03 255 / 0.3);
  --input: oklch(0.4 0.03 255 / 0.4);
  --ring: oklch(0.6 0.19 25);
}
```

- [ ] **Step 2: Import the new theme CSS file**

In `src/index.css`, add the import next to the other theme imports:

```css
@import './styles/themes/ide.css';
@import './styles/themes/space.css';
@import './styles/themes/terminal.css';
@import './styles/themes/platformer.css';
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/themes/platformer.css src/index.css
git commit -m "feat(platformer): add platformer theme CSS tokens"
```

(No unit test for this step — CSS custom properties aren't exercised by jsdom's layout engine. It's verified visually in Task 5's manual browser check, alongside the canvas and floating controls.)

---

### Task 3: `PlatformerPage` with a full-viewport, resizing canvas

**Files:**
- Create: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: nothing new (no props).
- Produces: `export const PlatformerPage: () => JSX.Element` rendering a `<canvas data-testid="platformer-canvas">` whose `width`/`height` attributes track `window.innerWidth`/`window.innerHeight`, filled with the theme's `--background` color via the 2D context (guarded — if `getContext('2d')` returns `null`, as it does in jsdom by default, drawing is skipped without throwing). Task 4 renders `FloatingControls` as a sibling inside this component's returned tree.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/PlatformerPage.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformerPage } from './PlatformerPage';

describe('PlatformerPage', () => {
  it('render-default-showsFullViewportCanvas', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

    render(<PlatformerPage />);

    const canvas = screen.getByTestId('platformer-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('width', '1024');
    expect(canvas).toHaveAttribute('height', '768');
  });

  it('windowResize-afterMount-updatesCanvasDimensions', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

    render(<PlatformerPage />);

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 600 });
    fireEvent(window, new Event('resize'));

    const canvas = screen.getByTestId('platformer-canvas');
    expect(canvas).toHaveAttribute('width', '800');
    expect(canvas).toHaveAttribute('height', '600');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — `./PlatformerPage` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `src/themes/platformer/PlatformerPage.tsx`:

```tsx
import { useEffect, useRef } from 'react';

export const PlatformerPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim();
      ctx.fillStyle = backgroundColor || '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" />
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): add PlatformerPage with full-viewport resizing canvas"
```

---

### Task 4: Platformer `FloatingControls` (theme + locale, top-right, over the canvas)

**Files:**
- Create: `src/themes/platformer/components/FloatingControls.tsx`
- Test: `src/themes/platformer/components/FloatingControls.test.tsx`
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `ThemeSelect` (`@/components/ThemeSelect`), `LanguageSelect` (`@/components/LanguageSelect`) — existing, unchanged.
- Produces: `export const FloatingControls: () => JSX.Element`, rendered inside `PlatformerPage`. No props, no state of its own (all state lives in the `currentTheme`/`currentLocale` signals it wraps).

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/components/FloatingControls.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { FloatingControls } from './FloatingControls';

describe('FloatingControls', () => {
  it('render-default-showsThemeAndLanguageSelectors', () => {
    render(<FloatingControls />);
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/themes/platformer/components/FloatingControls.test.tsx`
Expected: FAIL — `./FloatingControls` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `src/themes/platformer/components/FloatingControls.tsx` (same composition as the Space theme's, per spec FR-030, positioned top-right per FR-025):

```tsx
import { useSignals } from '@preact/signals-react/runtime';
import { ThemeSelect } from '@/components/ThemeSelect';
import { LanguageSelect } from '@/components/LanguageSelect';
import { cn } from '@/lib/utils';

export const FloatingControls = () => {
  useSignals();

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50',
        'flex items-center gap-2',
        'bg-[var(--card)]/70 backdrop-blur-md',
        'border border-[var(--border)]',
        'rounded-lg px-3 py-2',
        'shadow-lg shadow-black/20',
      )}
    >
      <ThemeSelect />
      <LanguageSelect />
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/themes/platformer/components/FloatingControls.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire `FloatingControls` into `PlatformerPage`**

In `src/themes/platformer/PlatformerPage.tsx`, add the import and render it as a sibling of the canvas:

```tsx
import { FloatingControls } from './components/FloatingControls';
```

```tsx
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" />
      <FloatingControls />
    </div>
  );
```

- [ ] **Step 6: Extend `PlatformerPage.test.tsx` to cover the wiring**

Add to `src/themes/platformer/PlatformerPage.test.tsx`:

```tsx
it('render-default-showsFloatingControlsOverCanvas', () => {
  render(<PlatformerPage />);
  expect(screen.getAllByRole('combobox')).toHaveLength(2);
});
```

- [ ] **Step 7: Run both test files to verify everything passes**

Run: `npm run test -- src/themes/platformer/components/FloatingControls.test.tsx src/themes/platformer/PlatformerPage.test.tsx`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer/components/FloatingControls.tsx src/themes/platformer/components/FloatingControls.test.tsx src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): add floating theme/locale controls over the canvas"
```

---

### Task 5: Register `PlatformerPage` in `App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `PlatformerPage` from `src/themes/platformer/PlatformerPage.tsx` (Task 3/4).
- Produces: setting `currentTheme.value = 'platformer'` renders `PlatformerPage` from `App`.

- [ ] **Step 1: Write the failing test**

Add to `src/App.test.tsx`:

```tsx
import { currentTheme } from '@/state/theme';

// ...inside the existing describe('App', ...) block, add:
it('renders the Platformer theme page when currentTheme is platformer', () => {
  currentTheme.value = 'platformer';
  render(<App />);
  expect(screen.getByTestId('platformer-canvas')).toBeInTheDocument();
  currentTheme.value = 'ide';
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/App.test.tsx`
Expected: FAIL — `App` doesn't know about the `'platformer'` theme id yet (falls back to rendering `IdePage`).

- [ ] **Step 3: Register the theme in `App.tsx`**

In `src/App.tsx`:

```tsx
import { PlatformerPage } from '@/themes/platformer/PlatformerPage';
```

```tsx
const themePages = {
  ide: IdePage,
  space: SpacePage,
  terminal: TerminalPage,
  platformer: PlatformerPage,
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm run test && npx tsc --noEmit`
Expected: All PASS, zero type errors, zero `any`.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(platformer): register PlatformerPage in the theme switcher"
```

- [ ] **Step 7: Manual browser verification**

Run: `npm run dev`

In the browser:
1. Switch the theme selector to "Platformer" (from any existing theme's controls, e.g. IDE's sidebar).
2. Confirm a full-viewport canvas renders, filled with the sky-blue background color (not black/transparent).
3. Confirm the floating theme/locale controls are visible top-right, over the canvas.
4. Resize the browser window — confirm the canvas fill resizes with it (no black bars/blank strips).
5. Use the floating controls to switch to another theme (e.g. Space) — confirm it navigates away correctly.
6. Switch back to Platformer — confirm the canvas and controls render again.
7. Use the language toggle while on the Platformer theme — confirm it doesn't error (content beyond the controls themselves is out of scope for this step).

If all checks pass, check off roadmap step 1 in `specs/S-006-platformer-theme/roadmap.md`.

---

## Self-Review Notes

- **Spec coverage**: FR-001 (canvas, viewport-adapting) → Task 3. FR-004 (theme registered via `themePages`/`currentTheme`) → Task 1 + Task 5. FR-025 (controls top-right) → Task 4. SC-007 (zero TS errors, no `any`) → checked in Tasks 1 and 5. Game loop (FR-002/FR-003), physics, sprites, level data, journal — explicitly out of scope for step 1 per the roadmap; covered by later steps.
- **Placeholder scan**: no TBD/TODO; every step has concrete code or an exact command.
- **Type consistency**: `ThemeId` (Task 1) is the single source of truth consumed by `ThemeSelect`, `terminal-commands.ts`, `App.tsx`, and `theme.test.ts` — no divergent type names introduced. `PlatformerPage` and `FloatingControls` both use named exports per constitution Principle III.
- **Scope check**: this plan covers only roadmap step 1. It does not touch game loop, physics, level rendering, or journal — those get their own plans per the roadmap's working agreement.
