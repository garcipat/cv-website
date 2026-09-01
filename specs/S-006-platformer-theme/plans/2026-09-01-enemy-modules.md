# Self-Contained Enemy Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each enemy type a single self-contained module owning its data, its mechanics, and its rendering, so that adding an enemy is one new file plus one registry line plus one sprite asset.

**Architecture:** A shared `Entity` base gives every world object the same positional shape. Sprites are described as sheets — a group of frames addressed by index — that a type points into, with a loader that discovers assets from the type registries rather than from a hand-maintained list. Each enemy type becomes a module exporting an `EnemyType` object: numbers, lifecycle hooks, a `draw` function, and an `onPlayerCollide` hook that decides consequences from engine-computed contact geometry. `Renderer.ts` keeps only iteration and the camera transform; `Collision.ts` keeps only geometry. The spike mechanic ends up mentioned in exactly one file.

**Tech Stack:** TypeScript 5 (strict), React 19, `@preact/signals-react`, Vitest + React Testing Library + jsdom.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-01-entity-architecture-design.md`

**Prerequisite:** `specs/S-006-platformer-theme/plans/2026-09-01-entity-lifecycle.md` is complete. This plan assumes `EnemyState.alive`, `EnemyState.rewardGiven`, `EnemyState.homeX/homeY`, and `reviveEnemy` exist, and that `EnemyContact.contract.test.ts` exists and passes.

## Global Constraints

- TypeScript strict mode. No `any`, no `@ts-ignore`, no `@ts-expect-error`. Exactly one `as unknown as` cast is permitted, in the registry dispatcher defined in Task 3; it must carry the doc comment given there.
- Test-first for every task (constitution Principle II, NON-NEGOTIABLE).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies.
- Test command: `npm test`. Single file: `npx vitest run <path>`. Typecheck: `npx tsc -b --noEmit`.
- Vitest globals are enabled — `describe`, `it`, `expect`, `vi` need no imports.
- Named exports only.
- Doc comments describe the current state. No history trails, no references to plans or task numbers.
- **No behavior change is intended by any task in this plan.** `EnemyContact.contract.test.ts` must keep passing with its `expected` blocks unmodified, except for the mechanical construction changes each task names explicitly.

## Reference values

The two slime sheets are 96×72: a 4-column, 3-row grid of 24×24 frames, addressed by index left-to-right then top-to-bottom (index 0 is top-left).

| Animation | Current coordinate list | Equivalent frame indices |
|---|---|---|
| `walk` | `{72,0}, {0,24}, {24,24}, {48,24}, {72,24}` | `[3, 4, 5, 6, 7]` |
| `hit` | `{0,48}, {24,48}, {48,48}, {72,48}` | `[8, 9, 10, 11]` |

Index → source rect: `sx = (index % columns) * frameWidth`, `sy = Math.floor(index / columns) * frameHeight`.

## Model guidance

This plan is **mixed**. Task-level assignments are on each task heading; the reasoning is here.

**Opus for Tasks 3 and 5.** These are the two places where a plausible-looking edit can typecheck and still be wrong:

- Task 3 combines a generic dispatcher holding the plan's one permitted cast, a module cycle that must be broken in a specific order, `Omit<BaseEnemyState, 'type'>` construction, and a discriminated union crossing an existing `extends EnemyPlacement`. The failure modes are silent: widening the cast to `any`, or "resolving" the cycle by duplicating a constant so two modules disagree about the walk-frame count.
- Task 5 is the semantic core. `EnemyContact.contract.test.ts` pins the ten single-enemy cases, but the multi-contact aggregation rules are new behavior that no existing test covers.

**Sonnet 5 for Tasks 1, 2, 4 and 6.** Task 1 is a selective rename fully caught by `tsc` plus review. Task 2 is new, self-contained code with an exact equivalence test. Task 6's design is fully specified and its outcome is objectively verifiable by the `grep` containment check in its Step 5. Task 4 is the borderline one — see its own note.

**On the "move this code verbatim" steps.** Tasks 3, 4 and 6 relocate existing code rather than reproducing it here, because transcribing ~60 lines of canvas arithmetic (silhouette centering, spike overlay geometry) into a plan invites drift between plan and source. The implementer must therefore open and read the source rather than working from the plan alone. Do not let a model paraphrase these blocks — the instruction is *move*, and a diff showing rewritten arithmetic instead of relocated arithmetic should be rejected in review.

**Review.** Opus should review every task. Tasks 4, 5 and 6 additionally require the browser verification in their own steps — `Renderer.test.ts` asserts the structure of canvas calls, not pixel offsets, so a transcription error in Task 4 passes the suite and is visible only on screen.

---

### Task 1: Shared entity base

**Model:** Sonnet 5 — a selective rename plus one new types file.

**Files:**
- Create: `src/themes/platformer/entities/Entity.ts`
- Create: `src/themes/platformer/entities/Entity.test.ts`
- Modify: `src/themes/platformer/types.ts` (`EnemyDef.spriteType` → `EnemyDef.type`)
- Modify: `src/themes/platformer/entities/Enemy.ts`
- Modify: every file referencing the ENEMY `spriteType` (see Step 4)

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

- [ ] **Step 4: Rename the ENEMY `spriteType` to `type` — selectively**

**`spriteType` is two unrelated fields.** `EnemyDef.spriteType` (`'slimeGreen' | 'slimePurple'`) is what you are renaming. `CollectibleDef.spriteType` (`'coin' | 'fruit'`) is a different field on a different type and **must not be touched**. `tsc` will NOT catch a mistake here — a consistent over-rename of collectibles compiles and runs correctly while silently expanding scope. Only a partial rename fails to build. Check every hit before changing it.

Files containing ENEMY `spriteType` (rename):
`types.ts`, `entities/Enemy.ts`, `entities/Enemy.test.ts`, `engine/Collision.ts`, `engine/Collision.test.ts`, `engine/DebugOverlay.ts`, `engine/DebugOverlay.test.ts`, `engine/EnemyAI.ts`, `engine/EnemyAI.test.ts`, `engine/EnemyContact.contract.test.ts`, `engine/Renderer.test.ts`, `level/EnemyMapper.ts`, `level/EnemyMapper.test.ts`, `PlatformerPage.tsx`, `PlatformerPage.test.tsx`, `PlatformerState.ts`, `PlatformerState.test.ts`, `editor/gridRenderState.test.ts`, `editor/EditorCanvas.test.tsx`.

Files containing only COLLECTIBLE `spriteType` (leave entirely alone):
`components/Journal.tsx`, `components/Journal.test.tsx`, `level/CollectibleMapper.ts`, `level/CollectibleMapper.test.ts`.

Files containing BOTH — edit selectively:
- `engine/Renderer.ts`: line ~554 (`placement.spriteType === 'coin'`) is collectible, keep. Lines ~677-683 are enemy, rename.
- `editor/gridRenderState.ts`: line ~96 (`spriteType: 'coin'`) is collectible, keep. Lines ~107/112 (`EnemyPlacement['spriteType']`) are enemy, rename.

Then make the state extend the base, in `entities/Enemy.ts`:

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

Replace the local `EnemyDirection` alias with `Direction`, re-exporting it so existing importers keep working:

```typescript
export type { Direction as EnemyDirection } from './Entity';
```

Add `vy: 0` to `toEnemyState` and to `reviveEnemy`.

**`EnemyContact.contract.test.ts` needs `vy: 0` added to its `makeEnemy` defaults** — `vy` is a new required field and that helper builds a complete `EnemyState`. That file is a characterization test whose `expected` blocks pin current game behavior for Task 5. Add the field and rename its `spriteType` key; **change nothing else there, and never an `expected` block.**

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `grep -rn "spriteType" src/themes/platformer/`
Expected: only collectible hits remain — `Journal.tsx`, `Journal.test.tsx`, `CollectibleMapper.ts`, `CollectibleMapper.test.ts`, `Renderer.ts` (~554), `gridRenderState.ts` (~96), and their tests. Any enemy hit surviving is a miss.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): add shared Entity base and rename enemy spriteType to type"
```

