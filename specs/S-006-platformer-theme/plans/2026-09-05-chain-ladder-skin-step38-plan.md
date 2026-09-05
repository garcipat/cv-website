# Chain Ladder Skin (Roadmap Step 38) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `chain` terrain tile (level marker `I`) that climbs exactly like a ladder, but reads visually as either hanging free from the ceiling (rendered centered) or hugging a wall to its side (rendered offset a quarter-tile toward that wall) — decided per-cell from its neighbours, with a single reused sprite (no new art).

**Architecture:** `chain` is a new `TileType` (`LevelData.ts`), parsed from level layouts via `TERRAIN_CHARS.I` (`LevelParser.ts`) exactly like `ladder`/`L`. Physics needs zero changes: `Physics.ts` already climbs through `isClimbable`/`isStandableLadderTop` (`Terrain.ts`) rather than checking `tile === 'ladder'` directly, so widening `isClimbable` to also accept `'chain'` makes every existing ladder mechanic (climbing, standing on the shaft's open top, hint interactions) work for chain for free. Rendering is the only new logic: a new `chainAttachment` helper in `Terrain.ts` classifies a chain cell as `'ceiling'` (a solid tile directly above — checked first) or `'left'`/`'right'` (a solid tile to that side, checked only when nothing solid is above), falling back to `'ceiling'` when no neighbour is solid at all. `Renderer.ts`'s `drawTerrain` uses this to shift the sprite's **destination** x by ±`RENDERED_TILE_SIZE / 4` — the same single sprite (one of 4 near-identical variants already in `staticObjects.png`, picked the same way `bushOrTreeEntry` already picks bush variants) drawn at a different spot in its cell, not new art. This is the first tile in this codebase to use a destination offset rather than only varying the source rect (bridge/bush/fence all vary source, never destination) — flagged inline where it happens.

**Tech Stack:** TypeScript, Vitest + React Testing Library (existing stack, no new dependencies).

**Spec:** This plan's own "Design" section below, plus roadmap step 38 in `specs/S-006-platformer-theme/roadmap.md` (already updated with the resolved design and the letter-collision note below) — no separate written design doc exists for this step, matching the convention already used for steps 37/35a/etc.

## Design (agreed in chat before this plan was written)

- **Level marker:** `I` (terrain character, alongside `L` for ladder). Confirmed free in `TERRAIN_CHARS`/`ENTITY_CHARS`/`SIGN_CHARS` at the time this plan was written. Roadmap step 39 (not yet implemented) had *proposed* remapping wall's marker to `I` — since this step claims `I` first, step 39's wall target was moved to `#` instead (already updated in `roadmap.md`).
- **Physics:** identical to ladder — fully climbable, same "standable shaft top" behavior. Achieved by widening `Terrain.ts`'s `isClimbable` to accept both `'ladder'` and `'chain'`; `isStandableLadderTop` already calls `isClimbable` internally (not a hardcoded `tile === 'ladder'` check), so it needs no change of its own. `Physics.ts` itself needs no changes — confirmed it only ever calls `isClimbable`/`isStandableLadderTop`, never checks the tile string directly.
- **Attachment rule (decides rendering only, not physics):** checked in this order — (1) solid tile directly above → `'ceiling'`; (2) else solid tile to the left → `'left'`; (3) else solid tile to the right → `'right'`; (4) else (isolated/mis-authored chain tile) → falls back to `'ceiling'`. Ceiling is checked first and wins even when a side is *also* solid (e.g. a shaft corner), so there's never an ambiguous case.
- **Sprite:** `staticObjects.png` (288×144, already registered as `STATIC_OBJECTS_SHEET`) has a vertical chain-link tile repeated at columns 5–8, row 7 (`sx: 80/96/112/128, sy: 112`) — 4 near-identical variants of the same uniform, seamlessly-repeatable link (confirmed by visual inspection: no distinct top/bottom end-cap art exists, so — like ladder's own single fixed sprite reused for every row of a shaft — the same frame is drawn for every row of a chain, regardless of attachment). One of the 4 is picked per-cell the same way `bushOrTreeEntry` already picks among bush variants (`StaticObjectsCatalog.ts`'s `pickVariant`), purely for visual variety between adjacent chains, not because attachment changes the sprite.
- **Rendering offset:** `'ceiling'` draws at the cell's normal destination (no offset); `'left'`/`'right'` shift the destination x by ∓`RENDERED_TILE_SIZE / 4` (8px at the current 32px rendered tile size) toward that side. This is a deliberate trick (confirmed in chat) rather than hand-drawn left/right art: the same uniform link sprite just sits at a different spot within its tile.
- **Explicitly out of scope for this step:** placing an actual `I` tile in the real shipped level (`level.ts`'s `LEVEL_1_LAYOUT`) — this step delivers the mechanic and its Level Editor support; a level author can paint it via the editor (which pulls `TERRAIN_CHARS`/`PALETTE_TILE_SPRITES` automatically, needing no editor-specific code changes — confirmed both `Palette.tsx`'s terrain group and `EditorCanvas.tsx`'s preview reuse the exact same `TERRAIN_CHARS`/`drawTerrain` this plan touches). Also out of scope: any new hint sign for chain (existing sign `'2'` already covers `ladderClimbUp`; reusing it for chain, if desired, is a level-authoring decision, not a code change).

## Global Constraints

- TypeScript strict mode, no `any` (constitution Principle I).
- TDD: tests before implementation, every test passing before moving on (constitution Principle II).
- Named arrow function exports, typed props/params inline, no default exports (constitution Principle III) — this plan touches no React components; existing helper/function conventions in `src/themes/platformer/` already follow this.
- No new dependencies, no new sprite art.
- Update `specs/S-006-platformer-theme/roadmap.md` (check off step 38) once implementation + tests are done and manually verified in the Level Editor — this is a platformer roadmap step, not a `docs/Features.md` entry (confirmed: `docs/Features.md` tracks the platformer theme as one line, S-006, still "Planned" as a whole; individual steps live only in the roadmap).

---

## File Structure

Modified files (grouped by task below):
- `src/themes/platformer/level/LevelData.ts` — `TileType` union.
- `src/themes/platformer/level/LevelParser.ts` + `LevelParser.test.ts` — `TERRAIN_CHARS.I`, `TileChar` union.
- `src/themes/platformer/level/Terrain.ts` + `Terrain.test.ts` — `isClimbable` widened, new `chainAttachment`.
- `src/themes/platformer/engine/StaticObjectsCatalog.ts` + `StaticObjectsCatalog.test.ts` — chain sprite variants.
- `src/themes/platformer/engine/Renderer.ts` + `Renderer.test.ts` — draws the `chain` tile.
- `src/themes/platformer/editor/paletteTiles.ts` — `I` entries in the three exhaustive `Record<TileChar, ...>` maps (no test changes needed — existing tests iterate generically over every key).

No new files.

---

### Task 1: `chain` `TileType` + level marker `I`

**Files:**
- Modify: `src/themes/platformer/level/LevelData.ts`
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Modify: `src/themes/platformer/level/LevelParser.test.ts`

**Interfaces:**
- Produces: `TileType` includes `'chain'`; `TERRAIN_CHARS.I === 'chain'`; `TileChar` includes `'I'`. Consumed by Task 2 (`Terrain.ts`), Task 3/4 (rendering), Task 5 (editor palette).

- [ ] **Step 1: Write the failing tests**

In `LevelParser.test.ts`, add a new describe block right after the existing `describe('ladder terrain character', ...)` block (around line 142):

```ts
describe('chain terrain character', () => {
  it('terrainChars-mapsIToChain', () => {
    expect(TERRAIN_CHARS.I).toBe('chain');
  });

  it('chainChar-parsesAsChainTile', () => {
    const result = parseLevel(['I.', 'GG']);
    expect(result.terrain[0][0]).toBe('chain');
  });
});
```

Then update the `TileChar` describe block's literal array (around line 342) to include `'I'`:

```ts
    const tileChars: readonly TileChar[] = [
      '.', 'G', 'R', 'W', 'B', 'L', 'I', 'P', 'S', 'E', 'M', 'C', 'X', 'Q', 'F', 'T', 'u',
      '1', '2', '3', '4', '5', 'n', 'N',
    ];
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- LevelParser.test.ts -t chain`
Expected: FAIL — `TERRAIN_CHARS.I` is `undefined`, `parseLevel` throws `Unknown level tile character: "I"`.

- [ ] **Step 3: Implement**

In `LevelData.ts`, add `'chain'` to the `TileType` union, right after `'ladder'`:

```ts
export type TileType =
  | 'groundGrass'
  | 'groundRock'
  | 'wall'
  | 'bridge'
  | 'ladder'
  /** Climbs exactly like `'ladder'` (see Terrain.ts's `isClimbable`) — a
   *  purely visual alternative skin. Renders centered when hanging free
   *  from a solid ceiling, or offset toward whichever side (if any) has
   *  solid terrain next to it (Terrain.ts's `chainAttachment`). */
  | 'chain'
  /** An invisible, non-solid enemy patrol boundary: nothing renders it, and
   *  the player passes straight through, but `EnemyAI.ts` reverses a patrol
   *  that walks into one exactly as if it were a wall — the way a level
   *  author pens an enemy into a stretch of open ground without putting a
   *  visible obstacle there. */
  | 'patrol'
  | 'bush'
  | 'fence'
  | 'empty';
```

In `LevelParser.ts`, add `I: 'chain'` to `TERRAIN_CHARS` (right after `L: 'ladder'`):

```ts
export const TERRAIN_CHARS: Record<string, TileType | undefined> = {
  '.': 'empty',
  G: 'groundGrass',
  R: 'groundRock',
  W: 'wall',
  B: 'bridge',
  L: 'ladder',
  I: 'chain',
  P: 'patrol',
  n: 'bush',
  N: 'fence',
};
```

Add `| 'I'` to the `TileChar` union, right after `| 'L'`:

```ts
export type TileChar =
  | '.'
  | 'G'
  | 'R'
  | 'W'
  | 'B'
  | 'L'
  | 'I'
  | 'P'
  | 'S'
  | 'E'
  | 'M'
  | 'C'
  | 'X'
  | 'Q'
  | 'F'
  | 'T'
  | 'u'
  | 'n'
  | 'N'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- LevelParser.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: FAILS at this point — `paletteTiles.ts`'s three exhaustive `Record<TileChar, ...>` maps are now missing a required `I` key. This is expected and fixed in Task 5; do not attempt to fix it here.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/level/LevelData.ts src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts
git commit -m "feat(platformer): add chain TileType and I level marker"
```

---

### Task 2: `Terrain.ts` — generalize `isClimbable`, add `chainAttachment`

**Files:**
- Modify: `src/themes/platformer/level/Terrain.ts`
- Modify: `src/themes/platformer/level/Terrain.test.ts`

**Interfaces:**
- Consumes: `TileType` (now includes `'chain'`, Task 1), `parseLevel` (test only).
- Produces: `isClimbable(tile)` returns `true` for `'chain'` too; `ChainAttachment = 'ceiling' | 'left' | 'right'`; `chainAttachment(level, col, row): ChainAttachment`. Consumed by Task 4 (`Renderer.ts`).

- [ ] **Step 1: Write the failing tests**

In `Terrain.test.ts`, add a new case to the existing `isClimbable` describe block (around line 291) — insert a new `it` right after `'ladder-returnsTrue'`:

```ts
  it('chain-returnsTrue', () => {
    expect(isClimbable('chain')).toBe(true);
  });
```

Add a new case to the existing `isStandableLadderTop` describe block (around line 317) — insert right after `'ladderWithOpenSpaceAbove-returnsTrue'`, proving the generalization works through the real parser (`parseLevel`'s `I` → `chain`, wired in Task 1):

```ts
  it('chainWithOpenSpaceAbove-returnsTrue-sameGeneralizationAsLadder', () => {
    const level = parseLevel(['.', 'I', 'G']);
    expect(isStandableLadderTop(level, 0, 1)).toBe(true);
  });
```

Then add a new describe block after `isStandableLadderTop`'s (around line 337, before `describe('verticalRunRole', ...)`):

```ts
describe('chainAttachment', () => {
  it('solidTileDirectlyAbove-returnsCeiling', () => {
    const level: LevelDef = { width: 1, height: 2, terrain: [['wall'], ['chain']] };
    expect(chainAttachment(level, 0, 1)).toBe('ceiling');
  });

  it('solidTileToTheLeft-nothingSolidAbove-returnsLeft', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['wall', 'chain']] };
    expect(chainAttachment(level, 1, 0)).toBe('left');
  });

  it('solidTileToTheRight-nothingSolidAboveOrLeft-returnsRight', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['chain', 'wall']] };
    expect(chainAttachment(level, 0, 0)).toBe('right');
  });

  it('solidAboveAndToTheSide-ceilingTakesPriorityOverSide', () => {
    const level: LevelDef = {
      width: 3,
      height: 2,
      terrain: [
        ['empty', 'wall', 'empty'],
        ['wall', 'chain', 'empty'],
      ],
    };
    expect(chainAttachment(level, 1, 1)).toBe('ceiling');
  });

  it('noSolidNeighbourAnywhere-fallsBackToCeiling', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['chain']] };
    expect(chainAttachment(level, 0, 0)).toBe('ceiling');
  });
});
```

Add `chainAttachment` to the existing `import { ... } from './Terrain';` list at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- Terrain.test.ts -t "chain"`
Expected: FAIL — `isClimbable('chain')` returns `false`; `chainAttachment is not a function` (TypeScript compile error inside the test file is an acceptable failure mode here, same convention as other plans in this roadmap).

- [ ] **Step 3: Implement in `Terrain.ts`**

Change `isClimbable` (currently returns `tile === 'ladder'`):

```ts
/**
 * Whether the player can climb this tile — `'ladder'` and its purely visual
 * `'chain'` skin (roadmap step 38) behave identically here and everywhere
 * else in this file/Physics.ts, which is exactly why `'chain'` needs no
 * physics code of its own: every consumer of `isClimbable`/
 * `isStandableLadderTop` already goes through these two functions rather
 * than checking `tile === 'ladder'` directly.
 * Deliberately NOT part of `isSolid`: a climbable tile never blocks
 * horizontal movement or counts as ground; `Physics.ts`'s climbing branch is
 * the only place vertical movement through one is resolved.
 */
export function isClimbable(tile: TileType): boolean {
  return tile === 'ladder' || tile === 'chain';
}
```

Add, after `verticalRunRole` at the end of the file:

```ts
export type ChainAttachment = 'ceiling' | 'left' | 'right';

/**
 * Where a `chain` tile's sprite should read as attached, purely for
 * rendering (Renderer.ts) — has no bearing on physics, which treats every
 * chain tile identically regardless of attachment (see `isClimbable`).
 * Checked in this priority order: a solid tile directly above wins
 * ('ceiling', drawn centered) even when a side is ALSO solid (e.g. a shaft
 * corner) — only when nothing solid is above does a solid neighbour to the
 * left or right decide 'left'/'right' (drawn hugging that wall). Falls back
 * to 'ceiling' when no neighbour is solid at all, so an isolated or
 * mis-authored chain tile still renders in a well-defined position rather
 * than an implicit fourth case.
 */
export function chainAttachment(level: LevelDef, col: number, row: number): ChainAttachment {
  if (isSolid(tileAt(level, col, row - 1))) return 'ceiling';
  if (isSolid(tileAt(level, col - 1, row))) return 'left';
  if (isSolid(tileAt(level, col + 1, row))) return 'right';
  return 'ceiling';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- Terrain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/Terrain.ts src/themes/platformer/level/Terrain.test.ts
git commit -m "feat(platformer): generalize isClimbable to chain, add chainAttachment"
```

---

### Task 3: `StaticObjectsCatalog.ts` — chain sprite variants

**Files:**
- Modify: `src/themes/platformer/engine/StaticObjectsCatalog.ts`
- Modify: `src/themes/platformer/engine/StaticObjectsCatalog.test.ts`

**Interfaces:**
- Produces: `staticObjectEntry(tile: 'fence' | 'chain', col, row): StaticObjectEntry` — widened from `'fence'`-only. Consumed by Task 4 (`Renderer.ts`).

- [ ] **Step 1: Write the failing tests**

In `StaticObjectsCatalog.test.ts`, add a new describe block after the existing `staticObjectEntry-fence-...` tests:

```ts
describe('staticObjectEntry — chain', () => {
  it('chain-resolvesToARectInsideTheSheetOnA16pxGrid', () => {
    const entry = staticObjectEntry('chain', 0, 0);
    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_WIDTH);
    expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(STATIC_OBJECTS_SHEET_HEIGHT);
  });

  it('chain-sameColAndRow-isDeterministic', () => {
    expect(staticObjectEntry('chain', 3, 5)).toEqual(staticObjectEntry('chain', 3, 5));
  });

  it('chain-differentPositions-canResolveToDifferentVariants', () => {
    // (0,0) and (1,1) land on different variants of the 4 available (see
    // StaticObjectsCatalog.ts's CHAIN_VARIANTS) — confirms position actually
    // drives variant choice, unlike fence's single-variant array.
    expect(staticObjectEntry('chain', 0, 0)).toEqual({ sx: 80, sy: 112 });
    expect(staticObjectEntry('chain', 1, 1)).toEqual({ sx: 112, sy: 112 });
  });
});
```

(`describe` and `it`/`expect` are already imported at the top of this file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- StaticObjectsCatalog.test.ts -t chain`
Expected: FAIL — TypeScript error, `'chain'` is not assignable to the narrower `'fence'` parameter type.

- [ ] **Step 3: Implement in `StaticObjectsCatalog.ts`**

Add the new variants array, right after `FENCE_VARIANTS`:

```ts
/** A vertical hanging-chain link, uniform and seamlessly repeatable row to
 *  row — unlike BUSH_OR_TREE_VARIANTS there is no distinct top/bottom
 *  end-cap art, so (like `Renderer.ts`'s ladder sprite) the same frame is
 *  reused for every row of a shaft regardless of length. The 4 near-identical
 *  columns exist purely for `pickVariant`'s per-cell visual variety, the
 *  same reason BUSH_OR_TREE_VARIANTS.only has 4 entries. */
const CHAIN_VARIANTS: StaticObjectEntry[] = [
  { sx: 80, sy: 112 },
  { sx: 96, sy: 112 },
  { sx: 112, sy: 112 },
  { sx: 128, sy: 112 },
];
```

Replace `staticObjectEntry`'s current body (which ignores `tile` — only fence uses it today):

```ts
export function staticObjectEntry(tile: 'fence', col: number, row: number): StaticObjectEntry {
  void tile; // only one static-object kind uses this function today
  return pickVariant(FENCE_VARIANTS, col, row);
}
```

with:

```ts
export function staticObjectEntry(tile: 'fence' | 'chain', col: number, row: number): StaticObjectEntry {
  return pickVariant(tile === 'fence' ? FENCE_VARIANTS : CHAIN_VARIANTS, col, row);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- StaticObjectsCatalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/StaticObjectsCatalog.ts src/themes/platformer/engine/StaticObjectsCatalog.test.ts
git commit -m "feat(platformer): add chain sprite variants to StaticObjectsCatalog"
```

---

### Task 4: `Renderer.ts` — draw the `chain` tile

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `chainAttachment`, `ChainAttachment` (Task 2), `staticObjectEntry` (Task 3, already imported as `bushOrTreeEntry, staticObjectEntry` from `./StaticObjectsCatalog`).
- Produces: `drawTerrain` draws `'chain'` tiles. No new exports.

- [ ] **Step 1: Write the failing tests**

In `Renderer.test.ts`, add these tests to the existing `describe('drawTerrain — bush/fence', ...)` block (it already declares `const fakeStaticObjects = {} as HTMLImageElement;` — reuse it):

```ts
  it('chainTile-ceilingAttached-drawsCenteredFromStaticObjects', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['wall'], ['chain']], width: 1, height: 2 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // (col:0, row:1) has a solid tile above -> 'ceiling', no x offset.
    // Variant index for (0,1) -> sx:128, sy:112 (see StaticObjectsCatalog.ts's CHAIN_VARIANTS).
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 128, 112, 16, 16,
      0, 32, 32, 32,
    );
  });

  it('chainTile-leftAttached-drawsOffsetTowardTheLeftWall', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['wall', 'chain']], width: 2, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // (col:1, row:0): nothing above, solid to the left -> 'left', destX shifts
    // by -RENDERED_TILE_SIZE/4 (-8). Cell destX is 1*32=32 -> 24.
    // Variant index for (1,0) -> sx:96, sy:112.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 96, 112, 16, 16,
      24, 0, 32, 32,
    );
  });

  it('chainTile-rightAttached-drawsOffsetTowardTheRightWall', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['chain', 'wall']], width: 2, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // (col:0, row:0): nothing above or left, solid to the right -> 'right',
    // destX shifts by +8. Cell destX is 0 -> 8. Variant index for (0,0) -> sx:80, sy:112.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 80, 112, 16, 16,
      8, 0, 32, 32,
    );
  });

  it('chainTile-noSolidNeighbour-fallsBackToCenteredCeiling', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['chain']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 80, 112, 16, 16,
      0, 0, 32, 32,
    );
  });

  it('staticObjectsNotLoaded-chainDrawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['chain']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- Renderer.test.ts -t chain`
Expected: FAIL — `tileSource`'s exhaustiveness switch doesn't yet have a `'chain'` case (TypeScript compile error), and no `chain` branch exists in `drawTerrain` yet, so nothing currently matching these `drawImage` calls is made.

- [ ] **Step 3: Implement in `Renderer.ts`**

Add `chainAttachment` to the existing `import { ... } from '../level/Terrain';` block at the top of the file (alongside `bridgeRunPosition`, `verticalRunRole`, etc.).

Add a case to `tileSource`'s switch, right after the existing `case 'ladder':` case:

```ts
    case 'chain':
      // Drawn by drawTerrain's own staticObjects branch (position depends on
      // attachment — ceiling/left/right — which this shared lookup has no
      // col/row-aware way to express), like bush/fence.
      return null;
```

In `drawTerrain`, add a new branch right after the existing `if (staticObjects && tile === 'fence') { ... }` block (before `const source = tileSource(...)`):

```ts
      if (staticObjects && tile === 'chain') {
        const attachment = chainAttachment(level, col, row);
        const entry = staticObjectEntry('chain', col, row);
        // The only tile in this codebase that offsets its DESTINATION rect
        // rather than only varying its source rect (contrast bridge/bush/
        // fence, which always draw at the cell's own destX/destY) — a
        // deliberate trick to fake a "left/right attached" look from one
        // uniform sprite instead of drawing dedicated left/right art.
        const offsetX =
          attachment === 'left' ? -RENDERED_TILE_SIZE / 4 :
          attachment === 'right' ? RENDERED_TILE_SIZE / 4 : 0;
        ctx.drawImage(
          staticObjects, entry.sx, entry.sy, TILE_SIZE, TILE_SIZE,
          destX + offsetX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
        );
        continue;
      }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- Renderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(platformer): render chain tiles, offset toward their attached wall"
```

---

### Task 5: Level Editor palette wiring (`paletteTiles.ts`)

**Files:**
- Modify: `src/themes/platformer/editor/paletteTiles.ts`

**Interfaces:**
- Consumes: `TileChar` (now includes `'I'`, Task 1).
- Produces: `PALETTE_TILE_SPRITES.I`, `PALETTE_TILE_DESCRIPTIONS.I`, `PALETTE_TILE_LABELS.I`. No new exports — `Palette.tsx` already derives its "Terrain" group from `Object.keys(TERRAIN_CHARS)` (confirmed: `I` isn't in `DECORATION_CHARS`, so it lands in the plain "Terrain" group alongside ladder/wall/etc. with zero `Palette.tsx` changes), and `EditorCanvas.tsx`'s canvas preview reuses the exact same `drawTerrain` Task 4 already updated.

There is no dedicated new test here — `paletteTiles.test.ts`'s existing tests already iterate generically over every `TileChar` key (they don't hardcode `I` or any other specific character), so they cover this task's correctness once the entries exist; this task is verified by the typecheck and by re-running that existing suite.

- [ ] **Step 1: Add the `I` entry to `PALETTE_TILE_SPRITES`**

In `paletteTiles.ts`, add (right after the existing `L: { ... }` entry, before `P: null,`):

```ts
  I: {
    sheet: '/sprites/staticObjects.png',
    sheetWidth: 288,
    sheetHeight: 144,
    sx: 80,
    sy: 112,
    frameWidth: 16,
    frameHeight: 16,
  },
```

- [ ] **Step 2: Add the `I` entry to `PALETTE_TILE_DESCRIPTIONS`**

Right after the existing `L: 'Climbed with Up and Down',` line:

```ts
  I: 'Chain; climbs exactly like a ladder, offset toward whichever wall (if any) it hangs against',
```

- [ ] **Step 3: Add the `I` entry to `PALETTE_TILE_LABELS`**

Right after the existing `L: 'Ladder',` line:

```ts
  I: 'Chain',
```

- [ ] **Step 4: Run the typecheck to confirm the exhaustive `Record<TileChar, ...>` maps compile**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS (this was the failure left dangling at the end of Task 1 — now resolved).

- [ ] **Step 5: Run the existing palette test suite to confirm it now covers `I` too**

Run: `npm test -- paletteTiles.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full test suite to catch any remaining fallout**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/editor/paletteTiles.ts
git commit -m "feat(platformer): add chain (I) to the Level Editor palette"
```

---

### Task 6: Manual verification + roadmap sign-off

**Files:**
- Modify: `specs/S-006-platformer-theme/roadmap.md` (check off step 38)

- [ ] **Step 1: Start the dev server and open the Level Editor**

Run the `cv-website-dev` preview (`.claude/launch.json`), navigate to the Level Editor page, and select the new "Chain" tile from the Terrain palette group.

- [ ] **Step 2: Paint and verify all three attachment cases visually**

Paint a vertical run of chain tiles hanging from a solid ceiling tile (confirm it renders centered in its column), then a run next to a solid wall on its left (confirm it visually shifts toward that wall), then next to a solid wall on its right (confirm it shifts the other way). Also paint one isolated chain tile with no solid neighbour at all (confirm it falls back to the centered/ceiling look rather than looking broken).

- [ ] **Step 3: Verify climbing works identically to ladder**

Export/load the edited layout into the actual game (or temporarily edit `LEVEL_1_LAYOUT` locally, un-committed, purely for this manual check) and confirm the player can climb a chain shaft with Up/Down and stand on its open top exactly like a ladder shaft. Revert any temporary layout edit before continuing — this step's design explicitly excludes shipping a chain tile in the real level.

- [ ] **Step 4: Check off roadmap step 38**

In `specs/S-006-platformer-theme/roadmap.md`, change step 38's `- [ ]` to `- [x]`.

- [ ] **Step 5: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): mark roadmap step 38 done"
```
