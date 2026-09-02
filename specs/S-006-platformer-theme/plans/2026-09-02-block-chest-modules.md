# Self-Contained Block and Chest Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each block kind and the chest a self-contained module owning its sprite, its per-kind rules and its rendering, so adding a block is one new file plus one registry line plus a frame index.

**Architecture:** `world_tileset.png` becomes a `SpriteSheet` — the first genuinely shared one, backing terrain and all three block kinds at once. Each block kind becomes a module exposing its frame index, `maxHits`, `removeWhenUsedUp` and a `draw`. `blockFrameSource`'s switch, `maxHitsForBlock`'s ternary and `isBlockRemoved`'s question-mark special-case all dissolve into per-module data. The chest gets the same treatment with its two one-frame sheets.

**Tech Stack:** TypeScript 5 (strict), React 19, `@preact/signals-react`, Vitest + React Testing Library + jsdom.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-01-entity-architecture-design.md`

**Prerequisite:** `2026-09-01-entity-lifecycle.md`, `2026-09-01-enemy-modules.md` and `2026-09-02-pickup-modules.md` are complete. This plan builds on `SpriteSheet`, `SpriteDescriptor`, `frameSource`, `SpriteLookup`, `collectSheetSources` (`entities/sprites/SpriteSheet.ts`), the sheet constants in `entities/sprites/sheets.ts`, and `DrawContext` (`engine/DrawContext.ts`).

## Scope, and a correction to the design doc

The design doc's "Other families" table lists blocks under `side: 'bottom'` and chests under `standing-on`, as though both resolved through the `Contact` / `CollisionOutcome` model that enemies use. **They do not, and this plan does not change that.**

- A block is hit **from below**, detected during ceiling collision in `Physics.ts`, which writes `player.hitBlockIds`. `PlatformerPage.tsx` reads that once per tick and calls `applyBlockHit`. There is no player-versus-block overlap test.
- A chest opens on **standing on it AND pressing Up AND holding a key** — an input-gated action, not a contact consequence. `chestPlayerIsStandingOn` returns a candidate; the caller decides.

Routing either through `onPlayerCollide` would mean making `Physics.ts` emit contacts and giving `CollisionOutcome` an input-state notion — a much larger change than this plan, and one that would grow the shared outcome vocabulary the design explicitly warns against.

So this plan unifies **sprites, per-kind data and rendering**, and leaves both trigger mechanisms exactly as they are — the same division Plan 3 drew for pickup lifecycle. Update the design doc's table as part of Task 1.

**Also out of scope:** terrain. It draws from `world_tileset.png` too, but addresses it through `tileSource`, whose coordinates depend on neighbouring tiles (`isTopExposed`, `bridgeRunPosition`). That is context-dependent addressing, not a frame index, and it stays as it is. The sheet is the unit of loading, not of addressing — terrain and blocks legitimately share one sheet while addressing it differently.

## Global Constraints

- TypeScript strict mode. No `any`, no `@ts-ignore`, no `@ts-expect-error`, no new casts in production code.
- Test-first for every task (constitution Principle II, NON-NEGOTIABLE).
- Test names follow `{method}-{Condition}-{ExpectedResult}`.
- No new dependencies. Named exports only.
- Doc comments describe the current state. No history trails, no references to plans or task numbers.
- **No behavior change is intended by any task.**
- Test command: `npm test`. Typecheck: `npx tsc -b --noEmit` — must produce NO output.
- **Lint: `npx eslint src/themes/platformer` must report exactly ONE error** — the pre-existing `components/ControlsOverlay.tsx:125` `react-hooks/set-state-in-effect`. Any additional error fails the task. Note the config has no `argsIgnorePattern`, so an `_` prefix does NOT silence an unused parameter; the rule's default `args: 'after-used'` reports only trailing unused parameters, so trim those rather than changing the config. eslint is slow here — allow a generous timeout.
- Never edit `src/themes/platformer/engine/EnemyContact.contract.test.ts`'s `CONTACT_CASES` or any `expected` block.

## Reference values

Measured from the actual PNGs and from `entities/Block.ts` / `entities/Chest.ts`.

| Asset | Dimensions | As a sheet |
|---|---|---|
| `world_tileset.png` | 256×256 | 16×16 grid of 16px frames → `columns: 16` |
| `crack_overlay.png` | 16×16 | one 16px frame → `columns: 1` |
| `chest_closed.png` | 28×20 | one frame, `frameWidth: 28`, `frameHeight: 20`, `columns: 1` |
| `chest_open.png` | 24×20 | one frame, `frameWidth: 24`, `frameHeight: 20`, `columns: 1` |

`blockFrameSource`'s current coordinates converted to indices on a 16-column sheet (`index = row * 16 + col`):

| Block state | Current `{sx, sy}` | col, row | Frame index |
|---|---|---|---|
| `crate` | `{7*16, 3*16}` | 7, 3 | **55** |
| `questionMark`, `hitsTaken === 0` | `{0, 2*16}` | 0, 2 | **32** |
| `questionMark`, `hitsTaken >= 1` | `{1*16, 0}` | 1, 0 | **1** |
| `fragileRock` | `{3*16, 0}` | 3, 0 | **3** |

The used-up question-mark deliberately swaps to the plain top-exposed `groundRock` tile (col 1, row 0) — the same frame `tileSource` returns for exposed `groundRock` — so a spent block blends into ordinary ground rather than reading as a distinct type. Preserve that; it is a design choice, not an accident.

Per-kind rules currently expressed as conditionals:

| Rule | Current form | Becomes |
|---|---|---|
| Hits to use up | `maxHitsForBlock`: `kind === 'crate' ? 2 : 1` | `maxHits` per module |
| Removed when used up | `isBlockRemoved`: `questionMark` returns false | `removeWhenUsedUp` per module |
| Crack overlay | `crateCrackOverlayVisible(hitsTaken)`: `hitsTaken === 1` | crate module's `draw` only |
| Shatter fade | `crateShatterOpacity`, crate-only | crate module's `draw` only |
| Bump nudge | `blockBumpOffsetY`, all kinds | stays shared in `BlockAI.ts` |

## Model guidance

**Sonnet 5 for every task.** No dispatcher cast, no module cycle, no discriminated union. Each task is a bounded relocation pinned by an equivalence test.

**Opus should review Tasks 1 and 3.** Task 1 converts a coordinate switch into frame indices — the same class of silent visual drift that the fruit column stride was. Task 3 relocates canvas arithmetic including two crate-only effects that `Renderer.test.ts` covers only structurally.

**Every task review must run `npx eslint src/themes/platformer` and compare against the one-error baseline.** Tests and `tsc` do not catch lint-only rules; in the previous plan six lint errors accumulated across four clean task reviews because lint was not in the reviewer's prompt.

**On the "move this code verbatim" steps.** Tasks 3 and 4 relocate existing drawing code. Do not let a model paraphrase those blocks — the instruction is *move*, and a diff showing rewritten arithmetic instead of relocated arithmetic should be rejected in review.

---

### Task 1: Block and chest sheets, and the type contracts

**Model:** Sonnet 5 to implement; Opus to review — the coordinate-to-index conversion is the risk.

**Files:**
- Modify: `src/themes/platformer/entities/sprites/sheets.ts`
- Create: `src/themes/platformer/entities/blocks/BlockType.ts`
- Create: `src/themes/platformer/entities/chests/ChestType.ts`
- Create: `src/themes/platformer/entities/blocks/BlockType.test.ts`
- Modify: `specs/S-006-platformer-theme/plans/2026-09-01-entity-architecture-design.md`

**Interfaces:**
- Produces: `WORLD_TILESET_SHEET`, `CRACK_OVERLAY_SHEET`, `CHEST_CLOSED_SHEET`, `CHEST_OPEN_SHEET` from `entities/sprites/sheets.ts`; `BlockType` from `entities/blocks/BlockType.ts`; `ChestType` from `entities/chests/ChestType.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/blocks/BlockType.test.ts`:

```typescript
import { frameSource } from '../sprites/SpriteSheet';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { blockFrameSource } from '../Block';

