# Platformer Step 5 — Horizontal Movement + Walk Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arrow Left/Right move the player character horizontally at a constant speed
with instant direction change, stopping at solid tiles; the sprite switches from the
idle animation to a walk-cycle animation while moving and faces the direction of
travel. No jump yet (that's step 6).

**Architecture:** A new `engine/Input.ts` module polls held keys per frame (per FR-007
— input is read every tick, not reacted to per-keystroke) via a `createKeyboardInput()`
factory returning `{ isHeld(code), destroy() }`. `stepPlayerPhysics` (extended, not
replaced) gains a 4th, defaulted `HorizontalInput` parameter: it resolves left/right
into a signed `vx`, moves `x`, and resolves horizontal collision against the level's
solid tiles using the same `isSolid`/`tileAt` helpers the existing vertical collision
uses — before running the existing gravity/vertical-collision logic unchanged. A new
`updatePlayerAnimState(player)` in `entities/Player.ts` switches `animState` between
`'idle'`/`'walk'` based on `vx`, resetting the frame/timer on transition. Rather than
shipping a second, mirrored sprite sheet for left-facing movement, the renderer flips
the canvas horizontally around the sprite's own bounding box when `facing === 'left'`
(`ctx.translate` + `ctx.scale(-1, 1)`) — the sheet only needs to depict the character
facing one direction. `PlatformerPage`'s existing tick composes the three pure
functions in sequence and owns the `Input` tracker's lifecycle (created on mount,
destroyed on unmount, alongside the existing game loop start/stop).

**Tech Stack:** TypeScript (strict), Vitest + React Testing Library + jsdom,
`@preact/signals-react` for `playerState`.

**Spec:** `specs/S-006-platformer-theme/spec.md` (FR-005 walk animation + sprite facing,
FR-006 constant-speed horizontal movement with instant direction change and solid
collision, FR-007 keyboard input read per-frame, FR-030 file layout — `engine/Input.ts`,
FR-032 `PlayerState` shape — `vx`, `facing`, FR-033 `Input` unit test coverage) and
`specs/S-006-platformer-theme/roadmap.md` step 5.

## Global Constraints

- TDD is mandatory: write the failing test before the implementation for every task
  (constitution Principle II).
- 100% coverage target for `src/lib/`-equivalent pure logic — here, `Player.ts`,
  `Physics.ts`, `PhysicsConfig.ts`, and `Input.ts` must be fully covered by unit tests.
- Tests use Vitest + React Testing Library + jsdom; test names follow
  `{method}-{Condition}-{ExpectedResult}` (see existing `*.test.ts` files in this
  directory tree).
- TypeScript strict mode, no `any`. Named arrow function exports for components; the
  engine/entity files in this plan use named `function`/`const` exports, matching the
  existing `Physics.ts`/`Player.ts` style.
- No feature bloat: this plan implements roadmap step 5 only (horizontal movement +
  walk animation). No jump, no camera scroll, no respawn — those are steps 6–8.
