# Purple Slime Spike Cooldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a purple slime is stomped but not defeated, it grows spikes on
top for a 1.5s cooldown. Landing on its spiked top during that window damages
the player (same as a side touch) instead of registering as a stomp. Once the
cooldown expires the spikes retract and it's stompable from the top again as
normal. This reverses the currently-intentional "chain-stomp a purple slime 3
times in one bounce arc" behavior documented in `Collision.ts`'s
`checkEnemyStompCollisions` and `Enemy.ts`'s `applyStomp`.

**Architecture:** Two new fields on `EnemyState` (`spiked`, `spikeTimer`),
set by `applyStomp` (Enemy.ts) whenever a stomp doesn't finish the enemy off,
counted down by a new `stepEnemySpikeCooldown` (EnemyAI.ts, same shape as the
existing `stepEnemyHitReaction`), and consumed by `Collision.ts`'s two
existing collision-detection functions: `checkEnemyStompCollisions` excludes a
`spiked` enemy from stomp registration, and `checkEnemySideCollisions` stops
treating a top-landing on a `spiked` enemy as "not a hit" — so it flows
through `PlatformerPage.tsx`'s existing side-hit damage/knockback code
unchanged, no new damage-handling logic needed there. `Renderer.ts` gets a
new `drawEnemySpikes` that draws a small row of triangles over a spiked
enemy's top — procedurally drawn (same `moveTo`/`lineTo`/`closePath`/`fill`
convention `drawSignBubble`'s tail already uses), not a new sprite asset, so
this plan has no image-generation dependency.

**Tech Stack:** TypeScript (strict), Vitest + React Testing Library, HTML5
Canvas 2D (no new libraries).

**Spec:** `specs/S-006-platformer-theme/spec.md`'s "Session 2026-09-01
(purple slime spike cooldown ideation)" Clarifications entry, and
`docs/ideas/platformer-purple-slime-spikes.md` (the design doc this plan
formalizes — read alongside this plan for the full rationale and the open
questions listed there that this plan resolves with concrete values).

## Global Constraints

- TypeScript strict mode, no `any`, no `@ts-ignore` (constitution Principle I).
- Test-first: write the failing test before the implementation for every step
  (constitution Principle II, NON-NEGOTIABLE). Test names follow
  `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies, no new sprite assets — the spike visual is drawn
  procedurally in Canvas.
- This branch is off `S-006-platformer-theme` (e.g.
  `S-006-step33-purple-slime-spike-cooldown` — confirm the actual next free
  step number in `roadmap.md` before naming the branch, since this idea isn't
  numbered yet), per the roadmap's branch-strategy: PR back into
  `S-006-platformer-theme`, not `main` directly.

---

### Task 1: `spiked`/`spikeTimer` on `EnemyState`, `applyStomp` sets them

**Files:**
- Modify: `src/themes/platformer/entities/Enemy.ts`
- Modify: `src/themes/platformer/entities/Enemy.test.ts`

**Interfaces:**
- Produces: `EnemyState.spiked: boolean`, `EnemyState.spikeTimer: number`
  (seconds accumulated since the spikes appeared — meaningless while
  `spiked` is `false`, same convention as the existing `hitTimer` field).
  `toEnemyState` initializes both to `false`/`0`. `applyStomp` sets
  `spiked: nextHitPoints > 0` and `spikeTimer: 0` (the enemy grows spikes
  whenever it survives the stomp, regardless of whether it was already
  `spiked` from an earlier stomp — a fresh stomp always restarts the
  cooldown).

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/entities/Enemy.test.ts

describe('toEnemyState spiked/spikeTimer defaults', () => {
  it('toEnemyState-anyPlacement-startsNotSpiked', () => {
    const placement = { id: 'e1', spriteType: 'slimePurple' as const, x: 0, y: 0 };
    const state = toEnemyState(placement);
    expect(state.spiked).toBe(false);
    expect(state.spikeTimer).toBe(0);
  });
});

describe('applyStomp spiked behavior', () => {
  it('applyStomp-survivingStomp-becomesSpikedWithResetTimer', () => {
    const state = { ...toEnemyState({ id: 'e1', spriteType: 'slimePurple' as const, x: 0, y: 0 }), spikeTimer: 0.9 };
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(2);
    expect(next.spiked).toBe(true);
    expect(next.spikeTimer).toBe(0);
  });

  it('applyStomp-finishingStomp-doesNotBecomeSpiked', () => {
    const state = { ...toEnemyState({ id: 'e1', spriteType: 'slimeGreen' as const, x: 0, y: 0 }) };
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(0);
    expect(next.spiked).toBe(false);
  });

  it('applyStomp-alreadySpikedSurvivingAnotherStomp-restartsTimer', () => {
    const state = {
      ...toEnemyState({ id: 'e1', spriteType: 'slimePurple' as const, x: 0, y: 0 }),
      hitPoints: 2,
      spiked: true,
      spikeTimer: 1.2,
    };
    const next = applyStomp(state);
    expect(next.hitPoints).toBe(1);
    expect(next.spiked).toBe(true);
    expect(next.spikeTimer).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Enemy.test.ts`