---

### Task 2: Sprite sheets, descriptors, and the discovering loader

**Model:** Sonnet 5 — new self-contained code with an exact-equivalence test pinning it.

Replaces four unrelated sprite idioms with one. This task builds the mechanism and proves it reproduces today's enemy frame coordinates exactly; Task 4 switches rendering onto it.

**Files:**
- Create: `src/themes/platformer/entities/sprites/SpriteSheet.ts`
- Create: `src/themes/platformer/entities/sprites/SpriteSheet.test.ts`
- Create: `src/themes/platformer/entities/sprites/sheets.ts`

**Interfaces:**
- Produces: `SpriteSheet`, `SpriteDescriptor`, `frameSource(sheet, index)`, `SpriteLookup`, `collectSheetSources(descriptors)` from `entities/sprites/SpriteSheet.ts`; the sheet constants from `entities/sprites/sheets.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/sprites/SpriteSheet.test.ts`:

```typescript
import { frameSource, collectSheetSources } from './SpriteSheet';
import type { SpriteDescriptor } from './SpriteSheet';
import { SLIME_GREEN_SHEET, SLIME_PURPLE_SHEET } from './sheets';

describe('frameSource', () => {
  it('indexZero-returnsTopLeftFrame', () => {
    expect(frameSource(SLIME_GREEN_SHEET, 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('indexAtColumnCount-wrapsToTheNextRow', () => {
    // 4 columns of 24px: index 4 is row 1, column 0.
    expect(frameSource(SLIME_GREEN_SHEET, 4)).toEqual({ sx: 0, sy: 24 });
  });

  it('lastIndexOfTheSheet-returnsBottomRightFrame', () => {
    expect(frameSource(SLIME_GREEN_SHEET, 11)).toEqual({ sx: 72, sy: 48 });
  });
});

describe('frameSource equivalence with the existing coordinate lists', () => {
  // The walk loop deliberately crosses a sheet row boundary, so this
  // conversion from hand-written sx/sy pairs to frame indices is the one place
  // it could silently drift. These are the exact coordinates the renderer
  // draws today.
  it('walkFrameIndices-matchTodaysWalkCoordinates', () => {
    const expected = [
      { sx: 72, sy: 0 },
      { sx: 0, sy: 24 },
      { sx: 24, sy: 24 },
      { sx: 48, sy: 24 },
      { sx: 72, sy: 24 },
    ];
    expect([3, 4, 5, 6, 7].map((i) => frameSource(SLIME_GREEN_SHEET, i))).toEqual(expected);
  });

  it('hitFrameIndices-matchTodaysHitCoordinates', () => {
    const expected = [
      { sx: 0, sy: 48 },
      { sx: 24, sy: 48 },
      { sx: 48, sy: 48 },
      { sx: 72, sy: 48 },
    ];
    expect([8, 9, 10, 11].map((i) => frameSource(SLIME_GREEN_SHEET, i))).toEqual(expected);
  });
});

describe('collectSheetSources', () => {
  it('descriptorsSharingASheet-yieldThatSourceOnce', () => {
    const a: SpriteDescriptor = {
      sheet: SLIME_GREEN_SHEET,
      renderScale: 1,
      animations: { walk: { frames: [3], frameDuration: 0.15 } },
    };
    const b: SpriteDescriptor = { ...a };
    expect(collectSheetSources([a, b])).toEqual([SLIME_GREEN_SHEET.src]);
  });

  it('descriptorsWithDistinctSheets-yieldEverySourceOnce', () => {
    const green: SpriteDescriptor = {
      sheet: SLIME_GREEN_SHEET,
      renderScale: 1,
      animations: { walk: { frames: [3], frameDuration: 0.15 } },
    };
    const purple: SpriteDescriptor = { ...green, sheet: SLIME_PURPLE_SHEET };
    expect(collectSheetSources([green, purple]).sort()).toEqual(
      [SLIME_GREEN_SHEET.src, SLIME_PURPLE_SHEET.src].sort(),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/sprites/SpriteSheet.test.ts`