- Branch: create `S-006-step5-horizontal-movement` off `S-006-platformer-theme` before
  starting (per the roadmap's branch-per-step working agreement); PR back into
  `S-006-platformer-theme` when done, then delete the step branch.

---

## File Structure

- **Create** `src/themes/platformer/engine/Input.ts` — `createKeyboardInput()`:
  window-level keydown/keyup listeners tracking a held-key `Set`, polled via `isHeld`.
- **Modify** `src/themes/platformer/entities/Player.ts` — add `vx`, `facing` to
  `PlayerState`; add `'walk'` to `PlayerAnimState`; replace the per-state `switch`
  statements in `playerFrameSource`/`advancePlayerAnimation` with a single
  `ANIM_CONFIG` lookup table (adds the walk row's frame count/duration/sprite-sheet
  row without duplicating the idle-only branching logic); add
  `updatePlayerAnimState`.
- **Modify** `src/themes/platformer/engine/PhysicsConfig.ts` — add `walkSpeed`.
- **Modify** `src/themes/platformer/engine/Physics.ts` — `stepPlayerPhysics` gains a
  defaulted `input: HorizontalInput` parameter; resolves horizontal movement/collision
  before the existing vertical step.
- **Modify** `src/themes/platformer/engine/Renderer.ts` — `drawPlayer` mirrors the
  sprite horizontally when `player.facing === 'left'`.
- **Modify** `src/themes/platformer/PlatformerState.ts` — initialize `vx: 0`,
  `facing: 'right'`.
- **Modify** `src/themes/platformer/PlatformerPage.tsx` — create/destroy the keyboard
  input tracker; tick now reads held arrow keys and calls
  `stepPlayerPhysics` → `updatePlayerAnimState` → `advancePlayerAnimation` in sequence.

---

### Task 1: Player state gains horizontal velocity/facing + walk animation data

**Files:**
- Modify: `src/themes/platformer/entities/Player.ts`
- Test: `src/themes/platformer/entities/Player.test.ts`

**Interfaces:**
- Consumes: nothing new (extends the existing `PlayerState` interface).
- Produces: `PlayerState` now has `vx: number`, `facing: 'left' | 'right'`.
  `PlayerAnimState` is now `'idle' | 'walk'`. New export
  `updatePlayerAnimState(player: PlayerState): PlayerState`. `playerFrameSource` and
  `advancePlayerAnimation` keep their exact existing signatures but now also handle
  `'walk'`. Later tasks (`PlatformerState.ts`, `Physics.ts`, `Renderer.ts`,
  `PlatformerPage.tsx`) rely on these exact names and the field set.

- [ ] **Step 1: Write the failing tests**

Replace the `idlePlayer` helper and its imports at the top of
`src/themes/platformer/entities/Player.test.ts`, and append the new test blocks below:

```ts
import {
  playerFrameSource,
  PLAYER_FRAME_SIZE,
  PLAYER_RENDERED_SIZE,
  advancePlayerAnimation,
  updatePlayerAnimState,
  IDLE_FRAME_DURATION,
} from './Player';
import type { PlayerState } from './Player';
import { RENDER_SCALE } from '../level/Terrain';

function idlePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 'right',
    grounded: true,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    ...overrides,
  };
}
```

Append these new `describe` blocks after the existing `advancePlayerAnimation` block:

```ts
describe('playerFrameSource walk row', () => {
  it('playerFrameSource-walkFrame0-returnsFirstWalkColumnAtWalkRow', () => {
    expect(playerFrameSource('walk', 0)).toEqual({ sx: 0, sy: PLAYER_FRAME_SIZE * 2 });
  });

  it('playerFrameSource-walkFrame5-returnsSixthWalkColumnAtWalkRow', () => {
    expect(playerFrameSource('walk', 5)).toEqual({
      sx: 5 * PLAYER_FRAME_SIZE,
      sy: PLAYER_FRAME_SIZE * 2,
    });
  });

  it('playerFrameSource-walkFrame8-wrapsToFirstWalkColumn', () => {
    expect(playerFrameSource('walk', 8)).toEqual({ sx: 0, sy: PLAYER_FRAME_SIZE * 2 });
  });
});

describe('advancePlayerAnimation walk timing', () => {
  it('advancePlayerAnimation-walkStateBelowFrameDuration-accumulatesTimerWithoutAdvancingFrame', () => {
    const next = advancePlayerAnimation(idlePlayer({ animState: 'walk' }), 0.04);
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBeCloseTo(0.04);
  });

  it('advancePlayerAnimation-walkStateReachesFrameDuration-advancesFrameAndCarriesRemainder', () => {
    const next = advancePlayerAnimation(
      idlePlayer({ animState: 'walk', animTimer: 0.07 }),
      0.02,
    );
    expect(next.animFrame).toBe(1);
    expect(next.animTimer).toBeCloseTo(0.01);
  });
});

describe('updatePlayerAnimState', () => {
  it('updatePlayerAnimState-vxNonZeroFromIdle-switchesToWalkAndResetsFrame', () => {
    const player = idlePlayer({ vx: 200, animState: 'idle', animFrame: 3, animTimer: 0.1 });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('walk');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
  });

  it('updatePlayerAnimState-vxZeroFromWalk-switchesToIdleAndResetsFrame', () => {
    const player = idlePlayer({ vx: 0, animState: 'walk', animFrame: 5, animTimer: 0.05 });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('idle');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
  });

  it('updatePlayerAnimState-stateAlreadyMatchesVelocity-returnsSameObjectReference', () => {
    const player = idlePlayer({ vx: 0, animState: 'idle' });
    const next = updatePlayerAnimState(player);
    expect(next).toBe(player);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts`
Expected: FAIL — `updatePlayerAnimState` not exported; `'walk'` not assignable to
`PlayerAnimState`; `PlayerState` object literals missing `vx`/`facing` fail
type-checking.

- [ ] **Step 3: Implement**

Replace the full contents of `src/themes/platformer/entities/Player.ts`:

```ts
import { RENDER_SCALE } from '../level/Terrain';

export const PLAYER_FRAME_SIZE = 32;
export const PLAYER_RENDERED_SIZE = PLAYER_FRAME_SIZE * RENDER_SCALE;

/** Transparent rows below the knight's feet inside each 32px native frame. */
export const PLAYER_FOOT_PADDING = 4 * RENDER_SCALE; // 8 rendered px

export type PlayerAnimState = 'idle' | 'walk';
export type PlayerFacing = 'left' | 'right';

export interface PlayerState {
  x: number;
  y: number;
  /** Horizontal velocity in px/s. Positive is rightward. */
  vx: number;
  /** Vertical velocity in px/s. Positive is downward. */
  vy: number;
  /** Direction the sprite is drawn facing. Only horizontal movement changes it. */
  facing: PlayerFacing;
  /** Whether the player is currently resting on a solid tile. */
  grounded: boolean;
  animState: PlayerAnimState;
  animFrame: number;
  /** Seconds accumulated toward the next animation frame advance. */
  animTimer: number;
}

/**
 * Per-state animation timing and sprite-sheet row, keyed by `PlayerAnimState`.
 * Centralizing this as a lookup table (instead of a `switch` per function)
 * means adding a future state (e.g. `'jump'` in step 6) only requires one new
 * entry here, not new branches in both `playerFrameSource` and
 * `advancePlayerAnimation`.
 */
const ANIM_CONFIG: Record<
  PlayerAnimState,
  { frameCount: number; frameDuration: number; sy: number }
> = {
  idle: { frameCount: 4, frameDuration: 0.15, sy: 0 },
  walk: { frameCount: 8, frameDuration: 0.08, sy: PLAYER_FRAME_SIZE * 2 },
};

/** Seconds each idle frame is held before advancing to the next. */
export const IDLE_FRAME_DURATION = ANIM_CONFIG.idle.frameDuration;

export function playerFrameSource(
  animState: PlayerAnimState,
  frame: number,
): { sx: number; sy: number } {
  const { frameCount, sy } = ANIM_CONFIG[animState];
  return { sx: (frame % frameCount) * PLAYER_FRAME_SIZE, sy };
}

/** Advances the player's animation timer/frame by `dt` seconds. */
export function advancePlayerAnimation(player: PlayerState, dt: number): PlayerState {
  const { frameCount, frameDuration } = ANIM_CONFIG[player.animState];
  const animTimer = player.animTimer + dt;
  if (animTimer < frameDuration) {
    return { ...player, animTimer };
  }
  return {
    ...player,
    animTimer: animTimer - frameDuration,
    animFrame: (player.animFrame + 1) % frameCount,
  };
}

/**
 * Switches `animState` between `idle`/`walk` based on horizontal velocity,
 * resetting the animation frame/timer whenever the state actually changes so
 * a leftover frame index from the previous state's cycle never carries over
 * (e.g. idle frame 3 is out of range for a state with fewer frames).
 */
export function updatePlayerAnimState(player: PlayerState): PlayerState {
  const animState: PlayerAnimState = player.vx !== 0 ? 'walk' : 'idle';
  if (animState === player.animState) return player;
  return { ...player, animState, animFrame: 0, animTimer: 0 };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts`
Expected: PASS (all tests, including the pre-existing idle-row ones).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Player.ts src/themes/platformer/entities/Player.test.ts
git commit -m "feat(platformer): add walk animation state and horizontal velocity/facing to PlayerState"
```

---

### Task 2: Initialize horizontal velocity/facing in PlatformerState

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `PlayerState` (Task 1) — must supply `vx`, `facing` for the object literal
  to type-check.
- Produces: `playerState.value` now includes `vx: 0`, `facing: 'right'` at
  initialization. Task 6 (`PlatformerPage.tsx`) relies on this being present before
  the first tick reads player input.

- [ ] **Step 1: Write the failing test**

Append to `src/themes/platformer/PlatformerState.test.ts`:

```ts
it('playerState-initial-hasZeroHorizontalVelocityAndFacesRight', () => {
  expect(playerState.value.vx).toBe(0);
  expect(playerState.value.facing).toBe('right');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: FAIL (or a TS error) — `vx`/`facing` missing from the returned object.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerState.ts`, update `initialPlayerState`'s return
object:

```ts
return {
  x: spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2,
  y: groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING,
  vx: 0,
  vy: 0,
  facing: 'right',
  grounded: false,
  animState: 'idle',
  animFrame: 0,
  animTimer: 0,
};
```

(Only the return object changes — imports and the rest of the file stay as-is.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): initialize player horizontal velocity and facing direction"
```

---

### Task 3: Horizontal movement + solid collision in Physics

**Files:**
- Modify: `src/themes/platformer/engine/PhysicsConfig.ts`
- Modify: `src/themes/platformer/engine/Physics.ts`
- Test: `src/themes/platformer/engine/Physics.test.ts`

**Interfaces:**
- Consumes: `PlayerState` (Task 1, needs `x`, `vx`, `facing`), `LevelDef`,
  `isSolid`/`tileAt`/`RENDERED_TILE_SIZE` from `../level/Terrain`,
  `PLAYER_RENDERED_SIZE` from `../entities/Player`.
- Produces: `PHYSICS_CONFIG.walkSpeed: number`. New export `HorizontalInput` type
  (`{ left: boolean; right: boolean }`) from `Physics.ts`. `stepPlayerPhysics`'s
  signature becomes `(player: PlayerState, level: LevelDef, dt: number, input?:
  HorizontalInput): PlayerState` — `input` defaults to no movement, so every existing
  call site (including the pre-existing tests) keeps compiling and passing unchanged.
  Task 6 (`PlatformerPage.tsx`) passes the real held-key state as the 4th argument.

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/engine/Physics.test.ts`, update the `basePlayer` helper and
append the new fixtures/tests:

```ts
function basePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 'right',
    grounded: false,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    ...overrides,
  };
}
```

Append after the existing `stepPlayerPhysics` describe block:

```ts
// 2 rows tall, 6 cols wide, no ground anywhere — isolates horizontal
// movement/collision from gravity's vertical collision.
const OPEN_LEVEL = parseLevel(['......', '......']);

// Solid wall at col 4, both rows — blocks rightward movement.
const RIGHT_WALL_LEVEL = parseLevel(['....W.', '....W.']);

// Solid wall at col 1, both rows — blocks leftward movement.
const LEFT_WALL_LEVEL = parseLevel(['.W....', '.W....']);

describe('stepPlayerPhysics horizontal movement', () => {
  it('noHorizontalInput-defaultParam-leavesXAndVxUnchanged', () => {
    const player = basePlayer({ x: 10, vx: 0 });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60);
    expect(next.x).toBe(10);
    expect(next.vx).toBe(0);
  });

  it('rightHeld-inOpenSpace-movesRightAtWalkSpeedAndFacesRight', () => {
    const player = basePlayer({ x: 0, facing: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: false, right: true });
    expect(next.vx).toBe(PHYSICS_CONFIG.walkSpeed);
    expect(next.x).toBeCloseTo(PHYSICS_CONFIG.walkSpeed / 60);
    expect(next.facing).toBe('right');
  });

  it('leftHeld-inOpenSpace-movesLeftAtWalkSpeedAndFacesLeft', () => {
    const player = basePlayer({ x: 100, facing: 'right' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: false });
    expect(next.vx).toBe(-PHYSICS_CONFIG.walkSpeed);
    expect(next.x).toBeCloseTo(100 - PHYSICS_CONFIG.walkSpeed / 60);
    expect(next.facing).toBe('left');
  });

  it('bothHeld-inOpenSpace-cancelsOutToZeroVelocityAndKeepsFacing', () => {
    const player = basePlayer({ x: 50, facing: 'left' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: true, right: true });
    expect(next.vx).toBe(0);
    expect(next.x).toBe(50);
    expect(next.facing).toBe('left');
  });

  it('neitherHeld-afterMoving-stopsButKeepsLastFacing', () => {
    const player = basePlayer({ x: 50, facing: 'right' });
    const next = stepPlayerPhysics(player, OPEN_LEVEL, 1 / 60, { left: false, right: false });
    expect(next.vx).toBe(0);
    expect(next.facing).toBe('right');
  });

  it('movingRightIntoWall-overshootsInOneFrame-clampsToWallLeftEdge', () => {
    const wallCol = 4;
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE;
    const player = basePlayer({ x: restX - 1 });

    const next = stepPlayerPhysics(player, RIGHT_WALL_LEVEL, 1 / 60, {
      left: false,
      right: true,
    });

    expect(next.x).toBe(restX);
  });

  it('movingLeftIntoWall-overshootsInOneFrame-clampsToWallRightEdge', () => {
    const wallCol = 1;
    const restX = (wallCol + 1) * RENDERED_TILE_SIZE;
    const player = basePlayer({ x: restX + 1 });

    const next = stepPlayerPhysics(player, LEFT_WALL_LEVEL, 1 / 60, {
      left: true,
      right: false,
    });

    expect(next.x).toBe(restX);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Physics.test.ts`
Expected: FAIL — `PHYSICS_CONFIG.walkSpeed` is `undefined` and `stepPlayerPhysics`
ignores the 4th argument entirely (x/vx/facing never change).

- [ ] **Step 3: Implement**

In `src/themes/platformer/engine/PhysicsConfig.ts`, add `walkSpeed` to the exported
object:

```ts
export const PHYSICS_CONFIG = {
  /** Downward acceleration applied while airborne, in px/s^2. */
  gravity: 1800,
  /**
   * Maximum downward fall speed, in px/s. Discrete collision resolution
   * (Physics.ts) only prevents tunneling through a 1-tile-thick solid as
   * long as `terminalVelocity * MAX_DT < RENDERED_TILE_SIZE` (see
   * GameLoop.ts's MAX_DT and Terrain.ts's RENDERED_TILE_SIZE) — keep this
   * true when retuning any of the three.
   */
  terminalVelocity: 900,
  /**
   * Constant horizontal walk speed, in px/s, in either direction (FR-006:
   * instant direction change, no acceleration/deceleration). Same tunneling
   * invariant as `terminalVelocity` applies: `walkSpeed * MAX_DT` must stay
   * below `RENDERED_TILE_SIZE`.
   */
  walkSpeed: 200,
} as const;
```

Replace the full contents of `src/themes/platformer/engine/Physics.ts`:

```ts
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';

/** Which horizontal directions are currently held. Both held cancels out to no movement. */
export interface HorizontalInput {
  left: boolean;
  right: boolean;
}

const NO_HORIZONTAL_INPUT: HorizontalInput = { left: false, right: false };

/**
 * Resolves one frame of horizontal movement/collision, then gravity and
 * vertical collision, against the level's solid tiles. `input` defaults to
 * no movement so gravity-only call sites (and existing tests) keep working
 * unchanged.
 */
export function stepPlayerPhysics(
  player: PlayerState,
  level: LevelDef,
  dt: number,
  input: HorizontalInput = NO_HORIZONTAL_INPUT,
): PlayerState {
  const moveRight = input.right && !input.left;
  const moveLeft = input.left && !input.right;
  const vx = moveRight ? PHYSICS_CONFIG.walkSpeed : moveLeft ? -PHYSICS_CONFIG.walkSpeed : 0;
  const facing = moveRight ? 'right' : moveLeft ? 'left' : player.facing;

  let x = player.x + vx * dt;
  const topRow = Math.floor(player.y / RENDERED_TILE_SIZE);
  const bottomRow = Math.floor((player.y + PLAYER_RENDERED_SIZE - 1) / RENDERED_TILE_SIZE);

  if (vx > 0) {
    const rightCol = Math.floor((x + PLAYER_RENDERED_SIZE - 1) / RENDERED_TILE_SIZE);
    for (let row = topRow; row <= bottomRow; row++) {
      if (isSolid(tileAt(level, rightCol, row))) {
        x = rightCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE;
        break;
      }
    }
  } else if (vx < 0) {
    const leftCol = Math.floor(x / RENDERED_TILE_SIZE);
    for (let row = topRow; row <= bottomRow; row++) {
      if (isSolid(tileAt(level, leftCol, row))) {
        x = (leftCol + 1) * RENDERED_TILE_SIZE;
        break;
      }
    }
  }

  const vy = Math.min(player.vy + PHYSICS_CONFIG.gravity * dt, PHYSICS_CONFIG.terminalVelocity);
  let y = player.y + vy * dt;
  let grounded = false;
  let resolvedVy = vy;

  if (vy >= 0) {
    const feetY = y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
    const footRow = Math.floor(feetY / RENDERED_TILE_SIZE);
    const leftCol = Math.floor(x / RENDERED_TILE_SIZE);
    const rightCol = Math.floor((x + PLAYER_RENDERED_SIZE - 1) / RENDERED_TILE_SIZE);

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

  return { ...player, x, y, vx, vy: resolvedVy, facing, grounded };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Physics.test.ts`
Expected: PASS (all tests, including the pre-existing vertical-collision ones).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/PhysicsConfig.ts src/themes/platformer/engine/Physics.ts src/themes/platformer/engine/Physics.test.ts
git commit -m "feat(platformer): add constant-speed horizontal movement and solid-wall collision"
```

---

### Task 4: Keyboard input tracking

**Files:**
- Create: `src/themes/platformer/engine/Input.ts`
- Test: `src/themes/platformer/engine/Input.test.ts`

**Interfaces:**
- Consumes: global `window`/`KeyboardEvent` only — no dependency on Physics or Player.
- Produces: `createKeyboardInput(): { isHeld(code: string): boolean; destroy(): void }`.
  `code` values match `KeyboardEvent.code` (e.g. `'ArrowLeft'`, `'ArrowRight'`). Task 6
  relies on exactly this factory name/signature.

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/Input.test.ts`:

```ts
import { createKeyboardInput } from './Input';

function dispatchKey(type: 'keydown' | 'keyup', code: string): KeyboardEvent {
  const event = new KeyboardEvent(type, { code, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('createKeyboardInput', () => {
  it('isHeld-beforeAnyKeyEvent-returnsFalse', () => {
    const input = createKeyboardInput();
    expect(input.isHeld('ArrowRight')).toBe(false);
    input.destroy();
  });

  it('keydown-forTrackedCode-marksItHeld', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'ArrowRight');
    expect(input.isHeld('ArrowRight')).toBe(true);
    input.destroy();
  });

  it('keyup-afterKeydown-marksItNotHeld', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'ArrowRight');
    dispatchKey('keyup', 'ArrowRight');
    expect(input.isHeld('ArrowRight')).toBe(false);
    input.destroy();
  });

  it('keydown-repeatedForSameCode-staysHeldUntilKeyup', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'ArrowRight');
    dispatchKey('keydown', 'ArrowRight'); // OS key-repeat while held
    expect(input.isHeld('ArrowRight')).toBe(true);
    input.destroy();
  });

  it('keydown-forGameKey-preventsDefault', () => {
    const input = createKeyboardInput();
    const event = dispatchKey('keydown', 'ArrowLeft');
    expect(event.defaultPrevented).toBe(true);
    input.destroy();
  });

  it('keydown-forNonGameKey-doesNotPreventDefaultButStillTracksHeld', () => {
    const input = createKeyboardInput();
    const event = dispatchKey('keydown', 'KeyJ');
    expect(event.defaultPrevented).toBe(false);
    expect(input.isHeld('KeyJ')).toBe(true);
    input.destroy();
  });

  it('destroy-afterCalled-stopsTrackingFurtherKeyEvents', () => {
    const input = createKeyboardInput();
    input.destroy();
    dispatchKey('keydown', 'ArrowRight');
    expect(input.isHeld('ArrowRight')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Input.test.ts`
Expected: FAIL — `./Input` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/themes/platformer/engine/Input.ts`:

```ts
/**
 * Keys the game reads. Their default browser behavior (e.g. page scroll on
 * arrow keys) is suppressed so gameplay isn't fighting the page — FR-007
 * reserves Arrow Left/Right/Up and Space exclusively for the game.
 */
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']);

export interface KeyboardInput {
  /** Whether `code` (a `KeyboardEvent.code` value, e.g. `'ArrowLeft'`) is currently held. */
  isHeld(code: string): boolean;
  /** Removes the window listeners and clears all held-key state. */
  destroy(): void;
}

/**
 * Tracks which keys are currently held, polled per-frame by the game loop
 * (FR-007: input is read every tick so held keys produce continuous
 * movement) instead of reacting to individual keystrokes.
 */
export function createKeyboardInput(): KeyboardInput {
  const held = new Set<string>();

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    held.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    held.delete(e.code);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    isHeld: (code: string) => held.has(code),
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      held.clear();
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Input.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Input.ts src/themes/platformer/engine/Input.test.ts
git commit -m "feat(platformer): add per-frame keyboard input tracking"
```

---

### Task 5: Mirror the sprite when facing left

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `PlayerState.facing` (Task 1), `PLAYER_RENDERED_SIZE` (existing).
- Produces: `drawPlayer`'s existing signature is unchanged; it now flips the drawn
  sprite horizontally around its own bounding box when `player.facing === 'left'`,
  instead of requiring a second mirrored sprite sheet.

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/engine/Renderer.test.ts`, update `makeMockContext` and the
`idlePlayer` fixture, and append a new test to the `drawPlayer` describe block:

```ts
function makeMockContext() {
  return {
    imageSmoothingEnabled: true,
    drawImage: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}
```

```ts
const idlePlayer: PlayerState = {
  x: 16,
  y: 256,
  vx: 0,
  vy: 0,
  facing: 'right',
  grounded: true,
  animTimer: 0,
  animState: 'idle',
  animFrame: 0,
};
```

Append inside the `describe('drawPlayer', ...)` block:

```ts
it('facingLeft-draws-flippedAroundSpriteBoundingBox', () => {
  const ctx = makeMockContext();
  const player: PlayerState = { ...idlePlayer, facing: 'left' };

  drawPlayer(ctx, player, fakeSpriteSheet);

  expect(ctx.save).toHaveBeenCalled();
  expect(ctx.translate).toHaveBeenCalledWith(player.x + PLAYER_RENDERED_SIZE, player.y);
  expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
  expect(ctx.drawImage).toHaveBeenCalledWith(
    fakeSpriteSheet,
    0,
    0,
    32,
    32,
    0,
    0,
    PLAYER_RENDERED_SIZE,
    PLAYER_RENDERED_SIZE,
  );
  expect(ctx.restore).toHaveBeenCalled();
});

it('facingRight-draws-withoutFlippingTransform', () => {
  const ctx = makeMockContext();

  drawPlayer(ctx, idlePlayer, fakeSpriteSheet);

  expect(ctx.save).not.toHaveBeenCalled();
  expect(ctx.scale).not.toHaveBeenCalled();
});
```

Add `PLAYER_RENDERED_SIZE` to the existing `'../entities/Player'`-adjacent import (the
test file currently imports `PlayerState` as a type only — add a value import line:
`import { PLAYER_RENDERED_SIZE } from '../entities/Player';`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `drawPlayer` never calls `save`/`translate`/`scale`/`restore`, and the
`idlePlayer`/inline `PlayerState` literals fail to type-check without `vx`/`facing`.

- [ ] **Step 3: Implement**

In `src/themes/platformer/engine/Renderer.ts`, replace `drawPlayer`:

```ts
/**
 * Draws the player sprite. `originY` shifts it vertically by the same
 * amount as `drawTerrain`'s `originY`, so the player stays aligned with
 * the bottom-anchored level. When `player.facing` is `'left'`, the sprite is
 * mirrored horizontally around its own bounding box — the sheet only needs
 * to depict the character facing one direction.
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  spriteSheet: HTMLImageElement,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  const { sx, sy } = playerFrameSource(player.animState, player.animFrame);

  if (player.facing === 'left') {
    ctx.save();
    ctx.translate(player.x + PLAYER_RENDERED_SIZE, player.y + originY);
    ctx.scale(-1, 1);
    ctx.drawImage(
      spriteSheet,
      sx,
      sy,
      PLAYER_FRAME_SIZE,
      PLAYER_FRAME_SIZE,
      0,
      0,
      PLAYER_RENDERED_SIZE,
      PLAYER_RENDERED_SIZE,
    );
    ctx.restore();
    return;
  }

  ctx.drawImage(
    spriteSheet,
    sx,
    sy,
    PLAYER_FRAME_SIZE,
    PLAYER_FRAME_SIZE,
    player.x,
    player.y + originY,
    PLAYER_RENDERED_SIZE,
    PLAYER_RENDERED_SIZE,
  );
}
```

(No import changes needed — `PLAYER_RENDERED_SIZE` is already imported in this file.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS (all tests, including the pre-existing terrain/idle-player ones).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): mirror the player sprite when facing left"
```

---

### Task 6: Wire keyboard input and horizontal movement into PlatformerPage

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `createKeyboardInput` (Task 4), the extended `stepPlayerPhysics` (Task 3),
  `updatePlayerAnimState` (Task 1), `advancePlayerAnimation` (existing), `playerState`
  (Task 2).
- Produces: the keyboard tracker's lifecycle now matches the game loop's — created in
  the mount effect, destroyed in its cleanup — so held keys never leak state across
  mounts (e.g. switching away from and back to the Platformer theme).

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/PlatformerPage.test.tsx`:

```ts
it('arrowRightHeld-gameLoopTicks-movesPlayerRightAndFacesRightAndWalks', () => {
  let frameCallback: FrameRequestCallback | null = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  render(<PlatformerPage />);
  const startX = playerState.value.x;

  fireEvent.keyDown(window, { code: 'ArrowRight' });
  frameCallback!(0);
  frameCallback!(16);

  expect(playerState.value.x).toBeGreaterThan(startX);
  expect(playerState.value.facing).toBe('right');
  expect(playerState.value.animState).toBe('walk');
});

it('arrowKeyReleased-nextTick-returnsToIdleAndStopsMoving', () => {
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
  const xAfterMoving = playerState.value.x;

  fireEvent.keyUp(window, { code: 'ArrowRight' });
  frameCallback!(32);

  expect(playerState.value.x).toBe(xAfterMoving);
  expect(playerState.value.animState).toBe('idle');
});

it('unmount-afterMount-removesKeyboardEventListeners', () => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const removeSpy = vi.spyOn(window, 'removeEventListener');

  const { unmount } = render(<PlatformerPage />);
  unmount();

  expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  expect(removeSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
  removeSpy.mockRestore();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — held arrow keys have no effect yet (`stepPlayerPhysics` is still
called with no 4th argument), and no keyboard listeners are attached/removed.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerPage.tsx`, add two imports and wire the tracker
into the mount effect:

```tsx
import { useEffect, useRef } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { loadImage } from './engine/SpriteLoader';
import { drawTerrain, drawPlayer } from './engine/Renderer';
import { createGameLoop } from './engine/GameLoop';
import { stepPlayerPhysics } from './engine/Physics';
import { createKeyboardInput } from './engine/Input';
import { level1 } from './level/level1';
import { RENDERED_TILE_SIZE } from './level/Terrain';
import { advancePlayerAnimation, updatePlayerAnimState } from './entities/Player';
import { playerState } from './PlatformerState';

export const PlatformerPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesetRef = useRef<HTMLImageElement | null>(null);
  const playerSpriteRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cached across frames: only recomputed on mount and on actual window
    // resize, since neither the canvas dimensions nor the CSS custom
    // property change on any other frame.
    let backgroundColor = '#000';

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      backgroundColor =
        getComputedStyle(document.documentElement).getPropertyValue('--background').trim() ||
        '#000';
    };

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = backgroundColor;
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

    resize();
    render();

    const onResize = () => {
      resize();
      render();
    };
    window.addEventListener('resize', onResize);

    const input = createKeyboardInput();

    const loop = createGameLoop((dt) => {
      const horizontal = {
        left: input.isHeld('ArrowLeft'),
        right: input.isHeld('ArrowRight'),
      };
      let next = stepPlayerPhysics(playerState.value, level1, dt, horizontal);
      next = updatePlayerAnimState(next);
      next = advancePlayerAnimation(next, dt);
      playerState.value = next;
      render();
    });
    loop.start();

    let cancelled = false;
    loadImage('/sprites/world_tileset.png')
      .then((img) => {
        if (cancelled) return;
        tilesetRef.current = img;
        render();
      })
      .catch(() => {
        // Terrain simply won't render if the tileset fails to load; the
        // background fill still shows so the page isn't blank.
      });
    loadImage('/sprites/knight.png')
      .then((img) => {
        if (cancelled) return;
        playerSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Player simply won't render if the sprite fails to load; the
        // terrain still shows.
      });

    return () => {
      cancelled = true;
      loop.stop();
      input.destroy();
      window.removeEventListener('resize', onResize);
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
git commit -m "feat(platformer): drive horizontal movement and walk animation from held arrow keys"
```

---

### Task 7: Manual browser verification

**Files:** none (roadmap checkbox update only)

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify walking**

Open the Platformer theme in the browser. Hold the right arrow key: confirm the
character moves right smoothly and its sprite visibly cycles through a walk animation
distinct from the idle pose. Release the key: confirm the character stops and returns
to the idle animation.

- [ ] **Step 3: Verify direction change and facing**

Hold the left arrow key: confirm the character moves left, the sprite visibly mirrors
to face left, and direction reverses instantly (no sliding/deceleration) when
switching between left and right without releasing quickly. Confirm the sprite is not
stretched, squashed, or misaligned with the ground while mirrored.

- [ ] **Step 4: Verify wall collision**

Walk into the wall in the rock zone (see `level1.ts`'s `W` column). Confirm the
character stops exactly at the wall's edge instead of overlapping or passing through
it, in both the rightward-approach and (after walking back and around, if the level
layout allows, or by temporarily editing spawn position) leftward-approach cases.

- [ ] **Step 5: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, change step 5's `- [ ]` to `- [x]`.

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "Check off roadmap step 5 — verified in browser"
```

---

## Self-Review Notes

- **Spec coverage:** FR-005 (walk animation state, sprite faces movement direction) →
  Task 1 (`'walk'` anim state) + Task 5 (facing flip). FR-006 (constant-speed
  horizontal movement, instant direction change, solid collision) → Task 3. FR-007
  (Arrow Left/Right read per-frame, held keys produce continuous movement) → Task 4 +
  Task 6's tick. FR-030 file layout (`engine/Input.ts`) → matches exactly. FR-032
  `PlayerState` shape (`vx`, `facing` added) → Task 1/2. FR-033 (`Input` unit tests:
  key held vs pressed) → Task 4. Jump/camera/respawn (remaining FR-006/007 clauses)
  are explicitly out of scope — roadmap steps 6–8.
- **No duplicated left/right sprite sheets (per user request):** Task 5 mirrors the
  existing single-direction sheet via a canvas transform (`translate` + `scale(-1,
  1)`) rather than adding a second asset or a parallel set of sprite-source
  coordinates — `playerFrameSource` and the sheet itself stay direction-agnostic.
- **Backward-compatible `stepPlayerPhysics` signature:** the new `input` parameter in
  Task 3 is defaulted, so none of the pre-existing gravity/vertical-collision tests
  from step 4 need to change.
- **No duplicated animation branching:** Task 1 replaces the idle-only `switch`
  statements with a single `ANIM_CONFIG` lookup table shared by `playerFrameSource`
  and `advancePlayerAnimation`, so the walk state's frame count/duration/sheet row is
  one new entry, not new branches in two places.
- **No placeholders:** every step has real code; no TBD/"similar to" references.
- **Type consistency:** `PlayerState` fields (`vx`, `facing`) are identical across
  Task 1 (definition), Task 2 (initialization), Task 3 (`Physics.ts` consumption),
  Task 5 (`Renderer.ts` consumption), and Task 6 (wiring). `HorizontalInput` shape
  (`{ left, right }`) identical in Task 3 (definition) and Task 6 (construction from
  `input.isHeld(...)`). `createKeyboardInput(): { isHeld, destroy }` signature
  identical in Task 4 (definition) and Task 6 (usage).
