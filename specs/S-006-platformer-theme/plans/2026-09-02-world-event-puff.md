# World-Event Puff (Step 34, fixes B-003) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the platformer's sparkle "puff" effect its own identity, independent of the fact-flight reward animation, and fire it at every world event that currently shows nothing (a purple slime's defeat, a revived enemy's second defeat, a fragileRock's break) — fixing B-003.

**Architecture:** Split `CollectionEffects.ts`'s sparkle burst out of `FlightEffect` into a new, independent `PuffEffect` (position + a size `scale`, no text/flight fields at all). `Renderer.ts` factors the sparkle-drawing loop it already has into one shared helper, called by both the existing `drawCollectionEffects` (unchanged behavior) and a new `drawPuffEffects`. `PlatformerState.ts` gets a parallel `activePuffs` signal, ticked/filtered the same way `activeEffects` already is. Each entity family gets a small `effectAnchor` helper (`enemyEffectAnchor`, `blockEffectAnchor`) that turns an entity's own position into a world-space `{ x, y, scale }`, reusing each family's existing size math so a bigger enemy produces a visibly bigger puff. `PlatformerPage.tsx`'s enemy-defeat selection changes from a single `rewardGiven`-gated flag to two flags: `rewardGiven` (permanent, unchanged meaning: "nothing left to give") and a new `deathEffectGiven` (reset on revive, gates "already showed something for this life's death") — this is what lets a revived-and-redefeated enemy be noticed again for a puff without being noticed again for a reward.

**Tech Stack:** TypeScript (strict, no `any`), Vitest + React Testing Library + jsdom, Preact signals (`@preact/signals-react`).

**Spec:** `docs/bugs/B-003-puff-bound-to-fact-reward/ticket.md` (the bug), `specs/S-006-platformer-theme/roadmap.md` step 34 (the roadmap entry this plan implements), `.specify/memory/constitution.md` (project-wide rules below).

## Global Constraints

- TypeScript strict mode, no `any` types (Constitution I).
- TDD: write the failing test first for every behavioral change, before the implementation (Constitution II).
- Named arrow function exports; props/type interfaces defined in the file that uses them first (Constitution III) — the existing files in this plan already follow this; match their style.
- No new shadcn/ui components, no new dependencies — this is pure game-engine/state code.
- Every task ends with `npm test -- <changed test files>` passing before moving on, and a final `npm test` full-suite run in the last task.

---

## Task 1: `PuffEffect` in `CollectionEffects.ts`

**Files:**
- Modify: `src/themes/platformer/engine/CollectionEffects.ts`
- Test: `src/themes/platformer/engine/CollectionEffects.test.ts`

