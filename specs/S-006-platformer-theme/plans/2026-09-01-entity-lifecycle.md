# Entity Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every enemy a persistent identity that survives death and respawn, so that "this enemy already paid out its reward" is stored on the enemy itself rather than in three unrelated id-keyed collections.

**Architecture:** `enemyStates` becomes a fixed-length array built once and never rebuilt outside `resetGameProgress()`. Defeated enemies are flagged `alive: false` instead of being filtered out, so index N is the same enemy for the whole session. A persistent `rewardGiven` flag on the enemy replaces the dedup lookups against `keyPickupStates`, `collectedFacts`, and the per-frame `droppedKeyEnemyIds` set.

**Tech Stack:** TypeScript 5 (strict), React 19, `@preact/signals-react`, Vitest + React Testing Library + jsdom.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-01-entity-architecture-design.md`

## Global Constraints

- TypeScript strict mode. No `any`, no `@ts-ignore`, no `@ts-expect-error` (constitution Principle I).
- Test-first for every task: the failing test is written and run before the implementation (constitution Principle II, NON-NEGOTIABLE).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies.
- Test command: `npm test`. Single file: `npx vitest run <path>`. Typecheck: `npx tsc -b --noEmit`.
- Vitest globals are enabled — `describe`, `it`, `expect`, `vi` are available without imports (see existing test files).
- Named exports only. No default exports.
- **No behavior change is intended by this plan except one:** an enemy's reward can fire at most once for the lifetime of the session. Every other existing test must still pass with the same outcome.
- **No auto-commits beyond the ones this plan specifies.** Do not commit anything the plan does not list.

## Model guidance

Every task in this plan is **Sonnet 5**. The work is mechanical — a field
rename, two flag additions, and one signal-assignment change — and each step
names the exact file and the exact code. `npx tsc -b --noEmit` catches any
missed call site, so a wrong edit fails loudly rather than silently.

Reviewers between tasks may be Sonnet 5 as well, with one exception: Task 4
changes when a reward fires, which is the plan's only intended behavior change.
Review that one against the browser checks in its Step 10, not against tests
alone.

## Reference values

These are derived from `level/Terrain.ts` (`TILE_SIZE = 16`, `RENDER_SCALE = 2`, `RENDERED_TILE_SIZE = 32`), `entities/Enemy.ts`, and `entities/Player.ts`. Task 1's tests depend on them being exact.

| Quantity | slimeGreen | slimePurple |
|---|---|---|
| `enemyRenderedSize` | `24 * 2 * 1 = 48` | `24 * 2 * 2 = 96` |
| `enemyTileOffsetX` | `(32 - 48) / 2 = -8` | `(32 - 96) / 2 = -32` |
| `enemyTileOffsetY` | `32 - 48 = -16` | `32 - 96 = -64` |
| `enemyHitboxSidePadding` | `5 * 2 * 1 = 10` | `5 * 2 * 2 = 20` |
| `enemyHitboxTopPadding` | `9 * 2 * 1 = 18` | `9 * 2 * 2 = 36` |

For an enemy placed at `(100, 100)`:

- green hitbox `{ x: 102, y: 102, width: 28, height: 30 }`, vertical midpoint `117`
- purple hitbox `{ x: 88, y: 72, width: 56, height: 60 }`, vertical midpoint `102`

Player hitbox for a player at `(px, py)` is `{ x: px + 20, y: py + 18, width: 24, height: 38 }`, so its bottom edge is `py + 56`.

---

### Task 1: Characterization truth table for enemy contact

**Model:** Sonnet 5 — test-only, no source change.

Locks today's collision behavior into assertions that do not depend on the names `checkEnemyStompCollisions`, `checkEnemySideCollisions`, or `isSpikedTopLanding`. Plan 2 collapses those three functions into one; this table is the net that catches a behavior drift when it does. **This task changes no source file.**

**Files:**
- Create: `src/themes/platformer/engine/EnemyContact.contract.test.ts`

**Interfaces:**
- Consumes: `checkEnemyStompCollisions`, `checkEnemySideCollisions`, `isSpikedTopLanding` from `engine/Collision.ts`; `EnemyState` from `entities/Enemy.ts`; `PlayerState` and `spawnPlayerState` shapes from `entities/Player.ts` / `PlatformerState.ts`.
- Produces: `CONTACT_CASES`, an exported array of characterization cases that Plan 2 re-uses verbatim against `resolveEnemyContacts`.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/engine/EnemyContact.contract.test.ts`:

```typescript
import {
  checkEnemyStompCollisions,
  checkEnemySideCollisions,
  isSpikedTopLanding,
} from './Collision';
import type { EnemyState } from '../entities/Enemy';
import type { PlayerState } from '../entities/Player';

/**
 * Characterization of enemy/player contact as it behaves today, expressed in
 * terms of OUTCOMES (stomped / damaged / bounced off spikes) rather than the
 * names of the three functions that currently produce them. Plan 2 collapses
 * those three into one `resolveEnemyContacts` and re-runs this exact table,
 * so a behavior drift fails here rather than silently landing.
 *
 * Positions are chosen from the hitbox arithmetic documented in this plan's
 * "Reference values" table: with an enemy at (100, 100), a player at y = 60
 * lands on a green slime's upper half, y = 80 contacts its lower half, and
 * y = 40 lands on a purple slime's upper half.
 */

function makePlayer(x: number, y: number, vy: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy,
    facing: 'right',
    grounded: false,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    animState: 'jump',
    animFrame: 0,
    animTimer: 0,
    invincibleTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    hitBlockIds: [],
  };
}

function makeEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 'enemy-under-test',
    spriteType: 'slimeGreen',
    x: 100,
    y: 100,
    vx: 0,
    direction: 'right',
    animState: 'walk',
    animFrame: 0,
    animTimer: 0,
    hitPoints: 1,
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    defeated: false,
    ...overrides,
  };
}

export interface ContactCase {
  name: string;
  enemy: Partial<EnemyState>;
  /** Player render-slot top-left. */
  playerX: number;
  playerY: number;
  playerVy: number;
  expected: {
    stomped: boolean;
    damaged: boolean;
    /** A failed stomp against spikes — damage plus an upward knockback. */
    spikedTopLanding: boolean;
  };
}

export const CONTACT_CASES: ContactCase[] = [
  {
    name: 'greenUpperHalfWhileFalling-isAStomp',
    enemy: {},
    playerX: 90,
    playerY: 60,
    playerVy: 200,
    expected: { stomped: true, damaged: false, spikedTopLanding: false },
  },
  {
    name: 'greenLowerHalfWhileFalling-isDamage',
    enemy: {},
    playerX: 90,
    playerY: 80,
    playerVy: 200,
    expected: { stomped: false, damaged: true, spikedTopLanding: false },
  },
  {
    name: 'greenUpperHalfWhileRising-isDamage',
    enemy: {},
    playerX: 90,
    playerY: 60,
    playerVy: -200,
    expected: { stomped: false, damaged: true, spikedTopLanding: false },
  },
  {
    name: 'greenAlreadyOutOfHitPoints-isNeitherStompNorDamage',
    // hitPoints 0 always coincides with the 'hit' reaction in practice, and a
    // reacting enemy is harmless in every way until its reaction ends.
    enemy: { hitPoints: 0, animState: 'hit' },
    playerX: 90,
    playerY: 60,
    playerVy: 200,
    expected: { stomped: false, damaged: false, spikedTopLanding: false },
  },
  {
    name: 'greenDefeated-isNeitherStompNorDamage',
    enemy: { defeated: true, hitPoints: 0 },
    playerX: 90,
    playerY: 60,
    playerVy: 200,
    expected: { stomped: false, damaged: false, spikedTopLanding: false },
  },
  {
    name: 'purpleUnspikedUpperHalfWhileFalling-isAStomp',
    enemy: { spriteType: 'slimePurple', hitPoints: 3 },
    playerX: 90,
    playerY: 40,
    playerVy: 200,
    expected: { stomped: true, damaged: false, spikedTopLanding: false },
  },
  {
    name: 'purpleSpikedUpperHalfWhileFalling-isDamageWithUpwardKnockback',
    enemy: { spriteType: 'slimePurple', hitPoints: 2, spiked: true },
    playerX: 90,
    playerY: 40,
    playerVy: 200,
    expected: { stomped: false, damaged: true, spikedTopLanding: true },
  },
  {
    name: 'purpleSpikedLowerHalfWhileFalling-isPlainDamage',
    enemy: { spriteType: 'slimePurple', hitPoints: 2, spiked: true },
    playerX: 90,
    playerY: 80,
    playerVy: 200,
    expected: { stomped: false, damaged: true, spikedTopLanding: false },
  },
  {
    name: 'purpleSpikedUpperHalfWhileRising-isPlainDamage',
    enemy: { spriteType: 'slimePurple', hitPoints: 2, spiked: true },
    playerX: 90,
    playerY: 40,
    playerVy: -200,
    expected: { stomped: false, damaged: true, spikedTopLanding: false },
  },
  {
    name: 'noOverlap-isNeitherStompNorDamage',
    enemy: {},
    playerX: 400,
    playerY: 60,
    playerVy: 200,
    expected: { stomped: false, damaged: false, spikedTopLanding: false },
  },
];

describe('enemy contact characterization', () => {
  for (const testCase of CONTACT_CASES) {
    it(testCase.name, () => {
      const enemy = makeEnemy(testCase.enemy);
      const player = makePlayer(testCase.playerX, testCase.playerY, testCase.playerVy);

      const stomped = checkEnemyStompCollisions(player, [enemy]).includes(enemy.id);
      const damaged = checkEnemySideCollisions(player, [enemy]).includes(enemy.id);

      expect({
        stomped,
        damaged,
        spikedTopLanding: isSpikedTopLanding(player, enemy),
      }).toEqual(testCase.expected);
    });
  }
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/themes/platformer/engine/EnemyContact.contract.test.ts`