describe('WORLD_TILESET_SHEET', () => {
  it('columns-matchesTheTilesetGrid', () => {
    // world_tileset.png is 256x256 of 16px tiles.
    expect(WORLD_TILESET_SHEET.columns).toBe(16);
  });
});

describe('block frame indices match blockFrameSource', () => {
  // These indices are what the modules will declare. Pinning them against the
  // live coordinate switch is what makes the conversion safe: index = row*16 + col.
  it('crateIndex-matchesItsCurrentCoordinates', () => {
    expect(frameSource(WORLD_TILESET_SHEET, 55)).toEqual(blockFrameSource('crate'));
  });

  it('intactQuestionMarkIndex-matchesItsCurrentCoordinates', () => {
    expect(frameSource(WORLD_TILESET_SHEET, 32)).toEqual(blockFrameSource('questionMark', 0));
  });

  it('usedUpQuestionMarkIndex-matchesItsCurrentCoordinates', () => {
    // A spent question-mark swaps to the plain top-exposed groundRock tile so
    // it blends into ordinary ground rather than reading as a distinct block.
    expect(frameSource(WORLD_TILESET_SHEET, 1)).toEqual(blockFrameSource('questionMark', 1));
  });

  it('fragileRockIndex-matchesItsCurrentCoordinates', () => {
    expect(frameSource(WORLD_TILESET_SHEET, 3)).toEqual(blockFrameSource('fragileRock'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/blocks/BlockType.test.ts`
Expected: FAIL — `WORLD_TILESET_SHEET` is not exported.

- [ ] **Step 3: Add the four sheets**

Append to `src/themes/platformer/entities/sprites/sheets.ts`. Import `TILE_SIZE` from `../../level/Terrain` and the chest dimension constants from `../Chest` rather than restating numbers — a hardcoded literal duplicating an existing constant has been a review finding three times in this codebase.

```typescript
/** `world_tileset.png` is a 16x16 grid of 16px tiles, shared by terrain and
 *  every block kind. Terrain addresses it through its own neighbour-aware
 *  lookup rather than by frame index; the sheet is the unit of loading, not
 *  of addressing. */
export const WORLD_TILESET_SHEET: SpriteSheet = {
  src: '/sprites/world_tileset.png',
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  columns: 16,
};

/** A single 16px overlay composited over a cracked crate. */
export const CRACK_OVERLAY_SHEET: SpriteSheet = {
  src: '/sprites/crack_overlay.png',
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  columns: 1,
};

/** The chest's two states are separate standalone images of different sizes,
 *  so each is its own one-frame sheet. */
export const CHEST_CLOSED_SHEET: SpriteSheet = {
  src: '/sprites/chest_closed.png',
  frameWidth: CHEST_CLOSED_WIDTH,
  frameHeight: CHEST_CLOSED_HEIGHT,
  columns: 1,
};

export const CHEST_OPEN_SHEET: SpriteSheet = {
  src: '/sprites/chest_open.png',
  frameWidth: CHEST_OPEN_WIDTH,
  frameHeight: CHEST_OPEN_HEIGHT,
  columns: 1,
};
```

Verify the four `src` strings against the real `loadImage` calls in `PlatformerPage.tsx` (`grep -n "loadImage(" src/themes/platformer/PlatformerPage.tsx`). A wrong path fails silently later as a sprite that never loads. Check for an import cycle: `entities/Chest.ts` currently imports only `../level/Terrain`.

- [ ] **Step 4: Write the two type contracts**

Create `src/themes/platformer/entities/blocks/BlockType.ts`:

```typescript
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../engine/DrawContext';
import type { BlockState } from '../Block';

/**
 * Everything the engine needs to know about one block kind, owned entirely by
 * that kind's own module. Adding a block means writing one of these and adding
 * one line to `blocks/index.ts` — nothing in Renderer.ts or PlatformerPage.tsx
 * needs to change, and no sprite registry needs editing: the loader discovers
 * assets from `sprite.sheet`.
 *
 * Carries no trigger mechanism. A block is hit from below, detected during
 * ceiling collision in Physics.ts, which writes `player.hitBlockIds`; the
 * caller reads that and applies the hit. This interface owns appearance and
 * per-kind rules only.
 */
export interface BlockType {
  /** Must equal this module's slot in BLOCK_TYPES. */
  key: string;
  sprite: SpriteDescriptor;
  /** Upward hits this kind responds to before it is used up. */
  maxHits: number;
  /**
   * Whether this kind leaves the world once used up and its animation has
   * settled. False for a kind that stays as a permanent, solid, spent block.
   */
  removeWhenUsedUp: boolean;
  /** Which frame of `sprite.sheet` to draw for the given hit count — a kind
   *  whose appearance does not change ignores the argument. */
  frameIndex(hitsTaken: number): number;
  draw(block: BlockState, dc: DrawContext): void;
}
```

Create `src/themes/platformer/entities/chests/ChestType.ts`:

```typescript
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DrawContext } from '../../engine/DrawContext';
import type { ChestState } from '../Chest';

/**
 * A chest's appearance, owned by its own module. Its two states are separate
 * images of different sizes, so each carries its own descriptor and its own
 * horizontal centering offset.
 *
 * Carries no trigger mechanism: opening requires standing on the chest AND
 * pressing Up AND holding a key, which the caller decides. This interface owns
 * appearance only.
 */
export interface ChestType {
  key: string;
  closed: SpriteDescriptor;
  open: SpriteDescriptor;
  draw(chest: ChestState, dc: DrawContext): void;
}
```

- [ ] **Step 5: Correct the design doc**

In `specs/S-006-platformer-theme/plans/2026-09-01-entity-architecture-design.md`, the "Other families" table lists blocks under `side: 'bottom'` and chests under `standing-on`, implying both resolve through the `Contact`/`CollisionOutcome` model. They do not. Replace those two cells with an accurate description of each trigger — blocks via `player.hitBlockIds` from ceiling collision, chests via standing plus Up plus a held key — and add a sentence noting that unifying them into the contact model would require `Physics.ts` to emit contacts and `CollisionOutcome` to carry input state, which is deliberately not done.

Write it as current-state fact. No history trail, no "previously said".

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/themes/platformer/entities/blocks/BlockType.test.ts`
Expected: PASS.

Run: `npm test`, `npx tsc -b --noEmit`, and `npx eslint src/themes/platformer`
Expected: tests pass, no `tsc` output, exactly one eslint error (the pre-existing `ControlsOverlay.tsx:125`).

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer specs/S-006-platformer-theme
git commit -m "feat(platformer): add block and chest sheet descriptors and type contracts"
```

---

### Task 2: The three block modules and their registry

**Model:** Sonnet 5.

Per-kind data only — drawing moves in Task 3.

**Files:**
- Create: `src/themes/platformer/entities/blocks/Crate.ts`, `QuestionMark.ts`, `FragileRock.ts`
- Create: `src/themes/platformer/entities/blocks/index.ts`
- Create: `src/themes/platformer/entities/blocks/index.test.ts`
- Modify: `src/themes/platformer/entities/Block.ts`
- Test: `src/themes/platformer/entities/Block.test.ts`

**Interfaces:**
- Produces: `BLOCK_TYPES`, `BlockTypeKey` from `entities/blocks/index.ts`. `maxHitsForBlock`, `isBlockUsedUp`, `isBlockRemoved` and `blockFrameSource` keep their signatures; only their bodies change to read the registry.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/blocks/index.test.ts`:

```typescript
import { BLOCK_TYPES } from './index';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';

describe('BLOCK_TYPES', () => {
  it('everyEntry-declaresItsOwnKey', () => {
    for (const [key, type] of Object.entries(BLOCK_TYPES)) {
      expect(type.key).toBe(key);
    }
  });

  it('everyEntry-drawsFromTheSharedTileset', () => {
    for (const type of Object.values(BLOCK_TYPES)) {
      expect(type.sprite.sheet).toBe(WORLD_TILESET_SHEET);
    }
  });

  // These are the values maxHitsForBlock and isBlockRemoved encoded as
  // conditionals before they read the registry.
  it('crate-takesTwoHitsAndLeavesTheWorld', () => {
    expect(BLOCK_TYPES.crate).toMatchObject({ maxHits: 2, removeWhenUsedUp: true });
  });

  it('fragileRock-takesOneHitAndLeavesTheWorld', () => {
    expect(BLOCK_TYPES.fragileRock).toMatchObject({ maxHits: 1, removeWhenUsedUp: true });
  });

  it('questionMark-takesOneHitAndStaysInTheWorld', () => {
    expect(BLOCK_TYPES.questionMark).toMatchObject({ maxHits: 1, removeWhenUsedUp: false });
  });
});

describe('block frame selection', () => {
  it('intactQuestionMark-usesItsOwnFrame', () => {
    expect(BLOCK_TYPES.questionMark.frameIndex(0)).toBe(32);
  });

  it('usedUpQuestionMark-swapsToThePlainGroundFrame', () => {
    expect(BLOCK_TYPES.questionMark.frameIndex(1)).toBe(1);
  });

  it('crate-keepsOneFrameRegardlessOfHits', () => {
    expect(BLOCK_TYPES.crate.frameIndex(0)).toBe(BLOCK_TYPES.crate.frameIndex(2));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/entities/blocks/index.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write the three modules and the registry**

Each is small. `Crate.ts` as the worked example:

```typescript
import type { BlockType } from './BlockType';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';

/** Row 3, column 7 of the shared tileset. */
const CRATE_FRAME = 55;

export const crate: BlockType = {
  key: 'crate',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  // Two hits: the first cracks it, the second shatters it.
  maxHits: 2,
  removeWhenUsedUp: true,
  frameIndex: () => CRATE_FRAME,
  // Filled in when rendering moves into this module.
  draw: () => {},
};
```

`FragileRock.ts` mirrors it with frame 3, `maxHits: 1`, `removeWhenUsedUp: true`.

`QuestionMark.ts` has the one frame swap and is the only kind that stays:

```typescript
/** Row 2, column 0 while intact. */
const INTACT_FRAME = 32;
/** The plain top-exposed groundRock tile (row 0, column 1) — a spent
 *  question-mark blends into ordinary ground rather than reading as a
 *  distinct block kind. */
const SPENT_FRAME = 1;

export const questionMark: BlockType = {
  key: 'questionMark',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  maxHits: 1,
  // Stays as a permanent solid block once spent; only its frame changes.
  removeWhenUsedUp: false,
  frameIndex: (hitsTaken) => (hitsTaken >= 1 ? SPENT_FRAME : INTACT_FRAME),
  draw: () => {},
};
```

`animations: {}` matches the pickup convention: block frame selection goes through `frameIndex`, not through named animations.

Create `entities/blocks/index.ts` exporting `BLOCK_TYPES = { crate, questionMark, fragileRock }` and `BlockTypeKey`. No dispatcher is needed — `BlockState.blockKind` indexes the registry directly and every entry has the same state type.

- [ ] **Step 4: Point `Block.ts`'s rules at the registry**

Rewrite the three rule functions to read `BLOCK_TYPES`, keeping their exact signatures:

```typescript
export function maxHitsForBlock(blockKind: BlockKind): number {
  return BLOCK_TYPES[blockKind].maxHits;
}

export function isBlockRemoved(block: BlockState): boolean {
  if (!BLOCK_TYPES[block.blockKind].removeWhenUsedUp) return false;
  return isBlockUsedUp(block) && block.animState === 'idle';
}

export function blockFrameSource(blockKind: BlockKind, hitsTaken = 0): { sx: number; sy: number } {
  const { sprite } = BLOCK_TYPES[blockKind];
  return frameSource(sprite.sheet, BLOCK_TYPES[blockKind].frameIndex(hitsTaken));
}
```

`isBlockUsedUp` is unchanged — it already delegates to `maxHitsForBlock`.

**Watch for a module cycle**, the same hazard the enemy registry hit: if `Block.ts` imports `BLOCK_TYPES` and any block module imports `Block.ts`, the registry is `undefined` at init. `BlockType.ts` imports `BlockState` as a TYPE ONLY, which is erased at runtime and therefore safe; the three modules must import no runtime value from `../Block`. Verify with `grep -rn "from '\.\./Block'" src/themes/platformer/entities/blocks/` and confirm every hit is a `import type`.

`Block.test.ts` keeps its existing assertions unchanged — the values are identical by construction and `index.test.ts` asserts exactly that.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`
Expected: tests pass with `Block.test.ts` unmodified, no `tsc` output, exactly one eslint error.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): move per-block-kind rules into self-contained modules"
```

---

### Task 3: Block rendering moves into the modules

**Model:** Sonnet 5 to implement; Opus to review. This RELOCATES canvas arithmetic including two crate-only effects.

**Files:**
- Modify: `src/themes/platformer/entities/blocks/Crate.ts`, `QuestionMark.ts`, `FragileRock.ts`
- Modify: `src/themes/platformer/engine/Renderer.ts` (`drawBlocks`)
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Produces: `BlockType.draw` implemented for all three. `drawBlocks(ctx, blocks, dc)` replaces the six-positional-argument signature.

- [ ] **Step 1: Write the failing test**

Add to `src/themes/platformer/engine/Renderer.test.ts`:

```typescript
describe('block drawing delegates to the type modules', () => {
  it('everyBlockKind-drawsFromTheSharedTileset', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    drawBlocks(ctx, [makeBlock('crate'), makeBlock('questionMark'), makeBlock('fragileRock')], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[WORLD_TILESET_SHEET.src])).toHaveLength(3);
  });

  it('crateOnItsFirstHit-alsoDrawsTheCrackOverlay', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    drawBlocks(ctx, [makeBlock('crate', { hitsTaken: 1 })], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[CRACK_OVERLAY_SHEET.src])).toHaveLength(1);
  });

  it('intactCrate-drawsNoCrackOverlay', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    drawBlocks(ctx, [makeBlock('crate', { hitsTaken: 0 })], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[CRACK_OVERLAY_SHEET.src])).toHaveLength(0);
  });

  it('missingTilesetImage-drawsNothing', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx, { [WORLD_TILESET_SHEET.src]: null });
    drawBlocks(ctx, [makeBlock('crate')], dc);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