**Interfaces:**
- Produces: `PuffEffect { id: string; x: number; y: number; scale: number; elapsed: number }`, `startPuffEffect(id: string, x: number, y: number, scale?: number): PuffEffect`, `tickPuffEffect(effect: PuffEffect, dt: number): PuffEffect`, and a `scale` parameter added to the existing `sparkleParticles(elapsedSinceCollect: number, scale?: number): SparkleParticle[]` (default `1`, so every existing call site and test that doesn't pass it keeps working unchanged).

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/CollectionEffects.test.ts` (in the `sparkleParticles` describe block, and a new `PuffEffect` describe block — check the existing file first for where `sparkleParticles` is currently tested and add alongside it):

```ts
import { startPuffEffect, tickPuffEffect, sparkleParticles, SPARKLE_DURATION_SECONDS } from './CollectionEffects';
import type { PuffEffect } from './CollectionEffects';

describe('sparkleParticles scale', () => {
  it('scaleOf2-doublesEveryParticlesOffsetFromDefault', () => {
    const base = sparkleParticles(SPARKLE_DURATION_SECONDS / 2);
    const scaled = sparkleParticles(SPARKLE_DURATION_SECONDS / 2, 2);
    expect(scaled).toHaveLength(base.length);
    scaled.forEach((particle, i) => {
      expect(particle.dx).toBeCloseTo(base[i].dx * 2);
      expect(particle.dy).toBeCloseTo(base[i].dy * 2);
    });
  });

  it('noScaleArgument-behavesExactlyLikeScaleOf1', () => {
    const withDefault = sparkleParticles(SPARKLE_DURATION_SECONDS / 2);
    const explicit = sparkleParticles(SPARKLE_DURATION_SECONDS / 2, 1);
    expect(withDefault).toEqual(explicit);
  });
});

describe('startPuffEffect / tickPuffEffect', () => {
  it('startPuffEffect-noScaleArgument-defaultsScaleTo1', () => {
    const effect = startPuffEffect('rock-1', 100, 200);
    expect(effect).toEqual<PuffEffect>({ id: 'rock-1', x: 100, y: 200, scale: 1, elapsed: 0 });
  });

  it('startPuffEffect-withScale-storesIt', () => {
    const effect = startPuffEffect('slime-1', 50, 60, 1.5);
    expect(effect.scale).toBe(1.5);
  });

  it('tickPuffEffect-advancesElapsedByDt-preservesEverythingElse', () => {
    const effect = startPuffEffect('rock-1', 100, 200, 1.5);
    const ticked = tickPuffEffect(effect, 0.1);
    expect(ticked).toEqual<PuffEffect>({ id: 'rock-1', x: 100, y: 200, scale: 1.5, elapsed: 0.1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- CollectionEffects.test.ts`
Expected: FAIL — `startPuffEffect`/`tickPuffEffect`/`PuffEffect` don't exist yet, and `sparkleParticles` doesn't accept a second argument (TypeScript compile error surfaces as a test failure).

- [ ] **Step 3: Implement `PuffEffect` and the scaled `sparkleParticles`**

In `src/themes/platformer/engine/CollectionEffects.ts`, change `sparkleParticles`:

```ts
/**
 * A fixed ring of small dots radiating outward from a collection point and
 * fading, in place of a full particle system — see the coin-collection
 * plan's "Key design decisions". Returns offsets (dx/dy) relative to the
 * collection point, not absolute positions, so the caller (Renderer.ts)
 * just adds them to wherever the collectible was. `scale` multiplies the
 * ring's radius (default 1, unchanged from before this parameter existed) —
 * PuffEffect below uses it to make a bigger entity's puff visibly bigger.
 */
export function sparkleParticles(elapsedSinceCollect: number, scale = 1): SparkleParticle[] {
  if (elapsedSinceCollect < 0 || elapsedSinceCollect > SPARKLE_DURATION_SECONDS) return [];
  const progress = elapsedSinceCollect / SPARKLE_DURATION_SECONDS;
  const radius = SPARKLE_MAX_RADIUS * scale * progress;
  const opacity = 1 - progress;
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
    const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, opacity };
  });
}
```

Then append at the end of the file:

```ts
/**
 * A standalone sparkle burst at a world event — an enemy defeated, a block
 * broken — that carries no fact and flies nowhere (unlike FlightEffect,
 * which is always fact-bearing). Kept as its own type rather than a
 * degenerate FlightEffect (empty text, equal start/mid/target coordinates):
 * see B-003 (docs/bugs/B-003-puff-bound-to-fact-reward/ticket.md) for why
 * that hack was the wrong shape. `scale` lets a bigger entity (a purple
 * slime vs. a green slime) produce a visibly bigger burst — see
 * entities/Enemy.ts's `enemyEffectAnchor`.
 */
export interface PuffEffect {
  id: string;
  x: number;
  y: number;
  scale: number;
  elapsed: number;
}

export function startPuffEffect(id: string, x: number, y: number, scale = 1): PuffEffect {
  return { id, x, y, scale, elapsed: 0 };
}

/** Advances the puff by `dt` seconds. No phase machine (unlike
 *  tickFlightEffect) — a puff has exactly one phase, bursting, and callers
 *  filter it out once `elapsed` passes SPARKLE_DURATION_SECONDS (same bound
 *  `sparkleParticles` itself already enforces by returning `[]`). */
export function tickPuffEffect(effect: PuffEffect, dt: number): PuffEffect {
  return { ...effect, elapsed: effect.elapsed + dt };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- CollectionEffects.test.ts`
Expected: PASS, including every pre-existing test in this file (the `scale` parameter is additive-optional, so nothing else should break).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/CollectionEffects.ts src/themes/platformer/engine/CollectionEffects.test.ts
git commit -m "feat(platformer): add standalone PuffEffect, decoupled from FlightEffect"
```

---

## Task 2: `drawPuffEffects` in `Renderer.ts`

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `PuffEffect`, `sparkleParticles` (both from Task 1's `CollectionEffects.ts`).
- Produces: `drawPuffEffects(ctx: CanvasRenderingContext2D, effects: PuffEffect[]): void`. `drawCollectionEffects`'s existing exported signature and behavior are unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/Renderer.test.ts`, right after the existing `describe('drawCollectionEffects', ...)` block (import `drawPuffEffects`, `startPuffEffect`, `tickPuffEffect` at the top alongside the existing `drawCollectionEffects`/`startFlightEffect` imports):

```ts
describe('drawPuffEffects', () => {
  it('freshPuff-drawsSixSparkleCircles', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startPuffEffect('rock-1', 100, 200);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.arc).toHaveBeenCalledTimes(6);
  });

  it('freshPuff-neverCallsFillText', () => {
    // A puff has no text/icon at all — unlike drawCollectionEffects, there is
    // nothing here that could accidentally render an empty label.
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = startPuffEffect('rock-1', 100, 200);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('puffAtItsOwnXY-drawsCirclesCenteredThere-not0-0', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startPuffEffect('rock-1', 100, 200);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    const [cx, cy] = ctx.arc.mock.calls[0];
    expect(cx).toBeCloseTo(100, 0);
    expect(cy).toBeCloseTo(200, 0);
  });

  it('scaledPuff-drawsWiderCircleRadiusThanUnscaled', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const unscaled = startPuffEffect('a', 0, 0, 1);
    const scaled = startPuffEffect('b', 0, 0, 2);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [unscaled]);
    const unscaledRadius = ctx.arc.mock.calls[0][2];
    ctx.arc.mockClear();
    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [scaled]);
    const scaledRadius = ctx.arc.mock.calls[0][2];

    expect(scaledRadius).toBeGreaterThan(unscaledRadius);
  });

  it('expiredPuff-doesNotDrawSparkleCircles', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = tickPuffEffect(startPuffEffect('rock-1', 100, 200), SPARKLE_DURATION_SECONDS + 0.01);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('noPuffs-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, []);
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});
```

Also add one regression test to the existing `describe('drawCollectionEffects', ...)` block confirming the factor-out didn't change its sparkle radius:

```ts
  it('freshEffect-sparkleRadiusUnchangedByThePuffRefactor', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startFlightEffect('a', 'German', 50, 60, 400, 300, 900, 900);

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    // SPARKLE_RADIUS_PX is 3 and not exported — asserted by value, matching
    // this file's existing convention of asserting on ctx.arc's 3rd argument.
    expect(ctx.arc.mock.calls[0][2]).toBe(3);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- Renderer.test.ts`
Expected: FAIL — `drawPuffEffects` is not exported yet.

- [ ] **Step 3: Implement — factor out the shared sparkle-drawing helper, add `drawPuffEffects`**

In `src/themes/platformer/engine/Renderer.ts`, change the import at the top (line 42) to also bring in `PuffEffect`:

```ts
import { flightEffectPosition, sparkleParticles } from './CollectionEffects';
import type { FlightEffect, PuffEffect } from './CollectionEffects';
```

Replace the body of `drawCollectionEffects` (the existing `for (const sparkle of sparkleParticles(effect.elapsed)) { ... }` loop, currently lines ~726-734) and add the new function, so the whole region reads:

```ts
/** Draws one sparkle burst — a ring of small fading dots radiating outward
 *  from (x, y) — shared by drawCollectionEffects (a fact-flight's own burst,
 *  always scale 1) and drawPuffEffects (a standalone world-event puff, whose
 *  scale varies with the entity that caused it). The one place that draws a
 *  sparkle ring, so the visual can't drift between the two call sites. */
function drawSparkleBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  elapsedSinceCollect: number,
  scale = 1,
): void {
  for (const sparkle of sparkleParticles(elapsedSinceCollect, scale)) {
    ctx.save();
    ctx.globalAlpha = sparkle.opacity;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + sparkle.dx, y + sparkle.dy, SPARKLE_RADIUS_PX * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawCollectionEffects(ctx: CanvasRenderingContext2D, effects: FlightEffect[]): void {
  for (const effect of effects) {
    const { x, y, opacity } = flightEffectPosition(effect);
    if (opacity > 0) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#fff';
      ctx.font = `${COLLECTION_EFFECT_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fillTextWithOutline(ctx, effect.text, x, y);

      if (effect.icon) {
        const textHalfWidth = ctx.measureText(effect.text).width / 2;
        ctx.font = `${COLLECTION_EFFECT_ICON_FONT_SIZE}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(effect.icon, x - textHalfWidth - COLLECTION_EFFECT_ICON_GAP, y);
      }
      ctx.restore();
    }

    drawSparkleBurst(ctx, effect.startX, effect.startY, effect.elapsed);
  }
}

/** Draws every currently-animating world-event puff (see B-003 /
 *  CollectionEffects.ts's PuffEffect doc comment) — screen-space, same
 *  no-camera-offset convention as drawCollectionEffects. */
export function drawPuffEffects(ctx: CanvasRenderingContext2D, effects: PuffEffect[]): void {
  for (const effect of effects) {
    drawSparkleBurst(ctx, effect.x, effect.y, effect.elapsed, effect.scale);
  }
}
```

Keep every other line of `drawCollectionEffects` (the text/icon drawing above the sparkle loop) exactly as it was — only the trailing `for (const sparkle of ...)` loop is replaced by the `drawSparkleBurst(...)` call.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- Renderer.test.ts`
Expected: PASS, including every pre-existing `drawCollectionEffects` test (text drawing untouched; sparkle drawing now goes through `drawSparkleBurst` but produces identical `ctx.arc` calls at `scale = 1`).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): factor sparkle-burst drawing into a shared helper, add drawPuffEffects"
```

---

## Task 3: `enemyEffectAnchor` in `entities/Enemy.ts`

**Files:**
- Modify: `src/themes/platformer/entities/Enemy.ts`
- Test: `src/themes/platformer/entities/Enemy.test.ts`

**Interfaces:**
- Consumes: `enemyRenderedSize`, `enemyTileOffsetX`, `enemyTileOffsetY`, `ENEMY_RENDERED_SIZE` (all already in this file), `EnemyState`/`EnemyTypeKey` (from `./enemies`).
- Produces: `EffectAnchor { x: number; y: number; scale: number }` and `enemyEffectAnchor(enemy: EnemyState): EffectAnchor`, both exported from `entities/Enemy.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/entities/Enemy.test.ts` (this file already imports `ENEMY_RENDERED_SIZE`, `enemyRenderedSize`, `enemyTileOffsetX`, `enemyTileOffsetY`, `makePlacement()`, `RENDER_SCALE`, `RENDERED_TILE_SIZE` — reuse them):

```ts
import { enemyEffectAnchor } from './Enemy';

describe('enemyEffectAnchor', () => {
  it('slimeGreen-centersOnTheRenderedSprite-notTopLeftCorner', () => {
    const enemy = toEnemyState(makePlacement());
    const anchor = enemyEffectAnchor(enemy);
    const size = enemyRenderedSize('slimeGreen');
    expect(anchor.x).toBeCloseTo(enemy.x + enemyTileOffsetX('slimeGreen') + size / 2);
    expect(anchor.y).toBeCloseTo(enemy.y + enemyTileOffsetY('slimeGreen') + size / 2);
  });

  it('slimeGreen-scaleIs1-theBaselineSize', () => {
    const enemy = toEnemyState(makePlacement());
    expect(enemyEffectAnchor(enemy).scale).toBeCloseTo(1);
  });

  it('slimePurple-scaleIsGreaterThan1-biggerThanTheGreenBaseline', () => {
    const purplePlacement = { ...makePlacement(), type: 'slimePurple' as const };
    const enemy = toEnemyState(purplePlacement);
    const anchor = enemyEffectAnchor(enemy);
    expect(anchor.scale).toBeGreaterThan(1);
    expect(anchor.scale).toBeCloseTo(enemyRenderedSize('slimePurple') / ENEMY_RENDERED_SIZE);
  });
});
```

Check `makePlacement()`'s actual return type first (already read in this session: it returns an `EnemyPlacement` with `type: 'slimeGreen'`) — if `type` isn't already a literal-widened field allowing the `slimePurple` override above to type-check, adjust the spread's type accordingly (e.g. cast the marker) rather than editing `makePlacement()` itself.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- Enemy.test.ts`
Expected: FAIL — `enemyEffectAnchor` is not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/entities/Enemy.ts`, add after `enemyTileOffsetY` (after line 42, before the `ENEMY_RENDERED_SIZE` constant — order doesn't matter functionally, but keep it grouped with the other per-type sizing helpers):

```ts
/** A world-space anchor point + size scale for a one-shot visual effect at
 *  this enemy's position — see engine/CollectionEffects.ts's PuffEffect and
 *  B-003 (docs/bugs/B-003-puff-bound-to-fact-reward/ticket.md). Centred on
 *  the rendered sprite (not its top-left placement corner), reusing the same
 *  per-type size/offset math drawEnemies already uses so a purple slime's
 *  puff scales up right along with its bigger sprite. */
export interface EffectAnchor {
  x: number;
  y: number;
  scale: number;
}

export function enemyEffectAnchor(enemy: EnemyState): EffectAnchor {
  const type = enemy.type as EnemyTypeKey;
  const size = enemyRenderedSize(type);
  return {
    x: enemy.x + enemyTileOffsetX(type) + size / 2,
    y: enemy.y + enemyTileOffsetY(type) + size / 2,
    scale: size / ENEMY_RENDERED_SIZE,
  };
}
```

`EnemyTypeKey` must be imported — check the existing `import type { EnemyState } from './enemies';` line near the top and extend it to `import type { EnemyState, EnemyTypeKey } from './enemies';` (mirrors `typeOf`'s own cast pattern in `entities/enemies/index.ts`, read earlier in this session).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- Enemy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Enemy.ts src/themes/platformer/entities/Enemy.test.ts
git commit -m "feat(platformer): add enemyEffectAnchor for world-event puffs"
```

---

## Task 4: `blockEffectAnchor` in `entities/Block.ts`

**Files:**
- Modify: `src/themes/platformer/entities/Block.ts`
- Test: `src/themes/platformer/entities/Block.test.ts`

**Interfaces:**
- Consumes: `EffectAnchor` (from Task 3's `entities/Enemy.ts` — import it rather than redeclaring an identical shape).
- Produces: `blockEffectAnchor(block: BlockState): EffectAnchor`, exported from `entities/Block.ts`.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/entities/Block.test.ts` (check its existing imports for how a `BlockState` is constructed in this file — likely via `toBlockState` and a `BlockPlacement` literal; match that convention):

```ts
import { blockEffectAnchor } from './Block';

describe('blockEffectAnchor', () => {
  it('anyBlock-centersOnItsOwnTile-notTopLeftCorner', () => {
    const block = toBlockState({ id: 'rock-1', blockKind: 'fragileRock', x: 320, y: 96 });
    const anchor = blockEffectAnchor(block);
    expect(anchor.x).toBe(320 + BLOCK_RENDERED_SIZE / 2);
    expect(anchor.y).toBe(96 + BLOCK_RENDERED_SIZE / 2);
  });

  it('anyBlock-scaleIsAlways1-blocksAreAllOneTileSize', () => {
    const block = toBlockState({ id: 'crate-1', blockKind: 'crate', x: 0, y: 0, fact: undefined });
    expect(blockEffectAnchor(block).scale).toBe(1);
  });
});
```

Check `BlockPlacement`'s actual field shape (from `level/BlockMapper.ts`, imported at the top of `Block.ts`) before finalizing this test's object literals — `fact` may or may not be a valid/required field per `blockKind`; match whatever the file's other tests already construct.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- Block.test.ts`
Expected: FAIL — `blockEffectAnchor` is not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/entities/Block.ts`, add the import and function:

```ts
import type { EffectAnchor } from './Enemy';
```

(Add alongside the existing imports at the top of the file.)

```ts
/** A world-space anchor point + size scale for a one-shot visual effect at
 *  this block's position — see entities/Enemy.ts's enemyEffectAnchor for the
 *  enemy equivalent and B-003 for why this exists. Every block kind is
 *  exactly one tile, so unlike enemies there is no per-kind size variance —
 *  scale is always 1. */
export function blockEffectAnchor(block: BlockState): EffectAnchor {
  return {
    x: block.x + BLOCK_RENDERED_SIZE / 2,
    y: block.y + BLOCK_RENDERED_SIZE / 2,
    scale: 1,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- Block.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Block.ts src/themes/platformer/entities/Block.test.ts
git commit -m "feat(platformer): add blockEffectAnchor for world-event puffs"
```

---

## Task 5: `deathEffectGiven` on `BaseEnemyState`

**Files:**
- Modify: `src/themes/platformer/entities/enemies/EnemyType.ts`
- Modify: `src/themes/platformer/entities/enemies/shared.ts`
- Test: `src/themes/platformer/entities/enemies/shared.test.ts`

**Interfaces:**
- Produces: `BaseEnemyState.deathEffectGiven: boolean` (new field). `baseEnemyState(...)` seeds it `false`. `baseRevive(...)` resets it to `false` (unlike `rewardGiven`, which `baseRevive` deliberately leaves alone). `SlimeGreenState`/`SlimePurpleState` need no changes — they get this field automatically through `{ ...baseEnemyState(...) }` / `{ ...baseRevive(...) }` spreads.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/entities/enemies/shared.test.ts` (check its existing imports/helpers for how a `BaseEnemyState` is built via `baseEnemyState` in this file — reuse whatever placement/index/maxHitPoints/hitReactionSeconds args its existing tests already pass):

```ts
describe('deathEffectGiven', () => {
  it('baseEnemyState-startsFalse', () => {
    const state = baseEnemyState(placement, 0, 1, ENEMY_HIT_REACTION_SECONDS);
    expect(state.deathEffectGiven).toBe(false);
  });

  it('baseRevive-resetsDeathEffectGivenToFalse-evenIfItWasTrue', () => {
    const state = { ...baseEnemyState(placement, 0, 1, ENEMY_HIT_REACTION_SECONDS), deathEffectGiven: true, alive: false };
    const revived = baseRevive(state, 1, ENEMY_HIT_REACTION_SECONDS);
    expect(revived.deathEffectGiven).toBe(false);
  });

  it('baseRevive-preservesRewardGiven-unlikeDeathEffectGiven', () => {
    // Contrast case: rewardGiven is permanent (see baseRevive's own doc
    // comment); deathEffectGiven is per-life. Both fields exist on the same
    // object but behave oppositely across a revive.
    const state = {
      ...baseEnemyState(placement, 0, 1, ENEMY_HIT_REACTION_SECONDS),
      rewardGiven: true,
      deathEffectGiven: true,
      alive: false,
    };
    const revived = baseRevive(state, 1, ENEMY_HIT_REACTION_SECONDS);
    expect(revived.rewardGiven).toBe(true);
    expect(revived.deathEffectGiven).toBe(false);
  });
});
```

(`placement` here should reuse whatever local `EnemyPlacement` fixture the rest of the file already defines for its own `baseEnemyState`/`baseRevive`/`takeHit` tests — read the top of `shared.test.ts` before writing this and match it exactly rather than inventing a second fixture.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- shared.test.ts`
Expected: FAIL — `deathEffectGiven` is `undefined` on the returned state (TypeScript will also flag the object literals above as excess-property errors against `BaseEnemyState` until Step 3 adds the field, which is fine — it's what makes the test fail correctly).

- [ ] **Step 3: Implement**

In `src/themes/platformer/entities/enemies/EnemyType.ts`, add the field to `BaseEnemyState` (after `rewardGiven`, in the same interface, ~line 30):

```ts
  /** True once this life's defeat has shown a visual effect (a reward's
   *  fact-flight, or a factless world-event puff — see B-003). Unlike
   *  `rewardGiven`, this is reset on revive: a revived-and-redefeated enemy
   *  gets nothing further to give (rewardGiven stays true forever) but still
   *  deserves a puff for THIS death, so it needs its own once-per-life gate. */
  deathEffectGiven: boolean;
```

In `src/themes/platformer/entities/enemies/shared.ts`:

In `baseEnemyState`'s returned object, add `deathEffectGiven: false,` right after `rewardGiven: false,` (~line 48).

In `baseRevive`'s returned object, add `deathEffectGiven: false,` right after `alive: true,` (~line 101) — this is the field's whole point: unlike every other field in that function (which either restores a spawn value or is silently carried over by the `...enemy` spread), `deathEffectGiven` must be explicitly forced back to `false` here, exactly the same way `alive: true` is explicit despite `...enemy` already having spread the (false) pre-revive value.

Update `baseRevive`'s doc comment (currently: "Resets an enemy to its spawn state, preserving `rewardGiven` — ... — and preserving `animFrame`/`animTimer` ...") to also mention: "and resetting `deathEffectGiven` back to `false` — a revived enemy's next death is a new life's death, entitled to its own visual effect even if `rewardGiven` (permanent) has nothing left to add."

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- shared.test.ts`
Expected: PASS. Also run `npm test -- Enemy.test.ts SlimeGreen SlimePurple` (or the fuller `npm test -- entities/enemies`) to confirm nothing in `SlimeGreen.ts`/`SlimePurple.ts` (which spread `baseEnemyState`/`baseRevive`'s results without listing fields individually) broke — it shouldn't, since neither file enumerates `BaseEnemyState`'s fields itself.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/enemies/EnemyType.ts src/themes/platformer/entities/enemies/shared.ts src/themes/platformer/entities/enemies/shared.test.ts
git commit -m "feat(platformer): add deathEffectGiven, reset on revive unlike permanent rewardGiven"
```

---

## Task 6: `activePuffs` signal in `PlatformerState.ts`

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `PuffEffect` (from Task 1).
- Produces: `export const activePuffs = signal<PuffEffect[]>([])`. `resetGameProgress()` clears it (same as `activeEffects`). NOT cleared by `resetGame()` (same as `activeEffects` — a death/respawn shouldn't cut off an in-flight puff either, matching the existing convention for `activeEffects`).

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/PlatformerState.test.ts` (check its existing imports/`resetGameProgress` tests for the established pattern — there is very likely already a test asserting `resetGameProgress()` clears `activeEffects`; mirror it exactly for `activePuffs`):

```ts
import { activePuffs } from './PlatformerState';
import { startPuffEffect } from './engine/CollectionEffects';

describe('activePuffs', () => {
  it('startsEmpty', () => {
    expect(activePuffs.value).toEqual([]);
  });

  it('resetGameProgress-clearsActivePuffs', () => {
    activePuffs.value = [startPuffEffect('a', 0, 0)];
    resetGameProgress();
    expect(activePuffs.value).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- PlatformerState.test.ts`
Expected: FAIL — `activePuffs` is not exported yet.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerState.ts`:

Extend the type-only import near the top (currently `import type { FlightEffect, CounterPopupEffect, CounterPopupLabelKey } from './engine/CollectionEffects';`) to also bring in `PuffEffect`:

```ts
import type { FlightEffect, PuffEffect, CounterPopupEffect, CounterPopupLabelKey } from './engine/CollectionEffects';
```

Add the signal right after `activeEffects` (~line 321):

```ts
/** Currently animating world-event puffs — see engine/CollectionEffects.ts's
 *  PuffEffect doc comment and B-003
 *  (docs/bugs/B-003-puff-bound-to-fact-reward/ticket.md). Kept as its own
 *  array, parallel to activeEffects, rather than merged into it: the two are
 *  different shapes (no text/flight-target fields here) and different
 *  render passes (drawPuffEffects vs. drawCollectionEffects). */
export const activePuffs = signal<PuffEffect[]>([]);
```

In `resetGameProgress()`, add `activePuffs.value = [];` right after the existing `activeEffects.value = [];` line (~line 431) — same persistence convention as `activeEffects`: cleared by a deliberate Reset Game, not by an ordinary death/respawn (`resetGame()` is left untouched).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- PlatformerState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add activePuffs signal, cleared by Reset Game like activeEffects"
```

---

## Task 7: Wire puffs into `PlatformerPage.tsx`'s tick/render loop and defeat/break handlers

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `activePuffs` (Task 6), `startPuffEffect`/`tickPuffEffect` (Task 1), `drawPuffEffects` (Task 2), `enemyEffectAnchor` (Task 3), `blockEffectAnchor` (Task 4), `deathEffectGiven` (Task 5).
- Produces: no new exports — this task only changes `PlatformerPage.tsx`'s internal tick/render logic.

This task has four distinct pieces. Do them in order, each with its own failing-test-first cycle, but they can share one commit at the end since they're all one cohesive change to one file's tick loop.

### 7a. Tick + render wiring (mechanical, no behavior change yet)

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/PlatformerPage.test.tsx` (near wherever `activeEffects` ticking is currently tested, if such a test exists — otherwise add standalone):

```ts
import { activePuffs } from './PlatformerState';
import { startPuffEffect } from './engine/CollectionEffects';

it('activePuff-tick-elapsesAndEventuallyClearsItself', () => {
  let frameCallback: FrameRequestCallback | null = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  render(<PlatformerPage />);
  frameCallback!(0);

  activePuffs.value = [startPuffEffect('test-puff', 500, 500)];
  frameCallback!(16);
  expect(activePuffs.value.find((p) => p.id === 'test-puff')?.elapsed).toBeGreaterThan(0);

  // SPARKLE_DURATION_SECONDS is 0.4s — well under 1000ms of ticks.
  let t = 16;
  for (let i = 0; i < 100; i++) {
    t += 16;
    frameCallback!(t);
  }
  expect(activePuffs.value.find((p) => p.id === 'test-puff')).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- PlatformerPage.test.tsx -t activePuff-tick`
Expected: FAIL — nothing ticks `activePuffs` yet, so `elapsed` never advances and the puff never clears.

- [ ] **Step 3: Implement**

In `src/themes/platformer/PlatformerPage.tsx`:

Add to the import from `./engine/CollectionEffects` (find the existing multi-line import — it currently includes `startFlightEffect`, `tickFlightEffect`, etc.) the new `startPuffEffect`, `tickPuffEffect`. Add `activePuffs` to the import from `./PlatformerState` (alongside the existing `activeEffects`). Add `drawPuffEffects` to the import from `./engine/Renderer` (alongside `drawCollectionEffects`, currently at line 13).

Right after the existing tick/filter block for `activeEffects` (currently ~lines 781-783: `activeEffects.value = activeEffects.value.map((effect) => tickFlightEffect(effect, dt)).filter((effect) => effect.phase !== 'done');`), add the parallel block for puffs:

```ts
      activePuffs.value = activePuffs.value
        .map((puff) => tickPuffEffect(puff, dt))
        .filter((puff) => puff.elapsed <= SPARKLE_DURATION_SECONDS);
```

(`SPARKLE_DURATION_SECONDS` must be imported from `./engine/CollectionEffects` alongside the others — check whether it's already imported for another reason first; if not, add it.)

In the `render()` function, right after the existing `drawCollectionEffects(ctx, activeEffects.value);` call (line 453), add:

```ts
      drawPuffEffects(ctx, activePuffs.value);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- PlatformerPage.test.tsx -t activePuff-tick`
Expected: PASS.

### 7b. Purple slime defeat puffs immediately

- [ ] **Step 5: Write the failing test**

Add to `PlatformerPage.test.tsx`, modeled directly on the existing `'purpleSlimeDefeat-thirdStomp-spawnsKeyPickupInsteadOfJournalFact'` test (same file, read it first for the exact stomp-setup pattern — start the target at `hitPoints: 1`, position the player via `stompLandingY`, drive ~30 frames):

```ts
it('purpleSlimeDefeat-thirdStomp-alsoQueuesAPuff', () => {
  let frameCallback: FrameRequestCallback | null = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  render(<PlatformerPage />);
  frameCallback!(0);

  const target = enemyStates.value.find((e) => e.type === 'slimePurple')!;
  enemyStates.value = enemyStates.value.map((e) => (e.id === target.id ? { ...e, hitPoints: 1 } : e));
  playerState.value = { ...playerState.value, x: target.x, y: stompLandingY(target), vy: 300 };

  let t = 16;
  frameCallback!(t);
  for (let i = 0; i < 30; i++) {
    t += 16;
    frameCallback!(t);
  }

  expect(activePuffs.value.some((p) => p.id === target.id)).toBe(true);
  // A purple slime is bigger than the baseline green slime — its puff scale
  // must be visibly bigger than 1 (see enemyEffectAnchor).
  expect(activePuffs.value.find((p) => p.id === target.id)?.scale).toBeGreaterThan(1);
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- PlatformerPage.test.tsx -t purpleSlimeDefeat-thirdStomp-alsoQueuesAPuff`
Expected: FAIL — the `heldItem === 'key'` branch doesn't queue a puff yet.

- [ ] **Step 7: Implement — restructure the `justDefeated` block**

In `PlatformerPage.tsx`, this is the block currently spanning roughly lines 697-778 (read it fresh before editing — line numbers have likely shifted since this plan was written). The change has three parts:

**Part A — selection filter.** Change:

```ts
      const justDefeated = enemyStates.value.filter((e) => !e.alive && !e.rewardGiven);
```

to:

```ts
      // !deathEffectGiven (not !rewardGiven) is what makes a revived enemy
      // defeated a second time show up here again — rewardGiven stays true
      // forever once anything has been given (see Enemy.ts's baseRevive doc
      // comment), but deathEffectGiven resets on revive, since a new life's
      // death still deserves its own visual effect. See B-003.
      const justDefeated = enemyStates.value.filter((e) => !e.alive && !e.deathEffectGiven);
```

**Part B — per-enemy branch.** Add a `newPuffs` array alongside the existing `newFacts`/`newEffects` locals (right after `const newEffects = [...activeEffects.value];`, ~line 700):

```ts
        const newPuffs = [...activePuffs.value];
```

Change the loop body. The existing code is:

```ts
        for (const enemy of justDefeated) {
          if (typeOf(enemy).heldItem === 'key') {
            keyPickupStates.value = [...keyPickupStates.value, spawnKeyPickup(enemy.id, enemy.x, enemy.y)];
            continue;
          }
          const fact = enemy.fact;
          if (!fact) continue;
          anyEnemyRewarded = true;
          newFacts.push(fact);
          const { icon, title: label } = formatJournalEntry(fact);
          const slot = nextTextSlot;
          nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
          const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
          newEffects.push(
            startFlightEffect(
              enemy.id, label,
              enemy.x + originX, enemy.y + originY + stackOffsetY,
              midX, midY + stackOffsetY,
              targetX, targetY,
              icon,
            ),
          );
        }
```

Replace it with:

```ts
        for (const enemy of justDefeated) {
          const anchor = enemyEffectAnchor(enemy);
          const puffX = anchor.x + originX;
          const puffY = anchor.y + originY;

          if (typeOf(enemy).heldItem === 'key') {
            // A purple slime carries no fact — its finishing stomp always
            // gets a puff. A key pickup is dropped only the FIRST time
            // (rewardGiven false); a revived-and-redefeated purple slime
            // still puffs on later deaths but drops nothing further, since
            // it already gave its one key.
            if (!enemy.rewardGiven) {
              keyPickupStates.value = [...keyPickupStates.value, spawnKeyPickup(enemy.id, enemy.x, enemy.y)];
            }
            newPuffs.push(startPuffEffect(enemy.id, puffX, puffY, anchor.scale));
            continue;
          }

          const fact = enemy.fact;
          if (!fact || enemy.rewardGiven) {
            // Either a "plain" enemy that never had a fact to give, or a
            // revived enemy defeated again after already paying out its
            // fact (rewardGiven permanent — see Enemy.ts's baseRevive doc
            // comment). Either way: nothing left to reward, but the defeat
            // itself is still a world event that deserves a puff (B-003).
            newPuffs.push(startPuffEffect(enemy.id, puffX, puffY, anchor.scale));
            continue;
          }

          // A fresh fact-bearing defeat: the flight effect already draws its
          // own sparkle burst (Renderer.ts's drawCollectionEffects) — no
          // additional puff, to avoid two overlapping bursts (B-003).
          anyEnemyRewarded = true;
          newFacts.push(fact);
          const { icon, title: label } = formatJournalEntry(fact);
          const slot = nextTextSlot;
          nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
          const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
          newEffects.push(
            startFlightEffect(
              enemy.id, label,
              enemy.x + originX, enemy.y + originY + stackOffsetY,
              midX, midY + stackOffsetY,
              targetX, targetY,
              icon,
            ),
          );
        }
```

Add `activePuffs.value = newPuffs;` alongside the existing `collectedFacts.value = newFacts; activeEffects.value = newEffects;` lines (~line 766-767).

**Part C — the marking step.** The existing code (~lines 761-764):

```ts
        const rewardedIds = new Set(justDefeated.map((e) => e.id));
        enemyStates.value = enemyStates.value.map((e) =>
          rewardedIds.has(e.id) ? { ...e, rewardGiven: true } : e,
        );
```

becomes:

```ts
        // Every defeated enemy is marked processed (deathEffectGiven) so it
        // isn't selected into justDefeated again next tick. rewardGiven is
        // ALSO set for every one of them, not only fact-bearing ones — a
        // "plain" enemy or a purple slime's key drop are just as much "its
        // one payout" as a fact is (see Enemy.ts's baseRevive doc comment):
        // there is nothing further to ever give any of them again.
        const processedIds = new Set(justDefeated.map((e) => e.id));
        enemyStates.value = enemyStates.value.map((e) =>
          processedIds.has(e.id) ? { ...e, rewardGiven: true, deathEffectGiven: true } : e,
        );
```

Also add `enemyEffectAnchor` to the import from `./entities/Enemy` (alongside whatever's already imported there — e.g. `toEnemyState`, `reviveEnemy`).

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- PlatformerPage.test.tsx -t purpleSlimeDefeat-thirdStomp-alsoQueuesAPuff`
Expected: PASS. Also re-run the two pre-existing tests this block touches — `'purpleSlimeDefeat-thirdStomp-spawnsKeyPickupInsteadOfJournalFact'` and `'purpleSlimeRevivedAndDefeatedAgain-...'` (search the file for its exact name) and `'enemyThatGaveItsReward-isFlaggedRewardGivenAndStaysFlaggedAcrossRespawn'` and `'playerFallsOntoAPlainEnemyWithNoFact-tick-defeatsItButAwardsNoFact'` — to confirm none regressed:

Run: `npm test -- PlatformerPage.test.tsx -t "purpleSlime|PlainEnemy|rewardGiven"`
Expected: PASS.

### 7c. Revived-and-redefeated green slime puffs (the second literal bug in B-003)

- [ ] **Step 9: Write the failing test**

```ts
it('greenSlimeRevivedAndDefeatedAgain-secondDefeat-queuesAPuffNotAFlightEffect', () => {
  let frameCallback: FrameRequestCallback | null = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  render(<PlatformerPage />);
  frameCallback!(0);

  const target = enemyStates.value.find((e) => e.type === 'slimeGreen')!;
  playerState.value = { ...playerState.value, x: target.x, y: stompLandingY(target), vy: 300 };

  let t = 16;
  frameCallback!(t);
  for (let i = 0; i < 30; i++) {
    t += 16;
    frameCallback!(t);
  }
  expect(enemyStates.value.find((e) => e.id === target.id)?.rewardGiven).toBe(true);
  const factsAfterFirstDefeat = collectedFacts.value.length;

  // Simulate a death/respawn (per FR-020c: rewardGiven survives it, but
  // deathEffectGiven must reset — see Task 5), same pattern as the existing
  // 'purpleSlimeRevivedAndDefeatedAgain...' key-pickup test in this file.
  playerState.value = { ...playerState.value, hitPoints: 0 };
  frameCallback!(t + 16); // enters 'dying'
  t += 16;
  for (let i = 0; i < 200; i++) {
    t += 16;
    frameCallback!(t);
  }
  fireEvent.keyDown(window, { code: 'Enter' });

  const revived = enemyStates.value.find((e) => e.id === target.id)!;
  playerState.value = { ...playerState.value, x: revived.x, y: stompLandingY(revived), vy: 300 };
  t += 16;
  frameCallback!(t);
  for (let i = 0; i < 30; i++) {
    t += 16;
    frameCallback!(t);
  }

  // The redefeat must NOT add a second fact...
  expect(collectedFacts.value).toHaveLength(factsAfterFirstDefeat);
  // ...but MUST show a puff, which is the actual bug being fixed.
  expect(activePuffs.value.some((p) => p.id === target.id)).toBe(true);
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npm test -- PlatformerPage.test.tsx -t greenSlimeRevivedAndDefeatedAgain`
Expected: This should actually already PASS after Step 7's implementation, since Part A's filter change (`!deathEffectGiven` instead of `!rewardGiven`) and Part B's `!fact || enemy.rewardGiven` branch together already cover this case. If it fails, the filter or branch logic from Step 7 has a bug — fix it there rather than adding special-case code here; this test exists to lock in that Task 7's general mechanism actually covers B-003's second named bug, not to introduce new production code.

- [ ] **Step 11: Confirm it passes (no new implementation expected)**

Run: `npm test -- PlatformerPage.test.tsx -t greenSlimeRevivedAndDefeatedAgain`
Expected: PASS.

### 7d. fragileRock break puff, replacing the hack

- [ ] **Step 12: Write the failing test**

This test drives the player into a real fragileRock block from `blockPlacements` (level1 actually places two — see `level/level.ts`'s doc comment on `FRAGILE_ROCK_TILES`, read earlier in this session), mirroring `engine/Physics.test.ts`'s `'jumpingUpIntoABlockFromBelow-reportsItsIdInHitBlockIds'` test's positioning convention (`y = ceilingBottomY - PLAYER_HEAD_PADDING + 1`, `vy` strongly negative):

```ts
it('fragileRockBrokenFromBelow-queuesAPuffNotAFlightEffect', () => {
  let frameCallback: FrameRequestCallback | null = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  render(<PlatformerPage />);
  frameCallback!(0);

  const rock = blockPlacements.value.find((b) => b.blockKind === 'fragileRock')!;
  const ceilingBottomY = rock.y + RENDERED_TILE_SIZE;
  playerState.value = {
    ...playerState.value,
    x: rock.x,
    y: ceilingBottomY - PLAYER_HEAD_PADDING + 1,
    vy: -1000,
  };

  let t = 16;
  frameCallback!(t);
  for (let i = 0; i < 10; i++) {
    t += 16;
    frameCallback!(t);
  }

  expect(activePuffs.value.some((p) => p.id === rock.id)).toBe(true);
  expect(activeEffects.value.some((e) => e.id === rock.id)).toBe(false);
});
```

Add `RENDERED_TILE_SIZE` to this test file's imports from `./level/Terrain` if not already present (check first — `tileToPixel` is already imported from there per the top-of-file read earlier in this session).

- [ ] **Step 13: Run the test to verify it fails**

Run: `npm test -- PlatformerPage.test.tsx -t fragileRockBrokenFromBelow`
Expected: FAIL — the current code queues a `FlightEffect` (the empty-label hack) into `activeEffects`, not a `PuffEffect` into `activePuffs`, so the second assertion fails (or the first fails if the geometry needs adjusting — see the note below).

If the player doesn't actually reach the block in the frame budget above, this is a geometry/timing issue with the test's setup, not a production bug — increase the frame count or check `Physics.ts`'s exact ceiling-hit condition (read it before iterating blindly) rather than changing anything under `src/themes/platformer/entities` or `engine`.

- [ ] **Step 14: Implement — replace the fragileRock hack**

In `PlatformerPage.tsx`, find the block (read fresh — this was around lines 1206-1230 as of this session's earlier read, in the `hittableBlockIds` handling):

```ts
          if (block.blockKind === 'fragileRock') {
            // Centered on the fragileRock's own tile, not its top-left
            // corner. The burst's size itself (SPARKLE_RADIUS_PX/
            // SPARKLE_MAX_RADIUS in CollectionEffects.ts/Renderer.ts) is a
            // shared constant every collection effect uses, not
            // parameterized per-effect — scaling it up just for rocks would
            // mean threading a size override through
            // FlightEffect/sparkleParticles/drawCollectionEffects, affecting
            // every other effect's call sites too, so it stays at the shared
            // default.
            const puffX = block.x + originX + RENDERED_TILE_SIZE / 2;
            const puffY = block.y + originY + RENDERED_TILE_SIZE / 2;
            activeEffects.value = [
              ...activeEffects.value,
              startFlightEffect(block.id, '', puffX, puffY, puffX, puffY, puffX, puffY),
            ];
          }
```

Replace with:

```ts
          if (block.blockKind === 'fragileRock') {
            // A real PuffEffect now (see B-003 / CollectionEffects.ts's
            // PuffEffect doc comment) — this used to fake a burst-only
            // effect via an empty-label FlightEffect with all coordinates
            // equal; that hack is gone.
            const anchor = blockEffectAnchor(block);
            activePuffs.value = [
              ...activePuffs.value,
              startPuffEffect(block.id, anchor.x + originX, anchor.y + originY, anchor.scale),
            ];
          }
```

Add `blockEffectAnchor` to the import from `./entities/Block` (alongside whatever's already imported there — e.g. `applyBlockHit`, `isBlockUsedUp`).

- [ ] **Step 15: Run the test to verify it passes**

Run: `npm test -- PlatformerPage.test.tsx -t fragileRockBrokenFromBelow`
Expected: PASS.

### 7e. Guard against a double burst on fact-bearing paths

- [ ] **Step 16: Write the failing test**

```ts
it('coinCollection-queuesAFlightEffectOnly-neverAlsoAPuff', () => {
  let frameCallback: FrameRequestCallback | null = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  render(<PlatformerPage />);
  frameCallback!(0);

  const coin = collectiblePlacements.value[0];
  playerState.value = { ...playerState.value, x: coin.x, y: coin.y };
  frameCallback!(16);

  expect(activeEffects.value.some((e) => e.id === coin.id)).toBe(true);
  expect(activePuffs.value.some((p) => p.id === coin.id)).toBe(false);
});
```

- [ ] **Step 17: Run the test**

Run: `npm test -- PlatformerPage.test.tsx -t coinCollection-queuesAFlightEffectOnly`
Expected: This should already PASS — Task 7 never added a puff call to the coin/bonus-fruit/crate/chest collection branches, only to the enemy-defeat and fragileRock branches. This test exists to lock that invariant in, same reasoning as 7c's Step 10-11. If it fails, something in Task 7's edits accidentally touched a fact-bearing branch — revert that stray change.

- [ ] **Step 18: Confirm it passes (no new implementation expected)**

Run: `npm test -- PlatformerPage.test.tsx -t coinCollection-queuesAFlightEffectOnly`
Expected: PASS.

### Final step for Task 7

- [ ] **Step 19: Run the full PlatformerPage test file, then commit**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: PASS, every test in the file (old and new).

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "fix(platformer): puff on purple-slime defeat, revived redefeat, and fragileRock break (B-003)"
```

---

## Task 8: Full-suite verification, lint, roadmap check-off

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md` (check off step 34)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions anywhere in the repo.

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint` (and `npm run typecheck` / `tsc --noEmit` if this repo has a separate script for it — check `package.json`'s `scripts` first).
Expected: PASS, no errors. (Per this session's memory: tests and `tsc` alone have previously missed lint-only rule violations — always run lint explicitly, don't skip it because tests are green.)

- [ ] **Step 3: Check off roadmap step 34**

In `specs/S-006-platformer-theme/roadmap.md`, change `- [ ] **34. World-event puff...` to `- [x] **34. World-event puff...` — but only after the manual browser verification below actually passes, not before.

- [ ] **Step 4: Manual browser verification**

Start the dev server and, in the Platformer theme (unlock it if gated behind `platformerPrototypeUnlocked` — check `src/state/theme.ts`):
1. Defeat a purple slime (3 stomps) — confirm a sparkle puff shows immediately at the moment of defeat, visibly bigger than a green slime's puff, before the key even drops.
2. Defeat a green slime with a fact — confirm exactly one sparkle burst (the fact-flight's own), not two.
3. Let the player die and respawn, then defeat the same (revived) green slime again — confirm a puff shows on this second defeat even though nothing is added to the journal.
4. Break a fragileRock (jump into it from below) — confirm the same visual puff as before this change, now via the real mechanism instead of the hack.
5. Collect a coin, a bonus fruit, open a chest with a fresh fact — confirm each still shows exactly one sparkle burst, not two.

- [ ] **Step 5: Commit the roadmap check-off**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): check off roadmap step 34 (world-event puff, B-003)"
```