Expected: **PASS**, all 10 cases. This is a characterization test — it describes code that already exists, so it must pass immediately.

If any case fails, the expectation in this plan is wrong, not the code. Correct the `expected` block to match what the current implementation actually returns, and add a comment noting the discrepancy. **Do not change `Collision.ts` to satisfy this table.**

- [ ] **Step 3: Verify the whole suite is still green**

Run: `npm test`
Expected: PASS (this task added a file and changed nothing).

- [ ] **Step 4: Commit**

```bash
git add src/themes/platformer/engine/EnemyContact.contract.test.ts
git commit -m "test(platformer): characterize enemy contact outcomes before refactor"
```

---

### Task 2: Enemies are flagged dead, not removed

**Model:** Sonnet 5 — mechanical rename, fully typechecked.

**Files:**
- Modify: `src/themes/platformer/entities/Enemy.ts` (`EnemyState`, `toEnemyState`)
- Modify: `src/themes/platformer/engine/EnemyAI.ts` (`stepEnemyHitReaction`)
- Modify: `src/themes/platformer/engine/Collision.ts` (`checkEnemyStompCollisions`, `checkEnemySideCollisions`)
- Modify: `src/themes/platformer/engine/Renderer.ts` (`drawEnemies`)
- Modify: `src/themes/platformer/PlatformerPage.tsx` (per-tick enemy step, defeat handling)
- Test: `src/themes/platformer/entities/Enemy.test.ts`, `src/themes/platformer/engine/EnemyAI.test.ts`, `src/themes/platformer/engine/Collision.test.ts`, `src/themes/platformer/engine/Renderer.test.ts`, `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime.
- Produces: `EnemyState.alive: boolean` replacing `EnemyState.defeated: boolean`. `alive` is `true` for a live enemy. Every reader of `defeated` becomes a reader of `!alive`.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/engine/EnemyAI.test.ts`, inside the existing `describe('stepEnemyHitReaction', ...)` block:

