# Journal Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement roadmap step 13 — pressing `J` (or clicking a bottom-right
journal icon button) toggles a fullscreen, unstyled overlay that pauses the
running game and lists collected CV facts; pressing `J` again, or clicking the
icon or a Close button, dismisses it and resumes the game exactly where it left
off. Collected facts are preserved across a death/respawn (unchanged from
today's behavior).

**Architecture:** Extend the existing `GamePhase` state machine
(`engine/GameLifecycle.ts`) with a `'paused'` value, gated in the game loop's
`onTick` the same way `'dying'`/`'awaitingRestart'` already are (loop skips
physics/input, still re-renders). A new `Journal.tsx` component (mirroring
`FloatingControls.tsx`'s location/style: a plain fixed-position Tailwind `<div>`,
no shadcn `Dialog` exists in this repo to reuse) renders as a conditional JSX
sibling of `<canvas>` in `PlatformerPage.tsx`, driven by local `useState` +
a mirrored ref (matching the existing `debugHitboxesOn`/`debugHitboxesRef`
pattern) so the `keydown` listener registered once in the mount effect always
reads the latest open/closed value.

**Key design decision — seed data:** Steps 11–12 (coin render + collection)
aren't implemented yet, so no real `collectedFacts` producer exists. Per
discussion with the user, this plan defines the *real* `collectedFacts` signal
and `CollectedFact` type now (step 12 will later push real entries into it) but
seeds it with two hardcoded sample facts so the roadmap's verify line ("see the
collected fact listed") has something to show. The seed constant is clearly
marked as temporary scaffolding to delete once step 12 lands. If this turns out
to conflict with step 12's actual data shape, flag it — the type is designed to
match `spec.md`'s `CollectedFact` definition (FR-032) exactly, so it shouldn't.

**Key design decision — pause primitive:** Per discussion with the user,
`'paused'` is added directly to `GamePhase` (matching `spec.md` FR-003, which
already documents a `paused` phase for "journal open or tab lost focus") rather
than a separate boolean. Step 24 (pause-on-open for floating controls) is
expected to reuse this same `'paused'` phase later — this plan does not
implement step 24's trigger, only the phase value and the loop/render gating
around it.

**Key design decision — facts survive death/respawn:** Discussed and reversed
with the user after initially considering the opposite: `collectedFacts` is
**not** touched by `resetGame()` — a death/respawn preserves discovered CV
content, matching `spec.md` FR-020b as originally written. This matters for a
CV showcase specifically: the whole point of playing is revealing CV content,
so an accidental pit-fall erasing that progress would fight the site's actual
goal. Hard-clearing is reserved for a deliberate "Reset Game"/"Replay Level"
action (FR-018b, steps 15/22) — out of scope for this plan. Per the same
discussion, `spec.md` now also documents (FR-020c, forward-looking — enemies
and blocks don't exist until steps 16/19) that a respawn resets enemies/blocks
back to their initial state for consistent level layout, while already-collected
coins stay gone permanently and re-triggering an already-collected enemy/block
grants no duplicate fact/fruit. None of that is implemented in this plan (no
enemies/blocks/coins exist yet) — it's recorded now so those later steps build
it correctly the first time.

**Key design decision — bottom-right icon button:** Per discussion with the
user, this plan also builds the HUD icon button `FR-025` assigns to the
journal (bottom-right, "opens/closes the journal, same as `J` key"), pulled
forward from its originally-planned step 15/25 polish pass. No journal/book
icon asset exists in `public/sprites/` or `public/icons.svg` today — the button
uses a plain `📖` emoji as an explicit placeholder (labelled as such in a code
comment) until a real pixel-art icon is added, matching this step's
"unstyled skeleton" scope for everything else.

**Tech Stack:** React 19 + TypeScript strict, `@preact/signals-react` for
cross-cutting game state, Tailwind CSS 4 utility classes, Vitest + React
Testing Library.

**Spec:** `specs/S-006-platformer-theme/spec.md` FR-003, FR-014, FR-020b, FR-025,
FR-031, FR-032 (paused phase / respawn-preserves-facts / journal icon /
`CollectedFact` type); `specs/S-006-platformer-theme/roadmap.md` step 13.

## Global Constraints

- TDD: write the failing test before the implementation in every task.
- TypeScript strict mode, no `any`.
- Named exports only (no default exports).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- Components: named arrow function exports, props interface in the same file,
  `cn()` from `@/lib/utils` for any conditional classes (not needed here — no
  conditional styling in this skeleton).
- **Scope boundary — do NOT build in this plan:** notebook-paper styling,
  `Caveat` font, bookmark tabs, pagination, or section counters (all step
  14/15). Do NOT build the Reset Game button (FR-018b, step 15) or the
  ending-screen/flagpole journal entries (step 22). Do NOT touch `resetGame()`
  — `collectedFacts` must stay unaffected by it (facts survive death/respawn).
  Do NOT build `CollectibleMapper`, coins, enemies, blocks, or real
  fact-collection wiring (steps 11/12/16/19) — this plan only defines the data
  shape those steps will populate, plus the `spec.md` FR-020c note on how
  their respawn behavior should work once built. The bottom-right journal icon
  button (FR-025) **is** in scope for this plan (pulled forward, see the
  Architecture note above) — it just uses a placeholder emoji instead of a
  real sprite.
- Branch: create `S-006-step13-journal-skeleton` off `S-006-platformer-theme`.
  PR target is `S-006-platformer-theme`, **not** `main`. Delete the step branch
  after merging.
- Signals used in tests are module-level singletons — every new signal this
  plan introduces (`collectedFacts`) must be reset in `PlatformerPage.test.tsx`'s
  existing `beforeEach` block, matching how `playerState`/`cameraPositionX`/
  `healthState`/`lifecycleState` are already reset there.

---

## Task 1: Add a `paused` phase to the lifecycle state machine

**Files:**
- Modify: `src/themes/platformer/engine/GameLifecycle.ts`
- Test: `src/themes/platformer/engine/GameLifecycle.test.ts`

**Interfaces:**
- Consumes: nothing new (works entirely within the existing `LifecycleState`/
  `GamePhase` types already defined in this file).
- Produces: `GamePhase` now includes `'paused'`; two new exported functions
  `pauseForJournal(state: LifecycleState): LifecycleState` and
  `resumeFromJournal(state: LifecycleState): LifecycleState`; `currentIrisRadius`
  now also returns `null` for `'paused'` (no iris drawn while paused — the
  Journal overlay itself covers the screen). Task 5 imports
  `pauseForJournal`/`resumeFromJournal` and reads/writes `GamePhase`.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/GameLifecycle.test.ts`. First, extend the
import list at the top of the file:

```ts
import {
  introState,
  startDeath,
  tickLifecycle,
  currentIrisRadius,
  pauseForJournal,
  resumeFromJournal,
} from './GameLifecycle';
```

Then add these new `describe` blocks (place them after the existing
`describe('startDeath', ...)` block, before `describe('tickLifecycle', ...)`):

```ts
describe('pauseForJournal', () => {
  it('called-fromPlaying-returnsPausedPhaseSameElapsedAndCenter', () => {
    const state: LifecycleState = { phase: 'playing', elapsed: 0, centerX: 12, centerY: 34 };
    expect(pauseForJournal(state)).toEqual({
      phase: 'paused',
      elapsed: 0,
      centerX: 12,
      centerY: 34,
    });
  });
});

describe('resumeFromJournal', () => {
  it('called-fromPaused-returnsPlayingPhaseSameElapsedAndCenter', () => {
    const state: LifecycleState = { phase: 'paused', elapsed: 0, centerX: 12, centerY: 34 };
    expect(resumeFromJournal(state)).toEqual({
      phase: 'playing',
      elapsed: 0,
      centerX: 12,
      centerY: 34,
    });
  });
});
```

And add this test inside the existing `describe('currentIrisRadius', ...)`
block (anywhere among the other cases, e.g. right after the `'playingPhase-returns-null'`
case):

```ts
  it('pausedPhase-returns-null', () => {
    const state: LifecycleState = { phase: 'paused', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/GameLifecycle.test.ts`
Expected: FAIL — `pauseForJournal`/`resumeFromJournal` are not exported from
`./GameLifecycle`, and TypeScript also rejects `phase: 'paused'` as not
assignable to `GamePhase`.

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/engine/GameLifecycle.ts`, find:

```ts
/**
 * `intro`: circle already held small, then growing open at game
 * start/restart (non-blocking — see this plan's Architecture note; physics
 * still runs underneath).
 * `playing`: normal gameplay, no overlay drawn.
 * `dying`: circle shrinking closed on death, game loop paused.
 * `awaitingRestart`: fully black, "Press any button to restart" shown,
 * game loop paused, waiting for input.
 */
export type GamePhase = 'intro' | 'playing' | 'dying' | 'awaitingRestart';
```

Replace with:

```ts
/**
 * `intro`: circle already held small, then growing open at game
 * start/restart (non-blocking — see this plan's Architecture note; physics
 * still runs underneath).
 * `playing`: normal gameplay, no overlay drawn.
 * `dying`: circle shrinking closed on death, game loop paused.
 * `awaitingRestart`: fully black, "Press any button to restart" shown,
 * game loop paused, waiting for input.
 * `paused`: the journal overlay is open (or, in a later step, the floating
 * controls are open) — game loop paused, no iris overlay drawn (the DOM
 * overlay covers the screen instead).
 */
export type GamePhase = 'intro' | 'playing' | 'dying' | 'awaitingRestart' | 'paused';
```

Find:

```ts
export function startDeath(centerX: number, centerY: number): LifecycleState {
  return { phase: 'dying', elapsed: 0, centerX, centerY };
}
```

Replace with:

```ts
export function startDeath(centerX: number, centerY: number): LifecycleState {
  return { phase: 'dying', elapsed: 0, centerX, centerY };
}

/** Transitions to `paused` (e.g. the journal opening) without touching the
 *  frozen `elapsed`/`centerX`/`centerY` — there's no animation running while
 *  paused, so nothing else needs to change. */
export function pauseForJournal(state: LifecycleState): LifecycleState {
  return { ...state, phase: 'paused' };
}

/** Transitions back to `playing` (e.g. the journal closing). */
export function resumeFromJournal(state: LifecycleState): LifecycleState {
  return { ...state, phase: 'playing' };
}
```

Find:

```ts
export function currentIrisRadius(state: LifecycleState, maxRadius: number): number | null {
  if (state.phase === 'playing') return null;
  if (state.phase === 'awaitingRestart') return 0;
```

Replace with:

```ts
export function currentIrisRadius(state: LifecycleState, maxRadius: number): number | null {
  if (state.phase === 'playing' || state.phase === 'paused') return null;
  if (state.phase === 'awaitingRestart') return 0;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/GameLifecycle.test.ts`
Expected: PASS (all existing cases plus the three new ones).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/GameLifecycle.ts src/themes/platformer/engine/GameLifecycle.test.ts
git commit -m "feat(platformer): add paused phase to lifecycle state machine"
```

---

## Task 2: Define shared platformer types (`SectionId`, `CVItemData`, `CollectedFact`)

**Files:**
- Create: `src/themes/platformer/types.ts`

**Interfaces:**
- Consumes: the CV data interfaces from `src/types/cv.ts` (`Skill`, `Language`,
  `Experience`, `Course`, `Education`, `Certificate`, `Project`, `Activity`,
  `Personality`).
- Produces: `SectionId`, `CVItemData`, `CollectedFact` — Task 3 imports
  `CollectedFact`; Task 4 imports `CollectedFact` for its props/rendering logic.

This file is pure type declarations (no runtime logic), matching the existing
convention in this codebase (e.g. `src/themes/platformer/level/LevelData.ts` has
no test file) — no test task for this one.

- [ ] **Step 1: Write the file**

```ts
import type {
  Skill,
  Language,
  Experience,
  Course,
  Education,
  Certificate,
  Project,
  Activity,
  Personality,
} from '@/types/cv';

/**
 * Every top-level CV section that can back a journal bookmark. Matches the
 * property names on `CVData` (src/types/cv.ts) so a `CollectedFact.sectionId`
 * can be used directly to look up the section's data array.
 */
export type SectionId =
  | 'personality'
  | 'experience'
  | 'skills'
  | 'courses'
  | 'education'
  | 'certificates'
  | 'languages'
  | 'projects'
  | 'activities';

/** The union of every CV item shape a single collected fact might carry. */
export type CVItemData =
  | Skill
  | Language
  | Experience
  | Course
  | Education
  | Certificate
  | Project
  | Activity
  | Personality;

/**
 * A single discovered CV fact, per spec.md FR-032. `sourceType` distinguishes
 * how it was revealed (coin/enemy/block) even though only 'coin' is reachable
 * until steps 16/20 add enemies and blocks.
 */
export interface CollectedFact {
  id: string;
  sectionId: SectionId;
  sectionLabel: string;
  data: CVItemData;
  sourceType: 'coin' | 'enemy' | 'block';
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/types.ts
git commit -m "feat(platformer): define SectionId/CVItemData/CollectedFact types"
```

---

## Task 3: `collectedFacts` signal with temporary seed data

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `CollectedFact` from `./types` (Task 2).
- Produces: `collectedFacts` signal (`Signal<CollectedFact[]>`), exported from
  `PlatformerState.ts`. Task 4 (`Journal.tsx`) reads `collectedFacts.value`.
  Task 5's test suite resets it in `beforeEach`. `resetGame()` is deliberately
  **not** modified — it must not touch `collectedFacts` (facts survive a
  death/respawn, per the Architecture note above).

- [ ] **Step 1: Write the failing test**

In `src/themes/platformer/PlatformerState.test.ts`, find the existing import
from `./PlatformerState` at the top of the file:

```ts
import {
  playerState,
  cameraPositionX,
  healthState,
  lifecycleState,
  spawnPlayerState,
  spawnCenter,
  resetGame,
} from './PlatformerState';
```

Replace with:

```ts
import {
  playerState,
  cameraPositionX,
  healthState,
  lifecycleState,
  spawnPlayerState,
  spawnCenter,
  resetGame,
  collectedFacts,
} from './PlatformerState';
```

Then add this new `describe` block anywhere at the top level of the file
(e.g. after the closing brace of the outer `describe('PlatformerState', ...)`
block):

```ts
describe('collectedFacts', () => {
  it('initialValue-onModuleLoad-containsSeedFacts', () => {
    expect(collectedFacts.value.length).toBeGreaterThan(0);
    expect(collectedFacts.value[0]).toMatchObject({
      sourceType: 'coin',
    });
  });
});
```

Also add this test right after the existing
`resetGame-calledAfterMutation-restoresSpawnHealthAndZeroCamera` test (same
`describe('PlatformerState', ...)` block) — a regression guard that
`resetGame()` must never start touching `collectedFacts`:

```ts
  it('resetGame-calledWithCollectedFacts-doesNotClearThem', () => {
    const facts = [
      {
        id: 'x',
        sectionId: 'skills' as const,
        sectionLabel: 'Skills',
        data: { name: 'Go', level: 70 },
        sourceType: 'coin' as const,
      },
    ];
    collectedFacts.value = facts;

    resetGame();

    expect(collectedFacts.value).toBe(facts);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: FAIL — `collectedFacts` is not exported from `./PlatformerState` yet
(the `resetGame` regression-guard test passes trivially once the import
resolves, since `resetGame()` already doesn't touch any signal it isn't told
about — it's the `collectedFacts` export itself that's missing).

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/PlatformerState.ts`, add this import alongside the
existing ones at the top of the file:

```ts
import type { CollectedFact } from './types';
```

Then, after the existing `healthState` signal definition (right before the
`spawnCenter` function), add:

```ts
/**
 * TEMPORARY seed data — steps 11/12 (coin render + collection) don't exist
 * yet, so nothing populates `collectedFacts` for real. These two entries only
 * exist so step 13's "see the collected fact listed" verification has
 * something to show. Delete this constant and switch `collectedFacts`'s
 * initial value to `[]` once step 12 lands.
 */
const SEED_COLLECTED_FACTS: CollectedFact[] = [
  {
    id: 'seed-skill-typescript',
    sectionId: 'skills',
    sectionLabel: 'Skills',
    data: { name: 'TypeScript', level: 90 },
    sourceType: 'coin',
  },
  {
    id: 'seed-language-german',
    sectionId: 'languages',
    sectionLabel: 'Languages',
    data: { name: 'German', flag: '\u{1F1E9}\u{1F1EA}', level: 100 },
    sourceType: 'coin',
  },
];

/**
 * Facts discovered so far this session (see spec.md FR-032). Populated for
 * real starting in step 12 — see the seed-data comment above.
 */
export const collectedFacts = signal<CollectedFact[]>(SEED_COLLECTED_FACTS);
```

`resetGame()` is intentionally left untouched — it must not reference
`collectedFacts` at all, since facts are meant to survive a death/respawn.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add collectedFacts signal with temporary seed data"
```

---

## Task 4: `Journal` component

**Files:**
- Create: `src/themes/platformer/components/Journal.tsx`
- Test: `src/themes/platformer/components/Journal.test.tsx`

**Interfaces:**
- Consumes: `collectedFacts` from `../PlatformerState` (Task 3); `CollectedFact`
  from `../types` (Task 2).
- Produces: `Journal` component with props `{ onClose: () => void }`. Task 5
  renders `<Journal onClose={...} />` conditionally in `PlatformerPage.tsx`.
  Exposes `data-testid="platformer-journal"` (root overlay),
  `data-testid="journal-close-button"` (close button), and
  `data-testid="journal-fact-item"` (one per listed fact) for both this task's
  tests and Task 5's integration test.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Journal } from './Journal';
import { collectedFacts } from '../PlatformerState';
import type { CollectedFact } from '../types';

const originalFacts = collectedFacts.value;

describe('Journal', () => {
  afterEach(() => {
    collectedFacts.value = originalFacts;
  });

  it('render-withCollectedFacts-listsEachFactsSectionLabel', () => {
    const facts: CollectedFact[] = [
      {
        id: 'fact-1',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { name: 'React', level: 80 },
        sourceType: 'coin',
      },
    ];
    collectedFacts.value = facts;

    render(<Journal onClose={() => {}} />);

    const items = screen.getAllByTestId('journal-fact-item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Skills');
    expect(items[0]).toHaveTextContent('React');
  });

  it('render-withNoCollectedFacts-showsEmptyState', () => {
    collectedFacts.value = [];

    render(<Journal onClose={() => {}} />);

    expect(screen.getByTestId('journal-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('journal-fact-item')).not.toBeInTheDocument();
  });

  it('closeButtonClicked-always-callsOnClose', () => {
    collectedFacts.value = [];
    const onClose = vi.fn();

    render(<Journal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('journal-close-button'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/components/Journal.test.tsx`
Expected: FAIL — cannot find module `./Journal`.

- [ ] **Step 3: Write the implementation**

```tsx
import { useSignals } from '@preact/signals-react/runtime';
import { collectedFacts } from '../PlatformerState';
import type { CollectedFact } from '../types';

interface JournalProps {
  onClose: () => void;
}

/**
 * Best-effort single-line label for a fact's underlying CV item — every
 * `CVItemData` variant has a `name` or `title` field except `Experience`
 * (`company`) and `Personality` (also `name`, already covered).
 */
const factItemLabel = (fact: CollectedFact): string => {
  const data = fact.data as Record<string, unknown>;
  if (typeof data.name === 'string') return data.name;
  if (typeof data.title === 'string') return data.title;
  if (typeof data.company === 'string') return data.company;
  return fact.sectionLabel;
};

/**
 * Unstyled journal skeleton (roadmap step 13) — a fullscreen overlay listing
 * collected facts, no notebook/bookmark/pagination styling yet (step 14/15).
 */
export const Journal = ({ onClose }: JournalProps) => {
  useSignals();
  const facts = collectedFacts.value;

  return (
    <div
      data-testid="platformer-journal"
      className="fixed inset-0 z-[60] flex flex-col items-center gap-4 overflow-y-auto bg-black/90 p-8 text-white"
    >
      <button
        type="button"
        onClick={onClose}
        data-testid="journal-close-button"
        className="fixed top-4 right-4 rounded bg-gray-700 px-3 py-1 text-sm"
      >
        Close
      </button>
      <h2 className="text-2xl font-bold">Journal</h2>
      {facts.length === 0 ? (
        <p data-testid="journal-empty-state">No facts collected yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {facts.map((fact) => (
            <li key={fact.id} data-testid="journal-fact-item">
              {fact.sectionLabel}: {factItemLabel(fact)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/components/Journal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/components/Journal.tsx src/themes/platformer/components/Journal.test.tsx
git commit -m "feat(platformer): add unstyled Journal overlay component"
```

---

## Task 5: Wire the `J` key + icon button toggle into `PlatformerPage`

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify (tests): `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `pauseForJournal`/`resumeFromJournal` from `./engine/GameLifecycle`
  (Task 1); `Journal` from `./components/Journal` (Task 4); `collectedFacts`
  from `./PlatformerState` (Task 3, already imported by the test file's
  `beforeEach` reset added in this task).
- Produces: nothing new consumed by later tasks — this is the final wiring
  task for step 13. Exposes `data-testid="journal-open-button"` on the
  bottom-right icon button.

- [ ] **Step 1: Reset `collectedFacts` in the test file's `beforeEach`**

In `src/themes/platformer/PlatformerPage.test.tsx`, find the top-of-file import
and singleton snapshot:

```ts
import { playerState, cameraPositionX, healthState, lifecycleState } from './PlatformerState';
```

Replace with:

```ts
import {
  playerState,
  cameraPositionX,
  healthState,
  lifecycleState,
  collectedFacts,
} from './PlatformerState';
```

Find:

```ts
const initialPlayerState = playerState.value;
const initialLifecycleState = lifecycleState.value;
const originalLocation = window.location;
```

Replace with:

```ts
const initialPlayerState = playerState.value;
const initialLifecycleState = lifecycleState.value;
const initialCollectedFacts = collectedFacts.value;
const originalLocation = window.location;
```

Find:

```ts
    playerState.value = initialPlayerState;
    cameraPositionX.value = 0;
    healthState.value = MAX_HALF_HEARTS;
    lifecycleState.value = initialLifecycleState;
  });
```

Replace with:

```ts
    playerState.value = initialPlayerState;
    cameraPositionX.value = 0;
    healthState.value = MAX_HALF_HEARTS;
    lifecycleState.value = initialLifecycleState;
    collectedFacts.value = initialCollectedFacts;
  });
```

- [ ] **Step 2: Write the failing tests**

Add these to `src/themes/platformer/PlatformerPage.test.tsx` (inside the
existing `describe('PlatformerPage', ...)` block, anywhere after the other
`it(...)` cases — e.g. right after the `awaitingRestartPhase-canvasClicked-...`
test).

```ts
  it('jKeyPressed-whilePlaying-opensJournalAndPausesLoop', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };

    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(screen.getByTestId('platformer-journal')).toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('paused');

    const xBeforeTick = playerState.value.x;
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    frameCallback!(16);
    expect(playerState.value.x).toBe(xBeforeTick);
  });

  it('jKeyPressed-whileJournalOpen-closesJournalAndResumesLoop', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' });
    expect(lifecycleState.value.phase).toBe('paused');

    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(screen.queryByTestId('platformer-journal')).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('playing');
  });

  it('journalCloseButtonClicked-whileOpen-closesJournal', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' });

    fireEvent.click(screen.getByTestId('journal-close-button'));

    expect(screen.queryByTestId('platformer-journal')).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('playing');
  });

  it('jKeyPressed-whileDying-isIgnored', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'dying' };

    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(screen.queryByTestId('platformer-journal')).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('dying');
  });

  it('journalOpenButtonClicked-whilePlaying-opensJournalAndPausesLoop', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };

    fireEvent.click(screen.getByTestId('journal-open-button'));

    expect(screen.getByTestId('platformer-journal')).toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('paused');
  });

  it('journalOpenButtonClicked-whileJournalOpen-closesJournalAndResumesLoop', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.click(screen.getByTestId('journal-open-button'));
    expect(lifecycleState.value.phase).toBe('paused');

    fireEvent.click(screen.getByTestId('journal-open-button'));

    expect(screen.queryByTestId('platformer-journal')).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('playing');
  });

  it('deathThenRestart-journalOpened-stillShowsSeedFactsFromBeforeTheDeath', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    const factsBeforeDeath = collectedFacts.value;
    expect(factsBeforeDeath.length).toBeGreaterThan(0);

    // Force a fatal pit fall (same setup as the existing
    // healthReachesZero-... test above), then let the death/restart timeline
    // fully play out.
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = { ...playerState.value, x: 500, y: 5000, vy: 900, grounded: false };
    frameCallback!(16);
    expect(lifecycleState.value.phase).toBe('dying');

    let t = 16;
    for (let i = 0; i < 250; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(lifecycleState.value.phase).toBe('awaitingRestart');

    fireEvent.keyDown(window, { code: 'Enter' });
    expect(collectedFacts.value).toBe(factsBeforeDeath);

    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(screen.queryByTestId('journal-empty-state')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('journal-fact-item')).toHaveLength(factsBeforeDeath.length);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — no `data-testid="platformer-journal"` or
`data-testid="journal-open-button"` exists yet, and `KeyJ`/the icon button do
nothing.

- [ ] **Step 4: Write the implementation**

In `src/themes/platformer/PlatformerPage.tsx`, update the import block. Find:

```ts
import { tickLifecycle, startDeath, introState, currentIrisRadius } from './engine/GameLifecycle';
```

Replace with:

```ts
import {
  tickLifecycle,
  startDeath,
  introState,
  currentIrisRadius,
  pauseForJournal,
  resumeFromJournal,
} from './engine/GameLifecycle';
```

Find:

```ts
import { playerState, cameraPositionX, healthState, lifecycleState, spawnCenter, resetGame } from './PlatformerState';
```

Replace with:

```ts
import { playerState, cameraPositionX, healthState, lifecycleState, spawnCenter, resetGame } from './PlatformerState';
import { Journal } from './components/Journal';
```

Find:

```ts
  const [debugHitboxesOn, setDebugHitboxesOn] = useState(
    () => debugParams.get('debug') === 'hitboxes',
  );
  const debugHitboxesRef = useRef(debugHitboxesOn);
  debugHitboxesRef.current = debugHitboxesOn;

  const handleToggleHitboxes = () => setDebugHitboxesOn((prev) => !prev);
```

Replace with:

```ts
  const [debugHitboxesOn, setDebugHitboxesOn] = useState(
    () => debugParams.get('debug') === 'hitboxes',
  );
  const debugHitboxesRef = useRef(debugHitboxesOn);
  debugHitboxesRef.current = debugHitboxesOn;

  const handleToggleHitboxes = () => setDebugHitboxesOn((prev) => !prev);

  // Mirrored into a ref (same pattern as debugHitboxesOn/debugHitboxesRef
  // above) so the keydown listener registered once in the mount effect below
  // always reads the latest open/closed value instead of closing over a
  // stale one.
  const [journalOpen, setJournalOpen] = useState(false);
  const journalOpenRef = useRef(journalOpen);
  journalOpenRef.current = journalOpen;

  /**
   * Toggles the journal. Opening is only allowed from 'playing' (not
   * mid-death/intro/restart); closing is only allowed from 'paused' — both
   * guards prevent the journal from desyncing the lifecycle phase if `J` is
   * pressed during an animation.
   */
  const handleJournalToggle = () => {
    const phase = lifecycleState.value.phase;
    if (!journalOpenRef.current) {
      if (phase !== 'playing') return;
      lifecycleState.value = pauseForJournal(lifecycleState.value);
      setJournalOpen(true);
    } else {
      if (phase !== 'paused') return;
      lifecycleState.value = resumeFromJournal(lifecycleState.value);
      setJournalOpen(false);
    }
  };
```

Find:

```ts
    window.addEventListener('keydown', restartIfAwaiting);
    canvas.addEventListener('click', restartIfAwaiting);
```

Replace with:

```ts
    window.addEventListener('keydown', restartIfAwaiting);
    canvas.addEventListener('click', restartIfAwaiting);

    const onJournalKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyJ') handleJournalToggle();
    };
    window.addEventListener('keydown', onJournalKey);
```

Find:

```ts
      if (lifecycleState.value.phase === 'awaitingRestart') {
        render();
        return;
      }
```

Replace with:

```ts
      if (lifecycleState.value.phase === 'awaitingRestart') {
        render();
        return;
      }
      if (lifecycleState.value.phase === 'paused') {
        render();
        return;
      }
```

Find:

```ts
      const lifecycle = lifecycleState.value;
      if (lifecycle.phase !== 'playing') {
```

Replace with:

```ts
      const lifecycle = lifecycleState.value;
      if (lifecycle.phase !== 'playing' && lifecycle.phase !== 'paused') {
```

Find:

```ts
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', restartIfAwaiting);
      canvas.removeEventListener('click', restartIfAwaiting);
    };
  }, []);
```

Replace with:

```ts
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', restartIfAwaiting);
      window.removeEventListener('keydown', onJournalKey);
      canvas.removeEventListener('click', restartIfAwaiting);
    };
  }, []);
```

Find:

```tsx
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" tabIndex={-1} />
      <FloatingControls />
```

Replace with:

```tsx
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" tabIndex={-1} />
      <FloatingControls />
      {journalOpen && <Journal onClose={handleJournalToggle} />}
      {/* PLACEHOLDER icon: no journal/book pixel-art sprite exists yet
          (public/sprites/, public/icons.svg) — swap this emoji for a real
          sprite once one is added. FR-025: bottom-right, same action as `J`. */}
      <button
        type="button"
        onClick={handleJournalToggle}
        data-testid="journal-open-button"
        aria-label="Toggle journal"
        className="fixed right-4 bottom-4 z-50 rounded-full bg-gray-800/80 px-3 py-2 text-xl"
      >
        📖
      </button>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS (all existing cases plus the seven new ones).

Then run the full suite once to confirm nothing else regressed:

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): wire J key + icon button to toggle journal and pause the game"
```

---

## Task 6: Manual browser verification + roadmap checkoff

- [ ] **Step 1: Manual browser check**

Start the dev server and open the Platformer theme. Confirm:

1. Press `J` during normal gameplay — a fullscreen dark overlay appears listing
   "Skills: TypeScript" and "Languages: German" (the seed facts), the character
   stops moving/falling.
2. Press `J` again — the overlay closes, the game resumes exactly where it was
   (position/camera unchanged).
3. Open the overlay, click "Close" instead of pressing `J` — same result as (2).
4. Click the 📖 icon button in the bottom-right corner — same as pressing `J`
   (opens if closed, closes if open).
5. While the overlay is open, press arrow keys / Space — the character does not
   move or jump.
6. Trigger a death (fall into a pit repeatedly, or use the debug Kill button at
   `?debug=1`) and let it play through to the restart prompt — confirm `J` does
   nothing while `dying`/`awaitingRestart` (no overlay appears, no console
   errors), then press any key to restart and open the journal again — the two
   seed facts are still listed (preserved through the respawn).
7. Resize the window while the journal is open — no layout break, overlay still
   covers the full viewport; the icon button stays anchored bottom-right.

- [ ] **Step 2: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, find:

```
- [ ] **13. Journal skeleton** — `J` (or a bottom-right journal icon button, per
  FR-025 — a placeholder icon/emoji if no pixel-art asset exists yet) toggles a
  fullscreen overlay, pauses the game, shows collected facts unstyled. Collected
  facts are preserved across a death/respawn (unaffected by this step — see
  FR-020c for the forward-looking note on enemies/blocks respawning while
  coins/facts don't, once those exist).
  *Verify: open/close the journal via both the `J` key and the icon button, see
  the collected fact listed.*
```

Replace with:

```
- [x] **13. Journal skeleton** — `J` (or a bottom-right journal icon button, per
  FR-025) toggles a fullscreen overlay, pauses the game, shows collected facts
  unstyled. The icon button uses a placeholder 📖 emoji — no pixel-art journal
  asset exists in `public/sprites/` or `public/icons.svg` yet. `collectedFacts`
  and `CollectedFact` are real (in `PlatformerState.ts` / `types.ts`) but
  seeded with two hardcoded sample facts, since steps 11/12 (coin collection)
  don't populate them yet — the seed data should be removed once step 12
  lands. Collected facts are preserved across a death/respawn (see FR-020c for
  the forward-looking note on enemies/blocks respawning while coins/facts
  don't, once those exist).
  *Verify: open/close the journal via both the `J` key and the icon button, see
  the collected fact listed; after a death/respawn, the facts are still there.*
```

- [ ] **Step 3: Commit the checkoff**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): check off roadmap step 13 (journal skeleton)"
```

## After this plan

Open a PR from `S-006-step13-journal-skeleton` into `S-006-platformer-theme`
(not `main`). Delete the step branch after merging.
