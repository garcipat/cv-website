# Ladders (Climbing) + Vertical Camera Follow (Roadmap Step 23) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `'ladder'` terrain tile the character can climb (free-form: Up/Down move vertically at a fixed speed with gravity suspended, Left/Right still work normally, Space cancels into a jump), and a vertical camera follow that scrolls the viewport once a level's height exceeds it — a no-op on every level shipped so far. `level1` gets a real ladder, extended above its existing floating platform into a new, deliberately throwaway/replaceable tier, tall enough to force real vertical scrolling on a real desktop browser window.

**Architecture:** Follows the same pattern `bridge` used when added in roadmap step 7: a new `TileType` + a `isSolid`-sibling helper (`isClimbable`), a new `Physics.ts` branch gated by a new `PlayerState.climbing` boolean, a new animation state reusing `knight2.png`'s already-present (previously unwired) climb row, and a new camera axis (`updateCameraY`/`cameraPositionY`) parallel to — not merged with — the existing horizontal camera, so the shipped, tested horizontal logic is untouched.

**Tech Stack:** Vite + React 19 + TypeScript strict + `@preact/signals-react` + Vitest/RTL (matches the rest of the platformer theme).

**Spec:** `specs/S-006-platformer-theme/spec.md` (User Story 6b, FR-005/006/007/008/031/032) and `specs/S-006-platformer-theme/roadmap.md` (step 23).

## Global Constraints

- Typed data architecture: no `any` types; TypeScript strict mode stays clean.
- TDD: every new pure function/component gets a failing test first, per the constitution.
- Named arrow/function exports only, no default exports.
- No new dependencies, no backend/API calls. No new image asset — climbing reuses `knight2.png`'s existing "climb (back view)" row, already loaded as `playerJumpSpriteRef`.
- Free-form climbing (not column-locked): Left/Right move at the normal walk speed while climbing; moving off every overlapping ladder tile ends the climb immediately.
- Vertical camera follow must be a verified no-op on any level whose height fits the viewport — the existing bottom-anchored formula must produce byte-identical `originY` values for every level shipped before this step.
- `LevelParser.parseLevel`'s row-length behavior changes from throwing on a mismatch to padding every row to the widest row's width with `'empty'` — this MUST NOT change parsing output for any level whose rows are already equal length (every level shipped so far).

---

## Task 1: `ladder` tile type + `isClimbable` + level-authoring support

**Files:**
- Modify: `src/themes/platformer/level/LevelData.ts`
- Modify: `src/themes/platformer/level/Terrain.ts`
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Test: `src/themes/platformer/level/Terrain.test.ts`
- Test: `src/themes/platformer/level/LevelParser.test.ts`

**Interfaces:**
- Produces: `TileType` gains `'ladder'`; `isClimbable(tile: TileType): boolean` (`./Terrain`); `TERRAIN_CHARS['L'] === 'ladder'` (`./LevelParser`); `parseLevel` now pads ragged rows instead of throwing — consumed by Task 8's `level1.ts` and Task 3's `Physics.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/level/Terrain.test.ts` (add `isClimbable` to the existing import from `./Terrain`):

```ts
describe('isClimbable', () => {
  it('ladder-returnsTrue', () => {
    expect(isClimbable('ladder')).toBe(true);
  });

  it('everyOtherTile-returnsFalse', () => {
    expect(isClimbable('groundGrass')).toBe(false);
    expect(isClimbable('groundRock')).toBe(false);
    expect(isClimbable('platform')).toBe(false);
    expect(isClimbable('wall')).toBe(false);
    expect(isClimbable('bridge')).toBe(false);
    expect(isClimbable('empty')).toBe(false);
  });
});

describe('isSolid ladder exception', () => {
  it('ladder-isNotSolid', () => {
    expect(isSolid('ladder')).toBe(false);
  });
});
```

Add to `src/themes/platformer/level/LevelParser.test.ts` (`TERRAIN_CHARS` is already imported):

```ts
describe('parseLevel ragged rows (padding, not throwing)', () => {
  it('shorterRow-padsWithEmptyUpToWidestRowsWidth', () => {
    const result = parseLevel(['GGG', 'G']);
    expect(result.width).toBe(3);
    expect(result.terrain[1]).toEqual(['groundGrass', 'empty', 'empty']);
  });

  it('allRowsAlreadyEqualLength-behavesExactlyAsBefore', () => {
    const result = parseLevel(['GG', 'WW']);
    expect(result.width).toBe(2);
    expect(result.terrain).toEqual([
      ['groundGrass', 'groundGrass'],
      ['wall', 'wall'],
    ]);
  });
});

describe('ladder terrain character', () => {
  it('terrainChars-mapsLToLadder', () => {
    expect(TERRAIN_CHARS.L).toBe('ladder');
  });

  it('ladderChar-parsesAsLadderTile', () => {
    const result = parseLevel(['L.', 'GG']);
    expect(result.terrain[0][0]).toBe('ladder');
  });
});
```

Delete the now-obsolete `'raggedRows-throws'` test (it asserted the old throwing behavior, which this step deliberately replaces):

```ts
  it('raggedRows-throws', () => {
    expect(() => parseLevel(['GG', 'G'])).toThrow('Row 1 has length 1, expected 2');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Terrain.test.ts LevelParser.test.ts`
Expected: FAIL — `isClimbable`/`'ladder'`/`TERRAIN_CHARS.L` don't exist yet, and `parseLevel(['GGG', 'G'])` still throws instead of padding.

- [ ] **Step 3: Implement**

In `src/themes/platformer/level/LevelData.ts`, add `'ladder'` to the union:

```ts
export type TileType =
  | 'groundGrass'
  | 'groundRock'
  | 'platform'
  | 'wall'
  | 'bridge'
  | 'ladder'
  | 'empty';
```

In `src/themes/platformer/level/Terrain.ts`, add after `isSolidExcludingBridge`:

```ts
/**
 * Whether the player can climb this tile (roadmap step 23) — currently only
 * `'ladder'`. Deliberately NOT part of `isSolid`: a ladder never blocks
 * horizontal movement or counts as ground; `Physics.ts`'s climbing branch is
 * the only place vertical movement through a ladder tile is resolved.
 */
export function isClimbable(tile: TileType): boolean {
  return tile === 'ladder';
}
```

In `src/themes/platformer/level/LevelParser.ts`:

1. Add to `TERRAIN_CHARS`:

