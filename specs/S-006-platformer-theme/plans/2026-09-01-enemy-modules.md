# Self-Contained Enemy Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each enemy type a single self-contained module owning its data, its mechanics, and its rendering, so that adding an enemy is one new file plus one registry line plus one sprite asset.

**Architecture:** A shared `Entity` base gives every world object the same positional shape and derived hitbox. Each enemy type becomes a module exporting an `EnemyType` object — numbers, lifecycle hooks, a `draw` function, and an `onPlayerCollide` hook that decides consequences from engine-computed contact geometry. `Renderer.ts` keeps only iteration and the camera transform; `Collision.ts` keeps only geometry. The spike mechanic ends up mentioned in exactly one file.

**Tech Stack:** TypeScript 5 (strict), React 19, `@preact/signals-react`, Vitest + React Testing Library + jsdom.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-01-entity-architecture-design.md`

**Prerequisite:** `specs/S-006-platformer-theme/plans/2026-09-01-entity-lifecycle.md` must be complete. This plan assumes `EnemyState.alive`, `EnemyState.rewardGiven`, `EnemyState.homeX/homeY`, and `reviveEnemy` already exist, and that `EnemyContact.contract.test.ts` exists and passes.

## Global Constraints

- TypeScript strict mode. No `any`, no `@ts-ignore`, no `@ts-expect-error` (constitution Principle I). Exactly one `as unknown as` cast is permitted, in the registry dispatcher defined in Task 2; it must carry the doc comment given there.
- Test-first for every task (constitution Principle II, NON-NEGOTIABLE).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies.
- Test command: `npm test`. Single file: `npx vitest run <path>`. Typecheck: `npx tsc -b --noEmit`.
- Vitest globals are enabled — `describe`, `it`, `expect`, `vi` need no imports.
- Named exports only.
- **No behavior change is intended by any task in this plan.** `EnemyContact.contract.test.ts` must keep passing with its expectations unmodified, except for the mechanical construction changes each task names explicitly.

## Model guidance

This plan is **mixed**. Task-level assignments are on each task heading below;
the reasoning is here.

**Opus for Tasks 2 and 4.** These are the two places where a plausible-looking
edit can typecheck and still be wrong:

- Task 2 combines a generic dispatcher holding the plan's one permitted cast, a
  module cycle that must be broken in a specific order, `Omit<BaseEnemyState,
  'type'>` construction, and a discriminated union crossing an existing
  `extends EnemyPlacement`. The failure modes are silent: widening the cast to
  `any`, or "resolving" the cycle by duplicating a constant so two modules
  disagree about the walk-frame count.
- Task 4 is the semantic core. `EnemyContact.contract.test.ts` pins the ten
  single-enemy cases, but the multi-contact aggregation rules are new behavior
  that no existing test covers.

**Sonnet 5 for Tasks 1, 3, and 5.** Task 1 is a `grep`-and-rename fully caught
by `tsc`. Task 5's design is fully specified and its outcome is objectively
verifiable by the `grep` containment check in its Step 5. Task 3 is the
borderline one — see its own note.

**On the "move this code verbatim" steps.** Tasks 2, 3, and 5 each relocate
existing code rather than reproducing it in this plan, because transcribing
~60 lines of canvas arithmetic (silhouette centering, spike overlay geometry)
into a plan invites drift between plan and source. The consequence is that the
implementer must actually open and read the source file rather than working
from the plan alone. Do not let a model paraphrase these blocks — the
instruction is *move*, and a diff that shows rewritten arithmetic instead of
relocated arithmetic should be rejected in review.

**Review.** Opus should review every task regardless of who implements it.
Tasks 3, 4, and 5 additionally require the browser verification in their own
steps — `Renderer.test.ts` asserts the structure of canvas calls, not the pixel
offsets, so a transcription error in Task 3 passes the suite and is visible
only on screen.

---

### Task 1: Shared entity base

**Model:** Sonnet 5 — grep-and-rename plus one new types file; `tsc` catches every missed site.

**Files:**
- Create: `src/themes/platformer/entities/Entity.ts`
- Create: `src/themes/platformer/entities/Entity.test.ts`
- Modify: `src/themes/platformer/types.ts` (`EnemyDef.spriteType` → `EnemyDef.type`)
- Modify: `src/themes/platformer/entities/Enemy.ts` (`EnemyState` extends the base)
- Modify: every file referencing `spriteType` (see Step 4)

**Interfaces:**
- Produces: `Direction`, `Rect`, `Entity`, `Damageable` from `entities/Entity.ts`. `EnemyDef.type` replaces `EnemyDef.spriteType`. `EnemyState` gains `vy: number`, always `0` for enemies.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/Entity.test.ts`:

```typescript
import { toEnemyState } from './Enemy';
import type { Entity, Damageable } from './Entity';
import type { EnemyPlacement } from '../level/EnemyMapper';

function makePlacement(): EnemyPlacement {
  return { id: 'enemy-test', type: 'slimeGreen', x: 320, y: 96 };
}

describe('Entity conformance', () => {
  it('enemyState-assignedToEntity-satisfiesTheSharedShape', () => {
    // A compile-time assertion with a runtime witness: if EnemyState stops
    // structurally satisfying Entity & Damageable, this file fails to compile.
    const enemy: Entity & Damageable = toEnemyState(makePlacement());
    expect(enemy.type).toBe('slimeGreen');
    expect(enemy.vx).toBe(0);
    expect(enemy.vy).toBe(0);
    expect(enemy.direction).toBe('right');
    expect(enemy.alive).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/Entity.test.ts`
Expected: FAIL — `Cannot find module './Entity'`.

- [ ] **Step 3: Write the base**

Create `src/themes/platformer/entities/Entity.ts`:

```typescript
/**
 * The shape every world object shares: where it is, how it is moving, which
 * way it faces, and where it is in its animation. Concrete families (enemies,
 * the player, blocks, chests, pickups) extend this and add their own fields.
 *
 * `type` is the key into that family's type registry — the module that owns
 * this object's numbers, mechanics, and rendering.
 *
 * Deliberately carries no `hitbox`/`spriteBox` FIELDS. Those are derived
 * functions of `type` + `x` + `y`: a stored box would be a second copy of the
 * position needing re-sync on every one of the ~60 position updates per
 * second, and a missed sync is a silent collision bug.
 */
export interface Entity {
  /** Key into this family's type registry. */
  type: string;
  /** Render-slot top-left in world pixels — NOT the hitbox corner. */
  x: number;
  y: number;
  /** Horizontal velocity in px/s. Positive is rightward. */
  vx: number;
  /** Vertical velocity in px/s. Positive is downward. Always 0 for enemies,
   *  which patrol along a single row (spec.md FR-019's patrol-only scope). */
  vy: number;
  direction: Direction;
  animState: string;
  animFrame: number;
  /** Seconds accumulated toward the next animation frame advance. */
  animTimer: number;
}

export type Direction = 'left' | 'right';

/** An axis-aligned box in world pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An entity that can be hurt and killed. */
export interface Damageable {
  hitPoints: number;
  /** False once dead. A dead entity stays in its array at its index for the
   *  whole session so per-instance progress survives a respawn. */
  alive: boolean;
}
```

- [ ] **Step 4: Rename `spriteType` to `type` and conform `EnemyState`**

Run: `grep -rn "spriteType" src/themes/platformer/`

Rename `spriteType` to `type` in every hit **for enemies only**. `CollectibleDef.spriteType` is a different field on a different type and must be left alone — check each hit before changing it.

Files expected to be affected: `types.ts` (`EnemyDef`), `entities/Enemy.ts`, `level/EnemyMapper.ts`, `engine/Collision.ts`, `engine/Renderer.ts`, `engine/EnemyAI.ts`, `PlatformerState.ts`, `PlatformerPage.tsx`, plus their test files and any editor file that places enemies.

In `entities/Enemy.ts`, make the state extend the base and add `vy`:

```typescript
import type { Entity, Damageable, Direction } from './Entity';

export interface EnemyState extends EnemyPlacement, Entity, Damageable {
  type: EnemyDef['type'];
  animState: EnemyAnimState;
  direction: Direction;
  // …existing fields unchanged: homeX, homeY, hitTimer, spiked, spikeTimer,
  // rewardGiven
}
```

Replace the local `EnemyDirection` type alias with `Direction` from `./Entity`, re-exporting it if other modules import `EnemyDirection`:

```typescript
export type { Direction as EnemyDirection } from './Entity';
```

In `toEnemyState`, add `vy: 0`. In `reviveEnemy`, add `vy: 0`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

Run: `npx tsc -b --noEmit`
Expected: no errors. A missed `spriteType` rename fails here.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): add shared Entity base and rename enemy spriteType to type"
```

---

### Task 2: Enemy type modules and registry

**Model:** Opus — the dispatcher cast, the module cycle, and the discriminated union all fail silently when done almost-right. See "Model guidance" above.

Moves every per-type number out of the parallel `Record` lookups into one module per type. Data only — no rendering, no hooks yet.

**Files:**
- Create: `src/themes/platformer/entities/enemies/EnemyAnimation.ts`
- Create: `src/themes/platformer/entities/enemies/EnemyType.ts`
- Create: `src/themes/platformer/entities/enemies/shared.ts`
- Create: `src/themes/platformer/entities/enemies/SlimeGreen.ts`
- Create: `src/themes/platformer/entities/enemies/SlimePurple.ts`
- Create: `src/themes/platformer/entities/enemies/index.ts`
- Create: `src/themes/platformer/entities/enemies/index.test.ts`
- Modify: `src/themes/platformer/entities/Enemy.ts` (size/offset/padding functions read the registry; delete the three `Record`s; animation config moves out)
- Test: `src/themes/platformer/entities/Enemy.test.ts`

**Interfaces:**
- Consumes: `Entity`, `Damageable`, `Rect` (Task 1).
- Produces: `EnemyType<S>` and `BaseEnemyState` from `enemies/EnemyType.ts`; `ENEMY_TYPES`, `EnemyTypeKey`, `EnemyState`, `typeOf` from `enemies/index.ts`; `EnemyAnimState`, `enemyFrameSource`, `ENEMY_FRAME_SIZE`, `walkAnimFrameCount`, `WALK_FRAME_DURATION` from `enemies/EnemyAnimation.ts`.

**Import direction — read before writing any file in this task.** The dependency
edge runs **one way**: `Enemy.ts` → `enemies/*`, never back. `enemies/shared.ts`
must not import from `../Enemy`, or the cycle
`Enemy.ts → enemies/index.ts → SlimeGreen.ts → shared.ts → Enemy.ts` forms and
`ENEMY_TYPES` is `undefined` at module-init time in whichever module loads
second. That is why Step 3a moves the animation config out of `Enemy.ts` into
`enemies/EnemyAnimation.ts` **before** anything else in this task.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/enemies/index.test.ts`:

```typescript
import { ENEMY_TYPES, typeOf } from './index';
import { toEnemyState } from '../Enemy';
import { RENDER_SCALE } from '../../level/Terrain';
import type { EnemyPlacement } from '../../level/EnemyMapper';

describe('ENEMY_TYPES', () => {
  // These are the exact values the parallel Record lookups held before this
  // refactor. Asserting them explicitly is what makes this a pure data move
  // with no behavior risk.
  it('slimeGreen-matchesItsPreRefactorConstants', () => {
    expect(ENEMY_TYPES.slimeGreen).toMatchObject({
      maxHitPoints: 1,
      renderScale: 1,
      patrolSpeedMultiplier: 1,
      hitboxPaddingNative: { side: 5, top: 9 },
      heldItem: null,
    });
  });

  it('slimePurple-matchesItsPreRefactorConstants', () => {
    expect(ENEMY_TYPES.slimePurple).toMatchObject({
      maxHitPoints: 3,
      renderScale: 2,
      patrolSpeedMultiplier: 0.7,
      hitboxPaddingNative: { side: 5, top: 9 },
      heldItem: 'key',
    });
  });

  it('everyEntry-declaresItsOwnKey', () => {
    // Guards the dispatcher's cast: typeOf indexes ENEMY_TYPES by the state's
    // `type`, which is sound only while each module's key matches its slot.
    for (const [key, type] of Object.entries(ENEMY_TYPES)) {
      expect(type.key).toBe(key);
    }
  });
});

describe('typeOf', () => {
  it('purpleSlimeState-returnsThePurpleModule', () => {
    const placement: EnemyPlacement = { id: 'e', type: 'slimePurple', x: 0, y: 0 };
    expect(typeOf(toEnemyState(placement)).key).toBe('slimePurple');
  });
});

describe('enemy geometry from the registry', () => {
  it('purpleSlime-rendersAtTwiceGreensSize', () => {
    expect(ENEMY_TYPES.slimePurple.renderScale).toBe(2 * ENEMY_TYPES.slimeGreen.renderScale);
  });

  it('hitboxPadding-scalesWithRenderScaleAndRenderScaleConstant', () => {
    const purple = ENEMY_TYPES.slimePurple;
    expect(purple.hitboxPaddingNative.side * RENDER_SCALE * purple.renderScale).toBe(20);
    expect(purple.hitboxPaddingNative.top * RENDER_SCALE * purple.renderScale).toBe(36);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/enemies/index.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3a: Move the animation config out of `Enemy.ts` first**

Create `src/themes/platformer/entities/enemies/EnemyAnimation.ts` and move into
it, unchanged, from `entities/Enemy.ts`: `ENEMY_FRAME_SIZE`, `EnemyAnimState`,
the `FrameCoord` type, `WALK_FRAMES`, `ENEMY_ANIM_CONFIG`, and
`enemyFrameSource`, along with the file-header doc comment explaining the frame
choices. Add two exports the type modules need:

```typescript
/** Number of frames in the walk loop — used to stagger enemies' starting
 *  frames so they don't animate in lockstep. */