Expected: FAIL — `Cannot find module './SpriteSheet'`.

- [ ] **Step 3: Write the sprite model**

Create `src/themes/platformer/entities/sprites/SpriteSheet.ts`:

```typescript
/**
 * A group of frames sharing one image. One sheet backs however many things
 * draw from it — `world_tileset.png` serves terrain, crates, question-mark
 * blocks and fragile rocks at once — so a sheet is the unit of loading, not the
 * entity that happens to use it.
 *
 * A standalone single image is a one-frame sheet (`columns: 1`, frame size =
 * image size), which is why chests and dropped keys need no separate drawing
 * path.
 */
export interface SpriteSheet {
  src: string;
  frameWidth: number;
  frameHeight: number;
  /** Frames are addressed by index, read left-to-right then top-to-bottom;
   *  `columns` is what turns an index into a source rect. */
  columns: number;
}

/**
 * Which sheet a type draws from, at what scale, and which frames make up each
 * of its animations. Frames are INDICES into the sheet rather than sx/sy pairs,
 * so an animation spanning a row boundary — the enemy walk loop does — is just
 * a contiguous range.
 */
export interface SpriteDescriptor {
  sheet: SpriteSheet;
  /** Multiplier on the frame's rendered size, on top of RENDER_SCALE. */
  renderScale: number;
  animations: Record<string, { frames: number[]; frameDuration: number }>;
}

/** Loaded images keyed by `SpriteSheet.src`. A key present with a `null` value
 *  means the asset has not finished loading; callers skip drawing rather than
 *  waiting. */
export type SpriteLookup = Record<string, HTMLImageElement | null>;

/** Source rect of one frame. */
export function frameSource(sheet: SpriteSheet, index: number): { sx: number; sy: number } {
  return {
    sx: (index % sheet.columns) * sheet.frameWidth,
    sy: Math.floor(index / sheet.columns) * sheet.frameHeight,
  };
}

/**
 * The distinct image sources a set of descriptors needs, each listed once.
 * The loader walks the type registries and calls this, so no hand-maintained
 * list of assets exists anywhere and a shared sheet is fetched only once no
 * matter how many types point at it.
 */
export function collectSheetSources(descriptors: readonly SpriteDescriptor[]): string[] {
  return [...new Set(descriptors.map((d) => d.sheet.src))];
}
```

Create `src/themes/platformer/entities/sprites/sheets.ts`:

```typescript
import type { SpriteSheet } from './SpriteSheet';

/**
 * Both slime sheets are 96x72: a 4x3 grid of 24x24 frames. Frames 0-2 read as a
 * mostly-featureless blob, frames 3-7 loop well as a breathing/bounce cycle,
 * and frames 8-11 read as the slime dissolving toward a near-black silhouette.
 * Frame 10 alone is recolored red in both sheets.
 */
const SLIME_FRAME_SIZE = 24;
const SLIME_COLUMNS = 4;

export const SLIME_GREEN_SHEET: SpriteSheet = {
  src: '/sprites/slime_green.png',
  frameWidth: SLIME_FRAME_SIZE,
  frameHeight: SLIME_FRAME_SIZE,
  columns: SLIME_COLUMNS,
};

export const SLIME_PURPLE_SHEET: SpriteSheet = {
  src: '/sprites/slime_purple.png',
  frameWidth: SLIME_FRAME_SIZE,
  frameHeight: SLIME_FRAME_SIZE,
  columns: SLIME_COLUMNS,
};
```

