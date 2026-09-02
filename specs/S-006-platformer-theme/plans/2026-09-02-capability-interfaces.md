# Capability Interfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Entity` interface — which bundles position, movement and animation into one shape no family fully wants — with three independent capability interfaces that each family composes.

**Architecture:** `Moving`, `SelfAnimated` and `Damageable` become separate interfaces in `entities/capabilities.ts`; the geometry types `Direction` and `Rect` move to `entities/geometry.ts`. `BaseEnemyState` composes all three, `BlockState` composes `SelfAnimated` alone (it animates without moving), and `PlayerState` composes `Moving` and `SelfAnimated`. `Entity` is deleted.

**Tech Stack:** TypeScript 5 (strict), React 19, `@preact/signals-react`, Vitest + React Testing Library + jsdom.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-02-entity-actor-hierarchy-proposal.md`

**Prerequisite:** the entity architecture plans (`2026-09-01-entity-lifecycle.md`, `2026-09-01-enemy-modules.md`, `2026-09-02-pickup-modules.md`, `2026-09-02-block-chest-modules.md`) are complete.

## Scope

**In scope:** the three capability interfaces, the file split, and composing them onto enemy, block and player state.

**Out of scope, each with its own later plan:**

- **Plan B — the player's damage model.** Moving health from the `healthState` signal onto `PlayerState`, and unifying `invincibleTimer` with `hitTimer`. `Damageable` is defined here but the player does **not** adopt it in this plan; that is behavioral work.
- **Plan C — `WorldType` and trigger unification.** The type-layer base, the chest and sign boxes, and collapsing the three overlap functions.

**This plan is entirely type-level. No runtime behavior changes at all.** Every existing test must pass unmodified, and the browser must look identical. If a task finds itself changing a value, a condition or a call order, it has gone out of scope.

## Global Constraints

- TypeScript strict mode. No `any`, no `@ts-ignore`, no `@ts-expect-error`, no casts.
- Test-first for every task (constitution Principle II, NON-NEGOTIABLE).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies. Named exports only.
- Doc comments describe the current state. No history trails, no references to plans or task numbers.
- Test command: `npm test`. Typecheck: `npx tsc -b --noEmit` — must produce NO output.
- **Lint: `npx eslint src/themes/platformer` must report exactly ONE error** — the pre-existing `components/ControlsOverlay.tsx:125` `react-hooks/set-state-in-effect`. Anything more fails the task. eslint is slow here; allow a generous timeout. The config has no `argsIgnorePattern`, so an `_` prefix does NOT silence an unused parameter; the default `args: 'after-used'` reports only trailing unused parameters.
- Never edit `src/themes/platformer/engine/EnemyContact.contract.test.ts`'s `CONTACT_CASES` or any `expected` block.

## Current state

`entities/Entity.ts` holds four exports with different lifetimes:

| Export | Used by | Fate |
|---|---|---|
| `Entity` | `enemies/EnemyType.ts`, `Entity.test.ts` | **deleted** |
| `Damageable` | `enemies/EnemyType.ts`, `Entity.test.ts` | moves to `capabilities.ts`, gains `hitTimer` |
| `Direction` | `Entity.ts` itself; re-exported by `Enemy.ts` as `EnemyDirection` | moves to `geometry.ts` |
| `Rect` | `engine/Contact.ts`, `pickups/PickupType.ts` | moves to `geometry.ts` |

`Entity` and `Damageable` have exactly two consumers each, so the removal surface is small. `Rect` and `Direction` are geometry value types rather than capabilities and must survive the split.

Fields already present, which is why most of this plan is free:

- `BaseEnemyState` already has `vx`, `vy`, `direction`, `animState`, `animFrame`, `animTimer`, `hitPoints`, `alive` **and `hitTimer`**.
- `BlockState` already has `animState` and `animTimer` — but **not** `animFrame`. See Task 2.
- `PlayerState` already has `vx`, `vy`, `facing`, `animState`, `animFrame`, `animTimer`. Note the field is named `facing`, **not** `direction`. See Task 3.

## Model guidance

**Sonnet 5 for every task.** No dispatcher cast, no module cycle, no behavioral change. Each task is a type-level move that `tsc` verifies exhaustively.

**Sonnet 5 reviewers are sufficient**, with one instruction each: run `npx eslint src/themes/platformer` and compare against the one-error baseline. Tests and `tsc` do not catch lint-only rules, and in an earlier plan six lint errors accumulated across four otherwise-clean task reviews because lint was absent from the reviewer prompts.

---

### Task 1: Split `Entity.ts`; add the three capability interfaces

**Model:** Sonnet 5.

**Files:**
- Create: `src/themes/platformer/entities/geometry.ts`
- Create: `src/themes/platformer/entities/capabilities.ts`
- Create: `src/themes/platformer/entities/capabilities.test.ts`
- Delete: `src/themes/platformer/entities/Entity.ts`
- Delete: `src/themes/platformer/entities/Entity.test.ts`
- Modify: `src/themes/platformer/entities/enemies/EnemyType.ts`, `src/themes/platformer/entities/Enemy.ts`, `src/themes/platformer/engine/Contact.ts`, `src/themes/platformer/entities/pickups/PickupType.ts`

**Interfaces:**
- Produces: `Direction`, `Rect` from `entities/geometry.ts`; `Moving`, `SelfAnimated`, `Damageable` from `entities/capabilities.ts`. `Entity` no longer exists.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/capabilities.test.ts`:

```typescript
import { toEnemyState } from './Enemy';
import type { Moving, SelfAnimated, Damageable } from './capabilities';
import type { EnemyPlacement } from '../level/EnemyMapper';

function makePlacement(): EnemyPlacement {
  return { id: 'enemy-test', type: 'slimeGreen', x: 320, y: 96 };
}

describe('capability conformance', () => {
  it('enemyState-assignedToAllThreeCapabilities-satisfiesEachShape', () => {
    // A compile-time assertion with a runtime witness: if enemy state stops
    // structurally satisfying any capability, this file fails to compile.
    const enemy: Moving & SelfAnimated & Damageable = toEnemyState(makePlacement());
    expect(enemy.vx).toBe(0);
    expect(enemy.vy).toBe(0);
    expect(enemy.direction).toBe('right');
    expect(enemy.animState).toBe('walk');
    expect(enemy.alive).toBe(true);
    expect(enemy.hitTimer).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/capabilities.test.ts`
Expected: FAIL — `Cannot find module './capabilities'`.

- [ ] **Step 3: Write the two new files**

Create `src/themes/platformer/entities/geometry.ts`, moving `Direction` and `Rect` out of `Entity.ts` **unchanged**:

```typescript
export type Direction = 'left' | 'right';

/** An axis-aligned box in world pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

Create `src/themes/platformer/entities/capabilities.ts`:

```typescript
import type { Direction } from './geometry';

/**
 * Moves under its own power. `vy` is a capability of moving things rather than
 * a field every mover uses today — enemies patrol along one row and leave it
 * at zero — but a flying or jumping enemy would need it, and the player
 * already does.
 */
export interface Moving {
  vx: number;
  vy: number;
  direction: Direction;
}

/**
 * Advances its own animation on a per-instance timer, so two instances of one
 * type can be out of phase — the stagger enemies get at spawn and keep across
 * a respawn.
 *
 * A type whose frames come from the shared world clock instead — a spinning
 * coin, a bobbing key — needs none of this; its `frameIndex` reads `elapsed`.
 * Both are animated; only this one stores state.
 */
export interface SelfAnimated {
  animState: string;
  animFrame: number;
  animTimer: number;
}

/**
 * Takes damage and is gone at zero. `hitTimer` counts seconds since the last
 * hit landed; while it is below the type's reaction duration, the entity is in
 * its post-hit refractory window and further hits do not land.
 *
 * Blocks deliberately do NOT compose this: their `hitsTaken` counts up to a
 * per-kind maximum rather than down to zero, and a spent question-mark stays
 * solid in the world, so `alive` has no meaning for it.
 */
