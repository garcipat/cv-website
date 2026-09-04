# Coin-Pot Container Block (Roadmap Step 37) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `coinPot` block kind — destroyed by landing on top of it (not hit from below, unlike every other block), dropping a real walk-over coin at its tile that reveals a skill-category CV fact — with adjacent pots visually merging into one bunch using only the 3 existing single-pot sprites.

**Architecture:** `coinPot` follows the existing `BlockType`/`BlockDef`/`BlockPlacement` pattern (see `Crate.ts`/`QuestionMark.ts`/`FragileRock.ts`), but needs two genuinely new pieces of engine plumbing no existing block needs: (1) a "landed on top" collision path in `Physics.ts`, parallel to the existing "hit from below" `hitBlockIds`, and (2) a small, explicitly-scoped exception to "a block draws only itself" — one pure function (`computeCoinPotRenderPlan`) looks at every live coin-pot each frame to decide which of the 3 sprite variants each tile shows and where to draw extra "filler" pots so adjacent pots read as one merged cluster. Its reward reuses the exact same skill-category `CollectibleDef` pool `mapCVDataToCollectibles` already produces for walk-over coins — a coin-pot marker just claims a leftover def a `C` marker didn't already claim.

**Tech Stack:** TypeScript, Vitest + React Testing Library (existing stack, no new dependencies).

**Spec:** This plan's own "Design" section below (the full design was worked out interactively in chat, including sprite-sheet grid mapping and mockup verification — no separate written design doc exists for this step; the roadmap entry at `specs/S-006-platformer-theme/roadmap.md`'s step 37 is the one-line pointer).

## Design (agreed and mockup-verified before this plan was written)

- **Trigger:** landing on top (not hitting from below). One hit destroys it (`maxHits: 1`, `removeWhenUsedUp: true`, like `FragileRock`). Solid from every side, like every block.
- **Bounce:** a new `PHYSICS_CONFIG.coinPotBounceVelocity`, weaker than the enemy-stomp `stompBounceVelocity` (-330) but with more hang-time than the purple-slime-defense `awayAndUpKnockbackVy` (-150) — long enough to actually see the coin land.
- **Reward:** on destruction, a real walk-over `Coin` collectible appears at that tile (same mechanism as any other coin — walk over it, reveal its skill-category fact). The fact comes from the SAME 16-category pool `mapCVDataToCollectibles` produces for walk-over `C` coins: a level's `C` markers claim the first N defs in category order, and coin-pot (`u`) markers claim the remainder — no double-counting, no new CVData mapping.
- **Rendering:** uses only the 3 single-pot sprites at `staticObjects.png` row 7 (native tile row index 7, i.e. pixel y=112): column 0 = small round jar (sx=0,sy=112), column 1 = tall narrow urn (sx=16,sy=112), column 2 = wide square brick urn (sx=32,sy=112). The 2-tile-wide "cluster" sprite at row 8 is explicitly NOT used. Every live coin-pot tile draws its own base pot; every pair of horizontally-adjacent live coin-pot tiles (same row) also gets one "filler" pot centered on the shared seam, drawn on top. Consecutive rendered pots (base and filler alike) cycle through one of the 6 permutations of the 3 variants (seeded off the run's leftmost column) so no two neighbors ever repeat, and a run of exactly 2 tiles (3 rendered slots) shows all 3 variants exactly once. This is recomputed fresh every frame from the live block list, so destroying one tile immediately reshuffles how its former neighbors render.
- **Explicitly out of scope for this step** (confirmed too large / unnecessary): splitting skill categories into per-skill coins (189 skills vs. 16 categories today), any dedicated multi-tile-wide cluster art or block.

## Global Constraints

- TypeScript strict mode, no `any` (constitution Principle I).
- TDD: tests before implementation, every test passing before moving on (constitution Principle II).
- Named arrow function exports, typed props/params inline, no default exports (constitution Principle III) — this plan touches no React components directly, but any helper functions follow the same named-export convention already used throughout `src/themes/platformer/`.
- No new dependencies.
- Update `specs/S-006-platformer-theme/roadmap.md` (check off step 37) and `docs/Features.md` per `CLAUDE.md`'s feature-completion-tracking rules once implementation + tests are done and manually verified in the browser — this platformer roadmap step is tracked in `roadmap.md`, not `docs/Features.md`'s F/S/O feature list, so only the roadmap checkbox needs updating (confirm `docs/Features.md` has no matching entry before skipping it).

---

## File Structure

New files:
- `src/themes/platformer/entities/blocks/CoinPot.ts` — the `BlockType` implementation.
- `src/themes/platformer/entities/blocks/CoinPot.test.ts` — its own tests (frame fallback, sprite constants).
- `src/themes/platformer/entities/blocks/coinPotRenderPlan.ts` — the pure per-frame adjacency/variant computation.
- `src/themes/platformer/entities/blocks/coinPotRenderPlan.test.ts` — its tests (this is where most of the interesting logic lives and must be thoroughly covered).

Modified files (grouped by task below): `entities/Player.ts`, `engine/PhysicsConfig.ts`, `engine/Physics.ts` + its test, `types.ts`, `entities/Block.ts`, `level/LevelParser.ts` + its test, `level/BlockMapper.ts` + its test, `level/level.ts`, `entities/blocks/index.ts`, `engine/DrawContext.ts`, `PlatformerState.ts` + its test, `PlatformerPage.tsx` + its test, `components/Journal.tsx`, `level/level.ts`'s `LEVEL_1_LAYOUT`, plus every file constructing a full `PlayerState` object literal (a new required field ripples there — see Task 3).

---

### Task 1: `PHYSICS_CONFIG.coinPotBounceVelocity`

**Files:**
- Modify: `src/themes/platformer/engine/PhysicsConfig.ts`

**Interfaces:**
- Produces: `PHYSICS_CONFIG.coinPotBounceVelocity: number`, consumed by Task 8 (PlatformerPage.tsx's landed-block handling).

There's no dedicated `PhysicsConfig.test.ts` (verify with `ls src/themes/platformer/engine/PhysicsConfig.test.ts` — it doesn't exist; every other physics constant is exercised indirectly through `Physics.test.ts`/`PlatformerPage.test.tsx`), so this task has no test of its own — Task 8's tests exercise the constant's effect.

- [ ] **Step 1: Add the constant with its tunneling-invariant doc comment**

In `src/themes/platformer/engine/PhysicsConfig.ts`, add after `awayAndUpKnockbackVy` (before the closing `} as const;`):

```ts
  /**
   * Upward velocity impulse applied to the player on destroying a coin-pot
   * by landing on it, in px/s (negative = up) — weaker than the enemy-stomp
   * `stompBounceVelocity` (-330) so it doesn't read as a full stomp bounce,
   * but noticeably stronger/longer-hanging than `awayAndUpKnockbackVy`
   * (-150) so there's enough hang-time to actually see the dropped coin
   * land before the player comes back down. Gated by
   * `PlayerState.bounceAscending` the same way `stompBounceVelocity` is (see
   * PlatformerPage.tsx), so the variable-jump-height cut doesn't shear it
   * down. Same tunneling invariant as every other velocity constant here:
   * `Math.abs(coinPotBounceVelocity) * MAX_DT` must stay below
   * RENDERED_TILE_SIZE (32px): Math.abs(-220) * (1/30) ≈ 7.33 < 32. ✓
   */
  coinPotBounceVelocity: -220,
```

- [ ] **Step 2: Run the existing test suite to confirm nothing broke**

Run: `npm test -- PhysicsConfig` (no matching test file — confirm the command reports "no tests found" rather than a failure) and `npm test -- Physics.test.ts` to confirm the unrelated existing physics tests still pass.
Expected: PASS (Physics.test.ts unaffected by an unused-so-far constant).

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/engine/PhysicsConfig.ts
git commit -m "feat(platformer): add coinPotBounceVelocity physics constant"
```

---

### Task 2: Extend `BlockKind`/`BlockDef` with `'coinPot'`

**Files:**
- Modify: `src/themes/platformer/entities/Block.ts:13`
- Modify: `src/themes/platformer/types.ts:126`

**Interfaces:**
- Produces: `BlockKind` (Block.ts) and `BlockDef.blockKind` (types.ts) both include `'coinPot'` — consumed by every later task that constructs or matches on a coin-pot block.

- [ ] **Step 1: Widen `BlockKind` in `entities/Block.ts`**

Change:
```ts
export type BlockKind = 'crate' | 'questionMark' | 'fragileRock';
```
to:
```ts
export type BlockKind = 'crate' | 'questionMark' | 'fragileRock' | 'coinPot';
```

- [ ] **Step 2: Widen `BlockDef.blockKind` in `types.ts`**

Change:
```ts
export interface BlockDef {
  id: string;
  blockKind: 'crate' | 'questionMark' | 'fragileRock';
  /** Present only when `blockKind === 'crate'` — question-mark and fragileRock
   *  blocks reveal no CV fact. */
  fact?: CollectedFact;
}
```
to:
```ts
export interface BlockDef {
  id: string;
  blockKind: 'crate' | 'questionMark' | 'fragileRock' | 'coinPot';
  /** Present when `blockKind === 'crate'`, or when a `coinPot` claimed a
   *  leftover skill-category def (see BlockMapper.ts's
   *  `mapSkillCollectiblesToCoinPotBlocks`) — question-mark and fragileRock
   *  blocks never carry a fact, and a coin-pot marker beyond the available
   *  leftover defs is still placed, just with no fact (mirrors
   *  questionMark's own "marker beyond CVData's length" tolerance). */
  fact?: CollectedFact;
}
```

- [ ] **Step 3: Run typecheck to confirm nothing else references the narrower union in a way that breaks**

Run: `npx tsc --noEmit`
Expected: PASS (nothing currently switches exhaustively on `BlockKind`/`BlockDef.blockKind` without a default case — `BLOCK_TYPES[block.blockKind]` is a plain object index, not a switch).

- [ ] **Step 4: Commit**

```bash
git add src/themes/platformer/entities/Block.ts src/themes/platformer/types.ts
git commit -m "feat(platformer): add coinPot to BlockKind/BlockDef unions"
```

---

### Task 3: Generalize block-touch detection to `PlayerState.blockContacts` (all 4 sides)

**Design decision (made after this plan was first drafted):** rather than adding a second single-purpose array (`landedBlockIds`) alongside the existing `hitBlockIds`, replace BOTH with one generalized `blockContacts: BlockContact[]` list covering all four sides — `'bottom'` (today's `hitBlockIds`, hit from below), `'top'` (what coin-pot needs), and `'left'`/`'right'` (not consumed by anything yet, but future blocks — e.g. roadmap step 40's spikes, which need every direction — get them for free with zero further `Physics.ts` changes, instead of a third and fourth parallel array). This is the core new physics mechanism this step needs.

**Files:**
- Modify: `src/themes/platformer/entities/Player.ts` (define `BlockContactSide`/`BlockContact`, replace `hitBlockIds` with `blockContacts` on `PlayerState`)
- Modify: `src/themes/platformer/engine/Physics.ts` (compute it across all four collision directions)
- Modify: `src/themes/platformer/engine/Physics.test.ts` (rewrite `hitBlockIds` tests + `basePlayer` helper around the new shape, add new left/right/top tests)
- Modify: `src/themes/platformer/PlatformerState.ts` (`spawnPlayerState()`)
- Modify every other file constructing a full `PlayerState` literal (TypeScript will point these out — see Step 6)
- Modify: `src/themes/platformer/PlatformerPage.tsx` (its existing `hitBlockIds`-based crate/questionMark/fragileRock consumption must be updated to read `blockContacts.filter(c => c.side === 'bottom')` instead — done here rather than deferred to Task 9, since `hitBlockIds` no longer exists after this task; Task 9 then adds the NEW `'top'`-filtered consumption alongside it)
- Modify: `src/themes/platformer/PlatformerPage.test.tsx` (any test asserting on `hitBlockIds` directly)

**Interfaces:**
- Produces: `BlockContactSide = 'top' | 'bottom' | 'left' | 'right'`, `BlockContact = { id: string; side: BlockContactSide }`, `PlayerState.blockContacts: BlockContact[]` — every block touched this tick, tagged by which of the block's four faces was touched, fresh every tick (never carried over). Consumed by `PlatformerPage.tsx`'s existing hit-from-below logic (this task) and Task 9's new landed-on-top logic.

- [ ] **Step 1: Replace `hitBlockIds` with `blockContacts` on `PlayerState`**

In `src/themes/platformer/entities/Player.ts`, replace the existing `hitBlockIds` field and its doc comment (currently ending `hitBlockIds: string[];`) with:

```ts
/** Which of a touched block's four faces the player's collision resolved
 *  against, from the block's own perspective — `'bottom'` means the
 *  player's head hit its underside while rising, `'top'` means the player
 *  landed on it from above, `'left'`/`'right'` mean the player walked into
 *  that side wall. */
export type BlockContactSide = 'top' | 'bottom' | 'left' | 'right';

/** One block the player touched this tick, tagged with which side. */
export interface BlockContact {
  id: string;
  side: BlockContactSide;
}
```

(Place these two exports near the top of the file, above the `PlayerState` interface, alongside `PlayerAnimState`.) Then replace the field itself:

```ts
  /**
   * Every block the player touched this tick, tagged with which side (see
   * `BlockContact`) — always freshly computed by `Physics.ts`'s collision
   * checks (all four directions), never carried over from a previous tick.
   * Empty on any tick with no block collision at all. `PlatformerPage.tsx`
   * reads this once per tick, filtered by the side a given mechanic cares
   * about (`'bottom'` for crate/questionMark/fragileRock's existing
   * hit-from-below reaction, `'top'` for coin-pot's landing reaction) — a
   * block kind simply never reacts to a side it doesn't filter for, so
   * adding a new side-sensitive mechanic (e.g. a future spike hazard
   * reacting to any side) never requires touching `Physics.ts` again.
   */
  blockContacts: BlockContact[];
```

- [ ] **Step 2: Write the failing tests in `Physics.test.ts`**

First replace `hitBlockIds: [],` in the `basePlayer()` helper (around line 33) with:

```ts
    blockContacts: [],
```

Then update the FOUR existing `hitBlockIds`-asserting tests (search for `.hitBlockIds` in this file — `jumpingUpIntoABlockFromBelow-reportsItsIdInHitBlockIds`, `jumpingUpIntoPlainTerrainCeiling-reportsNoHitBlockIds`, `walkingRightIntoABlock-doesNotReportItInHitBlockIds`, `landingOnTopOfABlockFromAbove-doesNotReportItInHitBlockIds`) to assert on `blockContacts` instead, e.g.:

```ts
  it('jumpingUpIntoABlockFromBelow-reportsItsIdWithBottomSide', () => {
    const ceilingBottomY = 3 * RENDERED_TILE_SIZE;
    const restY = ceilingBottomY - PLAYER_HEAD_PADDING;
    const player = basePlayer({ x: 2 * RENDERED_TILE_SIZE, y: restY + 1, vy: -1000, grounded: false });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { jumpHeld: true }, blockAtCol2Row2);
    expect(next.blockContacts).toEqual([{ id: blockAtCol2Row2[0].id, side: 'bottom' }]);
  });

  it('jumpingUpIntoPlainTerrainCeiling-reportsNoBlockContacts', () => {
    const next = stepPlayerPhysics(
      basePlayer({ x: 0, y: 1 * RENDERED_TILE_SIZE, vy: -1000, grounded: false }),
      parseLevel(['GGGG', '....', '....', 'GGGG']),
      1 / 60,
      { jumpHeld: true },
    );
    expect(next.blockContacts).toEqual([]);
  });

  it('landingOnTopOfABlockFromAbove-reportsItsIdWithTopSide', () => {
    const groundSurfaceY = 2 * RENDERED_TILE_SIZE;
    const restY = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
    const player = basePlayer({ x: 2 * RENDERED_TILE_SIZE, y: restY - 1, vy: 300 });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, {}, blockAtCol2Row2);
    expect(next.blockContacts).toEqual([{ id: blockAtCol2Row2[0].id, side: 'top' }]);
  });

  it('landingOnPlainTerrainGround-reportsNoBlockContacts', () => {
    const next = stepPlayerPhysics(
      basePlayer({ x: 0, y: 1 * RENDERED_TILE_SIZE, vy: 300, grounded: false }),
      GROUND_LEVEL,
      1 / 60,
      {},
    );
    expect(next.blockContacts).toEqual([]);
  });

  it('walkingRightIntoABlock-reportsItsIdWithLeftSide', () => {
    const wallCol = 2;
    const restX = wallCol * RENDERED_TILE_SIZE - PLAYER_RENDERED_SIZE + PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: restX - 1, y: 1 * RENDERED_TILE_SIZE, grounded: true });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { left: false, right: true }, blockAtCol2Row2);
    expect(next.blockContacts).toEqual([{ id: blockAtCol2Row2[0].id, side: 'left' }]);
  });

  it('walkingLeftIntoABlock-reportsItsIdWithRightSide', () => {
    // Mirrors walkingRightIntoABlock above, approaching from the opposite
    // side: the block is at col 2, so start just right of its right edge
    // and walk left into it.
    const wallCol = 2;
    const restX = (wallCol + 1) * RENDERED_TILE_SIZE - PLAYER_SIDE_PADDING;
    const player = basePlayer({ x: restX + 1, y: 1 * RENDERED_TILE_SIZE, grounded: true });
    const next = stepPlayerPhysics(player, BLOCK_LEVEL, 1 / 60, { left: true, right: false }, blockAtCol2Row2);
    expect(next.blockContacts).toEqual([{ id: blockAtCol2Row2[0].id, side: 'right' }]);
  });
