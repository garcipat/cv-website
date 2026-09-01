# Purple Slime Key Mechanic (Roadmap Step 30) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Purple slimes become a distinct, tougher enemy variant: 1.5× a green slime's rendered size, ~30% slower patrol speed, and 3 hit points (up from 2) to defeat. They carry no CV content at all — every Course fact now comes from green slimes alone. A purple slime's finishing stomp drops a key as its own bobbing ground pickup (visually identical bob to a coin); walking into it adds one to a new `collectedKeys` HUD counter (hidden at 0, shown once ≥1). Opening a chest (Arrow Up while standing on it) now additionally requires `collectedKeys > 0` and spends one key. A given purple slime drops at most one key ever, even across death/respawn. `level1.ts` gains a second `M` marker so both of its chests have a matching purple slime.

**Architecture:** Follows this codebase's existing per-type config-lookup convention (see `ENEMY_ANIM_CONFIG` in `Enemy.ts`) rather than scattering ternaries: three new `Record<EnemyDef['spriteType'], number>` lookups in `Enemy.ts` (render-scale multiplier, patrol-speed multiplier, hit points), plus a new `enemyRenderedSize(spriteType)` helper that `Collision.ts`'s `enemyHitbox` and `Renderer.ts`'s `drawEnemies` both call instead of the flat `ENEMY_RENDERED_SIZE` constant (kept, unchanged value, as the green/default size — still used directly by anything that doesn't need per-type awareness).

