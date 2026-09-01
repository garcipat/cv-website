# Self-Contained Pickup Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every pickup — coin, fruit, dropped key, bonus fruit — one self-contained module owning its sprite, its geometry and its rendering, so adding an item is one new file plus one registry line plus one sprite asset.

**Architecture:** Each pickup type becomes a module exporting a `PickupType` object: a sprite descriptor, a `box(state)` returning its world-space collision-and-draw rect, a `frameIndex(state, elapsed)`, a draw-only `bobOffset`, and a `draw(state, dc)`. The three near-identical overlap loops in `Collision.ts` collapse onto one generic `overlappingPickups` helper, with each caller supplying its own eligibility predicate. `Renderer.ts`'s three pickup draw functions become iterate-and-delegate.

**Tech Stack:** TypeScript 5 (strict), React 19, `@preact/signals-react`, Vitest + React Testing Library + jsdom.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-01-entity-architecture-design.md`

**Prerequisite:** `2026-09-01-entity-lifecycle.md` and `2026-09-01-enemy-modules.md` are complete. This plan builds on the shapes they produced: `SpriteSheet`, `SpriteDescriptor`, `frameSource`, `SpriteLookup`, `collectSheetSources` (`entities/sprites/SpriteSheet.ts`), the sheet constants in `entities/sprites/sheets.ts`, and `DrawContext` (`engine/DrawContext.ts`).

## Scope

**In scope:** sprites, geometry, collision-overlap mechanism, and rendering for the four pickup types.

**Deliberately OUT of scope: pickup lifecycle.** The four types record "collected" three different ways and this plan changes none of them:

| Pickup | Lives in | "Collected" recorded by |
|---|---|---|
| Coin, Fruit | `collectiblePlacements` (static) | external `collectedCollectibleIds` Set |
| Dropped key | `keyPickupStates` (append-only) | `collected` flag on the item |
| Bonus fruit | `bonusFruitStates` (append-only) | removal from the array |

Unifying those would move coins off the placements-plus-Set model that the Reset Game respawn path reads, which is real behavioral risk in code the enemy refactor never touched. It stays a separate, later decision. This plan unifies the mechanism, not the policy — each caller keeps supplying its own eligibility predicate.

Blocks, chests and the player are not in this plan either; they follow as their own plans.

## Global Constraints

- TypeScript strict mode. No `any`, no `@ts-ignore`, no `@ts-expect-error`. No new casts in production code.
- Test-first for every task (constitution Principle II, NON-NEGOTIABLE).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies. Named exports only.
- Doc comments describe the current state. No history trails, no references to plans or task numbers.
- **No behavior change is intended by any task.** Every existing test must pass with the same outcome.
- Test command: `npm test`. Single file: `npx vitest run <path>`. Typecheck: `npx tsc -b --noEmit` — must produce NO output.
- Vitest globals are enabled — `describe`, `it`, `expect`, `vi` need no imports.
- Never edit `src/themes/platformer/engine/EnemyContact.contract.test.ts`'s `CONTACT_CASES` or any `expected` block.

## Reference values

Derived from `entities/Coin.ts`, `entities/Fruit.ts`, `entities/KeyPickup.ts`, `entities/BonusFruit.ts` and `level/Terrain.ts` (`RENDER_SCALE = 2`, `RENDERED_TILE_SIZE = 32`).

| Quantity | Value |
|---|---|
| `COIN_FRAME_SIZE` / `COIN_RENDERED_SIZE` | 16 / 32 |
| `COIN_FRAME_COUNT` | 12 (a 192×16 strip) |
| `FRUIT_FRAME_SIZE` / `FRUIT_RENDERED_SIZE` | 16 / 32 |
| `FRUIT_ICON_COUNT` | 12, packed into the sheet's first **3** columns |
| `KEY_FRAME_WIDTH` / `HEIGHT` | 14 / 22 |
| `KEY_RENDERED_HEIGHT` | 32 (`RENDERED_TILE_SIZE`) |
| `KEY_RENDERED_WIDTH` | `round(14 / 22 * 32)` = 20 |

Current collision boxes, which Task 1 must reproduce exactly:

- **Coin / Fruit** — `{ x: placement.x, y: placement.y, width: 32, height: 32 }`. Note `checkCollectibleCollisions` uses `COIN_RENDERED_SIZE` for BOTH coin and fruit placements; that is correct today only because both are 32. The per-type modules make each own its own size, which is equivalent now and correct if either ever changes.
- **Bonus fruit** — `{ x: fruit.x, y: bonusFruitY(fruit), width: 32, height: 32 }`. The `y` tweens during the rise, so it is state-dependent.
- **Dropped key** — `{ x: pickup.x + KEY_TILE_OFFSET_X, y: pickup.y + KEY_TILE_OFFSET_Y, width: 20, height: 32 }`.

## The sheet-column subtlety — read before Task 1

`fruit.png` is physically 64×64 (four 16px columns) but only its first **three** columns hold icons; the fourth is empty and is never addressed. `fruitFrameSource` computes `col = packed % 3`, `row = floor(packed / 3)`.

So `FRUIT_SHEET.columns` must be **3, not 4.** `columns` in this model is the addressing stride, not the image's physical width. Declaring 4 would silently shift every fruit past index 2 onto the wrong row. Task 1 pins this with an exact-equivalence test against `fruitFrameSource`, the same way the enemy walk-frame conversion was pinned.

`coin.png` is a 192×16 strip of 12 frames, so `COIN_SHEET.columns` is 12 and `frameSource(COIN_SHEET, n)` for `n < 12` yields `{ sx: n * 16, sy: 0 }`, matching `coinFrameSource`.

## Model guidance

**Sonnet 5 for every task.** This plan has no dispatcher cast, no module cycle, and no discriminated union — the three features that made the enemy plan's Tasks 3 and 5 need Opus. Each task here is a bounded relocation with an exact-equivalence test pinning it.

**Opus should review Tasks 1 and 3.** Task 1 converts two hand-written frame-coordinate functions into sheet indices, which is where a silent visual drift would hide. Task 3 relocates canvas arithmetic that `Renderer.test.ts` covers only structurally.

**On the "move this code verbatim" steps.** Tasks 3 relocates existing drawing code rather than reproducing it here. Do not let a model paraphrase those blocks — the instruction is *move*, and a diff showing rewritten arithmetic instead of relocated arithmetic should be rejected in review.

---

### Task 1: Pickup sheets, descriptors, and the type contract

**Model:** Sonnet 5 to implement; Opus to review — the fruit column-stride conversion is the risk.

**Files:**
- Modify: `src/themes/platformer/entities/sprites/sheets.ts` (add `COIN_SHEET`, `FRUIT_SHEET`)
- Create: `src/themes/platformer/entities/pickups/PickupType.ts`
- Create: `src/themes/platformer/entities/pickups/PickupType.test.ts`

**Interfaces:**
- Consumes: `SpriteSheet`, `SpriteDescriptor`, `frameSource` from `entities/sprites/SpriteSheet.ts`; `Rect` from `entities/Entity.ts`; `DrawContext` from `engine/DrawContext.ts`.
- Produces: `COIN_SHEET`, `FRUIT_SHEET` from `entities/sprites/sheets.ts`; `PickupType<S>` from `entities/pickups/PickupType.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/pickups/PickupType.test.ts`:

```typescript
import { frameSource } from '../sprites/SpriteSheet';
import { COIN_SHEET, FRUIT_SHEET } from '../sprites/sheets';
import { coinFrameSource, COIN_FRAME_COUNT } from '../Coin';
import { fruitFrameSource, FRUIT_ICON_COUNT } from '../Fruit';