```

(Remove the old `hitBlockIds`-named versions of the first four tests entirely rather than leaving both — they'd otherwise reference a field that no longer exists.)

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `npm test -- Physics.test.ts -t "Side\|blockContacts"`
Expected: FAIL — `Property 'blockContacts' does not exist` (TypeScript compile error inside the test file is an acceptable/expected failure mode here, since `PlayerState` doesn't have the field yet).

- [ ] **Step 4: Implement `blockContacts` across all four collision directions in `Physics.ts`**

Add the import: `import type { BlockContact } from '../entities/Player';` (alongside the existing `PlayerState` type import).

Declare the shared array as the very FIRST statement inside `stepPlayerPhysics`'s function body — before the existing `const knockbackActive = player.knockbackTimer > 0;` line — since both the horizontal-movement section and the vertical section further down need to push into the same array:

```ts
  const blockContacts: BlockContact[] = [];
```

Update the rightward horizontal branch — currently:
```ts
    for (let row = topRow; row <= bottomRow; row++) {
      if (isWall(tileAt(level, rightCol, row)) || isBlockOccupied(blockPlacements, rightCol, row)) {
        x = rightCol * RENDERED_TILE_SIZE - PLAYER_SIDE_PADDING - HITBOX_WIDTH;
        break;
      }
    }
```
to (scans every spanned row for a block id — mirrors the ceiling branch's existing convention — instead of stopping at the first solid row; `'left'` because the player is touching the block's LEFT face while moving right into it):
```ts
    let rightResolved = false;
    for (let row = topRow; row <= bottomRow; row++) {
      if (!isWall(tileAt(level, rightCol, row)) && !isBlockOccupied(blockPlacements, rightCol, row)) continue;
      if (!rightResolved) {
        x = rightCol * RENDERED_TILE_SIZE - PLAYER_SIDE_PADDING - HITBOX_WIDTH;
        rightResolved = true;
      }
      const blockId = blockIdAt(blockPlacements, rightCol, row);
      if (blockId !== undefined) blockContacts.push({ id: blockId, side: 'left' });
    }
```

Update the leftward horizontal branch — currently:
```ts
    for (let row = topRow; row <= bottomRow; row++) {
      if (isWall(tileAt(level, leftCol, row)) || isBlockOccupied(blockPlacements, leftCol, row)) {
        x = (leftCol + 1) * RENDERED_TILE_SIZE - PLAYER_SIDE_PADDING;
        break;
      }
    }
```
to (`'right'` because the player is touching the block's RIGHT face while moving left into it):
```ts
    let leftResolved = false;
    for (let row = topRow; row <= bottomRow; row++) {
      if (!isWall(tileAt(level, leftCol, row)) && !isBlockOccupied(blockPlacements, leftCol, row)) continue;
      if (!leftResolved) {
        x = (leftCol + 1) * RENDERED_TILE_SIZE - PLAYER_SIDE_PADDING;
        leftResolved = true;
      }
      const blockId = blockIdAt(blockPlacements, leftCol, row);
      if (blockId !== undefined) blockContacts.push({ id: blockId, side: 'right' });
    }
