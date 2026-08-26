# Platformer Step 6 — Jump Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add jump physics (fixed impulse + release-cutoff variable height) and a jump/fall
animation to the Platformer theme's player character, per roadmap step 6.

**Architecture:** Extend the existing pure-function physics/animation modules
(`Physics.ts`, `Player.ts`) rather than introducing new files — jump is one more
input-driven branch in the same per-frame step functions the walk/gravity code
already uses. The jump/fall animation uses a *second*, higher-resolution sprite
sheet (`knight2.png`, 128px frames) that the existing placeholder (`knight.png`,
32px frames) doesn't have a row for, so it gets its own small frame-source
function and its own image load, kept separate from the existing
`playerFrameSource`/idle+walk path so none of that code changes shape.

**Tech Stack:** TypeScript (strict), Vitest + React Testing Library, HTML Canvas 2D,
`@preact/signals-react` for `playerState`.

**Spec:** `specs/S-006-platformer-theme/spec.md` (FR-006, FR-007, FR-032),
`specs/S-006-platformer-theme/roadmap.md` (step 6),
`docs/themes/Platformer.md` ("Jump feel" section).

## Global Constraints

- Constitution: TDD — tests written before implementation, all tests passing before
  merge (`.specify/memory/constitution.md` Principle II).
- Constitution: named arrow function exports, typed props/params, no `any`
  (Principle III).
- FR-006: variable jump height by hold duration — short tap = small hop, long hold =
  full jump.
- FR-007: Space or Arrow Up triggers jump; up-arrow is reserved exclusively for
  jumping (not journal/UI). `A`/`D` remain accepted alternates for left/right only —
  unrelated to jump, don't touch that logic.
- FR-032: `PlayerState.animState` is exactly `'idle' | 'walk' | 'jump'` — no new
  public animation state is added for "falling"; rising vs. falling is resolved
  internally from `vy`'s sign, not exposed as a fourth state value.
- Tunneling invariant (documented in `PhysicsConfig.ts`): any velocity constant times
  `MAX_DT` (`1/30`) must stay below `RENDERED_TILE_SIZE` (32px), or discrete
  per-frame collision can let the player pass through a 1-tile-thick solid.