export function walkAnimFrameCount(): number {
  return ENEMY_ANIM_CONFIG.walk.frames.length;
}

export const WALK_FRAME_DURATION = ENEMY_ANIM_CONFIG.walk.frameDuration;
```

Re-export the moved names from `entities/Enemy.ts` so existing importers keep
working:

```typescript
export {
  ENEMY_FRAME_SIZE,
  enemyFrameSource,
  walkAnimFrameCount,
  WALK_FRAME_DURATION,
} from './enemies/EnemyAnimation';
export type { EnemyAnimState } from './enemies/EnemyAnimation';
```

`EnemyAnimation.ts` must import nothing from `../Enemy`. Verify before
continuing: `grep -n "from '\.\./Enemy'" src/themes/platformer/entities/enemies/`
returns nothing.

- [ ] **Step 3: Write the type contract**

Create `src/themes/platformer/entities/enemies/EnemyType.ts`:

```typescript
import type { Entity, Damageable } from '../Entity';
import type { EnemyPlacement } from '../../level/EnemyMapper';
import type { CollectedFact } from '../../types';
import type { EnemyAnimState } from './EnemyAnimation';

/** Item kinds an enemy type can drop on defeat. Grows as items are added. */
export type ItemKind = 'key';

/**
 * What every enemy has, regardless of type. Type-specific state (purple's
 * spike timer, for example) is declared by that type's own module, which
 * extends this — see SlimePurple.ts.
 */
export interface BaseEnemyState extends EnemyPlacement, Entity, Damageable {
  type: string;
  animState: EnemyAnimState;
  /** Placement position; `revive` restores x/y from these. */
  homeX: number;
  homeY: number;
  hitTimer: number;
  fact?: CollectedFact;
  /** True once this enemy's one reward has been handed out. Survives death
   *  and respawn; cleared only by resetGameProgress(). */
  rewardGiven: boolean;
}

/**
 * Everything the engine needs to know about one enemy type, owned entirely by
 * that type's own module. Adding an enemy means writing one of these and
 * adding one line to `enemies/index.ts` — nothing in Collision.ts,
 * Renderer.ts, EnemyAI.ts, or PlatformerPage.tsx needs to change.
 */
export interface EnemyType<S extends BaseEnemyState> {
  /** Must equal this module's slot in ENEMY_TYPES — see index.test.ts. */
  key: string;
  maxHitPoints: number;
  /** Multiplier on the 24px native frame's rendered size. */
  renderScale: number;
  patrolSpeedMultiplier: number;
  /** Transparent margin inside the native frame, in pre-scale pixels. */
  hitboxPaddingNative: { side: number; top: number };
  spriteAssetPath: string;
  /** What a finishing stomp drops, or null for a type that carries a CV fact
   *  instead. */
  heldItem: ItemKind | null;

  create(placement: EnemyPlacement, index: number): S;
  revive(enemy: S): S;
}
```

- [ ] **Step 4: Write the two type modules**

Create `src/themes/platformer/entities/enemies/SlimeGreen.ts`:

```typescript
import type { EnemyType, BaseEnemyState } from './EnemyType';
import { baseEnemyState, baseRevive } from './shared';

export interface SlimeGreenState extends BaseEnemyState {
  type: 'slimeGreen';
}

export const slimeGreen: EnemyType<SlimeGreenState> = {
  key: 'slimeGreen',
  maxHitPoints: 1,
  renderScale: 1,
  patrolSpeedMultiplier: 1,
  hitboxPaddingNative: { side: 5, top: 9 },
  spriteAssetPath: '/sprites/slime_green.png',
  heldItem: null,

  create: (placement, index) => ({
    ...baseEnemyState(placement, index, 1),
    type: 'slimeGreen',
  }),
  revive: (enemy) => ({ ...baseRevive(enemy, 1), type: 'slimeGreen' }),
};
```

Create `src/themes/platformer/entities/enemies/SlimePurple.ts`:

```typescript
import type { EnemyType, BaseEnemyState } from './EnemyType';
import { baseEnemyState, baseRevive } from './shared';