```

Reuse the file's existing `makeMockContext`, `makeDrawContext` and `drawImageCallsFor` helpers, and add a `makeBlock(kind, overrides)` helper building a real `BlockState` via `toBlockState` rather than an ad-hoc literal.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL — `drawBlocks` arity mismatch.

- [ ] **Step 3: Move the drawing into the modules**

**Move the blocks verbatim.** `drawBlocks`' loop body today does: source rect from `blockFrameSource`, destination `x + originX`, `y + originY + blockBumpOffsetY(block)`, size `BLOCK_RENDERED_SIZE`, `globalAlpha` set to `crateShatterOpacity` for crates and 1 otherwise, then the crack overlay composited for a crate with `crateCrackOverlayVisible(hitsTaken)`, then `globalAlpha` restored to 1.

Split it so each module owns only what applies to it:

- `QuestionMark.draw` and `FragileRock.draw`: the plain blit at full opacity, with the bump offset.
- `Crate.draw`: the same blit wrapped in the shatter opacity, plus the crack overlay when `crateCrackOverlayVisible(block.hitsTaken)`.

`blockBumpOffsetY` stays shared in `BlockAI.ts` — every kind bumps. `crateShatterOpacity` (currently in `BlockAI.ts`) and `crateCrackOverlayVisible` (currently in `Block.ts`) are crate-only and **move into `Crate.ts`** alongside the code that uses them; delete them from their current homes once nothing else references them, and `grep -rn` for other callers first.

**Moving them is a cycle requirement, not a tidiness preference.** After Task 2, `Block.ts` imports `BLOCK_TYPES` at runtime, so `Block.ts → blocks/index.ts → Crate.ts`. If `Crate.ts` then imported `crateCrackOverlayVisible` back from `../Block` as a VALUE, that closes a runtime cycle and `BLOCK_TYPES` is `undefined` at module init — the same failure the enemy registry hit. The dependency edge must run one way: `Block.ts` → `blocks/*`, never back.

`Crate.ts` importing `blockBumpOffsetY` from `BlockAI.ts` is safe, because `BlockAI.ts` imports `BlockState` from `../Block` as a TYPE ONLY, which is erased at runtime. Verify after this task: `grep -rn "from '\.\./Block'" src/themes/platformer/entities/blocks/` must show only `import type` lines.

Consider extracting the common blit into a small shared helper under `entities/blocks/` if all three modules would otherwise repeat it verbatim — but only if the extraction is exact. Do not force the crate's alpha and overlay through a shared signature.

- [ ] **Step 4: Reduce `drawBlocks` to a loop**

```typescript
/** Draws every block. Knows nothing about any specific kind — each one renders
 *  itself (see entities/blocks/). */