```typescript
it('reactionFinishedWithNoHitPoints-flagsNotAlive', () => {
  const enemy = makeEnemy({ animState: 'hit', hitPoints: 0, hitTimer: 0 });
  const stepped = stepEnemyHitReaction(enemy, HIT_REACTION_DURATION_SECONDS);
  expect(stepped.alive).toBe(false);
});

it('reactionFinishedWithHitPointsRemaining-staysAlive', () => {
  const enemy = makeEnemy({ animState: 'hit', hitPoints: 2, hitTimer: 0 });
  const stepped = stepEnemyHitReaction(enemy, HIT_REACTION_DURATION_SECONDS);
  expect(stepped.alive).toBe(true);
  expect(stepped.animState).toBe('walk');
});
```

Use the file's existing enemy-construction helper. If it builds states inline rather than via a helper, follow that file's established style instead.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/EnemyAI.test.ts`
Expected: FAIL — `Property 'alive' does not exist on type 'EnemyState'`.

- [ ] **Step 3: Replace `defeated` with `alive`**

In `entities/Enemy.ts`, replace the `defeated` field on `EnemyState`:

```typescript
  /** False once `hitPoints` has reached 0 and the hit-reaction animation has
   *  finished playing. A dead enemy stays in `enemyStates` at its array index
   *  for the whole session — render and collision skip it — so that the
   *  per-instance state below (see `rewardGiven`, added in Task 4) survives a
   *  death/respawn cycle without needing an id-keyed ledger elsewhere. */
  alive: boolean;
```

In `toEnemyState`, replace `defeated: false` with `alive: true`.

In `engine/EnemyAI.ts`'s `stepEnemyHitReaction`, replace:

```typescript
    return { ...enemy, hitTimer, defeated: true };
```

with:

```typescript
    return { ...enemy, hitTimer, alive: false };
```

and update that function's doc comment: it now *flags the enemy dead in place*; the game loop fires its reward the same tick and leaves it in the array.

In `engine/Collision.ts`, in both `checkEnemyStompCollisions` and `checkEnemySideCollisions`, replace `enemy.defeated ||` with `!enemy.alive ||`.

In `engine/Renderer.ts`'s `drawEnemies`, add a skip as the first statement of the loop body:

```typescript
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
```

In `PlatformerPage.tsx`:

- Delete the removal line entirely:
  ```typescript
  enemyStates.value = enemyStates.value.filter((e) => !e.defeated);
  ```
- Change the defeat selection from `filter((e) => e.defeated)` to `filter((e) => !e.alive)`.
- Guard the per-tick enemy step so dead enemies are not patrolled or animated. Wrap the existing per-enemy step expression:
  ```typescript
  enemyStates.value = enemyStates.value.map((enemy) => (enemy.alive ? stepEnemy(enemy) : enemy));
  ```
  where `stepEnemy` is whatever chain of `stepEnemyPatrol` / `stepEnemyHitReaction` / `stepEnemySpikeCooldown` / `advanceEnemyAnimation` that line currently applies. Do not change the chain itself.

**The defeat selection is now unbounded** — `!e.alive` stays true forever, so the reward block would re-run every tick. Task 4 fixes this properly with `rewardGiven`. Until then, keep the existing per-reward guards (`keyPickupStates.some(...)` and `newFacts.some(...)`) exactly as they are; they are what prevents a duplicate reward in this intermediate state. Do not remove them in this task.

- [ ] **Step 4: Update every existing reference to `defeated`**

Run: `grep -rn "defeated" src/themes/platformer/`

Update each hit. In test files, `defeated: false` becomes `alive: true` and `defeated: true` becomes `alive: false`; assertions like `expect(x.defeated).toBe(true)` become `expect(x.alive).toBe(false)`.

Two call sites need more than a mechanical flip:

- `PlatformerPage.test.tsx`'s assertion `expect(enemyStates.value.some((e) => e.id === target.id)).toBe(false)` asserted that a defeated enemy was *removed from the array*. That is no longer true by design. Replace it with:
  ```typescript
  expect(enemyStates.value.find((e) => e.id === target.id)?.alive).toBe(false);
  ```
- `EnemyContact.contract.test.ts` (Task 1): change `enemy: { defeated: true, hitPoints: 0 }` to `enemy: { alive: false, hitPoints: 0 }`, rename that case to `greenDead-isNeitherStompNorDamage`, and change `makeEnemy`'s default `defeated: false` to `alive: true`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

Run: `npx tsc -b --noEmit`
Expected: no errors. A residual `defeated` reference anywhere fails here.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): flag defeated enemies dead in place instead of removing them"
```