export interface SlimePurpleState extends BaseEnemyState {
  type: 'slimePurple';
}

export const slimePurple: EnemyType<SlimePurpleState> = {
  key: 'slimePurple',
  maxHitPoints: 3,
  // A purple slime reads as a distinctly bigger, slower, tougher variant of
  // the green one — twice the size, 70% of the patrol speed, three stomps.
  renderScale: 2,
  patrolSpeedMultiplier: 0.7,
  hitboxPaddingNative: { side: 5, top: 9 },
  spriteAssetPath: '/sprites/slime_purple.png',
  heldItem: 'key',

  create: (placement, index) => ({
    ...baseEnemyState(placement, index, 3),
    type: 'slimePurple',
  }),
  revive: (enemy) => ({ ...baseRevive(enemy, 3), type: 'slimePurple' }),
};
```

Create `src/themes/platformer/entities/enemies/shared.ts` holding the construction both modules reuse. Move the bodies of the existing `toEnemyState` and `reviveEnemy` here, parameterising hit points:

```typescript
import type { BaseEnemyState } from './EnemyType';
import type { EnemyPlacement } from '../../level/EnemyMapper';
// Imported from EnemyAnimation, NOT from ../Enemy — see this task's
// "Import direction" note. Importing ../Enemy here creates a module cycle.
import { walkAnimFrameCount, WALK_FRAME_DURATION } from './EnemyAnimation';

/**
 * The fields every enemy starts with. `index` offsets the starting walk frame
 * and timer so multiple enemies don't animate in perfect lockstep — each
 * enemy's frame advance is driven by its own dt-accumulated timer, not a
 * shared clock, so identical starts stay identical forever.
 */
export function baseEnemyState(
  placement: EnemyPlacement,
  index: number,
  maxHitPoints: number,
): Omit<BaseEnemyState, 'type'> {
  return {
    ...placement,
    homeX: placement.x,
    homeY: placement.y,
    vx: 0,
    vy: 0,
    direction: 'right',
    animState: 'walk',
    animFrame: index % walkAnimFrameCount(),
    animTimer: (index * 0.05) % WALK_FRAME_DURATION,
    hitPoints: maxHitPoints,
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    alive: true,
    rewardGiven: false,
  };
}

/** Resets an enemy to its spawn state, preserving `rewardGiven` — an enemy
 *  that already paid out revives as a normal killable obstacle with nothing
 *  left to give. */
export function baseRevive(
  enemy: BaseEnemyState,
  maxHitPoints: number,
): Omit<BaseEnemyState, 'type'> {
  return {
    ...enemy,
    x: enemy.homeX,
    y: enemy.homeY,
    vx: 0,
    vy: 0,
    direction: 'right',
    animState: 'walk',
    animFrame: 0,
    animTimer: 0,
    hitPoints: maxHitPoints,
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    alive: true,
  };
}
```

Export `walkAnimFrameCount()` (returning `ENEMY_ANIM_CONFIG.walk.frames.length`) and `WALK_FRAME_DURATION` from `entities/Enemy.ts` so `shared.ts` can reach the animation config without duplicating it. `spiked`/`spikeTimer` stay on the base for now; Task 5 moves them into `SlimePurpleState`.

- [ ] **Step 5: Write the registry and dispatcher**

Create `src/themes/platformer/entities/enemies/index.ts`:

```typescript
import { slimeGreen } from './SlimeGreen';
import { slimePurple } from './SlimePurple';
import type { SlimeGreenState } from './SlimeGreen';
import type { SlimePurpleState } from './SlimePurple';
import type { EnemyType, BaseEnemyState } from './EnemyType';

/** Every enemy type in the game. Adding an enemy is one line here plus its
 *  module plus its sprite asset — nothing else in the codebase changes. */
export const ENEMY_TYPES = { slimeGreen, slimePurple };

export type EnemyTypeKey = keyof typeof ENEMY_TYPES;
export type EnemyState = SlimeGreenState | SlimePurpleState;

/**
 * The module owning `enemy`.
 *
 * The cast is deliberate and is the single soundness hole in this design.
 * `ENEMY_TYPES` is heterogeneous — each entry is `EnemyType<its own state>` —
 * so TypeScript cannot prove that indexing it by `enemy.type` yields the entry
 * whose state parameter matches `enemy`. That invariant IS guaranteed, by each
 * module declaring its own `type` literal and its `key` identically, which
 * `index.test.ts` asserts for every entry. Confining the cast here is what
 * keeps "add an enemy" to one file plus one registry line; the alternative is
 * an exhaustive switch that grows a case per type in a shared file.
 */
export function typeOf<S extends BaseEnemyState>(enemy: S): EnemyType<S> {
  return ENEMY_TYPES[enemy.type as EnemyTypeKey] as unknown as EnemyType<S>;
}
```

- [ ] **Step 6: Point `Enemy.ts`'s geometry functions at the registry**

In `entities/Enemy.ts`, rewrite the five geometry functions to read the registry, and **delete** `ENEMY_RENDER_SCALE`, `ENEMY_PATROL_SPEED_MULTIPLIER`, `ENEMY_HIT_POINTS`, `ENEMY_HITBOX_SIDE_PADDING_NATIVE`, and `ENEMY_HITBOX_TOP_PADDING_NATIVE`:

```typescript
export function enemyRenderedSize(type: EnemyTypeKey): number {
  return ENEMY_FRAME_SIZE * RENDER_SCALE * ENEMY_TYPES[type].renderScale;
}

export function enemyTileOffsetX(type: EnemyTypeKey): number {
  return (RENDERED_TILE_SIZE - enemyRenderedSize(type)) / 2;
}

