# Block Hit Mechanics (Roadmap Step 21) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the three block types placed in step 20 (crate, question-mark, rock) their
distinct upward-hit-from-below reactions — crate cracks then shatters revealing an
Experience/Education fact, question-mark pops a no-fact bonus fruit and permanently
converts to `!`, rock breaks to empty space immediately — all sharing a ~100ms
bump/nudge animation, with no change to their existing from-every-direction solidity.

**Architecture:** Blocks gain live per-instance hit state (`BlockState`, mirroring
`EnemyState`'s `hitPoints`/`animState`/`hitTimer` pattern) held in a new
`blockStates` signal, replacing the static `blockPlacements` array everywhere except
inside `BlockMapper.ts`/`PlatformerState.ts` module-load seeding. `Physics.ts`'s
existing ceiling-collision loop (already the only place "player's head hits
something above" is detected) is extended to also report which block id(s) were
touched, via a new `hitBlockIds` field on the returned `PlayerState` — additive, so
`stepPlayerPhysics`'s existing return shape and every current call site keep
working unchanged. `PlatformerPage.tsx`'s game loop applies hits, steps the shared
bump/shatter animation, removes finished crates/rocks, and reuses the existing
`startFlightEffect`/`collectedFacts` fact-reveal flow (already used by
coins/fruits/enemies) for a crate's second hit. A new small `BonusFruitState` array
represents a question-mark's spawned, no-fact fruit as it rises one tile and becomes
a plain touchable pickup, reusing `fruit.png`.

**Tech Stack:** TypeScript (strict), Vitest + React Testing Library, HTML canvas
rendering (no game engine/library) — same stack as the rest of the Platformer theme.

**Spec:** `specs/S-006-platformer-theme/spec.md` (User Story 5, FR-021–FR-022d, the
2026-08-30 solidity amendment) and `specs/S-006-platformer-theme/roadmap.md` (step
21, sub-steps 21a/21b/21c).

## Global Constraints

- Every block stays solid from every direction regardless of hit count/kind — this
  step only adds the CV/hit *reaction*, never touches collision solidity itself
  (spec.md's 2026-08-30 amendment to FR-021).
- Only an upward hit from below (the existing ceiling-collision case) triggers any
  reaction; hits from above or the side must remain no-ops (FR-022, Acceptance
  Scenario 5).
- Every upward hit plays the shared ~100ms bump/nudge animation, including each
  block's terminal hit (FR-022d).
- Question-mark and rock blocks carry no CV mapping and must never touch
  `collectedFacts` (spec.md FR-021's amendment, FR-022b/c).
- Crate's fact-reveal on its second hit must reuse the existing
  `startFlightEffect`/`collectedFacts` mechanism coins/fruits/enemies already use —
  no parallel implementation (project constitution: no feature bloat / reuse
  existing patterns).
- `CollectedFact` dedup-by-id (a crate's fact must not be re-banked if hit again —
  not actually reachable for crates since they don't reset on death, but keep the
  same defensive guard the enemy-defeat code already uses, for consistency and
  future-proofing).
- TypeScript strict mode, no `any`. Named arrow/function exports. Tests first
  (constitution Principle II) — Vitest, `{method}-{Condition}-{ExpectedResult}`
  naming, matching every existing test file in `src/themes/platformer/`.
- No feature bloat: don't build a generic "hit-state" abstraction beyond what these
  three block kinds need.

---

## Key Design Decisions (read before starting)

1. **Block state lives in a new `BlockState` type** (`src/themes/platformer/entities/Block.ts`,
   extending the existing `BlockPlacement`), mirroring `EnemyState`'s
   `hitPoints`/`animState`/`hitTimer extends EnemyPlacement` pattern exactly. Fields:
   `hitsTaken: number` (0..max), `animState: 'idle' | 'bump' | 'shatter'`,
   `animTimer: number`. `'shatter'` only ever occurs for `crate` (its terminal hit);
   question-mark/rock go `bump → idle` directly.

2. **Per-kind max hits**: crate=2, question-mark=1, rock=1
   (`maxHitsForBlock(blockKind)`).

3. **Removal semantics**: `isBlockRemoved(block)` is true once a crate or rock has
   taken its max hits AND its post-hit animation (`bump`, then `shatter` for crate)
   has finished (`animState === 'idle'`) — question-mark is *never* removed (it
   permanently swaps its rendered tile to `!` but stays solid and in the array
   forever, exactly like the spec's "block permanently changes to its matching `!`
   tile"). `PlatformerPage.tsx`'s tick filters `isBlockRemoved` blocks out of
   `blockStates` every frame, the same way `justDefeated` enemies are filtered out
   of `enemyStates` today.

4. **Death/respawn persistence**: `PlatformerState.ts`'s existing `resetGame()`
   doc comment already says *"future steps needing a full 'Reset Game' button will
   additionally... respawn coins/blocks once those mechanics are added"* — i.e.
   blocks are meant to behave like collectibles (hit/broken state **persists**
   across a death/respawn), not like enemies (which *do* revive via `resetGame()`).
   So: `resetGame()` is left untouched; only `resetGameProgress()` (the Reset Game
   button) reseeds `blockStates`/`bonusFruitStates` back to fresh.

5. **How "which block got hit" is detected**: `Physics.ts`'s existing ceiling-collision
   loop (the *only* place a rising player's head-hit-something-above is detected) is
   extended to also collect the id(s) of any `BlockPlacement` at the hit tile, returned
   as a new `hitBlockIds: string[]` field on `PlayerState` (always present, freshly
   computed every tick — not a persisted flag like `bounceAscending`). This keeps
   `Physics.ts`/`BlockMapper.ts` fully unaware of hit-state (they only need
   id/x/y — the plain `BlockPlacement` shape already passed in for solidity), and
   avoids the fragility of trying to reverse-derive which tile was hit from the
   already-resolved post-collision position elsewhere. Because `hitBlockIds` is a
   new *required* field on `PlayerState`, every test file that hand-builds a full
   `PlayerState` object literal (not via `spawnPlayerState()`) needs one line added:
   `Physics.test.ts`, `Collision.test.ts`, `Renderer.test.ts`, `DebugOverlay.test.ts`,
   `Player.test.ts` (all confirmed via grep for `bounceAscending: false`), plus
   `PlatformerState.ts`'s `spawnPlayerState()` itself.

6. **Question-mark's `!` tile** is a frame-source lookup, not a separate removal —
   `blockFrameSource(blockKind, hitsTaken = 0)` gains an optional second parameter
   (default 0, so the 3 existing `Block.test.ts` calls are unaffected) that only
   changes `questionMark`'s returned frame once `hitsTaken >= 1`.

7. **Crate's crack overlay** (`public/sprites/crack_overlay.png`, already generated
   and staged on this branch — see roadmap step 21a's note) is composited via a
   *second* `ctx.drawImage` call on top of the crate's base tile whenever
   `hitsTaken === 1`, not a frame swap — it's a standalone transparent PNG, not part
   of `world_tileset.png`.

8. **Crate's "shatter animation"**: no dedicated shatter/break sprite sheet exists
   (the same tileset gap step 20 already worked around for the crack-progression
   redesign). Implemented as a brief fade-out (`ctx.globalAlpha` from 1 → 0 over
   `CRATE_SHATTER_DURATION_SECONDS`) layered on top of the bump, using only the
   assets already in place — no new asset needed. Rock's "breaks... immediately"
   (FR-022c) deliberately has **no** shatter phase — it goes `bump → idle → removed`
   with nothing beyond the shared bump.

9. **Bonus fruit** (`BonusFruitState`, new small type/array, *not* a
   `CollectibleDef`/`CollectiblePlacement` — it carries no CV fact and must never
   touch `collectedFacts`/`collectedCollectibleIds`/the coin-fruit counters,
   per spec.md's "Bonus pickup" glossary entry) rises one tile
   (`RENDERED_TILE_SIZE`, into level1's already-reserved blank row above each `Q`
   marker — see level1.ts's 2026-08-30 doc comment) over
   `BONUS_FRUIT_RISE_DURATION_SECONDS`, then holds as a touchable pickup reusing
   `fruit.png` (`fruitFrameSource(0)`). Touching it (checked only once it's finished
   rising) simply removes it from the array — no reward, no journal/counter effect,
   matching spec.md's "Purely a reward for engaging with the block-hit mechanic"
   (i.e. the reward is visual/tactile satisfaction, not game state).

---

## File Structure

- **Modify** `src/themes/platformer/entities/Block.ts` — add `BlockState`,
  `toBlockState`, `maxHitsForBlock`, `isBlockUsedUp`, `isBlockRemoved`,
  `applyBlockHit`; extend `blockFrameSource` with the optional `hitsTaken` param;
  add `crateCrackOverlayVisible`.
- **Create** `src/themes/platformer/engine/BlockAI.ts` — `stepBlockAnimation`,
  `blockBumpOffsetY`, `crateShatterOpacity`, plus the bump/shatter duration/height
  constants (mirrors `EnemyAI.ts`'s `HIT_REACTION_DURATION_SECONDS` convention: a
  small local module, not `PhysicsConfig.ts`, since these are visual-only, not
  velocity constants subject to the tunneling invariant).
- **Create** `src/themes/platformer/entities/BonusFruit.ts` — `BonusFruitState`,
  `spawnBonusFruit`, `tickBonusFruit`, `bonusFruitY`.
- **Modify** `src/themes/platformer/level/BlockMapper.ts` — add `blockIdAt`,
  refactor `isBlockOccupied` to use it.
- **Modify** `src/themes/platformer/entities/Player.ts` — add
  `hitBlockIds: string[]` to `PlayerState`.
- **Modify** `src/themes/platformer/engine/Physics.ts` — ceiling-collision loop
  collects hit block ids into the returned `hitBlockIds`.
- **Modify** `src/themes/platformer/engine/Collision.ts` — add
  `checkBonusFruitCollisions`.
- **Modify** `src/themes/platformer/PlatformerState.ts` — add `blockStates`,
  `bonusFruitStates` signals; `spawnPlayerState()` gets `hitBlockIds: []`;
  `resetGameProgress()` reseeds both new signals.
- **Modify** `src/themes/platformer/engine/Renderer.ts` — rewrite `drawBlocks` to
  take `BlockState[]` + the crack-overlay sprite and apply bump offset/shatter
  opacity/`!`-tile swap/crack overlay; add `drawBonusFruits`.
- **Modify** `src/themes/platformer/PlatformerPage.tsx` — load
  `crack_overlay.png`; step block animation + bonus-fruit rise each tick; apply
  block hits + spawn bonus fruit + reveal crate fact after `stepPlayerPhysics`;
  check bonus-fruit pickups alongside the existing collectible check; update
  `render()`'s `drawBlocks`/new `drawBonusFruits` calls.
- **Modify test fixtures** (add `hitBlockIds: []`): `Physics.test.ts`,
  `Collision.test.ts`, `Renderer.test.ts`, `DebugOverlay.test.ts`, `Player.test.ts`.

---

### Task 1: Block hit-state type + helpers

**Files:**
- Modify: `src/themes/platformer/entities/Block.ts`
- Test: `src/themes/platformer/entities/Block.test.ts`

**Interfaces:**
- Consumes: `BlockPlacement` from `../level/BlockMapper` (already imported
  nowhere in this file today — add `import type { BlockPlacement } from '../level/BlockMapper';`).
- Produces: `BlockState`, `toBlockState(placement): BlockState`,
  `maxHitsForBlock(blockKind): number`, `isBlockUsedUp(block): boolean`,
  `isBlockRemoved(block): boolean`, `applyBlockHit(block): BlockState`,
  `crateCrackOverlayVisible(hitsTaken): boolean` — all consumed by later tasks.

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/entities/Block.test.ts`:

```ts
import {
  blockFrameSource,
  BLOCK_FRAME_SIZE,
  BLOCK_RENDERED_SIZE,
  toBlockState,
  maxHitsForBlock,
  isBlockUsedUp,
  isBlockRemoved,
  applyBlockHit,
  crateCrackOverlayVisible,
} from './Block';
import type { BlockPlacement } from '../level/BlockMapper';

function placement(blockKind: BlockPlacement['blockKind']): BlockPlacement {
  return { id: `${blockKind}-1`, blockKind, x: 0, y: 0 };
}

describe('blockFrameSource with hitsTaken', () => {
  it('questionMark-hitsTakenZero-returnsIntactQuestionMarkTile', () => {
    expect(blockFrameSource('questionMark', 0)).toEqual({ sx: 0, sy: 32 });
  });

  it('questionMark-hitsTakenAtLeastOne-returnsUsedExclamationTile', () => {
    expect(blockFrameSource('questionMark', 1)).toEqual({ sx: 16, sy: 32 });
  });

  it('crate-anyHitsTaken-alwaysReturnsSameCrateTile', () => {
    expect(blockFrameSource('crate', 0)).toEqual({ sx: 112, sy: 48 });
    expect(blockFrameSource('crate', 1)).toEqual({ sx: 112, sy: 48 });
    expect(blockFrameSource('crate', 2)).toEqual({ sx: 112, sy: 48 });
  });

  it('rock-anyHitsTaken-alwaysReturnsSameRockTile', () => {
    expect(blockFrameSource('rock', 0)).toEqual({ sx: 48, sy: 0 });
    expect(blockFrameSource('rock', 1)).toEqual({ sx: 48, sy: 0 });
  });

  it('noHitsTakenArgument-defaultsToZero', () => {
    expect(blockFrameSource('questionMark')).toEqual({ sx: 0, sy: 32 });
  });
});

describe('maxHitsForBlock', () => {
  it('crate-returnsTwo', () => expect(maxHitsForBlock('crate')).toBe(2));
  it('questionMark-returnsOne', () => expect(maxHitsForBlock('questionMark')).toBe(1));
  it('rock-returnsOne', () => expect(maxHitsForBlock('rock')).toBe(1));
});

describe('toBlockState', () => {
  it('freshPlacement-startsAtZeroHitsAndIdleAnimState', () => {
    const state = toBlockState(placement('crate'));
    expect(state.hitsTaken).toBe(0);
    expect(state.animState).toBe('idle');
    expect(state.animTimer).toBe(0);
    expect(state.blockKind).toBe('crate');
  });
});

describe('isBlockUsedUp', () => {
  it('crateBelowMaxHits-returnsFalse', () => {
    expect(isBlockUsedUp({ ...toBlockState(placement('crate')), hitsTaken: 1 })).toBe(false);
  });
  it('crateAtMaxHits-returnsTrue', () => {
    expect(isBlockUsedUp({ ...toBlockState(placement('crate')), hitsTaken: 2 })).toBe(true);
  });
  it('rockAtMaxHits-returnsTrue', () => {
    expect(isBlockUsedUp({ ...toBlockState(placement('rock')), hitsTaken: 1 })).toBe(true);
  });
});

describe('isBlockRemoved', () => {
  it('questionMarkAtMaxHitsIdleAnimState-neverRemoved', () => {
    const used = { ...toBlockState(placement('questionMark')), hitsTaken: 1, animState: 'idle' as const };
    expect(isBlockRemoved(used)).toBe(false);
  });
  it('rockAtMaxHitsButStillBumping-notYetRemoved', () => {
    const bumping = { ...toBlockState(placement('rock')), hitsTaken: 1, animState: 'bump' as const };
    expect(isBlockRemoved(bumping)).toBe(false);
  });
  it('rockAtMaxHitsAnimStateIdle-isRemoved', () => {
    const done = { ...toBlockState(placement('rock')), hitsTaken: 1, animState: 'idle' as const };
    expect(isBlockRemoved(done)).toBe(true);
  });
  it('crateAtMaxHitsStillShattering-notYetRemoved', () => {
    const shattering = { ...toBlockState(placement('crate')), hitsTaken: 2, animState: 'shatter' as const };
    expect(isBlockRemoved(shattering)).toBe(false);
  });
  it('crateAtMaxHitsShatterFinished-isRemoved', () => {
    const done = { ...toBlockState(placement('crate')), hitsTaken: 2, animState: 'idle' as const };
    expect(isBlockRemoved(done)).toBe(true);
  });
  it('crateBelowMaxHits-neverRemovedRegardlessOfAnimState', () => {
    const cracked = { ...toBlockState(placement('crate')), hitsTaken: 1, animState: 'idle' as const };
    expect(isBlockRemoved(cracked)).toBe(false);
  });
});

describe('applyBlockHit', () => {
  it('freshBlock-incrementsHitsTakenAndEntersBumpFromFrameZero', () => {
    const hit = applyBlockHit(toBlockState(placement('crate')));
    expect(hit.hitsTaken).toBe(1);
    expect(hit.animState).toBe('bump');
    expect(hit.animTimer).toBe(0);
  });
  it('alreadyUsedUpBlock-isANoOp', () => {
    const usedUp = { ...toBlockState(placement('rock')), hitsTaken: 1, animState: 'idle' as const };
    expect(applyBlockHit(usedUp)).toBe(usedUp);
  });
});

describe('crateCrackOverlayVisible', () => {
  it('hitsTakenZero-notVisible', () => expect(crateCrackOverlayVisible(0)).toBe(false));
  it('hitsTakenOne-visible', () => expect(crateCrackOverlayVisible(1)).toBe(true));
  it('hitsTakenTwo-noLongerVisible', () => expect(crateCrackOverlayVisible(2)).toBe(false));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- Block.test.ts`
Expected: FAIL — `toBlockState`/`maxHitsForBlock`/`isBlockUsedUp`/`isBlockRemoved`/
`applyBlockHit`/`crateCrackOverlayVisible` are not exported yet, and
`blockFrameSource` doesn't accept a second argument.

- [ ] **Step 3: Implement**

Replace the whole of `src/themes/platformer/entities/Block.ts` with:

```ts
import { TILE_SIZE, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { BlockPlacement } from '../level/BlockMapper';

/** Blocks are drawn from `world_tileset.png` — the same image and tile size
 *  as terrain (16px native, 32px rendered) — so no separate sprite sheet or
 *  dimensions are needed. */
export const BLOCK_FRAME_SIZE = TILE_SIZE;
export const BLOCK_RENDERED_SIZE = RENDERED_TILE_SIZE;

export type BlockKind = 'crate' | 'questionMark' | 'rock';

/**
 * Sprite-sheet source rect (in `world_tileset.png`) for a block's current
 * visual state, by kind and `hitsTaken` (roadmap step 21b — the question-mark
 * block permanently swaps from its intact `?` to its matching `!` tile, at
 * tile (col 1, row 2), once hit; every other kind/hit-count combination keeps
 * rendering its one intact tile forever — crate's crack is a separate overlay
 * (see `crateCrackOverlayVisible`), not a frame swap, and rock/crate are
 * removed from the world entirely once used up rather than swapping tile.
 * `hitsTaken` defaults to 0 so every pre-existing call site (step 20's
 * render-only code, and this file's own pre-step-21 tests) is unaffected.
 */
export function blockFrameSource(blockKind: BlockKind, hitsTaken = 0): { sx: number; sy: number } {
  switch (blockKind) {
    case 'crate':
      return { sx: 7 * TILE_SIZE, sy: 3 * TILE_SIZE };
    case 'questionMark':
      return hitsTaken >= 1
        ? { sx: 1 * TILE_SIZE, sy: 2 * TILE_SIZE }
        : { sx: 0, sy: 2 * TILE_SIZE };
    case 'rock':
      return { sx: 3 * TILE_SIZE, sy: 0 };
    default: {
      const _exhaustive: never = blockKind;
      return _exhaustive;
    }
  }
}

/** Hits required to fully use up a block, by kind — crate takes 2 (crack then
 *  shatter); question-mark and rock each take just 1 (spec.md FR-022b/c). */
export function maxHitsForBlock(blockKind: BlockKind): number {
  return blockKind === 'crate' ? 2 : 1;
}

export type BlockAnimState = 'idle' | 'bump' | 'shatter';

/**
 * Live per-instance hit/animation state for a placed block — mirrors
 * `Enemy.ts`'s `EnemyState extends EnemyPlacement` pattern. `animState`
 * cycles `'idle' -> 'bump' -> ('shatter' -> ) 'idle'` on every hit (see
 * `BlockAI.ts`'s `stepBlockAnimation`) — `'shatter'` is reachable only for a
 * `crate` on its terminal (2nd) hit; question-mark/rock go straight back to
 * `'idle'` after their bump.
 */
export interface BlockState extends BlockPlacement {
  hitsTaken: number;
  animState: BlockAnimState;
  /** Seconds elapsed since entering the current `animState` — meaningless
   *  while `'idle'`. */
  animTimer: number;
}

/** Converts a placed-but-static `BlockPlacement` into its initial live state —
 *  no hits taken, idle. */
export function toBlockState(placement: BlockPlacement): BlockState {
  return { ...placement, hitsTaken: 0, animState: 'idle', animTimer: 0 };
}

/** Whether this block has taken all the hits its kind responds to — it may
 *  still be mid-animation (bump/shatter) even once true; see `isBlockRemoved`
 *  for whether it's actually gone from the world yet. */
export function isBlockUsedUp(block: BlockState): boolean {
  return block.hitsTaken >= maxHitsForBlock(block.blockKind);
}

/**
 * Whether this block should be filtered out of the live world entirely —
 * true once a crate or rock is used up AND its post-hit animation (bump,
 * then shatter for crate) has finished settling back to `'idle'`. A
 * question-mark is NEVER removed — spec.md FR-022b: it "permanently changes
 * to its matching `!` terrain tile" and stays a solid, present block forever;
 * only its rendered tile (via `blockFrameSource`) changes.
 */
export function isBlockRemoved(block: BlockState): boolean {
  if (block.blockKind === 'questionMark') return false;
  return isBlockUsedUp(block) && block.animState === 'idle';
}

/**
 * Applies one upward hit: increments `hitsTaken` and enters the shared
 * `'bump'` nudge animation from frame zero (FR-022d — every upward hit, not
 * just intermediate ones, plays this). A no-op (returns the same reference)
 * if the block is already used up — callers (`PlatformerPage.tsx`) are
 * expected to already exclude used-up blocks from `hitBlockIds` before
 * calling this, but this guard keeps the function safe to call
 * unconditionally regardless.
 */
export function applyBlockHit(block: BlockState): BlockState {
  if (isBlockUsedUp(block)) return block;
  return { ...block, hitsTaken: block.hitsTaken + 1, animState: 'bump', animTimer: 0 };
}

/** Whether a crate's cracked-overlay sprite (`crack_overlay.png`) should be
 *  composited over its base tile — only between its first hit (cracked) and
 *  second hit (shattered/removed), never on an intact or fully-broken
 *  crate. */
export function crateCrackOverlayVisible(hitsTaken: number): boolean {
  return hitsTaken === 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- Block.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/Block.ts src/themes/platformer/entities/Block.test.ts
git commit -m "feat(platformer): add block hit-state type and helpers (step 21 prep)"
```

---

### Task 2: Block bump/shatter animation stepping

**Files:**
- Create: `src/themes/platformer/engine/BlockAI.ts`
- Test: `src/themes/platformer/engine/BlockAI.test.ts`

**Interfaces:**
- Consumes: `BlockState` from `../entities/Block` (Task 1).
- Produces: `stepBlockAnimation(block, dt): BlockState`,
  `blockBumpOffsetY(block): number`, `crateShatterOpacity(block): number`,
  `BLOCK_BUMP_DURATION_SECONDS`, `CRATE_SHATTER_DURATION_SECONDS` — all consumed
  by Task 6 (rendering) and Task 7 (game loop).

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/engine/BlockAI.test.ts`:

```ts
import {
  stepBlockAnimation,
  blockBumpOffsetY,
  crateShatterOpacity,
  BLOCK_BUMP_DURATION_SECONDS,
  CRATE_SHATTER_DURATION_SECONDS,
} from './BlockAI';
import { toBlockState } from '../entities/Block';
import type { BlockState } from '../entities/Block';
import type { BlockPlacement } from '../level/BlockMapper';

function block(overrides: Partial<BlockState> = {}): BlockState {
  const placement: BlockPlacement = { id: 'b1', blockKind: 'rock', x: 0, y: 0 };
  return { ...toBlockState(placement), ...overrides };
}

describe('stepBlockAnimation', () => {
  it('idleBlock-isANoOp', () => {
    const b = block({ animState: 'idle' });
    expect(stepBlockAnimation(b, 1 / 60)).toBe(b);
  });

  it('bumping-midDuration-accumulatesTimerStaysInBump', () => {
    const b = block({ animState: 'bump', animTimer: 0 });
    const next = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS / 2);
    expect(next.animState).toBe('bump');
    expect(next.animTimer).toBeCloseTo(BLOCK_BUMP_DURATION_SECONDS / 2);
  });

  it('bumping-rockOrQuestionMark-durationElapsed-revertsToIdle', () => {
    const b = block({ blockKind: 'rock', hitsTaken: 1, animState: 'bump', animTimer: 0 });
    const next = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS);
    expect(next.animState).toBe('idle');
    expect(next.animTimer).toBe(0);
  });

  it('bumping-crateBelowMaxHits-durationElapsed-revertsToIdleNotShatter', () => {
    const b = block({ blockKind: 'crate', hitsTaken: 1, animState: 'bump', animTimer: 0 });
    const next = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS);
    expect(next.animState).toBe('idle');
  });

  it('bumping-crateAtMaxHits-durationElapsed-entersShatter', () => {
    const b = block({ blockKind: 'crate', hitsTaken: 2, animState: 'bump', animTimer: 0 });
    const next = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS);
    expect(next.animState).toBe('shatter');
    expect(next.animTimer).toBe(0);
  });

  it('shattering-midDuration-accumulatesTimerStaysInShatter', () => {
    const b = block({ blockKind: 'crate', hitsTaken: 2, animState: 'shatter', animTimer: 0 });
    const next = stepBlockAnimation(b, CRATE_SHATTER_DURATION_SECONDS / 2);
    expect(next.animState).toBe('shatter');
  });

  it('shattering-durationElapsed-revertsToIdle', () => {
    const b = block({ blockKind: 'crate', hitsTaken: 2, animState: 'shatter', animTimer: 0 });
    const next = stepBlockAnimation(b, CRATE_SHATTER_DURATION_SECONDS);
    expect(next.animState).toBe('idle');
  });

  it('durationSplitAcrossTwoTicks-stillCompletesCorrectly', () => {
    let b = block({ animState: 'bump', animTimer: 0 });
    b = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS * 0.6);
    expect(b.animState).toBe('bump');
    b = stepBlockAnimation(b, BLOCK_BUMP_DURATION_SECONDS * 0.6);
    expect(b.animState).toBe('idle');
  });
});

describe('blockBumpOffsetY', () => {
  it('idleBlock-returnsZero', () => {
    expect(blockBumpOffsetY(block({ animState: 'idle' }))).toBe(0);
  });
  it('shatteringBlock-returnsZero', () => {
    expect(blockBumpOffsetY(block({ animState: 'shatter' }))).toBe(0);
  });
  it('bumpStart-offsetIsZero', () => {
    expect(blockBumpOffsetY(block({ animState: 'bump', animTimer: 0 }))).toBe(0);
  });
  it('bumpMidpoint-offsetIsNegativeMaximum', () => {
    const offset = blockBumpOffsetY(block({ animState: 'bump', animTimer: BLOCK_BUMP_DURATION_SECONDS / 2 }));
    expect(offset).toBeLessThan(0);
  });
  it('bumpEnd-offsetReturnsToZero', () => {
    const offset = blockBumpOffsetY(block({ animState: 'bump', animTimer: BLOCK_BUMP_DURATION_SECONDS }));
    expect(offset).toBeCloseTo(0, 1);
  });
});

describe('crateShatterOpacity', () => {
  it('nonShatteringBlock-returnsFullOpacity', () => {
    expect(crateShatterOpacity(block({ animState: 'idle' }))).toBe(1);
    expect(crateShatterOpacity(block({ animState: 'bump' }))).toBe(1);
  });
  it('shatterStart-fullOpacity', () => {
    expect(crateShatterOpacity(block({ animState: 'shatter', animTimer: 0 }))).toBe(1);
  });
  it('shatterEnd-zeroOpacity', () => {
    expect(crateShatterOpacity(block({ animState: 'shatter', animTimer: CRATE_SHATTER_DURATION_SECONDS }))).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- BlockAI.test.ts`
Expected: FAIL — `./BlockAI` module doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/themes/platformer/engine/BlockAI.ts`:

```ts
import type { BlockState } from '../entities/Block';

/** How long the shared bump/nudge animation plays on every upward hit
 *  (FR-022d: "roughly 100ms"). */
export const BLOCK_BUMP_DURATION_SECONDS = 0.1;

/** How far the block nudges upward at the peak of its bump, in rendered px —
 *  small and quick, just enough to read as tactile feedback. */
export const BLOCK_BUMP_HEIGHT_PX = 6;

/** How long a crate's shatter (fade-out) plays after its terminal hit's bump
 *  finishes, before it's removed from the world. No dedicated shatter sprite
 *  sheet exists (same tileset gap step 20 already worked around) — a fade is
 *  built entirely from the already-loaded crate tile, no new asset needed. */
export const CRATE_SHATTER_DURATION_SECONDS = 0.25;

/**
 * Advances one block's shared bump/shatter animation by `dt` seconds. A no-op
 * (same reference) while `'idle'` — hit application (`Block.ts`'s
 * `applyBlockHit`) is what enters `'bump'` in the first place; this function
 * only ever advances/exits an animation already in progress, same
 * convention as `EnemyAI.ts`'s `stepEnemyHitReaction`.
 *
 * `'bump'` always transitions to `'idle'` once `BLOCK_BUMP_DURATION_SECONDS`
 * elapses — UNLESS this is a crate that just took its terminal (2nd) hit
 * (`blockKind === 'crate' && hitsTaken >= maxHitsForBlock('crate')`), in which
 * case it enters `'shatter'` instead. `'shatter'` (crate only) transitions
 * back to `'idle'` once `CRATE_SHATTER_DURATION_SECONDS` elapses; the caller
 * (`PlatformerPage.tsx`) is what actually removes a used-up block from the
 * world once `Block.ts`'s `isBlockRemoved` reports true for that final
 * `'idle'` state.
 */
export function stepBlockAnimation(block: BlockState, dt: number): BlockState {
  if (block.animState === 'bump') {
    const animTimer = block.animTimer + dt;
    if (animTimer < BLOCK_BUMP_DURATION_SECONDS) {
      return { ...block, animTimer };
    }
    if (block.blockKind === 'crate' && block.hitsTaken >= 2) {
      return { ...block, animTimer: 0, animState: 'shatter' };
    }
    return { ...block, animTimer: 0, animState: 'idle' };
  }
  if (block.animState === 'shatter') {
    const animTimer = block.animTimer + dt;
    if (animTimer < CRATE_SHATTER_DURATION_SECONDS) {
      return { ...block, animTimer };
    }
    return { ...block, animTimer: 0, animState: 'idle' };
  }
  return block;
}

/**
 * Vertical render offset (rendered px, negative = upward, matching the
 * canvas y axis) for the shared bump animation — a triangle wave rising to
 * `-BLOCK_BUMP_HEIGHT_PX` at the bump's midpoint and settling back to 0 by
 * its end, so the block visibly nudges up then drops back into place. Zero
 * outside `'bump'` (including `'shatter'` and `'idle'`, matching
 * `stepBlockAnimation`'s "no-op while idle" convention).
 */
export function blockBumpOffsetY(block: BlockState): number {
  if (block.animState !== 'bump') return 0;
  const t = Math.max(0, Math.min(1, block.animTimer / BLOCK_BUMP_DURATION_SECONDS));
  const phase = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
  return -BLOCK_BUMP_HEIGHT_PX * phase;
}

/**
 * Opacity (0-1) to draw a crate at — 1 (fully opaque) unless it's currently
 * `'shatter'`ing, in which case it linearly fades to 0 over
 * `CRATE_SHATTER_DURATION_SECONDS`. Meaningless for question-mark/rock (which
 * never enter `'shatter'`) — Renderer.ts only calls this for `blockKind ===
 * 'crate'`.
 */
export function crateShatterOpacity(block: BlockState): number {
  if (block.animState !== 'shatter') return 1;
  return Math.max(0, 1 - block.animTimer / CRATE_SHATTER_DURATION_SECONDS);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- BlockAI.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/BlockAI.ts src/themes/platformer/engine/BlockAI.test.ts
git commit -m "feat(platformer): add block bump/shatter animation stepping"
```

---

### Task 3: Detect which block a rising player's head hits

**Files:**
- Modify: `src/themes/platformer/level/BlockMapper.ts`
- Modify: `src/themes/platformer/entities/Player.ts`
- Modify: `src/themes/platformer/engine/Physics.ts`
- Modify (fixtures only, one line each): `src/themes/platformer/engine/Physics.test.ts`,
  `src/themes/platformer/engine/Collision.test.ts`,
  `src/themes/platformer/engine/Renderer.test.ts`,
  `src/themes/platformer/engine/DebugOverlay.test.ts`,
  `src/themes/platformer/entities/Player.test.ts`
- Test: `src/themes/platformer/level/BlockMapper.test.ts`,
  `src/themes/platformer/engine/Physics.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `blockIdAt(blockPlacements, col, row): string | undefined` (BlockMapper.ts,
  consumed by Physics.ts); `PlayerState.hitBlockIds: string[]` (consumed by Task 7).

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/level/BlockMapper.test.ts` (below the existing
`isBlockOccupied` describe block):

```ts
import { blockIdAt } from './BlockMapper'; // add to the existing top-of-file import instead

describe('blockIdAt', () => {
  it('tileMatchesABlockPlacement-returnsItsId', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [{ col: 5, row: 2 }], rock: [] });
    expect(blockIdAt(placed, 5, 2)).toBe(placed[0].id);
  });

  it('tileDoesNotMatchAnyBlockPlacement-returnsUndefined', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [{ col: 5, row: 2 }], rock: [] });
    expect(blockIdAt(placed, 6, 2)).toBeUndefined();
  });

  it('noPlacements-returnsUndefined', () => {
    expect(blockIdAt([], 5, 2)).toBeUndefined();
  });
});
```

Add to `src/themes/platformer/engine/Physics.test.ts`'s
`describe('stepPlayerPhysics block solidity', ...)` block (after the existing
`jumpingUpIntoABlockFromBelow-...` test):

```ts
  it('jumpingUpIntoABlockFromBelow-reportsItsIdInHitBlockIds', () => {
    const ceilingBottomY = 3 * RENDERED_TILE_SIZE;
    const restY = ceilingBottomY - PLAYER_HEAD_PADDING;
    const player = basePlayer({
      x: 2 * RENDERED_TILE_SIZE,
      y: restY + 1,
      vy: -1000,
      grounded: false,
    });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { jumpHeld: true }, blockAtCol2Row2);
    expect(next.hitBlockIds).toEqual([blockAtCol2Row2[0].id]);
  });

  it('jumpingUpIntoPlainTerrainCeiling-reportsNoHitBlockIds', () => {
    const next = stepPlayerPhysics(
      basePlayer({ x: 0, y: 1 * RENDERED_TILE_SIZE, vy: -1000, grounded: false }),
      parseLevel(['GGGG', '....', '....', 'GGGG']),
      1 / 60,
      { jumpHeld: true },
    );
    expect(next.hitBlockIds).toEqual([]);
  });

  it('walkingRightIntoABlock-doesNotReportItInHitBlockIds', () => {
    // A side collision must never register as a below-hit (spec.md
    // Acceptance Scenario 5: only upward hits from below trigger a reaction).
    const wallCol = 2;
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: restX - 1, y: 1 * RENDERED_TILE_SIZE, grounded: true });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { left: false, right: true }, blockAtCol2Row2);
    expect(next.hitBlockIds).toEqual([]);
  });

  it('landingOnTopOfABlockFromAbove-doesNotReportItInHitBlockIds', () => {
    const groundSurfaceY = 2 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({ x: 2 * RENDERED_TILE_SIZE, y: restY - 1, vy: 300 });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, {}, blockAtCol2Row2);
    expect(next.hitBlockIds).toEqual([]);
  });
```

Also add `hitBlockIds: []` to `Physics.test.ts`'s `basePlayer` (line ~31, next to
`bounceAscending: false,`), and the same one-line addition to `Collision.test.ts`'s
`makePlayer`, `Renderer.test.ts`, `DebugOverlay.test.ts`, and `Player.test.ts`'s
equivalent fixture object (each already has `bounceAscending: false,` at the exact
grep locations found during planning — add `hitBlockIds: [],` immediately after
it in each file).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- BlockMapper.test.ts Physics.test.ts`
Expected: FAIL — `blockIdAt` doesn't exist; `hitBlockIds` doesn't exist on
`PlayerState`/the returned object (and TypeScript compilation itself fails on the
fixture files until the field is added to `PlayerState` AND the fixtures, so expect
type errors, not just assertion failures, until Step 3 is fully done).

- [ ] **Step 3: Implement**

In `src/themes/platformer/level/BlockMapper.ts`, replace `isBlockOccupied` with:

```ts
/**
 * The id of the block placement occupying tile (col, row), if any — used by
 * Physics.ts to both treat the tile as solid AND report which specific block
 * a rising player's head just hit (roadmap step 21). `isBlockOccupied` below
 * is now a thin wrapper for call sites that only need the yes/no answer.
 */
export function blockIdAt(
  blockPlacements: readonly BlockPlacement[],
  col: number,
  row: number,
): string | undefined {
  const found = blockPlacements.find(
    (b) => Math.floor(b.x / RENDERED_TILE_SIZE) === col && Math.floor(b.y / RENDERED_TILE_SIZE) === row,
  );
  return found?.id;
}

/**
 * Whether any block placement occupies tile (col, row) — used by
 * Physics.ts to treat block-occupied tiles as solid, the same way terrain
 * tiles already are, even though blocks aren't part of the terrain grid.
 * Added 2026-08-29 (pulled forward from roadmap step 21, per live user
 * feedback): every block is solid from every direction regardless of kind.
 */
export function isBlockOccupied(
  blockPlacements: readonly BlockPlacement[],
  col: number,
  row: number,
): boolean {
  return blockIdAt(blockPlacements, col, row) !== undefined;
}
```

In `src/themes/platformer/entities/Player.ts`, add to `PlayerState` (right after
`knockbackTimer: number;`, before the `bounceAscending` doc comment):

```ts
  /**
   * Ids of every block whose underside was hit this tick (roadmap step 21) —
   * always freshly computed by `Physics.ts`'s ceiling-collision check, never
   * carried over from a previous tick (unlike `bounceAscending`). Empty on
   * every tick with no upward block collision. `PlatformerPage.tsx` reads
   * this once per tick to apply block hits/rewards, then it's naturally
   * replaced by next tick's fresh (usually empty) array.
   */
  hitBlockIds: string[];
```

In `src/themes/platformer/engine/Physics.ts`:

1. Change the import on line 4 from:
```ts
import { isBlockOccupied } from '../level/BlockMapper';
```
to:
```ts
import { isBlockOccupied, blockIdAt } from '../level/BlockMapper';
```

2. Replace the ceiling-collision branch (lines 206-223) with:

```ts
  const hitBlockIds: string[] = [];
  if (vy < 0) {
    // Ceiling collision: symmetric to the landing case below, but for the
    // player's head hitting a solid tile from underneath while rising.
    // PLAYER_HEAD_PADDING accounts for the transparent rows above the
    // sprite's actual head, so this triggers when the VISIBLE head reaches
    // the tile, not when the top of the (mostly-empty) frame does.
    // Uses isSolidExcludingBridge (not isSolid) so `bridge` tiles are
    // passable from underneath while remaining solid everywhere else
    // (roadmap step 7).
    const headY = y + PLAYER_HEAD_PADDING;
    const headRow = Math.floor(headY / RENDERED_TILE_SIZE);
    let ceilingResolved = false;
    for (let col = leftCol; col <= rightCol; col++) {
      const blockId = blockIdAt(blockPlacements, col, headRow);
      const solid = isSolidExcludingBridge(tileAt(level, col, headRow)) || blockId !== undefined;
      if (!solid) continue;
      // Position is resolved against only the FIRST solid column found
      // (matches the pre-existing single-collision behavior) — but every
      // column at this row is scanned so a block spanning any of them is
      // still reported in `hitBlockIds`, even if it wasn't the column that
      // stopped the ascent.
      if (!ceilingResolved) {
        y = (headRow + 1) * RENDERED_TILE_SIZE - PLAYER_HEAD_PADDING;
        resolvedVy = 0;
        ceilingResolved = true;
      }
      if (blockId !== undefined) hitBlockIds.push(blockId);
    }
  }
```

3. Add `hitBlockIds` to the returned object (after `bounceAscending`, the last
   field):

```ts
    bounceAscending: player.bounceAscending && resolvedVy < 0,
    hitBlockIds,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS across the whole suite (this touches `PlayerState`, so run the full
suite, not just the two files above, to catch any other fixture needing the new
field).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/BlockMapper.ts src/themes/platformer/level/BlockMapper.test.ts \
        src/themes/platformer/entities/Player.ts src/themes/platformer/engine/Physics.ts \
        src/themes/platformer/engine/Physics.test.ts src/themes/platformer/engine/Collision.test.ts \
        src/themes/platformer/engine/Renderer.test.ts src/themes/platformer/engine/DebugOverlay.test.ts \
        src/themes/platformer/entities/Player.test.ts
git commit -m "feat(platformer): report which block a rising player's head hits"
```

---

### Task 4: Bonus fruit (question-mark's spawned pickup)

**Files:**
- Create: `src/themes/platformer/entities/BonusFruit.ts`
- Modify: `src/themes/platformer/engine/Collision.ts`
- Test: `src/themes/platformer/entities/BonusFruit.test.ts`,
  `src/themes/platformer/engine/Collision.test.ts`

**Interfaces:**
- Consumes: `RENDERED_TILE_SIZE` from `../level/Terrain`; `FRUIT_RENDERED_SIZE` from
  `./Fruit`; `playerHitbox`/`aabbOverlap`/`Box` from `../engine/Collision`.
- Produces: `BonusFruitState`, `spawnBonusFruit(id, blockX, blockY)`,
  `tickBonusFruit(fruit, dt)`, `bonusFruitY(fruit)`,
  `BONUS_FRUIT_RISE_DURATION_SECONDS` (consumed by Task 6/7);
  `checkBonusFruitCollisions(player, fruits): string[]` (consumed by Task 7).

- [ ] **Step 1: Write the failing tests**

Create `src/themes/platformer/entities/BonusFruit.test.ts`:

```ts
import {
  spawnBonusFruit,
  tickBonusFruit,
  bonusFruitY,
  BONUS_FRUIT_RISE_DURATION_SECONDS,
} from './BonusFruit';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

describe('spawnBonusFruit', () => {
  it('called-startsAtBlockPositionWithZeroElapsed', () => {
    const fruit = spawnBonusFruit('f1', 100, 200);
    expect(fruit.id).toBe('f1');
    expect(fruit.x).toBe(100);
    expect(fruit.elapsed).toBe(0);
    expect(fruit.restY).toBe(200 - RENDERED_TILE_SIZE);
  });
});

describe('tickBonusFruit', () => {
  it('called-accumulatesElapsed', () => {
    const fruit = tickBonusFruit(spawnBonusFruit('f1', 0, 0), 0.1);
    expect(fruit.elapsed).toBeCloseTo(0.1);
  });
});

describe('bonusFruitY', () => {
  it('justSpawned-yEqualsStartingBlockY', () => {
    const fruit = spawnBonusFruit('f1', 0, 200);
    expect(bonusFruitY(fruit)).toBe(200);
  });

  it('riseDurationElapsed-yEqualsRestYOneTileHigher', () => {
    let fruit = spawnBonusFruit('f1', 0, 200);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS);
    expect(bonusFruitY(fruit)).toBe(200 - RENDERED_TILE_SIZE);
  });

  it('midRise-yIsBetweenStartAndRest', () => {
    let fruit = spawnBonusFruit('f1', 0, 200);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS / 2);
    const y = bonusFruitY(fruit);
    expect(y).toBeLessThan(200);
    expect(y).toBeGreaterThan(200 - RENDERED_TILE_SIZE);
  });

  it('pastRiseDuration-yStaysClampedAtRestY', () => {
    let fruit = spawnBonusFruit('f1', 0, 200);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS * 3);
    expect(bonusFruitY(fruit)).toBe(200 - RENDERED_TILE_SIZE);
  });
});
```

Add to `src/themes/platformer/engine/Collision.test.ts`:

```ts
import { checkBonusFruitCollisions } from './Collision'; // add to the existing import
import { spawnBonusFruit, tickBonusFruit, BONUS_FRUIT_RISE_DURATION_SECONDS } from '../entities/BonusFruit';
import { FRUIT_RENDERED_SIZE } from '../entities/Fruit';

describe('checkBonusFruitCollisions', () => {
  it('playerOverlapsRestedFruit-returnsItsId', () => {
    let fruit = spawnBonusFruit('bf1', 0, 100);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS);
    const player = makePlayer(0, 100 - RENDERED_TILE_SIZE);
    expect(checkBonusFruitCollisions(player, [fruit])).toEqual(['bf1']);
  });

  it('playerOverlapsStillRisingFruit-notYetCollectible', () => {
    const fruit = spawnBonusFruit('bf1', 0, 100); // elapsed 0, mid-rise
    const player = makePlayer(0, 100 - RENDERED_TILE_SIZE);
    expect(checkBonusFruitCollisions(player, [fruit])).toEqual([]);
  });

  it('playerFarFromFruit-returnsNoIds', () => {
    let fruit = spawnBonusFruit('bf1', 0, 100);
    fruit = tickBonusFruit(fruit, BONUS_FRUIT_RISE_DURATION_SECONDS);
    const player = makePlayer(1000, 1000);
    expect(checkBonusFruitCollisions(player, [fruit])).toEqual([]);
  });
});
```

(`RENDERED_TILE_SIZE` — add to `Collision.test.ts`'s existing `../level/Terrain`
import if not already present; `makePlayer` is the file's existing helper.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- BonusFruit.test.ts Collision.test.ts`
Expected: FAIL — `./BonusFruit` doesn't exist; `checkBonusFruitCollisions` isn't
exported from `Collision.ts`.

- [ ] **Step 3: Implement**

Create `src/themes/platformer/entities/BonusFruit.ts`:

```ts
import { RENDERED_TILE_SIZE } from '../level/Terrain';

/** How long a bonus fruit takes to rise from its spawning block up into the
 *  empty tile directly above it before settling as a touchable pickup
 *  (spec.md Acceptance Scenario 3 — "pops upward into the space directly
 *  above the block"). */
export const BONUS_FRUIT_RISE_DURATION_SECONDS = 0.3;

/**
 * A question-mark block's spawned reward (spec.md's "Bonus pickup" glossary
 * entry) — unlike `CollectiblePlacement`, it carries no CV fact and is never
 * added to `collectedFacts`/`collectedCollectibleIds`. `x` is fixed at the
 * source block's x (fruits only rise straight up, never drift horizontally);
 * `restY` is one tile above the block's `y`, matching level1's reserved
 * blank row above every `Q` marker.
 */
export interface BonusFruitState {
  id: string;
  x: number;
  restY: number;
  /** Seconds elapsed since spawning — drives the rise tween via
   *  `bonusFruitY`; once it reaches `BONUS_FRUIT_RISE_DURATION_SECONDS` the
   *  fruit has finished rising and become a touchable pickup. */
  elapsed: number;
  /** The block's y at spawn time — `bonusFruitY` eases from here to `restY`. */
  startY: number;
}

/** Spawns a bonus fruit at the position of the question-mark block that was
 *  just hit (`blockX`/`blockY`), reusing the block's own id as the fruit's id
 *  — a question-mark only ever spawns one fruit in its lifetime (it stops
 *  responding to hits after the first), so there's no collision risk. */
export function spawnBonusFruit(id: string, blockX: number, blockY: number): BonusFruitState {
  return { id, x: blockX, startY: blockY, restY: blockY - RENDERED_TILE_SIZE, elapsed: 0 };
}

/** Advances the fruit's rise timer by `dt` seconds. Never removes/clamps
 *  anything itself — `bonusFruitY` is what clamps the visual position once
 *  fully risen, and `Collision.ts`'s `checkBonusFruitCollisions` is what
 *  gates pickup on the rise being finished. */
export function tickBonusFruit(fruit: BonusFruitState, dt: number): BonusFruitState {
  return { ...fruit, elapsed: fruit.elapsed + dt };
}

/** Current world-space y for rendering/collision — eases linearly from the
 *  spawning block's y up to `restY` over `BONUS_FRUIT_RISE_DURATION_SECONDS`,
 *  then holds at `restY` forever after. */
export function bonusFruitY(fruit: BonusFruitState): number {
  const progress = Math.max(0, Math.min(1, fruit.elapsed / BONUS_FRUIT_RISE_DURATION_SECONDS));
  return fruit.startY + (fruit.restY - fruit.startY) * progress;
}
```

In `src/themes/platformer/engine/Collision.ts`, add the import (near the top,
alongside the other entity imports):

```ts
import { bonusFruitY, BONUS_FRUIT_RISE_DURATION_SECONDS } from '../entities/BonusFruit';
import type { BonusFruitState } from '../entities/BonusFruit';
import { FRUIT_RENDERED_SIZE } from '../entities/Fruit';
```

and append this function at the end of the file:

```ts
/**
 * Returns the ids of every bonus fruit the player's hitbox currently
 * overlaps AND that has finished rising (`elapsed >=
 * BONUS_FRUIT_RISE_DURATION_SECONDS`) — spec.md's "lands as a touchable
 * pickup", i.e. not collectible mid-rise. Unlike
 * `checkCollectibleCollisions`, there's no `collectedIds` dedup set here:
 * `PlatformerPage.tsx` removes a touched bonus fruit from its live array
 * entirely the same tick, so it simply can't be checked against again.
 */
export function checkBonusFruitCollisions(
  player: PlayerState,
  fruits: readonly BonusFruitState[],
): string[] {
  const hitbox = playerHitbox(player);
  const hits: string[] = [];
  for (const fruit of fruits) {
    if (fruit.elapsed < BONUS_FRUIT_RISE_DURATION_SECONDS) continue;
    const box: Box = { x: fruit.x, y: bonusFruitY(fruit), width: FRUIT_RENDERED_SIZE, height: FRUIT_RENDERED_SIZE };
    if (aabbOverlap(hitbox, box)) hits.push(fruit.id);
  }
  return hits;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- BonusFruit.test.ts Collision.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/BonusFruit.ts src/themes/platformer/entities/BonusFruit.test.ts \
        src/themes/platformer/engine/Collision.ts src/themes/platformer/engine/Collision.test.ts
git commit -m "feat(platformer): add bonus fruit rise/pickup mechanics"
```

---

### Task 5: Wire block/bonus-fruit state into PlatformerState

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`

**Interfaces:**
- Consumes: `toBlockState` (Task 1), `BlockState` (Task 1), `BonusFruitState`
  (Task 4).
- Produces: `blockStates` signal, `bonusFruitStates` signal — consumed by Task 7
  (`PlatformerPage.tsx`) in place of the old `blockPlacements` import there.

This task has no new pure logic to unit-test in isolation (it's signal
wiring/module-load seeding, matching how `enemyStates`/`collectiblePlacements` are
already wired with no dedicated test file of their own) — verified instead by
Task 7's manual browser check and by the full suite staying green.

- [ ] **Step 1: Implement**

In `src/themes/platformer/PlatformerState.ts`:

1. Add to the imports:

```ts
import { toEnemyState } from './entities/Enemy';
import type { EnemyState } from './entities/Enemy';
import { toBlockState } from './entities/Block';
import type { BlockState } from './entities/Block';
import type { BonusFruitState } from './entities/BonusFruit';
```

2. Add `hitBlockIds: []` to `spawnPlayerState()`'s returned object (after
   `bounceAscending: false,`):

```ts
    bounceAscending: false,
    hitBlockIds: [],
  };
}
```

3. After the existing `enemyStates` signal declaration, add:

```ts
/**
 * Live, per-frame hit/animation state for every block — mirrors
 * `enemyStates` above. Seeded from `blockPlacements` (module load) and
 * reset back to that seed only by `resetGameProgress()` (the Reset Game
 * button), NOT by `resetGame()` (death/respawn) — per this file's
 * `resetGame()` doc comment, blocks behave like collectibles (progress
 * persists across a respawn), not like enemies (which do revive on
 * respawn).
 */
export const blockStates = signal<BlockState[]>(blockPlacements.map(toBlockState));

/**
 * Question-mark blocks' spawned no-fact bonus fruits (roadmap step 21b) —
 * starts empty; `PlatformerPage.tsx` appends one each time a question-mark
 * block is hit. Persists across a death/respawn (same reasoning as
 * `blockStates` above); cleared only by `resetGameProgress()`.
 */
export const bonusFruitStates = signal<BonusFruitState[]>([]);
```

4. In `resetGameProgress()`, add (after the existing `activeEffects.value = [];`):

```ts
  blockStates.value = blockPlacements.map(toBlockState);
  bonusFruitStates.value = [];
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npm run build` (or the project's `tsc --noEmit` script if one exists —
check `package.json`)
Expected: type errors only in `PlatformerPage.tsx` (Task 7 fixes those) and none
in `PlatformerState.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts
git commit -m "feat(platformer): add blockStates/bonusFruitStates signals"
```

---

### Task 6: Rendering — bump offset, crack overlay, shatter fade, `!` tile, bonus fruit

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `BlockState` (Task 1), `blockBumpOffsetY`/`crateShatterOpacity` (Task 2),
  `BonusFruitState`/`bonusFruitY` (Task 4).
- Produces: `drawBlocks(ctx, blocks, tileset, crackOverlaySprite, originX, originY)`
  (signature change — consumed by Task 7), `drawBonusFruits(ctx, fruits, fruitSprite,
  originX, originY)` (new — consumed by Task 7).

Check `Renderer.test.ts` first for how `drawBlocks`/`drawEnemies` are currently
tested (per the plan's research: canvas-drawing functions are tested for "doesn't
throw" / correct frame-source lookups, not literal `ctx.drawImage` call
assertions) — match that existing convention exactly rather than introducing a
canvas-mocking approach this file doesn't already use.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/engine/Renderer.test.ts` (mirroring however the
existing `drawBlocks`/`drawEnemies` tests there are structured — read the file's
current `drawBlocks` describe block first and follow its exact pattern for
constructing a fake `CanvasRenderingContext2D`/`HTMLImageElement`):

```ts
import { toBlockState } from '../entities/Block';
import type { BlockPlacement } from '../level/BlockMapper';
import { spawnBonusFruit } from '../entities/BonusFruit';

describe('drawBlocks with hit state', () => {
  it('crateWithOneHitAndCrackOverlaySprite-doesNotThrow', () => {
    const placement: BlockPlacement = { id: 'c1', blockKind: 'crate', x: 0, y: 0 };
    const state = { ...toBlockState(placement), hitsTaken: 1 };
    expect(() => drawBlocks(fakeCtx, [state], fakeTileset, fakeCrackOverlay)).not.toThrow();
  });

  it('crateWithNoHitsAndNullCrackOverlaySprite-doesNotThrow', () => {
    const placement: BlockPlacement = { id: 'c1', blockKind: 'crate', x: 0, y: 0 };
    const state = toBlockState(placement);
    expect(() => drawBlocks(fakeCtx, [state], fakeTileset, null)).not.toThrow();
  });

  it('questionMarkAfterHit-doesNotThrow', () => {
    const placement: BlockPlacement = { id: 'q1', blockKind: 'questionMark', x: 0, y: 0 };
    const state = { ...toBlockState(placement), hitsTaken: 1 };
    expect(() => drawBlocks(fakeCtx, [state], fakeTileset, null)).not.toThrow();
  });

  it('bumpingBlock-doesNotThrow', () => {
    const placement: BlockPlacement = { id: 'r1', blockKind: 'rock', x: 0, y: 0 };
    const state = { ...toBlockState(placement), animState: 'bump' as const, animTimer: 0.05 };
    expect(() => drawBlocks(fakeCtx, [state], fakeTileset, null)).not.toThrow();
  });

  it('shatteringCrate-doesNotThrow', () => {
    const placement: BlockPlacement = { id: 'c1', blockKind: 'crate', x: 0, y: 0 };
    const state = { ...toBlockState(placement), hitsTaken: 2, animState: 'shatter' as const, animTimer: 0.1 };
    expect(() => drawBlocks(fakeCtx, [state], fakeTileset, null)).not.toThrow();
  });
});

describe('drawBonusFruits', () => {
  it('someFruits-doesNotThrow', () => {
    const fruit = spawnBonusFruit('bf1', 0, 100);
    expect(() => drawBonusFruits(fakeCtx, [fruit], fakeFruitSprite)).not.toThrow();
  });

  it('nullFruitSprite-doesNotThrow', () => {
    const fruit = spawnBonusFruit('bf1', 0, 100);
    expect(() => drawBonusFruits(fakeCtx, [fruit], null)).not.toThrow();
  });
});
```

(Replace `fakeCtx`/`fakeTileset`/`fakeCrackOverlay`/`fakeFruitSprite` with
whatever the file's existing `drawBlocks`/`drawEnemies` tests already use as
their canvas-context/image fakes — do not invent a new mocking approach.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- Renderer.test.ts`
Expected: FAIL — `drawBlocks` doesn't yet accept `BlockState[]`/a 4th
`crackOverlaySprite` parameter; `drawBonusFruits` isn't exported.

- [ ] **Step 3: Implement**

In `src/themes/platformer/engine/Renderer.ts`:

1. Update imports (replace the existing `Block.ts`/`BlockMapper.ts` imports):

```ts
import { BLOCK_FRAME_SIZE, BLOCK_RENDERED_SIZE, blockFrameSource, crateCrackOverlayVisible } from '../entities/Block';
import type { BlockState } from '../entities/Block';
import { blockBumpOffsetY, crateShatterOpacity } from './BlockAI';
import { bonusFruitY } from '../entities/BonusFruit';
import type { BonusFruitState } from '../entities/BonusFruit';
import { FRUIT_FRAME_SIZE, FRUIT_RENDERED_SIZE, fruitFrameSource } from '../entities/Fruit';
```

(`FRUIT_FRAME_SIZE`/`fruitFrameSource` may already be imported above for
`drawCollectibles` — add `FRUIT_RENDERED_SIZE` to that existing import instead of
duplicating it if so.)

2. Replace `drawBlocks` (lines 433-465) with:

```ts
/**
 * Draws every live block — its current sprite frame (accounting for a
 * question-mark's permanent `?`→`!` swap once hit, via `blockFrameSource`'s
 * `hitsTaken` param), the shared bump nudge offset, a crate's crack overlay
 * (composited as a second draw call — it's a standalone sprite, not part of
 * `world_tileset.png`) while cracked, and a crate's shatter fade-out while
 * breaking apart. Roadmap step 21 (steps 21a/21b/21c) — extends step 20's
 * intact-only render.
 */
export function drawBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: readonly BlockState[],
  tileset: HTMLImageElement,
  crackOverlaySprite: HTMLImageElement | null,
  originX = 0,
  originY = 0,
): void {
  ctx.imageSmoothingEnabled = false;

  for (const block of blocks) {
    const { sx, sy } = blockFrameSource(block.blockKind, block.hitsTaken);
    const dx = block.x + originX;
    const dy = block.y + originY + blockBumpOffsetY(block);
    const opacity = block.blockKind === 'crate' ? crateShatterOpacity(block) : 1;

    ctx.globalAlpha = opacity;
    ctx.drawImage(tileset, sx, sy, BLOCK_FRAME_SIZE, BLOCK_FRAME_SIZE, dx, dy, BLOCK_RENDERED_SIZE, BLOCK_RENDERED_SIZE);
    if (block.blockKind === 'crate' && crackOverlaySprite && crateCrackOverlayVisible(block.hitsTaken)) {
      ctx.drawImage(
        crackOverlaySprite,
        0,
        0,
        BLOCK_FRAME_SIZE,
        BLOCK_FRAME_SIZE,
        dx,
        dy,
        BLOCK_RENDERED_SIZE,
        BLOCK_RENDERED_SIZE,
      );
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Draws every question-mark block's spawned bonus fruit (roadmap step 21b) at
 * its current rise-tween position, reusing `fruit.png` (index 0 — a bonus
 * fruit carries no CV mapping, so there's no per-item icon to select).
 */
export function drawBonusFruits(
  ctx: CanvasRenderingContext2D,
  fruits: readonly BonusFruitState[],
  fruitSprite: HTMLImageElement | null,
  originX = 0,
  originY = 0,
): void {
  if (!fruitSprite) return;
  ctx.imageSmoothingEnabled = false;
  const { sx, sy } = fruitFrameSource(0);
  for (const fruit of fruits) {
    ctx.drawImage(
      fruitSprite,
      sx,
      sy,
      FRUIT_FRAME_SIZE,
      FRUIT_FRAME_SIZE,
      fruit.x + originX,
      bonusFruitY(fruit) + originY,
      FRUIT_RENDERED_SIZE,
      FRUIT_RENDERED_SIZE,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- Renderer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): render block hit reactions and bonus fruit"
```

---

### Task 7: Wire hit mechanics into the game loop

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-6 (`blockStates`/`bonusFruitStates` from
  PlatformerState.ts; `applyBlockHit`/`isBlockUsedUp`/`isBlockRemoved` from
  Block.ts; `stepBlockAnimation` from BlockAI.ts; `spawnBonusFruit`/
  `tickBonusFruit` from BonusFruit.ts; `checkBonusFruitCollisions` from
  Collision.ts; `drawBlocks`/`drawBonusFruits` from Renderer.ts).
- Produces: the fully wired feature — no new exports (this is the top-level page
  component).

No new unit tests here — `PlatformerPage.tsx` has no existing test file (it's a
canvas-driven page component exercised via the manual browser check, matching
every prior roadmap step's convention: the game-loop wiring itself is verified by
Task 8's manual pass, while every piece of logic it calls was unit-tested in
Tasks 1-4/6 above).

- [ ] **Step 1: Update imports**

In `src/themes/platformer/PlatformerPage.tsx`:

Replace:
```ts
import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawCollectionEffects,
  drawCollectibleCounter,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
  RESTART_PROMPT_FONT_URL,
  HEARTS_START_X,
} from './engine/Renderer';
```
with:
```ts
import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawBonusFruits,
  drawCollectionEffects,
  drawCollectibleCounter,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
  RESTART_PROMPT_FONT_URL,
  HEARTS_START_X,
} from './engine/Renderer';
```

Replace:
```ts
import {
  checkCollectibleCollisions,
  checkEnemyStompCollisions,
  checkEnemySideCollisions,
} from './engine/Collision';
```
with:
```ts
import {
  checkCollectibleCollisions,
  checkEnemyStompCollisions,
  checkEnemySideCollisions,
  checkBonusFruitCollisions,
} from './engine/Collision';
```

Add:
```ts
import { stepBlockAnimation } from './engine/BlockAI';
import { applyBlockHit, isBlockUsedUp, isBlockRemoved } from './entities/Block';
import { spawnBonusFruit, tickBonusFruit } from './entities/BonusFruit';
```

Replace:
```ts
import {
  playerState,
  cameraPositionX,
  healthState,
  lifecycleState,
  spawnCenter,
  resetGame,
  resetGameProgress,
  collectiblePlacements,
  enemyPlacements,
  enemyStates,
  blockPlacements,
  collectedCollectibleIds,
  activeEffects,
  collectedFacts,
} from './PlatformerState';
```
with:
```ts
import {
  playerState,
  cameraPositionX,
  healthState,
  lifecycleState,
  spawnCenter,
  resetGame,
  resetGameProgress,
  collectiblePlacements,
  enemyPlacements,
  enemyStates,
  blockStates,
  bonusFruitStates,
  collectedCollectibleIds,
  activeEffects,
  collectedFacts,
} from './PlatformerState';
```

- [ ] **Step 2: Add a `crackOverlaySpriteRef` and load `crack_overlay.png`**

Add a new ref alongside the existing sprite refs (near `slimePurpleSpriteRef`):

```ts
  const crackOverlaySpriteRef = useRef<HTMLImageElement | null>(null);
```

Add a new `loadImage` call alongside the existing ones (near the `slime_purple.png`
load):

```ts
    loadImage('/sprites/crack_overlay.png')
      .then((img) => {
        if (cancelled) return;
        crackOverlaySpriteRef.current = img;
        render();
      })
      .catch(() => {
        // A cracked crate simply won't show its overlay if this fails to
        // load; the base crate tile and every other mechanic still work.
      });
```

- [ ] **Step 3: Update `render()`'s block/bonus-fruit drawing**

Replace:
```ts
      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current, originX, originY);
        drawBlocks(ctx, blockPlacements, tilesetRef.current, originX, originY);
      }
```
with:
```ts
      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current, originX, originY);
        drawBlocks(ctx, blockStates.value, tilesetRef.current, crackOverlaySpriteRef.current, originX, originY);
      }
```

Add, right after the existing `drawEnemies(...)` block (before
`drawCollectionEffects(ctx, activeEffects.value);`):

```ts
      if (fruitSpriteRef.current) {
        drawBonusFruits(ctx, bonusFruitStates.value, fruitSpriteRef.current, originX, originY);
      }
```

- [ ] **Step 4: Pass live block state (not the static placements) to physics**

The existing `let next = stepPlayerPhysics(...)` call passes `blockPlacements` as
its 5th argument — that import no longer exists (Step 1 above replaced it with
`blockStates`/`bonusFruitStates`), and passing the static array would also be
wrong now: a used-up, removed crate/rock must stop being solid, which only the
live, filtered `blockStates.value` reflects. `BlockState` structurally satisfies
`BlockPlacement` (it extends it), so no cast is needed — replace the call's last
argument:

```ts
      let next = stepPlayerPhysics(
        playerState.value,
        level1,
        dt,
        {
          ...horizontal,
          jumpPressed,
          jumpHeld,
          dropThroughHeld,
          suppressJumpCut: stompBounceThisTick,
        },
        blockStates.value,
      );
```

- [ ] **Step 5: Step block animation + bonus-fruit rise every tick, filter removed blocks**

In the `createGameLoop((dt) => { ... })` callback, right after the existing
enemy patrol/hit-reaction step (`enemyStates.value = enemyStates.value.map(...)`)
and its closing `});`, add:

```ts
      // Blocks currently playing their shared bump/shatter reaction advance
      // it here every tick, same convention as the enemy hit-reaction step
      // just above — a used-up crate/rock is filtered out of the live array
      // once its animation settles back to 'idle' (Block.ts's
      // isBlockRemoved); a used-up question-mark is NEVER filtered (it stays
      // solid forever, permanently showing its `!` tile — see Block.ts's
      // doc comment).
      blockStates.value = blockStates.value
        .map((block) => stepBlockAnimation(block, dt))
        .filter((block) => !isBlockRemoved(block));

      // Bonus fruits (roadmap step 21b) rise on their own fixed timer,
      // independent of anything else this tick.
      bonusFruitStates.value = bonusFruitStates.value.map((fruit) => tickBonusFruit(fruit, dt));