---

### Task 3: Enemies revive in place instead of being rebuilt

**Model:** Sonnet 5 — one new pure function plus one signal-assignment swap.

**Files:**
- Modify: `src/themes/platformer/entities/Enemy.ts` (`EnemyState`, `toEnemyState`, new `reviveEnemy`)
- Modify: `src/themes/platformer/PlatformerState.ts` (`resetGame`)
- Test: `src/themes/platformer/entities/Enemy.test.ts`, `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `EnemyState.alive` from Task 2.
- Produces: `EnemyState.homeX: number`, `EnemyState.homeY: number`, and `reviveEnemy(enemy: EnemyState): EnemyState`, exported from `entities/Enemy.ts`.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/entities/Enemy.test.ts`:

```typescript
describe('reviveEnemy', () => {
  it('deadEnemyAwayFromSpawn-restoresPositionHitPointsAndLife', () => {
    const enemy = toEnemyState(makePlacement());
    const wandered: EnemyState = {
      ...enemy,
      x: enemy.x + 250,
      y: enemy.y + 64,
      vx: -40,
      hitPoints: 0,
      alive: false,
      animState: 'hit',
      animFrame: 3,
      animTimer: 0.07,
      hitTimer: 0.9,
      spiked: true,
      spikeTimer: 0.3,
    };

    const revived = reviveEnemy(wandered);

    expect(revived.x).toBe(enemy.x);
    expect(revived.y).toBe(enemy.y);
    expect(revived.hitPoints).toBe(ENEMY_HIT_POINTS[enemy.spriteType]);
    expect(revived.alive).toBe(true);
    expect(revived.animState).toBe('walk');
    expect(revived.hitTimer).toBe(0);
    expect(revived.spiked).toBe(false);
    expect(revived.spikeTimer).toBe(0);
  });

  it('livingEnemy-stillResetsToSpawnState', () => {
    // resetGame() maps over every enemy unconditionally, so revive must be
    // correct for a living enemy too, not only a dead one.
    const enemy = toEnemyState(makePlacement());
    const revived = reviveEnemy({ ...enemy, x: enemy.x + 100, vx: 40 });
    expect(revived.x).toBe(enemy.x);
    expect(revived.vx).toBe(0);
  });
});
```

Add `reviveEnemy` and `ENEMY_HIT_POINTS` to that file's import list if not already present.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/Enemy.test.ts`
Expected: FAIL — `reviveEnemy is not a function`.

- [ ] **Step 3: Write the implementation**

In `entities/Enemy.ts`, add two fields to `EnemyState`:

```typescript
  /** The enemy's placement position. `reviveEnemy` restores `x`/`y` from
   *  these after a player death, so the enemy object itself never has to be
   *  rebuilt from its placement — which is what lets per-instance state
   *  (see `rewardGiven`) survive a respawn. */
  homeX: number;
  homeY: number;
```

In `toEnemyState`, add `homeX: placement.x` and `homeY: placement.y` to the returned object.

Add the revive function below `toEnemyState`:

```typescript
/**
 * Returns an enemy reset to its spawn state, preserving every field that
 * represents session progress rather than a moment in a life. Called by
 * `PlatformerState.ts`'s `resetGame()` on every enemy after a player death,
 * living or dead — an enemy mid-patrol is returned to its placement tile just
 * as a dead one is brought back.
 *
 * `rewardGiven` (Task 4) is deliberately NOT reset here: an enemy that has
 * already paid out its fact or its dropped item revives as a normal, killable
 * obstacle that has nothing further to give. Only `resetGameProgress()` (the
 * Reset Game button) clears that, by rebuilding the array from placements.
 */
export function reviveEnemy(enemy: EnemyState): EnemyState {
  return {
    ...enemy,
    x: enemy.homeX,
    y: enemy.homeY,
    vx: 0,
    direction: 'right',
    animState: 'walk',
    animFrame: 0,
    animTimer: 0,
    hitPoints: ENEMY_HIT_POINTS[enemy.spriteType],
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    alive: true,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/themes/platformer/entities/Enemy.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `resetGame`**

Add to `src/themes/platformer/PlatformerState.test.ts`:

```typescript
it('resetGame-afterEnemyMovedAndDied-revivesTheSameObjectsInPlace', () => {
  const before = enemyStates.value;
  enemyStates.value = before.map((e) => ({ ...e, x: e.x + 200, hitPoints: 0, alive: false }));

  resetGame();

  expect(enemyStates.value).toHaveLength(before.length);
  expect(enemyStates.value.every((e) => e.alive)).toBe(true);
  enemyStates.value.forEach((e, i) => {
    expect(e.x).toBe(before[i].x);
    expect(e.id).toBe(before[i].id);
  });
});

it('resetGame-enemyCarryingSessionState-preservesThatStateAcrossRevive', () => {
  // The property the whole plan exists for: resetGame() must not be able to
  // erase per-enemy session progress by rebuilding the array from placements.
  enemyStates.value = enemyStates.value.map((e, i) => (i === 0 ? { ...e, alive: false } : e));
  const targetId = enemyStates.value[0].id;

  resetGame();

  expect(enemyStates.value[0].id).toBe(targetId);
  expect(enemyStates.value[0].alive).toBe(true);
});
```

- [ ] **Step 6: Run it to verify it passes against the current rebuild**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: PASS — a rebuild from placements happens to satisfy both assertions today. These tests are here to stay green through Step 7, guarding the seam while it changes.

- [ ] **Step 7: Switch `resetGame` from rebuild to revive**

In `PlatformerState.ts`'s `resetGame()`, replace:

```typescript
  enemyStates.value = enemyPlacements.value.map((placement, index) => toEnemyState(placement, index));
```

with:

```typescript
  enemyStates.value = enemyStates.value.map(reviveEnemy);
```

Import `reviveEnemy` from `./entities/Enemy`. Leave `resetGameProgress()` alone — it calls `resetGame()` and must additionally rebuild from placements, so append to it:

```typescript
  enemyStates.value = enemyPlacements.value.map((placement, index) => toEnemyState(placement, index));
```

Update `resetGame`'s doc comment: enemies are now revived in place rather than rebuilt, and `resetGameProgress()` is the only remaining rebuild.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. `PlatformerPage.test.tsx`'s existing respawn tests are the real check here.

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): revive enemies in place instead of rebuilding from placements"
```

---

### Task 4: `rewardGiven` replaces the three id-keyed ledgers

**Model:** Sonnet 5 to implement. Review against the browser checks in Step 10 — this is the plan's only intended behavior change.

**Files:**
- Modify: `src/themes/platformer/entities/Enemy.ts` (`EnemyState`, `toEnemyState`)
- Modify: `src/themes/platformer/engine/Renderer.ts` (`drawEnemies`)
- Modify: `src/themes/platformer/PlatformerPage.tsx` (defeat handler, `drawEnemies` call site)
- Test: `src/themes/platformer/entities/Enemy.test.ts`, `src/themes/platformer/engine/Renderer.test.ts`, `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `EnemyState.alive` (Task 2), `reviveEnemy` (Task 3).
- Produces: `EnemyState.rewardGiven: boolean`. `drawEnemies`' trailing `droppedKeyEnemyIds: ReadonlySet<string>` parameter is removed; the held-key decision reads `enemy.rewardGiven`.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/engine/Renderer.test.ts`, in the existing `drawEnemies` describe block:

