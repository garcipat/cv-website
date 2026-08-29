# Controls Overlay (Roadmap Step 25) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the Platformer theme mounts, show a small translucent overlay listing
only the universal controls (movement, jump, journal toggle). It auto-dismisses the
first time the player presses a movement or jump key, or after a short timeout,
whichever comes first — and never reappears for the rest of the session.

**Architecture:** A new module-level boolean signal, `controlsOverlayDismissed`
(`PlatformerState.ts`), is the single source of truth for whether the overlay is
showing — read by a new presentational `ControlsOverlay.tsx` component (mirroring
`FloatingControls.tsx`'s `useSignals()` + fixed-position pattern) and written from two
places: a `setTimeout` inside `ControlsOverlay.tsx` itself (the timeout fallback), and
a check inside `PlatformerPage.tsx`'s existing game-loop tick, right where movement/
jump input is already read every frame (the input-driven dismissal). Text content
comes from the existing i18n system (`src/i18n/locales/en.json`/`de.json`), under a
new `platformer.controlsOverlay` key, read via `currentUI.value` exactly like
`Journal.tsx` already reads `platformer.journal.*` — no new translation machinery
needed. This deliberately does NOT list contextual controls (e.g. the bridge
drop-through) — those are step 26's hint signs' job, per spec.md's User Story 9.

**Tech Stack:** Vite + React 19 + TypeScript strict + `@preact/signals-react` +
Vitest/RTL (matches the rest of the platformer theme).

**Spec:** `specs/S-006-platformer-theme/spec.md` (FR-036, User Story 9) and
`specs/S-006-platformer-theme/roadmap.md` (step 25).

## Global Constraints

- Typed data architecture: no `any` types; TypeScript strict mode stays clean.
- TDD: every new function/component gets a failing test first, per the constitution.
- Named arrow/function exports only, no default exports.
- No new dependencies, no backend/API calls.
- Overlay lists ONLY universal controls: movement (arrows/WASD), jump (Space/Up),
  journal toggle (`J`) — no bridge drop-through or any other contextual mechanic
  (spec.md FR-036, deliberately trimmed — see User Story 9's design rationale).
- Auto-dismiss triggers on the player's first movement OR jump input, OR a timeout,
  whichever comes first — never reappears afterward this session (module-level signal,
  not reset by `resetGame()`/`resetGameProgress()`, since those run on every death/
  respawn and the overlay must not reappear after a death).
- Text is sourced from `src/i18n/locales/en.json`/`de.json` via `currentUI`, NOT a
  bespoke dictionary — re-renders in the selected locale automatically.
- Does not pause the game, does not block canvas input — purely a non-interactive
  (except perhaps a close click, out of scope here — dismissal is automatic only,
  per spec.md FR-036) informational overlay.

---

## Task 1: `controlsOverlayDismissed` signal in `PlatformerState.ts`

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Produces: `controlsOverlayDismissed: Signal<boolean>` (exported signal, initial
  value `false`), `dismissControlsOverlay(): void` (exported function, sets the
  signal to `true`) — both consumed by Task 3's `ControlsOverlay.tsx` and Task 4's
  `PlatformerPage.tsx`.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/PlatformerState.test.ts` (new `describe` block at the
end of the file, after the existing `activeJournalSection` block):

```ts
describe('controlsOverlayDismissed', () => {
  afterEach(() => {
    controlsOverlayDismissed.value = false;
  });

  it('initialValue-onModuleLoad-isFalse', () => {
    expect(controlsOverlayDismissed.value).toBe(false);
  });

  it('dismissControlsOverlay-called-setsValueToTrue', () => {
    dismissControlsOverlay();

    expect(controlsOverlayDismissed.value).toBe(true);
  });

  it('resetGame-calledAfterDismissal-doesNotUndismiss', () => {
    dismissControlsOverlay();

    resetGame();

    // A death/respawn must not bring the overlay back — it's a one-time,
    // per-session onboarding aid, not part of the reset-on-death state.
    expect(controlsOverlayDismissed.value).toBe(true);
  });
});
```

Add `controlsOverlayDismissed, dismissControlsOverlay` to the existing import from
`./PlatformerState` at the top of the test file (alongside `resetGame`, which is
already imported).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- PlatformerState.test.ts`
Expected: FAIL — `controlsOverlayDismissed`/`dismissControlsOverlay` are not exported.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerState.ts`, add near `activeJournalSection` (after
its declaration, before `spawnCenter`):

```ts
/**
 * Whether the one-time controls overlay (roadmap step 25, FR-036) has been
 * dismissed this session — either by the player's first movement/jump input
 * or a timeout (see `components/ControlsOverlay.tsx`). Deliberately NOT reset
 * by `resetGame()`/`resetGameProgress()`: both run on every death/respawn and
 * on the deliberate "Reset Game" button, and the overlay must not reappear
 * after either — it's a one-time onboarding aid, not part of the
 * reset-on-death/reset-on-request state.
 */
export const controlsOverlayDismissed = signal(false);

/** Dismisses the controls overlay for the rest of the session (see
 *  `controlsOverlayDismissed` above). Idempotent — calling it again once
 *  already `true` is a no-op in effect. */
export function dismissControlsOverlay(): void {
  controlsOverlayDismissed.value = true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- PlatformerState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add controlsOverlayDismissed session signal"
```

---

## Task 2: i18n content for the controls overlay

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/de.json`

**Interfaces:**
- Produces: `platformer.controlsOverlay.{move,jump,journal}` translation keys,
  consumed by Task 3's `ControlsOverlay.tsx` via `currentUI.value.platformer.controlsOverlay`.

- [ ] **Step 1: Add the English strings**

In `src/i18n/locales/en.json`, inside the existing `"platformer"` object, add a
sibling key to `"journal"`:

```json
"platformer": {
  "controlsOverlay": {
    "move": "Arrows / WASD — Move",
    "jump": "Space / Up — Jump",
    "journal": "J — Journal"
  },
  "journal": {
```

(i.e. insert the `"controlsOverlay"` block immediately before the existing
`"journal"` block, both nested under `"platformer"`.)

- [ ] **Step 2: Add the German strings**

In `src/i18n/locales/de.json`, same location, same key structure:

```json
"platformer": {
  "controlsOverlay": {
    "move": "Pfeiltasten / WASD — Bewegen",
    "jump": "Leertaste / Pfeil hoch — Springen",
    "journal": "J — Journal"
  },
  "journal": {
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: PASS with no type errors — `Translation` (in `src/i18n/translations.ts`) is
inferred from `en.json`'s shape, and `de.json` must structurally match it or the
`export const de: Translation = deJson;` assignment fails to compile.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/de.json
git commit -m "feat(platformer): add controls overlay i18n strings"
```

---

## Task 3: `ControlsOverlay.tsx` component

**Files:**
- Create: `src/themes/platformer/components/ControlsOverlay.tsx`
- Test: `src/themes/platformer/components/ControlsOverlay.test.tsx`

**Interfaces:**
- Consumes: `controlsOverlayDismissed: Signal<boolean>`, `dismissControlsOverlay(): void`
  (from `../PlatformerState`, Task 1); `currentUI: ReadonlySignal<Translation>` (from
  `@/state/locale`); `platformer.controlsOverlay.{move,jump,journal}` (Task 2).
- Produces: `ControlsOverlay` — a named export, no props — consumed by Task 4's
  `PlatformerPage.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/components/ControlsOverlay.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ControlsOverlay } from './ControlsOverlay';
import { controlsOverlayDismissed } from '../PlatformerState';

describe('ControlsOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    controlsOverlayDismissed.value = false;
  });

  it('render-notDismissed-showsUniversalControlsText', () => {
    render(<ControlsOverlay />);

    expect(screen.getByText('Arrows / WASD — Move')).toBeInTheDocument();
    expect(screen.getByText('Space / Up — Jump')).toBeInTheDocument();
    expect(screen.getByText('J — Journal')).toBeInTheDocument();
  });

  it('render-alreadyDismissed-rendersNothing', () => {
    controlsOverlayDismissed.value = true;

    const { container } = render(<ControlsOverlay />);

    expect(container).toBeEmptyDOMElement();
  });

  it('render-afterTimeoutElapses-dismissesItself', () => {
    render(<ControlsOverlay />);
    expect(screen.getByText('J — Journal')).toBeInTheDocument();

    vi.advanceTimersByTime(6000);

    expect(controlsOverlayDismissed.value).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ControlsOverlay.test.tsx`
Expected: FAIL — `./ControlsOverlay` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/themes/platformer/components/ControlsOverlay.tsx`:

```tsx
import { useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentUI } from '@/state/locale';
import { controlsOverlayDismissed, dismissControlsOverlay } from '../PlatformerState';

/** How long the overlay stays visible before auto-dismissing on its own, if
 *  the player never touches a movement/jump key first (see FR-036's "or a
 *  short timeout, whichever comes first"). */
const AUTO_DISMISS_TIMEOUT_MS = 6000;

/**
 * One-time onboarding overlay (roadmap step 25, FR-036) listing only the
 * universal controls — movement, jump, journal toggle. Deliberately excludes
 * contextual mechanics (e.g. the bridge drop-through): those are taught
 * in-place by roadmap step 26's hint signs instead (see spec.md's User
 * Story 9). Dismissal itself is driven from two places: this component's own
 * timeout (below), and `PlatformerPage.tsx`'s game loop calling
 * `dismissControlsOverlay()` the moment it sees a movement/jump key held —
 * both just flip the same `controlsOverlayDismissed` signal, so whichever
 * fires first wins and this component simply stops rendering.
 */
export const ControlsOverlay = () => {
  useSignals();

  useEffect(() => {
    const timer = window.setTimeout(dismissControlsOverlay, AUTO_DISMISS_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (controlsOverlayDismissed.value) return null;

  const ui = currentUI.value.platformer.controlsOverlay;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
      <div className="flex items-center gap-4 rounded-lg bg-black/60 px-4 py-2 text-sm text-white">
        <span>{ui.move}</span>
        <span>{ui.jump}</span>
        <span>{ui.journal}</span>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ControlsOverlay.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/components/ControlsOverlay.tsx src/themes/platformer/components/ControlsOverlay.test.tsx
git commit -m "feat(platformer): add ControlsOverlay component"
```

---

## Task 4: Wire into `PlatformerPage.tsx`

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `ControlsOverlay` (Task 3); `controlsOverlayDismissed`,
  `dismissControlsOverlay` (Task 1, from `./PlatformerState`).

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/PlatformerPage.test.tsx`. First, add
`controlsOverlayDismissed` to the existing `import { ... } from './PlatformerState'`
block, and reset it in the existing `beforeEach` (alongside the other module-level
signal resets already there):

```ts
controlsOverlayDismissed.value = false;
```

Then add a new `describe` block (anywhere after the existing tests, e.g. right before
the closing of the outer `describe('PlatformerPage', ...)`):

```tsx
describe('PlatformerPage — controls overlay', () => {
  it('render-default-showsControlsOverlay', () => {
    render(<PlatformerPage />);

    expect(screen.getByText('J — Journal')).toBeInTheDocument();
  });

  it('pressArrowRight-gameLoopTicks-dismissesControlsOverlay', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    frameCallback!(0);
    frameCallback!(16);

    expect(screen.queryByText('J — Journal')).not.toBeInTheDocument();
  });

  it('pressSpace-gameLoopTicks-dismissesControlsOverlay', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    fireEvent.keyDown(window, { code: 'Space' });
    frameCallback!(0);
    frameCallback!(16);

    expect(screen.queryByText('J — Journal')).not.toBeInTheDocument();
  });

  it('pressJournalKey-gameLoopTicks-doesNotDismissControlsOverlay', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    // The journal key is not a movement/jump key — it must not count toward
    // FR-036's "first movement or jump input" dismissal trigger.
    fireEvent.keyDown(window, { code: 'KeyJ' });
    frameCallback!(16);

    expect(screen.getByText('J — Journal')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- PlatformerPage.test.tsx -t "controls overlay"`
Expected: FAIL — `J — Journal` text doesn't render yet (no `ControlsOverlay` mounted),
and the dismissal tests fail because nothing calls `dismissControlsOverlay()`.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerPage.tsx`:

1. Add the import (alongside the existing `Journal` import):

```ts
import { ControlsOverlay } from './components/ControlsOverlay';
```

2. Add `controlsOverlayDismissed, dismissControlsOverlay` to the existing
   `import { ... } from './PlatformerState'` block.

3. Inside the game loop's `createGameLoop((dt) => { ... })` callback, right after the
   existing block that computes `horizontal`, `spacePressed`, `arrowUpPressed`,
   `jumpPressed`, `jumpHeld`, `dropThroughHeld` (i.e. immediately after the line
   `const dropThroughHeld = input.isHeld('ArrowDown') || input.isHeld('KeyS');`), add:

```ts
      // FR-036: dismiss the one-time controls overlay on the player's first
      // movement or jump input this session (the other dismissal path is
      // ControlsOverlay.tsx's own timeout) — checked every tick but only
      // actually writes the signal once, since dismissControlsOverlay() is
      // idempotent and this whole block is skippable once already dismissed.
      if (
        !controlsOverlayDismissed.value &&
        (horizontal.left || horizontal.right || jumpPressed || jumpHeld)
      ) {
        dismissControlsOverlay();
      }
```

4. Render `<ControlsOverlay />` in the JSX, alongside the existing `<FloatingControls />`:

```tsx
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" tabIndex={-1} />
      <FloatingControls />
      <ControlsOverlay />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: PASS (full file — confirms the new tests pass and nothing else regressed)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): show controls overlay at game start, dismiss on input"
```

---

## Task 5: Full verification + roadmap checkbox

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions anywhere in the platformer theme or elsewhere.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: PASS — zero TypeScript errors (SC-007).

- [ ] **Step 3: Manual browser verification**

Start the dev server and open the Platformer theme:
- Confirm the overlay appears at the bottom of the screen showing "Arrows / WASD —
  Move", "Space / Up — Jump", "J — Journal" (or the German equivalents if the locale
  toggle is set to DE).
- Press an arrow key (or Space) — confirm the overlay disappears immediately.
- Reload and this time wait ~6 seconds without pressing anything — confirm the
  overlay disappears on its own.
- Reload, let the character fall into a pit (or use the `?debug=hitboxes&debug` Kill
  button) to trigger a respawn — confirm the overlay does NOT reappear after a
  respawn if it was already dismissed before the death.

- [ ] **Step 4: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, change step 25's `- [ ]` to `- [x]`, and
append a short note of anything discovered/adjusted during implementation (matching
the style of prior completed steps' entries), if applicable.

- [ ] **Step 5: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs: check off roadmap step 25 (controls overlay)"
```