```

- [ ] **Step 6: Check bonus-fruit pickups alongside the existing collectible check**

Right after the existing `checkCollectibleCollisions(...)`/`if (touchedIds.length
> 0) { ... }` block (before the `const stompedIds = checkEnemyStompCollisions(...)`
line), add:

```ts
      // Bonus fruits carry no CV fact (spec.md's "Bonus pickup" glossary
      // entry) — touching one is a plain, silent removal, unlike every other
      // collectible/reward path in this file, which all push into
      // `collectedFacts`/`activeEffects`. No counter, no journal entry.
      const touchedBonusFruitIds = checkBonusFruitCollisions(playerState.value, bonusFruitStates.value);
      if (touchedBonusFruitIds.length > 0) {
        bonusFruitStates.value = bonusFruitStates.value.filter(
          (fruit) => !touchedBonusFruitIds.includes(fruit.id),
        );
      }
```

- [ ] **Step 7: Apply block hits + spawn bonus fruit + reveal crate fact**

Right after the `let next = stepPlayerPhysics(...)` call (before the `if
(checkPitFall(next, level1)) { ... }` block), add:

```ts
      // Block hit mechanics (roadmap step 21): `next.hitBlockIds` (set by
      // Physics.ts's ceiling-collision check, same call above) reports every
      // block whose underside the player's head just hit this tick — but
      // only a block that ISN'T already used up actually reacts (a
      // question-mark that already popped its fruit, or a still-mid-bump
      // crate/rock about to be filtered out, must not register a second hit
      // just because the player's head is still under it this frame).
      const hittableBlockIds = next.hitBlockIds.filter((id) => {
        const block = blockStates.value.find((b) => b.id === id);
        return block !== undefined && !isBlockUsedUp(block);
      });
      if (hittableBlockIds.length > 0) {
        blockStates.value = blockStates.value.map((block) =>
          hittableBlockIds.includes(block.id) ? applyBlockHit(block) : block,
        );

        const originX = -cameraPositionX.value;
        const levelPixelHeight = level1.height * RENDERED_TILE_SIZE;
        const originY = canvas.height - levelPixelHeight;
        const journalRect = journalButtonRef.current?.getBoundingClientRect();
        const targetX = journalRect ? journalRect.left + journalRect.width / 2 : canvas.width - 32;
        const targetY = journalRect ? journalRect.top + journalRect.height / 2 : canvas.height - 32;
        const midX = canvas.width / 2;
        const midY = canvas.height * 0.3;

        for (const id of hittableBlockIds) {
          const block = blockStates.value.find((b) => b.id === id);
          if (!block) continue;

          if (block.blockKind === 'questionMark') {
            bonusFruitStates.value = [...bonusFruitStates.value, spawnBonusFruit(block.id, block.x, block.y)];
          }

          if (block.blockKind === 'crate' && block.hitsTaken >= 2 && block.fact) {
            // Dedup by fact id, same defensive guard the enemy-defeat reward
            // already uses (FR-020c) — not actually reachable for crates
            // today (they never reset mid-session), but keeps the two reward
            // paths consistent.
            if (!collectedFacts.value.some((f) => f.id === block.fact!.id)) {
              const label = isSkillCategoryFact(block.fact.data)
                ? block.fact.data.category
                : ('name' in block.fact.data ? block.fact.data.name : block.fact.sectionLabel);
              const flag = 'flag' in block.fact.data ? block.fact.data.flag : undefined;
              const icon = typeof flag === 'string' ? flag : SECTION_ICON[block.fact.sectionId];
              const slot = nextTextSlot;
              nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
              const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
              collectedFacts.value = [...collectedFacts.value, block.fact];
              activeEffects.value = [
                ...activeEffects.value,
                startFlightEffect(
                  block.id,
                  label,
                  block.x + originX,
                  block.y + originY + stackOffsetY,
                  midX,
                  midY + stackOffsetY,
                  targetX,
                  targetY,
                  icon,
                ),
              ];
            }
          }
        }
      }