```typescript
it('purpleSlimeThatAlreadyGaveItsReward-drawsNoHeldKey', () => {
  const ctx = makeMockCtx();
  const enemy = makePurpleEnemy({ rewardGiven: true });
  drawEnemies(ctx, [enemy], greenSprite, purpleSprite, 0, 0, 0, keySprite);
  expect(drawImageCallsFor(ctx, keySprite)).toHaveLength(0);
});

it('purpleSlimeThatHasNotGivenItsReward-drawsAHeldKey', () => {
  const ctx = makeMockCtx();
  const enemy = makePurpleEnemy({ rewardGiven: false });
  drawEnemies(ctx, [enemy], greenSprite, purpleSprite, 0, 0, 0, keySprite);
  expect(drawImageCallsFor(ctx, keySprite).length).toBeGreaterThan(0);
});
```

Adapt the mock-context helper, the sprite fixtures, and the positional argument list to the ones this file already uses for `drawEnemies` — do not introduce new helpers if equivalents exist. Note the argument list is one shorter than today's, because `droppedKeyEnemyIds` is being removed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `Property 'rewardGiven' does not exist on type 'EnemyState'`.

- [ ] **Step 3: Add the field**

In `entities/Enemy.ts`, add to `EnemyState`:

```typescript
  /** True once this enemy's one reward — its CV fact, or the item its type
   *  drops — has been handed out. Persists across death and respawn
   *  (`reviveEnemy` deliberately leaves it alone), so an enemy revived after a
   *  player death is a normal killable obstacle with nothing left to give.
   *  Cleared only by `resetGameProgress()`, which rebuilds the whole array.
   *
   *  This replaces three separate id-keyed dedup lookups: against
   *  `keyPickupStates` for dropped items, against `collectedFacts` for facts,
   *  and a per-frame `droppedKeyEnemyIds` Set rebuilt inside the render path. */
  rewardGiven: boolean;
```

In `toEnemyState`, add `rewardGiven: false`.

- [ ] **Step 4: Remove `droppedKeyEnemyIds` from the renderer**

In `engine/Renderer.ts`'s `drawEnemies`, delete the trailing `droppedKeyEnemyIds` parameter and its doc comment, and replace:

```typescript
    const showsHeldKey =
      enemy.spriteType === 'slimePurple' && keySprite !== null && !droppedKeyEnemyIds.has(enemy.id);
```

with:

```typescript
    const showsHeldKey =
      enemy.spriteType === 'slimePurple' && keySprite !== null && !enemy.rewardGiven;
```

In `PlatformerPage.tsx`, delete the `droppedKeyEnemyIds` construction:

```typescript
const droppedKeyEnemyIds = new Set(keyPickupStates.value.map((k) => k.id));
```

and drop the corresponding argument from the `drawEnemies(...)` call.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test for once-only rewards**

Add to `src/themes/platformer/PlatformerPage.test.tsx`, beside the existing `purpleSlimeRespawnedAfterDeath-defeatedAgain-doesNotDropASecondKey` test:

```typescript
it('enemyThatGaveItsReward-isFlaggedRewardGivenAndStaysFlaggedAcrossRespawn', () => {
  // The dedup is now a property of the enemy itself rather than a lookup into
  // keyPickupStates, so assert on the enemy. This holds for any reward type,
  // not only dropped keys.
  let frameCallback: FrameRequestCallback | null = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  render(<PlatformerPage />);
  frameCallback!(0);

  const target = enemyStates.value.find((e) => e.spriteType === 'slimePurple')!;
  enemyStates.value = enemyStates.value.map((e) =>
    e.id === target.id ? { ...e, hitPoints: 1 } : e,
  );
  playerState.value = {
    ...playerState.value,
    x: target.x,
    y: stompLandingY(target),
    vy: 300,
  };

  let t = 16;
  frameCallback!(t);
  for (let i = 0; i < 30; i++) {
    t += 16;
    frameCallback!(t);
  }

  expect(enemyStates.value.find((e) => e.id === target.id)?.rewardGiven).toBe(true);

  resetGame();

  const revived = enemyStates.value.find((e) => e.id === target.id)!;
  expect(revived.alive).toBe(true);
  expect(revived.hitPoints).toBeGreaterThan(0);
  expect(revived.rewardGiven).toBe(true);
});
```