Verify the two `src` paths against the actual `loadImage` calls in `PlatformerPage.tsx` before committing — they must match exactly, including the leading slash.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/sprites/SpriteSheet.test.ts`
Expected: PASS.

Run: `npm test` and `npx tsc -b --noEmit`
Expected: PASS, no errors. Nothing consumes this yet, so no existing behavior can change.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer
git commit -m "feat(platformer): add sprite sheet descriptors and asset discovery"
```

---

### Task 3: Enemy type modules and registry

**Model:** Opus — the dispatcher cast, the module cycle, and the discriminated union all fail silently when done almost-right. See "Model guidance".

Moves every per-type number out of the parallel `Record` lookups into one module per type. Data only — no rendering, no collision hooks yet.

**Files:**
- Create: `src/themes/platformer/entities/enemies/EnemyAnimation.ts`
- Create: `src/themes/platformer/entities/enemies/EnemyType.ts`
- Create: `src/themes/platformer/entities/enemies/shared.ts`
- Create: `src/themes/platformer/entities/enemies/SlimeGreen.ts`
- Create: `src/themes/platformer/entities/enemies/SlimePurple.ts`
- Create: `src/themes/platformer/entities/enemies/index.ts`
- Create: `src/themes/platformer/entities/enemies/index.test.ts`
- Modify: `src/themes/platformer/entities/Enemy.ts`
- Test: `src/themes/platformer/entities/Enemy.test.ts`

**Interfaces:**
- Consumes: `Entity`, `Damageable`, `Rect` (Task 1); `SpriteSheet`, `SpriteDescriptor`, `frameSource` (Task 2).
- Produces: `EnemyType<S>`, `BaseEnemyState`, `ItemKind` from `enemies/EnemyType.ts`; `ENEMY_TYPES`, `EnemyTypeKey`, `EnemyState`, `typeOf` from `enemies/index.ts`; `EnemyAnimState`, `walkAnimFrameCount`, `WALK_FRAME_DURATION` from `enemies/EnemyAnimation.ts`.

**Import direction — read before writing any file in this task.** The dependency edge runs **one way**: `Enemy.ts` → `enemies/*`, never back. `enemies/shared.ts` must not import from `../Enemy`, or the cycle `Enemy.ts → enemies/index.ts → SlimeGreen.ts → shared.ts → Enemy.ts` forms and `ENEMY_TYPES` is `undefined` at module-init time in whichever module loads second. That is why Step 3a moves the animation config out of `Enemy.ts` **before** anything else in this task.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/enemies/index.test.ts`:

```typescript
import { ENEMY_TYPES, typeOf } from './index';
import { toEnemyState } from '../Enemy';
import { RENDER_SCALE } from '../../level/Terrain';
import { SLIME_GREEN_SHEET, SLIME_PURPLE_SHEET } from '../sprites/sheets';
import type { EnemyPlacement } from '../../level/EnemyMapper';