Expected: FAIL — `spiked`/`spikeTimer` don't exist on `EnemyState`, so
`state.spiked`/`state.spikeTimer` are `undefined`, not the asserted values
(TypeScript itself will also flag the object literals as excess/missing
properties once `EnemyState` gains the required fields — write the test
first as shown; the type error is expected until Step 3 lands).

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/entities/Enemy.ts`. In the `EnemyState`
interface, add two fields after `hitTimer` (before `defeated`):

```typescript
  /** True while this enemy's top is spiked and un-stompable — set by
   *  `applyStomp` whenever a stomp doesn't finish the enemy off, cleared by
   *  `EnemyAI.ts`'s `stepEnemySpikeCooldown` once `spikeTimer` reaches
   *  `SPIKE_COOLDOWN_DURATION_SECONDS`. While `true`, `Collision.ts`'s
   *  `checkEnemyStompCollisions` excludes this enemy from stomp
   *  registration, and `checkEnemySideCollisions` treats a top-landing on it
   *  as player damage instead of a stomp. Independent of `animState`/
   *  `hitTimer` — the hit-reaction animation (0.4s) and the spike cooldown
   *  (longer, see EnemyAI.ts) run as two separate timers driven by the same
   *  per-tick `dt`. */
  spiked: boolean;
  /** Seconds elapsed since `spiked` was last set `true` — meaningless while
   *  `spiked` is `false`. Same convention as `hitTimer` above. */
  spikeTimer: number;
```

Replace `toEnemyState`'s return object's tail:

```typescript
    hitPoints: ENEMY_HIT_POINTS[placement.spriteType],
    hitTimer: 0,
    defeated: false,
  };
```

with:

```typescript
    hitPoints: ENEMY_HIT_POINTS[placement.spriteType],
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    defeated: false,
  };
```

Replace `applyStomp`'s doc comment and body. Currently:

```typescript
/**
 * Applies one stomp: decrements `hitPoints`, freezes horizontal movement, and
 * enters the `hit` reaction (red-flash/dissolve) animation from its first
 * frame — even if the enemy was already mid-reaction from an earlier stomp
 * this same bounce arc (a skilled player can chain-stomp a still-alive
 * 3-hit purple enemy entirely airborne — see `Collision.ts`'s
 * `checkEnemyStompCollisions`, which only
 * excludes an enemy once `hitPoints` has actually reached 0, not while it's
 * merely mid-reaction), so a legitimate second stomp always replays the
 * reaction from frame 0 rather than continuing wherever the first one left
 * off. Does NOT decide defeat here — EnemyAI.ts's `stepEnemyHitReaction`
 * checks `hitPoints` once the reaction animation finishes playing, so the
 * player always sees the same brief "stunned" reaction whether or not this
 * stomp was the finishing blow.
 */
export function applyStomp(enemy: EnemyState): EnemyState {
  return {
    ...enemy,
    hitPoints: enemy.hitPoints - 1,
    vx: 0,
    animState: 'hit',
    animFrame: 0,
    animTimer: 0,
    hitTimer: 0,
  };
}
```

becomes:

```typescript
/**
 * Applies one stomp: decrements `hitPoints`, freezes horizontal movement,
 * enters the `hit` reaction (red-flash/dissolve) animation from its first
 * frame, and — if the enemy survives (`hitPoints` still > 0 after the
 * decrement) — grows spikes (`spiked: true`, `spikeTimer` reset to 0) that
 * make its top un-stompable for a cooldown (see `EnemyAI.ts`'s
 * `stepEnemySpikeCooldown` and `Collision.ts`'s `checkEnemyStompCollisions`/
 * `checkEnemySideCollisions`). This function itself doesn't gate re-entry —
 * calling it twice in a row always applies a second stomp — the `spiked`
 * exclusion lives entirely in `Collision.ts`, which decides whether a given
 * frame's landing counts as a legal stomp before this function is ever
 * called. A fresh stomp always restarts the cooldown timer, even if the
 * enemy was already `spiked` from an earlier stomp. Does NOT decide defeat
 * here — EnemyAI.ts's `stepEnemyHitReaction` checks `hitPoints` once the
 * reaction animation finishes playing, so the player always sees the same
 * brief "stunned" reaction whether or not this stomp was the finishing blow.
 */