export function enemyTileOffsetY(type: EnemyTypeKey): number {
  return RENDERED_TILE_SIZE - enemyRenderedSize(type);
}

export function enemyHitboxSidePadding(type: EnemyTypeKey): number {
  const { hitboxPaddingNative, renderScale } = ENEMY_TYPES[type];
  return hitboxPaddingNative.side * RENDER_SCALE * renderScale;
}

export function enemyHitboxTopPadding(type: EnemyTypeKey): number {
  const { hitboxPaddingNative, renderScale } = ENEMY_TYPES[type];
  return hitboxPaddingNative.top * RENDER_SCALE * renderScale;
}
```

Replace `toEnemyState`'s body with construction via the registry, and delete `reviveEnemy`'s body in favour of the module hook:

```typescript
export function toEnemyState(placement: EnemyPlacement, index = 0): EnemyState {
  return ENEMY_TYPES[placement.type].create(placement, index);
}

export function reviveEnemy(enemy: EnemyState): EnemyState {
  return typeOf(enemy).revive(enemy);
}
```

**`EnemyState` now has one definition, not two.** Delete the `EnemyState`
interface from `entities/Enemy.ts` — it is superseded by the union in
`enemies/index.ts`, which is the only place a per-type state shape may be
added. `Enemy.ts` re-exports it so the ~40 existing `import type { EnemyState }
from './entities/Enemy'` sites keep compiling unchanged:

```typescript
export type { EnemyState } from './enemies';
```

Every field the old interface declared now lives on `BaseEnemyState` (shared)
or on a type module's own state interface (per-type). Nothing is lost; run
`npx tsc -b --noEmit` after this step to confirm no field went missing.

Update `Enemy.test.ts`: it imports `ENEMY_RENDER_SCALE`, `ENEMY_PATROL_SPEED_MULTIPLIER`, and `ENEMY_HIT_POINTS`, which no longer exist. Replace each with the corresponding `ENEMY_TYPES.<key>.<field>` read. The assertions themselves must not change — the values are identical by construction and `index.test.ts` Step 1 asserts exactly that.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, including `EnemyContact.contract.test.ts` unmodified.

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `grep -rn "ENEMY_RENDER_SCALE\|ENEMY_PATROL_SPEED_MULTIPLIER\|ENEMY_HIT_POINTS" src/`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): move per-enemy-type data into self-contained modules"
```

---

### Task 3: Rendering moves into the type modules

**Model:** Sonnet 5, with mandatory Opus review and the browser check in Step 7. This task RELOCATES ~60 lines of canvas arithmetic; a rewritten-from-memory version passes the suite and looks wrong only on screen.

**Files:**
- Create: `src/themes/platformer/engine/DrawContext.ts`
- Modify: `src/themes/platformer/entities/enemies/EnemyType.ts` (add `draw`)
- Modify: `src/themes/platformer/entities/enemies/SlimeGreen.ts`, `SlimePurple.ts`
- Create: `src/themes/platformer/entities/enemies/drawSpriteSheetEntity.ts`
- Modify: `src/themes/platformer/engine/Renderer.ts` (`drawEnemies` becomes a loop)
- Modify: `src/themes/platformer/PlatformerPage.tsx` (one sprite lookup replaces two refs)
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `ENEMY_TYPES`, `typeOf` (Task 2).
- Produces: `DrawContext` and `SpriteLookup` from `engine/DrawContext.ts`; `EnemyType.draw(enemy, dc)`. `drawEnemies(ctx, enemies, dc)` replaces the eight-positional-argument signature.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/engine/Renderer.test.ts`:

```typescript
describe('drawEnemies with type-owned rendering', () => {
  it('deadEnemy-drawsNothing', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    drawEnemies(ctx, [makeGreenEnemy({ alive: false })], dc);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('greenAndPurpleTogether-drawsEachFromItsOwnSheet', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    drawEnemies(ctx, [makeGreenEnemy(), makePurpleEnemy()], dc);
    expect(drawImageCallsFor(ctx, dc.sprites.slimeGreen)).toHaveLength(1);
    // Purple draws its sheet frame plus its held-key shine-through.
    expect(drawImageCallsFor(ctx, dc.sprites.slimePurple)).toHaveLength(1);
  });

  it('purpleThatAlreadyGaveItsReward-drawsNoHeldKey', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    drawEnemies(ctx, [makePurpleEnemy({ rewardGiven: true })], dc);
    expect(drawImageCallsFor(ctx, dc.sprites.key)).toHaveLength(0);
  });
});
```

Add a `makeDrawContext(ctx)` helper to that file building a `DrawContext` with distinct mock image objects per sprite key, so `drawImageCallsFor` can tell them apart. Reuse the file's existing mock-context and `drawImageCallsFor` helpers.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `makeDrawContext is not defined` / `drawEnemies` arity mismatch.

- [ ] **Step 3: Write the draw context**

Create `src/themes/platformer/engine/DrawContext.ts`:

```typescript
/** Loaded sprite images, keyed by the type key that declared the asset path.
 *  `key` is the shared dropped-item sprite, not an enemy type. */
export type SpriteLookup = Record<string, HTMLImageElement | null>;

/**
 * Everything a type's `draw` needs in order to render itself, so that drawing
 * logic can live in the type's own module without each module having to reach
 * for the camera or the sprite refs.
 *
 * Renderer.ts remains the only module that knows how the camera maps world
 * coordinates to canvas coordinates; a type only ever adds originX/originY to
 * its own world position.
 */
