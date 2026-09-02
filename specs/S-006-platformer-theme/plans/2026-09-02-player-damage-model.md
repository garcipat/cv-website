# Player Damage Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the player damageable the same way an enemy is — hit points on its own state, one post-hit refractory window, and damage behavior on its type — so hearts become presentation over a shared capability rather than a parallel mechanism.

**Architecture:** The player's health moves from the standalone `healthState` signal onto `PlayerState` as `hitPoints` (6, displayed as 3 hearts) and `alive`. The player's `invincibleTimer` and the enemy's `hitTimer` unify into one `Damageable.hitTimer` counting up, with the duration moving to the type as `hitReactionSeconds`. A `DamageableType` interface carries `maxHitPoints`, `hitReactionSeconds` and optional `onDamaged`/`onDeath` hooks.

**Tech Stack:** TypeScript 5 (strict), React 19, `@preact/signals-react`, Vitest + React Testing Library + jsdom.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-02-entity-actor-hierarchy-proposal.md`
**Sequence:** `specs/S-006-platformer-theme/plans/2026-09-02-capability-rollout.md` — this plan is steps 5-7.

**Prerequisite:** `2026-09-02-capability-interfaces.md` complete. `Moving`, `SelfAnimated` and `Damageable` exist in `entities/capabilities.ts`; `PlayerState` composes `Moving` and `SelfAnimated` and its facing field is named `direction`.

## Scope

**This plan is behavioral.** Unlike its predecessor, every task can break the game. Each carries a browser check with specific things to look at, and those checks are not optional.

**Out of scope:** `WorldType`, the chest and sign boxes, and the trigger unification — all Plan C.

## Global Constraints

- TypeScript strict mode. No `any`, no `@ts-ignore`, no `@ts-expect-error`, no casts.
- Test-first for every task (constitution Principle II, NON-NEGOTIABLE).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies. Named exports only.
- Doc comments describe the current state. No history trails, no plan or task references.
- Test command: `npm test`. Typecheck: `npx tsc -b --noEmit` — must produce NO output.
- **Lint: `npx eslint src/themes/platformer` must report exactly ONE error** — the pre-existing `components/ControlsOverlay.tsx:125`. eslint is slow; allow a generous timeout.
- **Never edit `engine/EnemyContact.contract.test.ts`'s `CONTACT_CASES` or any `expected` block.** They pin collision behavior and have survived four refactors unchanged. Construction helpers may change; expectations may not.
- **Browser checks use a FRESH TAB.** A reload does not recover a tab whose Vite HMR runtime threw during editing.

## Current state

| Thing | Where | Value |
|---|---|---|
| Player health | `PlatformerState.ts:108` — `healthState = signal(MAX_HALF_HEARTS)` | 6 half-hearts |
| `MAX_HALF_HEARTS` | `entities/Health.ts` | `MAX_HEARTS * 2` = 6 |
| `takeDamage(current, amount)` | `entities/Health.ts` | pure, clamps to `[0, MAX_HALF_HEARTS]` |
| Player invincibility | `PlayerState.invincibleTimer`, counts **down** via `tickInvincibility` | `INVINCIBILITY_DURATION_SECONDS` = 1.2 |
| Enemy reaction | `BaseEnemyState.hitTimer`, counts **up** via `stepEnemyHitReaction` | `HIT_REACTION_DURATION_SECONDS` = 0.4 |
| Enemy "is stunned" | `entities/enemies/stunnedGuard.ts` — `animState === 'hit'` | — |

Every production read of `healthState`, all in `PlatformerPage.tsx` unless noted:

| Line | Use |
|---|---|
| `PlatformerState.ts:108` | declaration |
| `PlatformerState.ts:405` | `resetGame()` restores `MAX_HALF_HEARTS` |
| `:105` | import |
| `:299` | debug kill — sets `0` |
| `:502` | `drawHearts(ctx, healthState.value, …)` |
| `:1102` | enemy contact damage |
| `:1267` | pit-fall damage |
| `:1305` | death trigger — `if (healthState.value === 0)` |

`heartRemaining`, `heartFrameIndex` and `drawHearts` all take a plain number and need **no change**.

## Model guidance

**Opus for Tasks 2 and 3.** Task 2 changes the damage path for both the player and every enemy in one move — the only place in this refactor where one change touches two families' behavior. Task 3 moves the purple slime's spike growth between hooks, which the contract test pins only indirectly.

**Sonnet 5 for Task 1**, which is a mechanical relocation of one number across eight call sites, fully caught by `tsc`.

**Opus reviewers for all three.** Every task is behavioral. Each reviewer must run `npx eslint src/themes/platformer` against the one-error baseline alongside tests and `tsc`.

---

### Task 1: Player health moves onto `PlayerState`

**Model:** Sonnet 5 to implement; Opus to review.

**Files:**
- Modify: `src/themes/platformer/entities/Player.ts`, `src/themes/platformer/PlatformerState.ts`, `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/entities/Player.test.ts`, `src/themes/platformer/PlatformerState.test.ts`, `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Produces: `PlayerState extends Moving, SelfAnimated, Damageable`, carrying `hitPoints`, `alive` and `hitTimer`. `healthState` is deleted.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/entities/Player.test.ts`:

```typescript
describe('player as a damageable', () => {
  it('spawnedPlayer-startsAtFullHitPointsAndAlive', () => {
    const player: Damageable = spawnPlayerState();
    expect(player.hitPoints).toBe(MAX_HALF_HEARTS);
    expect(player.alive).toBe(true);
  });

  it('hitPoints-areCountedInHalfHeartsSoThreeHeartsIsSix', () => {
    // The heart display is presentation over a plain hit-point count: three
    // hearts of two halves each.
    expect(MAX_HALF_HEARTS).toBe(6);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts`
Expected: FAIL — `hitPoints` does not exist on `PlayerState`.

- [ ] **Step 3: Add the fields and delete the signal**

In `entities/Player.ts`, compose `Damageable` onto `PlayerState` and seed the fields in `spawnPlayerState` (which lives in `PlatformerState.ts`): `hitPoints: MAX_HALF_HEARTS`, `alive: true`, `hitTimer` seeded so the player starts **not** invulnerable — see Task 2 for the convention; until then set it to whatever leaves `invincibleTimer` behavior unchanged.

Delete `healthState` from `PlatformerState.ts` and update all eight sites:

- `resetGame()` — `hitPoints` and `alive` are restored as part of `spawnPlayerState()`, so the separate health line goes away entirely.
- `:299` debug kill — set `hitPoints: 0` on the player.
- `:502` — `drawHearts(ctx, playerState.value.hitPoints, …)`. `drawHearts` itself is unchanged.
- `:1102`, `:1267` — `takeDamage` still operates on a number; write the result back onto the player.
- `:1305` — the death trigger reads `playerState.value.hitPoints === 0`. **Do not switch it to `alive` in this task**; `alive` is introduced but its wiring belongs with Task 2's window work, and changing two triggers at once makes a regression hard to attribute.

**Keep `takeDamage`, `heartRemaining`, `heartFrameIndex` and `drawHearts` exactly as they are.** They take plain numbers; the whole point is that the heart display is unchanged presentation.

Update `PlatformerPage.test.tsx`'s existing tests that set `healthState.value = 0` to trigger death — they should set the player's `hitPoints` instead. That is a mechanical change to how the same state is reached, not a change to what is asserted.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`
Expected: all pass; every pre-existing assertion unchanged apart from how health is set.

Run: `grep -rn "healthState" src/`
Expected: no output.

- [ ] **Step 5: Verify in the browser**

FRESH TAB. Take a pit fall and an enemy side-hit: the hearts must decrease by half a heart each time and render identically to before. Reduce health to zero — the death iris and respawn must still play, and the player must respawn at full hearts.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): store player health as hit points on the player"
```

---

### Task 2: One refractory window

**Model:** Opus — this is the only change touching both the player's and every enemy's damage path at once.

**Files:**
- Modify: `src/themes/platformer/entities/capabilities.ts` (doc only), `src/themes/platformer/entities/Player.ts`, `src/themes/platformer/entities/enemies/EnemyType.ts` and the two enemy modules, `src/themes/platformer/engine/EnemyAI.ts`, `src/themes/platformer/PlatformerPage.tsx`
- Delete: `src/themes/platformer/entities/enemies/stunnedGuard.ts`
- Test: `src/themes/platformer/entities/Player.test.ts`, `src/themes/platformer/engine/EnemyAI.test.ts`, `src/themes/platformer/entities/enemies/SlimePurple.test.ts`

**Interfaces:**
- Produces: `isInvulnerable(state: Damageable, reactionSeconds: number): boolean`. `hitReactionSeconds` on the enemy types and on the player's constants. `tickInvincibility` and `isStunned` are removed.

**The equivalence this rests on:** `animState === 'hit'` is true **exactly while** `hitTimer < HIT_REACTION_DURATION_SECONDS`. `isStunned` and a timer comparison are the same predicate; verify that reading `stepEnemyHitReaction` before you start.

- [ ] **Step 1: Write the failing test**

Create the shared predicate's tests alongside `capabilities.ts`:

```typescript
describe('isInvulnerable', () => {
  it('justHit-isInvulnerable', () => {
    expect(isInvulnerable({ hitPoints: 3, alive: true, hitTimer: 0 }, 1.2)).toBe(true);
  });

  it('partwayThroughTheWindow-isStillInvulnerable', () => {
    expect(isInvulnerable({ hitPoints: 3, alive: true, hitTimer: 1.1 }, 1.2)).toBe(true);
  });

  it('exactlyAtTheDuration-isVulnerableAgain', () => {
    // The window is `hitTimer < reactionSeconds`, so the boundary value is
    // already outside it.
    expect(isInvulnerable({ hitPoints: 3, alive: true, hitTimer: 1.2 }, 1.2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/capabilities.test.ts`
Expected: FAIL — `isInvulnerable` is not exported.

- [ ] **Step 3: Add the predicate and flip the player's timer**

Add `isInvulnerable` to `capabilities.ts`. Then change the player's `invincibleTimer` (counts down from 1.2) into `Damageable.hitTimer` (counts **up** from 0):

- `tickInvincibility` becomes an increment, or is deleted in favour of advancing `hitTimer` alongside the other per-tick timers. Whichever reads better — but the timer must **stop growing** rather than growing unbounded, or a long session accumulates a meaningless large number. Clamping at the reaction duration is sufficient.
- Seed `hitTimer` in `spawnPlayerState` to a value that leaves the player **vulnerable at spawn** — i.e. at or above the reaction duration, not `0`. Getting this backwards makes the player invulnerable for 1.2 s after every respawn, which no test covers.
- `PlatformerPage.tsx:1101`'s `invincibleTimer <= 0` becomes `!isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)`. Same for `:1266`.
- The render blink at `:408`/`:411` reads `hitTimer` instead. **The blink phase must look the same** — it currently divides a counting-down timer by the blink interval; counting up inverts the phase, so it needs re-deriving, not just renaming.

Then remove the enemy's parallel mechanism: delete `stunnedGuard.ts` and replace both `isStunned(enemy)` call sites in the slime modules with `isInvulnerable(enemy, ENEMY_HIT_REACTION_SECONDS)`. Move `HIT_REACTION_DURATION_SECONDS` onto the enemy types as `hitReactionSeconds`.

**Do not change `stepEnemyHitReaction`'s transition logic.** It still reverts to `'walk'` or sets `alive: false` at the end of the window; only the "is this enemy currently untouchable" question moves to the shared predicate.

- [ ] **Step 4: Wire the player's death trigger to `alive`**

Now that both families share the window, switch `PlatformerPage.tsx:1305` from `hitPoints === 0` to `!alive`, and set `alive: false` where hit points reach zero. This is the second half of Task 1's deliberate deferral.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`
Expected: all pass. `EnemyContact.contract.test.ts` must be **untouched** and green — its cases cover a stunned enemy being harmless, which now resolves through the new predicate.

Run: `grep -rn "invincibleTimer\|isStunned\|tickInvincibility" src/`
Expected: no output.

- [ ] **Step 6: Verify in the browser**

FRESH TAB. Four things, all timing-sensitive and none covered by a structural test:

1. Take an enemy hit — the player blinks for about 1.2 s. **Compare the blink rhythm to before**; an inverted phase looks subtly wrong rather than broken.
2. During that blink, walk into the enemy again — no second hit lands.
3. After it ends, walk into it — a hit lands.
4. Stomp a green slime — it is harmless during its ~0.4 s reaction, and you can neither be hurt by it nor stomp it again in that window.
5. Die and respawn — the player is **immediately vulnerable**, not invulnerable for 1.2 s.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): unify the post-hit window across player and enemies"
```

---

### Task 3: `DamageableType` and the damage hooks

**Model:** Opus — moves the purple slime's spike growth between hooks, which the contract test pins only indirectly.

**Files:**
- Modify: `src/themes/platformer/entities/capabilities.ts`, `src/themes/platformer/entities/enemies/EnemyType.ts`, `SlimeGreen.ts`, `SlimePurple.ts`
- Test: `src/themes/platformer/entities/enemies/SlimePurple.test.ts`, `src/themes/platformer/engine/EnemyContact.contract.test.ts` (assertions only, never `CONTACT_CASES`)

**Interfaces:**
- Produces: `DamageableType<S extends Damageable>` with `maxHitPoints`, `hitReactionSeconds`, optional `onDamaged`, optional `onDeath`. `EnemyType<S>` extends it.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/entities/enemies/SlimePurple.test.ts`:

```typescript
describe('onDamaged', () => {
  it('survivingStomp-growsSpikesWithAResetTimer', () => {
    const enemy = { ...makePurpleEnemy(), hitPoints: 3 };
    const damaged = slimePurple.onDamaged!(takeHit(enemy), 1);
    expect(damaged.spiked).toBe(true);
    expect(damaged.spikeTimer).toBe(0);
  });

  it('killingStomp-doesNotGrowSpikes', () => {
    const enemy = { ...makePurpleEnemy(), hitPoints: 1 };
    const damaged = slimePurple.onDamaged!(takeHit(enemy), 1);
    expect(damaged.spiked).toBe(false);
  });
});

describe('green slime', () => {
  it('hasNoOnDamagedHook', () => {
    // Nothing happens to a green slime beyond the shared hit reaction, so it
    // implements no hook at all.
    expect(slimeGreen.onDamaged).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/enemies/SlimePurple.test.ts`
Expected: FAIL — `onDamaged` does not exist.

- [ ] **Step 3: Add `DamageableType` and move the spike growth**

Add to `capabilities.ts`:

```typescript
export interface DamageableType<S extends Damageable> {
  maxHitPoints: number;
  /** Length of the post-hit refractory window. */
  hitReactionSeconds: number;
  /** What taking a hit does to this type beyond decrementing hit points. */
  onDamaged?(state: S, amount: number): S;
  /** Fired once when `alive` flips false. */
  onDeath?(state: S, world: WorldApi): void;
}
```

`EnemyType<S>` extends it; `maxHitPoints` and `hitReactionSeconds` move from `EnemyType`'s own body if already declared there.

Move the spike growth out of `SlimePurple.onPlayerCollide` into `onDamaged`. Today that branch reads roughly:

```ts
const hit = takeHit(enemy);
return { self: { ...hit, spiked: hit.hitPoints > 0, spikeTimer: 0 }, bouncePlayer: true };
```

It becomes `onPlayerCollide` returning `{ self: takeHit(enemy), bouncePlayer: true }` with the spike logic in `onDamaged`, and the caller applying `onDamaged` after a hit lands. **Both branches must be preserved** — `spiked: hit.hitPoints > 0` means a killing stomp leaves spikes off, which is the case that would let a corpse grow spikes if dropped.

`SlimeGreen` implements no `onDamaged`; nothing happens to it beyond the shared reaction.

Wire the caller in `PlatformerPage.tsx` to invoke `onDamaged` where damage is applied. **`EnemyContact.contract.test.ts`'s `expected` blocks must stay byte-identical** — if a case starts failing, behavior moved rather than relocating, and the implementation is wrong.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`
Expected: all pass, contract test unmodified.

Run: `grep -rln "spike\|Spike" src/themes/platformer/ | grep -v test`
Expected: exactly one file — `entities/enemies/SlimePurple.ts`. The containment property established earlier must survive.

- [ ] **Step 5: Verify in the browser**

FRESH TAB. Stomp the purple slime once — spikes grow and retract on the same timing as before, and its top is un-stompable while they are out. Stomp it to death — **no spikes on the corpse**. Stomp a green slime — unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): give damageable types their own damage hooks"
```

---

## Done criteria

- `grep -rn "healthState\|invincibleTimer\|isStunned\|tickInvincibility" src/` returns nothing.
- `PlayerState` composes `Moving`, `SelfAnimated` and `Damageable`; `hitPoints` is 6 at spawn and renders as three hearts through the unchanged `drawHearts`.
- One `isInvulnerable` predicate serves both the player's blink-window and the enemy's stun.
- `hitReactionSeconds` lives on the types; no hardcoded duration remains at a call site.
- `EnemyContact.contract.test.ts`'s `CONTACT_CASES` and `expected` blocks are byte-identical.
- `grep -rln "spike" src/themes/platformer/ | grep -v test` still returns only `SlimePurple.ts`.
- Standing gates green; all browser checks pass.

## Next

**Plan C — `WorldType` and trigger unification** (`2026-09-02-worldtype-and-triggers.md`).