export function applyStomp(enemy: EnemyState): EnemyState {
  const hitPoints = enemy.hitPoints - 1;
  return {
    ...enemy,
    hitPoints,
    vx: 0,
    animState: 'hit',
    animFrame: 0,
    animTimer: 0,
    hitTimer: 0,
    spiked: hitPoints > 0,
    spikeTimer: 0,
  };
}
```

Also update the now-stale comment on the existing test
`enemyAlreadyMidHitReactionFromAnEarlierStomp-resetsAnimationAgain` in
`Enemy.test.ts` (it still passes unchanged — it calls `applyStomp` directly,
bypassing the collision layer — but its comment describes the old
"deliberate airborne chain-stomp" framing this plan removes). Change:

```typescript
  it('enemyAlreadyMidHitReactionFromAnEarlierStomp-resetsAnimationAgain', () => {
    // A legitimate second stomp (chain-stomping a still-alive purple enemy,
    // even entirely airborne from the first stomp's own bounce arc — see
    // Collision.ts's checkEnemyStompCollisions) must replay the reaction
    // from frame 0, not continue wherever the first stomp's animation had
    // gotten to.
```

to:

```typescript
  it('enemyAlreadyMidHitReactionFromAnEarlierStomp-resetsAnimationAgain', () => {
    // applyStomp itself never refuses a second call (see its doc comment) —
    // calling it again mid-reaction must replay from frame 0, not continue
    // wherever the first stomp's animation had gotten to. Collision.ts's
    // `spiked` exclusion is what actually prevents this from happening via
    // real player input once spikes are up — this test exercises the
    // function directly, bypassing that gate.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Enemy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Enemy.ts src/themes/platformer/entities/Enemy.test.ts
git commit -m "feat(platformer): add spiked/spikeTimer to EnemyState, set by applyStomp"
```

---

### Task 2: `stepEnemySpikeCooldown` in `EnemyAI.ts`

**Files:**
- Modify: `src/themes/platformer/engine/EnemyAI.ts`
- Modify: `src/themes/platformer/engine/EnemyAI.test.ts`

**Interfaces:**
- Consumes: `EnemyState.spiked`/`spikeTimer` (Task 1).
- Produces: `SPIKE_COOLDOWN_DURATION_SECONDS = 1.5` (starting value — longer
  than `HIT_REACTION_DURATION_SECONDS` (0.4s) so the cooldown is clearly a
  separate, longer beat than the stun animation; tune by playtest once this
  is running in the browser). `stepEnemySpikeCooldown(enemy: EnemyState, dt:
  number): EnemyState` — no-op (returns the same reference) while `spiked` is
  `false`; otherwise accumulates `spikeTimer` by `dt` and clears
  `spiked`/resets `spikeTimer` to 0 once it reaches the duration. Same
  no-op-until-threshold shape as the existing `stepEnemyHitReaction`.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/engine/EnemyAI.test.ts
import { stepEnemySpikeCooldown, SPIKE_COOLDOWN_DURATION_SECONDS } from './EnemyAI';

describe('stepEnemySpikeCooldown', () => {
  it('stepEnemySpikeCooldown-notSpiked-isNoOp', () => {
    const enemy = { ...makeEnemyAt(5), spiked: false, spikeTimer: 0 };
    const next = stepEnemySpikeCooldown(enemy, 1);
    expect(next).toBe(enemy);
  });

  it('stepEnemySpikeCooldown-spikedBelowDuration-accumulatesTimer', () => {
    const enemy = { ...makeEnemyAt(5), spiked: true, spikeTimer: 0 };
    const next = stepEnemySpikeCooldown(enemy, 0.5);
    expect(next.spiked).toBe(true);
    expect(next.spikeTimer).toBe(0.5);
  });

  it('stepEnemySpikeCooldown-reachesDuration-clearsSpiked', () => {
    const enemy = { ...makeEnemyAt(5), spiked: true, spikeTimer: SPIKE_COOLDOWN_DURATION_SECONDS - 0.1 };
    const next = stepEnemySpikeCooldown(enemy, 0.2);
    expect(next.spiked).toBe(false);
    expect(next.spikeTimer).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EnemyAI.test.ts`
Expected: FAIL — `stepEnemySpikeCooldown`/`SPIKE_COOLDOWN_DURATION_SECONDS`
don't exist yet.

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/engine/EnemyAI.ts`. Add, after
`HIT_REACTION_DURATION_SECONDS`'s declaration:

```typescript
/** How long a purple slime's post-stomp spikes stay up before retracting —
 *  longer than HIT_REACTION_DURATION_SECONDS (0.4s) so the cooldown reads as
 *  a distinct, deliberate "wait it out" beat rather than blurring into the
 *  stun animation. Starting value — tune by playtest. */
export const SPIKE_COOLDOWN_DURATION_SECONDS = 1.5;
```

Add, after `stepEnemyHitReaction`:

```typescript
/**
 * Advances a spiked enemy's cooldown by `dt` seconds. No-op (returns the
 * same reference) for an enemy that isn't currently `spiked` — same
 * no-op-until-threshold shape as `stepEnemyHitReaction` above, but this
 * timer runs independently of `animState`/`hitTimer`: a purple slime keeps
 * counting down its spike cooldown while patrolling normally, not just
 * while mid hit-reaction.
 */
export function stepEnemySpikeCooldown(enemy: EnemyState, dt: number): EnemyState {
  if (!enemy.spiked) return enemy;

  const spikeTimer = enemy.spikeTimer + dt;
  if (spikeTimer < SPIKE_COOLDOWN_DURATION_SECONDS) {
    return { ...enemy, spikeTimer };
  }
  return { ...enemy, spiked: false, spikeTimer: 0 };
}
```

Also fix the now-broken literal `EnemyState` fixture in `EnemyAI.test.ts`'s
`stepEnemyPatrol-slimePurple-movesSlowerThanGreen` test (it builds a full
`EnemyState` object by hand, not via `toEnemyState`, so it needs the two new
required fields). Change:

```typescript
    const base = {
      id: 'e1',
      x: 3 * RENDERED_TILE_SIZE,
      y: 0,
      vx: 0,
      direction: 'right' as const,
      animState: 'walk' as const,
      animFrame: 0,
      animTimer: 0,
      hitPoints: 1,
      hitTimer: 0,
      defeated: false,
    };
```

to:

```typescript
    const base = {
      id: 'e1',
      x: 3 * RENDERED_TILE_SIZE,
      y: 0,
      vx: 0,
      direction: 'right' as const,
      animState: 'walk' as const,
      animFrame: 0,
      animTimer: 0,
      hitPoints: 1,
      hitTimer: 0,
      spiked: false,
      spikeTimer: 0,
      defeated: false,
    };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EnemyAI.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/EnemyAI.ts src/themes/platformer/engine/EnemyAI.test.ts
git commit -m "feat(platformer): add stepEnemySpikeCooldown"
```

---

### Task 3: `Collision.ts` — spiked enemies block stomps, damage on top-touch

**Files:**
- Modify: `src/themes/platformer/engine/Collision.ts`
- Modify: `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Consumes: `EnemyState.spiked` (Task 1).
- Produces: `checkEnemyStompCollisions` now also excludes any `spiked`
  enemy. `checkEnemySideCollisions`'s `isStompLanding` is `false` whenever
  the enemy is `spiked` (regardless of the player's fall angle), so a
  top-landing on a spiked enemy is reported as a hit like any other touch.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/engine/Collision.test.ts

function makeSpikedPurpleEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 'e1', spriteType: 'slimePurple', x: 10, y: 20, vx: 0,
    direction: 'right', animState: 'walk', animFrame: 0,
    animTimer: 0, hitPoints: 2, hitTimer: 0, defeated: false,
    spiked: true, spikeTimer: 0.1,
    ...overrides,
  };
}

describe('checkEnemyStompCollisions excludes spiked enemies', () => {
  it('checkEnemyStompCollisions-spikedEnemyDirectlyBelow-doesNotRegister', () => {
    const enemy = makeSpikedPurpleEnemy();
    const box = enemyHitbox(enemy);
    const player = {
      x: box.x, y: box.y - 5, vx: 0, vy: 50, facing: 'right' as const, grounded: false,
      climbing: false, isDroppingThroughBridge: false, lastGroundedX: 0, lastGroundedY: 0,
      animState: 'jump' as const, animFrame: 0, animTimer: 0, invincibleTimer: 0,
      knockbackTimer: 0, bounceAscending: false, hitBlockIds: [],
    };
    expect(checkEnemyStompCollisions(player, [enemy])).toEqual([]);
  });
});

describe('checkEnemySideCollisions treats a spiked top-landing as a hit', () => {
  it('checkEnemySideCollisions-spikedEnemyLandedOnFromAbove-registersAsHit', () => {
    const enemy = makeSpikedPurpleEnemy();
    const box = enemyHitbox(enemy);
    const player = {
      x: box.x, y: box.y - 5, vx: 0, vy: 50, facing: 'right' as const, grounded: false,
      climbing: false, isDroppingThroughBridge: false, lastGroundedX: 0, lastGroundedY: 0,
      animState: 'jump' as const, animFrame: 0, animTimer: 0, invincibleTimer: 0,
      knockbackTimer: 0, bounceAscending: false, hitBlockIds: [],
    };
    expect(checkEnemySideCollisions(player, [enemy])).toEqual(['e1']);
  });

  it('checkEnemySideCollisions-nonSpikedEnemyLandedOnFromAbove-stillExcludedAsStomp', () => {
    const enemy = makeSpikedPurpleEnemy({ spiked: false, spikeTimer: 0 });
    const box = enemyHitbox(enemy);
    const player = {
      x: box.x, y: box.y - 5, vx: 0, vy: 50, facing: 'right' as const, grounded: false,
      climbing: false, isDroppingThroughBridge: false, lastGroundedX: 0, lastGroundedY: 0,
      animState: 'jump' as const, animFrame: 0, animTimer: 0, invincibleTimer: 0,
      knockbackTimer: 0, bounceAscending: false, hitBlockIds: [],
    };
    expect(checkEnemySideCollisions(player, [enemy])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Collision.test.ts`
Expected: FAIL — `checkEnemyStompCollisions` still registers the spiked
enemy (doesn't check `spiked` yet); `checkEnemySideCollisions` still treats
the top-landing as a stomp and excludes it (empty array instead of `['e1']`).
Also confirm the existing three literal `EnemyState` fixtures in this file
(the ones building objects with `hitTimer: 0, defeated: false,` — see the
`enemyHitbox`/`checkKeyPickupCollisions` describe blocks added by the
purple-slime key-mechanic plan) still type-check; if not, add
`spiked: false, spikeTimer: 0,` to each alongside their existing
`hitTimer`/`defeated` fields before running this command.

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/engine/Collision.ts`. Update
`checkEnemyStompCollisions`'s doc comment and body. Currently:

```typescript
/**
 * Returns the ids of every not-yet-fatally-hit enemy the player just stomped
 * this frame: overlapping AND falling (`player.vy > 0`) AND landing on the
 * enemy's upper half (the player's hitbox bottom edge is at or above the
 * enemy's vertical midpoint) — this is what distinguishes "jumped on top of"
 * from a side/below touch (a separate concern, intentionally not handled
 * here: this function returns [] for that case, same as for no contact at
 * all). An enemy already `defeated`, or one whose `hitPoints` has already
 * reached 0 (mid `hit`-reaction, awaiting removal), is excluded — without
 * this, a stomp's own bounce naturally arcs back down onto the same enemy,
 * and would otherwise keep decrementing `hitPoints` arbitrarily far below 0
 * every time. Deliberately NOT gated on `animState === 'hit'` alone, nor on
 * any player-side cooldown/landing/separation tracking — this engine has no
 * double-jump, so "the player lands on the same still-alive enemy again
 * while still airborne from their own stomp bounce" is a deliberate,
 * desired mechanic (chain-stomping a 3-hit purple enemy in one fluid
 * motion), not a bug to guard against. `hitPoints > 0` is the only thing
 * that should stop a stomp from registering.
 */
export function checkEnemyStompCollisions(player: PlayerState, enemies: EnemyState[]): string[] {
  if (player.vy <= 0) return [];
  const hitbox = playerHitbox(player);
  const stomped: string[] = [];
  for (const enemy of enemies) {
    if (enemy.defeated || enemy.hitPoints <= 0) continue;
    const box = enemyHitbox(enemy);
    if (!aabbOverlap(hitbox, box)) continue;
    const enemyMidY = box.y + box.height / 2;
    if (hitbox.y + hitbox.height <= enemyMidY) {
      stomped.push(enemy.id);
    }
  }
  return stomped;
}
```

becomes:

```typescript
/**
 * Returns the ids of every not-yet-fatally-hit, not-currently-`spiked` enemy
 * the player just stomped this frame: overlapping AND falling (`player.vy >
 * 0`) AND landing on the enemy's upper half (the player's hitbox bottom edge
 * is at or above the enemy's vertical midpoint) — this is what distinguishes
 * "jumped on top of" from a side/below touch (a separate concern,
 * intentionally not handled here: this function returns [] for that case,
 * same as for no contact at all). An enemy already `defeated`, or one whose
 * `hitPoints` has already reached 0 (mid `hit`-reaction, awaiting removal),
 * is excluded — without this, a stomp's own bounce naturally arcs back down
 * onto the same enemy, and would otherwise keep decrementing `hitPoints`
 * arbitrarily far below 0 every time. A `spiked` enemy is excluded too — its
 * spikes make the top un-stompable until they retract (see `Enemy.ts`'s
 * `applyStomp`, `EnemyAI.ts`'s `stepEnemySpikeCooldown`); the same
 * top-landing on a spiked enemy is instead picked up by
 * `checkEnemySideCollisions` below and treated as player damage. Not gated
 * on `animState === 'hit'` alone — a still-airborne bounce back onto a
 * non-spiked, still-alive enemy (possible only for a single non-fatal stomp,
 * since that same stomp immediately sets `spiked: true`) is unaffected by
 * this function; `spiked` is what actually prevents repeat top-stomps now.
 */
export function checkEnemyStompCollisions(player: PlayerState, enemies: EnemyState[]): string[] {
  if (player.vy <= 0) return [];
  const hitbox = playerHitbox(player);
  const stomped: string[] = [];
  for (const enemy of enemies) {
    if (enemy.defeated || enemy.hitPoints <= 0 || enemy.spiked) continue;
    const box = enemyHitbox(enemy);
    if (!aabbOverlap(hitbox, box)) continue;
    const enemyMidY = box.y + box.height / 2;
    if (hitbox.y + hitbox.height <= enemyMidY) {
      stomped.push(enemy.id);
    }
  }
  return stomped;
}
```

Update `checkEnemySideCollisions`'s doc comment and body. Currently:

```typescript
/**
 * Returns the ids of every non-defeated, non-reacting enemy the player is
 * touching in a way that is NOT a stomp — the exact inverse of
 * `checkEnemyStompCollisions`'s landing condition: any overlap where the
 * player either isn't falling (`vy <= 0`) or is falling but contacting the
 * enemy's lower half (side or below), not landing on its upper half. An
 * enemy currently playing its `hit` reaction is excluded here too, same as
 * stomp detection — otherwise, immediately bouncing off a stomp while still
 * overlapping the now-frozen enemy (rising, or drifting beside it before
 * separating) would register as a spurious side-hit against the very enemy
 * just stomped. A stunned/reacting enemy is harmless in every way until its
 * reaction ends, not just immune to a second stomp.
 */
export function checkEnemySideCollisions(player: PlayerState, enemies: EnemyState[]): string[] {
  const hitbox = playerHitbox(player);
  const hits: string[] = [];
  for (const enemy of enemies) {
    if (enemy.defeated || enemy.animState === 'hit') continue;
    const box = enemyHitbox(enemy);
    if (!aabbOverlap(hitbox, box)) continue;
    const enemyMidY = box.y + box.height / 2;
    const isStompLanding = player.vy > 0 && hitbox.y + hitbox.height <= enemyMidY;
    if (!isStompLanding) hits.push(enemy.id);
  }
  return hits;
}
```

becomes:

```typescript
/**
 * Returns the ids of every non-defeated, non-reacting enemy the player is
 * touching in a way that counts as damage — the exact inverse of
 * `checkEnemyStompCollisions`'s landing condition, EXCEPT for one case: a
 * `spiked` enemy's top is never treated as a legal stomp landing (its
 * spikes make it un-stompable — see `checkEnemyStompCollisions`'s doc
 * comment above), so any overlap with a `spiked` enemy counts as a hit here,
 * including a fall-and-land-on-top that would be a stomp against a
 * non-spiked enemy. For a non-spiked enemy, this is still the exact inverse
 * it always was: any overlap where the player either isn't falling (`vy <=
 * 0`) or is falling but contacting the enemy's lower half (side or below),
 * not landing on its upper half. An enemy currently playing its `hit`
 * reaction is excluded here too, same as stomp detection — otherwise,
 * immediately bouncing off a stomp while still overlapping the now-frozen
 * enemy (rising, or drifting beside it before separating) would register as
 * a spurious side-hit against the very enemy just stomped. A stunned/
 * reacting enemy is harmless in every way until its reaction ends, not just
 * immune to a second stomp — note a freshly-stomped enemy is BOTH `'hit'`
 * and `spiked` at once (`applyStomp` sets both), so this `animState`
 * exclusion is what actually protects it during its stun; `spiked` alone
 * would otherwise make a still-`'hit'`-reacting enemy's top count as damage
 * the instant its stomp registers.
 */
export function checkEnemySideCollisions(player: PlayerState, enemies: EnemyState[]): string[] {
  const hitbox = playerHitbox(player);
  const hits: string[] = [];
  for (const enemy of enemies) {
    if (enemy.defeated || enemy.animState === 'hit') continue;
    const box = enemyHitbox(enemy);
    if (!aabbOverlap(hitbox, box)) continue;
    const enemyMidY = box.y + box.height / 2;
    const isStompLanding = !enemy.spiked && player.vy > 0 && hitbox.y + hitbox.height <= enemyMidY;
    if (!isStompLanding) hits.push(enemy.id);
  }
  return hits;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Collision.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Collision.ts src/themes/platformer/engine/Collision.test.ts
git commit -m "feat(platformer): spiked enemies block stomps, damage on top-touch"
```

---

### Task 4: `Renderer.ts` — draw spikes on a spiked enemy

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `EnemyState.spiked` (Task 1), `enemyRenderedSize`/
  `enemyTileOffsetX`/`enemyTileOffsetY`/`enemyHitboxSidePadding`/
  `enemyHitboxTopPadding` (all existing, from `../entities/Enemy`).
- Produces: `drawEnemySpikes(ctx: CanvasRenderingContext2D, enemies:
  EnemyState[], originX?: number, originY?: number): void` — draws a row of
  3 triangles across the top of every `spiked` enemy's visible silhouette
  (not the full render slot — insets by the same hitbox padding
  `enemyHitbox` already uses, so the spikes sit exactly on the visible slime
  blob's top edge, not floating above it in transparent sprite margin). No
  sprite parameter — purely procedural (`ctx.fillStyle` + `moveTo`/`lineTo`/
  `closePath`/`fill`, same convention `drawSignBubble`'s tail already uses).
  Called by `drawEnemies` itself is deliberately NOT how this is wired —
  see this task's note on why it's a separate exported function.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/engine/Renderer.test.ts
import { drawEnemySpikes } from './Renderer';

describe('drawEnemySpikes', () => {
  it('drawEnemySpikes-spikedEnemy-drawsTriangles', () => {
    const ctx = makeMockContext();
    const enemy = makeEnemyState('e1', 'slimePurple', 0, 0, { spiked: true, spikeTimer: 0.1 });
    drawEnemySpikes(ctx, [enemy]);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
  });

  it('drawEnemySpikes-nonSpikedEnemy-drawsNothing', () => {
    const ctx = makeMockContext();
    const enemy = makeEnemyState('e1', 'slimePurple', 0, 0, { spiked: false, spikeTimer: 0 });
    drawEnemySpikes(ctx, [enemy]);
    expect(ctx.fill).not.toHaveBeenCalled();
  });
});
```

(`makeMockContext`/`makeEnemyState` are this test file's existing shared
helpers — reuse them, do not redefine. Confirm `makeMockContext`'s mock
already stubs `moveTo`/`lineTo`/`closePath`/`fill`/`beginPath` as `vi.fn()`s
— it does, per `drawSignBubble`'s existing tests in this same file; if for
some reason one is missing, add it to the mock alongside the others rather
than duplicating the mock factory.)

Also add `spiked: false, spikeTimer: 0,` to `makeEnemyState`'s base object
(same file, just above its `...overrides` spread) so every other existing
call site keeps compiling without individually specifying the new fields:

```typescript
    hitPoints: 1,
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    defeated: false,
    ...overrides,
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Renderer.test.ts`
Expected: FAIL — `drawEnemySpikes` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/engine/Renderer.ts`. Add the import (alongside
the existing `Enemy.ts` imports near `enemyRenderedSize`/
`enemyTileOffsetX`/`enemyTileOffsetY`):

```typescript
import { enemyHitboxSidePadding, enemyHitboxTopPadding } from '../entities/Enemy';
```

Add, after `drawEnemies`:

```typescript
const SPIKE_COUNT = 3;
const SPIKE_FILL_COLOR = '#e8e4d8';
const SPIKE_OUTLINE_COLOR = '#3a3428';

/**
 * Draws a row of SPIKE_COUNT triangles across the top of every `spiked`
 * enemy's visible silhouette. Insets by the same hitbox padding
 * `enemyHitbox` (Collision.ts) uses, so the spikes sit on the actual visible
 * slime blob's top edge rather than floating in the sprite's transparent
 * margin — same reasoning `enemyHitboxSidePadding`/`enemyHitboxTopPadding`
 * exist for in the first place. Deliberately a separate exported function
 * from `drawEnemies` (not folded into its loop) — `drawEnemies` is called
 * once per frame regardless of the game's animation/collision layering, and
 * keeping the spike overlay separate lets `PlatformerPage.tsx` draw it in
 * its own pass (spikes should read as "on top of" the enemy, so this must
 * be called after `drawEnemies`, not interleaved within it) without
 * threading extra parameters through `drawEnemies`' existing signature.
 * Purely procedural (no sprite) — no new asset needed for this small a
 * shape, matching `drawSignBubble`'s tail triangle convention.
 */
export function drawEnemySpikes(
  ctx: CanvasRenderingContext2D,
  enemies: EnemyState[],
  originX = 0,
  originY = 0,
): void {
  for (const enemy of enemies) {
    if (!enemy.spiked) continue;

    const size = enemyRenderedSize(enemy.spriteType);
    const sidePad = enemyHitboxSidePadding(enemy.spriteType);
    const topPad = enemyHitboxTopPadding(enemy.spriteType);
    const left = enemy.x + enemyTileOffsetX(enemy.spriteType) + sidePad + originX;
    const top = enemy.y + enemyTileOffsetY(enemy.spriteType) + topPad + originY;
    const width = size - 2 * sidePad;
    const spikeWidth = width / SPIKE_COUNT;
    const spikeHeight = spikeWidth * 0.9;

    for (let i = 0; i < SPIKE_COUNT; i++) {
      const baseLeftX = left + i * spikeWidth;
      const baseRightX = baseLeftX + spikeWidth;
      const tipX = baseLeftX + spikeWidth / 2;
      const tipY = top - spikeHeight;

      ctx.fillStyle = SPIKE_OUTLINE_COLOR;
      ctx.beginPath();
      ctx.moveTo(baseLeftX - 1, top);
      ctx.lineTo(tipX, tipY - 1);
      ctx.lineTo(baseRightX + 1, top);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = SPIKE_FILL_COLOR;
      ctx.beginPath();
      ctx.moveTo(baseLeftX, top);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseRightX, top);
      ctx.closePath();
      ctx.fill();
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Renderer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): draw procedural spikes on a spiked enemy"
```

---

### Task 5: `PlatformerPage.tsx` — wire the cooldown tick and the spike draw call

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `stepEnemySpikeCooldown` (Task 2, from `./engine/EnemyAI`),
  `drawEnemySpikes` (Task 4, from `./engine/Renderer`).

This task is small integration glue — the damage-on-spiked-top-touch
behavior needs NO new code here at all: `checkEnemySideCollisions` (Task 3)
already reports a spiked top-landing as a hit, and the existing side-hit
block (`healthState.value = takeDamage(...)`, `applyKnockback(...)`) already
runs generically over whatever ids that function returns. Only two things
are missing: the cooldown timer needs to actually tick, and the spikes need
to actually draw.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/PlatformerPage.test.tsx
// (Follow this file's existing pattern for driving the game loop and
// reading enemyStates/healthState — reuse whatever harness its other
// stomp-related tests already use, e.g. the purple-slime-defeat test added
// by the key-mechanic plan, rather than reinventing one.)

it('spikedPurpleSlime-stompedAgainFromTopDuringCooldown-damagesPlayerInstead', () => {
  // Arrange a purple slime at 2 hit points, stomp it once (survives,
  // becomes spiked), advance past HIT_REACTION_DURATION_SECONDS so it's
  // back to 'walk' and stompable-position-wise again, then land on it from
  // above a second time while still within SPIKE_COOLDOWN_DURATION_SECONDS.
  // Assert:
  // - the enemy's hitPoints is unchanged by the second landing (still 1,
  //   not 0 — no stomp registered)
  // - healthState.value reflects one SIDE_HIT_DAMAGE application from the
  //   second landing
});

it('spikedPurpleSlime-afterCooldownElapses-isStompableAgain', () => {
  // Same setup, but advance time past SPIKE_COOLDOWN_DURATION_SECONDS
  // before the second landing. Assert the second landing registers as a
  // real stomp (hitPoints decrements to 0, enemy proceeds toward defeat) —
  // not a side-hit.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: FAIL — `spiked` is never cleared (no cooldown tick wired in yet),
so both scenarios behave as if permanently spiked, and the "stompable again
after cooldown" case fails.

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/PlatformerPage.tsx` in two places.

**(a) Cooldown tick** — add the import alongside the existing
`stepEnemyPatrol, stepEnemyHitReaction` import:

```typescript
import { stepEnemyPatrol, stepEnemyHitReaction, stepEnemySpikeCooldown } from './engine/EnemyAI';
```

Then, in the enemy-update tick (the `enemyStates.value = enemyStates.value.map((enemy) => { ... })` block), thread the new step in before animation advances. Change:

```typescript
      enemyStates.value = enemyStates.value.map((enemy) => {
        const next =
          enemy.animState === 'hit'
            ? stepEnemyHitReaction(enemy, dt)
            : stepEnemyPatrol(enemy, currentLevel.value, dt, blockedTiles);
        return advanceEnemyAnimation(next, dt);
      });
```

to:

```typescript
      enemyStates.value = enemyStates.value.map((enemy) => {
        const next =
          enemy.animState === 'hit'
            ? stepEnemyHitReaction(enemy, dt)
            : stepEnemyPatrol(enemy, currentLevel.value, dt, blockedTiles);
        return advanceEnemyAnimation(stepEnemySpikeCooldown(next, dt), dt);
      });
```

**(b) Spike draw call** — add the import alongside the existing
`Renderer.ts` imports:

```typescript
import { drawEnemySpikes } from './engine/Renderer';
```

Then, in the render function, immediately after the existing `drawEnemies`
call (spikes must draw after, so they layer on top of the enemy sprite, not
underneath it):

```typescript
      drawEnemies(ctx, enemyStates.value, slimeGreenSpriteRef.current, slimePurpleSpriteRef.current, originX, originY);
      drawEnemySpikes(ctx, enemyStates.value, originX, originY);
```

(The exact existing `drawEnemies` call's argument list may differ slightly
from the snippet above — match whatever is actually there; only add the new
`drawEnemySpikes` line immediately after it, using the same `originX`/
`originY` already in scope at that call site.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): wire spike cooldown tick and spike overlay into the game loop"
```

---

### Task 6: Manual browser verification

Not a code change — run through this live, same convention as every other
roadmap step's manual Verify.

1. Run the full suite once first (`npm test`) as a checkpoint before manual
   testing.
2. Start the dev server, open the Platformer theme (unlock
   `platformerPrototypeUnlocked` via `localStorage` if needed).
3. Find a purple slime (3 hit points) and stomp it once — confirm it takes
   the hit (hitPoints 3→2) and, once its brief stun animation ends, visibly
   grows spikes on top.
4. Immediately land on it again from above while the spikes are visible —
   confirm the player takes damage (a heart/half-heart lost, brief
   invincibility flicker, knockback) and the slime's hit count does NOT
   decrement.
5. Wait out the cooldown (~1.5s) without touching the slime — confirm the
   spikes disappear.
6. Stomp it again from the top now that the spikes are gone — confirm it
   registers as a real stomp (hitPoints 2→1) and grows spikes again.
7. Repeat once more to actually defeat it (hitPoints 1→0) — confirm the
   existing key-drop behavior (roadmap step 30) still fires normally on the
   finishing blow, unaffected by this change.
8. Confirm a green slime (1 hit point, always dies in one stomp) never
   visibly grows spikes — it's always defeated before `spiked` would ever
   matter.

- [ ] Confirm all 8 checks pass. Then, once this idea is formally scheduled:
  assign it the next free roadmap step number in `roadmap.md`, move its
  entry from "Unscheduled additions" into the sequential list with a
  `- [x]` checkbox and a Verify note (same shape as step 30's entry), and
  remove/fold `docs/ideas/platformer-purple-slime-spikes.md`'s content into
  that roadmap entry per the repo's existing precedent for graduated ideas.