export interface Damageable {
  hitPoints: number;
  alive: boolean;
  hitTimer: number;
}
```

Then delete `entities/Entity.ts` and `entities/Entity.test.ts`, and repoint the four importers:

- `engine/Contact.ts` — `Rect` from `../entities/geometry`
- `entities/pickups/PickupType.ts` — `Rect` from `../geometry`
- `entities/Enemy.ts` — its `export type { Direction as EnemyDirection }` re-export now sources from `./geometry`
- `entities/enemies/EnemyType.ts` — see Step 4

`Entity.test.ts` is deleted rather than kept because `capabilities.test.ts` replaces it: its single test asserted that enemy state satisfies `Entity & Damageable`, and the new test asserts the same property against the three capabilities. **Confirm that is the file's only test before deleting it**; if it holds anything else, port that instead of dropping it.

- [ ] **Step 4: Compose the capabilities onto enemy state**

In `entities/enemies/EnemyType.ts`:

```typescript
export interface BaseEnemyState extends EnemyPlacement, Moving, SelfAnimated, Damageable {
```

Every field is already present on the state, so this is a pure re-declaration — `toEnemyState` and `reviveEnemy` need no change. Remove `hitTimer` from `BaseEnemyState`'s own field list if it is declared there, since `Damageable` now supplies it; keep its doc comment by moving the useful part onto `Damageable.hitTimer` if it says more than the text above.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/capabilities.test.ts`
Expected: PASS.

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`
Expected: all existing tests pass unmodified, no `tsc` output, exactly one eslint error.

Run: `grep -rn "entities/Entity\|from './Entity'\|from '\.\./Entity'" src/`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): replace Entity with composable capability interfaces"
```

---

### Task 2: `BlockState` composes `SelfAnimated`

**Model:** Sonnet 5.

A block animates without moving — the case no single `Entity` could express. This task makes that explicit.

**Files:**
- Modify: `src/themes/platformer/entities/Block.ts`
- Test: `src/themes/platformer/entities/Block.test.ts`

**Interfaces:**
- Consumes: `SelfAnimated` (Task 1).
- Produces: `BlockState extends BlockPlacement, SelfAnimated`.

- [ ] **Step 1: Check what the state actually has before writing anything**

`BlockState` currently declares `hitsTaken`, `animState` and `animTimer` — but **not `animFrame`**, which `SelfAnimated` requires. Read `entities/Block.ts` and `engine/BlockAI.ts` and establish which of these is true:

- **(a)** A block genuinely has no frame index — its appearance comes from `BLOCK_TYPES[kind].frameIndex(hitsTaken)`, and `animState`/`animTimer` drive only the bump offset and shatter opacity.
- **(b)** A frame index exists under another name.

If **(a)** — which the code suggests — then a block satisfies only *part* of `SelfAnimated`, and forcing `animFrame: 0` onto it would be exactly the dead field this whole proposal exists to remove.

**In that case, stop and report BLOCKED with your findings rather than adding the field.** The right resolution is a design decision, not an implementation one: either `SelfAnimated` splits into a timer part and a frame part, or blocks simply do not compose it and keep their own two fields. Both are defensible; neither is yours to pick mid-task.

Only continue to Step 2 if a block genuinely has all three fields.

- [ ] **Step 2: Write the failing test**

Add to `src/themes/platformer/entities/Block.test.ts`:

```typescript
it('blockState-assignedToSelfAnimated-satisfiesTheShape', () => {
  const block: SelfAnimated = toBlockState(makeBlockPlacement());
  expect(block.animState).toBe('idle');
  expect(block.animTimer).toBe(0);
});
```

Use the file's existing placement helper rather than inventing one.

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/Block.test.ts`
Expected: FAIL — `BlockState` does not satisfy `SelfAnimated`.

- [ ] **Step 4: Compose it**

```typescript
export interface BlockState extends BlockPlacement, SelfAnimated {
  hitsTaken: number;
}
```

Narrow `animState` back to `BlockAnimState` in the interface body, since `SelfAnimated.animState` is the wider `string` and a block's states are `'idle' | 'bump' | 'shatter'`. Keep `toBlockState` unchanged apart from any field the composition now requires.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`
Expected: all existing tests pass unmodified, no `tsc` output, exactly one eslint error.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): declare block state as self-animated"
```

---

### Task 3: `PlayerState` composes `Moving` and `SelfAnimated`

**Model:** Sonnet 5.

The smallest possible step toward the player family — it touches no physics, no tests of physics, and no behavior.

**Files:**
- Modify: `src/themes/platformer/entities/Player.ts`
- Test: `src/themes/platformer/entities/Player.test.ts`

**Interfaces:**
- Consumes: `Moving`, `SelfAnimated` (Task 1).
- Produces: `PlayerState extends Moving, SelfAnimated`.

**The player does NOT compose `Damageable` in this plan.** Its health lives in the separate `healthState` signal; moving it is behavioral work belonging to Plan B.

- [ ] **Step 1: Resolve the `facing` / `direction` mismatch first**

`PlayerState` names its field **`facing`**, typed `PlayerFacing`. `Moving` requires **`direction`**, typed `Direction`. The two types are structurally identical (`'left' | 'right'`) but the names differ, so `PlayerState` does not satisfy `Moving` today.

Rename `facing` to `direction` throughout, and drop `PlayerFacing` in favour of `Direction` from `entities/geometry.ts`. Run `grep -rn "facing\|PlayerFacing" src/themes/platformer/` first and work from that list — it reaches `Physics.ts`, `Renderer.ts`'s `drawPlayer` mirroring, and their tests.

This is a **rename only**. No condition, value or call order changes. If you find yourself altering logic, stop.

- [ ] **Step 2: Write the failing test**

Add to `src/themes/platformer/entities/Player.test.ts`:

```typescript
it('playerState-assignedToMovingAndSelfAnimated-satisfiesBothShapes', () => {
  const player: Moving & SelfAnimated = spawnPlayerState();
  expect(player.vx).toBe(0);
  expect(player.vy).toBe(0);
  expect(player.direction).toBe('right');
  expect(player.animState).toBe('idle');
});
```

Import `spawnPlayerState` from `../PlatformerState` if `Player.ts` has no factory of its own.

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/Player.test.ts`
Expected: FAIL — either the module does not satisfy the shape, or `direction` does not exist yet.