export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  sprites: SpriteLookup;
  /** World-to-canvas offset. */
  originX: number;
  originY: number;
  /** Seconds since the world started animating — drives bob and pulse. */
  worldElapsed: number;
}
```

- [ ] **Step 4: Write the shared blit helper and the two `draw` implementations**

Create `src/themes/platformer/entities/enemies/drawSpriteSheetEntity.ts` containing the plain sheet blit currently at the top of `drawEnemies`' loop body — source rect from `enemyFrameSource`, destination from `enemyTileOffsetX/Y` plus origin, `imageSmoothingEnabled = false`, and the horizontal mirror for `direction === 'left'`. Move that code; do not rewrite it.

```typescript
export function drawSpriteSheetEntity(enemy: BaseEnemyState, dc: DrawContext): void
```

Add `draw` to the `EnemyType` interface:

```typescript
  /** Renders this enemy. Owning rendering here is what lets a new enemy type
   *  ship as one file: Renderer.ts iterates and supplies the camera, and never
   *  branches on type. */
  draw(enemy: S, dc: DrawContext): void;
```

`SlimeGreen.draw` is the helper alone:

```typescript
  draw: (enemy, dc) => drawSpriteSheetEntity(enemy, dc),
```

`SlimePurple.draw` calls the helper, then draws the spike overlay and the held-key shine. Move both blocks verbatim out of `Renderer.ts`'s `drawEnemies`, including the `SPIKE_COLORS` palette (now a plain local constant in `SlimePurple.ts`, with the unreachable `slimeGreen` entry deleted) and the silhouette-centering arithmetic in the held-key block. Replace the gate:

```typescript
    const showsHeldKey = dc.sprites.key !== null && !enemy.rewardGiven;
```

- [ ] **Step 5: Reduce `drawEnemies` to a loop**

In `engine/Renderer.ts`:

```typescript
/** Draws every living enemy. Knows nothing about any specific enemy type —
 *  each one renders itself (see entities/enemies/). */
export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: readonly EnemyState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    typeOf(enemy).draw(enemy, dc);
  }
}
```

Delete `SPIKE_COLORS` and the `SPIKE_GROW/HOLD/RETRACT` imports from `Renderer.ts`.

In `PlatformerPage.tsx`, replace `slimeGreenSpriteRef` and `slimePurpleSpriteRef` with one lookup populated by iterating the registry:

```typescript
const enemySpritesRef = useRef<SpriteLookup>({});

useEffect(() => {
  for (const [key, type] of Object.entries(ENEMY_TYPES)) {
    loadImage(type.spriteAssetPath).then((img) => {
      enemySpritesRef.current[key] = img;
    });
  }
}, []);
```

Match the existing `loadImage` call convention in that file rather than inventing a new one. Build the `DrawContext` once per tick alongside the existing `originX`/`originY` computation, adding `key: keySpriteRef.current` to `sprites`, and pass it to `drawEnemies`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Verify in the browser**

Confirm visually against the pre-refactor look: green slime unchanged; purple slime at twice the size with its held-key shine-through; spikes appearing on a non-fatal stomp with the same grow/hold/retract timing and colours.

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): let each enemy type render itself"
```

---

### Task 4: Contact resolution

**Model:** Opus — the semantic core. The contract test pins ten single-enemy cases; the multi-contact aggregation rules are new behavior nothing else covers.

Collapses `checkEnemyStompCollisions`, `checkEnemySideCollisions`, and `isSpikedTopLanding` into one geometry function plus a per-type decision hook.

**Files:**
- Create: `src/themes/platformer/engine/Contact.ts`
- Modify: `src/themes/platformer/entities/enemies/EnemyType.ts` (add `onPlayerCollide`)
- Modify: `src/themes/platformer/entities/enemies/SlimeGreen.ts`, `SlimePurple.ts`
- Create: `src/themes/platformer/entities/enemies/stunnedGuard.ts`
- Modify: `src/themes/platformer/engine/Collision.ts` (delete three functions, add `resolveEnemyContacts`)
- Modify: `src/themes/platformer/PlatformerPage.tsx` (apply outcomes)
- Modify: `src/themes/platformer/engine/EnemyContact.contract.test.ts`
- Test: `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Consumes: `typeOf` (Task 2), `hitbox` geometry from `Collision.ts`.
- Produces: `ContactSide`, `Contact`, `CollisionOutcome<S>` from `engine/Contact.ts`; `resolveEnemyContacts(player, enemies): { enemies, damagePlayer, bouncePlayer, knockback }` from `Collision.ts`; `EnemyType.onPlayerCollide`.

- [ ] **Step 1: Rewrite the characterization test against the new surface**

In `EnemyContact.contract.test.ts`, keep `CONTACT_CASES` **byte-identical** and replace only the assertion body:

```typescript
describe('enemy contact characterization', () => {
  for (const testCase of CONTACT_CASES) {
    it(testCase.name, () => {
      const enemy = makeEnemy(testCase.enemy);
      const player = makePlayer(testCase.playerX, testCase.playerY, testCase.playerVy);

      const resolved = resolveEnemyContacts(player, [enemy]);
      const after = resolved.enemies[0];

      expect({
        stomped: after.hitPoints < enemy.hitPoints,
        damaged: resolved.damagePlayer > 0,
        spikedTopLanding: resolved.knockback === 'awayAndUp',
      }).toEqual(testCase.expected);
    });
  }
});
```

**The `expected` blocks must not be edited.** If a case fails, the new implementation has changed behavior and the implementation is what is wrong.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/EnemyContact.contract.test.ts`
Expected: FAIL — `resolveEnemyContacts is not exported`.

- [ ] **Step 3: Write the contact types**

Create `src/themes/platformer/engine/Contact.ts`:

```typescript
import type { Rect } from '../entities/Entity';

export type ContactSide = 'top' | 'side' | 'bottom';

/**
 * The geometry of one player-versus-entity overlap, computed once by the
 * engine and handed to the entity's type so it can decide what the contact
 * MEANS. The engine never decides consequences; the type never computes
 * geometry.
 */
export interface Contact {
  /** 'top' iff the player is falling AND its hitbox bottom edge is at or above
   *  the entity hitbox's vertical midpoint — the rule that distinguishes
   *  "jumped on" from "walked into". */
  side: ContactSide;
  playerVx: number;
  playerVy: number;
  playerBox: Rect;
  selfBox: Rect;
}

/**
 * What an entity asks the engine to do about a contact. Returned as data
 * rather than applied directly so the hook stays a pure function — no signals,
 * no canvas — and the engine remains the only writer of game state.
 *
 * Keep this small. It is the shared vocabulary of everything that can happen
 * in the world; if it grows past a handful of fields it has become the
 * scattered conditionals it replaced. Anything exotic goes through an
 * `onDefeat(entity, world)` style hook receiving a narrow WorldApi instead.
 */
export interface CollisionOutcome<S> {
  /** Replacement state, if the contact changed this entity. */
  self?: S;
  /** Half-hearts to deal to the player. The engine ignores this while the
   *  player is invincible; no entity ever knows invincibility exists. */
  damagePlayer?: number;
  bouncePlayer?: boolean;
  knockback?: 'none' | 'away' | 'awayAndUp';
}
```

- [ ] **Step 4: Write the two `onPlayerCollide` hooks**

Add to `EnemyType`:

```typescript
  /** Decides what a contact means for this type. The engine supplies the
   *  geometry; everything else — whether the top is safe to land on, whether
   *  a mechanic is currently active — is this module's business alone. */
  onPlayerCollide(enemy: S, player: PlayerState, contact: Contact): CollisionOutcome<S>;
```

Create `src/themes/platformer/entities/enemies/stunnedGuard.ts`:

```typescript
/**
 * True while an enemy is playing its hit reaction, during which it is harmless
 * in every way — not merely immune to a second stomp. Without this, bouncing
 * off a stomp while still overlapping the now-frozen enemy registers as a
 * spurious side-hit against the very enemy just stomped.
 *
 * A shared helper that type modules compose rather than an engine-level rule,
 * so a future enemy that IS dangerous while stunned simply doesn't call it —
 * no opt-out flag has to leak into the shared interface.
 */
export function isStunned(enemy: BaseEnemyState): boolean {
  return enemy.animState === 'hit';
}
```

`SlimeGreen.onPlayerCollide`:

```typescript
  onPlayerCollide: (enemy, _player, contact) => {
    if (isStunned(enemy) || enemy.hitPoints <= 0) return {};
    if (contact.side === 'top') return { self: takeHit(enemy), bouncePlayer: true };
    return { damagePlayer: 1, knockback: 'away' };
  },
```

`SlimePurple.onPlayerCollide`:

```typescript
  onPlayerCollide: (enemy, _player, contact) => {
    if (isStunned(enemy) || enemy.hitPoints <= 0) return {};
    if (enemy.spiked) {
      // A failed stomp should read as bouncing off the spikes, not as an
      // ordinary side touch.
      return { damagePlayer: 1, knockback: contact.side === 'top' ? 'awayAndUp' : 'away' };
    }
    if (contact.side === 'top') return { self: takeHit(enemy), bouncePlayer: true };
    return { damagePlayer: 1, knockback: 'away' };
  },
```

`takeHit` is the existing `applyStomp` from `entities/Enemy.ts`, generic over the state type:

```typescript
export function takeHit<S extends BaseEnemyState>(enemy: S): S
```

Move `applyStomp`'s body into it unchanged and re-export `applyStomp` as an alias until Task 5 removes the last caller.

- [ ] **Step 5: Write `resolveEnemyContacts` and delete the three old functions**

In `engine/Collision.ts`:

```typescript
export interface EnemyContactResult {
  /** The enemy array with every contacted enemy's returned `self` merged in.
   *  Enemies with no contact are returned unchanged, by reference. */
  enemies: EnemyState[];
  /** Half-hearts. The caller drops this while the player is invincible. */
  damagePlayer: number;
  bouncePlayer: boolean;
  knockback: 'none' | 'away' | 'awayAndUp';
}

/**
 * Computes contact geometry against every living enemy and asks each one's
 * type what the contact means, then aggregates.
 *
 * Aggregation rules, owned here and nowhere else: at most one damage applies
 * per tick regardless of how many enemies are touched; a bounce applies if any
 * outcome requests one; 'awayAndUp' wins over 'away', which wins over 'none'.
 */
export function resolveEnemyContacts(
  player: PlayerState,
  enemies: readonly EnemyState[],
): EnemyContactResult
```

Implement it as: compute `playerHitbox(player)` once; for each enemy, skip when `!enemy.alive`; compute `enemyHitbox(enemy)`; skip when `!aabbOverlap(...)`; derive `side` as `'top'` when `player.vy > 0 && playerBox.y + playerBox.height <= selfBox.y + selfBox.height / 2`, otherwise `'side'`; call `typeOf(enemy).onPlayerCollide(enemy, player, contact)`; merge.

Delete `checkEnemyStompCollisions`, `checkEnemySideCollisions`, and `isSpikedTopLanding`, and delete their tests from `Collision.test.ts` — `EnemyContact.contract.test.ts` now carries that coverage, which is why it was written first. Keep every non-enemy function in `Collision.test.ts` untouched.

- [ ] **Step 6: Apply outcomes in the game loop**

In `PlatformerPage.tsx`, replace the block that calls the three deleted functions with:

```typescript
const contacts = resolveEnemyContacts(playerState.value, enemyStates.value);
enemyStates.value = contacts.enemies;

if (contacts.bouncePlayer) {
  // existing stomp-bounce assignment, unchanged
}
if (contacts.damagePlayer > 0 && playerState.value.invincibleTimer <= 0) {
  // existing damage + knockback assignment, unchanged;
  // contacts.knockback === 'awayAndUp' selects the upward component that
  // isSpikedTopLanding used to select.
}
```

Preserve the existing bounce, damage, knockback, and invincibility assignments exactly — only their trigger conditions change.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/EnemyContact.contract.test.ts`
Expected: PASS, all 10 cases, `expected` blocks unmodified.

Run: `npm test` and `npx tsc -b --noEmit`
Expected: PASS, no errors.

- [ ] **Step 8: Verify in the browser**

Stomp a green slime; walk into one; jump onto a spiked purple slime and confirm the upward bounce-off; walk into a spiked purple slime's side and confirm plain horizontal knockback; confirm a freshly stomped slime does not damage the player during its reaction.

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): let enemy types decide collision consequences"
```