export function drawBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: readonly BlockState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const block of blocks) {
    BLOCK_TYPES[block.blockKind].draw(block, dc);
  }
}
```

Afterwards `grep -n "'crate'\|'questionMark'\|'fragileRock'" src/themes/platformer/engine/Renderer.ts` must return nothing.

In `PlatformerPage.tsx`, add `WORLD_TILESET_SHEET` and `CRACK_OVERLAY_SHEET` to the registry-driven `collectSheetSources` call and pass the `DrawContext` to `drawBlocks`. **Keep the existing `tilesetRef` and `crackOverlayRef` if any other consumer still reads them** — `drawTerrain` certainly reads the tileset. Check every consumer before removing a ref; a half-migration is worse than none.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`
Expected: tests pass, no `tsc` output, exactly one eslint error.

- [ ] **Step 6: Verify in the browser**

Open a FRESH browser tab — a reload does not recover a tab whose Vite HMR runtime threw during editing. Confirm against the pre-refactor look: all three block kinds render; hitting a crate from below cracks it then shatters it with a fade; a question-mark bumps and swaps to plain ground; a fragile rock bumps and disappears; every kind's bump nudge looks unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): let each block kind render itself"
```

---

### Task 4: The chest module

**Model:** Sonnet 5.

**Files:**
- Create: `src/themes/platformer/entities/chests/Chest.ts`
- Create: `src/themes/platformer/entities/chests/index.ts`
- Create: `src/themes/platformer/entities/chests/index.test.ts`
- Modify: `src/themes/platformer/engine/Renderer.ts` (`drawChests`)
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Test: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Produces: `CHEST_TYPE` from `entities/chests/index.ts`. `drawChests(ctx, chests, dc)` replaces the six-positional-argument signature.

- [ ] **Step 1: Write the failing test**

Create `src/themes/platformer/entities/chests/index.test.ts`:

```typescript
import { CHEST_TYPE } from './index';
import { CHEST_CLOSED_SHEET, CHEST_OPEN_SHEET } from '../sprites/sheets';