Import `resetGame` from `./PlatformerState` if the file does not already.

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx -t rewardGiven`
Expected: FAIL — `rewardGiven` is still `false`; nothing sets it yet.

- [ ] **Step 8: Rewrite the defeat handler**

In `PlatformerPage.tsx`, change the selection:

```typescript
// An enemy is rewarded exactly once for the lifetime of the session: `alive`
// goes false on the finishing stomp and `rewardGiven` is set the same tick, so
// a revived enemy stomped again in a later life is never selected here. This is
// what replaces the previous dedup lookups into keyPickupStates/collectedFacts.
const justDefeated = enemyStates.value.filter((e) => !e.alive && !e.rewardGiven);
```

In the item-drop branch, delete the `alreadyDropped` guard:

```typescript
if (enemy.spriteType === 'slimePurple') {
  keyPickupStates.value = [...keyPickupStates.value, spawnKeyPickup(enemy.id, enemy.x, enemy.y)];
  continue;
}
```

`spawnKeyPickup` keeps taking `enemy.id`, but only as the pickup's own identity within `keyPickupStates` — it is no longer a dedup key. Update `entities/KeyPickup.ts`'s `KeyPickupState.id` doc comment accordingly: the id identifies the pickup for collection, and the no-second-key guarantee now lives on the source enemy's `rewardGiven`.

In the fact branch, drop the `newFacts` membership half of the guard:

```typescript
// Facts are 1:1 with enemies by construction (EnemyMapper.ts zips each CVData
// entry to exactly one marker), and `rewardGiven` already guarantees one payout
// per enemy, so no membership check against newFacts is needed.
const fact = enemy.fact;
if (!fact) continue;
```

At the end of the `justDefeated` block — **after** the loop and outside any `continue` path, so it covers plain enemies with no reward too — flag every selected enemy:

```typescript
const rewardedIds = new Set(justDefeated.map((e) => e.id));
enemyStates.value = enemyStates.value.map((e) =>
  rewardedIds.has(e.id) ? { ...e, rewardGiven: true } : e,
);
```

This is the one remaining id use, and it is local to a single tick — it maps a just-computed subset back onto the array, not a lookup into persisted state. If the surrounding code already has an index available, prefer flagging by index.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, including the pre-existing `purpleSlimeRespawnedAfterDeath-defeatedAgain-doesNotDropASecondKey` test, which now passes by a different mechanism.

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 10: Verify in the browser**

Start the dev server and confirm by hand:

1. Stomp the purple slime three times → a key drops and the held-key shine disappears.
2. Collect the key, then die (walk into a pit).
3. After respawn, the purple slime is back at its placement tile at full hit points, with **no** held-key shine.
4. Stomp it three times again → **no** second key drops, and the key counter stays at its previous value.
5. Stomp a green slime carrying a fact, die, and stomp it again → the journal shows one entry, not two.
6. Click Reset Game → the purple slime shows its held key again and can drop a key once more.

- [ ] **Step 11: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): store reward payout on the enemy instead of id-keyed ledgers"
```

---

## Done criteria

- `grep -rn "droppedKeyEnemyIds\|defeated" src/themes/platformer/` returns nothing.
- `enemyStates.value.length` is constant for the whole session except across `resetGameProgress()`.
- `npm test` and `npx tsc -b --noEmit` both pass.
- The browser checks in Task 4 Step 10 all hold.
