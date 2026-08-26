# Platformer Step 4 — Gravity + Solid Collision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the platformer player character gravity and solid-tile collision — it
rests on platforms and falls into pits — driven by a `requestAnimationFrame` game loop
that also advances the player's idle animation. No keyboard input yet (that's step 5).

**Architecture:** A pure `stepPlayerPhysics(player, level, dt)` function (tunable via a
`PHYSICS_CONFIG` object) applies gravity to the player's vertical velocity each frame,
moves it, and resolves collision against the level's solid tiles using the `isSolid`/
`tileAt` helpers already in `Terrain.ts`. A framework-agnostic `createGameLoop(onTick)`
wraps `requestAnimationFrame` with delta-time in seconds (capped, so a backgrounded tab
doesn't produce a huge catch-up jump). `PlatformerPage` starts the loop in its mount
`useEffect` and stops it in the cleanup function — since `PlatformerPage` itself only
mounts while `currentTheme.value === 'platformer'` (see `App.tsx`'s `themePages` map),
this means the loop is automatically alive only while the Platformer theme is showing,
with no extra plumbing needed. Each tick calls `stepPlayerPhysics` then
`advancePlayerAnimation` (new — cycles the idle sprite's 4 frames on a timer) and writes
the result back into the existing `playerState` signal, then redraws the canvas.

**Tech Stack:** TypeScript (strict), Vitest + React Testing Library + jsdom,
`@preact/signals-react` for `playerState`.

**Spec:** `specs/S-006-platformer-theme/spec.md` (FR-002 game loop, FR-006 physics,
FR-027 `requestAnimationFrame`, FR-030 file layout, FR-031 player state shape) and
`specs/S-006-platformer-theme/roadmap.md` step 4.

## Global Constraints

- TDD is mandatory: write the failing test before the implementation for every task
  (constitution Principle II).
- 100% coverage target for `src/lib/`-equivalent pure logic — here, `Physics.ts`,
  `GameLoop.ts`, and the new `Player.ts` functions must be fully covered by unit tests.
- Tests use Vitest + React Testing Library + jsdom; test names follow
  `{method}-{Condition}-{ExpectedResult}` (see existing `Player.test.ts`).
- TypeScript strict mode, no `any`. Named arrow function exports for components (n/a for
  this plan's plain functions/modules, which use named `function`/`const` exports
  matching the existing `Physics`/`Terrain`-style engine files).
- No feature bloat: this plan implements roadmap step 4 only (gravity + collision, no
  input, no jump, no walk animation — those are steps 5–6).
- Branch: create `S-006-step4-gravity-collision` off `S-006-platformer-theme` before
  starting (per the roadmap's branch-per-step working agreement); PR back into
  `S-006-platformer-theme` when done, then delete the step branch.

---

## File Structure

- **Create** `src/themes/platformer/engine/PhysicsConfig.ts` — single exported tunable
  constants object (`gravity`, `terminalVelocity` now; `walkSpeed`, `jumpForce`, etc.
  get added here by steps 5–6 instead of scattering new magic numbers).
- **Create** `src/themes/platformer/engine/Physics.ts` — pure `stepPlayerPhysics`
  function: gravity + vertical solid-tile collision.
- **Create** `src/themes/platformer/engine/GameLoop.ts` — pure `requestAnimationFrame`
  wrapper: `createGameLoop(onTick) => { start(), stop() }`, seconds-based delta time,
  capped.
- **Modify** `src/themes/platformer/entities/Player.ts` — add `vy`, `grounded`,
  `animTimer` to `PlayerState`; add `advancePlayerAnimation` (idle frame cycling).
- **Modify** `src/themes/platformer/PlatformerState.ts` — initialize the three new
  `PlayerState` fields.
- **Modify** `src/themes/platformer/PlatformerPage.tsx` — start/stop the game loop
  across the physics + animation step, tied to component mount/unmount.

---

### Task 1: Player state gains physics fields + idle animation stepping

**Files:**
- Modify: `src/themes/platformer/entities/Player.ts`
- Test: `src/themes/platformer/entities/Player.test.ts`

**Interfaces:**
- Consumes: nothing new (extends the existing `PlayerState` interface and
  `IDLE_FRAME_COUNT` already in this file).
- Produces: `PlayerState` now has `vy: number`, `grounded: boolean`,
  `animTimer: number`. New export `advancePlayerAnimation(player: PlayerState, dt:
  number): PlayerState`. New export `IDLE_FRAME_DURATION: number` (seconds). Later
  tasks (`Physics.ts`, `PlatformerState.ts`, `PlatformerPage.tsx`) rely on these exact
  names and the field set.

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/entities/Player.test.ts` (add these imports to the
existing import block at the top: `advancePlayerAnimation, IDLE_FRAME_DURATION`
alongside the current `playerFrameSource, PLAYER_FRAME_SIZE, PLAYER_RENDERED_SIZE`
import, and `import type { PlayerState } from './Player';`):

```ts
function idlePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vy: 0,
    grounded: true,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    ...overrides,
  };
}

describe('advancePlayerAnimation', () => {
  it('advancePlayerAnimation-belowFrameDuration-accumulatesTimerWithoutAdvancingFrame', () => {
    const next = advancePlayerAnimation(idlePlayer(), IDLE_FRAME_DURATION / 2);
    expect(next.animTimer).toBeCloseTo(IDLE_FRAME_DURATION / 2);
    expect(next.animFrame).toBe(0);
  });

  it('advancePlayerAnimation-reachesFrameDuration-advancesFrameAndCarriesRemainder', () => {
    const next = advancePlayerAnimation(
      idlePlayer({ animTimer: IDLE_FRAME_DURATION - 0.01 }),
      0.02,
    );
    expect(next.animFrame).toBe(1);
    expect(next.animTimer).toBeCloseTo(0.01);
  });

  it('advancePlayerAnimation-lastFrameReachesDuration-wrapsToFrameZero', () => {
    const next = advancePlayerAnimation(
      idlePlayer({ animFrame: 3, animTimer: IDLE_FRAME_DURATION }),
      0,
    );
    expect(next.animFrame).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts`
Expected: FAIL — `advancePlayerAnimation`/`IDLE_FRAME_DURATION` not exported, and/or
`PlayerState` object literals missing `vy`/`grounded`/`animTimer` fail type-checking.

- [ ] **Step 3: Implement**

In `src/themes/platformer/entities/Player.ts`, update the interface and add the new
exports (keep the existing `PLAYER_FRAME_SIZE`, `PLAYER_RENDERED_SIZE`,
`PLAYER_FOOT_PADDING`, `PlayerAnimState`, `IDLE_FRAME_COUNT`, and `playerFrameSource`
exactly as they are):

```ts
export interface PlayerState {
  x: number;
  y: number;
  /** Vertical velocity in px/s. Positive is downward. */
  vy: number;
  /** Whether the player is currently resting on a solid tile. */
  grounded: boolean;
  animState: PlayerAnimState;
  animFrame: number;
  /** Seconds accumulated toward the next animation frame advance. */
  animTimer: number;
}

/** Seconds each idle frame is held before advancing to the next. */
export const IDLE_FRAME_DURATION = 0.15;

/** Advances the player's animation timer/frame by `dt` seconds. */
export function advancePlayerAnimation(player: PlayerState, dt: number): PlayerState {
  switch (player.animState) {
    case 'idle': {
      const animTimer = player.animTimer + dt;
      if (animTimer < IDLE_FRAME_DURATION) {
        return { ...player, animTimer };
      }
      return {
        ...player,
        animTimer: animTimer - IDLE_FRAME_DURATION,
        animFrame: (player.animFrame + 1) % IDLE_FRAME_COUNT,
      };
    }
    default: {
      const _exhaustive: never = player.animState;
      return _exhaustive;
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts`
Expected: PASS (all tests, including the pre-existing `playerFrameSource` ones).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Player.ts src/themes/platformer/entities/Player.test.ts
git commit -m "feat(platformer): add player velocity/grounded state and idle animation stepping"
```

---

### Task 2: Initialize the new player fields in PlatformerState

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `PlayerState` (Task 1) — must supply `vy`, `grounded`, `animTimer` for the
  object literal to type-check.
- Produces: `playerState.value` now includes `vy: 0`, `grounded: false`,
  `animTimer: 0` at initialization. Task 5 relies on this being present before the
  first game-loop tick.

- [ ] **Step 1: Write the failing test**

Append to `src/themes/platformer/PlatformerState.test.ts`:

```ts
it('playerState-initial-hasZeroVelocityAndIsNotYetGrounded', () => {
  expect(playerState.value.vy).toBe(0);
  expect(playerState.value.grounded).toBe(false);
});

it('playerState-initial-hasZeroAnimationTimer', () => {
  expect(playerState.value.animTimer).toBe(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: FAIL (or a TS error) — `vy`/`grounded`/`animTimer` missing from the returned
object.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerState.ts`, update `initialPlayerState`:

```ts
function initialPlayerState(): PlayerState {
  // SPAWN_TILE is the empty cell the character stands in (see level1.ts's
  // `S` marker) — the ground surface is that cell's bottom edge.
  const spawnCell = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
  const groundSurfaceY = spawnCell.y + RENDERED_TILE_SIZE;
  return {
    x: spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2,
    y: groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING,
    vy: 0,
    grounded: false,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
  };
}
```

(Only the return object changes — imports and the rest of the file stay as-is.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): initialize player velocity/grounded/animation-timer state"
```

---

### Task 3: Physics config + gravity/solid-collision

**Files:**
- Create: `src/themes/platformer/engine/PhysicsConfig.ts`
- Create: `src/themes/platformer/engine/Physics.ts`
- Test: `src/themes/platformer/engine/Physics.test.ts`

**Interfaces:**
- Consumes: `PlayerState` (Task 1, needs `x`, `y`, `vy`, `grounded`), `LevelDef`,
  `isSolid`/`tileAt`/`RENDERED_TILE_SIZE` from `../level/Terrain`, `PLAYER_RENDERED_SIZE`
  /`PLAYER_FOOT_PADDING` from `../entities/Player`, `parseLevel` (test only) from
  `../level/level1`.
- Produces: `PHYSICS_CONFIG: { gravity: number; terminalVelocity: number }` (later
  steps add `walkSpeed`, `jumpForce`, etc. to this same object). `stepPlayerPhysics
  (player: PlayerState, level: LevelDef, dt: number): PlayerState` — pure, returns a
  new `PlayerState` with updated `y`, `vy`, `grounded`. Task 5 (`PlatformerPage.tsx`)
  calls this every tick.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/Physics.test.ts`:

```ts
import { stepPlayerPhysics } from './Physics';
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { parseLevel } from '../level/level1';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';

function basePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vy: 0,
    grounded: false,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    ...overrides,
  };
}

// 4 rows tall, 2 cols wide, ground on the bottom row only.
const GROUND_LEVEL = parseLevel(['..', '..', '..', 'GG']);

// Same footprint, no solid tile anywhere — an open pit.
const PIT_LEVEL = parseLevel(['..', '..', '..', '..']);

describe('stepPlayerPhysics', () => {
  it('stepPlayerPhysics-inMidAir-appliesGravityToVelocityAndMovesDown', () => {
    const player = basePlayer({ y: 0, vy: 0 });
    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60);
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.gravity / 60);
    expect(next.y).toBeGreaterThan(player.y);
    expect(next.grounded).toBe(false);
  });

  it('stepPlayerPhysics-fallingOntoSolidTile-snapsFeetToSurfaceAndStopsVelocity', () => {
    const groundSurfaceY = 3 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    // Start 1px above the surface, falling fast enough to overshoot through
    // it in a single frame.
    const player = basePlayer({ y: restY - 1, vy: 500 });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60);

    expect(next.y).toBe(restY);
    expect(next.vy).toBe(0);
    expect(next.grounded).toBe(true);
  });

  it('stepPlayerPhysics-restingOnGround-staysAtSameYAndRemainsGrounded', () => {
    const groundSurfaceY = 3 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({ y: restY, vy: 0, grounded: true });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60);

    expect(next.y).toBe(restY);
    expect(next.vy).toBe(0);
    expect(next.grounded).toBe(true);
  });

  it('stepPlayerPhysics-fallingForManyFrames-clampsVelocityAtTerminal', () => {
    let player = basePlayer({ y: 0, vy: 0 });
    for (let i = 0; i < 120; i++) {
      player = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60);
    }
    expect(player.vy).toBe(PHYSICS_CONFIG.terminalVelocity);
  });

  it('stepPlayerPhysics-noSolidTileInColumn-neverGroundedKeepsFalling', () => {
    let player = basePlayer({ y: 0, vy: 0 });
    for (let i = 0; i < 10; i++) {
      player = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60);
    }
    expect(player.grounded).toBe(false);
    expect(player.y).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Physics.test.ts`
Expected: FAIL — `./Physics` and `./PhysicsConfig` don't exist yet.

- [ ] **Step 3: Implement**

Create `src/themes/platformer/engine/PhysicsConfig.ts`:

```ts
/**
 * Tunable player-physics constants, in one place so game feel can be
 * adjusted without hunting through engine logic. Later roadmap steps add
 * more fields here (walk speed, jump force, ...) instead of introducing new
 * scattered constants.
 */
export const PHYSICS_CONFIG = {
  /** Downward acceleration applied while airborne, in px/s^2. */
  gravity: 1800,
  /** Maximum downward fall speed, in px/s. */
  terminalVelocity: 900,
} as const;
```

Create `src/themes/platformer/engine/Physics.ts`:

```ts
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';

/**
 * Applies gravity and resolves vertical collision against the level's solid
 * tiles for one frame. Horizontal movement/collision isn't implemented yet
 * (no input until step 5) — only `y`/`vy`/`grounded` change here.
 */
export function stepPlayerPhysics(player: PlayerState, level: LevelDef, dt: number): PlayerState {
  const vy = Math.min(player.vy + PHYSICS_CONFIG.gravity * dt, PHYSICS_CONFIG.terminalVelocity);
  let y = player.y + vy * dt;
  let grounded = false;
  let resolvedVy = vy;

  if (vy >= 0) {
    const feetY = y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
    const footRow = Math.floor(feetY / RENDERED_TILE_SIZE);
    const leftCol = Math.floor(player.x / RENDERED_TILE_SIZE);
    const rightCol = Math.floor((player.x + PLAYER_RENDERED_SIZE - 1) / RENDERED_TILE_SIZE);

    for (let col = leftCol; col <= rightCol; col++) {
      if (isSolid(tileAt(level, col, footRow))) {
        const groundSurfaceY = footRow * RENDERED_TILE_SIZE;
        y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
        resolvedVy = 0;
        grounded = true;
        break;
      }
    }
  }

  return { ...player, y, vy: resolvedVy, grounded };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Physics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/PhysicsConfig.ts src/themes/platformer/engine/Physics.ts src/themes/platformer/engine/Physics.test.ts
git commit -m "feat(platformer): add tunable physics config and gravity/solid-collision step"
```

---

### Task 4: Game loop

**Files:**
- Create: `src/themes/platformer/engine/GameLoop.ts`
- Test: `src/themes/platformer/engine/GameLoop.test.ts`

**Interfaces:**
- Consumes: global `requestAnimationFrame`/`cancelAnimationFrame` only — no
  dependency on Physics or Player.
- Produces: `createGameLoop(onTick: (dt: number) => void): { start(): void; stop():
  void }`. `dt` is seconds since the previous frame, capped at `1/30`. Task 5 relies on
  exactly this factory name/signature.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/GameLoop.test.ts`:

```ts
import { createGameLoop } from './GameLoop';

describe('createGameLoop', () => {
  let frameCallback: FrameRequestCallback | null = null;
  let rafSpy: ReturnType<typeof vi.fn>;
  let cafSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    frameCallback = null;
    rafSpy = vi.fn((cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    cafSpy = vi.fn();
    vi.stubGlobal('requestAnimationFrame', rafSpy);
    vi.stubGlobal('cancelAnimationFrame', cafSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('start-called-schedulesFirstAnimationFrame', () => {
    createGameLoop(() => {}).start();
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

  it('start-firstFrameFires-doesNotCallOnTickYet', () => {
    const onTick = vi.fn();
    createGameLoop(onTick).start();
    frameCallback!(0);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('start-secondFrameFires-callsOnTickWithElapsedSecondsSincePreviousFrame', () => {
    const onTick = vi.fn();
    createGameLoop(onTick).start();
    frameCallback!(0);
    frameCallback!(16);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledWith(0.016);
  });

  it('tick-elapsedExceedsCap-clampsDtToMax', () => {
    const onTick = vi.fn();
    createGameLoop(onTick).start();
    frameCallback!(0);
    frameCallback!(1000); // huge gap, e.g. the tab was backgrounded
    expect(onTick).toHaveBeenCalledWith(1 / 30);
  });

  it('stop-afterStart-cancelsTheScheduledFrame', () => {
    const loop = createGameLoop(() => {});
    loop.start();
    loop.stop();
    expect(cafSpy).toHaveBeenCalledWith(1);
  });

  it('start-calledTwiceWithoutStop-onlySchedulesOnce', () => {
    const loop = createGameLoop(() => {});
    loop.start();
    loop.start();
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/GameLoop.test.ts`
Expected: FAIL — `./GameLoop` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/themes/platformer/engine/GameLoop.ts`:

```ts
/** Caps the per-frame delta time (seconds) so a backgrounded/throttled tab
 * doesn't produce one huge catch-up physics step on resume. */
const MAX_DT = 1 / 30;

export interface GameLoop {
  start(): void;
  stop(): void;
}

/**
 * Wraps `requestAnimationFrame` into a start/stop-able loop that calls
 * `onTick(dt)` every frame after the first, with `dt` in seconds.
 */
export function createGameLoop(onTick: (dt: number) => void): GameLoop {
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const frame = (time: number) => {
    if (lastTime !== null) {
      const dt = Math.min((time - lastTime) / 1000, MAX_DT);
      onTick(dt);
    }
    lastTime = time;
    rafId = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (rafId !== null) return;
      lastTime = null;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastTime = null;
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/GameLoop.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/GameLoop.ts src/themes/platformer/engine/GameLoop.test.ts
git commit -m "feat(platformer): add requestAnimationFrame-based game loop"
```

---

### Task 5: Wire the game loop into PlatformerPage

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `createGameLoop` (Task 4), `stepPlayerPhysics` (Task 3),
  `advancePlayerAnimation` (Task 1), `playerState` (Task 2), `level1`.
- Produces: the game loop runs for the lifetime of the mounted `PlatformerPage` only —
  started in the mount effect, stopped in its cleanup — which is what ties it to "only
  active while the Platformer theme is shown" (this component only mounts while
  `currentTheme.value === 'platformer'`).

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/PlatformerPage.test.tsx` (add
`import { playerState } from './PlatformerState';` to the top import block):

```ts
it('mount-onRender-startsTheGameLoop', () => {
  const rafSpy = vi.fn(() => 1);
  vi.stubGlobal('requestAnimationFrame', rafSpy);

  render(<PlatformerPage />);

  expect(rafSpy).toHaveBeenCalled();
});

it('unmount-afterMount-stopsTheGameLoop', () => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  const cafSpy = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cafSpy);

  const { unmount } = render(<PlatformerPage />);
  unmount();

  expect(cafSpy).toHaveBeenCalled();
});

it('gameLoopFrames-run-updatePlayerPhysicsAndGroundTheSpawnedPlayer', () => {
  let frameCallback: FrameRequestCallback | null = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  render(<PlatformerPage />);
  expect(playerState.value.grounded).toBe(false);

  frameCallback!(0); // establishes the loop's reference time, no physics step yet
  frameCallback!(16); // ~16ms later: one physics + animation step runs

  expect(playerState.value.grounded).toBe(true);
  expect(playerState.value.vy).toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — no game loop is started yet, so `requestAnimationFrame`/
`cancelAnimationFrame` are never called and `playerState.value.grounded` never
changes.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerPage.tsx`, add imports and start/stop the loop:

```tsx
import { useEffect, useRef } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { loadImage } from './engine/SpriteLoader';
import { drawTerrain, drawPlayer } from './engine/Renderer';
import { createGameLoop } from './engine/GameLoop';
import { stepPlayerPhysics } from './engine/Physics';
import { level1 } from './level/level1';
import { RENDERED_TILE_SIZE } from './level/Terrain';
import { advancePlayerAnimation } from './entities/Player';
import { playerState } from './PlatformerState';

export const PlatformerPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesetRef = useRef<HTMLImageElement | null>(null);
  const playerSpriteRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim();
      ctx.fillStyle = backgroundColor || '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Anchor the level to the bottom of the canvas so a taller viewport
      // shows more sky above the ground instead of empty space below it.
      const levelPixelHeight = level1.height * RENDERED_TILE_SIZE;
      const originY = canvas.height - levelPixelHeight;

      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current, originY);
      }

      if (playerSpriteRef.current) {
        drawPlayer(ctx, playerState.value, playerSpriteRef.current, originY);
      }
    };

    draw();
    window.addEventListener('resize', draw);

    const loop = createGameLoop((dt) => {
      let next = stepPlayerPhysics(playerState.value, level1, dt);
      next = advancePlayerAnimation(next, dt);
      playerState.value = next;
      draw();
    });
    loop.start();

    let cancelled = false;
    loadImage('/sprites/world_tileset.png')
      .then((img) => {
        if (cancelled) return;
        tilesetRef.current = img;
        draw();
      })
      .catch(() => {
        // Terrain simply won't render if the tileset fails to load; the
        // background fill still shows so the page isn't blank.
      });
    loadImage('/sprites/knight.png')
      .then((img) => {
        if (cancelled) return;
        playerSpriteRef.current = img;
        draw();
      })
      .catch(() => {
        // Player simply won't render if the sprite fails to load; the
        // terrain still shows.
      });

    return () => {
      cancelled = true;
      loop.stop();
      window.removeEventListener('resize', draw);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" />
      <FloatingControls />
    </div>
  );
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS (all tests, including the pre-existing ones).

Then run the full platformer suite to confirm nothing else regressed:

Run: `npx vitest run src/themes/platformer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): drive gravity/collision and idle animation from a game loop"
```

---

### Task 6: Manual browser verification

**Files:** none (temporary local edit only, reverted before finishing)

- [ ] **Step 1: Temporarily move the spawn point into the air**

In `src/themes/platformer/level/level1.ts`, temporarily change one `.` above the
existing ground in `LEVEL_1_LAYOUT` to `S` (and change the original `S` back to `.`) —
e.g. move it to row index 5, same column — so the character spawns mid-air over solid
ground below.

- [ ] **Step 2: Run the dev server and observe**

```bash
npm run dev
```

Open the Platformer theme in the browser. Confirm the character starts mid-air and
falls, then comes to rest exactly on top of the ground tile below it (no sinking into
the tile, no floating above it).

- [ ] **Step 3: Verify falling into open space (no ground below)**

Temporarily move the `S` to a column above the bridged pit gap (or any column with no
solid tile anywhere beneath it in that level) and reload. Confirm the character falls
continuously off the bottom of the screen instead of stopping.

- [ ] **Step 4: Revert the temporary level edit**

```bash
git checkout -- src/themes/platformer/level/level1.ts
```

Confirm `git status` shows no changes to `level1.ts` before moving on.

- [ ] **Step 5: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, change step 4's `- [ ]` to `- [x]`.

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "Check off roadmap step 4 — verified in browser"
```

---

## Self-Review Notes

- **Spec coverage:** FR-002 (game loop) → Task 4/5. FR-006 gravity/collision → Task 3.
  FR-027 (`requestAnimationFrame`) → Task 4. FR-030 file layout (`engine/GameLoop.ts`,
  `engine/Physics.ts`) → matches exactly. FR-031 `playerState` shape (position,
  velocity, grounded, animation frame) → Task 1/2. Jump/walk/camera/respawn (FR-006's
  remaining clauses) are explicitly out of scope — roadmap steps 5–8.
- **Config for tuning (per user request):** `PhysicsConfig.ts` centralizes gravity/
  terminal velocity now; steps 5–6 add `walkSpeed`, `jumpForce`, etc. to the same
  object rather than introducing new scattered constants.
- **Animation driven by the loop (per user request):** Task 1 adds
  `advancePlayerAnimation`; Task 5's tick calls it every frame alongside physics, so
  the idle sprite now visibly cycles through its 4 frames instead of being frozen at
  frame 0.
- **Loop lifetime scoped to the theme (per user request):** confirmed via `App.tsx`
  (`const Page = themePages[currentTheme.value] ?? IdePage`) that `PlatformerPage`
  only mounts while the Platformer theme is active; starting/stopping the loop in its
  own mount/unmount effect is therefore sufficient — no theme-signal subscription
  needed in this component.
- **No placeholders:** every step has real code; no TBD/"similar to" references.
- **Type consistency:** `PlayerState` fields (`vy`, `grounded`, `animTimer`) are
  identical across Task 1 (definition), Task 2 (initialization), Task 3 (`Physics.ts`
  consumption), and Task 5 (wiring). `createGameLoop(onTick: (dt: number) => void)`
  signature identical in Task 4 (definition) and Task 5 (usage).