```

- [ ] **Step 8: Type-check and run the full test suite**

Run: `npm run build` (or the project's type-check script) and `npm run test`
Expected: PASS with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx
git commit -m "feat(platformer): wire block hit mechanics into the game loop"
```

---

### Task 8: Manual browser verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and open the Platformer theme**

Use the project's dev server (see `.claude/launch.json` if one exists, otherwise
`npm run dev`) and navigate to the Platformer theme. Open with `?debug=hitboxes`
to help line up jumps precisely against `level1`'s crate/question-mark/rock
markers (cols 19-24, row 1 — see level1.ts).

- [ ] **Step 2: Verify crate (21a)**

Walk to the first crate (col 19) and jump up into it from directly below.
Confirm: the block visibly nudges up and settles (bump), and the crack overlay
appears composited over the crate tile. Jump into it again: confirm a
shatter/fade plays, the block disappears, and the Experience or Education fact
text floats up and flies to the journal icon (open the journal to confirm the
fact is listed).

- [ ] **Step 3: Verify question-mark (21b)**

Jump up into the first question-mark block (col 20). Confirm: the bump plays, a
fruit pops up into the empty tile directly above the block and becomes visible,
and the block's tile permanently changes to `!`. Walk into the risen fruit and
confirm it disappears on touch. Jump into the block again and confirm nothing
happens (no bump, no second fruit).

- [ ] **Step 4: Verify rock (21c)**

Jump up into the first rock block (col 21). Confirm: the bump plays briefly and
the block disappears immediately after, with no fruit, no fact, and no counter
change anywhere in the HUD.

- [ ] **Step 5: Verify hit-direction gating (Acceptance Scenario 5)**

For each of the three block types, walk into it from the side and land on top of
it from above. Confirm neither direction triggers any reaction (no bump, no
crack, no fruit, no removal) — only an upward hit from below does. Confirm all
three remain solid from every direction throughout (standing on top, blocked
from the side) exactly as they were before this step.

- [ ] **Step 6: Regression-check the second copy of each block type (cols 22-24)**

Repeat steps 2-4 against the second crate/question-mark/rock (cols 22/23/24) to
confirm hit state is tracked per-instance, not shared/global.

- [ ] **Step 7: Update the roadmap**

Once every check above passes, check off step 21 (and its 21a/21b/21c
sub-bullets) in `specs/S-006-platformer-theme/roadmap.md` (`- [ ]` → `- [x]`),
following this repo's existing convention for closing out a roadmap step.