describe('ENEMY_TYPES', () => {
  // These are the exact values the parallel Record lookups held before this
  // refactor. Asserting them explicitly is what makes this a pure data move
  // with no behavior risk.
  it('slimeGreen-matchesItsPreRefactorConstants', () => {
    expect(ENEMY_TYPES.slimeGreen).toMatchObject({
      maxHitPoints: 1,
      patrolSpeedMultiplier: 1,
      hitboxPaddingNative: { side: 5, top: 9 },
      heldItem: null,
    });
    expect(ENEMY_TYPES.slimeGreen.sprite.sheet).toBe(SLIME_GREEN_SHEET);
    expect(ENEMY_TYPES.slimeGreen.sprite.renderScale).toBe(1);
  });

  it('slimePurple-matchesItsPreRefactorConstants', () => {
    expect(ENEMY_TYPES.slimePurple).toMatchObject({
      maxHitPoints: 3,
      patrolSpeedMultiplier: 0.7,
      hitboxPaddingNative: { side: 5, top: 9 },
      heldItem: 'key',
    });
    expect(ENEMY_TYPES.slimePurple.sprite.sheet).toBe(SLIME_PURPLE_SHEET);
    expect(ENEMY_TYPES.slimePurple.sprite.renderScale).toBe(2);
  });

  it('everyEntry-declaresItsOwnKey', () => {
    // Guards the dispatcher's cast: typeOf indexes ENEMY_TYPES by the state's
    // `type`, which is sound only while each module's key matches its slot.
    for (const [key, type] of Object.entries(ENEMY_TYPES)) {
      expect(type.key).toBe(key);
    }
  });

  it('everyEntry-declaresWalkAndHitAnimations', () => {
    for (const type of Object.values(ENEMY_TYPES)) {
      expect(type.sprite.animations.walk.frames).toEqual([3, 4, 5, 6, 7]);
      expect(type.sprite.animations.hit.frames).toEqual([8, 9, 10, 11]);
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
    expect(ENEMY_TYPES.slimePurple.sprite.renderScale).toBe(
      2 * ENEMY_TYPES.slimeGreen.sprite.renderScale,
    );
  });

  it('hitboxPadding-scalesWithRenderScaleAndRenderScaleConstant', () => {
    const purple = ENEMY_TYPES.slimePurple;
    expect(purple.hitboxPaddingNative.side * RENDER_SCALE * purple.sprite.renderScale).toBe(20);
    expect(purple.hitboxPaddingNative.top * RENDER_SCALE * purple.sprite.renderScale).toBe(36);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/enemies/index.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3a: Move the animation config out of `Enemy.ts` FIRST**

Create `src/themes/platformer/entities/enemies/EnemyAnimation.ts` holding `EnemyAnimState` and the frame-index animation lists, replacing `Enemy.ts`'s `WALK_FRAMES`/`ENEMY_ANIM_CONFIG`/`enemyFrameSource`:

```typescript
import type { SpriteDescriptor } from '../sprites/SpriteSheet';

/** Patrol uses constant-slide movement — a patrolling enemy is always in
 *  motion — so there is no reachable idle state. The frames 3-7 loop reads
 *  fine as movement and is reused for `walk`. */
export type EnemyAnimState = 'walk' | 'hit';

export const WALK_FRAME_DURATION = 0.15;
const HIT_FRAME_DURATION = 0.1;

export const ENEMY_ANIMATIONS: SpriteDescriptor['animations'] = {
  walk: { frames: [3, 4, 5, 6, 7], frameDuration: WALK_FRAME_DURATION },
  hit: { frames: [8, 9, 10, 11], frameDuration: HIT_FRAME_DURATION },
};

/** Number of frames in the walk loop — used to stagger enemies' starting
 *  frames so they don't animate in lockstep. */
export function walkAnimFrameCount(): number {
  return ENEMY_ANIMATIONS.walk.frames.length;
}
```

Delete `ENEMY_FRAME_SIZE`, `WALK_FRAMES`, `ENEMY_ANIM_CONFIG`, `enemyFrameSource`, and the `FrameCoord` type from `Enemy.ts`, and re-export what other modules still import:

```typescript
export type { EnemyAnimState } from './enemies/EnemyAnimation';
export { walkAnimFrameCount, WALK_FRAME_DURATION } from './enemies/EnemyAnimation';
```

`Renderer.ts` and any test currently calling `enemyFrameSource(animState, frame)` must switch to resolving the frame through the descriptor: look up `ENEMY_ANIMATIONS[animState].frames[animFrame % frames.length]` to get the index, then `frameSource(sheet, index)`. Add a small helper in `EnemyAnimation.ts` for exactly that and use it at every call site:

```typescript
export function enemyFrameIndex(animState: EnemyAnimState, animFrame: number): number {
  const { frames } = ENEMY_ANIMATIONS[animState];
  return frames[animFrame % frames.length];
}
```

`EnemyAnimation.ts` must import nothing from `../Enemy`. Verify before continuing: `grep -rn "from '\.\./Enemy'" src/themes/platformer/entities/enemies/` returns nothing.

- [ ] **Step 3b: Write the type contract**

Create `src/themes/platformer/entities/enemies/EnemyType.ts`:

```typescript
import type { Entity, Damageable } from '../Entity';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { EnemyPlacement } from '../../level/EnemyMapper';
import type { CollectedFact } from '../../types';
import type { EnemyAnimState } from './EnemyAnimation';

/** Item kinds an enemy type can drop on defeat. Grows as items are added. */
export type ItemKind = 'key';

/**
 * What every enemy has, regardless of type. Type-specific state — purple's
 * spike timer, for example — is declared by that type's own module, which
 * extends this.
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
 * Renderer.ts, EnemyAI.ts, or PlatformerPage.tsx needs to change, and no
 * sprite registry needs editing either: the loader discovers assets from
 * `sprite.sheet`.
 */
export interface EnemyType<S extends BaseEnemyState> {
  /** Must equal this module's slot in ENEMY_TYPES — see index.test.ts. */
  key: string;
  maxHitPoints: number;
  patrolSpeedMultiplier: number;
  /** Transparent margin inside the native frame, in pre-scale pixels. */
  hitboxPaddingNative: { side: number; top: number };
  sprite: SpriteDescriptor;
  /** What a finishing stomp drops, or null for a type that carries a CV fact
   *  instead. */
  heldItem: ItemKind | null;

  create(placement: EnemyPlacement, index: number): S;
  revive(enemy: S): S;
}
```

- [ ] **Step 3c: Write `shared.ts` and the two type modules**

Create `src/themes/platformer/entities/enemies/shared.ts` with the construction both modules reuse. Move the bodies of the existing `toEnemyState` and `reviveEnemy` here, parameterising hit points. **Note `reviveEnemy` deliberately does NOT reset `animFrame`/`animTimer`** — that preserves the per-enemy animation stagger across a respawn.

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
 *  left to give — and preserving `animFrame`/`animTimer` so the per-enemy
 *  animation stagger survives a respawn. */
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
    hitPoints: maxHitPoints,
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    alive: true,
  };
}
```

Create `src/themes/platformer/entities/enemies/SlimeGreen.ts`:

```typescript
import type { EnemyType, BaseEnemyState } from './EnemyType';
import { baseEnemyState, baseRevive } from './shared';
import { ENEMY_ANIMATIONS } from './EnemyAnimation';
import { SLIME_GREEN_SHEET } from '../sprites/sheets';

export interface SlimeGreenState extends BaseEnemyState {
  type: 'slimeGreen';
}

export const slimeGreen: EnemyType<SlimeGreenState> = {
  key: 'slimeGreen',
  maxHitPoints: 1,
  patrolSpeedMultiplier: 1,
  hitboxPaddingNative: { side: 5, top: 9 },
  sprite: { sheet: SLIME_GREEN_SHEET, renderScale: 1, animations: ENEMY_ANIMATIONS },
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
import { ENEMY_ANIMATIONS } from './EnemyAnimation';
import { SLIME_PURPLE_SHEET } from '../sprites/sheets';

export interface SlimePurpleState extends BaseEnemyState {
  type: 'slimePurple';
}

// A purple slime reads as a distinctly bigger, slower, tougher variant of the
// green one — twice the size, 70% of the patrol speed, three stomps.
export const slimePurple: EnemyType<SlimePurpleState> = {
  key: 'slimePurple',
  maxHitPoints: 3,
  patrolSpeedMultiplier: 0.7,
  hitboxPaddingNative: { side: 5, top: 9 },
  sprite: { sheet: SLIME_PURPLE_SHEET, renderScale: 2, animations: ENEMY_ANIMATIONS },
  heldItem: 'key',

  create: (placement, index) => ({
    ...baseEnemyState(placement, index, 3),
    type: 'slimePurple',
  }),
  revive: (enemy) => ({ ...baseRevive(enemy, 3), type: 'slimePurple' }),
};
```

`spiked`/`spikeTimer` stay on the base for now; Task 6 moves them into `SlimePurpleState`.

- [ ] **Step 3d: Write the registry and dispatcher**

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

- [ ] **Step 3e: Point `Enemy.ts`'s geometry functions at the registry**

Rewrite the geometry functions to read the registry, and **delete** `ENEMY_RENDER_SCALE`, `ENEMY_PATROL_SPEED_MULTIPLIER`, `ENEMY_HIT_POINTS`, `ENEMY_HITBOX_SIDE_PADDING_NATIVE`, and `ENEMY_HITBOX_TOP_PADDING_NATIVE`:

```typescript
export function enemyRenderedSize(type: EnemyTypeKey): number {
  const { sheet, renderScale } = ENEMY_TYPES[type].sprite;
  return sheet.frameWidth * RENDER_SCALE * renderScale;
}

export function enemyTileOffsetX(type: EnemyTypeKey): number {
  return (RENDERED_TILE_SIZE - enemyRenderedSize(type)) / 2;
}

export function enemyTileOffsetY(type: EnemyTypeKey): number {
  return RENDERED_TILE_SIZE - enemyRenderedSize(type);
}

export function enemyHitboxSidePadding(type: EnemyTypeKey): number {
  const { hitboxPaddingNative, sprite } = ENEMY_TYPES[type];
  return hitboxPaddingNative.side * RENDER_SCALE * sprite.renderScale;
}

export function enemyHitboxTopPadding(type: EnemyTypeKey): number {
  const { hitboxPaddingNative, sprite } = ENEMY_TYPES[type];
  return hitboxPaddingNative.top * RENDER_SCALE * sprite.renderScale;
}

export function toEnemyState(placement: EnemyPlacement, index = 0): EnemyState {
  return ENEMY_TYPES[placement.type].create(placement, index);
}

export function reviveEnemy(enemy: EnemyState): EnemyState {
  return typeOf(enemy).revive(enemy);
}
```

**`EnemyState` now has one definition, not two.** Delete the `EnemyState` interface from `entities/Enemy.ts` — it is superseded by the union in `enemies/index.ts`, which is the only place a per-type state shape may be added. `Enemy.ts` re-exports it so the existing `import type { EnemyState } from './entities/Enemy'` sites keep compiling:

```typescript
export type { EnemyState } from './enemies';
```

Every field the old interface declared now lives on `BaseEnemyState` or on a type module's own state interface. Run `npx tsc -b --noEmit` after this step to confirm nothing went missing.

**If `EnemyContact.contract.test.ts`'s `makeEnemy` stops typechecking**, it is because `Partial<EnemyState>` over a discriminated union distributes and no longer spreads cleanly onto a base literal. Fix it by changing the HELPER — for example building via `ENEMY_TYPES[type].create(...)` and then applying overrides, or typing the parameter as `Partial<BaseEnemyState> & { type?: EnemyTypeKey }`. **Never** by editing an `expected` block and never with a cast to `any`.

Update `Enemy.test.ts`: it imports `ENEMY_RENDER_SCALE`, `ENEMY_PATROL_SPEED_MULTIPLIER`, and `ENEMY_HIT_POINTS`, which no longer exist. Replace each with the corresponding `ENEMY_TYPES.<key>` read. The assertions must not change — the values are identical by construction and `index.test.ts` asserts exactly that.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, including `EnemyContact.contract.test.ts` with unmodified `expected` blocks.

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `grep -rn "ENEMY_RENDER_SCALE\|ENEMY_PATROL_SPEED_MULTIPLIER\|ENEMY_HIT_POINTS" src/`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): move per-enemy-type data into self-contained modules"
```

---

### Task 4: Rendering moves into the type modules

**Model:** Sonnet 5, with mandatory Opus review and the browser check in Step 7. This task RELOCATES ~60 lines of canvas arithmetic; a rewritten-from-memory version passes the suite and looks wrong only on screen.

**Files:**
- Create: `src/themes/platformer/engine/DrawContext.ts`
- Create: `src/themes/platformer/entities/enemies/drawSpriteSheetEntity.ts`
- Modify: `src/themes/platformer/entities/enemies/EnemyType.ts` (add `draw`)
- Modify: `src/themes/platformer/entities/enemies/SlimeGreen.ts`, `SlimePurple.ts`
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `ENEMY_TYPES`, `typeOf` (Task 3); `SpriteLookup`, `frameSource`, `collectSheetSources` (Task 2).
- Produces: `DrawContext` from `engine/DrawContext.ts`; `EnemyType.draw(enemy, dc)`. `drawEnemies(ctx, enemies, dc)` replaces the eight-positional-argument signature.

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
    expect(drawImageCallsFor(ctx, dc.sprites[SLIME_GREEN_SHEET.src])).toHaveLength(1);
    expect(drawImageCallsFor(ctx, dc.sprites[SLIME_PURPLE_SHEET.src])).toHaveLength(1);
  });

  it('purpleThatAlreadyGaveItsReward-drawsNoHeldKey', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    drawEnemies(ctx, [makePurpleEnemy({ rewardGiven: true })], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[KEY_SHEET.src])).toHaveLength(0);
  });

  it('purpleThatHasNotGivenItsReward-drawsAHeldKey', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    drawEnemies(ctx, [makePurpleEnemy({ rewardGiven: false })], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[KEY_SHEET.src]).length).toBeGreaterThan(0);
  });
});
```

Add a `makeDrawContext(ctx)` helper building a `DrawContext` whose `sprites` maps each sheet `src` to a DISTINCT mock image object, so `drawImageCallsFor` can tell them apart. Reuse the file's existing mock-context and `drawImageCallsFor` helpers.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `makeDrawContext is not defined` / `drawEnemies` arity mismatch.

- [ ] **Step 3: Write the draw context**

Create `src/themes/platformer/engine/DrawContext.ts`:

```typescript
import type { SpriteLookup } from '../entities/sprites/SpriteSheet';

