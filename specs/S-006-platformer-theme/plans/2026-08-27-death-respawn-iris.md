# Death/Respawn Iris Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement roadmap step 10 (Respawn) with an iris-wipe visual transition:
a black circle shrinks to nothing centered on the player when they die (health
reaches 0), then a "Press any button to restart" prompt waits for input, then a
black circle grows from nothing centered on the spawned player — both at restart
and on first mount of the Platformer theme.

**Architecture:** Two new pure engine modules (`IrisTransition.ts` for the radius
math, `GameLifecycle.ts` for the `intro | playing | dying | awaitingRestart` phase
state machine), two new pure draw functions in `Renderer.ts`, a new `lifecycleState`
signal in `PlatformerState.ts`, and orchestration wiring in `PlatformerPage.tsx`'s
game loop and render function. Mirrors the existing split between pure,
independently-tested engine logic (`Physics.ts`, `Camera.ts`, `Health.ts`) and thin
React-component wiring.

**Key design decision — intro does not pause physics:** Only the `dying` and
`awaitingRestart` phases pause the game loop (per explicit instruction: "the game
loop pauses when the player is death"). The `intro` phase (circle growing open at
mount/restart) is purely a visual overlay on top of normal, already-running
gameplay — this was not explicitly requested to pause, and keeping it non-blocking
avoids touching roughly 20 existing `PlatformerPage.test.tsx` tests that tick
physics immediately from `frameCallback!(0)`/`frameCallback!(16)` at mount. If this
turns out to feel wrong in the browser check (e.g. a pit near spawn), flag it —
gating physics on `phase !== 'intro'` would be a small follow-up change.

**Tech Stack:** TypeScript strict, Vitest + React Testing Library + jsdom,
`@preact/signals-react` for shared state, raw Canvas 2D API (no new dependencies).