---

### Task 5: The spike mechanic moves into `SlimePurple.ts`

**Model:** Sonnet 5 — fully specified, and Step 5's grep containment check verifies the outcome objectively.

**Files:**
- Modify: `src/themes/platformer/entities/enemies/EnemyType.ts` (add `onTick`, drop `spiked`/`spikeTimer` from `BaseEnemyState`)
- Modify: `src/themes/platformer/entities/enemies/SlimePurple.ts`, `SlimeGreen.ts`, `shared.ts`
- Modify: `src/themes/platformer/engine/EnemyAI.ts` (delete spike constants and `stepEnemySpikeCooldown`)
- Modify: `src/themes/platformer/PlatformerPage.tsx` (per-tick step calls `onTick`)
- Test: `src/themes/platformer/engine/EnemyAI.test.ts`, `src/themes/platformer/entities/enemies/SlimePurple.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: `SlimePurpleState` gains `spiked: boolean` and `spikeTimer: number`; `BaseEnemyState` loses both. `EnemyType.onTick?(enemy, dt): S`.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/enemies/SlimePurple.test.ts`, moving every spike test out of `EnemyAI.test.ts` and rewriting them against `slimePurple.onTick` and `slimePurple.onPlayerCollide` rather than `stepEnemySpikeCooldown`. Preserve each test's timing values and expectations exactly; only the function under test changes.

Add one new test proving containment:

```typescript
it('greenSlimeState-hasNoSpikeFields', () => {
  // The mechanic is purple's alone. If spiked ever reappears on the shared
  // base, this stops compiling.
  const green = ENEMY_TYPES.slimeGreen.create({ id: 'g', type: 'slimeGreen', x: 0, y: 0 }, 0);
  expect('spiked' in green).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/enemies/SlimePurple.test.ts`
Expected: FAIL — `'spiked' in green` is `true`; the field is still on the base.

- [ ] **Step 3: Move the fields and the logic**

Remove `spiked` and `spikeTimer` from `BaseEnemyState` and from `shared.ts`'s `baseEnemyState`/`baseRevive`. Add them to `SlimePurpleState`:

```typescript
export interface SlimePurpleState extends BaseEnemyState {
  type: 'slimePurple';
  /** True while this slime's top is spiked and un-stompable — set by a
   *  non-fatal stomp, cleared by `onTick` once the cooldown elapses. */
  spiked: boolean;
  /** Seconds since `spiked` was last set. Meaningless while `spiked` is false. */
  spikeTimer: number;
}
```

Move `SPIKE_GROW_DURATION_SECONDS`, `SPIKE_HOLD_DURATION_SECONDS`, `SPIKE_RETRACT_DURATION_SECONDS`, and `SPIKE_COOLDOWN_DURATION_SECONDS` from `EnemyAI.ts` into `SlimePurple.ts`, and move `stepEnemySpikeCooldown`'s body into:

```typescript
  onTick: (enemy, dt) => {
    if (!enemy.spiked) return enemy;
    const spikeTimer = enemy.spikeTimer + dt;
    if (spikeTimer < SPIKE_COOLDOWN_DURATION_SECONDS) return { ...enemy, spikeTimer };
    return { ...enemy, spiked: false, spikeTimer: 0 };
  },
```

Set the spikes in purple's own `onPlayerCollide`, replacing the `takeHit` call on the stomp branch:

```typescript
    if (contact.side === 'top') {
      const hit = takeHit(enemy);
      // Surviving a stomp grows spikes that make the top un-stompable until
      // they retract. A fresh stomp always restarts the cooldown.
      return { self: { ...hit, spiked: hit.hitPoints > 0, spikeTimer: 0 }, bouncePlayer: true };
    }
```

Remove the `spiked` assignment from `takeHit` in `entities/Enemy.ts` and delete the `applyStomp` alias along with its last callers.

Add `onTick` to the `EnemyType` interface as optional, and in `PlatformerPage.tsx` replace the `stepEnemySpikeCooldown` call in the per-tick chain with `typeOf(enemy).onTick?.(enemy, dt) ?? enemy`.

Delete `stepEnemySpikeCooldown` and the four spike constants from `EnemyAI.ts`, along with their now-moved tests.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test` and `npx tsc -b --noEmit`
Expected: PASS, no errors, `EnemyContact.contract.test.ts` still green with unmodified expectations.

- [ ] **Step 5: Verify containment**

Run: `grep -rln "spike\|Spike" src/themes/platformer/ | grep -v test`
Expected: exactly one file — `src/themes/platformer/entities/enemies/SlimePurple.ts`.

- [ ] **Step 6: Verify in the browser**

Stomp the purple slime and confirm spikes grow, hold, and retract with the same timing and colours as before; confirm the top is un-stompable while spiked and stompable again once retracted.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): contain the spike mechanic in the purple slime module"
```

---

## Done criteria

- `grep -rln "spike" src/themes/platformer/ | grep -v test` returns only `SlimePurple.ts`.
- `Renderer.ts`, `Collision.ts`, `EnemyAI.ts`, and `PlatformerPage.tsx` contain no literal `'slimeGreen'` or `'slimePurple'`.
- `EnemyContact.contract.test.ts`'s `expected` blocks are byte-identical to the ones committed in the lifecycle plan.
- `npm test` and `npx tsc -b --noEmit` pass.
- Adding a third enemy type would require: one new module, one line in `enemies/index.ts`, one sprite asset.

## Next

Plan 3 — items, blocks, chests, then the player — is written via
`superpowers:writing-plans` once this plan lands, against the shapes it
actually produced (`DrawContext`, `CollisionOutcome`, `typeOf`) rather than
against predicted ones.
