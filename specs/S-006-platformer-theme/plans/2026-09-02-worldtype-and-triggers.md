# WorldType and Trigger Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every type module one shared base carrying the two genuinely universal capabilities — *has a box* and *can be drawn* — and collapse the three near-identical player-overlap functions into one, leaving no hitbox constructed inside the engine.

**Architecture:** `WorldType<S>` requires `key` and `draw(state, dc)`, with behavior hooks optional so a new type never forces the interface to change. A separate `Boxed<S>` carries `box(state)`. `EnemyType`, `PickupType` and `ChestType` compose both; `BlockType` composes `WorldType` alone, because physics locates blocks by grid cell and never computes a block rectangle. `chestPlayerIsStandingOn`, `checkSignOverlap` and `overlappingPickups` then become one trigger helper.

**Tech Stack:** TypeScript 5 (strict), React 19, `@preact/signals-react`, Vitest + React Testing Library + jsdom.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-02-entity-actor-hierarchy-proposal.md`
**Sequence:** `specs/S-006-platformer-theme/plans/2026-09-02-capability-rollout.md` — this plan is steps 8-11.

**Prerequisite:** `2026-09-02-capability-interfaces.md` and `2026-09-02-player-damage-model.md` complete.

## Scope

**In scope:** the type-layer base, the chest, sign and enemy boxes, and the overlap unification.

**Out of scope:** pickup *lifecycle*. The four pickup families record "collected" three different ways — an external `collectedCollectibleIds` Set, a `collected` flag, and removal from the array. Unifying that would move coins off the model the Reset Game respawn path reads. This plan unifies the overlap **mechanism**; each caller keeps its own eligibility predicate.

## Global Constraints

- TypeScript strict mode. No `any`, no `@ts-ignore`, no `@ts-expect-error`, no new casts in production code.
- Test-first for every task (constitution Principle II, NON-NEGOTIABLE).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies. Named exports only.
- Doc comments describe the current state. No history trails, no plan or task references.
- Test command: `npm test`. Typecheck: `npx tsc -b --noEmit` — must produce NO output.
- **Lint: `npx eslint src/themes/platformer` must report exactly ONE error** — the pre-existing `components/ControlsOverlay.tsx:125`. eslint is slow; allow a generous timeout.
- **Never edit `engine/EnemyContact.contract.test.ts`'s `CONTACT_CASES` or any `expected` block.**
- **Browser checks use a FRESH TAB.**

## Current state

Boxes and where they are built today:

| Family | Box built in | Shape |
|---|---|---|
| pickups | `PickupType.box(state)` — already in the module | per-type |
| enemies | `Collision.ts` — `enemyHitbox(enemy)` | render slot inset by scaled padding |
| chests | `Collision.ts:257`, inline inside `chestPlayerIsStandingOn` | closed footprint, shifted by `CHEST_CLOSED_OFFSET_X` |
| signs | `Collision.ts:282`, inline inside `checkSignOverlap` | one `RENDERED_TILE_SIZE` square |
| player | `Collision.ts` — `playerHitbox(player)` | stays; the player is the subject, not a target |

The three overlap functions:

```ts
overlappingPickups(player, items, boxOf, eligible): T[]        // all matches
chestPlayerIsStandingOn(player, chests): string | undefined    // first match's id, skips open
checkSignOverlap(player, signs): HintId | undefined            // first match's hintId, no eligibility
```

Type modules today:

| Module | Has `box` | Has `draw` |
|---|---|---|
| `PickupType` | ✅ | ✅ |
| `EnemyType` | ❌ | ✅ |
| `BlockType` | ❌ | ✅ |
| `ChestType` | ❌ | ✅ |

## Model guidance

**Opus for Tasks 1 and 4.** Task 1 introduces a base every module must satisfy, and moving `enemyHitbox` into a module risks a load-order cycle of the kind that has bitten this codebase twice. Task 4 collapses three functions with three different return shapes and three different eligibility sources.

**Sonnet 5 for Tasks 2 and 3**, each a single box relocation with a browser check.

**Opus reviewers throughout.** Every reviewer runs `npx eslint src/themes/platformer` against the one-error baseline.

---

### Task 1: `WorldType`, and geometry moves into the modules

**Model:** Opus.

**Files:**
- Create: `src/themes/platformer/entities/WorldType.ts`
- Modify: `src/themes/platformer/entities/enemies/EnemyType.ts`, `pickups/PickupType.ts`, `blocks/BlockType.ts`, `chests/ChestType.ts`, and the type modules implementing them
- Modify: `src/themes/platformer/engine/Collision.ts`
- Test: the four `*.test.ts` beside those modules

**Interfaces:**
- Produces: `WorldType<S>` and `Boxed<S>` from `entities/WorldType.ts`. `EnemyType`, `PickupType` and `ChestType` compose both; `BlockType` composes `WorldType` alone. `enemyHitbox` moves out of `Collision.ts`.

**Watch for a load-order cycle.** `entities/Enemy.ts` and `entities/Block.ts` import their registries at runtime, so the edge runs `Enemy.ts → enemies/*` and `Block.ts → blocks/*`, never back. A production import of a runtime *value* from a module back into its registry's parent leaves the registry `undefined` at load — it compiles cleanly and shows as a blank page. `enemyHitbox` currently reads `enemyRenderedSize` / `enemyTileOffsetX` / `enemyTileOffsetY` / `enemyHitboxSidePadding` / `enemyHitboxTopPadding` from `Enemy.ts`; moving it into the enemy modules means deriving those from the module's own `sprite` and `hitboxPaddingNative` instead, exactly as `drawSpriteSheetEntity` already does. Verify with `grep -rn "from '\.\./Enemy'" src/themes/platformer/entities/enemies/` — every production hit must be `import type`.

- [ ] **Step 1: Write the failing test**

```typescript
// entities/WorldType.test.ts
import { ENEMY_TYPES } from './enemies';
import { PICKUP_TYPES } from './pickups';
import { BLOCK_TYPES } from './blocks';
import { CHEST_TYPE } from './chests';

describe('WorldType conformance', () => {
  it('everyTypeModule-exposesABoxAndADraw', () => {
    const all = [
      ...Object.values(ENEMY_TYPES),
      ...Object.values(PICKUP_TYPES),
      ...Object.values(BLOCK_TYPES),
      CHEST_TYPE,
    ];
    for (const type of all) {
      expect(typeof type.box).toBe('function');
      expect(typeof type.draw).toBe('function');
    }
  });
});
```

Add a per-family assertion that each new `box()` reproduces the rect the engine builds today — for enemies against `enemyHitbox`, for chests against the literal from `chestPlayerIsStandingOn`. Those equivalences are the safety of this task; write them before moving any geometry.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/WorldType.test.ts`
Expected: FAIL — `box` is not a function on the enemy, block and chest types.

- [ ] **Step 3: Write the base and give every module a `box`**

```typescript
// entities/WorldType.ts
import type { Rect } from './geometry';
import type { DrawContext } from '../engine/DrawContext';

/**
 * What every drawable world object's type provides. Required members are the
 * two genuinely universal ones; behavior is optional so a new kind of thing
 * never forces this interface to change.
 */