```

Remove the old `const hitBlockIds: string[] = [];` declaration (further down, right before the `if (vy < 0)` split) — `blockContacts` (declared earlier now) replaces it. Update the ceiling branch's push from `hitBlockIds.push(blockId)` to `blockContacts.push({ id: blockId, side: 'bottom' })`.

Update the grounded (`else`) branch's column loop — currently:
```ts
    for (let col = leftCol; col <= rightCol; col++) {
      if (columnIsGround(col)) {
        const groundSurfaceY = footRow * RENDERED_TILE_SIZE;
        y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
        resolvedVy = 0;
        grounded = true;
        break;
      }
    }
```
to (same "resolve once, keep scanning for ids" pattern as the ceiling branch — `'top'` because the player is standing on the block's TOP face):
```ts
    let groundResolved = false;
    for (let col = leftCol; col <= rightCol; col++) {
      if (!columnIsGround(col)) continue;
      if (!groundResolved) {
        const groundSurfaceY = footRow * RENDERED_TILE_SIZE;
        y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
        resolvedVy = 0;
        grounded = true;
        groundResolved = true;
      }
      const blockId = blockIdAt(blockPlacements, col, footRow);
      if (blockId !== undefined) blockContacts.push({ id: blockId, side: 'top' });
    }
```

Finally, replace `hitBlockIds,` in the function's final return object with `blockContacts,` (shorthand, since the local variable is already named `blockContacts`), and replace `hitBlockIds: [],` in each of the THREE early-return objects inside the climbing branches with `blockContacts: [],`.

- [ ] **Step 5: Update `PlatformerPage.tsx`'s existing hit-from-below consumption**

Find the existing block-hit derivation (currently `const hittableBlockIds = next.hitBlockIds.filter((id) => {...});`) and change its source to the new filtered shape:

```ts
      const hittableBlockIds = next.blockContacts
        .filter((c) => c.side === 'bottom')
        .map((c) => c.id)
        .filter((id) => {
          const block = blockStates.value.find((b) => b.id === id);
          return block !== undefined && !isBlockUsedUp(block);
        });
```

Everything below this line (the existing crate/questionMark/fragileRock hit-application logic) is unchanged — it already only reads `hittableBlockIds`, not `hitBlockIds` directly.

- [ ] **Step 6: Fix every other `PlayerState` literal TypeScript now flags**

Run `npx tsc --noEmit` and fix every resulting "Property 'blockContacts' is missing" / "Property 'hitBlockIds' does not exist" error by replacing that literal's `hitBlockIds: [],` line with `blockContacts: [],`. Based on a repo-wide search for `hitBlockIds` (run `grep -rln "hitBlockIds" src/themes/platformer` to confirm this list is still current — file layout may have shifted slightly), the files needing this rename are:
  - `src/themes/platformer/PlatformerState.ts` (`spawnPlayerState()`)
  - `src/themes/platformer/editor/gridRenderState.ts`
  - `src/themes/platformer/engine/DebugOverlay.test.ts`
  - `src/themes/platformer/engine/EnemyContact.contract.test.ts`
  - `src/themes/platformer/engine/Collision.test.ts` (2 occurrences)
  - `src/themes/platformer/engine/Renderer.test.ts`
  - `src/themes/platformer/entities/enemies/SlimePurple.test.ts`
  - `src/themes/platformer/entities/Player.test.ts`
  - `src/themes/platformer/PlatformerPage.test.tsx` (any `PlayerState` fixture literal, plus any assertion reading `.hitBlockIds` directly — convert those to `.blockContacts` filtered by side, same as Step 5)

Re-run `npx tsc --noEmit` until it reports zero errors.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -- Physics.test.ts`
Expected: PASS, including the new side-tagged tests from Step 2.

- [ ] **Step 8: Run the full test suite to catch any remaining fallout**