The key pickup is a new, minimal entity (`entities/KeyPickup.ts`) modeled on the existing `BonusFruitState` shape but simpler (no rise tween — it appears directly at the defeat point and just bobs in place, reusing `Coin.ts`'s `coinBobOffset` as-is, same convention `Fruit.ts`'s bob already reuses). `PlatformerState.ts` gets two new signals: `keyPickupStates` (array, persists across death/respawn like `blockStates`/`bonusFruitStates` — NOT reset by `resetGame()`, only by `resetGameProgress()`) and `collectedKeys` (number, same persistence rule). A key pickup's `id` reuses its source enemy's `id` (mirroring `spawnBonusFruit`'s id-reuse convention) so a respawned purple slime (enemies DO reset on death) defeated again never drops a second key — the spawn site checks `keyPickupStates.value.some(k => k.id === enemy.id)` first, same anti-duplication shape `FR-020c` already uses for facts.

`EnemyMapper.ts`'s `mapCVDataToEnemies` changes from alternating green/purple to green-only — every course goes to `courseToEnemy(course, 'slimeGreen')`. Purple markers (`M`) still place via the existing `placeQueue`/`plainEnemyDef` path, which already produces a fact-less `EnemyDef` for any marker beyond its color's def count — since purple now has zero defs, every purple placement is automatically a `plainEnemyDef`, with no new branching needed there.

`Collision.ts` gains `checkKeyPickupCollisions` (same one-tile-box-per-item shape as `checkSignOverlap`, not a sprite-precise hitbox — simplest correct approach, matching an existing precedent). `PlatformerPage.tsx`'s enemy-defeat block (currently: no fact → skip, silent removal) branches on `enemy.spriteType === 'slimePurple'` to spawn a key pickup instead of silently dropping the enemy; its chest-opening block (currently unconditional) gains a `collectedKeys.value > 0` guard and decrements the count on open. `Renderer.ts` gains `drawKeyPickups` (world, bobbing) and `drawKeyCounter` (HUD, conditionally called only when `collectedKeys.value > 0`, positioned to the right of the existing chest counter on the same HUD row).

## Global Constraints

- TypeScript strict mode, no `any`, no `@ts-ignore` (constitution Principle I).
- Test-first: write the failing test before the implementation for every step (constitution Principle II, NON-NEGOTIABLE). Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies.
- `public/sprites/key.png` already exists (14×28, transparent, generated this session) — no asset work needed in this plan.
- Spec: `specs/S-006-platformer-theme/spec.md` (User Story 4, User Story 6, FR-009, FR-019, FR-020, FR-020e, FR-023) — read alongside this plan.

---

### Task 1: `KeyPickupState` entity module

**Files:**
- Create: `src/themes/platformer/entities/KeyPickup.ts`
- Test: `src/themes/platformer/entities/KeyPickup.test.ts`

**Interfaces:**
- Produces: `KeyPickupState { id: string; x: number; y: number; collected: boolean }`, `spawnKeyPickup(id: string, x: number, y: number): KeyPickupState`, `KEY_FRAME_WIDTH = 14`, `KEY_FRAME_HEIGHT = 28`, `KEY_RENDERED_WIDTH`, `KEY_RENDERED_HEIGHT` (both `* RENDER_SCALE`, imported from `../level/Terrain`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/themes/platformer/entities/KeyPickup.test.ts
import { describe, it, expect } from 'vitest';
import { spawnKeyPickup, KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT, KEY_RENDERED_WIDTH, KEY_RENDERED_HEIGHT } from './KeyPickup';
import { RENDER_SCALE } from '../level/Terrain';

describe('spawnKeyPickup', () => {
  it('spawnKeyPickup-givenIdAndPosition-returnsUncollectedState', () => {
    expect(spawnKeyPickup('enemy-plain-slimePurple-5-6', 100, 200)).toEqual({
      id: 'enemy-plain-slimePurple-5-6',
      x: 100,
      y: 200,
      collected: false,
    });
  });
});

describe('KEY sizing constants', () => {
  it('renderedSize-equalsFrameSizeTimesRenderScale', () => {
    expect(KEY_RENDERED_WIDTH).toBe(KEY_FRAME_WIDTH * RENDER_SCALE);
    expect(KEY_RENDERED_HEIGHT).toBe(KEY_FRAME_HEIGHT * RENDER_SCALE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- KeyPickup.test.ts`
Expected: FAIL — `Cannot find module './KeyPickup'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/themes/platformer/entities/KeyPickup.ts
import { RENDER_SCALE } from '../level/Terrain';

/** Native pixel dimensions of public/sprites/key.png (generated, chroma-keyed
 *  from a magenta-background render, cropped tight on all sides). A single
 *  standalone image, not a sheet — no sx/sy frame lookup needed, matching
 *  Chest.ts's convention for its own standalone (non-tiling) sprites. */
export const KEY_FRAME_WIDTH = 14;
export const KEY_FRAME_HEIGHT = 28;
export const KEY_RENDERED_WIDTH = KEY_FRAME_WIDTH * RENDER_SCALE;
export const KEY_RENDERED_HEIGHT = KEY_FRAME_HEIGHT * RENDER_SCALE;

/**
 * A dropped key, sitting in the world as its own bobbing pickup (bob reuses
 * Coin.ts's coinBobOffset directly — see Renderer.ts's drawKeyPickups). `id`
 * reuses the source purple slime's own `id` — see PlatformerPage.tsx's
 * defeat handler, which checks whether a KeyPickupState with that id already
 * exists in `keyPickupStates` before spawning a new one, so a purple slime
 * respawned after death and defeated again never drops a second key.
 */
export interface KeyPickupState {
  id: string;
  x: number;
  y: number;
  collected: boolean;
}

/** Spawns a key pickup at a defeated purple slime's position (its `x`/`y` at
 *  the moment of defeat — the same tile-anchored pixel coordinates the enemy
 *  itself occupied). */
export function spawnKeyPickup(id: string, x: number, y: number): KeyPickupState {
  return { id, x, y, collected: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- KeyPickup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/KeyPickup.ts src/themes/platformer/entities/KeyPickup.test.ts
git commit -m "feat(platformer): add KeyPickupState entity"
```

---

### Task 2: Per-type enemy size/speed/HP config in `Enemy.ts`

**Files:**
- Modify: `src/themes/platformer/entities/Enemy.ts`
- Test: `src/themes/platformer/entities/Enemy.test.ts`

**Interfaces:**
- Consumes: `EnemyDef['spriteType']` (`'slimeGreen' | 'slimePurple'`, from `../types`).
- Produces: `ENEMY_RENDER_SCALE: Record<EnemyDef['spriteType'], number>` (`{ slimeGreen: 1, slimePurple: 1.5 }`), `ENEMY_PATROL_SPEED_MULTIPLIER: Record<EnemyDef['spriteType'], number>` (`{ slimeGreen: 1, slimePurple: 0.7 }`), `ENEMY_HIT_POINTS: Record<EnemyDef['spriteType'], number>` (`{ slimeGreen: 1, slimePurple: 3 }`), `enemyRenderedSize(spriteType): number`, `enemyTileOffsetX(spriteType): number`, `enemyTileOffsetY(spriteType): number`. `ENEMY_RENDERED_SIZE`/`ENEMY_TILE_OFFSET_X`/`ENEMY_TILE_OFFSET_Y` stay exported, unchanged values (green/default size) — existing callers that don't need per-type awareness (none after Task 4/7, but keep for the constant's own tests) are unaffected. `toEnemyState`'s `hitPoints` line now reads `ENEMY_HIT_POINTS[placement.spriteType]` instead of its inline ternary.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/entities/Enemy.test.ts
import {
  ENEMY_RENDER_SCALE,
  ENEMY_PATROL_SPEED_MULTIPLIER,
  ENEMY_HIT_POINTS,
  enemyRenderedSize,
  enemyTileOffsetX,
  enemyTileOffsetY,
  ENEMY_FRAME_SIZE,
} from './Enemy';
import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';

describe('per-spriteType enemy config', () => {
  it('enemyRenderedSize-slimePurple-is1point5xGreen', () => {
    expect(enemyRenderedSize('slimePurple')).toBe(ENEMY_FRAME_SIZE * RENDER_SCALE * 1.5);
    expect(enemyRenderedSize('slimeGreen')).toBe(ENEMY_FRAME_SIZE * RENDER_SCALE);
  });

  it('enemyTileOffsetX-slimePurple-centersLargerSpriteOnTile', () => {
    const size = enemyRenderedSize('slimePurple');
    expect(enemyTileOffsetX('slimePurple')).toBe((RENDERED_TILE_SIZE - size) / 2);
  });

  it('enemyTileOffsetY-slimePurple-bottomAnchorsLargerSprite', () => {
    const size = enemyRenderedSize('slimePurple');
    expect(enemyTileOffsetY('slimePurple')).toBe(RENDERED_TILE_SIZE - size);
  });

  it('patrolSpeedMultiplier-slimePurple-isSlowerThanGreen', () => {
    expect(ENEMY_PATROL_SPEED_MULTIPLIER.slimePurple).toBeLessThan(ENEMY_PATROL_SPEED_MULTIPLIER.slimeGreen);
    expect(ENEMY_PATROL_SPEED_MULTIPLIER.slimePurple).toBe(0.7);
  });

  it('hitPoints-slimePurple-is3', () => {
    expect(ENEMY_HIT_POINTS.slimePurple).toBe(3);
    expect(ENEMY_HIT_POINTS.slimeGreen).toBe(1);
  });

  it('renderScale-slimePurple-is1point5', () => {
    expect(ENEMY_RENDER_SCALE.slimePurple).toBe(1.5);
    expect(ENEMY_RENDER_SCALE.slimeGreen).toBe(1);
  });
});

describe('toEnemyState hitPoints (updated)', () => {
  it('toEnemyState-slimePurple-hasThreeHitPoints', () => {
    const placement = { id: 'e1', spriteType: 'slimePurple' as const, x: 0, y: 0 };
    expect(toEnemyState(placement).hitPoints).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Enemy.test.ts`
Expected: FAIL — `ENEMY_RENDER_SCALE`/etc. not exported; `hitPoints` test fails (currently 2, not 3).

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/entities/Enemy.ts`. Replace the two lines:

```typescript
export const ENEMY_TILE_OFFSET_Y = RENDERED_TILE_SIZE - ENEMY_RENDERED_SIZE;
export const ENEMY_TILE_OFFSET_X = (RENDERED_TILE_SIZE - ENEMY_RENDERED_SIZE) / 2;
```

with (keep the two lines above them — the two `export const ENEMY_TILE_OFFSET_*` doc comments — but replace the values themselves; also keep `ENEMY_FRAME_SIZE`/`ENEMY_RENDERED_SIZE` exactly as they are, just below `import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';`):

```typescript
export const ENEMY_TILE_OFFSET_Y = RENDERED_TILE_SIZE - ENEMY_RENDERED_SIZE;
export const ENEMY_TILE_OFFSET_X = (RENDERED_TILE_SIZE - ENEMY_RENDERED_SIZE) / 2;

/**
 * Per-`spriteType` render-scale multiplier, patrol-speed multiplier, and hit
 * points — a purple slime is 1.5x a green slime's size, patrols at 70% of
 * its speed, and takes 3 stomps to defeat (green takes 1). Centralized here
 * as lookups (same convention as ENEMY_ANIM_CONFIG above) rather than
 * scattering per-type ternaries through Collision.ts/Renderer.ts/EnemyAI.ts.
 */
export const ENEMY_RENDER_SCALE: Record<EnemyDef['spriteType'], number> = {
  slimeGreen: 1,
  slimePurple: 1.5,
};

export const ENEMY_PATROL_SPEED_MULTIPLIER: Record<EnemyDef['spriteType'], number> = {
  slimeGreen: 1,
  slimePurple: 0.7,
};

export const ENEMY_HIT_POINTS: Record<EnemyDef['spriteType'], number> = {
  slimeGreen: 1,
  slimePurple: 3,
};

/** Actual rendered size for a given spriteType — ENEMY_RENDERED_SIZE scaled
 *  by ENEMY_RENDER_SCALE. Collision.ts's enemyHitbox and Renderer.ts's
 *  drawEnemies both call this instead of the flat ENEMY_RENDERED_SIZE
 *  constant so a bigger purple slime gets a proportionally bigger hitbox and
 *  draw rect. */
export function enemyRenderedSize(spriteType: EnemyDef['spriteType']): number {
  return ENEMY_FRAME_SIZE * RENDER_SCALE * ENEMY_RENDER_SCALE[spriteType];
}

/** Per-spriteType horizontal centering offset — same formula
 *  ENEMY_TILE_OFFSET_X uses, but against enemyRenderedSize(spriteType)
 *  instead of the flat green-sized constant, so a bigger purple slime still
 *  centers correctly over its placement tile. */
export function enemyTileOffsetX(spriteType: EnemyDef['spriteType']): number {
  return (RENDERED_TILE_SIZE - enemyRenderedSize(spriteType)) / 2;
}

/** Per-spriteType bottom-anchoring offset — same formula
 *  ENEMY_TILE_OFFSET_Y uses, against enemyRenderedSize(spriteType). */
export function enemyTileOffsetY(spriteType: EnemyDef['spriteType']): number {
  return RENDERED_TILE_SIZE - enemyRenderedSize(spriteType);
}
```

Also import `EnemyDef` (currently only imported as part of `EnemyPlacement` from `../level/EnemyMapper` — add `import type { EnemyDef } from '../types';` alongside the existing imports at the top of the file).

Then change `toEnemyState`'s body:

```typescript
    hitPoints: placement.spriteType === 'slimeGreen' ? 1 : 2,
```

to:

```typescript
    hitPoints: ENEMY_HIT_POINTS[placement.spriteType],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Enemy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Enemy.ts src/themes/platformer/entities/Enemy.test.ts
git commit -m "feat(platformer): add per-spriteType enemy size/speed/HP config"
```

---

### Task 3: Per-type patrol speed in `EnemyAI.ts`

**Files:**
- Modify: `src/themes/platformer/engine/EnemyAI.ts`
- Test: `src/themes/platformer/engine/EnemyAI.test.ts`

**Interfaces:**
- Consumes: `ENEMY_PATROL_SPEED_MULTIPLIER` (Task 2, from `../entities/Enemy`).
- Produces: `stepEnemyPatrol` now moves a `slimePurple` enemy at `PHYSICS_CONFIG.enemyPatrolSpeed * 0.7` instead of the flat `enemyPatrolSpeed`.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/engine/EnemyAI.test.ts
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

describe('stepEnemyPatrol speed by spriteType', () => {
  it('stepEnemyPatrol-slimePurple-movesSlowerThanGreen', () => {
    const level = { width: 10, height: 2, terrain: Array.from({ length: 2 }, () => Array(10).fill('groundGrass')) };
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
    const green = stepEnemyPatrol({ ...base, spriteType: 'slimeGreen' as const }, level, 1, []);
    const purple = stepEnemyPatrol({ ...base, spriteType: 'slimePurple' as const }, level, 1, []);
    const greenDelta = green.x - base.x;
    const purpleDelta = purple.x - base.x;
    expect(purpleDelta).toBeCloseTo(greenDelta * 0.7, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EnemyAI.test.ts`
Expected: FAIL — both currently move at the same `enemyPatrolSpeed` (60px/s), so `purpleDelta` equals `greenDelta`, not `greenDelta * 0.7`.

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/engine/EnemyAI.ts`. Add the import:

```typescript
import { ENEMY_PATROL_SPEED_MULTIPLIER } from '../entities/Enemy';
```

Change:

```typescript
  const speed = PHYSICS_CONFIG.enemyPatrolSpeed;
```

to:

```typescript
  const speed = PHYSICS_CONFIG.enemyPatrolSpeed * ENEMY_PATROL_SPEED_MULTIPLIER[enemy.spriteType];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EnemyAI.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/EnemyAI.ts src/themes/platformer/engine/EnemyAI.test.ts
git commit -m "feat(platformer): purple slimes patrol 30% slower than green"
```

---

### Task 4: `Collision.ts` — per-type enemy hitbox + key pickup collisions

**Files:**
- Modify: `src/themes/platformer/engine/Collision.ts`
- Test: `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Consumes: `enemyRenderedSize` (Task 2), `KeyPickupState`/`KEY_RENDERED_WIDTH`/`KEY_RENDERED_HEIGHT` (Task 1).
- Produces: `enemyHitbox` now returns a per-spriteType-sized box. New `checkKeyPickupCollisions(player: PlayerState, pickups: readonly KeyPickupState[]): string[]` — returns ids of every NOT-yet-collected pickup the player's hitbox currently overlaps (mirrors `checkBonusFruitCollisions`'s shape: no external dedup set needed, since collected pickups are filtered by their own `collected` flag, not by a separate `collectedIds` set — the caller flips `collected: true` in place rather than removing the entry, per Task 6's persistence requirement).

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/engine/Collision.test.ts
import { enemyHitbox } from './Collision'; // already imported if not, add to existing import
import { enemyRenderedSize } from '../entities/Enemy';
import { checkKeyPickupCollisions } from './Collision';
import type { KeyPickupState } from '../entities/KeyPickup';

describe('enemyHitbox per spriteType', () => {
  it('enemyHitbox-slimePurple-usesLargerRenderedSize', () => {
    const enemy = {
      id: 'e1', spriteType: 'slimePurple' as const, x: 10, y: 20, vx: 0,
      direction: 'right' as const, animState: 'walk' as const, animFrame: 0,
      animTimer: 0, hitPoints: 3, hitTimer: 0, defeated: false,
    };
    const box = enemyHitbox(enemy);
    const expectedSize = enemyRenderedSize('slimePurple');
    expect(box).toEqual({ x: 10, y: 20, width: expectedSize, height: expectedSize });
  });
});

describe('checkKeyPickupCollisions', () => {
  const player = {
    x: 0, y: 0, vx: 0, vy: 0, facing: 'right' as const, grounded: true, climbing: false,
    isDroppingThroughBridge: false, lastGroundedX: 0, lastGroundedY: 0, animState: 'idle' as const,
    animFrame: 0, animTimer: 0, invincibleTimer: 0, knockbackTimer: 0, bounceAscending: false, hitBlockIds: [],
  };

  it('checkKeyPickupCollisions-overlappingUncollectedPickup-returnsItsId', () => {
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: false }];
    expect(checkKeyPickupCollisions(player, pickups)).toEqual(['k1']);
  });

  it('checkKeyPickupCollisions-alreadyCollectedPickup-isExcluded', () => {
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: true }];
    expect(checkKeyPickupCollisions(player, pickups)).toEqual([]);
  });

  it('checkKeyPickupCollisions-noOverlap-returnsEmpty', () => {
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 1000, y: 1000, collected: false }];
    expect(checkKeyPickupCollisions(player, pickups)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Collision.test.ts`
Expected: FAIL — `enemyHitbox` still returns the flat `ENEMY_RENDERED_SIZE`; `checkKeyPickupCollisions` doesn't exist.

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/engine/Collision.ts`. Change the import:

```typescript
import { ENEMY_RENDERED_SIZE } from '../entities/Enemy';
```

to:

```typescript
import { enemyRenderedSize } from '../entities/Enemy';
```

(if `ENEMY_RENDERED_SIZE` is used nowhere else in this file after this change, this fully replaces the import — confirm via the file's other usages before removing; `enemyHitbox` is the only consumer here).

Change `enemyHitbox`:

```typescript
export function enemyHitbox(enemy: EnemyState): Box {
  return { x: enemy.x, y: enemy.y, width: ENEMY_RENDERED_SIZE, height: ENEMY_RENDERED_SIZE };
}
```

to:

```typescript
export function enemyHitbox(enemy: EnemyState): Box {
  const size = enemyRenderedSize(enemy.spriteType);
  return { x: enemy.x, y: enemy.y, width: size, height: size };
}
```

Add the new import and function at the end of the file:

```typescript
import type { KeyPickupState } from '../entities/KeyPickup';
import { KEY_RENDERED_WIDTH, KEY_RENDERED_HEIGHT } from '../entities/KeyPickup';
```

```typescript
/**
 * Returns the ids of every NOT-yet-collected key pickup the player's hitbox
 * currently overlaps. Unlike checkCollectibleCollisions, there's no external
 * `collectedIds` set — a pickup's own `collected` flag is the source of
 * truth (PlatformerState.ts's keyPickupStates keeps collected entries around,
 * flagged rather than removed, so a defeated purple slime can never drop a
 * second key on a later respawn — see KeyPickup.ts's doc comment).
 */
export function checkKeyPickupCollisions(
  player: PlayerState,
  pickups: readonly KeyPickupState[],
): string[] {
  const hitbox = playerHitbox(player);
  const hits: string[] = [];
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    const box: Box = { x: pickup.x, y: pickup.y, width: KEY_RENDERED_WIDTH, height: KEY_RENDERED_HEIGHT };
    if (aabbOverlap(hitbox, box)) hits.push(pickup.id);
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
git commit -m "feat(platformer): per-type enemy hitbox + key pickup collision check"
```

---

### Task 5: `EnemyMapper.ts` — green absorbs all Courses, purple carries no fact

**Files:**
- Modify: `src/themes/platformer/level/EnemyMapper.ts`
- Test: `src/themes/platformer/level/EnemyMapper.test.ts`

**Interfaces:**
- Produces: `mapCVDataToEnemies(cv: CVData): EnemyDef[]` now returns every course as `slimeGreen`. `placeEnemies` is UNCHANGED (still splits by marker color; purple markers now always fall into the existing `plainEnemyDef` fallback since `purpleDefs` is always `[]`).

- [ ] **Step 1: Write the failing test**

```typescript
// Add to/update src/themes/platformer/level/EnemyMapper.test.ts
describe('mapCVDataToEnemies (green-only Courses)', () => {
  it('mapCVDataToEnemies-everyCourse-mapsToSlimeGreen', () => {
    const cv = {
      courses: [
        { title: 'Course A', provider: 'X', year: 2020 },
        { title: 'Course B', provider: 'Y', year: 2021 },
        { title: 'Course C', provider: 'Z', year: 2022 },
      ],
    } as CVData;
    const defs = mapCVDataToEnemies(cv);
    expect(defs).toHaveLength(3);
    expect(defs.every((d) => d.spriteType === 'slimeGreen')).toBe(true);
  });

  it('mapCVDataToEnemies-emptyCourses-returnsEmptyArray', () => {
    expect(mapCVDataToEnemies({ courses: [] } as unknown as CVData)).toEqual([]);
  });
});

describe('placeEnemies (purple markers have no defs to draw from)', () => {
  it('placeEnemies-purpleMarkerWithNoDefs-producesPlainEnemyDefWithNoFact', () => {
    const defs = mapCVDataToEnemies({ courses: [{ title: 'Course A', provider: 'X', year: 2020 }] } as CVData);
    const placements = placeEnemies(defs, {
      slimeGreen: [{ col: 1, row: 1 }],
      slimePurple: [{ col: 5, row: 1 }],
    });
    const purplePlacement = placements.find((p) => p.spriteType === 'slimePurple')!;
    expect(purplePlacement.fact).toBeUndefined();
    const greenPlacement = placements.find((p) => p.spriteType === 'slimeGreen')!;
    expect(greenPlacement.fact).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EnemyMapper.test.ts`
Expected: FAIL — current `mapCVDataToEnemies` alternates green/purple by index, so the "every course maps to slimeGreen" assertion fails for the 2nd/3rd items.

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/level/EnemyMapper.ts`. Change:

```typescript
export function mapCVDataToEnemies(cv: CVData): EnemyDef[] {
  return cv.courses.map((course, index) =>
    courseToEnemy(course, index % 2 === 0 ? 'slimeGreen' : 'slimePurple'),
  );
}
```

to:

```typescript
export function mapCVDataToEnemies(cv: CVData): EnemyDef[] {
  return cv.courses.map((course) => courseToEnemy(course, 'slimeGreen'));
}
```

Update the file's top doc comment on `courseToEnemy`/`mapCVDataToEnemies` (currently describes the old alternating-by-index split) to describe the current behavior: every course is a green slime; purple slimes carry no CV content and instead drop a key on defeat (see `entities/KeyPickup.ts`, `PlatformerPage.tsx`'s defeat handler).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EnemyMapper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/EnemyMapper.ts src/themes/platformer/level/EnemyMapper.test.ts
git commit -m "feat(platformer): green slimes alone deliver Course facts"
```

---

### Task 6: `PlatformerState.ts` — `keyPickupStates` and `collectedKeys` signals

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Test: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `KeyPickupState` (Task 1).
- Produces: `export const keyPickupStates = signal<KeyPickupState[]>([])`, `export const collectedKeys = signal<number>(0)`. Neither touched by `resetGame()`. Both reset (`keyPickupStates` to `[]`, `collectedKeys` to `0`) inside `resetGameProgress()`.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/PlatformerState.test.ts
import { keyPickupStates, collectedKeys, resetGame, resetGameProgress } from './PlatformerState';

describe('keyPickupStates / collectedKeys persistence', () => {
  it('resetGame-doesNotClearKeyPickupsOrCollectedKeys', () => {
    keyPickupStates.value = [{ id: 'k1', x: 0, y: 0, collected: true }];
    collectedKeys.value = 2;
    resetGame();
    expect(keyPickupStates.value).toEqual([{ id: 'k1', x: 0, y: 0, collected: true }]);
    expect(collectedKeys.value).toBe(2);
  });

  it('resetGameProgress-clearsKeyPickupsAndCollectedKeys', () => {
    keyPickupStates.value = [{ id: 'k1', x: 0, y: 0, collected: true }];
    collectedKeys.value = 2;
    resetGameProgress();
    expect(keyPickupStates.value).toEqual([]);
    expect(collectedKeys.value).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PlatformerState.test.ts`
Expected: FAIL — `keyPickupStates`/`collectedKeys` don't exist yet.

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/PlatformerState.ts`. Add the import:

```typescript
import type { KeyPickupState } from './entities/KeyPickup';
```

Add, near `bonusFruitStates`'s declaration (after it, same section):

```typescript
/**
 * Dropped-key pickups (one per purple-slime finishing stomp) — starts empty.
 * Collected entries stay in this array flagged `collected: true` rather than
 * being removed (see entities/KeyPickup.ts's doc comment: this is what lets
 * PlatformerPage.tsx's defeat handler tell whether a given purple slime has
 * already paid out its key across a death/respawn). Persists across a
 * death/respawn (resetGame()), same as blockStates/bonusFruitStates — cleared
 * only by resetGameProgress().
 */
export const keyPickupStates = signal<KeyPickupState[]>([]);

/**
 * Count of keys currently held, spent one at a time to open a chest
 * (spec.md FR-020e/FR-023). Persists across a death/respawn, same as
 * keyPickupStates above — cleared only by resetGameProgress().
 */
export const collectedKeys = signal<number>(0);
```

Then in `resetGameProgress()`, add two lines (anywhere after the existing `bonusFruitStates.value = [];` line, before the function's closing brace):

```typescript
  keyPickupStates.value = [];
  collectedKeys.value = 0;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PlatformerState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): add keyPickupStates/collectedKeys signals"
```

---

### Task 7: `Renderer.ts` — draw key pickups, HUD key counter, per-type enemy draw size

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `KeyPickupState`, `KEY_RENDERED_WIDTH`, `KEY_RENDERED_HEIGHT` (Task 1); `enemyRenderedSize`, `enemyTileOffsetX`, `enemyTileOffsetY` (Task 2); `coinBobOffset` (existing, from `../entities/Coin`).
- Produces: `drawKeyPickups(ctx, pickups: readonly KeyPickupState[], keySprite: HTMLImageElement | null, elapsedSeconds: number, originX?, originY?): void`. `drawKeyCounter(ctx, keySprite: HTMLImageElement, count: number, x: number, y: number): void` (only ever called by `PlatformerPage.tsx` when `count > 0` — the function itself doesn't gate on count, matching `drawChestCounter`'s convention of the CALLER deciding whether to call it). `KEY_COUNTER_X`/`KEY_COUNTER_Y` exported constants, positioned to the right of `CHEST_COUNTER_X`/`Y` on the same HUD row. `drawEnemies` now looks up each enemy's own rendered size/offsets instead of the flat constants.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/engine/Renderer.test.ts
import { drawKeyPickups, drawKeyCounter, KEY_COUNTER_X, KEY_COUNTER_Y } from './Renderer';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT, KEY_RENDERED_WIDTH, KEY_RENDERED_HEIGHT } from '../entities/KeyPickup';
import type { KeyPickupState } from '../entities/KeyPickup';

describe('drawKeyPickups', () => {
  it('drawKeyPickups-uncollectedPickup-drawsKeySprite', () => {
    const ctx = makeMockContext();
    const fakeKeySprite = {} as HTMLImageElement;
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: false }];
    drawKeyPickups(ctx, pickups, fakeKeySprite, 0);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeKeySprite,
      0, 0, KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT,
      expect.any(Number), expect.any(Number),
      KEY_RENDERED_WIDTH, KEY_RENDERED_HEIGHT,
    );
  });

  it('drawKeyPickups-collectedPickup-doesNotDraw', () => {
    const ctx = makeMockContext();
    const fakeKeySprite = {} as HTMLImageElement;
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: true }];
    drawKeyPickups(ctx, pickups, fakeKeySprite, 0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawKeyCounter', () => {
  it('drawKeyCounter-drawsIconAndCountText', () => {
    const ctx = makeMockContext();
    const fakeKeySprite = {} as HTMLImageElement;
    drawKeyCounter(ctx, fakeKeySprite, 3, KEY_COUNTER_X, KEY_COUNTER_Y);
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('3', expect.any(Number), KEY_COUNTER_Y);
  });
});
```

(`makeMockContext` is this test file's existing shared helper — reuse it, do not redefine.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Renderer.test.ts`
Expected: FAIL — `drawKeyPickups`/`drawKeyCounter`/`KEY_COUNTER_X`/`KEY_COUNTER_Y` don't exist.

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/engine/Renderer.ts`. Add imports near the existing `Coin.ts`/`Chest.ts` imports:

```typescript
import { coinBobOffset } from '../entities/Coin';
import type { KeyPickupState } from '../entities/KeyPickup';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT, KEY_RENDERED_WIDTH, KEY_RENDERED_HEIGHT } from '../entities/KeyPickup';
import { enemyRenderedSize, enemyTileOffsetX, enemyTileOffsetY } from '../entities/Enemy';
```

(`coinBobOffset` is very likely already imported for `drawCollectibles` — check the existing import from `../entities/Coin` and add `coinBobOffset` to it instead of a second import line if so.)

Add, near `drawCollectibles` (after it):

```typescript
/**
 * Draws every not-yet-collected key pickup, bobbing exactly like a coin
 * (shares Coin.ts's coinBobOffset — bobbing isn't coin-specific, same
 * convention drawCollectibles's fruit already follows).
 */
export function drawKeyPickups(
  ctx: CanvasRenderingContext2D,
  pickups: readonly KeyPickupState[],
  keySprite: HTMLImageElement | null,
  elapsedSeconds: number,
  originX = 0,
  originY = 0,
): void {
  if (!keySprite) return;
  ctx.imageSmoothingEnabled = false;
  const bob = coinBobOffset(elapsedSeconds);
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    ctx.drawImage(
      keySprite,
      0,
      0,
      KEY_FRAME_WIDTH,
      KEY_FRAME_HEIGHT,
      pickup.x + originX,
      pickup.y + originY + bob,
      KEY_RENDERED_WIDTH,
      KEY_RENDERED_HEIGHT,
    );
  }
}
```

Change `drawEnemies`'s body — replace every use of `ENEMY_RENDERED_SIZE`/`ENEMY_TILE_OFFSET_X`/`ENEMY_TILE_OFFSET_Y` with per-enemy lookups:

```typescript
  for (const enemy of enemies) {
    const sprite = enemy.spriteType === 'slimeGreen' ? slimeGreenSprite : slimePurpleSprite;
    if (!sprite) continue;

    const { sx, sy } = enemyFrameSource(enemy.animState, enemy.animFrame);
    const size = enemyRenderedSize(enemy.spriteType);
    const dx = enemy.x + enemyTileOffsetX(enemy.spriteType) + originX;
    const dy = enemy.y + enemyTileOffsetY(enemy.spriteType) + originY;

    if (enemy.direction === 'left') {
      ctx.save();
      ctx.translate(dx + size, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, sx, sy, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 0, 0, size, size);
      ctx.restore();
      continue;
    }

    ctx.drawImage(sprite, sx, sy, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, dx, dy, size, size);
  }
```

Add, near `CHEST_COUNTER_X`/`Y`/`drawChestCounter` (after `drawChestCounter`'s closing brace):

```typescript
/** Horizontal screen position for the key counter — placed just to the right
 *  of the chest counter, same HUD row. Only ever drawn by the caller when
 *  collectedKeys > 0 (see PlatformerPage.tsx) — this constant is a fixed
 *  layout position, not conditional itself. */
export const KEY_COUNTER_X = CHEST_COUNTER_X + 120;
export const KEY_COUNTER_Y = CHEST_COUNTER_Y;

const KEY_COUNTER_ICON_HEIGHT = 24;

/** Draws the "[key icon] N" HUD counter — no "/ total" denominator (unlike
 *  drawChestCounter): a key count has no fixed total to compare against, it
 *  just goes up and down as keys are found and spent. */
export function drawKeyCounter(
  ctx: CanvasRenderingContext2D,
  keySprite: HTMLImageElement,
  count: number,
  x: number,
  y: number,
): void {
  ctx.imageSmoothingEnabled = false;
  const iconHeight = KEY_COUNTER_ICON_HEIGHT;
  const iconWidth = (KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT) * iconHeight;
  ctx.drawImage(keySprite, 0, 0, KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT, x, y - iconHeight / 2, iconWidth, iconHeight);

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${count}`, x + iconWidth + CHEST_COUNTER_TEXT_GAP, y);
  ctx.restore();
}
```

(`RESTART_PROMPT_FONT_FAMILY` and `CHEST_COUNTER_TEXT_GAP` are already in scope in this file — reuse them, matching `drawChestCounter`'s own font/gap exactly for visual consistency.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Renderer.test.ts`
Expected: PASS — including any existing `drawEnemies` tests, which should still pass unchanged since green's `enemyRenderedSize`/offsets equal the old flat constants.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): draw key pickups, HUD key counter, per-type enemy size"
```

---

### Task 8: `PlatformerPage.tsx` — wire it all together

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes everything from Tasks 1–7: `keyPickupStates`, `collectedKeys` (from `./PlatformerState`), `spawnKeyPickup` (from `./entities/KeyPickup`), `checkKeyPickupCollisions` (from `./engine/Collision`), `drawKeyPickups`, `drawKeyCounter`, `KEY_COUNTER_X`, `KEY_COUNTER_Y` (from `./engine/Renderer`).

This task is integration glue across several existing blocks in one large component — each sub-step below is independently verifiable via the component test, but they land as one commit since they're one cohesive change to one game-loop tick function (splitting the tick function itself across commits would leave it in a broken intermediate state).

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/PlatformerPage.test.tsx
// (Follow this file's existing pattern for driving the game loop / reading
// canvas draw calls or exposed state — the exact harness already used by
// this file's other integration tests, e.g. its stomp-defeat or chest-open
// tests, should be reused here rather than reinvented. Two new cases:)

it('purpleSlimeDefeat-thirdStomp-spawnsKeyPickupInsteadOfJournalFact', () => {
  // Arrange a purple slime at 1 hit point (already stomped twice), stomp it
  // once more, advance past HIT_REACTION_DURATION_SECONDS, and assert:
  // - keyPickupStates.value gains one new uncollected entry at the enemy's
  //   former x/y
  // - collectedFacts.value is unchanged (no fact was added)
});

it('chestOpen-zeroKeys-doesNothing', () => {
  // Arrange collectedKeys.value = 0, player standing on a closed chest,
  // press Arrow Up. Assert chestStates.value is unchanged (still closed)
  // and collectedKeys.value is still 0.
});

it('chestOpen-atLeastOneKey-opensChestAndSpendsOneKey', () => {
  // Arrange collectedKeys.value = 1, player standing on a closed chest,
  // press Arrow Up. Assert the chest is now open and
  // collectedKeys.value === 0.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: FAIL — purple defeat currently just silently removes the enemy (no key spawned); chest opening is currently unconditional (opens regardless of `collectedKeys`).

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/PlatformerPage.tsx` in five places:

**(a) Imports** — add:

```typescript
import { keyPickupStates, collectedKeys } from './PlatformerState';
import { spawnKeyPickup } from './entities/KeyPickup';
import { checkKeyPickupCollisions } from './engine/Collision';
import { drawKeyPickups, drawKeyCounter, KEY_COUNTER_X, KEY_COUNTER_Y } from './engine/Renderer';
```

**(b) Sprite loading** — add a ref near the other `useRef<HTMLImageElement | null>(null)` declarations:

```typescript
  const keySpriteRef = useRef<HTMLImageElement | null>(null);
```

and a load call, mirroring `chest_closed.png`'s exactly, after the `chest_open.png` load block:

```typescript
    loadImage('/sprites/key.png')
      .then((img) => {
        if (cancelled) return;
        keySpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Key pickups simply won't render if the sprite fails to load; the
        // rest of the game still works (collision doesn't depend on the
        // sprite being loaded).
      });
```

**(c) Enemy defeat block** — replace the `justDefeated` loop's `if (!fact || newFacts.some(...)) continue;` line. Currently:

```typescript
          const fact = enemy.fact;
          if (!fact || newFacts.some((f) => f.id === fact.id)) continue;
          anyEnemyRewarded = true;
          newFacts.push(fact);
```

becomes:

```typescript
          if (enemy.spriteType === 'slimePurple') {
            const alreadyDropped = keyPickupStates.value.some((k) => k.id === enemy.id);
            if (!alreadyDropped) {
              keyPickupStates.value = [...keyPickupStates.value, spawnKeyPickup(enemy.id, enemy.x, enemy.y)];
            }
            continue;
          }
          const fact = enemy.fact;
          if (!fact || newFacts.some((f) => f.id === fact.id)) continue;
          anyEnemyRewarded = true;
          newFacts.push(fact);
```

(This sits inside the `for (const enemy of justDefeated)` loop, before the existing `formatJournalEntry(fact)` line — a purple slime now takes the new early-continue branch and never reaches the fact-flight code below it, which is correct: it has no fact/flight effect, it drops a key instead, handled separately.)

**(d) Key pickup collision check** — add a new block, near where `checkBonusFruitCollisions` is handled (same tick, same general area — collectible-collision checks). Follow the existing bonus-fruit-collection pattern:

```typescript
      const touchedKeyIds = checkKeyPickupCollisions(playerState.value, keyPickupStates.value);
      if (touchedKeyIds.length > 0) {
        keyPickupStates.value = keyPickupStates.value.map((k) =>
          touchedKeyIds.includes(k.id) ? { ...k, collected: true } : k,
        );
        collectedKeys.value += touchedKeyIds.length;
      }
```

**(e) Chest opening gate** — change:

```typescript
        if (standingChestId) {
          const chest = chestStates.value.find((c) => c.id === standingChestId)!;
          chestStates.value = chestStates.value.map((c) =>
            c.id === standingChestId ? openChest(c) : c,
          );
```

to:

```typescript
        if (standingChestId && collectedKeys.value > 0) {
          const chest = chestStates.value.find((c) => c.id === standingChestId)!;
          chestStates.value = chestStates.value.map((c) =>
            c.id === standingChestId ? openChest(c) : c,
          );
          collectedKeys.value -= 1;
```

(The rest of that `if` block's body — the fact-flight effect — stays exactly as-is, just now nested one level deeper inside the same `if`; make sure the closing braces still balance after this edit.)

**(f) Render calls** — add, in the render function, near the existing `drawCollectibles`/`drawEnemies` calls (same section, so key pickups draw in the same pass as everything else in the world):

```typescript
      drawKeyPickups(ctx, keyPickupStates.value, keySpriteRef.current, worldAnimElapsed, originX, originY);
```

and, near the existing `drawChestCounter` call (right after its closing `}`):

```typescript
      if (keySpriteRef.current && collectedKeys.value > 0) {
        drawKeyCounter(ctx, keySpriteRef.current, collectedKeys.value, KEY_COUNTER_X, KEY_COUNTER_Y);
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): wire purple-slime key drop and chest key-gating into the game loop"
```

---

### Task 9: `level.ts` — second purple slime marker

**Files:**
- Modify: `src/themes/platformer/level/level.ts`
- Test: `src/themes/platformer/level/level.test.ts`

**Interfaces:** none new — this only edits the hand-authored `LEVEL_1_LAYOUT` string array.

**Files:**
- Test: `src/themes/platformer/level/level.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/themes/platformer/level/level.test.ts
import { ENEMY_TILES_PURPLE, CHEST_TILES } from './level';

describe('purple slime count matches chest count', () => {
  it('purpleEnemyMarkerCount-equalsChestMarkerCount', () => {
    expect(ENEMY_TILES_PURPLE.value.length).toBe(CHEST_TILES.value.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- level.test.ts`
Expected: FAIL — currently 1 purple marker (`M`) vs. 2 chest markers (`T`).

- [ ] **Step 3: Write minimal implementation**

Edit `src/themes/platformer/level/level.ts`. In `LEVEL_1_LAYOUT`'s marker row (currently `'.S.1..T...C.T.....C.......W.E..W....W.M....C.C..................................'`), add a second `M` marker. Place it a few tiles after the existing one (col ~44, right after the existing `M` at col 39 and before the next `C` cluster at col 45/47), on the same row so it sits on solid ground — e.g. change:

```
'.S.1..T...C.T.....C.......W.E..W....W.M....C.C..................................',
```

to:

```
'.S.1..T...C.T.....C.......W.E..W....W.M.M..C.C..................................',
```

(Second `M` at col 41, two tiles right of the first — still on the flat rock-ground row, well clear of the existing wall/pit patrol test at cols 36-42 so it doesn't interfere with `EnemyAI.test.ts`'s or `level.test.ts`'s existing wall/pit patrol assertions for the FIRST purple slime.)

Update this file's marker-legend doc comment (the block above `LEVEL_1_LAYOUT`) to say two purple (`M`) markers instead of one, and that they now match the level's two chests one-for-one (each chest needs a key; the level's two purple slimes are what makes both chests completable).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- level.test.ts`
Expected: PASS. Also run the FULL suite once here (`npm test`) — this is the last code task, a good checkpoint to catch any cross-file regression before manual verification.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/level.ts src/themes/platformer/level/level.test.ts
git commit -m "feat(platformer): add second purple slime marker to match level's 2 chests"
```

---

### Task 10: Manual browser verification

Not a code change — run through spec.md's User Story 4/6 Independent Tests live:

1. Start the dev server, open the Platformer theme (unlock the `platformerPrototypeUnlocked` flag if needed, per existing dev workflow).
2. Confirm a purple slime is visibly bigger and patrols visibly slower than a green slime.
3. Stomp the purple slime 3 times — confirm it takes 3 stomps (not 2), and on the 3rd, a key appears on the ground and bobs in place (no journal fact, no flight-to-journal effect).
4. Walk away from the key without touching it — confirm it's still there.
5. Walk into the key — confirm it flies to a new HUD key counter (top HUD row, right of the chest counter) which increments to 1, and nothing was added to the journal.
6. Stand on a closed chest and press Arrow Up with 0 keys held (before collecting any) — confirm nothing happens.
7. With ≥1 key held, press Arrow Up on a chest — confirm it opens, the key counter decrements, and the Experience fact flies to the journal as before.
8. Trigger a death (fall in the pit) while holding an uncollected key on the ground and a nonzero `collectedKeys` count — confirm both survive the respawn (key still on ground if uncollected, counter unchanged).
9. Click Reset Game — confirm the key counter disappears (back to 0/hidden) and any dropped key pickups are gone.
10. Open the Level Editor (`/platformer/editor?debug=1` or however it's currently reached) — confirm the palette no longer shows a separate "Platform" tile (a separate, unplanned cleanup landing alongside this work — see the `platform` terrain tile removal) and that green/purple slime palette tiles still render correctly.

- [ ] Confirm all 10 checks pass, then check off roadmap step 30 in `specs/S-006-platformer-theme/roadmap.md` (`- [ ]` → `- [x]`).