/**
 * Everything a type's `draw` needs in order to render itself, so drawing logic
 * can live in the type's own module without each module reaching for the
 * camera or the sprite refs.
 *
 * Renderer.ts remains the only module that knows how the camera maps world
 * coordinates to canvas coordinates; a type only ever adds originX/originY to
 * its own world position.
 */
export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  /** Loaded images keyed by `SpriteSheet.src`. */
  sprites: SpriteLookup;
  /** World-to-canvas offset. */
  originX: number;
  originY: number;
  /** Seconds since the world started animating — drives bob and pulse. */
  worldElapsed: number;
}
```

Add a `KEY_SHEET` to `entities/sprites/sheets.ts` for `public/sprites/key.png` — a one-frame sheet, `frameWidth: 14`, `frameHeight: 22`, `columns: 1` (see `entities/KeyPickup.ts`'s existing constants; keep them as the source of truth for the numbers).

- [ ] **Step 4: Write the shared blit helper and the two `draw` implementations**

Create `src/themes/platformer/entities/enemies/drawSpriteSheetEntity.ts` containing the plain sheet blit currently at the top of `drawEnemies`' loop body — source rect via `frameSource(sprite.sheet, enemyFrameIndex(animState, animFrame))`, destination from `enemyTileOffsetX/Y` plus origin, `imageSmoothingEnabled = false`, and the horizontal mirror for `direction === 'left'`. **Move that code; do not rewrite it.**

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

`SlimePurple.draw` calls the helper, then draws its spike overlay and held-key shine. **Move both blocks verbatim** out of `Renderer.ts`'s `drawEnemies`, including the `SPIKE_COLORS` palette (now a plain local constant in `SlimePurple.ts`, with the unreachable `slimeGreen` entry deleted) and the silhouette-centering arithmetic in the held-key block. Replace the gate:

```typescript
    const showsHeldKey = dc.sprites[KEY_SHEET.src] != null && !enemy.rewardGiven;
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