export interface WorldType<S> {
  key: string;
  draw(state: S, dc: DrawContext): void;
}

/**
 * Has a rectangle in world space. Composed by types that actually have one:
 * enemies (a collision box), pickups and chests (trigger boxes). Blocks do NOT
 * compose this — physics locates them by grid cell and never computes a block
 * rectangle, so the member would have no consumer.
 */
export interface Boxed<S> {
  box(state: S): Rect;
}
```

Then:

- **Enemies** — move `enemyHitbox`'s body into an `EnemyType.box`, deriving size and padding from the module's own `sprite` and `hitboxPaddingNative`. `Collision.ts` calls `typeOf(enemy).box(enemy)`.
- **Blocks** — compose `WorldType` only. Do NOT add a `box()`: physics finds blocks via `isBlockOccupied(placements, col, row)` and `blockIdAt(placements, col, headRow)`, so a block rectangle would have no consumer.
- **Chests** — the closed footprint, `x` shifted by `CHEST_CLOSED_OFFSET_X`, at `CHEST_CLOSED_RENDERED_WIDTH` × `CHEST_CLOSED_RENDERED_HEIGHT`. **Byte-identical to the literal in `chestPlayerIsStandingOn`**; do not recompute the centering.
- **Pickups** — already have `box`; just extend the base.

Wiring `chestPlayerIsStandingOn` to the new box is Task 2, not this one.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`, plus the cycle grep above.

- [ ] **Step 5: Verify in the browser**

FRESH TAB. The enemy box moved, so collision must be unchanged: stomp a green slime, walk into one, and jump onto a spiked purple slime. If the game loads at all, the cycle risk is clear; if it is blank, that is the cycle.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): give every type module a box and a shared base"
```

---

### Task 2: The chest reads its own box

**Model:** Sonnet 5.

**Files:** Modify `src/themes/platformer/engine/Collision.ts`; test `engine/Collision.test.ts`.

- [ ] **Step 1: Write the failing test**

Assert that `chestPlayerIsStandingOn` returns the same chest id for a player positioned exactly as an existing test positions one, and add a case pinning the horizontal offset — a player overlapping only the region the offset shifts the box into must still register. That case is what catches a dropped `CHEST_CLOSED_OFFSET_X`.

- [ ] **Step 2: Run it to verify it fails or passes**

If it passes immediately, it is a characterization test of current behavior — say so, and keep it. It becomes the net for Step 3.

- [ ] **Step 3: Delegate the geometry**

Replace the inline box in `chestPlayerIsStandingOn` with `CHEST_TYPE.box(chest)`. Keep the `isChestOpen` skip and the first-match return exactly as they are — only the rect's source changes.

- [ ] **Step 4: Run the tests, then verify in the browser**

Standing gates. FRESH TAB: standing on a closed chest with a key still opens it; without one, the locked hint still appears; an open chest no longer offers anything.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): read the chest hitbox from its type module"
```