- Decided with the user for this step:
  - Variable height mechanism: **release cutoff** (fixed upward impulse on press;
    if the jump key isn't held while still ascending, velocity is dampened by a
    multiplier every frame until it's no longer negative).
  - Jump/fall art: the user supplied `public/sprites/knight2.png` (measured below)
    — freeze-on-idle was the fallback only if no art showed up; it did, so use it.
  - Coyote time / jump buffering: **deferred** to roadmap step 26 (Polish pass) —
    out of scope here.

---

## Sprite sheet reference (`public/sprites/knight2.png`)

Measured directly from the PNG (1024×484px, RGBA, transparent background). Two
rows are used; a third ("CLIMB (BACK VIEW)") is unused/out of scope.

| Row | Animation | Frames | Cell size | `sy` |
| --- | --- | --- | --- | --- |
| 0 | JUMP (rising) | 7 (columns 0–6; column 7 is a text label, unused) | 128×128 | `0` |
| 1 | FALL | 4 (columns 0–3; remainder is a text label, unused) | 128×128 | `161` |

Each frame is a fixed `128×128` cell at `sx = column * 128`. Content is
top/left-anchored within the cell with transparent padding on all sides (same
convention `knight.png` already uses at 32px — this is just a 4× larger version of
that convention), so cropping fixed `128×128` cells (not tight bounding boxes) keeps
frames aligned without extra per-frame offsets.

---

## Task 1: Jump physics constants

**Files:**
- Modify: `src/themes/platformer/engine/PhysicsConfig.ts`
- Test: `src/themes/platformer/engine/Physics.test.ts` (tunneling-invariant test lives
  alongside the existing ones for `terminalVelocity`/`walkSpeed`)

**Interfaces:**
- Produces: `PHYSICS_CONFIG.jumpVelocity: -600` (px/s, initial upward impulse),
  `PHYSICS_CONFIG.jumpCutMultiplier: 0.45` (applied to `vy` once per frame while
  ascending and the jump key isn't held).

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/engine/Physics.test.ts`, inside the existing
`describe('stepPlayerPhysics')` block, right after the `walkSpeed-timesMaxDt...`
test:

```ts
  it('jumpVelocity-timesMaxDt-staysBelowOneTile', () => {
    // Same tunneling invariant as gravity/walkSpeed above, but for the jump
    // impulse: a single frame's upward travel must never exceed one tile's
    // height or the player can tunnel through a 1-tile-thick ceiling.
    expect(Math.abs(PHYSICS_CONFIG.jumpVelocity) * MAX_DT).toBeLessThan(RENDERED_TILE_SIZE);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/Physics.test.ts -t jumpVelocity`
Expected: FAIL — `PHYSICS_CONFIG.jumpVelocity` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `src/themes/platformer/engine/PhysicsConfig.ts`, add two fields to
`PHYSICS_CONFIG` (after `walkSpeed`):

```ts
  /**
   * Initial upward velocity impulse on jump press, in px/s (negative = up).
   * Same tunneling invariant as `terminalVelocity`/`walkSpeed` applies:
   * `Math.abs(jumpVelocity) * MAX_DT` must stay below `RENDERED_TILE_SIZE`.
   */
  jumpVelocity: -600,
  /**
   * Multiplier applied to `vy` once per frame while ascending (`vy < 0`) and
   * the jump key isn't currently held (FR-006: variable jump height). A tap
   * lets gravity + this cutoff shrink the arc quickly into a small hop; a
   * full hold never triggers it, so the impulse decays only under gravity
   * and reaches the full arc.
   */
  jumpCutMultiplier: 0.45,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/engine/Physics.test.ts -t jumpVelocity`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/PhysicsConfig.ts src/themes/platformer/engine/Physics.test.ts
git commit -m "feat(platformer): add jump physics constants"
```

---

## Task 2: Edge-triggered key press detection in Input

The jump *trigger* must fire once per physical key press, not every frame the key
is held (holding Space shouldn't re-jump every tick once grounded again). The
existing `isHeld` is a level check (good for the variable-height hold check), so add
a separate edge-triggered `consumePress`.

**Files:**
- Modify: `src/themes/platformer/engine/Input.ts`
- Test: `src/themes/platformer/engine/Input.test.ts`

**Interfaces:**
- Produces: `KeyboardInput.consumePress(code: string): boolean` — returns `true`
  exactly once per physical keydown (ignores OS auto-repeat keydowns), `false`
  otherwise; calling it clears the pending press so a second call in the same tick
  returns `false` until the key is released and pressed again.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/Input.test.ts`, inside the
`describe('createKeyboardInput')` block:

```ts
  it('consumePress-beforeAnyKeyEvent-returnsFalse', () => {
    const input = createKeyboardInput();
    expect(input.consumePress('Space')).toBe(false);
    input.destroy();
  });

  it('consumePress-afterKeydown-returnsTrueOnce', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'Space');
    expect(input.consumePress('Space')).toBe(true);
    expect(input.consumePress('Space')).toBe(false);
    input.destroy();
  });

  it('consumePress-afterOsAutoRepeatKeydown-doesNotRefireOnceConsumed', () => {
    const input = createKeyboardInput();
    const first = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    window.dispatchEvent(first);
    expect(input.consumePress('Space')).toBe(true);

    const repeat = new KeyboardEvent('keydown', { code: 'Space', cancelable: true, repeat: true });
    window.dispatchEvent(repeat);
    expect(input.consumePress('Space')).toBe(false);
    input.destroy();
  });

  it('consumePress-afterKeyupThenKeydownAgain-returnsTrueForTheNewPress', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'Space');
    expect(input.consumePress('Space')).toBe(true);
    dispatchKey('keyup', 'Space');
    dispatchKey('keydown', 'Space');
    expect(input.consumePress('Space')).toBe(true);
    input.destroy();
  });

  it('destroy-afterCalled-clearsPendingPresses', () => {
    const input = createKeyboardInput();
    dispatchKey('keydown', 'Space');
    input.destroy();
    expect(input.consumePress('Space')).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Input.test.ts -t consumePress`
Expected: FAIL — `input.consumePress is not a function`.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/themes/platformer/engine/Input.ts`:

```ts
/**
 * Keys the game reads. Their default browser behavior (e.g. page scroll on
 * arrow keys) is suppressed so gameplay isn't fighting the page — FR-007
 * reserves Arrow Left/Right/Up and Space exclusively for the game.
 */
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD']);

export interface KeyboardInput {
  /** Whether `code` (a `KeyboardEvent.code` value, e.g. `'ArrowLeft'`) is currently held. */
  isHeld(code: string): boolean;
  /**
   * Edge-triggered: `true` exactly once per physical keydown (OS auto-repeat
   * keydowns while a key is held don't retrigger it), consuming the pending
   * press so a second call in the same tick returns `false` until the key is
   * released and pressed again. Used for actions that must fire once per
   * press rather than continuously (e.g. jump).
   */
  consumePress(code: string): boolean;
  /** Removes the window listeners and clears all held-key/pending-press state. */
  destroy(): void;
}

/**
 * Tracks which keys are currently held, polled per-frame by the game loop
 * (FR-007: input is read every tick so held keys produce continuous
 * movement) instead of reacting to individual keystrokes.
 */
export function createKeyboardInput(): KeyboardInput {
  const held = new Set<string>();
  const justPressed = new Set<string>();

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) justPressed.add(e.code);
    held.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    held.delete(e.code);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    isHeld: (code: string) => held.has(code),
    consumePress(code: string) {
      const wasPressed = justPressed.has(code);
      justPressed.delete(code);
      return wasPressed;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      held.clear();
      justPressed.clear();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Input.test.ts`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Input.ts src/themes/platformer/engine/Input.test.ts
git commit -m "feat(platformer): add edge-triggered consumePress to keyboard input"
```

---

## Task 3: Jump trigger, variable height, and ceiling collision in Physics

**Files:**
- Modify: `src/themes/platformer/engine/Physics.ts`
- Test: `src/themes/platformer/engine/Physics.test.ts`

**Interfaces:**
- Consumes: `PHYSICS_CONFIG.jumpVelocity`, `PHYSICS_CONFIG.jumpCutMultiplier` (Task
  1); `isSolid`, `tileAt`, `RENDERED_TILE_SIZE` (existing, `../level/Terrain`).
- Produces: `PlayerInput` (renamed from `HorizontalInput`, same `left`/`right`
  fields, plus new optional `jumpPressed?: boolean` and `jumpHeld?: boolean`,
  both defaulting to `false`) — `stepPlayerPhysics`'s 4th parameter. Grounded jump
  trigger + ceiling-bonk collision folded into the existing vertical-resolution
  branch of `stepPlayerPhysics`.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/Physics.test.ts`. First, a new level fixture
(a solid ceiling instead of solid ground) near the other level fixtures at the top
of the file, right after `PIT_LEVEL`:

```ts
// Same footprint as GROUND_LEVEL, but the solid row is on top instead of the
// bottom — used to test the upward (ceiling) collision case jump introduces.
const CEILING_LEVEL = parseLevel(['GG', '..', '..', '..']);
```

Then add a new `describe` block at the end of the file:

```ts
describe('stepPlayerPhysics jump', () => {
  it('jumpPressed-whileGrounded-setsUpwardVelocityAndLeavesGround', () => {
    const player = basePlayer({ vy: 0, grounded: true });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpPressed: true,
      jumpHeld: true,
    });
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60);
    expect(next.grounded).toBe(false);
  });

  it('jumpPressed-whileAirborne-isIgnoredNoDoubleJump', () => {
    const player = basePlayer({ vy: -200, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpPressed: true,
      jumpHeld: true,
    });
    expect(next.vy).toBeCloseTo(-200 + PHYSICS_CONFIG.gravity / 60);
  });

  it('jumpHeldFalse-whileAscending-cutsVelocityByMultiplier', () => {
    const player = basePlayer({ vy: PHYSICS_CONFIG.jumpVelocity, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpHeld: false,
    });
    const beforeCut = PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60;
    expect(next.vy).toBeCloseTo(beforeCut * PHYSICS_CONFIG.jumpCutMultiplier);
  });

  it('jumpHeldTrue-whileAscending-appliesNoCut', () => {
    const player = basePlayer({ vy: PHYSICS_CONFIG.jumpVelocity, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpHeld: true,
    });
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60);
  });

  it('jumpHeldFalse-whileDescending-appliesNoCut', () => {
    // The cutoff only ever shortens an ascent — it must not also brake a fall.
    const player = basePlayer({ vy: 50, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, {
      left: false,
      right: false,
      jumpHeld: false,
    });
    expect(next.vy).toBeCloseTo(50 + PHYSICS_CONFIG.gravity / 60);
  });

  it('movingUpIntoCeiling-overshootsInOneFrame-clampsToTileBottomEdgeAndZeroesVelocity', () => {
    const ceilingBottomY = RENDERED_TILE_SIZE; // row 0 is solid; row 1 starts here
    // Start 1px below the ceiling, moving up fast enough to overshoot through
    // it in a single frame. jumpHeld: true avoids the variable-height cutoff
    // so this test isolates collision behavior.
    const player = basePlayer({ y: ceilingBottomY + 1, vy: -1000, grounded: false });

    const next = stepPlayerPhysics(player, CEILING_LEVEL, 1 / 60, { jumpHeld: true });

    expect(next.y).toBe(ceilingBottomY);
    expect(next.vy).toBe(0);
    expect(next.grounded).toBe(false);
  });

  it('movingUpWithNoCeilingAbove-keepsRisingUngrounded', () => {
    const player = basePlayer({ y: 500, vy: -400, grounded: false });
    const next = stepPlayerPhysics(player, PIT_LEVEL, 1 / 60, { jumpHeld: true });
    expect(next.y).toBeLessThan(player.y);
    expect(next.grounded).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Physics.test.ts -t jump`
Expected: FAIL — jump-related assertions don't hold yet (no jump/ceiling logic
exists), and TypeScript will also flag the unknown `jumpPressed`/`jumpHeld` fields
on the input object until Step 3 adds them to the type.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/themes/platformer/engine/Physics.ts`:

```ts
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';

/**
 * One frame's worth of player input. `left`/`right` default to no movement so
 * gravity-only call sites (and existing tests) keep working unchanged.
 * `jumpPressed` is edge-triggered (true only on the frame the key was
 * pressed — see `Input.ts`'s `consumePress`); `jumpHeld` is a level check
 * (true for every frame the key is down — see `Input.ts`'s `isHeld`). Both
 * default to `false`.
 */
export interface PlayerInput {
  left: boolean;
  right: boolean;
  jumpPressed?: boolean;
  jumpHeld?: boolean;
}

const NO_INPUT: PlayerInput = { left: false, right: false };

/**
 * Resolves one frame of horizontal movement/collision, then jump/gravity and
 * vertical collision, against the level's solid tiles.
 */
export function stepPlayerPhysics(
  player: PlayerState,
  level: LevelDef,
  dt: number,
  input: PlayerInput = NO_INPUT,
): PlayerState {
  const moveRight = input.right && !input.left;
  const moveLeft = input.left && !input.right;
  // `vx` reflects commanded/intended velocity from input, not realized
  // displacement — a wall or world-bounds clamp below may prevent `x` from
  // actually changing this frame even though `vx` stays non-zero. Any future
  // code that infers "the player moved" (dust particles, camera easing) from
  // `vx !== 0` should account for that.
  const vx = moveRight ? PHYSICS_CONFIG.walkSpeed : moveLeft ? -PHYSICS_CONFIG.walkSpeed : 0;
  const facing = moveRight ? 'right' : moveLeft ? 'left' : player.facing;

  let x = player.x + vx * dt;
  const topRow = Math.floor(player.y / RENDERED_TILE_SIZE);
  // Excludes the foot-padding sliver (like the vertical ground check below)
  // so standing on solid ground doesn't register as a horizontal wall
  // collision on every frame the player tries to walk.
  const bottomRow = Math.floor(
    (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - 1) / RENDERED_TILE_SIZE,
  );

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

  const maxX = level.width * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE;
  x = Math.max(0, Math.min(x, maxX));

  // Jump trigger (FR-006): a fixed upward impulse, only while grounded — no
  // double jump. Ignored entirely while already airborne.
  const jumpStarts = player.grounded && Boolean(input.jumpPressed);
  let vy = jumpStarts ? PHYSICS_CONFIG.jumpVelocity : player.vy;
  vy = Math.min(vy + PHYSICS_CONFIG.gravity * dt, PHYSICS_CONFIG.terminalVelocity);

  // Variable jump height (FR-006): releasing the jump key while still
  // ascending cuts the velocity short via a multiplier instead of a fixed
  // clamp, so the resulting height scales with how long the key was held
  // before release rather than snapping to one fixed "short hop" value.
  if (!input.jumpHeld && vy < 0) {
    vy *= PHYSICS_CONFIG.jumpCutMultiplier;
  }

  let y = player.y + vy * dt;
  let grounded = false;
  let resolvedVy = vy;

  const leftCol = Math.floor(x / RENDERED_TILE_SIZE);
  const rightCol = Math.floor((x + PLAYER_RENDERED_SIZE - 1) / RENDERED_TILE_SIZE);

  if (vy < 0) {
    // Ceiling collision: symmetric to the landing case below, but for the
    // player's head hitting a solid tile from underneath while rising.
    const headRow = Math.floor(y / RENDERED_TILE_SIZE);
    for (let col = leftCol; col <= rightCol; col++) {
      if (isSolid(tileAt(level, col, headRow))) {
        y = (headRow + 1) * RENDERED_TILE_SIZE;
        resolvedVy = 0;
        break;
      }
    }
  } else {
    const feetY = y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
    const footRow = Math.floor(feetY / RENDERED_TILE_SIZE);

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Physics.test.ts`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Physics.ts src/themes/platformer/engine/Physics.test.ts
git commit -m "feat(platformer): implement jump trigger, variable height, and ceiling collision"
```

---

## Task 4: Jump/fall animation frames in Player

**Files:**
- Modify: `src/themes/platformer/entities/Player.ts`
- Test: `src/themes/platformer/entities/Player.test.ts`

**Interfaces:**
- Produces: `PlayerAnimState` now includes `'jump'`. `JUMP_FRAME_SIZE = 128`.
  `jumpFrameSource(vy: number, frame: number): { sx: number; sy: number }` —
  `vy < 0` (rising) selects the 7-frame JUMP row (`sy: 0`), `vy >= 0` (falling or
  momentarily at rest at the apex) selects the 4-frame FALL row (`sy: 161`).
  `updatePlayerAnimState` now prioritizes `!player.grounded` → `'jump'` over the
  existing `vx !== 0` → `'walk'` check.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/entities/Player.test.ts`:

```ts
describe('playerFrameSource jump row', () => {
  it('jumpFrameSource-risingFrame0-returnsFirstJumpColumnAtJumpRow', () => {
    expect(jumpFrameSource(-100, 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('jumpFrameSource-risingFrame3-returnsFourthJumpColumnAtJumpRow', () => {
    expect(jumpFrameSource(-100, 3)).toEqual({ sx: 3 * JUMP_FRAME_SIZE, sy: 0 });
  });

  it('jumpFrameSource-risingFrame7-wrapsToFirstJumpColumn', () => {
    // 7 real JUMP frames (column 7 in the sheet is a text label, unused).
    expect(jumpFrameSource(-100, 7)).toEqual({ sx: 0, sy: 0 });
  });

  it('jumpFrameSource-fallingFrame0-returnsFirstFallColumnAtFallRow', () => {
    expect(jumpFrameSource(50, 0)).toEqual({ sx: 0, sy: 161 });
  });

  it('jumpFrameSource-fallingFrame5-wrapsWithinFourFallFrames', () => {
    // Only 4 real FALL frames, so frame 5 wraps to column 1 (5 % 4 = 1).
    expect(jumpFrameSource(50, 5)).toEqual({ sx: JUMP_FRAME_SIZE, sy: 161 });
  });

  it('jumpFrameSource-vyExactlyZero-treatedAsFalling', () => {
    // The apex of the arc: no longer rising, so it reads as the fall pose
    // rather than staying pinned to the last rising frame.
    expect(jumpFrameSource(0, 0)).toEqual({ sx: 0, sy: 161 });
  });
});

describe('updatePlayerAnimState jump priority', () => {
  it('updatePlayerAnimState-notGrounded-switchesToJumpEvenWithZeroVx', () => {
    const player = idlePlayer({ vx: 0, grounded: false, animState: 'idle' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('jump');
  });

  it('updatePlayerAnimState-notGroundedWithNonZeroVx-stillSwitchesToJumpNotWalk', () => {
    const player = idlePlayer({ vx: 200, grounded: false, animState: 'walk' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('jump');
  });

  it('updatePlayerAnimState-groundedAfterJumpWithZeroVx-switchesBackToIdle', () => {
    const player = idlePlayer({ vx: 0, grounded: true, animState: 'jump' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('idle');
  });

  it('updatePlayerAnimState-groundedAfterJumpWithNonZeroVx-switchesToWalk', () => {
    const player = idlePlayer({ vx: 200, grounded: true, animState: 'jump' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('walk');
  });
});
```

Also add `jumpFrameSource` and `JUMP_FRAME_SIZE` to the existing import block at
the top of the test file:

```ts
import {
  playerFrameSource,
  jumpFrameSource,
  PLAYER_FRAME_SIZE,
  JUMP_FRAME_SIZE,
  PLAYER_RENDERED_SIZE,
  advancePlayerAnimation,
  updatePlayerAnimState,
  IDLE_FRAME_DURATION,
} from './Player';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts -t jump`
Expected: FAIL — `jumpFrameSource`/`JUMP_FRAME_SIZE` don't exist yet, and
`updatePlayerAnimState` doesn't yet special-case `grounded`.

- [ ] **Step 3: Write minimal implementation**

In `src/themes/platformer/entities/Player.ts`:

1. Change the `PlayerAnimState` type:

```ts
export type PlayerAnimState = 'idle' | 'walk' | 'jump';
```

2. Add a jump-specific entry to `ANIM_CONFIG` (used only for the animation
   *timer* — `frameCount`/`frameDuration` — since `jumpFrameSource` below picks
   the actual sprite row/frame independently):

```ts
const ANIM_CONFIG: Record<
  PlayerAnimState,
  { frameCount: number; frameDuration: number; sy: number }
> = {
  idle: { frameCount: 4, frameDuration: 0.15, sy: 0 },
  walk: { frameCount: 8, frameDuration: 0.08, sy: PLAYER_FRAME_SIZE * 2 },
  jump: { frameCount: 7, frameDuration: 0.055, sy: 0 },
};
```

3. Add the jump sprite sheet constants and `jumpFrameSource`, right after
   `playerFrameSource`:

```ts
/**
 * `knight2.png` uses 128px frames (4x `PLAYER_FRAME_SIZE`) — the placeholder
 * `knight.png` sheet has no jump row, so jump/fall use this separate,
 * higher-resolution sheet and their own frame size instead of extending
 * `playerFrameSource`.
 */
export const JUMP_FRAME_SIZE = 128;
const JUMP_ROW_FRAME_COUNT = 7;
const JUMP_ROW_SY = 0;
const FALL_ROW_FRAME_COUNT = 4;
const FALL_ROW_SY = 161;

/**
 * Frame source for the jump/fall animation, keyed by the player's vertical
 * velocity rather than a separate `animState` value (FR-032 keeps
 * `animState` limited to `'idle' | 'walk' | 'jump'`): rising (`vy < 0`) uses
 * the 7-frame JUMP row, falling or at the arc's apex (`vy >= 0`) uses the
 * 4-frame FALL row.
 */
export function jumpFrameSource(vy: number, frame: number): { sx: number; sy: number } {
  if (vy < 0) {
    return { sx: (frame % JUMP_ROW_FRAME_COUNT) * JUMP_FRAME_SIZE, sy: JUMP_ROW_SY };
  }
  return { sx: (frame % FALL_ROW_FRAME_COUNT) * JUMP_FRAME_SIZE, sy: FALL_ROW_SY };
}
```

4. Update `updatePlayerAnimState` to prioritize airborne state:

```ts
/**
 * Switches `animState` between `idle`/`walk`/`jump`, resetting the animation
 * frame/timer whenever the state actually changes so a leftover frame index
 * from the previous state's cycle never carries over. Airborne (`!grounded`)
 * takes priority over horizontal velocity — the character can be moving
 * horizontally while jumping, but it still reads as `'jump'`, not `'walk'`.
 */
export function updatePlayerAnimState(player: PlayerState): PlayerState {
  const animState: PlayerAnimState = !player.grounded
    ? 'jump'
    : player.vx !== 0
      ? 'walk'
      : 'idle';
  if (animState === player.animState) return player;
  return { ...player, animState, animFrame: 0, animTimer: 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Player.ts src/themes/platformer/entities/Player.test.ts
git commit -m "feat(platformer): add jump/fall animation frame source and anim-state priority"
```

---

## Task 5: Render the jump/fall sprite in Renderer

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `jumpFrameSource`, `JUMP_FRAME_SIZE` (Task 4).
- Produces: `drawPlayer`'s signature gains a 5th, optional parameter —
  `drawPlayer(ctx, player, spriteSheet, originY = 0, jumpSpriteSheet:
  HTMLImageElement | null = null)`. Appended after `originY` (not inserted before
  it) so every existing call site and test keeps working unchanged. When
  `player.animState === 'jump'` and `jumpSpriteSheet` is non-null, draws from
  `jumpSpriteSheet` using `jumpFrameSource`/`JUMP_FRAME_SIZE` instead of the
  primary sheet; otherwise unchanged (including a graceful fallback to the
  primary sheet's idle frame if `jumpSpriteSheet` hasn't loaded yet).

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/Renderer.test.ts`, inside the
`describe('drawPlayer')` block:

```ts
  it('jumpStateRising-withJumpSpriteSheet-drawsFromJumpSheetAtJumpFrameSize', () => {
    const ctx = makeMockContext();
    const jumpSheet = {} as HTMLImageElement;
    const player: PlayerState = { ...idlePlayer, animState: 'jump', vy: -300, animFrame: 2 };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, jumpSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      jumpSheet,
      2 * 128,
      0,
      128,
      128,
      16 + PLAYER_SIDE_PADDING,
      256,
      64,
      64,
    );
  });

  it('jumpStateFalling-withJumpSpriteSheet-drawsFromFallRow', () => {
    const ctx = makeMockContext();
    const jumpSheet = {} as HTMLImageElement;
    const player: PlayerState = { ...idlePlayer, animState: 'jump', vy: 100, animFrame: 1 };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, jumpSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      jumpSheet,
      1 * 128,
      161,
      128,
      128,
      16 + PLAYER_SIDE_PADDING,
      256,
      64,
      64,
    );
  });

  it('jumpState-noJumpSpriteSheetProvided-fallsBackToPrimarySheetIdleFrame', () => {
    const ctx = makeMockContext();
    const player: PlayerState = { ...idlePlayer, animState: 'jump', vy: -300 };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, null);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeSpriteSheet,
      0,
      0,
      32,
      32,
      16 + PLAYER_SIDE_PADDING,
      256,
      64,
      64,
    );
  });

  it('jumpStateFacingLeft-withJumpSpriteSheet-drawsFlippedFromJumpSheet', () => {
    const ctx = makeMockContext();
    const jumpSheet = {} as HTMLImageElement;
    const player: PlayerState = {
      ...idlePlayer,
      animState: 'jump',
      vy: -300,
      facing: 'left',
    };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, jumpSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(jumpSheet, 0, 0, 128, 128, 0, 0, 64, 64);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts -t jump`
Expected: FAIL — `drawPlayer` doesn't accept/use a 5th argument yet.

- [ ] **Step 3: Write minimal implementation**

In `src/themes/platformer/engine/Renderer.ts`, update the import and
`drawPlayer` function:

```ts
import {
  PLAYER_FRAME_SIZE,
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  JUMP_FRAME_SIZE,
  playerFrameSource,
  jumpFrameSource,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
```

```ts
/**
 * Draws the player sprite. `originY` shifts it vertically by the same
 * amount as `drawTerrain`'s `originY`, so the player stays aligned with
 * the bottom-anchored level. When `player.facing` is `'left'`, the sprite is
 * mirrored horizontally around its own bounding box — the sheet only needs
 * to depict the character facing one direction. `jumpSpriteSheet` is a
 * separate, higher-resolution sheet used only while `animState === 'jump'`
 * (the placeholder primary sheet has no jump row); if it hasn't loaded yet,
 * this falls back to the primary sheet's current frame rather than drawing
 * nothing.
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  spriteSheet: HTMLImageElement,
  originY = 0,
  jumpSpriteSheet: HTMLImageElement | null = null,
): void {
  ctx.imageSmoothingEnabled = false;

  const useJumpSheet = player.animState === 'jump' && jumpSpriteSheet !== null;
  const frameSize = useJumpSheet ? JUMP_FRAME_SIZE : PLAYER_FRAME_SIZE;
  const sheet = useJumpSheet ? jumpSpriteSheet : spriteSheet;
  const { sx, sy } = useJumpSheet
    ? jumpFrameSource(player.vy, player.animFrame)
    : playerFrameSource(player.animState, player.animFrame);

  if (player.facing === 'left') {
    ctx.save();
    ctx.translate(player.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING, player.y + originY);
    ctx.scale(-1, 1);
    ctx.drawImage(
      sheet,
      sx,
      sy,
      frameSize,
      frameSize,
      0,
      0,
      PLAYER_RENDERED_SIZE,
      PLAYER_RENDERED_SIZE,
    );
    ctx.restore();
    return;
  }

  ctx.drawImage(
    sheet,
    sx,
    sy,
    frameSize,
    frameSize,
    player.x + PLAYER_SIDE_PADDING,
    player.y + originY,
    PLAYER_RENDERED_SIZE,
    PLAYER_RENDERED_SIZE,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): render jump/fall frames from the secondary sprite sheet"
```

---

## Task 6: Wire jump input and the jump sprite sheet into PlatformerPage

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `input.consumePress`/`input.isHeld` (Task 2), `stepPlayerPhysics`'s
  `PlayerInput` (Task 3), `drawPlayer`'s 5th parameter (Task 5).
- Produces: pressing Space or Arrow Up while grounded jumps; holding either key
  sustains the full arc, releasing early cuts it short (FR-006/FR-007).

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/PlatformerPage.test.tsx`, after the
`keyAHeld-gameLoopTicks-...` test:

```ts
  it('spacePressed-whileGrounded-triggersJumpNextTick', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16); // lands the spawned player on the ground first
    expect(playerState.value.grounded).toBe(true);

    fireEvent.keyDown(window, { code: 'Space' });
    frameCallback!(32);

    expect(playerState.value.grounded).toBe(false);
    expect(playerState.value.vy).toBeLessThan(0);
    expect(playerState.value.animState).toBe('jump');
  });

  it('arrowUpPressed-whileGrounded-alsoTriggersJump', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);
    expect(playerState.value.grounded).toBe(true);

    fireEvent.keyDown(window, { code: 'ArrowUp' });
    frameCallback!(32);

    expect(playerState.value.grounded).toBe(false);
    expect(playerState.value.vy).toBeLessThan(0);
  });

  it('spaceReleasedEarly-whileAscending-resultsInLowerVelocityThanHeldJump', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);

    fireEvent.keyDown(window, { code: 'Space' });
    frameCallback!(32); // jump triggers this tick
    const vyRightAfterJump = playerState.value.vy;

    fireEvent.keyUp(window, { code: 'Space' });
    frameCallback!(48); // released before reaching the apex

    expect(playerState.value.vy).toBeGreaterThan(vyRightAfterJump);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx -t jump`
Expected: FAIL — pressing Space/ArrowUp currently does nothing (no jump wiring in
the game loop yet).

- [ ] **Step 3: Write minimal implementation**

In `src/themes/platformer/PlatformerPage.tsx`:

1. Add a ref for the jump sprite sheet, alongside `playerSpriteRef`:

```ts
  const playerJumpSpriteRef = useRef<HTMLImageElement | null>(null);
```

2. Update `render()`'s player-drawing call to pass it through:

```ts
      if (playerSpriteRef.current) {
        drawPlayer(ctx, playerState.value, playerSpriteRef.current, originY, playerJumpSpriteRef.current);
      }
```

3. Update the game loop's per-tick input handling to include jump, consuming the
   press exactly once per tick from both accepted keys:

```ts
    const loop = createGameLoop((dt) => {
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

      let next = stepPlayerPhysics(playerState.value, level1, dt, {
        ...horizontal,
        jumpPressed,
        jumpHeld,
      });
      next = updatePlayerAnimState(next);
      next = advancePlayerAnimation(next, dt);
      playerState.value = next;
      render();
    });
```

4. Load the second sprite sheet alongside the first, right after the existing
   `knight.png` load:

```ts
    loadImage('/sprites/knight2.png')
      .then((img) => {
        if (cancelled) return;
        playerJumpSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Jump falls back to the primary sheet's current frame if this one
        // fails to load (see Renderer.ts's drawPlayer).
      });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — every test in the repo, not just the platformer theme.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): wire jump input and jump sprite sheet into the game loop"
```

---

## Task 7: Manual browser verification + roadmap check-off

Not a code task — this closes out the step per the roadmap's working agreement
("TDD, then a manual browser check before moving to the next step").

- [ ] **Step 1: Start the dev server and open the Platformer theme**

Use the `Claude_Browser` preview tools (or `npm run dev` + a normal browser) to
load the site, switch to the Platformer theme.

- [ ] **Step 2: Verify basic jump**

Press Space (and separately, on reload, Arrow Up) while standing on the ground.
Confirm the character leaves the ground, the sprite visibly changes to the
jump/fall pose (not idle/walk), and it lands again without clipping into the
terrain.

- [ ] **Step 3: Verify variable height**

Tap Space very briefly — confirm a small hop. Hold Space down — confirm a
noticeably higher jump. This is the core FR-006 behavior for this step.

- [ ] **Step 4: Verify jumping across a gap**

Walk to the floating 3-tile platform in `level1` (`PPP`, above the grass zone) and
jump onto it from the ground — confirms both height and horizontal-carry-over
work together, satisfying the roadmap's "jump across a gap" check.

- [ ] **Step 5: Verify the ceiling case doesn't break anything visible**

Jump underneath the wall/platform tiles if reachable and confirm the character
stops rising rather than clipping through — this is the ceiling-collision path
added in Task 3, not explicitly called out in the roadmap's verify line but part
of FR-006's collision requirement.

- [ ] **Step 6: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, change step 6's `- [ ]` to `- [x]`.

- [ ] **Step 7: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): check off roadmap step 6 (jump) — verified in browser"
```

---

## Branching (per roadmap's working agreement)

This step should be built on its own branch off `S-006-platformer-theme`:

```bash
git checkout S-006-platformer-theme
git pull
git checkout -b S-006-step6-jump
```

...and land via a PR into `S-006-platformer-theme` (not `main`) once all tasks
above are done and reviewed, then the branch deleted.