Run: `npm test`
Expected: PASS. If anything outside the files listed in Step 6 still fails on `hitBlockIds`/`blockContacts`, apply the same fix and re-run.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(platformer): generalize hitBlockIds into side-tagged blockContacts (top/bottom/left/right)"
```

---

### Task 4: Level marker `u` (`coinPot`) in `LevelParser.ts`

> **Addendum (discovered during execution, not in the original brief):** widening `TileChar` breaks TypeScript compilation of `src/themes/platformer/editor/paletteTiles.ts`, which declares three exhaustive `Record<TileChar, ...>` maps for the dev-only Level Editor's tile palette (`PALETTE_TILE_SPRITES`, `PALETTE_TILE_DESCRIPTIONS`, `PALETTE_TILE_LABELS`) that the rest of this plan never otherwise touches. This task's scope includes adding a `u` entry to all three, following the exact pattern each existing `F` (fragileRock) entry uses — sprite spec on `staticObjects.png` at the small-pot icon (`sx: 0, sy: 112`, the same coordinates `CoinPot.ts`'s variant 0 uses in Task 7), description `'Coin-pot; land on it from above to break it and drop a coin'`, label `'Coin Pot'`. Verify with `npx tsc --noEmit -p tsconfig.app.json` (NOT the bare `npx tsc --noEmit` used to appear in this plan — that command is inert against this repo's root tsconfig, project-references only, and always exits 0 regardless of real errors).

**Files:**
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Modify: `src/themes/platformer/editor/paletteTiles.ts` (addendum above)
- Modify: `src/themes/platformer/level/LevelParser.test.ts`

**Interfaces:**
- Produces: `findCoinPotTiles(layout): {col,row}[]`, `ENTITY_CHARS.u === 'coinPot'`, `TileChar` includes `'u'`. Consumed by Task 6 (`level.ts`'s `COIN_POT_TILES`).

- [ ] **Step 1: Write the failing tests**

In `LevelParser.test.ts`, add (mirroring the existing `findQuestionMarkTiles`/`findFragileRockTiles` describe blocks):

```ts
describe('findCoinPotTiles', () => {
  it('noMarkers-returnsEmptyArray', () => {
    expect(findCoinPotTiles(['GG', 'GG'])).toEqual([]);
  });

  it('multipleMarkers-returnsAllInReadingOrder', () => {
    expect(findCoinPotTiles(['.J', 'J.'])).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('crateOrQuestionMarkMarker-isNotCountedAsCoinPot', () => {
    expect(findCoinPotTiles(['XQ'])).toEqual([]);
  });
});
```

Also add `'u'` to the `TileChar` describe block's literal array (line ~323):

```ts
      '.', 'G', 'R', 'W', 'B', 'L', 'P', 'S', 'E', 'M', 'C', 'X', 'Q', 'F', 'T', 'u',
      '1', '2', '3', '4', '5', 'n', 'N',
```

And import `findCoinPotTiles` at the top of the test file alongside the other `find*Tiles` imports.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- LevelParser.test.ts -t coinPot`
Expected: FAIL — `findCoinPotTiles is not a function` / `ENTITY_CHARS.J` undefined.

- [ ] **Step 3: Implement in `LevelParser.ts`**

Widen `EntityKind` (line 6-14):
```ts
export type EntityKind =
  | 'spawn'
  | 'enemyGreen'
  | 'enemyPurple'
  | 'coin'
  | 'crate'
  | 'questionMark'
  | 'fragileRock'
  | 'coinPot'
  | 'chest';
```

Add to `ENTITY_CHARS` (line 45-54), and extend its doc comment:
```ts
export const ENTITY_CHARS: Record<string, EntityKind | undefined> = {
  S: 'spawn',
  E: 'enemyGreen',
  M: 'enemyPurple',
  C: 'coin',
  X: 'crate',
  Q: 'questionMark',
  F: 'fragileRock',
  J: 'coinPot',
  T: 'chest',
};
```
(Update the doc comment above it to mention `u` (coin-pot block — destroyed by landing on top, drops a coin) alongside the existing `F` entry.)

Widen `TileChar` (line 103-125) — add `| 'u'` to the union.

Add the finder function, mirroring `findFragileRockTiles` (after it, before `findChestTiles`):
```ts
/** Finds every `u` (coin-pot block) marker's position in a level layout —
 *  same convention as findCrateTiles: zipped against leftover
 *  skill-category collectible defs a `C` marker didn't already claim (see
 *  BlockMapper.ts's `mapSkillCollectiblesToCoinPotBlocks`), not against a
 *  dedicated CVData mapping of its own. */
export function findCoinPotTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'coinPot');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- LevelParser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts
git commit -m "feat(platformer): add u (coin-pot) level marker"
```

---

### Task 5: `mapSkillCollectiblesToCoinPotBlocks` + `placeBlocks`'s `coinPot` zip in `BlockMapper.ts`

**Files:**
- Modify: `src/themes/platformer/level/BlockMapper.ts`
- Modify: `src/themes/platformer/level/BlockMapper.test.ts`

**Interfaces:**
- Consumes: `CollectibleDef` (from `types.ts`, already imported by `CollectibleMapper.ts`).
- Produces: `mapSkillCollectiblesToCoinPotBlocks(collectibleDefs: readonly CollectibleDef[], coinMarkerCount: number): BlockDef[]`; `BlockMarkerPositions.coinPot?: readonly {col,row}[]`; `placeBlocks` places a `coinPot` `BlockPlacement` per `markers.coinPot` entry. Consumed by Task 7 (`PlatformerState.ts`).

- [ ] **Step 1: Write the failing tests**

In `BlockMapper.test.ts`, add a skills-bearing CV fixture and new describe blocks. First, add near the top (after the existing `cv` fixture), a second fixture with skills (the existing `cv` fixture has `skills: []`, which can't exercise this):

```ts
import { mapCVDataToCollectibles } from './CollectibleMapper';

const cvWithSkills: CVData = {
  ...cv,
  skills: [
    { category: 'Backend', skills: [{ name: 'Node.js', level: 5 }] },
    { category: 'Frontend', skills: [{ name: 'React', level: 5 }] },
    { category: 'DevOps', skills: [{ name: 'Docker', level: 4 }] },
  ],
};
```

(Adjust the `Skill`/`SkillCategory` shape above to match whatever `@/types/cv` actually declares — check `src/types/cv.ts`'s `Skill`/`SkillCategory` interfaces before writing this fixture, since the exact required fields aren't confirmed in this plan.)

Then add:

```ts
describe('mapSkillCollectiblesToCoinPotBlocks', () => {
  it('coinMarkerCountZero-turnsEveryDefIntoACoinPotBlock', () => {
    const defs = mapCVDataToCollectibles(cvWithSkills);
    const blocks = mapSkillCollectiblesToCoinPotBlocks(defs, 0);
    expect(blocks).toHaveLength(defs.length);
    expect(blocks.every((b) => b.blockKind === 'coinPot')).toBe(true);
  });

  it('coinMarkerCountEqualsAllDefs-returnsNoCoinPotBlocks', () => {
    const defs = mapCVDataToCollectibles(cvWithSkills);
    expect(mapSkillCollectiblesToCoinPotBlocks(defs, defs.length)).toEqual([]);
  });

  it('coinMarkerCountLessThanDefs-returnsOnlyTheRemainder', () => {
    const defs = mapCVDataToCollectibles(cvWithSkills);
    const blocks = mapSkillCollectiblesToCoinPotBlocks(defs, 1);
    expect(blocks).toHaveLength(defs.length - 1);
    expect(blocks.map((b) => b.fact?.id)).toEqual(defs.slice(1).map((d) => d.fact.id));
  });

  it('everyProducedBlock-carriesTheSameFactItsSourceDefHad', () => {
    const defs = mapCVDataToCollectibles(cvWithSkills);
    const [block] = mapSkillCollectiblesToCoinPotBlocks(defs, 0);
    expect(block.fact).toBe(defs[0].fact);
  });

  it('everyProducedBlock-hasAUniqueIdDistinctFromItsSourceDefId', () => {
    // The block's own id must not collide with the walk-over coin's own
    // CollectiblePlacement id (BlockPlacement/CollectiblePlacement ids share
    // no namespace, but keeping them visibly distinct avoids confusion when
    // debugging) — only the nested fact.id is shared/reused for dedup.
    const defs = mapCVDataToCollectibles(cvWithSkills);
    const [block] = mapSkillCollectiblesToCoinPotBlocks(defs, 0);
    expect(block.id).not.toBe(defs[0].id);
    expect(block.fact?.id).toBe(defs[0].id);
  });
});

describe('placeBlocks — coinPot markers', () => {
  it('coinPotMarkerWithNoDefs-stillProducesAPlacementWithNoFact', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [], fragileRock: [], coinPot: [{ col: 5, row: 2 }] });
    expect(placed).toHaveLength(1);
    expect(placed[0].blockKind).toBe('coinPot');
    expect(placed[0].fact).toBeUndefined();
  });

  it('coinPotMarkerWithADef-carriesItsFact', () => {
    const defs = mapSkillCollectiblesToCoinPotBlocks(mapCVDataToCollectibles(cvWithSkills), 0);
    const placed = placeBlocks(defs, {
      crate: [],
      questionMark: [],
      fragileRock: [],
      coinPot: [{ col: 5, row: 2 }],
    });
    expect(placed).toHaveLength(1);
    expect(placed[0].fact).toBe(defs[0].fact);
  });

  it('coinPotOmittedFromMarkers-behavesAsEmptyArray', () => {
    // BlockMarkerPositions.coinPot is optional so every pre-existing call
    // site (production and test) that doesn't know about coin-pots yet
    // keeps compiling unchanged.
    expect(placeBlocks([], { crate: [], questionMark: [], fragileRock: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- BlockMapper.test.ts -t coinPot`
Expected: FAIL — `mapSkillCollectiblesToCoinPotBlocks is not exported` / `coinPot` not a recognized `BlockMarkerPositions` key.

- [ ] **Step 3: Implement in `BlockMapper.ts`**

Add `CollectibleDef` to the existing type-only import from `../types`:
```ts
import type { BlockDef, CollectibleDef } from '../types';
```

Add the new function, right after `mapCVDataToBlocks` (before the `BlockPlacement` interface):

```ts
/**
 * Turns leftover skill-category `CollectibleDef`s — the SAME pool
 * `CollectibleMapper.ts`'s `mapCVDataToCollectibles` produces for walk-over
 * coins — into coin-pot `BlockDef`s. A level author places some categories
 * as walk-over `C` coins and others as `u` coin-pots; `coinMarkerCount` is
 * how many `C` markers the level actually has, so this function only offers
 * the REMAINDER (in the same category order `mapCVDataToCollectibles`
 * produced them in) to coin-pot markers — no double-counting, and no new
 * CVData mapping of its own.
 */
export function mapSkillCollectiblesToCoinPotBlocks(
  collectibleDefs: readonly CollectibleDef[],
  coinMarkerCount: number,
): BlockDef[] {
  return collectibleDefs.slice(coinMarkerCount).map((def) => ({
    id: `coinpot-${def.id}`,
    blockKind: 'coinPot',
    fact: def.fact,
  }));
}
```

Widen `BlockMarkerPositions` (add as an optional field, so every existing caller keeps compiling unchanged):
```ts
export interface BlockMarkerPositions {
  crate: readonly { col: number; row: number }[];
  questionMark: readonly { col: number; row: number }[];
  fragileRock: readonly { col: number; row: number }[];
  /** Optional so every pre-existing caller (production and test) that
   *  doesn't yet place coin-pots keeps compiling unchanged — treated as `[]`
   *  when omitted. */
  coinPot?: readonly { col: number; row: number }[];
}
```

Add the zip in `placeBlocks`, mirroring `questionMark`'s "always place, fact optional" convention (add after the existing `fragileRock` loop, before `return placements;`):
```ts
  const coinPotDefs = defs.filter((d) => d.blockKind === 'coinPot');
  (markers.coinPot ?? []).forEach(({ col, row }, index) => {
    const { x, y } = tileToPixel(col, row);
    const def = coinPotDefs[index];
    placements.push(def ? { ...def, x, y } : { id: `coinpot-${col}-${row}`, blockKind: 'coinPot', x, y });
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- BlockMapper.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/BlockMapper.ts src/themes/platformer/level/BlockMapper.test.ts
git commit -m "feat(platformer): place coinPot blocks from leftover skill-category defs"
```

---

### Task 6: `coinPotRenderPlan.ts` — the pure per-frame adjacency/variant computation

This is the most novel piece of logic in this step — cover it thoroughly, it has no visual/canvas testing (this codebase doesn't unit-test `draw()` canvas calls — only the pure logic functions feeding them, same convention as `crateCrackOverlayVisible`/`crateShatterOpacity` in `Crate.ts`).

**Files:**
- Create: `src/themes/platformer/entities/blocks/coinPotRenderPlan.ts`
- Create: `src/themes/platformer/entities/blocks/coinPotRenderPlan.test.ts`

**Interfaces:**
- Consumes: `BlockState` (from `../Block`), `isBlockUsedUp` (from `../Block`), `RENDERED_TILE_SIZE` (from `../../level/Terrain`).
- Produces: `permutationForColumn(col: number): readonly [number, number, number]`, `computeCoinPotRenderPlan(blocks: readonly BlockState[]): CoinPotRenderPlan`, where `CoinPotRenderPlan = { variantByBlockId: Map<string, number>; ownerBlockId: Map<string, string>; runsByOwnerId: Map<string, CoinPotRun> }` and `CoinPotRun = { blocks: BlockState[]; fillers: { x: number; y: number; variantIndex: number }[] }`. Consumed by Task 7 (`CoinPot.ts`).

- [ ] **Step 1: Write the failing tests**

Create `coinPotRenderPlan.test.ts`:

```ts
import { computeCoinPotRenderPlan, permutationForColumn } from './coinPotRenderPlan';
import { toBlockState } from '../Block';
import type { BlockPlacement } from '../../level/BlockMapper';
import { RENDERED_TILE_SIZE, tileToPixel } from '../../level/Terrain';

function coinPotAt(col: number, row: number, id = `cp-${col}-${row}`) {
  const { x, y } = tileToPixel(col, row);
  const placement: BlockPlacement = { id, blockKind: 'coinPot', x, y };
  return toBlockState(placement);
}

describe('permutationForColumn', () => {
  it('anyColumn-returnsAPermutationOfZeroOneTwo', () => {
    for (let col = 0; col < 30; col++) {
      const perm = [...permutationForColumn(col)].sort();
      expect(perm).toEqual([0, 1, 2]);
    }
  });

  it('sameColumn-returnsTheSamePermutationEveryCall', () => {
    expect(permutationForColumn(7)).toEqual(permutationForColumn(7));
  });
});

describe('computeCoinPotRenderPlan', () => {
  it('noCoinPotBlocks-returnsEmptyPlan', () => {
    const plan = computeCoinPotRenderPlan([]);
    expect(plan.variantByBlockId.size).toBe(0);
    expect(plan.runsByOwnerId.size).toBe(0);
  });

  it('oneIsolatedTile-isItsOwnOwnerWithNoFillers', () => {
    const block = coinPotAt(5, 2);
    const plan = computeCoinPotRenderPlan([block]);
    expect(plan.ownerBlockId.get(block.id)).toBe(block.id);
    const run = plan.runsByOwnerId.get(block.id)!;
    expect(run.blocks).toEqual([block]);
    expect(run.fillers).toEqual([]);
  });

  it('twoAdjacentTiles-shareOneRunWithOneFillerBetweenThem', () => {
    const left = coinPotAt(5, 2);
    const right = coinPotAt(6, 2);
    const plan = computeCoinPotRenderPlan([left, right]);
    expect(plan.ownerBlockId.get(left.id)).toBe(left.id);
    expect(plan.ownerBlockId.get(right.id)).toBe(left.id);
    const run = plan.runsByOwnerId.get(left.id)!;
    expect(run.blocks.map((b) => b.id)).toEqual([left.id, right.id]);
    expect(run.fillers).toHaveLength(1);
    expect(run.fillers[0].x).toBe(left.x + RENDERED_TILE_SIZE / 2);
    expect(run.fillers[0].y).toBe(left.y);
  });

  it('twoAdjacentTiles-useAllThreeVariantsExactlyOnceAcrossBaseFillerBase', () => {
    const left = coinPotAt(5, 2);
    const right = coinPotAt(6, 2);
    const plan = computeCoinPotRenderPlan([left, right]);
    const run = plan.runsByOwnerId.get(left.id)!;
    const sequence = [
      plan.variantByBlockId.get(left.id),
      run.fillers[0].variantIndex,
      plan.variantByBlockId.get(right.id),
    ];
    expect([...sequence].sort()).toEqual([0, 1, 2]);
  });

  it('threeAdjacentTiles-noTwoConsecutiveRenderedPotsShareAVariant', () => {
    const a = coinPotAt(5, 2);
    const b = coinPotAt(6, 2);
    const c = coinPotAt(7, 2);
    const plan = computeCoinPotRenderPlan([a, b, c]);
    const run = plan.runsByOwnerId.get(a.id)!;
    const sequence = [
      plan.variantByBlockId.get(a.id)!,
      run.fillers[0].variantIndex,
      plan.variantByBlockId.get(b.id)!,
      run.fillers[1].variantIndex,
      plan.variantByBlockId.get(c.id)!,
    ];
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).not.toBe(sequence[i - 1]);
    }
  });

  it('twoTilesInDifferentRows-eachFormsItsOwnIsolatedRun', () => {
    const a = coinPotAt(5, 2);
    const b = coinPotAt(5, 3);
    const plan = computeCoinPotRenderPlan([a, b]);
    expect(plan.ownerBlockId.get(a.id)).toBe(a.id);
    expect(plan.ownerBlockId.get(b.id)).toBe(b.id);
    expect(plan.runsByOwnerId.size).toBe(2);
  });

  it('twoTilesWithAGapBetweenThem-eachFormsItsOwnIsolatedRun', () => {
    const a = coinPotAt(5, 2);
    const c = coinPotAt(7, 2); // col 6 missing — not adjacent
    const plan = computeCoinPotRenderPlan([a, c]);
    expect(plan.ownerBlockId.get(a.id)).toBe(a.id);
    expect(plan.ownerBlockId.get(c.id)).toBe(c.id);
    expect(plan.runsByOwnerId.size).toBe(2);
  });

  it('aUsedUpCoinPot-isExcludedFromEveryRunEvenBeforeRemoval', () => {
    // A block becomes "used up" the instant its terminal hit lands
    // (isBlockUsedUp), well before its bump animation finishes and
    // PlatformerPage.tsx actually removes it from the world — the plan
    // must stop counting it as a live neighbor immediately, so destroying
    // the middle of a 3-run leaves its former neighbors isolated on the
    // very next frame.
    const left = coinPotAt(5, 2);
    const middleHit = { ...coinPotAt(6, 2), hitsTaken: 1 };
    const right = coinPotAt(7, 2);
    const plan = computeCoinPotRenderPlan([left, middleHit, right]);
    expect(plan.ownerBlockId.get(left.id)).toBe(left.id);
    expect(plan.ownerBlockId.get(right.id)).toBe(right.id);
    expect(plan.variantByBlockId.has(middleHit.id)).toBe(false);
    expect(plan.runsByOwnerId.get(left.id)!.fillers).toEqual([]);
  });

  it('nonCoinPotBlocks-areIgnoredEntirely', () => {
    const crate = toBlockState({ id: 'x1', blockKind: 'crate', x: 0, y: 0 });
    const plan = computeCoinPotRenderPlan([crate]);
    expect(plan.variantByBlockId.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- coinPotRenderPlan.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `coinPotRenderPlan.ts`**

```ts
import type { BlockState } from '../Block';
import { isBlockUsedUp } from '../Block';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';

/** The 6 permutations of the 3 pot-size variant indices (0=small,
 *  1=tall, 2=square — see CoinPot.ts's VARIANT_TILE_COLUMNS). */
const PERMUTATIONS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

/**
 * Deterministically picks one of the 6 permutations of [0,1,2] from a run's
 * leftmost tile column — same position-hash trick `StaticObjectsCatalog.ts`'s
 * `pickVariant` uses for bush/tree variety, single-input version since a
 * coin-pot run only has one degree of freedom to seed from (its leftmost
 * column), not a (col,row) pair.
 */
export function permutationForColumn(col: number): readonly [number, number, number] {
  const hash = Math.imul(col, 374761393) >>> 0;
  return PERMUTATIONS[hash % PERMUTATIONS.length];
}

export interface CoinPotFiller {
  x: number;
  y: number;
  variantIndex: number;
}

export interface CoinPotRun {
  /** Run members left-to-right — the SAME `BlockState` objects passed into
   *  `computeCoinPotRenderPlan`, so a consumer can still read each member's
   *  own live `animState`/`animTimer` for the shared bump animation. */
  blocks: BlockState[];
  fillers: CoinPotFiller[];
}

export interface CoinPotRenderPlan {
  /** Variant index (0/1/2) for every currently-live coin-pot block, keyed by
   *  its id — covers every run member, not just each run's owner. */
  variantByBlockId: Map<string, number>;
  /** Every live coin-pot block's run-owner id (a run's leftmost block's own
   *  id, for every member including itself) — only the owner actually
   *  renders anything for the whole run. */
  ownerBlockId: Map<string, string>;
  /** Each run, keyed by its owner's block id. */
  runsByOwnerId: Map<string, CoinPotRun>;
}

/**
 * Computes, fresh from the CURRENT live block list, how every still-live
 * coin-pot tile should render this frame: which of the 3 sprite variants
 * each one shows, and which adjacent pairs need an extra "filler" pot
 * between them so a run of adjacent pots reads as one merged bunch instead
 * of N separate jars with visible gaps.
 *
 * Recomputed every frame directly from `blocks` (never cached across
 * ticks): a block already hit (`isBlockUsedUp`) no longer counts as part of
 * any run, even before its bump/shatter animation finishes and it's
 * actually removed from the world — so destroying one tile immediately
 * reshuffles how its former neighbors render on the very next frame (e.g.
 * destroying the middle of a 3-run leaves both remaining tiles isolated,
 * with no filler between them, since they're no longer adjacent).
 *
 * Within one row, adjacent live tiles (column N and N+1) form a run. Each
 * run picks one permutation of the 3 variants (seeded off its leftmost
 * tile's column) and walks slot index 0,1,2,3,... through it: base tiles
 * occupy even slots (0,2,4,...), one filler pot per internal seam occupies
 * the odd slots between them (1,3,...), centered on the tile boundary. A
 * permutation's 3 entries are pairwise distinct, so no two consecutive
 * rendered pots (base or filler) ever share a variant, even across the `% 3`
 * wraparound for runs longer than 3 rendered slots — and a run of exactly 2
 * tiles (3 rendered slots) uses all 3 variants exactly once.
 */
export function computeCoinPotRenderPlan(blocks: readonly BlockState[]): CoinPotRenderPlan {
  const variantByBlockId = new Map<string, number>();
  const ownerBlockId = new Map<string, string>();
  const runsByOwnerId = new Map<string, CoinPotRun>();

  const live = blocks.filter((b) => b.blockKind === 'coinPot' && !isBlockUsedUp(b));

  const byRow = new Map<number, BlockState[]>();
  for (const block of live) {
    const row = Math.round(block.y / RENDERED_TILE_SIZE);
    const rowBlocks = byRow.get(row);
    if (rowBlocks) rowBlocks.push(block);
    else byRow.set(row, [block]);
  }

  for (const rowBlocks of byRow.values()) {
    rowBlocks.sort((a, b) => a.x - b.x);

    let runStart = 0;
    for (let i = 1; i <= rowBlocks.length; i++) {
      const prevCol = Math.round(rowBlocks[i - 1].x / RENDERED_TILE_SIZE);
      const curCol = i < rowBlocks.length ? Math.round(rowBlocks[i].x / RENDERED_TILE_SIZE) : undefined;
      const contiguous = curCol !== undefined && curCol === prevCol + 1;
      if (contiguous) continue;

      const run = rowBlocks.slice(runStart, i);
      runStart = i;

      const leftmostCol = Math.round(run[0].x / RENDERED_TILE_SIZE);
      const permutation = permutationForColumn(leftmostCol);
      const owner = run[0].id;
      const fillers: CoinPotFiller[] = [];

      run.forEach((block, k) => {
        variantByBlockId.set(block.id, permutation[(2 * k) % 3]);
        ownerBlockId.set(block.id, owner);
      });
      for (let k = 0; k < run.length - 1; k++) {
        fillers.push({
          x: run[k].x + RENDERED_TILE_SIZE / 2,
          y: run[k].y,
          variantIndex: permutation[(2 * k + 1) % 3],
        });
      }

      runsByOwnerId.set(owner, { blocks: run, fillers });
    }
  }

  return { variantByBlockId, ownerBlockId, runsByOwnerId };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- coinPotRenderPlan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/entities/blocks/coinPotRenderPlan.ts src/themes/platformer/entities/blocks/coinPotRenderPlan.test.ts
git commit -m "feat(platformer): compute per-frame coin-pot adjacency/variant render plan"
```

---

### Task 7: `CoinPot.ts` block type + `DrawContext.coinPotPlan` + registration

**Files:**
- Create: `src/themes/platformer/entities/blocks/CoinPot.ts`
- Create: `src/themes/platformer/entities/blocks/CoinPot.test.ts`
- Modify: `src/themes/platformer/entities/blocks/index.ts`
- Modify: `src/themes/platformer/engine/DrawContext.ts`

**Interfaces:**
- Consumes: `computeCoinPotRenderPlan`/`permutationForColumn`/`CoinPotRenderPlan` (Task 6), `STATIC_OBJECTS_SHEET` (`../sprites/sheets.ts`, already registered), `blockBumpOffsetY` (`../../engine/BlockAI.ts`).
- Produces: `coinPot: BlockType` (default export style: named export `coinPot`, added to `BLOCK_TYPES`); `DrawContext.coinPotPlan?: CoinPotRenderPlan`. Consumed by Task 8 (`PlatformerPage.tsx` builds the plan into `drawContext`; `Renderer.ts`'s existing `drawBlocks` dispatches to `coinPot.draw` with zero changes to `Renderer.ts` itself).

- [ ] **Step 1: Write the failing test**

Create `CoinPot.test.ts` — covers the parts of `CoinPot.ts` that are plain functions, not canvas drawing (matches the codebase's existing convention of not unit-testing `draw()` itself):

```ts
import { coinPot } from './CoinPot';

describe('coinPot BlockType', () => {
  it('maxHits-isOne', () => {
    expect(coinPot.maxHits).toBe(1);
  });

  it('removeWhenUsedUp-isTrue', () => {
    expect(coinPot.removeWhenUsedUp).toBe(true);
  });

  it('frameIndex-returnsAConstantFallback', () => {
    // The real per-instance visual comes from draw()'s use of
    // dc.coinPotPlan (see coinPotRenderPlan.ts) — frameIndex only exists to
    // satisfy BlockType for callers outside draw (e.g. blockFrameSource).
    expect(coinPot.frameIndex(0)).toBe(coinPot.frameIndex(1));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- CoinPot.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Add `coinPotPlan` to `DrawContext`**

In `src/themes/platformer/engine/DrawContext.ts`, add the import and field:

```ts
import type { CoinPotRenderPlan } from '../entities/blocks/coinPotRenderPlan';

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  /** Loaded images keyed by `SpriteSheet.src`. */
  sprites: SpriteLookup;
  /** World-to-canvas offset. */
  originX: number;
  originY: number;
  /** Seconds since the world started animating — drives bob and pulse. */
  worldElapsed: number;
  /** This frame's coin-pot adjacency/variant render plan (see
   *  entities/blocks/coinPotRenderPlan.ts). Computed once per frame by
   *  PlatformerPage.tsx from the live block list and attached here — every
   *  block kind's `draw` receives it, but only CoinPot.ts's own `draw`
   *  reads it; every other kind ignores it entirely. Undefined for any
   *  draw call built without it (e.g. a test constructing a bare
   *  DrawContext for an unrelated kind). */
  coinPotPlan?: CoinPotRenderPlan;
}
```

- [ ] **Step 4: Implement `CoinPot.ts`**

```ts
import type { BlockType } from './BlockType';
import type { BlockState } from '../Block';
import type { DrawContext } from '../../engine/DrawContext';
import { STATIC_OBJECTS_SHEET } from '../sprites/sheets';
import { TILE_SIZE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import { blockBumpOffsetY } from '../../engine/BlockAI';
import { permutationForColumn } from './coinPotRenderPlan';

/** Native tile column of each single-pot sprite on `staticObjects.png`'s row
 *  7 (16px tiles): 0=small round jar, 1=tall narrow urn, 2=wide square brick
 *  urn. The 2-tile-wide "cluster" sprite at row 8 is deliberately unused —
 *  see this step's plan for how these were located on the sheet and why. */
const VARIANT_TILE_COLUMNS: readonly number[] = [0, 1, 2];
const VARIANT_ROW = 7;

function drawVariantAt(dc: DrawContext, x: number, y: number, variantIndex: number, bumpOffsetY = 0): void {
  const image = dc.sprites[STATIC_OBJECTS_SHEET.src];
  if (!image) return;
  const sx = VARIANT_TILE_COLUMNS[variantIndex] * TILE_SIZE;
  const sy = VARIANT_ROW * TILE_SIZE;
  dc.ctx.drawImage(
    image,
    sx,
    sy,
    TILE_SIZE,
    TILE_SIZE,
    x + dc.originX,
    y + dc.originY + bumpOffsetY,
    RENDERED_TILE_SIZE,
    RENDERED_TILE_SIZE,
  );
}

export const coinPot: BlockType = {
  key: 'coinPot',
  sprite: { sheet: STATIC_OBJECTS_SHEET, renderScale: 1, animations: {} },
  maxHits: 1,
  removeWhenUsedUp: true,
  // Only a generic fallback for callers outside draw (e.g. blockFrameSource)
  // — the real per-instance variant comes from dc.coinPotPlan inside draw.
  frameIndex: () => 0,
  draw: (block: BlockState, dc: DrawContext) => {
    const plan = dc.coinPotPlan;
    const variant = plan?.variantByBlockId.get(block.id);
    if (variant === undefined) {
      // Not part of the live plan — either dc.coinPotPlan wasn't provided
      // (a test drawing this block in isolation), or this instance is
      // mid-bump/shatter after being hit (computeCoinPotRenderPlan excludes
      // a used-up block immediately, before it's actually removed from the
      // world). Either way, draw itself alone with a deterministic
      // fallback variant, same column-seeded permutation an isolated pot
      // would use.
      const col = Math.round(block.x / RENDERED_TILE_SIZE);
      drawVariantAt(dc, block.x, block.y, permutationForColumn(col)[0], blockBumpOffsetY(block));
      return;
    }
    // Only a run's leftmost block ("owner") actually draws — it draws
    // every base pot in its run (each with its OWN bump offset) plus every
    // filler, so a whole run renders from one draw() call regardless of
    // which tile the caller happens to be iterating.
    if (plan!.ownerBlockId.get(block.id) !== block.id) return;
    const run = plan!.runsByOwnerId.get(block.id);
    if (!run) return;
    for (const member of run.blocks) {
      const memberVariant = plan!.variantByBlockId.get(member.id) ?? 0;
      drawVariantAt(dc, member.x, member.y, memberVariant, blockBumpOffsetY(member));
    }
    for (const filler of run.fillers) {
      drawVariantAt(dc, filler.x, filler.y, filler.variantIndex);
    }
  },
};
```

- [ ] **Step 5: Register in `blocks/index.ts`**

```ts
import { crate } from './Crate';
import { questionMark } from './QuestionMark';
import { fragileRock } from './FragileRock';
import { coinPot } from './CoinPot';

/** Every block kind in the game. Adding a kind is one line here plus its own
 *  module — `BlockState.blockKind` indexes this registry directly and every
 *  entry shares the same state type, so no dispatcher is needed. */
export const BLOCK_TYPES = { crate, questionMark, fragileRock, coinPot };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- CoinPot.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer/entities/blocks/CoinPot.ts src/themes/platformer/entities/blocks/CoinPot.test.ts src/themes/platformer/entities/blocks/index.ts src/themes/platformer/engine/DrawContext.ts
git commit -m "feat(platformer): add coinPot BlockType with adjacency-aware rendering"
```

---

### Task 8: Wire coin-pot placement + `COIN_POT_TILES` into `level.ts`/`PlatformerState.ts`

**Files:**
- Modify: `src/themes/platformer/level/level.ts`
- Modify: `src/themes/platformer/PlatformerState.ts`
- Modify: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `findCoinPotTiles` (Task 4), `mapSkillCollectiblesToCoinPotBlocks` (Task 5).
- Produces: `COIN_POT_TILES` (level.ts, a `computed`); `blockPlacements` now includes `coinPot` placements; `spawnedCoinPlacements: Signal<CollectiblePlacement[]>` and `allCollectiblePlacements: Computed<CollectiblePlacement[]>` (PlatformerState.ts). Consumed by Task 9 (`PlatformerPage.tsx`) and Task 10 (`Journal.tsx`).

- [ ] **Step 1: Write the failing test**

In `PlatformerState.test.ts`, find the existing `collectiblePlacements-initial-isNonEmptyAndMatchesCVData`-style tests (around line 56) and the `resetGameProgress` tests (around line 445-452) for context/style, then add:

```ts
import { spawnedCoinPlacements, allCollectiblePlacements, blockPlacements } from './PlatformerState';

describe('allCollectiblePlacements', () => {
  it('initially-equalsCollectiblePlacementsAlone', () => {
    expect(allCollectiblePlacements.value).toEqual(collectiblePlacements.value);
  });

  it('afterASpawnedCoinIsAdded-includesIt', () => {
    const extra = { id: 'spawned-1', spriteType: 'coin' as const, fact: collectedFactFixture(), x: 0, y: 0 };
    spawnedCoinPlacements.value = [extra];
    expect(allCollectiblePlacements.value).toContainEqual(extra);
    spawnedCoinPlacements.value = []; // don't leak into other tests
  });
});

describe('blockPlacements — coinPot', () => {
  it('someCoinPotBlocksExist-becauseTheDefaultLevelHasJMarkers', () => {
    // Task 12 adds at least one `u` marker to LEVEL_1_LAYOUT — this test
    // documents that expectation and will fail loudly if that task is
    // skipped or the marker is later removed.
    expect(blockPlacements.value.some((b) => b.blockKind === 'coinPot')).toBe(true);
  });
});
```

(Write or reuse a small `collectedFactFixture()` helper returning a minimal valid `CollectedFact` — check the top of `PlatformerState.test.ts` for whether one already exists before adding a new one; if not, add: `function collectedFactFixture(): CollectedFact { return { id: 'f1', sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'Test', skills: [] }, sourceType: 'coin' }; }`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- PlatformerState.test.ts -t coinPot`
Expected: FAIL — `spawnedCoinPlacements`/`allCollectiblePlacements` not exported; no `coinPot` blocks yet (Task 12 not done yet, so this second test is EXPECTED to still fail after Steps 3-4 below — leave it red for now and revisit once Task 12 lands; do not treat it as this task's exit criterion).

- [ ] **Step 3: Add `COIN_POT_TILES` to `level.ts`**

```ts
import {
  parseLevel,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findCoinTiles,
  findCrateTiles,
  findQuestionMarkTiles,
  findFragileRockTiles,
  findCoinPotTiles,
  findChestTiles,
  findSignTiles,
} from './LevelParser';
```

```ts
/** Hand-placed coin-pot block positions, from `currentLayout`'s `u` markers
 *  — zipped against leftover skill-category defs a `C` marker didn't
 *  already claim (see BlockMapper.ts's `mapSkillCollectiblesToCoinPotBlocks`
 *  and PlatformerState.ts's `blockPlacements`). */
export const COIN_POT_TILES = computed(() => findCoinPotTiles(currentLayout.value));
```

- [ ] **Step 4: Wire it into `PlatformerState.ts`**

Update the imports:
```ts
import {
  SPAWN_TILE,
  ENEMY_TILES_GREEN,
  ENEMY_TILES_PURPLE,
  COIN_TILES,
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  COIN_POT_TILES,
  CHEST_TILES,
  SIGN_TILES,
} from './level/level';
...
import { mapCVDataToCollectibles, placeCollectibles } from './level/CollectibleMapper';
import { mapCVDataToBlocks, placeBlocks, mapSkillCollectiblesToCoinPotBlocks } from './level/BlockMapper';
```

Replace the `blockPlacements` computed:
```ts
export const blockPlacements = computed<BlockPlacement[]>(() => {
  const cv = currentCV.value;
  const coinPotDefs = mapSkillCollectiblesToCoinPotBlocks(mapCVDataToCollectibles(cv), COIN_TILES.value.length);
  return placeBlocks([...mapCVDataToBlocks(cv), ...coinPotDefs], {
    crate: CRATE_TILES.value,
    questionMark: QUESTIONMARK_TILES.value,
    fragileRock: FRAGILE_ROCK_TILES.value,
    coinPot: COIN_POT_TILES.value,
  });
});
```

(Update its doc comment to mention coin-pot blocks draw from leftover skill-category defs rather than their own CVData mapping.)

Add the new signal/computed, right after `collectiblePlacements`'s declaration:
```ts
/**
 * Coins dropped by a destroyed coin-pot this session — starts empty. Unlike
 * every other collectible (placed once at load time via
 * `collectiblePlacements`), a coin-pot's reward coin doesn't exist — and
 * isn't reachable/collectible — until its block is destroyed;
 * `PlatformerPage.tsx` appends to this the instant that happens. Reset to
 * `[]` by `resetGameProgress()` alongside `blockStates`, so a full "Reset
 * Game" also re-hides these behind their (now-restored) pots.
 */
export const spawnedCoinPlacements = signal<CollectiblePlacement[]>([]);

/**
 * Every currently-collectible coin/fruit: `collectiblePlacements`'s fixed,
 * load-time set plus any coin-pot drops so far this session. Every
 * player-facing read (collision, rendering, totals) that used to read
 * `collectiblePlacements` directly now reads this instead, so a dropped
 * coin behaves exactly like any other one.
 */
export const allCollectiblePlacements = computed<CollectiblePlacement[]>(() => [
  ...collectiblePlacements.value,
  ...spawnedCoinPlacements.value,
]);
```

Add `spawnedCoinPlacements.value = [];` inside `resetGameProgress()`, next to the existing `blockStates.value = blockPlacements.value.map(toBlockState);` line.

- [ ] **Step 5: Run the tests**

Run: `npm test -- PlatformerState.test.ts`
Expected: The `allCollectiblePlacements` tests PASS. The `blockPlacements — coinPot` test still FAILS (expected — no `u` marker exists in `LEVEL_1_LAYOUT` yet; that's Task 12). Confirm the failure message is specifically "expected true to be false" / an empty-array assertion, not a compile error — if it's a compile error, something above was missed.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS except the one documented-red `blockPlacements — coinPot` test from Step 5.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/level/level.ts src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(platformer): wire coin-pot placement and spawned-coin tracking into game state"
```

---

### Task 9: `PlatformerPage.tsx` — landed-block handling, coin-pot render plan, coin totals

This is the main runtime wiring: applying the landing hit, bouncing the player, spawning the reward coin, and switching every collectible read site to `allCollectiblePlacements`.

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `PHYSICS_CONFIG.coinPotBounceVelocity` (Task 1), `PlayerState.blockContacts` filtered by `side === 'top'` (Task 3), `computeCoinPotRenderPlan` (Task 6), `spawnedCoinPlacements`/`allCollectiblePlacements` (Task 8).

- [ ] **Step 1: Write the failing tests**

In `PlatformerPage.test.tsx`, find the existing block-hit test(s) around the `hitBlockIds`/crate-hit consumption logic for style reference (search for `'questionMark'` or `'crate'` block-hit tests in this file), then add a new `describe` block. This needs a level fixture with a `coinPot` block placed where the player can land on it — check how existing block-hit tests build their test level/blockStates fixture (likely via `currentLayout.value = [...]` plus `blockStates.value = placeBlocks(...).map(toBlockState)`, or a similar existing test harness in this file) and mirror that exactly rather than inventing a new harness. Write these assertions:

```ts
describe('coinPot — landing destroys it and drops a coin', () => {
  it('landingOnACoinPot-destroysItAndBouncesThePlayer', () => {
    // Arrange a coinPot block directly under the player's falling position
    // (mirror whatever this file's existing block-hit tests use to set up
    // blockStates/currentLayout/playerState — do not reinvent the harness).
    // ... arrange ...
    // Act: run one tick of the game loop with the player falling onto it.
    // ... act ...
    expect(blockStates.value.find((b) => b.blockKind === 'coinPot')?.hitsTaken).toBe(1);
    expect(playerState.value.vy).toBe(PHYSICS_CONFIG.coinPotBounceVelocity);
    expect(playerState.value.bounceAscending).toBe(true);
  });

  it('landingOnACoinPotWithAFact-addsACoinToSpawnedCoinPlacements', () => {
    // ... same arrange as above, but the coinPot placement carries a fact ...
    // ... act ...
    expect(spawnedCoinPlacements.value).toHaveLength(1);
    expect(spawnedCoinPlacements.value[0].spriteType).toBe('coin');
    expect(spawnedCoinPlacements.value[0].fact).toBe(/* the fact the fixture gave the block */);
  });

  it('landingOnACoinPotWithNoFact-destroysItButAddsNoCoin', () => {
    // A coinPot marker beyond the available leftover defs still destroys
    // normally (per BlockMapper.ts's lenient marker-always-placed
    // convention) but has nothing to drop.
    // ... arrange a factless coinPot, act ...
    expect(spawnedCoinPlacements.value).toEqual([]);
  });

  it('landingOnACoinPot-firesThePuffEffectLikeAnyOtherDestroyedBlock', () => {
    // ... arrange, act ...
    expect(activePuffs.value).toHaveLength(1);
  });
});
```

Fill in the arrange/act sections using this file's existing conventions (e.g. however the pre-existing `hitBlockIds`-driven crate/questionMark tests already set up `currentLayout`, `blockPlacements`/`blockStates`, and drive one tick — read a couple of those tests first and copy their exact setup pattern; do not guess at a new one).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- PlatformerPage.test.tsx -t coinPot`
Expected: FAIL.

- [ ] **Step 3: Add the shared puff-firing helper (de-duplicated between the two block-trigger loops)**

Locate the existing inline puff-firing check inside the `hittableBlockIds` loop (around line 1319-1325):
```ts
          if (BLOCK_TYPES[block.blockKind].removeWhenUsedUp && isBlockUsedUp(block)) {
            const anchor = blockEffectAnchor(block);
            activePuffs.value = [
              ...activePuffs.value,
              startPuffEffect(block.id, anchor.x + originX, anchor.y + originY, anchor.scale),
            ];
          }
```

Extract it into a small local function declared once, right before the `hittableBlockIds` block (so both it and the new `landedBlockIds` block below can call it):
```ts
      const firePuffIfJustUsedUp = (block: BlockState): void => {
        if (!BLOCK_TYPES[block.blockKind].removeWhenUsedUp || !isBlockUsedUp(block)) return;
        const anchor = blockEffectAnchor(block);
        activePuffs.value = [
          ...activePuffs.value,
          startPuffEffect(block.id, anchor.x + originX, anchor.y + originY, anchor.scale),
        ];
      };
```
Replace the original inline block with `firePuffIfJustUsedUp(block);`.

- [ ] **Step 4: Add the landed-on-top handling block**

Immediately after the existing `hittableBlockIds` block closes (after its `}` — the block ending around the original line 1330-ish, right before the `// Bonus fruits:` comment), add:

```ts
      // Coin-pot destruction: filters next.blockContacts (Task 3's
      // generalized, side-tagged replacement for the old hitBlockIds) down
      // to blocks landed ON TOP of this tick. Mirrors the hittableBlockIds
      // block above exactly (same used-up guard), but for the 'top' side
      // instead of 'bottom' — only coinPot blocks react to this today;
      // every other kind simply never triggers anything on a 'top' contact.
      const landedOnTopIds = next.blockContacts
        .filter((c) => c.side === 'top')
        .map((c) => c.id)
        .filter((id) => {
          const block = blockStates.value.find((b) => b.id === id);
          return block !== undefined && !isBlockUsedUp(block);
        });
      if (landedOnTopIds.length > 0) {
        blockStates.value = blockStates.value.map((block) =>
          landedOnTopIds.includes(block.id) ? applyBlockHit(block) : block,
        );
        playerState.value = {
          ...playerState.value,
          vy: PHYSICS_CONFIG.coinPotBounceVelocity,
          bounceAscending: true,
        };

        for (const id of landedOnTopIds) {
          const block = blockStates.value.find((b) => b.id === id);
          if (!block) continue;
          firePuffIfJustUsedUp(block);
          if (block.blockKind === 'coinPot' && block.fact) {
            spawnedCoinPlacements.value = [
              ...spawnedCoinPlacements.value,
              { id: block.fact.id, spriteType: 'coin', fact: block.fact, x: block.x, y: block.y },
            ];
          }
        }
      }
```

- [ ] **Step 5: Compute the coin-pot render plan into `drawContext`**

Update the `drawContext` construction (around line 462-468):
```ts
      const drawContext: DrawContext = {
        ctx,
        sprites: spritesRef.current,
        originX,
        originY,
        worldElapsed: worldAnimElapsed,
        coinPotPlan: computeCoinPotRenderPlan(blockStates.value),
      };
```

Add the import: `import { computeCoinPotRenderPlan } from './entities/blocks/coinPotRenderPlan';`.

- [ ] **Step 6: Switch collectible read sites to `allCollectiblePlacements`**

Replace every `collectiblePlacements.value` occurrence used for player-facing collection/rendering/totals with `allCollectiblePlacements.value` — specifically the draw call (`drawCollectibles(ctx, allCollectiblePlacements.value, ...)`, originally line 496), the `checkCollectibleCollisions` call and its two lookups (originally lines 910-913, 932), and the coin-total computation (originally lines 972-976, which also needs to add coin-pot blocks with a fact to both the total and collected counts):

```ts
        if (touchedIds.some((id) => allCollectiblePlacements.value.find((p) => p.id === id)?.spriteType === 'coin')) {
          const coinPotFactIds = blockPlacements.value
            .filter((b) => b.blockKind === 'coinPot' && b.fact)
            .map((b) => b.fact!.id);
          const coinTotal =
            allCollectiblePlacements.value.filter((p) => p.spriteType === 'coin').length +
            coinPotFactIds.filter((id) => !allCollectiblePlacements.value.some((p) => p.id === id)).length;
          const coinCollected =
            allCollectiblePlacements.value.filter((p) => p.spriteType === 'coin' && nextCollected.has(p.id)).length +
            coinPotFactIds.filter((id) => nextCollected.has(id) && !allCollectiblePlacements.value.some((p) => p.id === id)).length;
          activeCounterPopups.value = {
            ...activeCounterPopups.value,
            coins: startCounterPopup('coins', coinCollected, coinTotal),
          };
        }
```

(The `coinPotFactIds.filter((id) => !allCollectiblePlacements.value.some(...))` guard avoids double-counting a pot's fact once it HAS already dropped its coin into `spawnedCoinPlacements` — at that point it's already counted via the plain `allCollectiblePlacements.value.filter(coin)` term above, so it must not also be counted via `coinPotFactIds`.)

Add `spawnedCoinPlacements` and `allCollectiblePlacements` to this file's import from `./PlatformerState` (keep the existing `collectiblePlacements` import too if anything else in the file still legitimately needs the load-time-only set — check before removing it).

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -- PlatformerPage.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS (the `blockPlacements — coinPot` test from Task 8 Step 5 is still expected red until Task 12 adds a level marker).

- [ ] **Step 9: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(platformer): destroy coin-pots on landing, bounce the player, and drop a coin"
```

---

### Task 10: `Journal.tsx` — include coin-pot coins in the coins total

**Files:**
- Modify: `src/themes/platformer/components/Journal.tsx`
- Modify: `src/themes/platformer/components/Journal.test.tsx`

**Interfaces:**
- Consumes: `allCollectiblePlacements` (Task 8), `blockPlacements` (already imported by `Journal.tsx` — confirm).

- [ ] **Step 1: Write the failing test**

In `Journal.test.tsx`, find the existing coin-total test around line 559-565 for its exact setup style, then add a variant asserting a coin-pot's fact counts toward the total even before it's collected:

```ts
it('coinsTotal-includesCoinPotBlocksWithAFact', () => {
  // Arrange blockPlacements to include at least one coinPot block carrying
  // a fact (mirror however this file's existing tests seed blockPlacements
  // — read the setup above this test in the same file rather than
  // reinventing it) alongside the level's normal walk-over coins.
  // ... arrange ...
  // ... render the journal to the personality/about page ...
  const total =
    collectiblePlacements.value.filter((p) => p.spriteType === 'coin').length +
    blockPlacements.value.filter((b) => b.blockKind === 'coinPot' && b.fact).length;
  expect(screen.getByTestId('journal-collectibles-summary').textContent).toContain(`/ ${total}`);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- Journal.test.tsx -t coinPot`
Expected: FAIL (today's total omits coin-pot blocks).

- [ ] **Step 3: Update `Journal.tsx`**

Change:
```ts
                        {collectiblesSummary(facts, {
                          coins: collectiblePlacements.value.filter((p) => p.spriteType === 'coin').length,
```
to:
```ts
                        {collectiblesSummary(facts, {
                          coins:
                            collectiblePlacements.value.filter((p) => p.spriteType === 'coin').length +
                            blockPlacements.value.filter((b) => b.blockKind === 'coinPot' && b.fact).length,
```

(`blockPlacements` is already imported by this file for the `crates`/`fruits` rows below it — confirm before adding a duplicate import.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- Journal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/components/Journal.tsx src/themes/platformer/components/Journal.test.tsx
git commit -m "feat(platformer): count coin-pot coins in the journal's coins total"
```

---

### Task 11: Place `u` markers in `LEVEL_1_LAYOUT`, including a run of adjacent tiles

**Files:**
- Modify: `src/themes/platformer/level/level.ts`

**Interfaces:**
- None (data-only change) — this is what makes Task 8's documented-red `blockPlacements — coinPot` test go green, and what makes the merged-run rendering actually visible in the browser for Task 12's manual check.

- [ ] **Step 1: Choose placement spots**

Read `level.ts`'s existing top-of-file doc comment (the "Zones"/"Markers" sections) to find open floor space not already used by another marker. A safe, low-risk choice: the Zone A meadow's flat base ground (cols 0-27) has open floor before the first elevated blocks — place a run of 2 adjacent `u` markers plus one isolated `u` marker there, replacing three `.` characters on the base-ground row (row index 9 in the layout array, the row just above the `GGGG...` ground row 10 — the same row other ground-level entity markers like `S`/`E` already sit on).

- [ ] **Step 2: Edit `LEVEL_1_LAYOUT`**

Open `src/themes/platformer/level/level.ts`. On the row currently reading (row index 9, starting `..S.5..C...C.........E.......E..2.GGGGGGGGGGGGGGG...`), replace three consecutive `.` characters somewhere in the open stretch between two existing markers with `uu.u` (a run of 2, a gap, then 1 isolated) — e.g. change:
```
..S.5..C...C.........E.......E..2.GGGGGGGGGGGGGGG.........E......1.....................................E.C..........E.....E.......E........................E.................W.E..WGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
```
by replacing four `.` characters right after the `5..C` group (cols 8-11, currently `...C` → keep the existing `C` at col 11 untouched, use cols 7-10's `..` — pick any 4 untouched `.` columns in that stretch and verify with a quick visual count) with `uu.u`. Since editing a 220-character string by column index is error-prone by hand, do this precisely with a small one-off Node script rather than manual character counting:

```bash
node -e "
const line = 9; // 0-based index into LEVEL_1_LAYOUT
const startCol = 15; // any run of 4 currently-'.' columns on this row — verify below before running
const fs = require('fs');
const path = 'src/themes/platformer/level/level.ts';
let src = fs.readFileSync(path, 'utf8');
// Print the target row's characters at startCol..startCol+3 first, to confirm they're all '.', before editing anything.
"
```

Run that confirmation snippet first (adjust `startCol` until the printed slice is `....`), then actually apply the edit by hand in the editor at that exact column range, changing it to `uu.u`. Update the file's own top-of-file "Markers" doc comment table to add a `u` row (mirroring the existing `F` row's style):

```
//   u  3   coin-pot — destroyed by landing on top, drops a coin (2 adjacent
//          + 1 isolated, to exercise the merged-run rendering)
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, including Task 8's previously-documented-red `blockPlacements — coinPot` test (now green) and Task 9's coinPot tests (still green, unaffected by this data-only change).

- [ ] **Step 4: Commit**

```bash
git add src/themes/platformer/level/level.ts
git commit -m "feat(platformer): place coin-pot markers in the default level, including a merged run"
```

---

### Task 12: Manual browser verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and open the Platformer theme**

Unlock `platformerPrototypeUnlocked` (via whatever debug/localStorage toggle the rest of this epic already uses — check `src/state/theme.ts` and any existing debug panel), start the level, and navigate to the Zone A meadow stretch where Task 11 placed the `u` markers.

- [ ] **Step 2: Verify the merged-run rendering**

Confirm the 2 adjacent coin-pot tiles render as one visually merged cluster (3 pots total: 2 base + 1 filler between them, all different sizes) and the isolated third `u` renders as a single pot, sized by its column.

- [ ] **Step 3: Verify the destroy mechanic**

Jump on top of the isolated pot: confirm it destroys with the puff effect, the player gets a small bounce (visibly weaker/shorter than the enemy-stomp bounce, but with enough hang-time to watch a coin appear at that tile), and the dropped coin can then be walked over to reveal its skill-category fact in the journal (check the journal's Skills bookmark and the coins counter).

- [ ] **Step 4: Verify the merged run re-shuffles correctly on partial destruction**

Jump onto ONE of the two adjacent pots (not the isolated one). Confirm: that tile is destroyed and drops its coin; the OTHER tile in the former pair immediately re-renders as an isolated single pot (no filler, since it no longer has a live neighbor) rather than leaving a dangling half-cluster or visual glitch.

- [ ] **Step 5: Verify solidity**

Confirm the player cannot walk through an intact coin-pot horizontally (it blocks the path like any other block) and must jump onto/over it.

- [ ] **Step 6: Report results**

If any check fails, return to the relevant task above, fix, re-run its tests, and re-verify here — do not proceed to Task 13 until all five checks pass.

---

### Task 13: Roadmap + feature-tracking update

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md`

- [ ] **Step 1: Check off step 37**

Change:
```
- [ ] **37. Coin-pot container block** — a new hittable block (like `Crate`/
```
to:
```
- [x] **37. Coin-pot container block** — a new hittable block (like `Crate`/
```
(Keep the rest of the existing bullet text — optionally trim/update its trailing "Needs its own brainstorming pass..." sentence, since that pass is now done, to instead briefly note the final mechanic: destroyed by landing on top, drops a coin, adjacent pots visually merge.)

- [ ] **Step 2: Check `docs/Features.md`**

Run: `grep -n "coin.pot\|Coin.Pot" docs/Features.md` (case-insensitive) — this roadmap step was never listed there (it's tracked in the platformer epic's own `roadmap.md`, not the F/S/O feature list), so expect no match and make no edit. If a match unexpectedly turns up, update it the same way `CLAUDE.md`'s feature-completion-tracking section describes (checkbox, status table, dependency-diagram node).

- [ ] **Step 3: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): mark roadmap step 37 done"
```

---

## Self-Review Notes

- **Spec coverage:** trigger/bounce (Tasks 1, 3, 9), reward/fact-pool reuse (Tasks 5, 8, 9), rendering/merging (Tasks 6, 7), level authoring (Tasks 4, 11), totals consistency (Tasks 9, 10), manual verification (Task 12), roadmap tracking (Task 13) — every element of the agreed design has a task.
- **Placeholder scan:** every task has concrete code, not descriptions of code, except two deliberately-scoped exceptions where the exact repo state can't be pinned down from outside the codebase: Task 9 Step 1's arrange/act sections (told explicitly to copy an existing test's harness rather than inventing one — the harness itself isn't placeholder logic, it's a "go read the neighboring test" instruction, same as how Task 3 Step 5 points at `tsc` output as its own checklist) and Task 11's column-index edit (a data-file edit where hand-counting 220 characters in a plan document would be more error-prone than verifying in-editor). Both are flagged as intentional, not left vague.
- **Type consistency:** `CoinPotRenderPlan`/`CoinPotRun`/`CoinPotFiller` (Task 6) are used with identical shapes in Task 7's `CoinPot.ts`. `mapSkillCollectiblesToCoinPotBlocks`'s signature (Task 5) matches its Task 8 call site. `BlockContact`/`blockContacts` (Task 3) matches its Task 9 `'top'`-filtered consumption, and Task 3 itself already migrates the pre-existing `'bottom'` (crate/questionMark/fragileRock) consumption off the old `hitBlockIds` in the same task, so no task is left calling a field that no longer exists. `spawnedCoinPlacements`/`allCollectiblePlacements` (Task 8) match their Task 9/10 consumption.
- **Generalization note:** Task 3 was revised mid-brainstorming (before any implementation started) from a single-purpose `landedBlockIds` addition into a full `blockContacts: {id, side}[]` generalization covering all four sides, specifically so roadmap steps needing left/right or all-direction block contact (step 40's spikes were named explicitly) never need to touch `Physics.ts`'s collision loop again — only `PlatformerPage.tsx` gains a new `.filter(side === ...)` call per new mechanic.