---

### Task 3: The sign reads its own box

**Model:** Sonnet 5.

**Files:** Create `src/themes/platformer/entities/signs/` (see below); modify `engine/Collision.ts`; test `engine/Collision.test.ts`.

**Open decision, settle before writing:** a sign has no state and no per-type variation beyond its `hintId` payload, so a full type module may be more structure than it earns. Either give it one for symmetry with the other triggers, or export a bare `signBox(sign)` beside `SignPlacement`. **Pick the smaller option that satisfies Task 4's helper**, and record which you chose and why in your report.

- [ ] **Step 1: Write the failing test**

A player overlapping a sign's tile returns that sign's `hintId`; a player one tile away returns `undefined`. Use the existing helpers in `Collision.test.ts`.

- [ ] **Step 2: Run it**

Likely passes as a characterization test — keep it as the net.

- [ ] **Step 3: Delegate the geometry**

Replace the inline `{ x, y, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE }` with the module's or helper's box. Keep the first-match-returns-`hintId` shape.

- [ ] **Step 4: Run the tests, then verify in the browser**

Standing gates. FRESH TAB: walking past each sign shows its hint at the same position, and the hint disappears on leaving.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): read the sign hitbox from its own module"
```

---

### Task 4: One trigger helper

**Model:** Opus — three functions with three return shapes and three eligibility sources.

**Files:** Modify `src/themes/platformer/engine/Collision.ts`, `PlatformerPage.tsx`; test `engine/Collision.test.ts`.

**Interfaces:**
- Produces: one exported trigger-overlap helper. `overlappingPickups`, `chestPlayerIsStandingOn` and `checkSignOverlap` either become thin wrappers over it or disappear into their call sites — **decide based on how the call sites read**, and say which in your report.

- [ ] **Step 1: Write the failing test**

Cover, at minimum: multiple overlapping items returned in array order; an ineligible-but-overlapping item skipped; a non-overlapping-but-eligible item skipped; items returned **by reference** (`toBe`, not `toEqual`) so the per-tick allocation stays cheap.

- [ ] **Step 2: Run it to verify it fails**

- [ ] **Step 3: Collapse them**

The shared shape is: a box per item, an eligibility predicate, and the player's hitbox. The three differ only in what the caller wants back — all matches, the first match's id, or the first match's payload. Keep eligibility caller-supplied; the three families genuinely record "collected" differently and unifying that is out of scope.

**Preserve each caller's exact semantics.** Chest: skips open chests, returns the first. Sign: no eligibility at all, returns the first. Pickups: three different eligibility rules, returns all. A helper that returns all matches plus callers taking `[0]` is fine — a helper that changes *which* match is first is not.

- [ ] **Step 4: Run the tests**

Standing gates. Every pre-existing collision test must pass unmodified.

Run: `grep -n "const box: Box\|Box = {" src/themes/platformer/engine/Collision.ts`
Expected: only `playerHitbox`'s own construction remains.

- [ ] **Step 5: Verify in the browser**

FRESH TAB, all four trigger families in one pass: collect a coin, a fruit, a dropped key and a bonus fruit; open a chest with a key; walk past a sign. Then Reset Game and confirm collectibles reappear — that path reads `collectedCollectibleIds`, whose eligibility rule this task must not have altered.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): resolve every player trigger through one helper"
```

---

## Done criteria

- All four type modules compose `WorldType`; enemies, pickups and chests additionally compose `Boxed`. Blocks expose no `box`.
- `grep -n "const box: Box\|Box = {" src/themes/platformer/engine/Collision.ts` shows only `playerHitbox`.
- One helper resolves every player-versus-trigger overlap; eligibility remains caller-supplied.
- `EnemyContact.contract.test.ts`'s `CONTACT_CASES` and `expected` blocks are byte-identical.
- No production module under `entities/enemies/` or `entities/blocks/` imports a runtime value from its registry's parent.
- Standing gates green; all browser checks pass.

## Next

The rollout is complete. Remaining known work is recorded in
`2026-09-02-entity-architecture-followups.md` — the pickup lifecycle divergence, the
three-way registry-key naming, and the placement pipeline, which is what actually makes
adding new content expensive.