describe('CHEST_TYPE', () => {
  it('closedAndOpen-pointAtTheirOwnSheets', () => {
    expect(CHEST_TYPE.closed.sheet).toBe(CHEST_CLOSED_SHEET);
    expect(CHEST_TYPE.open.sheet).toBe(CHEST_OPEN_SHEET);
  });

  it('theTwoStates-haveDifferentNativeWidths', () => {
    // A chest's open and closed art are different sizes, which is why each is
    // its own sheet with its own centering offset.
    expect(CHEST_TYPE.closed.sheet.frameWidth).not.toBe(CHEST_TYPE.open.sheet.frameWidth);
  });
});
```

Add to `src/themes/platformer/engine/Renderer.test.ts`:

```typescript
describe('chest drawing delegates to the type module', () => {
  it('closedChest-drawsFromTheClosedSheet', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    drawChests(ctx, [toChestState(makeChestPlacement())], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[CHEST_CLOSED_SHEET.src])).toHaveLength(1);
    expect(drawImageCallsFor(ctx, dc.sprites[CHEST_OPEN_SHEET.src])).toHaveLength(0);
  });

  it('openChest-drawsFromTheOpenSheet', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    drawChests(ctx, [openChest(toChestState(makeChestPlacement()))], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[CHEST_OPEN_SHEET.src])).toHaveLength(1);
  });
});
```

Match the file's existing helper names and add `makeChestPlacement` if none exists.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/themes/platformer/entities/chests/index.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write the module**

`entities/chests/Chest.ts` exposes both descriptors and a `draw` that picks by `isChestOpen(chest)`. **Move `drawChests`' body verbatim** — the source dimensions, destination dimensions and the `offsetX` centering all differ per state and are already correct; relocate them rather than recomputing. The offsets come from `entities/Chest.ts`'s `CHEST_CLOSED_OFFSET_X` / `CHEST_OPEN_OFFSET_X`; import them, do not restate the arithmetic.

Create `entities/chests/index.ts` exporting `CHEST_TYPE`. There is one chest kind, so this is a single export rather than a keyed registry — note in a comment that it becomes a registry if a second kind appears.

- [ ] **Step 4: Reduce `drawChests` to a loop**

```typescript
export function drawChests(
  ctx: CanvasRenderingContext2D,
  chests: readonly ChestState[],
  dc: DrawContext,
): void {
  ctx.imageSmoothingEnabled = false;
  for (const chest of chests) {
    CHEST_TYPE.draw(chest, dc);
  }
}
```

Add both chest sheets to the `collectSheetSources` call in `PlatformerPage.tsx` and pass the `DrawContext`. Keep `chestClosedSpriteRef` / `chestOpenSpriteRef` if any other consumer reads them — check `drawChestCounter` first.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`, `npx tsc -b --noEmit`, `npx eslint src/themes/platformer`
Expected: tests pass, no `tsc` output, exactly one eslint error.

- [ ] **Step 6: Verify in the browser**

In a FRESH tab: a closed chest renders centered on its tile; opening it with a key swaps to the open sprite, which is a different width and must still sit centered; the chest counter in the HUD still updates.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer
git commit -m "refactor(platformer): let the chest render itself"
```

---

## Done criteria

- `grep -n "'crate'\|'questionMark'\|'fragileRock'" src/themes/platformer/engine/Renderer.ts` returns nothing.
- `blockFrameSource`'s coordinate switch, `maxHitsForBlock`'s ternary and `isBlockRemoved`'s question-mark special-case are all gone, replaced by registry reads.
- No module in the block or chest DRAW PATH names a sprite asset path. The HUD counters and the editor palette legitimately keep their own refs.
- `npm test` and `npx tsc -b --noEmit` pass with no `tsc` output; `npx eslint src/themes/platformer` reports exactly the one pre-existing error.
- Adding a fourth block kind would require: one new module, one line in `blocks/index.ts`, one frame index — and no edit to `Renderer.ts` or any sprite registry. Placing one in a level still touches `LevelParser.ts`, `BlockMapper.ts` and the editor, which is outside this plan's scope.

## Next

The player, as its own plan written against the shapes this one produces.