**Spec:** `specs/S-006-platformer-theme/spec.md` (FR-018b reset behavior, health/
checkpoint sections) and `specs/S-006-platformer-theme/roadmap.md` (step 10). This
plan's iris-transition visual design was worked out directly with the user in chat
(not written to a separate design doc, since the change is bounded — see
`superpowers:brainstorming`'s bounded path) and is captured here instead.

## Global Constraints

- TDD: write the failing test before the implementation, for every task (constitution
  Principle II).
- No `any` types (TypeScript strict mode, constitution Principle I).
- Named arrow function exports / named function exports only, no default exports
  (constitution Principle III).
- Test naming: `{method}-{Condition}-{ExpectedResult}` (constitution Principle II).
- Iris animation duration: `IRIS_DURATION_SECONDS = 1.75` (user asked for "slower",
  in the 1.5–2s range).
- Restart trigger: any keyboard key OR a click on the canvas (default chosen per
  the design discussion; flag to the user if this should be narrower).
- Collected facts (none exist yet — later roadmap steps add them) are preserved
  across a death/restart; only health and position reset. Do not build fact-clearing
  logic here — that's step 15's "Reset Game" button, a different trigger.
- Branch: work happens on `S-006-step10-respawn` (already created off
  `S-006-platformer-theme`), per the roadmap's branch-per-step working agreement.
  PR target is `S-006-platformer-theme`, not `main`.

---

## Task 1: `IrisTransition.ts` — pure radius math

**Files:**
- Create: `src/themes/platformer/engine/IrisTransition.ts`
- Test: `src/themes/platformer/engine/IrisTransition.test.ts`

**Interfaces:**
- Produces: `IRIS_DURATION_SECONDS: number`, `maxIrisRadius(canvasWidth: number, canvasHeight: number, centerX: number, centerY: number): number`, `irisRadius(progress: number, maxRadius: number, direction: 'in' | 'out'): number`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { IRIS_DURATION_SECONDS, maxIrisRadius, irisRadius } from './IrisTransition';

describe('maxIrisRadius', () => {
  it('centerAtOrigin-returns-distanceToFarthestCorner', () => {
    expect(maxIrisRadius(100, 100, 0, 0)).toBeCloseTo(Math.sqrt(100 * 100 + 100 * 100));
  });

  it('centerAtMiddle-returns-halfDiagonal', () => {
    expect(maxIrisRadius(200, 100, 100, 50)).toBeCloseTo(Math.sqrt(100 * 100 + 50 * 50));
  });

  it('centerOffCanvas-usesFarthestEdgeDistance', () => {
    // Center past the right/bottom edge: the farthest corner is top-left (0,0).
    expect(maxIrisRadius(100, 100, 150, 150)).toBeCloseTo(Math.sqrt(150 * 150 + 150 * 150));
  });
});

describe('irisRadius', () => {
  it('directionIn-progressZero-returnsZero', () => {
    expect(irisRadius(0, 500, 'in')).toBe(0);
  });

  it('directionIn-progressOne-returnsMaxRadius', () => {
    expect(irisRadius(1, 500, 'in')).toBe(500);
  });

  it('directionIn-progressHalf-returnsHalfMaxRadius', () => {
    expect(irisRadius(0.5, 500, 'in')).toBe(250);
  });

  it('directionOut-progressZero-returnsMaxRadius', () => {
    expect(irisRadius(0, 500, 'out')).toBe(500);
  });

  it('directionOut-progressOne-returnsZero', () => {
    expect(irisRadius(1, 500, 'out')).toBe(0);
  });

  it('directionOut-progressHalf-returnsHalfMaxRadius', () => {
    expect(irisRadius(0.5, 500, 'out')).toBe(250);
  });

  it('progressBeyondOne-clampsToOne', () => {
    expect(irisRadius(1.5, 500, 'in')).toBe(500);
  });

  it('progressBelowZero-clampsToZero', () => {
    expect(irisRadius(-0.5, 500, 'in')).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/IrisTransition.test.ts`
Expected: FAIL — `Cannot find module './IrisTransition'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
/**
 * Seconds the iris-in (grow, game start/restart) and iris-out (shrink, death)
 * animations each take. Chosen for a deliberately slow, dramatic beat rather
 * than a snappy transition.
 */
export const IRIS_DURATION_SECONDS = 1.75;

/**
 * The radius a circle centered at (centerX, centerY) needs to fully cover a
 * canvasWidth x canvasHeight rectangle — the distance to the farthest corner,
 * computed without enumerating all four corners: the farthest corner is
 * always at the horizontal edge farther from centerX combined with the
 * vertical edge farther from centerY.
 */
export function maxIrisRadius(
  canvasWidth: number,
  canvasHeight: number,
  centerX: number,
  centerY: number,
): number {
  const dx = Math.max(centerX, canvasWidth - centerX);
  const dy = Math.max(centerY, canvasHeight - centerY);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Circle radius at a given point in the animation. `progress` (0-1, clamped)
 * is elapsed time / IRIS_DURATION_SECONDS. `'in'` (game start/restart) grows
 * 0 -> maxRadius; `'out'` (death) shrinks maxRadius -> 0.
 */
export function irisRadius(
  progress: number,
  maxRadius: number,
  direction: 'in' | 'out',
): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return direction === 'in' ? clamped * maxRadius : (1 - clamped) * maxRadius;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/IrisTransition.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/IrisTransition.ts src/themes/platformer/engine/IrisTransition.test.ts
git commit -m "feat(platformer): add iris transition radius math"
```

---

## Task 2: `GameLifecycle.ts` — phase state machine

**Files:**
- Create: `src/themes/platformer/engine/GameLifecycle.ts`
- Test: `src/themes/platformer/engine/GameLifecycle.test.ts`

**Interfaces:**
- Consumes: `IRIS_DURATION_SECONDS: number`, `irisRadius(progress: number, maxRadius: number, direction: 'in' | 'out'): number` from `./IrisTransition` (Task 1).
- Produces: `type GamePhase = 'intro' | 'playing' | 'dying' | 'awaitingRestart'`, `interface LifecycleState { phase: GamePhase; elapsed: number; centerX: number; centerY: number }`, `introState(centerX: number, centerY: number): LifecycleState`, `startDeath(centerX: number, centerY: number): LifecycleState`, `tickLifecycle(state: LifecycleState, dt: number): LifecycleState`, `currentIrisRadius(state: LifecycleState, maxRadius: number): number | null`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { introState, startDeath, tickLifecycle, currentIrisRadius } from './GameLifecycle';
import type { LifecycleState } from './GameLifecycle';
import { IRIS_DURATION_SECONDS } from './IrisTransition';

describe('introState', () => {
  it('called-returns-introPhaseAtZeroElapsedWithGivenCenter', () => {
    expect(introState(10, 20)).toEqual({ phase: 'intro', elapsed: 0, centerX: 10, centerY: 20 });
  });
});

describe('startDeath', () => {
  it('called-returns-dyingPhaseAtZeroElapsedWithGivenCenter', () => {
    expect(startDeath(30, 40)).toEqual({ phase: 'dying', elapsed: 0, centerX: 30, centerY: 40 });
  });
});

describe('tickLifecycle', () => {
  it('introPhase-beforeDuration-advancesElapsedStaysIntro', () => {
    const next = tickLifecycle(introState(0, 0), 0.5);
    expect(next.phase).toBe('intro');
    expect(next.elapsed).toBe(0.5);
  });

  it('introPhase-elapsedReachesDuration-transitionsToPlaying', () => {
    const next = tickLifecycle(introState(0, 0), IRIS_DURATION_SECONDS);
    expect(next.phase).toBe('playing');
  });

  it('introPhase-elapsedExceedsDuration-transitionsToPlaying', () => {
    const next = tickLifecycle(introState(0, 0), IRIS_DURATION_SECONDS + 1);
    expect(next.phase).toBe('playing');
  });

  it('dyingPhase-beforeDuration-advancesElapsedStaysDying', () => {
    const next = tickLifecycle(startDeath(0, 0), 0.5);
    expect(next.phase).toBe('dying');
    expect(next.elapsed).toBe(0.5);
  });

  it('dyingPhase-elapsedReachesDuration-transitionsToAwaitingRestart', () => {
    const next = tickLifecycle(startDeath(0, 0), IRIS_DURATION_SECONDS);
    expect(next.phase).toBe('awaitingRestart');
  });

  it('playingPhase-ticked-returnsSameReference', () => {
    const state: LifecycleState = { phase: 'playing', elapsed: 0, centerX: 0, centerY: 0 };
    expect(tickLifecycle(state, 1)).toBe(state);
  });

  it('awaitingRestartPhase-ticked-returnsSameReference', () => {
    const state: LifecycleState = { phase: 'awaitingRestart', elapsed: 0, centerX: 0, centerY: 0 };
    expect(tickLifecycle(state, 1)).toBe(state);
  });
});

describe('currentIrisRadius', () => {
  it('playingPhase-returns-null', () => {
    const state: LifecycleState = { phase: 'playing', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBeNull();
  });

  it('awaitingRestartPhase-returns-zero', () => {
    const state: LifecycleState = { phase: 'awaitingRestart', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBe(0);
  });

  it('introPhase-halfwayElapsed-returnsHalfMaxRadius', () => {
    const state: LifecycleState = {
      phase: 'intro',
      elapsed: IRIS_DURATION_SECONDS / 2,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo(250);
  });

  it('dyingPhase-halfwayElapsed-returnsHalfMaxRadius', () => {
    const state: LifecycleState = {
      phase: 'dying',
      elapsed: IRIS_DURATION_SECONDS / 2,
      centerX: 0,
      centerY: 0,
    };
    expect(currentIrisRadius(state, 500)).toBeCloseTo(250);
  });

  it('introPhase-zeroElapsed-returnsZero', () => {
    const state: LifecycleState = { phase: 'intro', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBe(0);
  });

  it('dyingPhase-zeroElapsed-returnsMaxRadius', () => {
    const state: LifecycleState = { phase: 'dying', elapsed: 0, centerX: 0, centerY: 0 };
    expect(currentIrisRadius(state, 500)).toBe(500);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/GameLifecycle.test.ts`
Expected: FAIL — `Cannot find module './GameLifecycle'`.

- [ ] **Step 3: Write the implementation**

```typescript
import { IRIS_DURATION_SECONDS, irisRadius } from './IrisTransition';

/**
 * `intro`: circle growing open at game start/restart (non-blocking — see
 * this plan's Architecture note; physics still runs underneath).
 * `playing`: normal gameplay, no overlay drawn.
 * `dying`: circle shrinking closed on death, game loop paused.
 * `awaitingRestart`: fully black, "Press any button to restart" shown,
 * game loop paused, waiting for input.
 */
export type GamePhase = 'intro' | 'playing' | 'dying' | 'awaitingRestart';

export interface LifecycleState {
  phase: GamePhase;
  /** Seconds elapsed within the current 'intro'/'dying' animation. Frozen
   *  (not advanced) once 'playing' or 'awaitingRestart' is reached. */
  elapsed: number;
  /** World-space point (not screen-space — the caller adds camera offset at
   *  render time, matching Renderer.ts's originX/originY convention) the
   *  iris circle is centered on for the current animation. */
  centerX: number;
  centerY: number;
}

export function introState(centerX: number, centerY: number): LifecycleState {
  return { phase: 'intro', elapsed: 0, centerX, centerY };
}

export function startDeath(centerX: number, centerY: number): LifecycleState {
  return { phase: 'dying', elapsed: 0, centerX, centerY };
}

/**
 * Advances `elapsed` by `dt` seconds for the two time-driven phases,
 * transitioning 'intro' -> 'playing' and 'dying' -> 'awaitingRestart' once
 * IRIS_DURATION_SECONDS is reached or exceeded. No-op (same reference
 * returned) for 'playing'/'awaitingRestart', which have no timer running.
 */
export function tickLifecycle(state: LifecycleState, dt: number): LifecycleState {
  if (state.phase !== 'intro' && state.phase !== 'dying') return state;
  const elapsed = state.elapsed + dt;
  if (elapsed >= IRIS_DURATION_SECONDS) {
    return {
      ...state,
      elapsed: IRIS_DURATION_SECONDS,
      phase: state.phase === 'intro' ? 'playing' : 'awaitingRestart',
    };
  }
  return { ...state, elapsed };
}

/**
 * Circle radius to draw for the current phase, or `null` when 'playing'
 * (no overlay drawn at all — the caller should skip the draw call entirely
 * rather than draw a full-radius, fully-transparent circle every frame).
 */
export function currentIrisRadius(state: LifecycleState, maxRadius: number): number | null {
  if (state.phase === 'playing') return null;
  if (state.phase === 'awaitingRestart') return 0;
  const progress = state.elapsed / IRIS_DURATION_SECONDS;
  return state.phase === 'intro'
    ? irisRadius(progress, maxRadius, 'in')
    : irisRadius(progress, maxRadius, 'out');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/GameLifecycle.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/GameLifecycle.ts src/themes/platformer/engine/GameLifecycle.test.ts
git commit -m "feat(platformer): add death/respawn phase state machine"
```

---

## Task 3: `Renderer.ts` — iris overlay + restart prompt draw functions

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`
- Modify: `src/test/setup.ts` (the shared jsdom canvas 2D context mock needs the
  new methods these functions call, or every existing `PlatformerPage.test.tsx`
  test breaks — see explanation in Step 1 below)

**Interfaces:**
- Produces: `drawIrisOverlay(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, centerX: number, centerY: number, radius: number): void`, `drawRestartPrompt(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void`.

- [ ] **Step 1: Extend the shared canvas mock in `src/test/setup.ts`**

`src/themes/platformer/PlatformerPage.tsx`'s `render()` will call the new draw
functions on every frame once `PlatformerPage.tsx` is wired up in Task 5 (the
`intro` phase is active by default from mount, so this fires immediately on
every existing `PlatformerPage.test.tsx` test, not just new ones). The shared
mock 2D context in `src/test/setup.ts` is missing `rect`, `arc`, `fill`, and
`fillText` — without them, calling those methods throws inside `render()` and
breaks the whole existing `PlatformerPage.test.tsx` suite. Add them now, before
writing `Renderer.test.ts`'s new tests, which also rely on this shared mock
being complete.

Edit `src/test/setup.ts`'s mock context object to add:

```typescript
      rect: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      font: '',
      textAlign: '',
      textBaseline: '',
```

(alongside the existing `fillRect`, `beginPath`, `moveTo`, etc. — insert these
new lines into the same object literal, e.g. right after the existing
`lineTo: vi.fn(),` line.)

This step has no separate test — its correctness is verified by the existing
`PlatformerPage.test.tsx` suite still passing after Task 5 wires in the new
draw calls. Run the full suite now to confirm nothing is broken yet (it
shouldn't be, since nothing calls the new mock methods until Task 5):

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS (unchanged — this step only adds unused mock methods so far).

- [ ] **Step 2: Write the failing tests for the new draw functions**

Add to `src/themes/platformer/engine/Renderer.test.ts`. First, extend the file's
existing `makeMockContext()` helper (near the top) to include the new methods,
matching the `src/test/setup.ts` additions above:

```typescript
function makeMockContext() {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    drawImage: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}
```

Then add these test blocks (import `drawIrisOverlay, drawRestartPrompt` in the
existing `import { drawTerrain, drawPlayer, drawHearts } from './Renderer';`
line at the top of the file):

```typescript
describe('drawIrisOverlay', () => {
  it('positiveRadius-fillsRectAndCutsCircularHoleWithEvenOdd', () => {
    const ctx = makeMockContext() as unknown as {
      rect: ReturnType<typeof vi.fn>;
      moveTo: ReturnType<typeof vi.fn>;
      arc: ReturnType<typeof vi.fn>;
      fill: ReturnType<typeof vi.fn>;
    };

    drawIrisOverlay(ctx as unknown as CanvasRenderingContext2D, 800, 600, 400, 300, 100);

    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.arc).toHaveBeenCalledWith(400, 300, 100, 0, Math.PI * 2, true);
    expect(ctx.fill).toHaveBeenCalledWith('evenodd');
  });

  it('zeroRadius-fillsRectWithoutDrawingCircle', () => {
    const ctx = makeMockContext() as unknown as {
      rect: ReturnType<typeof vi.fn>;
      arc: ReturnType<typeof vi.fn>;
      fill: ReturnType<typeof vi.fn>;
    };

    drawIrisOverlay(ctx as unknown as CanvasRenderingContext2D, 800, 600, 400, 300, 0);

    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith('evenodd');
  });
});

describe('drawRestartPrompt', () => {
  it('called-drawsPromptTextCenteredOnCanvas', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

    drawRestartPrompt(ctx as unknown as CanvasRenderingContext2D, 800, 600);

    expect(ctx.fillText).toHaveBeenCalledWith('Press any button to restart', 400, 300);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `drawIrisOverlay`/`drawRestartPrompt` are not exported from
`./Renderer` yet.

- [ ] **Step 4: Write the implementation**

Add to `src/themes/platformer/engine/Renderer.ts` (after `drawHearts`):

```typescript
/**
 * Paints solid black over the whole canvas except a circular hole of
 * `radius` centered on (centerX, centerY), using the canvas 2D API's
 * even-odd fill rule on two subpaths (the full-canvas rect, then the
 * circle) instead of an offscreen buffer + composite-operation punch —
 * simpler and avoids an extra canvas. `centerX`/`centerY` are screen-space
 * (caller adds the camera originX/originY, matching drawTerrain/drawPlayer's
 * convention). `radius <= 0` draws solid black with no hole at all — the
 * `awaitingRestart` phase and the very start of a death both rely on this.
 */
export function drawIrisOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  if (radius > 0) {
    ctx.moveTo(centerX + radius, centerY);
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
  }
  ctx.fill('evenodd');
  ctx.restore();
}

const RESTART_PROMPT_TEXT = 'Press any button to restart';

/** Draws the death-screen restart prompt, centered on the canvas. Only ever
 *  drawn on top of a fully-closed drawIrisOverlay (radius 0), so no
 *  background/contrast handling is needed here. */
export function drawRestartPrompt(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(RESTART_PROMPT_TEXT, canvasWidth / 2, canvasHeight / 2);
  ctx.restore();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS (all cases, old and new, green).

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts src/test/setup.ts
git commit -m "feat(platformer): add iris overlay and restart prompt rendering"
```

---

## Task 4: `PlatformerState.ts` — export spawn helpers + `lifecycleState` signal

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Modify: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `introState(centerX: number, centerY: number): LifecycleState` from `./engine/GameLifecycle` (Task 2).
- Produces: `spawnPlayerState(): PlayerState` (renamed from the previously-private `initialPlayerState`, now exported — `resetGame` below needs to reset `playerState` back to spawn), `spawnCenter(): { x: number; y: number }` (world-space center point of the spawned player, for centering the iris), `lifecycleState: Signal<LifecycleState>` (new signal, initialized via `introState(spawnCenter().x, spawnCenter().y)`), `resetGame(): void` (resets `playerState`/`healthState`/`cameraPositionX` to their spawn values — the single place Task 5's restart-on-input and debug-Respawn-button logic both call, and the natural extension point for later roadmap steps that also need a full reset: step 10's death respawn already covered by this task, and step 15's "Reset Game" button, which will additionally need to clear collected facts and respawn enemies/coins/blocks once those exist — not built here, just the seam this task leaves for them).

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/PlatformerState.test.ts` (add `lifecycleState,
spawnPlayerState, spawnCenter, resetGame` to the existing `import {
playerState, cameraPositionX, healthState } from './PlatformerState';` line
— `MAX_HALF_HEARTS` is already imported by the existing `import {
MAX_HALF_HEARTS } from './entities/Health';` line, no change needed there):

```typescript
  it('spawnPlayerState-called-matchesPlayerStateInitialValue', () => {
    // spawnPlayerState() must be pure/deterministic so restart logic (Task 5)
    // can call it again later and get the exact same spawn position.
    expect(spawnPlayerState()).toEqual(playerState.value);
  });

  it('spawnCenter-called-isSpawnPlayerTopLeftPlusHalfRenderedSize', () => {
    const spawn = spawnPlayerState();
    const center = spawnCenter();
    expect(center.x).toBe(spawn.x + PLAYER_RENDERED_SIZE / 2);
    expect(center.y).toBe(spawn.y + PLAYER_RENDERED_SIZE / 2);
  });

  it('lifecycleState-initial-isIntroPhaseCenteredOnSpawnPlayer', () => {
    const center = spawnCenter();
    expect(lifecycleState.value.phase).toBe('intro');
    expect(lifecycleState.value.elapsed).toBe(0);
    expect(lifecycleState.value.centerX).toBe(center.x);
    expect(lifecycleState.value.centerY).toBe(center.y);
  });

  it('resetGame-calledAfterMutation-restoresSpawnHealthAndZeroCamera', () => {
    playerState.value = { ...playerState.value, x: 999, y: 999, vx: 5 };
    healthState.value = 0;
    cameraPositionX.value = 300;

    resetGame();

    expect(playerState.value).toEqual(spawnPlayerState());
    expect(healthState.value).toBe(MAX_HALF_HEARTS);
    expect(cameraPositionX.value).toBe(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: FAIL — `spawnPlayerState`, `spawnCenter`, `lifecycleState` are not
exported from `./PlatformerState` yet.

- [ ] **Step 3: Write the implementation**

Replace the whole contents of `src/themes/platformer/PlatformerState.ts` with:

```typescript
import { signal } from '@preact/signals-react';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { SPAWN_TILE } from './level/level1';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from './entities/Player';
import { MAX_HALF_HEARTS } from './entities/Health';
import { introState } from './engine/GameLifecycle';
import type { PlayerState } from './entities/Player';
import type { LifecycleState } from './engine/GameLifecycle';

/**
 * The player's state at the level's spawn point — full health's worth of
 * idle standing on the ground. Exported (not just used once for the initial
 * signal value) because restart logic (PlatformerPage.tsx, wired in a later
 * task) calls this again to reset `playerState` back to spawn after a death.
 */
export function spawnPlayerState(): PlayerState {
  // SPAWN_TILE is the empty cell the character stands in (see level1.ts's
  // `S` marker) — the ground surface is that cell's bottom edge.
  const spawnCell = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
  const groundSurfaceY = spawnCell.y + RENDERED_TILE_SIZE;
  const x = spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
  const y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 'right',
    grounded: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
  };
}

/** Player position/animation state — mutated by the game loop (added in later steps). */
export const playerState = signal<PlayerState>(spawnPlayerState());

/**
 * Camera's horizontal scroll offset in rendered pixels — the world-space x
 * of the viewport's left edge. 0 at level start, increases rightward.
 * Updated once per game-loop tick (see PlatformerPage.tsx) via
 * Camera.ts's updateCamera; kept separate from playerState so renderer
 * code doesn't need to re-derive it from player position every frame.
 */
export const cameraPositionX = signal(0);

/**
 * Current health in half-heart units (0-MAX_HALF_HEARTS). Kept separate from
 * `playerState` since damage sources (pit falls, and later enemy hits) are a
 * distinct concern from position/animation, and step 10's full-heal-on-death
 * only needs to touch this signal, not reconstruct player position/state.
 */
export const healthState = signal(MAX_HALF_HEARTS);

/**
 * World-space center point (not top-left) of the spawned player — used to
 * center the iris-in transition on the character at game start/restart,
 * matching where the death iris-out is centered (the player's actual visual
 * midpoint, not its collision box's top-left corner).
 */
export function spawnCenter(): { x: number; y: number } {
  const spawn = spawnPlayerState();
  return { x: spawn.x + PLAYER_RENDERED_SIZE / 2, y: spawn.y + PLAYER_RENDERED_SIZE / 2 };
}

/**
 * Death/respawn/intro phase state (see engine/GameLifecycle.ts). Starts in
 * `intro` (circle growing open) centered on the spawned player, the same as
 * what a restart transitions back to.
 */
export const lifecycleState = signal<LifecycleState>(
  introState(spawnCenter().x, spawnCenter().y),
);

/**
 * Resets the game world to its spawn state: player back at the spawn point,
 * full health, camera scrolled back to the level start. Does NOT touch
 * `lifecycleState` — callers (Task 5's restart-on-input and debug Respawn
 * button, both wired to the `intro` iris-in) decide the lifecycle transition
 * themselves, since not every future caller of a "reset" necessarily wants
 * the iris animation (e.g. step 15's "Reset Game" button might not).
 *
 * This is the single reset seam other roadmap steps extend: step 15's
 * "Reset Game" button will additionally need to clear collected facts and
 * respawn enemies/coins/blocks once those exist — this task doesn't build
 * any of that, it only resets what already exists (position, health,
 * camera).
 */
export function resetGame(): void {
  playerState.value = spawnPlayerState();
  healthState.value = MAX_HALF_HEARTS;
  cameraPositionX.value = 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: PASS (all cases, old and new, green).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add lifecycle signal and export spawn helpers"
```

---

## Task 5: `PlatformerPage.tsx` — wire death trigger, pause, overlay render, and restart

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `lifecycleState, spawnCenter, resetGame` from `./PlatformerState` (Task 4); `tickLifecycle, startDeath, introState` from `./engine/GameLifecycle` (Task 2); `maxIrisRadius` from `./engine/IrisTransition` (Task 1); `drawIrisOverlay, drawRestartPrompt` from `./engine/Renderer` (Task 3). Note: `spawnPlayerState` and `MAX_HALF_HEARTS` are NOT imported directly here — both death-recovery paths (restart-on-input and the debug Respawn button) call `resetGame()` instead of reconstructing the reset inline, so this task never needs those two imports.
- Also produces (this task, no downstream consumer): a `?debug=` query-param-gated pair of "Kill"/"Respawn" buttons — manual testing affordances so the death/respawn iris transition can be exercised without navigating pits repeatedly. Reuses the same functions the death-trigger and restart-listener code already wires up (`startDeath`, `introState`, `spawnPlayerState`, `spawnCenter`) — no new imports beyond what's listed above.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/PlatformerPage.test.tsx`. First, extend the
existing imports and the `beforeEach`/snapshot setup at the top of the file so
`lifecycleState` resets between tests exactly like `playerState` already does
(insert `lifecycleState` into the existing import from `./PlatformerState`,
and add the snapshot/reset lines next to the existing `initialPlayerState`
ones):

```typescript
import { playerState, cameraPositionX, healthState, lifecycleState } from './PlatformerState';
```

```typescript
const initialPlayerState = playerState.value;
const initialLifecycleState = lifecycleState.value;
const originalLocation = window.location;

describe('PlatformerPage', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    playerState.value = initialPlayerState;
    cameraPositionX.value = 0;
    healthState.value = MAX_HALF_HEARTS;
    lifecycleState.value = initialLifecycleState;
  });
```

Then add these test blocks at the end of the `describe('PlatformerPage', ...)`
block, right before its closing `});`:

```typescript
  it('healthReachesZero-gameLoopTicks-entersDyingPhaseCenteredOnPlayerAndPausesPhysics', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    // One half-heart of health left; a pit fall (PIT_FALL_DAMAGE = 1) is
    // exactly fatal this tick.
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vx: 0,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };

    frameCallback!(16);

    expect(healthState.value).toBe(0);
    expect(lifecycleState.value.phase).toBe('dying');
    expect(lifecycleState.value.centerX).toBe(playerState.value.x + PLAYER_RENDERED_SIZE / 2);
    expect(lifecycleState.value.centerY).toBe(playerState.value.y + PLAYER_RENDERED_SIZE / 2);

    const frozenX = playerState.value.x;
    const frozenY = playerState.value.y;
    frameCallback!(32); // physics must stay paused while dying
    expect(playerState.value.x).toBe(frozenX);
    expect(playerState.value.y).toBe(frozenY);
  });

  it('dyingPhase-durationElapses-transitionsToAwaitingRestart', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };
    frameCallback!(16);
    expect(lifecycleState.value.phase).toBe('dying');

    let t = 16;
    for (let i = 0; i < 120; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(lifecycleState.value.phase).toBe('awaitingRestart');
  });

  it('awaitingRestartPhase-anyKeyPressed-resetsHealthAndPositionAndReturnsToIntroAtSpawn', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };
    frameCallback!(16);
    let t = 16;
    for (let i = 0; i < 120; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(lifecycleState.value.phase).toBe('awaitingRestart');

    fireEvent.keyDown(window, { code: 'Enter' });

    expect(healthState.value).toBe(MAX_HALF_HEARTS);
    expect(lifecycleState.value.phase).toBe('intro');
    expect(playerState.value.x).toBe(initialPlayerState.x);
    expect(playerState.value.y).toBe(initialPlayerState.y);
    expect(cameraPositionX.value).toBe(0);
  });

  it('awaitingRestartPhase-canvasClicked-alsoTriggersRestart', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };
    frameCallback!(16);
    let t = 16;
    for (let i = 0; i < 120; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(lifecycleState.value.phase).toBe('awaitingRestart');

    const canvas = screen.getByTestId('platformer-canvas');
    fireEvent.click(canvas);

    expect(lifecycleState.value.phase).toBe('intro');
    expect(healthState.value).toBe(MAX_HALF_HEARTS);
  });

  it('keyPressedWhilePlaying-doesNotTriggerRestart', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);
    expect(lifecycleState.value.phase).not.toBe('awaitingRestart');

    fireEvent.keyDown(window, { code: 'Enter' });

    expect(healthState.value).toBe(MAX_HALF_HEARTS); // unchanged, no restart happened
  });

  it('debugQueryParamAbsent-render-doesNotShowKillOrRespawnButtons', () => {
    render(<PlatformerPage />);

    expect(screen.queryByRole('button', { name: 'Kill' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Respawn' })).not.toBeInTheDocument();
  });

  it('debugQueryParamPresent-render-showsKillAndRespawnButtons', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });

    render(<PlatformerPage />);

    expect(screen.getByRole('button', { name: 'Kill' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Respawn' })).toBeInTheDocument();
  });

  it('killButtonClicked-whilePlaying-setsHealthZeroAndEntersDyingPhase', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);

    fireEvent.click(screen.getByRole('button', { name: 'Kill' }));

    expect(healthState.value).toBe(0);
    expect(lifecycleState.value.phase).toBe('dying');
    expect(lifecycleState.value.centerX).toBe(playerState.value.x + PLAYER_RENDERED_SIZE / 2);
    expect(lifecycleState.value.centerY).toBe(playerState.value.y + PLAYER_RENDERED_SIZE / 2);
  });

  it('respawnButtonClicked-anyPhase-resetsHealthPositionAndEntersIntroAtSpawn', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);
    playerState.value = { ...playerState.value, x: 999, y: 999 };
    healthState.value = 0;

    fireEvent.click(screen.getByRole('button', { name: 'Respawn' }));

    expect(healthState.value).toBe(MAX_HALF_HEARTS);
    expect(lifecycleState.value.phase).toBe('intro');
    expect(playerState.value.x).toBe(initialPlayerState.x);
    expect(playerState.value.y).toBe(initialPlayerState.y);
    expect(cameraPositionX.value).toBe(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — health never reaches 0 / `lifecycleState.value.phase` never
becomes `'dying'`/`'awaitingRestart'` today (no wiring exists yet), and the
`Enter`/click restart handlers don't exist yet.

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/PlatformerPage.tsx`:

Update the imports:

```typescript
import { useEffect, useRef } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { loadImage } from './engine/SpriteLoader';
import { drawTerrain, drawPlayer, drawHearts, drawIrisOverlay, drawRestartPrompt } from './engine/Renderer';
import { drawDebugOverlay } from './engine/DebugOverlay';
import { createGameLoop } from './engine/GameLoop';
import { stepPlayerPhysics, checkPitFall, resolvePitFall } from './engine/Physics';
import { updateCamera } from './engine/Camera';
import { createKeyboardInput } from './engine/Input';
import { tickLifecycle, startDeath, introState, currentIrisRadius } from './engine/GameLifecycle';
import { maxIrisRadius } from './engine/IrisTransition';
import { level1 } from './level/level1';
import { RENDERED_TILE_SIZE } from './level/Terrain';
import { advancePlayerAnimation, updatePlayerAnimState, PLAYER_RENDERED_SIZE } from './entities/Player';
import { takeDamage, PIT_FALL_DAMAGE } from './entities/Health';
import { playerState, cameraPositionX, healthState, lifecycleState, spawnCenter, resetGame } from './PlatformerState';
```

Find the existing `debugHitboxes` line (component body, before the
`useEffect`):

```typescript
  const debugHitboxes = new URLSearchParams(window.location.search).get('debug') === 'hitboxes';
```

Replace it with a shared `URLSearchParams` read plus a general "any `debug`
param present" flag, keeping `debugHitboxes`'s existing exact-match behavior
unchanged:

```typescript
  const debugParams = new URLSearchParams(window.location.search);
  const debugHitboxes = debugParams.get('debug') === 'hitboxes';
  // Any `debug` param (not just `hitboxes`) shows the manual Kill/Respawn
  // testing buttons below — they're a dev convenience for exercising the
  // death/respawn iris transition without navigating pits repeatedly, not a
  // feature end users should see.
  const debugControls = debugParams.has('debug');
```

Immediately after that, add two click handlers. These read/write the shared
signals directly (`playerState`, `healthState`, `cameraPositionX`,
`lifecycleState`) — they don't need anything from inside the `useEffect`'s
canvas closure, since signals are accessible anywhere the module is
imported:

```typescript
  const handleDebugKill = () => {
    healthState.value = 0;
    const p = playerState.value;
    lifecycleState.value = startDeath(p.x + PLAYER_RENDERED_SIZE / 2, p.y + PLAYER_RENDERED_SIZE / 2);
  };

  const handleDebugRespawn = () => {
    resetGame();
    const center = spawnCenter();
    lifecycleState.value = introState(center.x, center.y);
  };
```

Finally, add the buttons to the JSX return, gated on `debugControls`. Replace:

```typescript
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" tabIndex={-1} />
      <FloatingControls />
    </div>
  );
};
```

with:

```typescript
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" tabIndex={-1} />
      <FloatingControls />
      {debugControls && (
        <div className="absolute bottom-4 left-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={handleDebugKill}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white"
          >
            Kill
          </button>
          <button
            type="button"
            onClick={handleDebugRespawn}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white"
          >
            Respawn
          </button>
        </div>
      )}
    </div>
  );
};
```

Inside `render()`, add the overlay draw right after the existing
`drawHearts` block (which stays a fixed-screen-position draw, unaffected):

```typescript
      if (heartsSpriteRef.current) {
        drawHearts(ctx, healthState.value, heartsSpriteRef.current);
      }

      // Iris overlay: drawn on top of everything else whenever the current
      // phase isn't 'playing'. centerX/centerY are stored world-space (see
      // GameLifecycle.ts) so they're converted to screen-space here with the
      // same originX/originY already used for terrain/player, keeping them
      // aligned even if the canvas resizes mid-pause.
      const lifecycle = lifecycleState.value;
      if (lifecycle.phase !== 'playing') {
        const centerX = lifecycle.centerX + originX;
        const centerY = lifecycle.centerY + originY;
        const maxRadius = maxIrisRadius(canvas.width, canvas.height, centerX, centerY);
        const radius = currentIrisRadius(lifecycle, maxRadius) ?? 0;
        drawIrisOverlay(ctx, canvas.width, canvas.height, centerX, centerY, radius);
        if (lifecycle.phase === 'awaitingRestart') {
          drawRestartPrompt(ctx, canvas.width, canvas.height);
        }
      }
```

Replace the `createGameLoop` tick callback's body — wrap the existing
physics/animation/camera logic in a phase check, and add the death trigger
+ lifecycle ticking at the end:

```typescript
    const loop = createGameLoop((dt) => {
      // 'dying' and 'awaitingRestart' pause the game loop entirely — no
      // physics/input processing, just advancing (dying) or holding
      // (awaitingRestart) the iris animation and re-rendering.
      if (lifecycleState.value.phase === 'dying') {
        lifecycleState.value = tickLifecycle(lifecycleState.value, dt);
        render();
        return;
      }
      if (lifecycleState.value.phase === 'awaitingRestart') {
        render();
        return;
      }

      // A/D accepted as an alternate to Arrow Left/Right (FR-007 only
      // requires arrows; this is an additive convenience, not a replacement).
      const horizontal = {
        left: input.isHeld('ArrowLeft') || input.isHeld('KeyA'),
        right: input.isHeld('ArrowRight') || input.isHeld('KeyD'),
      };
      // Both must be evaluated (not short-circuited) since consumePress has
      // the side effect of clearing the pending press it finds.
      const spacePressed = input.consumePress('Space');
      const arrowUpPressed = input.consumePress('ArrowUp');
      const jumpPressed = spacePressed || arrowUpPressed;
      const jumpHeld = input.isHeld('Space') || input.isHeld('ArrowUp');
      const dropThroughHeld = input.isHeld('ArrowDown') || input.isHeld('KeyS');

      let next = stepPlayerPhysics(playerState.value, level1, dt, {
        ...horizontal,
        jumpPressed,
        jumpHeld,
        dropThroughHeld,
      });

      if (checkPitFall(next, level1)) {
        healthState.value = takeDamage(healthState.value, PIT_FALL_DAMAGE);
        next = resolvePitFall(next);
      }

      // Runs after the pit-fall check so `animState` is always derived from
      // the frame's FINAL `grounded` value — otherwise a pit-fall recovery
      // would render one frame of a stale fall/jump animation at the
      // recovered position before the next tick corrected it.
      next = updatePlayerAnimState(next);
      next = advancePlayerAnimation(next, dt);

      playerState.value = next;

      const levelPixelWidth = level1.width * RENDERED_TILE_SIZE;
      cameraPositionX.value = updateCamera(
        cameraPositionX.value,
        next.x,
        PLAYER_RENDERED_SIZE,
        canvas.width,
        levelPixelWidth,
      );

      // Death check: whatever the damage source (today, only repeated pit
      // falls), 0 health starts the death iris centered on wherever the
      // player ended up this frame. Otherwise, keep advancing 'intro' (a
      // no-op once already 'playing' — see GameLifecycle.ts's tickLifecycle).
      if (healthState.value === 0) {
        lifecycleState.value = startDeath(
          next.x + PLAYER_RENDERED_SIZE / 2,
          next.y + PLAYER_RENDERED_SIZE / 2,
        );
      } else {
        lifecycleState.value = tickLifecycle(lifecycleState.value, dt);
      }

      render();
    });
    loop.start();
```

Add the restart listener right after `const input = createKeyboardInput();`
(before `const loop = createGameLoop(...)`):

```typescript
    const input = createKeyboardInput();

    /**
     * Any key or a canvas click restarts the game while 'awaitingRestart' —
     * full health, spawn position, back to the 'intro' iris-in. No-op in
     * every other phase (checked first) so this can't fire mid-gameplay.
     */
    const restartIfAwaiting = () => {
      if (lifecycleState.value.phase !== 'awaitingRestart') return;
      resetGame();
      const center = spawnCenter();
      lifecycleState.value = introState(center.x, center.y);
      render();
    };
    window.addEventListener('keydown', restartIfAwaiting);
    canvas.addEventListener('click', restartIfAwaiting);
```

Update the effect's cleanup function to remove the two new listeners:

```typescript
    return () => {
      cancelled = true;
      loop.stop();
      input.destroy();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', restartIfAwaiting);
      canvas.removeEventListener('click', restartIfAwaiting);
    };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS (all cases, old and new, green).

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS — every existing test in the repo, not just the platformer
theme's, still passes (in particular, re-confirm nothing outside
`src/themes/platformer/` touches `src/test/setup.ts`'s canvas mock in a way
this change could break — none should, but this is a shared file).

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): wire death/respawn iris transition into the game loop"
```

---

## Task 6: Manual browser verification + roadmap checkoff

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Manual browser check**

Start the dev server and open the Platformer theme at `?debug=hitboxes` (or
any `debug=` value) so the Kill/Respawn debug buttons from Task 5 are visible
— they make this pass much faster than navigating pits repeatedly. Verify:

1. On first load, a black circle grows from small to large centered on the
   character, revealing the level (the `intro` phase).
2. Click "Kill" (or walk into a pit repeatedly — health starts at
   `MAX_HALF_HEARTS = 6`, each pit fall costs `PIT_FALL_DAMAGE = 1` — until
   health reaches 0).
3. On the fatal pit fall, a black circle shrinks from large to small centered
   on the character, and the game visibly stops responding to input during
   the shrink.
4. Once fully closed, "Press any button to restart" appears on a black screen.
5. Press any key (or click the canvas) — the level resets: character back at
   the spawn point, hearts full (3/3), and the circle grows open again from
   small to large centered on the character at spawn (the same intro
   animation as step 1).
6. Confirm the floating theme/locale controls in the top-right still work
   throughout (they're unaffected by this change, but worth a sanity check
   given they overlay the same canvas).
7. Click "Respawn" at any point (mid-gameplay, or during `dying`/
   `awaitingRestart`) — confirm it immediately resets health/position/camera
   and plays the same intro iris-in, regardless of the phase it was clicked
   from.
8. Reload the page without any `debug=` param and confirm the Kill/Respawn
   buttons are gone.

- [ ] **Step 2: Check off roadmap step 10**

In `specs/S-006-platformer-theme/roadmap.md`, change:

```markdown
- [ ] **10. Respawn** — at 0 health, the character respawns at the nearest spawn
```

to:

```markdown
- [x] **10. Respawn** — at 0 health, the character respawns at the nearest spawn
```

- [ ] **Step 3: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): check off roadmap step 10 (respawn) — verified in browser"
```

---

## After this plan

Per the roadmap's branch strategy, open a PR from `S-006-step10-respawn` into
`S-006-platformer-theme` (not `main`) once all tasks are done and verified.