`ctx` is passed explicitly even though `dc.ctx` holds it, matching every other `draw*` function in this module. `dc.ctx` must be the same object.

Delete `SPIKE_COLORS` and the `SPIKE_GROW/HOLD/RETRACT` imports from `Renderer.ts`.

In `PlatformerPage.tsx`, replace `slimeGreenSpriteRef` and `slimePurpleSpriteRef` with one lookup populated by discovering sheets from the registry:

```typescript
const spritesRef = useRef<SpriteLookup>({});

useEffect(() => {
  const sources = collectSheetSources([
    ...Object.values(ENEMY_TYPES).map((t) => t.sprite),
    { sheet: KEY_SHEET, renderScale: 1, animations: {} },
  ]);
  for (const src of sources) {
    loadImage(src).then((img) => {
      spritesRef.current[src] = img;
    });
  }
}, []);
```

Match the existing `loadImage` call convention in that file rather than inventing a new one. Build the `DrawContext` once per tick alongside the existing `originX`/`originY` computation and pass it to `drawEnemies`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test` and `npx tsc -b --noEmit`
Expected: PASS, no errors.

- [ ] **Step 7: Verify in the browser**

Confirm visually against the pre-refactor look: green slime unchanged; purple slime at twice the size with its held-key shine-through; spikes appearing on a non-fatal stomp with the same grow/hold/retract timing and colours.

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): let each enemy type render itself"
```