- [ ] **Step 4: Compose the capabilities**

```typescript
export interface PlayerState extends Moving, SelfAnimated {
  // …existing player-only fields unchanged: grounded, climbing,
  // isDroppingThroughBridge, lastGroundedX/Y, invincibleTimer,
  // knockbackTimer, bounceAscending, hitBlockIds
}
```

Narrow `animState` to `PlayerAnimState` in the interface body, as Task 2 does for blocks. Remove `vx`, `vy`, `direction`, `animState`, `animFrame` and `animTimer` from the body — the capabilities supply them — and preserve their doc comments by moving anything player-specific onto the remaining fields.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`
Expected: all existing tests pass, no `tsc` output, exactly one eslint error.

`Physics.test.ts` is ~1250 lines and exercises the player heavily. It must pass **unmodified except for the `facing` → `direction` rename**. Any assertion whose expected *value* changed means the rename was not a rename.

- [ ] **Step 6: Verify in the browser**

Open a FRESH tab — a reload does not recover a tab whose Vite HMR runtime threw during editing. Confirm the player still faces the direction it moves, its walk/jump/climb animations still play, and the sprite still mirrors when facing left. The `facing` rename touches `drawPlayer`'s mirroring, which `Renderer.test.ts` covers structurally but not visually.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): declare player state as moving and self-animated"
```

---

## Done criteria

- `grep -rn "entities/Entity" src/` returns nothing; `Entity.ts` and `Entity.test.ts` are gone.
- `Moving`, `SelfAnimated` and `Damageable` live in `entities/capabilities.ts`; `Direction` and `Rect` in `entities/geometry.ts`.
- `BaseEnemyState` composes all three; `BlockState` composes `SelfAnimated`; `PlayerState` composes `Moving` and `SelfAnimated`.
- `PlayerState.facing` is now `direction`, typed `Direction`.
- `npm test` passes with every pre-existing assertion unmodified apart from that rename; `npx tsc -b --noEmit` produces no output; `npx eslint src/themes/platformer` reports exactly the one pre-existing error.
- No runtime behavior changed anywhere.

## Next

**Plan B — player damage model.** Health onto `PlayerState` as `hitPoints` (6, displayed as 3 hearts), `alive` replacing the `healthState === 0` death trigger, and `invincibleTimer` unified with `hitTimer` into one refractory window with the duration on the type. Behavioral; needs browser verification.

**Plan C — `WorldType` and trigger unification.** One type-layer base with optional hooks, the chest and sign boxes moved into their modules, and the three overlap functions collapsed into one.