describe('COIN_SHEET', () => {
  it('everyFrameIndex-matchesCoinFrameSource', () => {
    for (let i = 0; i < COIN_FRAME_COUNT; i++) {
      expect(frameSource(COIN_SHEET, i)).toEqual(coinFrameSource(i));
    }
  });
});

describe('FRUIT_SHEET', () => {
  // fruit.png is physically four 16px columns wide, but only its first THREE
  // hold icons and fruitFrameSource addresses them with a stride of 3. The
  // sheet's `columns` is that addressing stride, not the image width —
  // declaring 4 would shift every icon past index 2 onto the wrong row.
  it('columns-isTheAddressingStrideNotTheImageWidth', () => {
    expect(FRUIT_SHEET.columns).toBe(3);
  });

  it('everyPackedIndex-matchesFruitFrameSourceForItsLogicalIndex', () => {
    // fruitFrameSource takes a LOGICAL index and maps it through
    // FRUIT_ICON_ORDER to a packed position; frameSource addresses the packed
    // position directly. Comparing them proves the sheet reproduces the same
    // source rects, one packed slot at a time.
    for (let logical = 0; logical < FRUIT_ICON_COUNT; logical++) {
      const expected = fruitFrameSource(logical);
      const matches = Array.from({ length: FRUIT_ICON_COUNT }, (_, packed) =>
        frameSource(FRUIT_SHEET, packed),
      ).some((rect) => rect.sx === expected.sx && rect.sy === expected.sy);
      expect(matches).toBe(true);
    }
  });

  it('packedIndexThree-wrapsToTheSecondRow', () => {
    // The specific case a columns:4 sheet would get wrong.
    expect(frameSource(FRUIT_SHEET, 3)).toEqual({ sx: 0, sy: 16 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/pickups/PickupType.test.ts`
Expected: FAIL — `COIN_SHEET` / `FRUIT_SHEET` are not exported from `sheets.ts`.

- [ ] **Step 3: Add the two sheets**

Append to `src/themes/platformer/entities/sprites/sheets.ts`:

```typescript
/** `coin.png` is a 192x16 strip: 12 frames of one spin cycle, so its
 *  addressing stride is the whole strip. */
export const COIN_SHEET: SpriteSheet = {
  src: '/sprites/coin.png',
  frameWidth: COIN_FRAME_SIZE,
  frameHeight: COIN_FRAME_SIZE,
  columns: COIN_FRAME_COUNT,
};

/** `fruit.png` is physically 64x64, but only its first three 16px columns
 *  hold icons — the fourth is empty and never addressed. `columns` is the
 *  addressing stride, so it is 3 rather than the image's width in frames. */
export const FRUIT_SHEET: SpriteSheet = {
  src: '/sprites/fruit.png',
  frameWidth: FRUIT_FRAME_SIZE,
  frameHeight: FRUIT_FRAME_SIZE,
  columns: 3,
};
```

Import `COIN_FRAME_SIZE`/`COIN_FRAME_COUNT` from `../Coin` and `FRUIT_FRAME_SIZE` from `../Fruit` so the numbers keep a single source of truth, exactly as `KEY_SHEET` already imports `KEY_FRAME_WIDTH`/`KEY_FRAME_HEIGHT`. Verify no import cycle results: `Coin.ts` and `Fruit.ts` currently import only `../level/Terrain`.

- [ ] **Step 4: Write the type contract**

Create `src/themes/platformer/entities/pickups/PickupType.ts`:

```typescript
import type { Rect } from '../Entity';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../engine/DrawContext';

/**
 * Everything the engine needs to know about one pickup type, owned entirely
 * by that type's own module. Adding a pickup means writing one of these and
 * adding one line to `pickups/index.ts` — nothing in Collision.ts,
 * Renderer.ts or PlatformerPage.tsx needs to change, and no sprite registry
 * needs editing: the loader discovers assets from `sprite.sheet`.
 *
 * Deliberately carries no lifecycle: whether a given pickup has already been
 * collected is recorded differently per family (an external id Set for
 * placed collectibles, a flag for dropped keys, removal for bonus fruits),
 * and each call site supplies its own eligibility predicate. This interface
 * owns geometry and appearance only.
 */
export interface PickupType<S> {
  /** Must equal this module's slot in PICKUP_TYPES. */
  key: string;
  sprite: SpriteDescriptor;
  /**
   * This pickup's world-space rect, used for BOTH collision and drawing so
   * the two can never disagree. State-dependent because a bonus fruit tweens
   * upward while it rises.
   */
  box(state: S): Rect;
  /** Which frame of `sprite.sheet` to draw right now. `elapsed` is the shared
   *  world clock — coins spin in sync, so their frame comes from it rather
   *  than from per-coin animation state. */
  frameIndex(state: S, elapsed: number): number;
  /**
   * Vertical offset added to `box().y` when DRAWING only. Collision
   * deliberately ignores it, so a bobbing pickup's hitbox does not jitter a
   * few pixels every frame independently of its sprite.
   */
  bobOffset(state: S, elapsed: number): number;
  draw(state: S, dc: DrawContext): void;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/pickups/PickupType.test.ts`
Expected: PASS.

Run: `npm test` and `npx tsc -b --noEmit`
Expected: PASS, no output. Nothing consumes the new code yet, so no behavior can change.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "feat(platformer): add pickup sheet descriptors and the pickup type contract"
```

---

### Task 2: The four pickup modules and their registry

**Model:** Sonnet 5.

Data and geometry only — drawing moves in Task 3.

**Files:**
- Create: `src/themes/platformer/entities/pickups/Coin.ts`, `Fruit.ts`, `Key.ts`, `BonusFruit.ts`
- Create: `src/themes/platformer/entities/pickups/index.ts`
- Create: `src/themes/platformer/entities/pickups/index.test.ts`

**Interfaces:**
- Consumes: `PickupType` (Task 1), the sheets from Task 1.
- Produces: `PICKUP_TYPES` and the four type objects from `entities/pickups/index.ts`.

Each module wraps the EXISTING entity module rather than replacing it — `entities/Coin.ts`, `entities/Fruit.ts`, `entities/KeyPickup.ts` and `entities/BonusFruit.ts` keep their constants and state shapes and remain the source of truth for their numbers. The new modules under `entities/pickups/` supply the `PickupType` view of them.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/pickups/index.test.ts`:

```typescript
import { PICKUP_TYPES } from './index';
import { COIN_SHEET, FRUIT_SHEET, KEY_SHEET } from '../sprites/sheets';
import { spawnKeyPickup } from '../KeyPickup';
import { spawnBonusFruit, BONUS_FRUIT_RISE_DURATION_SECONDS, bonusFruitY } from '../BonusFruit';

describe('PICKUP_TYPES', () => {
  it('everyEntry-declaresItsOwnKey', () => {
    for (const [key, type] of Object.entries(PICKUP_TYPES)) {
      expect(type.key).toBe(key);
    }
  });

  it('eachEntry-pointsAtItsOwnSheet', () => {
    expect(PICKUP_TYPES.coin.sprite.sheet).toBe(COIN_SHEET);
    expect(PICKUP_TYPES.fruit.sprite.sheet).toBe(FRUIT_SHEET);
    expect(PICKUP_TYPES.key.sprite.sheet).toBe(KEY_SHEET);
    expect(PICKUP_TYPES.bonusFruit.sprite.sheet).toBe(FRUIT_SHEET);
  });
});

describe('pickup boxes match the boxes collision uses today', () => {
  it('coin-boxIsItsPlacementAtRenderedSize', () => {
    expect(PICKUP_TYPES.coin.box({ x: 100, y: 200 })).toEqual({
      x: 100,
      y: 200,
      width: 32,
      height: 32,
    });
  });

  it('key-boxIsOffsetAndNarrowerThanATile', () => {
    // KEY_RENDERED_WIDTH is round(14/22 * 32) = 20, so the key is centered
    // over its tile with a 6px inset each side; its height fills the tile.
    expect(PICKUP_TYPES.key.box(spawnKeyPickup('k', 100, 200))).toEqual({
      x: 106,
      y: 200,
      width: 20,
      height: 32,
    });
  });

  it('bonusFruit-boxFollowsTheRiseTween', () => {
    const fruit = spawnBonusFruit('b', 100, 200, undefined, 0);
    expect(PICKUP_TYPES.bonusFruit.box(fruit).y).toBe(bonusFruitY(fruit));

    const risen = { ...fruit, elapsed: BONUS_FRUIT_RISE_DURATION_SECONDS };
    expect(PICKUP_TYPES.bonusFruit.box(risen).y).toBe(risen.restY);
  });
});

describe('pickup frames match their existing frame functions', () => {
  it('coinFrameIndex-followsTheSharedWorldClock', () => {
    expect(PICKUP_TYPES.coin.frameIndex({ x: 0, y: 0 }, 0)).toBe(0);
    expect(PICKUP_TYPES.coin.frameIndex({ x: 0, y: 0 }, 0.12 * 3)).toBe(3);
  });

  it('key-hasASingleFrame', () => {
    expect(PICKUP_TYPES.key.frameIndex(spawnKeyPickup('k', 0, 0), 99)).toBe(0);
  });
});
```

Adjust the coin/fruit state shape to whatever the modules actually take — a placed collectible carries `x`/`y` plus its id and fact. Use `CollectiblePlacement` from `level/CollectibleMapper` rather than an ad-hoc literal if that types more cleanly.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/pickups/index.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write the four modules**

Each is small. The shape, using coin as the worked example:

```typescript
// entities/pickups/Coin.ts
import type { PickupType } from './PickupType';
import type { CollectiblePlacement } from '../../level/CollectibleMapper';
import { COIN_SHEET } from '../sprites/sheets';
import {
  COIN_RENDERED_SIZE,
  COIN_FRAME_COUNT,
  COIN_FRAME_DURATION,
  coinFrameIndex,
  coinBobOffset,
} from '../Coin';

export const coin: PickupType<CollectiblePlacement> = {
  key: 'coin',
  sprite: {
    sheet: COIN_SHEET,
    renderScale: 1,
    animations: {
      spin: {
        frames: Array.from({ length: COIN_FRAME_COUNT }, (_, i) => i),
        frameDuration: COIN_FRAME_DURATION,
      },
    },
  },
  box: (placement) => ({
    x: placement.x,
    y: placement.y,
    width: COIN_RENDERED_SIZE,
    height: COIN_RENDERED_SIZE,
  }),
  frameIndex: (_placement, elapsed) => coinFrameIndex(elapsed),
  bobOffset: (_placement, elapsed) => coinBobOffset(elapsed),
  draw: () => {},
};
```

`draw` is a no-op placeholder in this task and is filled in Task 3. Note that in the interface's declaration order `draw` comes last; keep the placeholder obvious rather than silently empty — a `// Filled in when rendering moves into these modules.` comment above it.

The other three follow the same shape:
- **`Fruit.ts`** — `FRUIT_SHEET`, box at `FRUIT_RENDERED_SIZE`, `frameIndex` maps a logical icon index through `FRUIT_ICON_ORDER` to its packed slot (export a helper from `entities/Fruit.ts` if `FRUIT_ICON_ORDER` is not already reachable — do NOT copy the array), `bobOffset` reuses `coinBobOffset`.
- **`Key.ts`** — `KEY_SHEET`, box offset by `KEY_TILE_OFFSET_X`/`KEY_TILE_OFFSET_Y` at `KEY_RENDERED_WIDTH`×`KEY_RENDERED_HEIGHT`, single frame 0, `bobOffset` reuses `coinBobOffset` (matching what `drawKeyPickups` does today).
- **`BonusFruit.ts`** — `FRUIT_SHEET`, box `y` from `bonusFruitY(state)`, `frameIndex` from the fruit's own `iconIndex` through the same packed mapping, `bobOffset` returns 0 (a bonus fruit does not bob — confirm against `drawBonusFruits` before writing this and match whatever it actually does).

Create the registry:

```typescript
// entities/pickups/index.ts
export const PICKUP_TYPES = { coin, fruit, key, bonusFruit };
export type PickupTypeKey = keyof typeof PICKUP_TYPES;
```

No `typeOf` dispatcher is needed here: unlike enemies, pickups live in separate homogeneous arrays, so every call site already knows statically which type it is iterating.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test` and `npx tsc -b --noEmit`
Expected: PASS, no output. Still nothing consumes these.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer
git commit -m "feat(platformer): add per-pickup type modules and registry"
```

---

### Task 3: One overlap helper; the three collision functions delegate

**Model:** Sonnet 5.

**Files:**
- Modify: `src/themes/platformer/engine/Collision.ts`
- Test: `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Produces: `overlappingPickups` from `engine/Collision.ts`. `checkCollectibleCollisions`, `checkBonusFruitCollisions` and `checkKeyPickupCollisions` keep their existing signatures and return types — only their bodies change.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/engine/Collision.test.ts`:

```typescript
describe('overlappingPickups', () => {
  it('itemsOverlappingThePlayer-areReturnedInArrayOrder', () => {
    const player = makePlayerAt(100, 100);
    const box = playerHitbox(player);
    const near = { id: 'near', x: box.x, y: box.y };
    const far = { id: 'far', x: box.x + 500, y: box.y };
    const result = overlappingPickups(
      player,
      [far, near],
      (i) => ({ x: i.x, y: i.y, width: 32, height: 32 }),
      () => true,
    );
    expect(result).toEqual([near]);
  });

  it('itemsFailingTheEligibilityPredicate-areSkippedEvenWhenOverlapping', () => {
    const player = makePlayerAt(100, 100);
    const box = playerHitbox(player);
    const item = { id: 'blocked', x: box.x, y: box.y };
    const result = overlappingPickups(
      player,
      [item],
      (i) => ({ x: i.x, y: i.y, width: 32, height: 32 }),
      () => false,
    );
    expect(result).toEqual([]);
  });
});
```

Use the file's existing player-construction helper rather than inventing `makePlayerAt` if an equivalent exists.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/Collision.test.ts`
Expected: FAIL — `overlappingPickups is not exported`.

- [ ] **Step 3: Write the helper and delegate to it**

In `engine/Collision.ts`:

```typescript
/**
 * Every item whose box overlaps the player's hitbox and that its caller
 * considers eligible right now.
 *
 * Eligibility is a caller-supplied predicate rather than a property of the
 * item, because the four pickup families record "already collected"
 * differently: placed collectibles are deduplicated against an external id
 * Set, dropped keys carry a `collected` flag, and bonus fruits are removed
 * from their array outright. The overlap mechanism is shared; the policy
 * stays with whoever owns it.
 */
export function overlappingPickups<T>(
  player: PlayerState,
  items: readonly T[],
  boxOf: (item: T) => Box,
  eligible: (item: T) => boolean,
): T[] {
  const hitbox = playerHitbox(player);
  const hits: T[] = [];
  for (const item of items) {
    if (!eligible(item)) continue;
    if (aabbOverlap(hitbox, boxOf(item))) hits.push(item);
  }
  return hits;
}
```

Then rewrite the three existing functions as thin delegations, each keeping its exact current signature, return type and doc comment intent:

```typescript
export function checkCollectibleCollisions(
  player: PlayerState,
  placements: CollectiblePlacement[],
  collectedIds: ReadonlySet<string>,
): string[] {
  return overlappingPickups(
    player,
    placements,
    (p) => PICKUP_TYPES[p.spriteType].box(p),
    (p) => !collectedIds.has(p.id),
  ).map((p) => p.id);
}
```

```typescript
export function checkBonusFruitCollisions(
  player: PlayerState,
  fruits: readonly BonusFruitState[],
): string[] {
  return overlappingPickups(
    player,
    fruits,
    (f) => PICKUP_TYPES.bonusFruit.box(f),
    (f) => f.elapsed >= BONUS_FRUIT_RISE_DURATION_SECONDS,
  ).map((f) => f.id);
}
```

```typescript
export function checkKeyPickupCollisions(
  player: PlayerState,
  pickups: readonly KeyPickupState[],
): string[] {
  return overlappingPickups(
    player,
    pickups,
    (p) => PICKUP_TYPES.key.box(p),
    (p) => !p.collected,
  ).map((p) => p.id);
}
```

**One behavioral detail to preserve exactly:** today `checkCollectibleCollisions` uses `COIN_RENDERED_SIZE` for fruit placements too. Routing through `PICKUP_TYPES[p.spriteType].box(p)` gives fruits `FRUIT_RENDERED_SIZE` instead. Both are 32, so this is a no-op today — but state it in the doc comment so the equivalence is deliberate rather than accidental, and confirm both constants are still 32 before committing.

Delete the now-unused per-function box construction and any imports that become unreferenced.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test` and `npx tsc -b --noEmit`
Expected: PASS, no output. Every pre-existing collision test must pass unmodified — this task changes no outcome.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): fold the pickup overlap loops into one helper"
```

---

### Task 4: Rendering moves into the pickup modules

**Model:** Sonnet 5 to implement; Opus to review. This RELOCATES canvas arithmetic that `Renderer.test.ts` covers only structurally.

**Files:**
- Modify: `src/themes/platformer/entities/pickups/Coin.ts`, `Fruit.ts`, `Key.ts`, `BonusFruit.ts`
- Modify: `src/themes/platformer/engine/Renderer.ts` (`drawCollectibles`, `drawKeyPickups`, `drawBonusFruits`)
- Modify: `src/themes/platformer/PlatformerPage.tsx` (sprite loading)
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `PICKUP_TYPES` (Task 2), `DrawContext`, `collectSheetSources`.
- Produces: `PickupType.draw` implemented for all four. The three draw functions take `(ctx, items, dc)` and delegate.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/engine/Renderer.test.ts`:

```typescript
describe('pickup drawing delegates to the type modules', () => {
  it('coinsAndFruits-eachDrawFromTheirOwnSheet', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    drawCollectibles(ctx, [makeCoinPlacement(), makeFruitPlacement()], new Set(), dc);
    expect(drawImageCallsFor(ctx, dc.sprites[COIN_SHEET.src])).toHaveLength(1);
    expect(drawImageCallsFor(ctx, dc.sprites[FRUIT_SHEET.src])).toHaveLength(1);
  });

  it('alreadyCollectedCollectible-drawsNothing', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    const coin = makeCoinPlacement();
    drawCollectibles(ctx, [coin], new Set([coin.id]), dc);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('collectedKeyPickup-drawsNothing', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    drawKeyPickups(ctx, [{ ...spawnKeyPickup('k', 100, 200), collected: true }], dc);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
```

Reuse the file's existing `makeMockContext`, `makeDrawContext` and `drawImageCallsFor` helpers, and match each draw function's actual current parameter list — the signatures above are indicative, not authoritative.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — arity mismatch on the draw functions.

- [ ] **Step 3: Move the drawing into the modules**

For each of the four modules, implement `draw(state, dc)` by **moving** the corresponding block out of `Renderer.ts` — `drawCollectibles`' coin branch and fruit branch, `drawKeyPickups`' body, and `drawBonusFruits`' body. Move the code; do not rewrite it. Each becomes:

- source rect via `frameSource(sprite.sheet, this.frameIndex(state, dc.worldElapsed))`
- destination from `box(state)` plus `dc.originX`/`dc.originY`, with `bobOffset(state, dc.worldElapsed)` added to `y`
- `dc.ctx.imageSmoothingEnabled = false`
- skip when `dc.sprites[sprite.sheet.src]` is null

If a module's existing block does anything beyond that — an alpha, a scale, a shadow — preserve it exactly rather than normalising it away.

- [ ] **Step 4: Reduce the three draw functions to loops**

Each becomes iterate-and-delegate, keeping its eligibility filter where it already lives:

```typescript
export function drawCollectibles(
  ctx: CanvasRenderingContext2D,
  placements: readonly CollectiblePlacement[],
  collectedIds: ReadonlySet<string>,
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const placement of placements) {
    if (collectedIds.has(placement.id)) continue;
    PICKUP_TYPES[placement.spriteType].draw(placement, dc);
  }
}
```

Afterwards `grep -n "'coin'\|'fruit'" src/themes/platformer/engine/Renderer.ts` must return nothing — the sprite-type branch is gone.

- [ ] **Step 5: Discover the pickup sheets in the loader**

In `PlatformerPage.tsx`, extend the existing registry-driven `collectSheetSources` call to include `Object.values(PICKUP_TYPES).map((t) => t.sprite)` alongside the enemy descriptors. Remove the now-redundant individual `loadImage` refs for `coin.png` and `fruit.png` **only if** every consumer of those refs is switched over — check the HUD counter drawing (`drawCollectibleCounter`) first, which may still read them. If any consumer remains, leave the ref in place and note it in the report rather than half-migrating.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test` and `npx tsc -b --noEmit`
Expected: PASS, no output.

- [ ] **Step 7: Verify in the browser**

Confirm against the pre-refactor look: coins spin and bob in sync; fruits show their correct distinct icons (this is where a wrong `FRUIT_SHEET.columns` would show as visibly wrong fruit); a dropped key bobs at its tile; a bonus fruit rises out of a question-mark block and settles. Collect one of each.

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): let each pickup type render itself"
```

---

## Done criteria

- `grep -n "'coin'\|'fruit'" src/themes/platformer/engine/Renderer.ts` returns nothing.
- `engine/Collision.ts` contains exactly one player-versus-pickup overlap loop.
- No module outside `entities/sprites/` names a pickup sprite asset path.
- `EnemyContact.contract.test.ts` is untouched.
- `npm test` and `npx tsc -b --noEmit` pass, `tsc` with no output.
- Adding a fifth pickup type would require: one new module, one line in `pickups/index.ts`, one sheet const, one sprite asset.

## Next

Blocks and chests, then the player, each as their own plan written against the shapes this one produces.