```ts
export const TERRAIN_CHARS: Record<string, TileType | undefined> = {
  '.': 'empty',
  G: 'groundGrass',
  R: 'groundRock',
  P: 'platform',
  W: 'wall',
  B: 'bridge',
  L: 'ladder',
};
```

2. Replace `parseLevel` with a version that pads instead of throwing on a length mismatch:

```ts
export function parseLevel(layout: readonly string[]): LevelDef {
  const height = layout.length;
  const width = layout.reduce((max, row) => Math.max(max, row.length), 0);

  const terrain: TileMap = layout.map((row) => {
    const chars = row.split('').map((char) => {
      const tile = TERRAIN_CHARS[char];
      if (tile) return tile;
      if (ENTITY_CHARS[char]) return 'empty';
      throw new Error(`Unknown level tile character: "${char}"`);
    });
    while (chars.length < width) chars.push('empty');
    return chars;
  });

  return { terrain, width, height };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Terrain.test.ts LevelParser.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: PASS — no other file references the old throwing behavior or assumes `TileType` is a closed set without `'ladder'`.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/level/LevelData.ts src/themes/platformer/level/Terrain.ts src/themes/platformer/level/Terrain.test.ts src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts
git commit -m "feat(platformer): add ladder tile type and relax level row-length parsing"
```

---

## Task 2: `climbSpeed` physics constant

**Files:**
- Modify: `src/themes/platformer/engine/PhysicsConfig.ts`

**Interfaces:**
- Produces: `PHYSICS_CONFIG.climbSpeed` — consumed by Task 3's `Physics.ts`.

- [ ] **Step 1: Implement**

In `src/themes/platformer/engine/PhysicsConfig.ts`, add after `enemyPatrolSpeed`:

```ts
  /**
   * Constant vertical speed while climbing a ladder (roadmap step 23), in
   * px/s, in either direction — slower than horizontal walkSpeed (200) so
   * climbing reads as deliberate effort rather than matching normal
   * movement pace. Same tunneling invariant as the other velocity constants:
   * `climbSpeed * MAX_DT` must stay below RENDERED_TILE_SIZE (32px):
   * 120 * (1/30) = 4 < 32. ✓
   */
  climbSpeed: 120,
```

No test file — this is a plain data constant, exercised indirectly through Task 3's `Physics.test.ts`.

- [ ] **Step 2: Commit**

```bash
git add src/themes/platformer/engine/PhysicsConfig.ts
git commit -m "feat(platformer): add climbSpeed physics constant"
```

---

## Task 3: Climbing physics branch in `Physics.ts`

**Files:**
- Modify: `src/themes/platformer/engine/Physics.ts`
- Test: `src/themes/platformer/engine/Physics.test.ts`

**Interfaces:**
- Consumes: `isClimbable` (`../level/Terrain`, Task 1); `PHYSICS_CONFIG.climbSpeed` (`./PhysicsConfig`, Task 2); `PlayerState.climbing` (`../entities/Player`, Task 4 — added in this task's own edit to `Player.ts`'s type, see note below).
- Produces: `PlayerInput.climbUpHeld?: boolean`; `stepPlayerPhysics` now returns `climbing: boolean` on every result — consumed by Task 4 (`updatePlayerAnimState`), Task 9 (`PlatformerPage.tsx`).