---

### Task 5: Contact resolution

**Model:** Opus — the semantic core. The contract test pins ten single-enemy cases; the multi-contact aggregation rules are new behavior nothing else covers.

Collapses `checkEnemyStompCollisions`, `checkEnemySideCollisions`, and `isSpikedTopLanding` into one geometry function plus a per-type decision hook.

**Files:**
- Create: `src/themes/platformer/engine/Contact.ts`
- Create: `src/themes/platformer/entities/enemies/stunnedGuard.ts`
- Modify: `src/themes/platformer/entities/enemies/EnemyType.ts`, `SlimeGreen.ts`, `SlimePurple.ts`
- Modify: `src/themes/platformer/engine/Collision.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/engine/EnemyContact.contract.test.ts`
- Test: `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Consumes: `typeOf` (Task 3), hitbox geometry from `Collision.ts`.
- Produces: `ContactSide`, `Contact`, `CollisionOutcome<S>` from `engine/Contact.ts`; `resolveEnemyContacts(player, enemies)` from `Collision.ts`; `EnemyType.onPlayerCollide`.

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

**The `expected` blocks must not be edited.** If a case fails, the new implementation changed behavior and the implementation is what is wrong.

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

Move `applyStomp`'s body into it unchanged and re-export `applyStomp` as an alias until Task 6 removes the last caller.

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

Add tests to `Collision.test.ts` for the aggregation rules, which no existing test covers:

```typescript
describe('resolveEnemyContacts aggregation', () => {
  it('twoDamagingEnemiesTouchedAtOnce-appliesDamageOnce', () => { /* … */ });
  it('oneStompableAndOneDamagingEnemy-appliesBothBounceAndDamage', () => { /* … */ });
  it('enemiesNotTouched-areReturnedByReference', () => { /* … */ });
});
```

Position the two enemies using this plan's Reference values arithmetic; assert `damagePlayer` is 1, not 2.

- [ ] **Step 6: Apply outcomes in the game loop**

In `PlatformerPage.tsx`, replace the block calling the three deleted functions with:

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

### Task 6: The spike mechanic moves into `SlimePurple.ts`

**Model:** Sonnet 5 — fully specified, and Step 5's grep containment check verifies the outcome objectively.

**Files:**
- Modify: `src/themes/platformer/entities/enemies/EnemyType.ts`, `SlimePurple.ts`, `SlimeGreen.ts`, `shared.ts`
- Modify: `src/themes/platformer/engine/EnemyAI.ts`
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/engine/EnemyAI.test.ts`, `src/themes/platformer/entities/enemies/SlimePurple.test.ts`

**Interfaces:**
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

`SlimePurple.create` and `revive` must now seed these themselves, since `shared.ts` no longer does.

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

Add an `alive` guard to the spike overlay drawing in `SlimePurple.draw` — a dead enemy is skipped by `drawEnemies` today, but the guard belongs with the mechanic now that it lives here.

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
- No module outside `entities/sprites/` names a sprite asset path.
- `EnemyContact.contract.test.ts`'s `expected` blocks are byte-identical to the ones committed in the lifecycle plan.
- `npm test` and `npx tsc -b --noEmit` pass.
- Adding a third enemy type would require: one new module, one line in `enemies/index.ts`, one sprite asset — and no edit to any sprite registry.

## Next

Plan 3 — items, blocks, chests, then the player — is written via
`superpowers:writing-plans` once this plan lands, against the shapes it
actually produced (`SpriteDescriptor`, `DrawContext`, `CollisionOutcome`,
`typeOf`) rather than against predicted ones.