**Note on ordering:** this task's test file constructs `PlayerState` objects with a `climbing` field, so `entities/Player.ts`'s `PlayerState` type must already declare it. Do Task 4's **Step 1 type-only edit** (adding `climbing: boolean` to the interface and to `PlayerAnimState`, nothing else) before starting this task's Step 1 below, then return here. (Task 4's remaining steps — animation frames, `updatePlayerAnimState` — happen after this task, as written.)

- [ ] **Step 0: Add `climbing` to `PlayerState`** (prerequisite type-only edit)

In `src/themes/platformer/entities/Player.ts`, add `climbing: boolean;` to the `PlayerState` interface, right after `grounded: boolean;`:

```ts
  /** Whether the player is currently resting on a solid tile. */
  grounded: boolean;
  /** Whether the player is currently climbing a `'ladder'` tile (roadmap
   *  step 23) — while true, `Physics.ts`'s stepPlayerPhysics suspends
   *  gravity and drives vertical movement directly from Up/Down instead. */
  climbing: boolean;
```

Also add `'climb'` to the `PlayerAnimState` union (rendering/animation wiring for it is Task 4's job; declaring it here now avoids a second edit to this same union later):

```ts
export type PlayerAnimState = 'idle' | 'walk' | 'jump' | 'climb';
```

This alone does not compile cleanly yet (`ANIM_CONFIG` below is typed `Record<PlayerAnimState, ...>` and needs a `climb` entry) — add a temporary placeholder entry now, which Task 4 replaces with the real one:

```ts
const ANIM_CONFIG: Record<
  PlayerAnimState,
  { frameCount: number; frameDuration: number; sy: number }
> = {
  idle: { frameCount: 4, frameDuration: 0.15, sy: 0 },
  walk: { frameCount: 8, frameDuration: 0.08, sy: PLAYER_FRAME_SIZE * 2 },
  jump: { frameCount: 7, frameDuration: 0.062, sy: 0 },
  climb: { frameCount: 4, frameDuration: 0.1, sy: 0 },
};
```

(This is in fact the real, final entry — Task 4 does not need to change it again, only `Player.test.ts`'s existing `idlePlayer`/similar helpers, which are updated in Task 4.)

Every existing `PlayerState` object literal across the codebase now fails to compile without a `climbing` field. There are exactly four production/test files that construct one directly (found via `grep -rln "grounded:" src/themes/platformer`): `PlatformerState.ts`'s `spawnPlayerState()` (production), and three test helpers — `Player.test.ts`'s `idlePlayer()`, `Physics.test.ts`'s `basePlayer()`, `Collision.test.ts`'s `makePlayer()`, and `DebugOverlay.test.ts`'s inline fixture. `Renderer.test.ts`'s `idlePlayer` fixture is a fourth test-side one. Fix all of them now, in this step, so the build compiles cleanly before starting Task 3's own test/implementation work (Task 4 and Task 5 do NOT need to touch `climbing` in their own files again — it's already there):

1. In `src/themes/platformer/PlatformerState.ts`, in `spawnPlayerState()`'s returned object, add `climbing: false,` alongside `grounded: false,`.
2. In `src/themes/platformer/entities/Player.test.ts`, add `climbing: false,` to `idlePlayer()`'s returned object, alongside `grounded: true,`.
3. In `src/themes/platformer/engine/Physics.test.ts`, add `climbing: false,` to `basePlayer()`'s returned object, alongside `grounded: false,`.
4. In `src/themes/platformer/engine/Collision.test.ts`, add `climbing: false,` to `makePlayer()`'s returned object, alongside `grounded: true,`.
5. In `src/themes/platformer/engine/DebugOverlay.test.ts`, add `climbing: false,` to its player fixture, alongside `grounded: true,`.
6. In `src/themes/platformer/engine/Renderer.test.ts`, add `climbing: false,` to the `describe('drawPlayer', ...)` block's `idlePlayer` fixture, alongside `grounded: true,`.

Run: `npm run build` — expect PASS, zero TypeScript errors. (Task 4's and Task 5's own Step 1 sections below mention adding `climbing: false` to `Player.test.ts`'s/`Renderer.test.ts`'s fixtures again — that was already done here; skip re-doing it when you reach those tasks, it's called out there only so each task's Step 1 reads correctly in isolation.)

- [ ] **Step 1: Write the failing tests**

(`basePlayer()` already has `climbing: false,` from Step 0 above.) Add to `src/themes/platformer/engine/Physics.test.ts` this new level constant near the other `*_LEVEL` constants — no new import needed, `parseLevel` is already imported:

```ts
// 4 rows tall, 1 col wide: row 0 is solid ground reachable by climbing (the
// tile directly above the ladder's top rung, per FR-006); rows 1-2 are
// ladder; row 3 is solid ground the ladder starts from. Mirrors level1's
// real "ladder leads up to a platform" shape at a testable scale.
const LADDER_LEVEL = parseLevel(['G', 'L', 'L', 'G']);
```

Then add:

```ts
describe('stepPlayerPhysics climbing', () => {
  it('onLadderTile-climbUpHeld-entersClimbingAndMovesUpwardAtClimbSpeed', () => {
    const player = basePlayer({ x: 0, y: 20, grounded: false, climbing: false });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.grounded).toBe(false);
    expect(next.vy).toBeCloseTo(-PHYSICS_CONFIG.climbSpeed);
    expect(next.y).toBeCloseTo(20 - PHYSICS_CONFIG.climbSpeed / 60);
  });

  it('onLadderTile-dropThroughHeld-entersClimbingAndMovesDownwardAtClimbSpeed', () => {
    const player = basePlayer({ x: 0, y: 20, grounded: false, climbing: false });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { dropThroughHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.climbSpeed);
    expect(next.y).toBeCloseTo(20 + PHYSICS_CONFIG.climbSpeed / 60);
  });

  it('climbing-leftOrRightHeld-stillMovesHorizontallyAtNormalWalkSpeed', () => {
    const player = basePlayer({ x: 0, y: 20, grounded: false, climbing: true });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true, right: true });

    expect(next.vx).toBeCloseTo(PHYSICS_CONFIG.walkSpeed);
    expect(next.x).toBeCloseTo(PHYSICS_CONFIG.walkSpeed / 60);
  });

  it('climbingButFeetNoLongerOnLadderTile-exitsClimbingAndFallsUnderGravityFromRest', () => {
    // y = -40 places the feet row on row 0 (the solid platform above the
    // ladder's top rung), not a ladder tile — simulates having just climbed
    // past the top.
    const player = basePlayer({
      x: 0,
      y: -40,
      vy: -PHYSICS_CONFIG.climbSpeed,
      grounded: false,
      climbing: true,
    });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { climbUpHeld: true });

    expect(next.climbing).toBe(false);
    // Falls from rest (vy=0), not from the old climb speed — one frame of
    // gravity accumulation from a standstill.
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.gravity / 60);
  });

  it('climbingAndJumpPressed-cancelsClimbAndAppliesNormalJumpImpulseEvenThoughNotGrounded', () => {
    const player = basePlayer({
      x: 0,
      y: 20,
      vy: -PHYSICS_CONFIG.climbSpeed,
      grounded: false,
      climbing: true,
    });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { jumpPressed: true });

    expect(next.climbing).toBe(false);
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.jumpVelocity + PHYSICS_CONFIG.gravity / 60);
  });

  it('standingOnPlatformAboveLaddersTopRung-dropThroughHeld-reEntersClimbDownward', () => {
    // y = -40: feet rest on row 0's solid tile, directly above the ladder's
    // top rung at row 1 — FR-006's "press Down to re-enter the climb" case.
    const player = basePlayer({ x: 0, y: -40, vy: 0, grounded: true, climbing: false });

    const next = stepPlayerPhysics(player, LADDER_LEVEL, 1 / 60, { dropThroughHeld: true });

    expect(next.climbing).toBe(true);
    expect(next.grounded).toBe(false);
    expect(next.vy).toBeCloseTo(PHYSICS_CONFIG.climbSpeed);
  });

  it('groundedOnRegularGroundWithNoLadderNearby-dropThroughHeld-doesNotStartClimbing', () => {
    const restY = 3 * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({ x: 0, y: restY, vy: 0, grounded: true, climbing: false });

    const next = stepPlayerPhysics(player, GROUND_LEVEL, 1 / 60, { dropThroughHeld: true });

    expect(next.climbing).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Physics.test.ts`
Expected: FAIL — `climbing` isn't read/returned by `stepPlayerPhysics` yet, and `PlayerInput` has no `climbUpHeld`.

- [ ] **Step 3: Implement**

In `src/themes/platformer/engine/Physics.ts`:

1. Add `isClimbable` to the existing import from `../level/Terrain`:

```ts
import { isSolid, isSolidExcludingBridge, isClimbable, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
```

2. Add `climbUpHeld?: boolean;` to the `PlayerInput` interface, right after `jumpHeld?: boolean;`:

```ts
  jumpHeld?: boolean;
  /** Held state of Up/`W` (roadmap step 23) — continuous, like movement,
   *  not edge-triggered like `jumpPressed`: climbing is driven every frame
   *  the key is down, not just once on press. */
  climbUpHeld?: boolean;
```

3. Insert the following block immediately after the existing world-bounds clamp line (`x = Math.max(-PLAYER_SIDE_PADDING, Math.min(x, maxX));`) and before the existing `// Jump trigger (FR-006): ...` comment:

```ts
  // Climbing (roadmap step 23, FR-006): checked against the row at the
  // player's CURRENT (pre-vertical-move) feet position, using this frame's
  // already-resolved horizontal `x` — deliberately feet-only, not the whole
  // hitbox, so climbing ends almost exactly at the ladder's top edge instead
  // of overshooting into the solid tile above it (a whole-hitbox check would
  // keep climbing true until the character's HEAD also clears the ladder, by
  // which point the feet are already a tile or more above it).
  const climbLeftCol = Math.floor((x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
  const climbRightCol = Math.floor(
    (x + PLAYER_SIDE_PADDING + HITBOX_WIDTH - 1) / RENDERED_TILE_SIZE,
  );
  const feetRow = Math.floor(
    (player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - 1) / RENDERED_TILE_SIZE,
  );
  const columnsAreClimbable = (row: number): boolean => {
    for (let col = climbLeftCol; col <= climbRightCol; col++) {
      if (isClimbable(tileAt(level, col, row))) return true;
    }
    return false;
  };
  const onLadderNow = columnsAreClimbable(feetRow);
  const climbUpHeld = Boolean(input.climbUpHeld);
  const climbDownHeld = Boolean(input.dropThroughHeld);

  let climbing = player.climbing;
  if (climbing) {
    // Continue only while still over a ladder tile and not jump-cancelled.
    climbing = onLadderNow && !input.jumpPressed;
  } else if (onLadderNow && (climbUpHeld || climbDownHeld)) {
    // Fresh entry: overlapping a ladder column and pressing Up/Down.
    climbing = true;
  } else if (player.grounded && climbDownHeld && columnsAreClimbable(feetRow + 1)) {
    // Fresh entry from above: standing on the solid tile directly above a
    // ladder's top rung, pressing Down re-enters the climb downward — mirrors
    // the drop-through-bridge trigger below, but checked one row LOWER (the
    // ladder starts the row BELOW the tile the character rests on, unlike a
    // bridge, which the character rests ON TOP of directly).
    climbing = true;
  }

  if (climbing) {
    const vy = climbUpHeld ? -PHYSICS_CONFIG.climbSpeed : climbDownHeld ? PHYSICS_CONFIG.climbSpeed : 0;
    return {
      ...player,
      x,
      y: player.y + vy * dt,
      vx,
      vy,
      facing,
      grounded: false,
      climbing: true,
      isDroppingThroughBridge: false,
      knockbackTimer: Math.max(0, player.knockbackTimer - dt),
      bounceAscending: false,
      hitBlockIds: [],
    };
  }

```

4. Replace the existing jump-trigger/gravity lines:

```ts
  // Jump trigger (FR-006): a fixed upward impulse, only while grounded — no
  // double jump. Ignored entirely while already airborne.
  const jumpStarts = player.grounded && Boolean(input.jumpPressed);
  let vy = jumpStarts ? PHYSICS_CONFIG.jumpVelocity : player.vy;
  vy = Math.min(vy + PHYSICS_CONFIG.gravity * dt, PHYSICS_CONFIG.terminalVelocity);
```

with:

```ts
  // Jump trigger (FR-006): a fixed upward impulse while grounded, OR while
  // cancelling a climb (roadmap step 23) — climbing always reports
  // `grounded: false` above, so the plain grounded-only check would silently
  // swallow a jump press that's meant to cancel a climb.
  const climbJumpCancelled = player.climbing && Boolean(input.jumpPressed);
  const jumpStarts = (player.grounded || climbJumpCancelled) && Boolean(input.jumpPressed);
  let vy = jumpStarts
    ? PHYSICS_CONFIG.jumpVelocity
    : player.climbing
      ? 0 // just exited climbing (reached the top, or walked off) — fall from rest, not from the old climb speed
      : player.vy;
  vy = Math.min(vy + PHYSICS_CONFIG.gravity * dt, PHYSICS_CONFIG.terminalVelocity);
```

5. In the function's final `return { ... }` object (unchanged otherwise), add `climbing: false,` right after `grounded,`:

```ts
  return {
    ...player,
    x,
    y,
    vx,
    vy: resolvedVy,
    facing,
    grounded,
    climbing: false,
    isDroppingThroughBridge: grounded ? false : droppingThroughBridge,
    lastGroundedX: fullyGrounded ? x : player.lastGroundedX,
    lastGroundedY: fullyGrounded ? y : player.lastGroundedY,
    knockbackTimer: Math.max(0, player.knockbackTimer - dt),
    bounceAscending: player.bounceAscending && resolvedVy < 0,
    hitBlockIds,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Physics.test.ts`
Expected: PASS — including every pre-existing test in this file (the climbing branch only activates when `player.climbing` is true or a ladder tile is present; no existing test level has one, so `climbing` stays `false` throughout and the non-climbing path is byte-identical to before except for the `climbing: false` field now present on every result).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Physics.ts src/themes/platformer/engine/Physics.test.ts src/themes/platformer/entities/Player.ts src/themes/platformer/PlatformerState.ts
git commit -m "feat(platformer): add ladder-climbing physics branch"
```

---

## Task 4: Climb animation — frames, state priority, `Player.ts` test fixes

**Files:**
- Modify: `src/themes/platformer/entities/Player.ts`
- Test: `src/themes/platformer/entities/Player.test.ts`

**Interfaces:**
- Consumes: `JUMP_FRAME_SIZE` (already defined, same file).
- Produces: `climbFrameSource(frame: number): { sx: number; sy: number }` — consumed by Task 5's `Renderer.ts`. `updatePlayerAnimState` now prioritizes `climbing` over `grounded`/`vx`.

(Task 3's Step 0 already added `'climb'` to `PlayerAnimState`, `climbing: boolean` to `PlayerState`, and the real `climb` entry to `ANIM_CONFIG` — nothing left to do there. This task adds the actual frame-source function and the `updatePlayerAnimState` priority change.)

- [ ] **Step 1: Write the failing tests**

Add `climbing: false,` to `Player.test.ts`'s existing `idlePlayer()` helper's returned object (alongside `grounded: true,`). Add `climbFrameSource` to the existing import from `./Player`. Then add:

```ts
describe('climbFrameSource', () => {
  it('frame0-returnsFirstClimbColumnAtClimbRow', () => {
    expect(climbFrameSource(0)).toEqual({ sx: 0, sy: 322 });
  });

  it('frame2-returnsThirdClimbColumnAtClimbRow', () => {
    expect(climbFrameSource(2)).toEqual({ sx: 2 * JUMP_FRAME_SIZE, sy: 322 });
  });

  it('frame4-wrapsToFirstClimbColumn', () => {
    // Only 4 real CLIMB frames in the sheet.
    expect(climbFrameSource(4)).toEqual({ sx: 0, sy: 322 });
  });
});

describe('updatePlayerAnimState climbing priority', () => {
  it('climbingTrue-switchesToClimbRegardlessOfGroundedOrVx', () => {
    const player = idlePlayer({ climbing: true, grounded: false, vx: 200, animState: 'idle' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('climb');
    expect(next.animFrame).toBe(0);
    expect(next.animTimer).toBe(0);
  });

  it('climbingFalseAfterClimb-fallsBackToJumpWhileAirborne', () => {
    const player = idlePlayer({ climbing: false, grounded: false, animState: 'climb' });
    const next = updatePlayerAnimState(player);
    expect(next.animState).toBe('jump');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Player.test.ts`
Expected: FAIL — `climbFrameSource` doesn't exist yet, and `updatePlayerAnimState` doesn't check `climbing`.

- [ ] **Step 3: Implement**

In `src/themes/platformer/entities/Player.ts`, add after `jumpFrameSource`:

```ts
/**
 * `knight2.png`'s third row — a 4-frame "climb (back view)" cycle present
 * in the sheet but never wired up before roadmap step 23. Row spacing
 * matches JUMP_ROW_SY (0) / FALL_ROW_SY (161): the sheet is 1024x484px, i.e.
 * three ~161.3px-tall rows, so the third starts at 2*161=322.
 */
const CLIMB_ROW_SY = 322;
const CLIMB_ROW_FRAME_COUNT = 4;

/**
 * Frame source for the climbing animation — a simple 4-frame cycle (unlike
 * `jumpFrameSource`, there's no rising/falling branch: climbing has one
 * direction-agnostic loop). Uses the same 128px `JUMP_FRAME_SIZE`/sheet as
 * jump/fall.
 */
export function climbFrameSource(frame: number): { sx: number; sy: number } {
  return { sx: (frame % CLIMB_ROW_FRAME_COUNT) * JUMP_FRAME_SIZE, sy: CLIMB_ROW_SY };
}
```

Replace `updatePlayerAnimState`:

```ts
export function updatePlayerAnimState(player: PlayerState): PlayerState {
  const animState: PlayerAnimState = player.climbing
    ? 'climb'
    : !player.grounded
      ? 'jump'
      : player.vx !== 0
        ? 'walk'
        : 'idle';
  if (animState === player.animState) return player;
  return { ...player, animState, animFrame: 0, animTimer: 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Player.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Player.ts src/themes/platformer/entities/Player.test.ts
git commit -m "feat(platformer): wire climb animation frames and state priority"
```

---

## Task 5: Render the climb animation in `Renderer.ts`

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `climbFrameSource` (`../entities/Player`, Task 4).

- [ ] **Step 1: Write the failing tests**

Add `climbing: false,` to `Renderer.test.ts`'s `describe('drawPlayer', ...)`'s `idlePlayer` fixture object (alongside `grounded: true,`). Add `climbFrameSource` to the existing import from `../entities/Player` if `Renderer.test.ts` imports frame-source functions directly (it doesn't need to — the test only asserts on `ctx.drawImage` calls). Then add, near the existing `jumpState*` tests:

```ts
  it('climbState-withJumpSpriteSheet-drawsFromClimbRowAtHighResFrameSize', () => {
    const ctx = makeMockContext();
    const jumpSheet = {} as HTMLImageElement;
    const player: PlayerState = { ...idlePlayer, animState: 'climb', climbing: true, animFrame: 1 };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, 0, jumpSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      jumpSheet,
      1 * 128,
      322,
      128,
      128,
      16,
      256,
      64,
      64,
    );
  });

  it('climbState-noJumpSpriteSheetProvided-fallsBackToPrimarySheetIdleFrame', () => {
    const ctx = makeMockContext();
    const player: PlayerState = { ...idlePlayer, animState: 'climb', climbing: true };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, 0, null);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeSpriteSheet, 0, 0, 32, 32, 16, 256, 64, 64);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Renderer.test.ts`
Expected: FAIL — `drawPlayer` doesn't yet recognize `animState === 'climb'`.

- [ ] **Step 3: Implement**

In `src/themes/platformer/engine/Renderer.ts`, add `climbFrameSource` to the existing import from `../entities/Player`, then replace the sheet-selection block inside `drawPlayer`:

```ts
  const useJumpSheet = player.animState === 'jump' && jumpSpriteSheet !== null;
  const frameSize = useJumpSheet ? JUMP_FRAME_SIZE : PLAYER_FRAME_SIZE;
  const sheet = useJumpSheet ? jumpSpriteSheet : spriteSheet;
  const { sx, sy } = useJumpSheet
    ? jumpFrameSource(player.vy, player.animFrame)
    : playerFrameSource(player.animState, player.animFrame);
```

with:

```ts
  const useHighResSheet =
    (player.animState === 'jump' || player.animState === 'climb') && jumpSpriteSheet !== null;
  const frameSize = useHighResSheet ? JUMP_FRAME_SIZE : PLAYER_FRAME_SIZE;
  const sheet = useHighResSheet ? jumpSpriteSheet : spriteSheet;
  const { sx, sy } = !useHighResSheet
    ? playerFrameSource(player.animState, player.animFrame)
    : player.animState === 'climb'
      ? climbFrameSource(player.animFrame)
      : jumpFrameSource(player.vy, player.animFrame);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Renderer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): render the climb animation from knight2.png"
```

---

## Task 6: Vertical camera follow — `updateCameraY`

**Files:**
- Modify: `src/themes/platformer/engine/Camera.ts`
- Test: `src/themes/platformer/engine/Camera.test.ts`

**Interfaces:**
- Produces: `updateCameraY(previousCameraY, playerY, playerHeight, viewportHeight, levelPixelHeight): number` — consumed by Task 9's `PlatformerPage.tsx`.

- [ ] **Step 1: Write the failing tests**

Add `updateCameraY` to the existing import from `./Camera` in `Camera.test.ts`. Then add:

```ts
describe('updateCameraY', () => {
  const PLAYER_HEIGHT = 64;
  const VIEWPORT_HEIGHT = 480; // dead zone: [144, 336] around center 240

  it('levelShorterThanViewport-cameraStaysAtZeroRegardlessOfPlayerPosition', () => {
    const result = updateCameraY(0, 1000, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 192);
    expect(result).toBe(0);
  });

  it('tallLevel-playerCenteredWithinDeadZone-cameraStaysAtPreviousPosition', () => {
    // levelPixelHeight 800, originYBase = 480-800 = -320. previousCameraY 160
    // -> effective originY -160. playerY 368 -> center 400 -> screenCenterY
    // 400-160 = 240, dead-center — no movement.
    const result = updateCameraY(160, 368, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(160);
  });

  it('playerExitsTopEdgeOfDeadZone-cameraShiftsUpToKeepPlayerAtEdge', () => {
    // playerY 382 -> center 414 -> screenCenterY (previousCameraY 0) =
    // 414-320 = 94, past deadZoneTop (144) on the low side — camera shifts
    // up: 144-414-(-320) = 50.
    const result = updateCameraY(0, 382, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(50);
  });

  it('playerExitsBottomEdgeOfDeadZone-cameraShiftsDownToKeepPlayerAtEdge', () => {
    // playerY 518 -> center 550 -> screenCenterY (previousCameraY 160) =
    // 550-320+160 = 390, past deadZoneBottom (336) — camera shifts down:
    // 336-550-(-320) = 106.
    const result = updateCameraY(160, 518, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(106);
  });

  it('cameraWouldGoNegative-clampsToZero', () => {
    const result = updateCameraY(0, 668, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(0);
  });

  it('cameraWouldExceedLevelTop-clampsToLevelHeightMinusViewport', () => {
    const result = updateCameraY(0, 32, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(320); // max = 800 - 480
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Camera.test.ts`
Expected: FAIL — `updateCameraY` is not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/engine/Camera.ts`, add after `updateCamera`:

```ts
/**
 * Half-height (rendered px) of the vertical dead-zone band — same value as
 * `CAMERA_DEAD_ZONE_HALF_WIDTH`, no reason yet to differ.
 */
export const CAMERA_DEAD_ZONE_HALF_HEIGHT = 96;

/**
 * Computes the next vertical camera offset (roadmap step 23) — an ADDITIVE
 * amount on top of the existing bottom-anchor baseline
 * (`viewportHeight - levelPixelHeight`, unchanged since roadmap step 1),
 * not a replacement for it. At 0 (its minimum), the level is exactly
 * bottom-anchored, matching every level shipped before this step; it grows
 * as the player climbs toward the level's top, capped so the origin never
 * scrolls past showing the level's very top row. Clamping to
 * `[0, max(0, levelPixelHeight - viewportHeight)]` means a level that
 * already fits the viewport ALWAYS returns 0 here, regardless of the
 * dead-zone math below — a level shorter than the viewport can never need
 * to scroll, by construction.
 */
export function updateCameraY(
  previousCameraY: number,
  playerY: number,
  playerHeight: number,
  viewportHeight: number,
  levelPixelHeight: number,
): number {
  const originYBase = viewportHeight - levelPixelHeight;
  const playerCenterY = playerY + playerHeight / 2;
  const screenCenterY = playerCenterY + originYBase + previousCameraY;
  const deadZoneTop = viewportHeight / 2 - CAMERA_DEAD_ZONE_HALF_HEIGHT;
  const deadZoneBottom = viewportHeight / 2 + CAMERA_DEAD_ZONE_HALF_HEIGHT;

  let cameraY = previousCameraY;
  if (screenCenterY < deadZoneTop) {
    cameraY = deadZoneTop - playerCenterY - originYBase;
  } else if (screenCenterY > deadZoneBottom) {
    cameraY = deadZoneBottom - playerCenterY - originYBase;
  }

  const maxCameraY = Math.max(0, levelPixelHeight - viewportHeight);
  return Math.min(Math.max(cameraY, 0), maxCameraY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Camera.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Camera.ts src/themes/platformer/engine/Camera.test.ts
git commit -m "feat(platformer): add vertical camera follow (updateCameraY)"
```

---

## Task 7: `cameraPositionY` signal

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Produces: `cameraPositionY: Signal<number>` — consumed by Task 9's `PlatformerPage.tsx`.

- [ ] **Step 1: Write the failing tests**

Add `cameraPositionY` to the existing import from `./PlatformerState` in `PlatformerState.test.ts`. Then add:

```ts
describe('cameraPositionY', () => {
  it('initial-isZero', () => {
    expect(cameraPositionY.value).toBe(0);
  });
});
```

In the existing `describe('resetGame', ...)` block, add a step alongside the existing `cameraPositionX` reset assertion:

```ts
  it('resetsCameraPositionYToZero', () => {
    cameraPositionY.value = 300;
    resetGame();
    expect(cameraPositionY.value).toBe(0);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- PlatformerState.test.ts`
Expected: FAIL — `cameraPositionY` is not exported yet, and `resetGame()` doesn't touch it.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerState.ts`, add right after `cameraPositionX`:

```ts
/**
 * Camera's vertical scroll offset (roadmap step 23) — an additive amount on
 * top of the existing bottom-anchor baseline computed in
 * `PlatformerPage.tsx` (`canvas.height - levelPixelHeight`), not a
 * replacement for it. See `engine/Camera.ts`'s `updateCameraY` doc comment.
 * 0 on every level shipped before this step (and whenever a level's height
 * fits the viewport) — a verified no-op, not just an assumption.
 */
export const cameraPositionY = signal(0);
```

In `resetGame()`, add `cameraPositionY.value = 0;` right after `cameraPositionX.value = 0;`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- PlatformerState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add cameraPositionY signal"
```

---

## Task 8: Ladder + new tier in `level1.ts`

**Files:**
- Modify: `src/themes/platformer/level/level1.ts`
- Modify: `src/themes/platformer/level/level1.test.ts`

**Interfaces:**
- Consumes: `'ladder'`/`'L'` (Task 1).
- Produces: an in-game, climbable ladder from the existing floating platform (`level1`'s current row 1, cols 8-14) up to a new landing tier — the manual browser Verify target for this whole plan.

**Design:** `LEVEL_1_LAYOUT` is bottom-anchored — inserting new rows happens at the very TOP of the array (index 0), pushing every existing row's index down by the same amount. 17 new rows are inserted: a landing tier (row 0) and 16 rows of ladder shaft (rows 1-16), plus the existing (currently all-empty) former row 0 is repurposed into the shaft's 17th and final rung (it sits directly above the existing floating platform, so no new row is needed there — just one changed character). Every row can now be written far shorter than 80 characters and rely on Task 1's new auto-padding (only rows with real content need to spell out further than their last non-`.` character).

The ladder sits at column 9 — the middle tile of the existing floating platform's `PPPBBPP` run (cols 8-14: P,P,P,B,B,P,P — column 9 is the second `P`), so the ladder's bottom rung lands squarely on solid ground.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/level/level1.test.ts`, add `isClimbable` to the existing import from `./Terrain`:

```ts
describe('ladder shaft (roadmap step 23)', () => {
  it('newTopTier-hasASolidLandingPlatformAtCol9', () => {
    expect(level1.terrain[0][9]).toBe('platform');
  });

  it('shaftBelowLandingTier-isLadderAtCol9-seventeenTilesTall', () => {
    for (let row = 1; row <= 17; row++) {
      expect(level1.terrain[row][9]).toBe('ladder');
      expect(isClimbable(level1.terrain[row][9])).toBe(true);
    }
  });

  it('ladderBottomRung-sitsDirectlyAboveTheExistingFloatingPlatform', () => {
    // Row 18 is the pre-existing floating platform (was row 1 before this
    // step's 17-row insertion) — its middle tile (col 9) is solid ground the
    // ladder's bottom rung (row 17, col 9) rests on.
    expect(level1.terrain[18][9]).toBe('platform');
  });

  it('levelIsTallEnoughToExceedATypicalDesktopViewport', () => {
    // 23 rows * 32px/tile = 736px — taller than most real browser viewports
    // once browser chrome is accounted for; if it isn't on a very large
    // monitor, shrinking the browser window height confirms the same
    // scrolling logic (proven independently by Camera.test.ts's
    // updateCameraY tests regardless of window size).
    expect(level1.height * 32).toBeGreaterThan(700);
  });
});
```

Update the two tests with hardcoded absolute row indices that this insertion shifts by 17 (every other test in this file uses `level1.height - 1`/`-2` or derives its row from a marker constant, so it auto-adjusts and needs no change):

```ts
  it('elevatedBridge-spansGapBetweenTwoFloatingPlatformsAtPlatformRow', () => {
    const row = 1;
    ...
```

becomes:

```ts
  it('elevatedBridge-spansGapBetweenTwoFloatingPlatformsAtPlatformRow', () => {
    const row = 18;
    ...
```

and:

```ts
  it('elevatedBridge-hasTwoRowsOfClearanceAboveReachableGroundBelow', () => {
    for (const col of [11, 12]) {
      expect(level1.terrain[2][col]).toBe('empty');
      expect(level1.terrain[3][col]).toBe('empty');
      expect(isSolid(level1.terrain[4][col])).toBe(true);
    }
  });
```

becomes:

```ts
  it('elevatedBridge-hasTwoRowsOfClearanceAboveReachableGroundBelow', () => {
    for (const col of [11, 12]) {
      expect(level1.terrain[19][col]).toBe('empty');
      expect(level1.terrain[20][col]).toBe('empty');
      expect(isSolid(level1.terrain[21][col])).toBe(true);
    }
  });
```

and:

```ts
  it('newBlockMarkers-sitElevatedAboveGroundCloseToSpawn', () => {
    const blockRow = 1;
    ...
```

becomes:

```ts
  it('newBlockMarkers-sitElevatedAboveGroundCloseToSpawn', () => {
    const blockRow = 18;
    ...
```

and:

```ts
  it('newBlockMarkers-haveTwoRowsOfClearanceAboveReachableGroundBelow', () => {
    for (const col of [19, 20, 21, 22, 23, 24]) {
      expect(level1.terrain[2][col]).toBe('empty');
      expect(level1.terrain[3][col]).toBe('empty');
      expect(isSolid(level1.terrain[4][col])).toBe(true);
    }
  });
```

becomes:

```ts
  it('newBlockMarkers-haveTwoRowsOfClearanceAboveReachableGroundBelow', () => {
    for (const col of [19, 20, 21, 22, 23, 24]) {
      expect(level1.terrain[19][col]).toBe('empty');
      expect(level1.terrain[20][col]).toBe('empty');
      expect(isSolid(level1.terrain[21][col])).toBe(true);
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- level1.test.ts`
Expected: FAIL — the ladder/landing-tier tests fail (no such content yet), and the four updated-index tests fail against the still-unshifted layout.

- [ ] **Step 3: Implement**

In `src/themes/platformer/level/level1.ts`, insert 17 new lines at the very start of `LEVEL_1_LAYOUT` (before the current first line), and change the (former) first line as shown.

Current start of the array:

```ts
const LEVEL_1_LAYOUT: readonly string[] = [
  '................................................................................',
  '........PPPBBPP....XQFXQF.......................................................',
  ...
```

New start of the array (17 inserted lines, then the modified former-first-line, then the rest of the array completely unchanged):

```ts
const LEVEL_1_LAYOUT: readonly string[] = [
  // --- Ladder shaft (roadmap step 23) — throwaway/replaceable placeholder
  // content, not final level design. Exists only to give this step a real
  // manual browser Verify for climbing + vertical camera follow: the level
  // (originally 6 rows / ~192px) was nowhere near tall enough to ever need
  // vertical scrolling on a real desktop window otherwise. Column 9 matches
  // the existing floating platform's middle tile below (row 18 after this
  // insertion, was row 1) so the ladder's bottom rung lands on solid ground.
  '........PPP', // new top tier: a small landing platform directly above the ladder's top rung
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  '.........L',
  // Former row 0 (all-empty, added in an earlier review pass so a
  // question-mark block's popped fruit has somewhere to rise into) —
  // repurposed as the ladder shaft's 17th and final rung, directly above
  // the existing floating platform. Only column 9 changes; every other
  // column stays '.'.
  '.........L',
  '................................................................................',
  '................................................................................',
  '.S....T...C.T.....C.......W.E..W....W.M....C.C..................................',
  'GGBBBGGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  'GG...GGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
];
```

(The last five lines above — the two blank rows, the entity row, and the two ground rows — are copy-pasted verbatim from the current file, completely unchanged, just shifted down by 17 array positions.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- level1.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: PASS — `PlatformerState.ts`/`PlatformerPage.tsx` derive spawn/marker positions from `level1` at runtime (not hardcoded row numbers), so nothing outside `level1.test.ts` should need updating. `EnemyMapper`/`CollectibleMapper`/`BlockMapper`/`ChestMapper` tests operate on their own synthetic level fixtures, not `level1`, and are unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/level/level1.ts src/themes/platformer/level/level1.test.ts
git commit -m "feat(platformer): add a climbable ladder shaft above level1's floating platform"
```

---

## Task 9: Wire climbing input + vertical camera into `PlatformerPage.tsx`

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `updateCameraY` (`./engine/Camera`, Task 6); `cameraPositionY` (`./PlatformerState`, Task 7).

- [ ] **Step 1: Write the failing test**

Add `updateCameraY` to the existing import from `./engine/Camera`, and `cameraPositionY` to the existing import from `./PlatformerState`. Reset it in the test file's `beforeEach` (alongside the other module-level signal resets): `cameraPositionY.value = 0;`.

Add a new `describe` block to `src/themes/platformer/PlatformerPage.test.tsx`:

```tsx
describe('PlatformerPage — ladder climbing', () => {
  it('playerOnLadderColumn-arrowUpHeld-startsClimbingAndStopsFalling', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);

    // Position the character directly on the new ladder shaft (col 9,
    // somewhere in the shaft's middle rows — see level1.ts).
    const ladderCol = 9;
    const ladderRow = 8;
    const { x, y } = tileToPixel(ladderCol, ladderRow);
    playerState.value = { ...playerState.value, x, y, vy: 50, grounded: false, climbing: false };

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    frameCallback!(0);
    frameCallback!(16);

    expect(playerState.value.climbing).toBe(true);
    expect(playerState.value.vy).toBeLessThan(0); // moving upward, not falling
  });
});
```

Add `import { tileToPixel } from './level/Terrain';` to the test file's existing imports if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PlatformerPage.test.tsx -t "ladder climbing"`
Expected: FAIL — Arrow Up is currently only read via `consumePress` for the chest-interact action, never as a held key for climbing, so `stepPlayerPhysics` never receives `climbUpHeld` and the character keeps falling under gravity instead.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerPage.tsx`:

1. Add `updateCameraY` to the existing import from `./engine/Camera`:

```ts
import { updateCamera, updateCameraY } from './engine/Camera';
```

2. Add `cameraPositionY` to the existing import from `./PlatformerState`.

3. In the game loop's tick callback, right after the existing block:

```ts
      const horizontal = {
        left: input.isHeld('ArrowLeft') || input.isHeld('KeyA'),
        right: input.isHeld('ArrowRight') || input.isHeld('KeyD'),
      };
      const jumpPressed = input.consumePress('Space');
      const jumpHeld = input.isHeld('Space');
      const dropThroughHeld = input.isHeld('ArrowDown') || input.isHeld('KeyS');
```

add:

```ts
      // Held (not edge-triggered) — climbing is continuous like movement,
      // unlike the edge-triggered ArrowUp/KeyW read further below for chest
      // interaction (roadmap step 23; the two never conflict in practice,
      // since a tile is either a chest marker or a ladder tile, never both).
      const climbUpHeld = input.isHeld('ArrowUp') || input.isHeld('KeyW');
```

4. Add `climbUpHeld,` to the `stepPlayerPhysics` call's input object:

```ts
      let next = stepPlayerPhysics(
        playerState.value,
        level1,
        dt,
        {
          ...horizontal,
          jumpPressed,
          jumpHeld,
          dropThroughHeld,
          climbUpHeld,
          suppressJumpCut: stompBounceThisTick,
        },
        blockStates.value,
      );
```

5. Right after the existing horizontal camera update:

```ts
      const levelPixelWidth = level1.width * RENDERED_TILE_SIZE;
      cameraPositionX.value = updateCamera(
        cameraPositionX.value,
        next.x,
        PLAYER_RENDERED_SIZE,
        canvas.width,
        levelPixelWidth,
      );
```

add:

```ts
      const levelPixelHeightForCamera = level1.height * RENDERED_TILE_SIZE;
      cameraPositionY.value = updateCameraY(
        cameraPositionY.value,
        next.y,
        PLAYER_RENDERED_SIZE,
        canvas.height,
        levelPixelHeightForCamera,
      );
```

6. Every occurrence of the exact line:

```ts
        const originY = canvas.height - levelPixelHeight;
```

(there are four — in `render()`, and in the block-hit, chest-interact, and question-mark-puff sections; each already computes a local `levelPixelHeight` right above it) becomes:

```ts
        const originY = canvas.height - levelPixelHeight + cameraPositionY.value;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: PASS (full file — confirms the new test passes and nothing else regressed; every pre-existing test leaves `cameraPositionY` at its reset value of 0, so `originY` is numerically unchanged from before this task for all of them).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): wire climbing input and vertical camera into the game loop"
```

---

## Task 10: Full verification + roadmap checkbox

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions anywhere in the platformer theme or elsewhere.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: PASS — zero TypeScript errors (SC-007).

- [ ] **Step 3: Manual browser verification**

Start the dev server and open the Platformer theme (unlock `platformerPrototypeUnlocked` if needed, per `src/state/theme.ts`):
- Walk to the existing floating platform (cols 8-14), climb onto it, then walk to the ladder at col 9 and press Up — confirm the character climbs vertically instead of falling, with the climb animation playing.
- Keep holding Up until the ladder goes off the top of the screen — confirm the camera scrolls upward to keep the character in view. If your monitor's browser window doesn't naturally trigger this (very tall viewport), shrink the window and retry — the scrolling logic itself is already proven independent of window size by `Camera.test.ts`'s `updateCameraY` tests.
- While climbing, press Left/Right — confirm the character shimmies off the ladder and immediately resumes normal falling/walking.
- While climbing, press Space — confirm it cancels the climb into a normal jump arc.
- Climb all the way to the new landing tier at the top — confirm the character can stand on it like any other platform.
- While standing on the landing tier, press Down — confirm the character re-enters the climb, moving downward back into the shaft.
- Walk back down to ground level and confirm every pre-existing mechanic still works: the bridge drop-through, the wall-bounded/wall-pit enemies, the coins, the crate/question-mark/rock blocks, and the two chests near spawn — none of their positions should have visibly moved.
- Confirm the camera scrolls back down smoothly as the character descends and walks away from the ladder.

- [ ] **Step 4: Check off the roadmap step**

In `specs/S-006-platformer-theme/roadmap.md`, change step 23's `- [ ]` to `- [x]`.

- [ ] **Step 5: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs: check off roadmap step 23 (ladders + vertical camera follow)"
```
