# Platformer Wooden Tiles & Doors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a solid wood ground tile, a darker non-solid wood background material, and a toggleable two-leaf wooden door that blocks/admits both the player and enemies.

**Architecture:** Two terrain additions slot into existing closed-set machinery (`groundRock`'s two-sprite shape; O-014's open background-material set) with no new mechanism. The door reuses O-011's "runtime terrain override" pattern (`DoorState` per placed pair, an `applyOpenedDoors` effective-grid pass), generalized through a new shared `applyTerrainOverrides` helper that also absorbs the existing `applyDeployedLadders`, and widens `activeLevel`'s reader set from player-only to player + enemy movement.

**Tech Stack:** TypeScript 5.x strict, React 19, Preact Signals (`@preact/signals-react`), Canvas 2D, Vitest + React Testing Library + jsdom. No new runtime dependency.

**Spec:** [specs/O-029-platformer-wooden-tiles-doors/spec.md](./spec.md) (behavior) and [design.md](./design.md) (rationale) — this plan argues from both; executors should read both before starting.

## Global Constraints

- TypeScript strict mode, no `any` (constitution I).
- TDD mandatory: write the failing test before the implementation for every step below (constitution II). Test naming: `{method}-{condition}-{expectedResult}`.
- Named arrow-function exports, typed props inline, `cn()` for conditional classes, no default exports (constitution III).
- No backend, no API calls, no new dependency (constitution V).
- Tiles stay stateless values in `LevelDef.terrain` — the only per-instance runtime state this feature adds is `DoorState`, living in a signal in `PlatformerState.ts`, exactly like `DeployableLadderState`/`ChestState` (Terrain.md's "two deliberate exceptions" list, now three).
- A door costs no key and reveals no CV fact (spec FR-009... wait, FR-011). Never touch the chest/key economy.
- `groundWood` MUST NOT autotile — one fixed appearance, no neighbour awareness (spec FR-003).

---

## Task 0: Place Final Art and Record Sprite Coordinates

**Files:**
- Create: `public/sprites/ground_wood.png`
- Create: `public/sprites/background_tiles_wood.png`
- Create: `public/sprites/doors.png` (cropped from `public/sprites/staticObjects.png`, which is otherwise untouched)

**Interfaces:**
- Produces: the exact native-pixel dimensions/frame layout every later task's sheet registration and `tileSource` values need.

Both new wood sprites are **placeholder art**, standing in until proper wood
tiles are designed later. They MUST each live in their own new file —
**never appended to or merged into `world_tileset.png` or
`background_tiles.png`**, which hold only finished, non-placeholder art.
Keeping placeholders in their own dedicated files means replacing them later
is a file swap (and, for the background material, a sheet-registration
change — see Task 11), not a re-crop of every coordinate in a shared atlas.

- [ ] **Step 1: Finalize and place `ground_wood.png`**

A single 32×16 image, two 16×16 frames side by side: frame 0 (x=0..15) is the exposed-top wood plank sprite, frame 1 (x=16..31) is the buried wood sprite — mirrors `crumble_floor.png`'s multi-frame-strip convention (see `sheets.ts`'s `CRUMBLE_FLOOR_SHEET`). Use the palette established in this feature's brainstorming session (`.generated/wood_ground_fg.png`'s left tile) as the exposed-top frame; author a buried variant (same palette, slightly less detail is fine, matching how `groundRock`'s buried frame is plainer than its exposed one). Save to `public/sprites/ground_wood.png` — its own dedicated file, not a cell inside `world_tileset.png`.

- [ ] **Step 2: Create `background_tiles_wood.png` — its own dedicated file**

A single 4-column×3-row block (same `BACKGROUND_ATLAS_STRIDE` layout every existing material uses within `background_tiles.png` — see `BackgroundAtlas.ts`) using the darker wood palette from `.generated/wood_ground_fg.png`'s right tile. This is a SEPARATE image file from `background_tiles.png` — wood is the only material addressed from it (materialIndex 0 within its own file), which Task 11 accounts for with its own small lookup rather than adding a 7th row to `BACKGROUND_MATERIAL_ROW_INDEX`.

- [ ] **Step 3: Crop the four door leaf sprites out of `staticObjects.png` into their own `doors.png`**

Rather than addressing door art in place inside the shared, busy
`staticObjects.png` (hand-picked crop rectangles into a sheet with a lot of
unrelated art around them), crop the four leaves out into a small, dedicated
sheet — a plain 4-frame horizontal strip, each frame the same 16×26 size,
addressed by plain frame index exactly like `TORCH_SHEET`/`BOMB_SHEET`
already are (`frameSource(sheet, index)`), not by hand-picked `sx`/`sy`
crops. This also means door art needs no `StaticObjectsCatalog.ts` entries
at all — see Task 8's reworked scope.

```bash
python3 -c "
from PIL import Image
im = Image.open('public/sprites/staticObjects.png').convert('RGBA')
px = im.load()
w, h = im.size
def bbox(x0, y0, x1, y1):
    minx, maxx, miny, maxy = w, 0, h, 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            if px[x, y][3] > 10:
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
    return (minx, miny, maxx - minx + 1, maxy - miny + 1)
# Adjust these search windows if the sheet has moved since this plan was written.
closed = bbox(60, 66, 105, 100)   # the flush closed pair
open_a = bbox(29, 62, 52, 98)     # one open leaf (mirror for the other side)
print('closed pair:', closed)
print('open leaf:', open_a)

# Build the 4-frame strip: closed-left, closed-right, open-left, open-right,
# each cropped to a common 16x26 frame and pasted left-to-right. Adjust the
# per-leaf sub-crops below once 'closed'/'open_a' above confirm exact leaf
# boundaries within each bbox (a closed pair's bbox spans BOTH leaves; split
# it at its horizontal midpoint for the left/right halves).
FRAME_W, FRAME_H = 16, 26
strip = Image.new('RGBA', (FRAME_W * 4, FRAME_H), (0, 0, 0, 0))
# ... crop each of the four leaves from im using the measured boxes and
# strip.paste(leaf, (i * FRAME_W, 0)) for i in 0..3, in the order
# closed-left, closed-right, open-left, open-right ...
strip.save('public/sprites/doors.png')
"
```

Verify the saved `doors.png` is exactly 64×26 (4 frames × 16 wide, 26 tall) before moving on — a mismatched frame size breaks `frameSource`'s plain grid-division addressing.

Cross-check each printed box against the spec's Clarifications (each leaf 16×26 native px) and design.md's "Open art already exists" section before using the numbers in Task 4 — if a box doesn't match that shape, widen the search window and re-run rather than guessing.

- [ ] **Step 4: Commit the art**

```bash
git add public/sprites/ground_wood.png public/sprites/background_tiles_wood.png public/sprites/doors.png
git commit -m "art(O-029): add placeholder wood sprites and a dedicated door sprite strip"
```

---

## Task 1: Foundational Types — `TileType`, Fog Exemption, Background Material

**Files:**
- Modify: `src/themes/platformer/level/LevelData.ts`
- Test: `src/themes/platformer/level/LevelData.test.ts` (create if it doesn't exist; otherwise extend)
- Modify: `src/themes/platformer/engine/BackgroundAtlas.ts` (placeholder `wood` entry only — see Step 3a)
- Modify: `src/themes/platformer/editor/backgroundPaletteTiles.ts` (placeholder `wood` label only — see Step 3a)
- Modify: `src/themes/platformer/level/LevelParser.ts` (the `wood` background character only — see Step 3a)
- Modify: `src/themes/platformer/level/LevelParser.test.ts` (matching test update — see Step 3a)

**Interfaces:**
- Produces: `TileType` members `'groundWood'`, `'doorLeft'`, `'doorRight'`, `'doorLeftOpen'`, `'doorRightOpen'`; `BackgroundMaterialId` member `'wood'`.

**Why this task also touches three files outside `level/LevelData.ts`**: `BACKGROUND_MATERIAL_ROW_INDEX` (`BackgroundAtlas.ts`) and `BACKGROUND_PALETTE_LABELS` (`backgroundPaletteTiles.ts`) are both literal objects typed `Record<BackgroundMaterialId, X>` — TypeScript requires every key of `BackgroundMaterialId` to be present the moment `'wood'` joins that union, and `backgroundPaletteTiles.ts`'s `BACKGROUND_PALETTE_SPRITES` const computes a sprite for every material EAGERLY AT MODULE LOAD (`Object.keys(BACKGROUND_MATERIAL_FAMILY).map(spriteFor)`), so a missing `wood` row crashes at import time, not just at final build. Separately, `backgroundPaletteTiles.ts` already has an existing round-trip test walking every `BackgroundMaterialId` through `BACKGROUND_MATERIAL_CHAR` back to `BACKGROUND_CHARS` (`LevelParser.ts`) — so `wood` also needs its real character mapping there, not a placeholder, or that existing test fails. None of this is optional scope creep — without it, adding `wood` to `BackgroundMaterialId` alone breaks the suite two different ways. Task 11 does NOT remove the two Record placeholders later; it makes them irrelevant by branching around them for `wood` specifically (see Task 11's own note). The `LevelParser.ts` character mapping is not a placeholder — it's real, permanent content, just landing here instead of Task 2 because the existing test demands it exist as soon as `wood` does.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { TILE_FOG_EXEMPT, BACKGROUND_MATERIAL_FAMILY, backgroundMaterialFamily } from './LevelData';

describe('TILE_FOG_EXEMPT-wood-and-door-tiles-haveExplicitEntries', () => {
  it('groundWood is fog-exempt like other solid structure', () => {
    expect(TILE_FOG_EXEMPT.groundWood).toBe(true);
  });
  it('door tiles in every state stay fogged like other authored objects', () => {
    expect(TILE_FOG_EXEMPT.doorLeft).toBe(false);
    expect(TILE_FOG_EXEMPT.doorRight).toBe(false);
    expect(TILE_FOG_EXEMPT.doorLeftOpen).toBe(false);
    expect(TILE_FOG_EXEMPT.doorRightOpen).toBe(false);
  });
});

describe('backgroundMaterialFamily-wood-returnsSurface', () => {
  it('wood is a surface material', () => {
    expect(BACKGROUND_MATERIAL_FAMILY.wood).toBe('surface');
    expect(backgroundMaterialFamily('wood')).toBe('surface');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/level/LevelData.test.ts`
Expected: FAIL (TypeScript error — `groundWood`/`wood` don't exist yet — or a runtime `undefined` mismatch if the test file is new and the project's ts-check happens at build time; either way, not a pass).

- [ ] **Step 3: Add the new `TileType` members**

In `src/themes/platformer/level/LevelData.ts`, add to the `TileType` union (before the trailing `| 'empty'`):

```ts
  /** A solid wood plank ground tile (O-029). Two sprites only — exposed-top
   *  and buried — exactly like `groundRock`'s shape; never autotiles and
   *  carries no neighbour awareness (spec FR-003). */
  | 'groundWood'
  /** The left panel of a closed wooden double door (O-029), author-placed
   *  immediately left of its `doorRight` partner. Solid until opened; see
   *  engine/DoorState.ts's `applyOpenedDoors`. */
  | 'doorLeft'
  /** The right panel of a closed wooden double door (O-029), author-placed
   *  immediately right of its `doorLeft` partner. */
  | 'doorRight'
  /** The open form of `doorLeft` — never author-placeable; produced only by
   *  `applyOpenedDoors` in the effective grid. Non-solid. */
  | 'doorLeftOpen'
  /** The open form of `doorRight` — never author-placeable; produced only by
   *  `applyOpenedDoors` in the effective grid. Non-solid. */
  | 'doorRightOpen'
```

Add matching entries to `TILE_FOG_EXEMPT`:

```ts
  groundWood: true,
  doorLeft: false,
  doorRight: false,
  doorLeftOpen: false,
  doorRightOpen: false,
```

Add `'wood'` to the `BackgroundMaterialId` union and to `BACKGROUND_MATERIAL_FAMILY`:

```ts
export type BackgroundMaterialId =
  | 'dirt'
  | 'rust'
  | 'surfaceStone'
  | 'charcoal'
  | 'maroon'
  | 'caveStone'
  | 'wood';
```

```ts
export const BACKGROUND_MATERIAL_FAMILY: Record<BackgroundMaterialId, BackgroundMaterialFamily> = {
  dirt: 'surface',
  rust: 'surface',
  surfaceStone: 'surface',
  charcoal: 'cave',
  maroon: 'cave',
  caveStone: 'cave',
  wood: 'surface',
};
```

- [ ] **Step 3a: Add the required placeholder entries so the rest of the suite keeps compiling and running**

In `src/themes/platformer/engine/BackgroundAtlas.ts`, add a `wood` entry to `BACKGROUND_MATERIAL_ROW_INDEX` — the VALUE is never actually used for wood once Task 11 lands (Task 11's `backgroundAtlasCell` branches on `material === 'wood'` before ever reading this Record for it), so point it at any existing row and say so plainly:

```ts
/** Each material's row index (0-5) within the shared sheet, top to bottom.
 *  `wood` is a required placeholder, not a real row: TypeScript requires
 *  every `BackgroundMaterialId` to have an entry here, but wood is
 *  addressed from its own dedicated sheet (Task 11) and this value is
 *  never actually read for it once that lands — see Task 11's
 *  `backgroundAtlasCell` branch. */
const BACKGROUND_MATERIAL_ROW_INDEX: Record<BackgroundMaterialId, number> = {
  dirt: 0,
  rust: 1,
  surfaceStone: 2,
  caveStone: 3,
  maroon: 4,
  charcoal: 5,
  wood: 0, // placeholder — never read for wood once Task 11 lands, see comment above
};
```

In `src/themes/platformer/editor/backgroundPaletteTiles.ts`, add the real label (this one has no placeholder-vs-real distinction — it's just the label Task 12 would otherwise add, done here because the `Record` must be exhaustive):

```ts
export const BACKGROUND_PALETTE_LABELS: Record<BackgroundMaterialId, string> = {
  dirt: 'Dirt',
  rust: 'Rust',
  surfaceStone: 'Surface Stone',
  charcoal: 'Charcoal',
  maroon: 'Maroon',
  caveStone: 'Cave Stone',
  wood: 'Wood',
};
```

`BACKGROUND_CHARS` (`LevelParser.ts`) is keyed by CHARACTER, not by `BackgroundMaterialId`, so TypeScript itself imposes no exhaustiveness requirement on it — but `backgroundPaletteTiles.ts` already has an existing round-trip test (`BACKGROUND_MATERIAL_CHAR`'s `it.each(ALL_MATERIALS)('%s-isTheInverseOfBackgroundChars', ...)`) that walks every `BackgroundMaterialId`, looks up its char via `BACKGROUND_MATERIAL_CHAR` (itself derived from `BACKGROUND_CHARS`), and asserts the char maps back to the same material. That test fails for `wood` without a real character mapping — not a crash, a single assertion failure, but still a full-suite regression. So Task 1 also needs the character mapping itself (not a placeholder — this is the actual, correct, permanent mapping Task 2 would otherwise add):

```ts
// in BACKGROUND_CHARS (LevelParser.ts):
  w: 'wood',
```

Add `'w'` to the `BackgroundChar` union alongside it. In `LevelParser.test.ts`, update the existing `backgroundCharUnion-coversEveryBackgroundCharsKeyPlusEmpty` test's hardcoded `chars` array to include `'w'`.

Task 2 (below) no longer needs to touch `BACKGROUND_CHARS`/`BackgroundChar` at all — only the foreground terrain characters (`W`/`d`/`D`) and `findDoorTiles` are still its job.

- [ ] **Step 4: Run the full suite, not just this task's own test file**

Run: `npx vitest run src/themes/platformer/level/LevelData.test.ts`
Expected: PASS

Then run: `npx vitest run` (the full suite)
Expected: PASS, no regressions — this confirms Step 3a's entries actually prevent both the eager-module-load crash in `backgroundPaletteTiles.ts` and the `wood-isTheInverseOfBackgroundChars` round-trip test failure.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/LevelData.ts src/themes/platformer/level/LevelData.test.ts src/themes/platformer/engine/BackgroundAtlas.ts src/themes/platformer/editor/backgroundPaletteTiles.ts src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts
git commit -m "feat(O-029): add wood/door TileType members and wood background material"
```

---

## Task 2: Level Format — Characters, `TileChar`/`BackgroundChar`, `findDoorTiles`

**Files:**
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Modify: `src/themes/platformer/level/LevelParser.test.ts`
- Modify: `src/themes/platformer/editor/paletteTiles.ts` (placeholder sprite/label/description entries only — see Step 3a; same exhaustiveness pattern as Task 1)

**Interfaces:**
- Consumes: `TileType` members from Task 1. (`BackgroundMaterialId`'s `'wood'` and its `BACKGROUND_CHARS`/`BackgroundChar` mapping were already added in Task 1 — see its Step 3a — because an existing round-trip test demanded it; this task no longer touches `BACKGROUND_CHARS`/`BackgroundChar` at all.)
- Produces: `findDoorTiles(layout): { col: number; row: number }[]` (one entry per matched pair, positioned at the **left** leaf's cell).

**Why this task also touches `paletteTiles.ts`**: same shape of issue as Task 1's Step 3a — `PALETTE_TILE_SPRITES`, `PALETTE_TILE_DESCRIPTIONS`, and `PALETTE_TILE_LABELS` are all literal `Record<TileChar, X>` objects, and `paletteTiles.test.ts` has an existing round-trip test enumerating every `TERRAIN_CHARS` key against them. Adding `W`/`d`/`D` to `TileChar` without matching entries in all three breaks that test immediately. Task 2's Step 3a therefore adds placeholder entries (real sprites don't exist yet — `GROUND_WOOD_SHEET`/`DOOR_SHEET` aren't registered until Tasks 8/10) borrowed from existing terrain (e.g. `groundRock`'s/`wall`'s sprite), clearly commented as temporary. Task 12 later REPLACES the placeholder `sx`/`sy`/`sheet` values with the real ones — it does not add new entries for these three chars.

- [ ] **Step 1: Write the failing tests**

```ts
// in LevelParser.test.ts, alongside the existing character-map tests
describe('TERRAIN_CHARS-woodAndDoorChars-mapToNewTileTypes', () => {
  it('W maps to groundWood', () => {
    expect(TERRAIN_CHARS.W).toBe('groundWood');
  });
  it('d and D map to the door panels', () => {
    expect(TERRAIN_CHARS.d).toBe('doorLeft');
    expect(TERRAIN_CHARS.D).toBe('doorRight');
  });
});

describe('findDoorTiles-layoutWithOnePair-returnsLeftLeafPosition', () => {
  it('finds a door pair by its left leaf', () => {
    const layout = ['.....', '.dD..', '.....'];
    expect(findDoorTiles(layout)).toEqual([{ col: 1, row: 1 }]);
  });
});

describe('findDoorTiles-layoutWithTwoPairs-returnsBothInReadingOrder', () => {
  it('finds every pair, reading order', () => {
    const layout = ['dD...', '...dD'];
    expect(findDoorTiles(layout)).toEqual([
      { col: 0, row: 0 },
      { col: 3, row: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/LevelParser.test.ts`
Expected: FAIL — `TERRAIN_CHARS.W` etc. are `undefined`, `findDoorTiles` is not exported.

- [ ] **Step 3: Add the characters and `findDoorTiles`**

In `TERRAIN_CHARS` (`src/themes/platformer/level/LevelParser.ts`), add:

```ts
  // O-029: solid wood ground, non-autotiling (spec FR-003).
  W: 'groundWood',
  // O-029: a wooden double door's two panels — always authored as an
  // adjacent pair, `d` (left) immediately followed by `D` (right).
  d: 'doorLeft',
  D: 'doorRight',
```

Add `'W' | 'd' | 'D'` to the `TileChar` union (append after the existing final member `'g'`).

Add, mirroring `findLadderBundleTiles`'s shape exactly:

```ts
/**
 * Finds every wooden door's **left**-leaf position in a level layout, in
 * reading order — the same direct `TERRAIN_CHARS` scan shape as
 * `findLadderBundleTiles`. The paired `doorRight` cell is always the
 * immediately following column on the same row, by the "always authored as
 * a matched pair" assumption (spec.md Assumptions) — callers derive it as
 * `{ col: col + 1, row }` rather than scanning for it separately.
 */
export function findDoorTiles(layout: readonly string[]): { col: number; row: number }[] {
  const tiles: { col: number; row: number }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      if (TERRAIN_CHARS[layout[row][col]] === 'doorLeft') {
        tiles.push({ col, row });
      }
    }
  }
  return tiles;
}
```

- [ ] **Step 3a: Add placeholder editor-palette entries so `paletteTiles.test.ts`'s round-trip check keeps passing**

In `src/themes/platformer/editor/paletteTiles.ts`'s `PALETTE_TILE_SPRITES`, borrow an existing terrain sprite as a visibly-placeholder stand-in (any reasonable existing crop works — e.g. `groundRock`'s exposed sprite for `W`, `wall`'s sprite for `d`/`D`), clearly commented as temporary:

```ts
  W: {
    // O-029: solid wood ground (placeholder sprite — real art lands in Task 12).
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 16,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
  },
  d: {
    // O-029: left door panel (placeholder sprite — real art lands in Task 12).
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 128,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
  },
  D: {
    // O-029: right door panel (placeholder sprite — real art lands in Task 12).
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 128,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
  },
```

Add matching entries to `PALETTE_TILE_DESCRIPTIONS` and `PALETTE_TILE_LABELS` (these are real, permanent content, not placeholders):

```ts
  W: 'Solid wood plank ground (O-029)',
  d: 'Left panel of a wooden double door (O-029); opens when interacted',
  D: 'Right panel of a wooden double door (O-029); opens when interacted',
```

```ts
  W: 'Ground Wood',
  d: 'Door Left',
  D: 'Door Right',
```

Do **not** add `d`/`D` to `DECORATION_CHARS` in `Palette.tsx` — they are structural terrain, not decoration, and fall into the Terrain group automatically per that file's existing rule. `W` needs no `Palette.tsx` change either, for the same reason.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/LevelParser.test.ts src/themes/platformer/editor/paletteTiles.test.ts`
Expected: PASS. Also confirm the existing map/`TileChar` sync assertion (search the test file for it) still passes — it should, since `W`/`d`/`D` were added to both places together.

Then run: `npx vitest run` (the full suite)
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts src/themes/platformer/editor/paletteTiles.ts
git commit -m "feat(O-029): add level-format characters for wood ground and doors, with findDoorTiles"
```

---

## Task 3: `level.ts` — `DOOR_TILES` Computed

**Files:**
- Modify: `src/themes/platformer/level/level.ts`

**Interfaces:**
- Consumes: `findDoorTiles` from Task 2.
- Produces: `DOOR_TILES: Signal<{ col: number; row: number }[]>` (a `computed`).

- [ ] **Step 1: Add the computed**

Mirroring `LADDER_BUNDLE_TILES` exactly:

```ts
export const DOOR_TILES = computed(() => findDoorTiles(currentLayout.value));
```

Add `findDoorTiles` to the existing import from `./LevelParser`.

- [ ] **Step 2: Run existing level.ts tests**

Run: `npx vitest run src/themes/platformer/level/level.test.ts`
Expected: PASS (no behavior change to existing computeds; this only adds a new export). If `level.test.ts` doesn't exist, skip — this file has no branching logic of its own to unit test beyond what Task 2's `findDoorTiles` tests already cover.

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/level/level.ts
git commit -m "feat(O-029): compute DOOR_TILES from the level layout"
```

---

## Task 4: `Terrain.ts` — Solidity for Wood and Closed Doors

**Files:**
- Modify: `src/themes/platformer/level/Terrain.ts`
- Modify: `src/themes/platformer/level/Terrain.test.ts`

**Interfaces:**
- Consumes: `TileType` members from Task 1.
- Produces: `isSolid`/`isSolidExcludingBridge` now `true` for `'groundWood'`, `'doorLeft'`, `'doorRight'`; unchanged (`false`) for `'doorLeftOpen'`/`'doorRightOpen'`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('isSolid-groundWood-isSolid', () => {
  it('groundWood is solid', () => {
    expect(isSolid('groundWood')).toBe(true);
  });
});

describe('isSolid-closedDoorPanels-areSolid', () => {
  it('doorLeft and doorRight are solid', () => {
    expect(isSolid('doorLeft')).toBe(true);
    expect(isSolid('doorRight')).toBe(true);
  });
});

describe('isSolid-openDoorPanels-areNotSolid', () => {
  it('doorLeftOpen and doorRightOpen are not solid', () => {
    expect(isSolid('doorLeftOpen')).toBe(false);
    expect(isSolid('doorRightOpen')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts`
Expected: FAIL — `groundWood`/`doorLeft`/`doorRight` currently fall through to `isSolid`'s `false` default.

- [ ] **Step 3: Extend `isSolid`**

In `src/themes/platformer/level/Terrain.ts`, find the `isSolid` disjunction (`tile === 'groundGrass' || tile === 'groundRock' || tile === 'wall' || tile === 'bridge'`) and extend it:

```ts
export function isSolid(tile: TileType): boolean {
  return (
    tile === 'groundGrass' ||
    tile === 'groundRock' ||
    tile === 'groundWood' ||
    tile === 'wall' ||
    tile === 'bridge' ||
    tile === 'doorLeft' ||
    tile === 'doorRight'
  );
}
```

Do **not** add `doorLeftOpen`/`doorRightOpen` — their whole purpose is to be the non-solid override result.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/Terrain.ts src/themes/platformer/level/Terrain.test.ts
git commit -m "feat(O-029): make wood ground and closed door panels solid"
```

---

## Task 5: `TerrainOverrides.ts` — Shared Runtime-Override Helper

**Files:**
- Create: `src/themes/platformer/level/TerrainOverrides.ts`
- Test: `src/themes/platformer/level/TerrainOverrides.test.ts`

**Interfaces:**
- Produces: `applyTerrainOverrides<S>(level, states, isActive, cellsFor): LevelDef`
- Consumed by: Task 6 (refactored `applyDeployedLadders`) and Task 8 (`applyOpenedDoors`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { applyTerrainOverrides } from './TerrainOverrides';
import type { LevelDef } from './LevelData';

function makeLevel(): LevelDef {
  return {
    width: 3,
    height: 2,
    terrain: [
      ['empty', 'empty', 'empty'],
      ['empty', 'empty', 'empty'],
    ],
  };
}

interface FakeState {
  active: boolean;
  col: number;
  row: number;
}

describe('applyTerrainOverrides-noActiveStates-returnsSameLevelByReference', () => {
  it('is a no-op identity when nothing is active', () => {
    const level = makeLevel();
    const states: FakeState[] = [{ active: false, col: 0, row: 0 }];
    const result = applyTerrainOverrides(
      level,
      states,
      (s) => s.active,
      (s) => [{ col: s.col, row: s.row, tile: 'wall' }],
    );
    expect(result).toBe(level);
  });
});

describe('applyTerrainOverrides-oneActiveState-writesItsCellsOnly', () => {
  it('writes only the active state\'s cells, cloning the grid', () => {
    const level = makeLevel();
    const states: FakeState[] = [
      { active: true, col: 1, row: 0 },
      { active: false, col: 2, row: 1 },
    ];
    const result = applyTerrainOverrides(
      level,
      states,
      (s) => s.active,
      (s) => [{ col: s.col, row: s.row, tile: 'wall' }],
    );
    expect(result).not.toBe(level);
    expect(result.terrain[0][1]).toBe('wall');
    expect(result.terrain[1][2]).toBe('empty'); // the inactive state's cell untouched
    expect(level.terrain[0][1]).toBe('empty'); // original never mutated
  });
});

describe('applyTerrainOverrides-oneStateMultipleCells-writesEveryCell', () => {
  it('writes every cell cellsFor yields for one state', () => {
    const level = makeLevel();
    const states: FakeState[] = [{ active: true, col: 0, row: 0 }];
    const result = applyTerrainOverrides(
      level,
      states,
      () => true,
      (s) => [
        { col: s.col, row: 0, tile: 'wall' },
        { col: s.col + 1, row: 1, tile: 'ladder' },
      ],
    );
    expect(result.terrain[0][0]).toBe('wall');
    expect(result.terrain[1][1]).toBe('ladder');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/TerrainOverrides.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `TerrainOverrides.ts`**

```ts
import type { LevelDef, TileType } from './LevelData';

/** One cell a state wants written into the effective grid. */
export interface TerrainOverrideCell {
  col: number;
  row: number;
  tile: TileType;
}

/**
 * The shared shape behind every "runtime terrain override" this codebase
 * has (O-011's deployed rope-ladder bundles, O-029's opened doors): filter
 * per-instance states down to the ones currently affecting the grid; if
 * none, return `level` UNCHANGED BY REFERENCE so the common no-override
 * case allocates nothing; otherwise clone `level.terrain` exactly once and
 * write every active state's cells into that one clone. `isActive` and
 * `cellsFor` carry everything feature-specific (which states qualify, which
 * cells each one writes) — this function owns only the filter/clone/
 * identity mechanics, not knows what a bundle or a door is. See design.md's
 * "A shared applyTerrainOverrides helper" for why this exists instead of a
 * second copy of the same plumbing.
 */
export function applyTerrainOverrides<S>(
  level: LevelDef,
  states: readonly S[],
  isActive: (state: S) => boolean,
  cellsFor: (state: S) => Iterable<TerrainOverrideCell>,
): LevelDef {
  const active = states.filter(isActive);
  if (active.length === 0) return level;
  const terrain = level.terrain.map((row) => [...row]);
  for (const state of active) {
    for (const cell of cellsFor(state)) {
      terrain[cell.row][cell.col] = cell.tile;
    }
  }
  return { ...level, terrain };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/TerrainOverrides.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/TerrainOverrides.ts src/themes/platformer/level/TerrainOverrides.test.ts
git commit -m "feat(O-029): add shared applyTerrainOverrides helper"
```

---

## Task 6: Refactor `applyDeployedLadders` Onto the Shared Helper

**Files:**
- Modify: `src/themes/platformer/engine/DeployableLadder.ts`
- Modify: `src/themes/platformer/engine/DeployableLadder.test.ts`

**Interfaces:**
- Consumes: `applyTerrainOverrides` from Task 5.
- Produces: `applyDeployedLadders` — **same signature, same behavior**, now expressed through the shared helper.

This is a pure refactor: no existing test's expected value should change. Its job is only to prove the shared helper is a drop-in replacement for the bespoke logic it's replacing.

- [ ] **Step 1: Confirm existing tests pass BEFORE refactoring (baseline)**

Run: `npx vitest run src/themes/platformer/engine/DeployableLadder.test.ts`
Expected: PASS (this is the pre-refactor baseline — do not proceed until it's green).

- [ ] **Step 2: Replace the implementation**

```ts
import { applyTerrainOverrides } from '../level/TerrainOverrides';

export function applyDeployedLadders(
  level: LevelDef,
  states: readonly DeployableLadderState[],
): LevelDef {
  return applyTerrainOverrides(
    level,
    states,
    (state) => state.phase === 'deployed',
    function* (state) {
      for (let r = state.row; r <= state.landRow; r++) {
        yield { col: state.col, row: r, tile: 'ropeLadder' as const };
      }
    },
  );
}
```

Remove the now-unused manual `terrain.map((row) => [...row])` clone logic from this function (it's the same removed lines the diff will show).

- [ ] **Step 3: Run tests to verify they still pass, unchanged**

Run: `npx vitest run src/themes/platformer/engine/DeployableLadder.test.ts`
Expected: PASS — identical results to Step 1's baseline. If any assertion changes behavior, the refactor is wrong; fix `applyDeployedLadders`, not the test.

- [ ] **Step 4: Commit**

```bash
git add src/themes/platformer/engine/DeployableLadder.ts
git commit -m "refactor(O-029): express applyDeployedLadders through the shared terrain-override helper"
```

---

## Task 7: `DoorState.ts` — Pure Door State Module

**Files:**
- Create: `src/themes/platformer/engine/DoorState.ts`
- Test: `src/themes/platformer/engine/DoorState.test.ts`

**Interfaces:**
- Consumes: `applyTerrainOverrides` from Task 5; `DOOR_TILES` shape (`{ col, row }[]`) from Task 3; `PlayerState` from `entities/Player.ts` (same shape `ladderBundleForPlayer` consumes).
- Produces: `DoorPhase = 'closed' | 'open'`; `DoorState { id, col, row, phase }`; `createDoorState(col, row): DoorState`; `toggleDoor(state): DoorState`; `applyOpenedDoors(level, states): LevelDef`; `doorPlayerIsAdjacentTo(states, player): string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  createDoorState,
  toggleDoor,
  applyOpenedDoors,
  doorPlayerIsAdjacentTo,
  type DoorState,
} from './DoorState';
import type { LevelDef } from '../level/LevelData';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import type { PlayerState } from '../entities/Player';

function makeLevel(): LevelDef {
  return {
    width: 5,
    height: 3,
    terrain: [
      ['empty', 'empty', 'empty', 'empty', 'empty'],
      ['empty', 'doorLeft', 'doorRight', 'empty', 'empty'],
      ['empty', 'empty', 'empty', 'empty', 'empty'],
    ],
  };
}

describe('createDoorState-anchorCell-seedsClosed', () => {
  it('starts closed with a stable id', () => {
    const state = createDoorState(1, 1);
    expect(state).toEqual({ id: 'door-1-1', col: 1, row: 1, phase: 'closed' });
  });
});

describe('toggleDoor-closed-becomesOpen', () => {
  it('flips closed to open', () => {
    expect(toggleDoor(createDoorState(1, 1)).phase).toBe('open');
  });
});

describe('toggleDoor-open-becomesClosed', () => {
  it('flips open back to closed', () => {
    const opened = toggleDoor(createDoorState(1, 1));
    expect(toggleDoor(opened).phase).toBe('closed');
  });
});

describe('applyOpenedDoors-noOpenDoors-returnsSameLevelByReference', () => {
  it('is a no-op identity when every door is closed', () => {
    const level = makeLevel();
    const result = applyOpenedDoors(level, [createDoorState(1, 1)]);
    expect(result).toBe(level);
  });
});

describe('applyOpenedDoors-oneOpenDoor-rewritesBothLeafCells', () => {
  it('rewrites both leaf cells to their open tile', () => {
    const level = makeLevel();
    const opened = toggleDoor(createDoorState(1, 1));
    const result = applyOpenedDoors(level, [opened]);
    expect(result.terrain[1][1]).toBe('doorLeftOpen');
    expect(result.terrain[1][2]).toBe('doorRightOpen');
    expect(level.terrain[1][1]).toBe('doorLeft'); // original untouched
  });
});

function makePlayer(x: number, y: number): PlayerState {
  return { x, y, vx: 0, vy: 0, grounded: true, facing: 'right' } as PlayerState;
}

// The door pair below is always createDoorState(1, 1): left leaf at col 1,
// right leaf at col 2 (= state.col + 1), row 1. The player hitbox is
// PLAYER_RENDERED_SIZE (64px = 2 columns) wide, inset by PLAYER_SIDE_PADDING
// (20px) on each side (same convention ladderBundleForPlayer's leftCol/
// rightCol already use) — so a player pressed up against a closed door's
// face already has its hitbox touching the door's own column, not sitting a
// whole clear column away. "Adjacent" therefore means the player's inset
// hitbox TOUCHES the door pair's outer edge: playerRightCol === state.col
// (left leaf, from the left) OR playerLeftCol === state.col + 1 (right
// leaf, from the right) — not "one clear column apart", which a
// 2-column-wide sprite could never satisfy.
//
// Worked arithmetic (RENDERED_TILE_SIZE=32, PLAYER_RENDERED_SIZE=64,
// PLAYER_SIDE_PADDING=20 — verify these against the real constants before
// trusting the numbers below, but the SHAPE of the derivation stays valid
// regardless): playerLeftCol(x) = floor((x+20)/32),
// playerRightCol(x) = floor((x+64-20-1)/32) = floor((x+43)/32).
//   x=0  (test 1): playerRightCol = floor(43/32)  = 1 = state.col.       MATCH (left leaf, from the left).
//   x=64 (test 2): playerLeftCol  = floor(84/32)  = 2 = state.col + 1.   MATCH (right leaf, from the right).
//   x=-64(test 3): playerLeftCol=-2, playerRightCol=-1 — neither is 1 or 2. NO MATCH.
// Test 2 uses `2 * RENDERED_TILE_SIZE`, NOT `3 *` — a previous draft of
// this plan had that wrong twice (naively mirroring test 1's `0` as `3`
// without recomputing the inset-hitbox arithmetic for the right side).
// Whoever implements this: re-derive these four numbers yourself against
// the actual constant VALUES in the codebase (they may have changed) before
// writing the test file, rather than trusting this comment's numbers blindly.

describe('doorPlayerIsAdjacentTo-playerPressedAgainstLeftLeafFromTheLeft-returnsDoorId', () => {
  it('matches a hitbox touching the left leaf\'s column from the left, same row', () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(0 * RENDERED_TILE_SIZE, 1 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBe(state.id);
  });
});

describe('doorPlayerIsAdjacentTo-playerPressedAgainstRightLeafFromTheRight-returnsDoorId', () => {
  it('matches a hitbox touching the right leaf\'s column from the right, same row', () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(2 * RENDERED_TILE_SIZE, 1 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBe(state.id);
  });
});

describe('doorPlayerIsAdjacentTo-playerAColumnAwayFromTouching-returnsNull', () => {
  it('does not match when the hitbox does not reach either leaf\'s column', () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(-2 * RENDERED_TILE_SIZE, 1 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBeNull();
  });
});

describe('doorPlayerIsAdjacentTo-playerDifferentRow-returnsNull', () => {
  it('does not match a different row even when touching in column', () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(0 * RENDERED_TILE_SIZE, 0 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/DoorState.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `DoorState.ts`**

```ts
import type { LevelDef } from '../level/LevelData';
import { applyTerrainOverrides } from '../level/TerrainOverrides';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { PLAYER_RENDERED_SIZE, PLAYER_SIDE_PADDING } from '../entities/Player';
import type { PlayerState } from '../entities/Player';

/** Reversible — unlike DeployableLadderPhase's one-way progression, a door
 *  toggles freely between exactly two phases (spec FR-008/FR-012). */
export type DoorPhase = 'closed' | 'open';

/** Per-pair runtime state, keyed by the pair's LEFT-leaf anchor cell. Tiles
 *  stay stateless; this lives alongside chestStates/deployableLadderStates
 *  in PlatformerState.ts (Terrain.md's runtime-override exception, now a
 *  third instance). */
export interface DoorState {
  /** `door-${col}-${row}`, stable per authored left-leaf cell. */
  id: string;
  col: number;
  row: number;
  phase: DoorPhase;
}

/** Seeds one closed state for an authored left-leaf cell. Pure. */
export function createDoorState(col: number, row: number): DoorState {
  return { id: `door-${col}-${row}`, col, row, phase: 'closed' };
}

/** Flips a door's phase. Pure, unconditional — unlike beginDeploy, there is
 *  no "already past this phase" guard, because there is no one-way
 *  ordering to protect (spec FR-010: unlimited toggles). */
export function toggleDoor(state: DoorState): DoorState {
  return { ...state, phase: state.phase === 'closed' ? 'open' : 'closed' };
}

/**
 * The effective terrain grid: the raw level with every open door's two
 * leaf cells written as their non-solid `*Open` tile. Built on the shared
 * `applyTerrainOverrides` (Task 5) — see design.md's "A shared
 * applyTerrainOverrides helper". Returns the SAME `level` object (identity)
 * when every door is closed, so the common case allocates nothing.
 */
export function applyOpenedDoors(level: LevelDef, states: readonly DoorState[]): LevelDef {
  return applyTerrainOverrides(
    level,
    states,
    (state) => state.phase === 'open',
    (state) => [
      { col: state.col, row: state.row, tile: 'doorLeftOpen' as const },
      { col: state.col + 1, row: state.row, tile: 'doorRightOpen' as const },
    ],
  );
}

/**
 * The id of the first door the player can interact with right now, or
 * `null`. A door is SOLID while closed (unlike a chest), so the player can
 * never overlap its cells the way `chestPlayerIsStandingOn` overlaps a
 * chest's trigger box — "standing next to it" instead means: same row as
 * the door (player's foot row equals the door's row), and the player's
 * (inset) collision hitbox TOUCHES the door pair's outer edge — its right
 * column reaches the left leaf's own column (pressed against it from the
 * left), or its left column reaches the right leaf's own column (pressed
 * against it from the right). This is deliberately "touching", not "one
 * clear column away": `PLAYER_RENDERED_SIZE` is 64px — two tile columns —
 * so a player's hitbox pressed flush against a closed door already reaches
 * into the door's own column; there is no clear gap column to test for the
 * way there would be for a one-tile-wide sprite. The column math mirrors
 * `ladderBundleForPlayer`'s own inset-hitbox convention (`PLAYER_SIDE_PADDING`),
 * not Collision.ts's generic `overlappingTriggers` (which only tests actual
 * box overlap, impossible here since a closed door is solid).
 */
export function doorPlayerIsAdjacentTo(
  states: readonly DoorState[],
  player: PlayerState,
): string | null {
  const playerRow = Math.floor(player.y / RENDERED_TILE_SIZE);
  const playerLeftCol = Math.floor((player.x + PLAYER_SIDE_PADDING) / RENDERED_TILE_SIZE);
  const playerRightCol = Math.floor(
    (player.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING - 1) / RENDERED_TILE_SIZE,
  );
  for (const state of states) {
    if (state.row !== playerRow) continue;
    if (playerRightCol === state.col || playerLeftCol === state.col + 1) {
      return state.id;
    }
  }
  return null;
}
```

Check `entities/Player.ts` for the exact `PlayerState` field names (`x`, `y`), and `PLAYER_RENDERED_SIZE`/`PLAYER_SIDE_PADDING`'s exact export names and values, before finalizing this file — adjust the import only if a name differs from what's used above; the logic itself does not change. (For reference, in the current codebase: `PLAYER_RENDERED_SIZE` is 64, `PLAYER_SIDE_PADDING` is 20, `RENDERED_TILE_SIZE` is 32 — a player's inset hitbox is therefore 24px wide, narrower than one tile but still capable of spanning two tile columns depending on alignment, which is exactly why "touching" rather than "one clear column apart" is the correct test.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/DoorState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/DoorState.ts src/themes/platformer/engine/DoorState.test.ts
git commit -m "feat(O-029): add pure door state module (toggle, effective grid, adjacency)"
```

---

## Task 8: `sheets.ts` — Register `DOOR_SHEET` and Its Frame Indices

**Files:**
- Modify: `src/themes/platformer/entities/sprites/sheets.ts`

**Interfaces:**
- Consumes: `public/sprites/doors.png` from Task 0 (a 64×26, 4-frame horizontal strip).
- Produces: `DOOR_SHEET: SpriteSheet`; `DOOR_FRAME_CLOSED_LEFT`/`DOOR_FRAME_CLOSED_RIGHT`/`DOOR_FRAME_OPEN_LEFT`/`DOOR_FRAME_OPEN_RIGHT: number` frame indices, addressed via the existing `frameSource(sheet, index)` helper — no `StaticObjectsCatalog.ts` entry needed, since door art is no longer a crop out of the shared `staticObjects.png`.

- [ ] **Step 1: Register the sheet and its frame indices**

```ts
/** `doors.png` (O-029) — a 64x26 strip of four 16x26 frames, cropped from
 *  `staticObjects.png`'s existing double-door art into its own dedicated
 *  sheet (see Task 0): 0 = closed-left leaf, 1 = closed-right leaf, 2 =
 *  open-left leaf, 3 = open-right leaf. Addressed by frame index via
 *  `frameSource`, the same convention as `TORCH_SHEET`/`BOMB_SHEET` — no
 *  StaticObjectsCatalog entry, since (unlike cobweb/stalactite/mushroom)
 *  there's no neighbour- or position-driven variant selection, just a
 *  fixed choice of which of the four frames `DoorState.phase` and which
 *  side pick. */
export const DOOR_SHEET: SpriteSheet = {
  src: '/sprites/doors.png',
  frameWidth: 16,
  frameHeight: 26,
  columns: 4,
};

export const DOOR_FRAME_CLOSED_LEFT = 0;
export const DOOR_FRAME_CLOSED_RIGHT = 1;
export const DOOR_FRAME_OPEN_LEFT = 2;
export const DOOR_FRAME_OPEN_RIGHT = 3;
```

- [ ] **Step 2: No test needed**

Same rationale as the wood sheets in Task 10 — this file's existing convention has no direct unit tests for sheet/frame-index registration constants; skip unless `sheets.ts` already has a `.test.ts` sibling, in which case add one assertion per constant.

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/entities/sprites/sheets.ts
git commit -m "feat(O-029): register the door sprite sheet and its frame indices"
```

---

## Task 9: `Renderer.ts` — Draw Wood Ground, Bleed-Rendered Doors

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `GROUND_WOOD_SHEET` (Task 10), `DOOR_SHEET`/`DOOR_FRAME_*` indices (Task 8), `DoorState` from Task 7.
- Produces: `tileSource` handles `'groundWood'` and returns `null` (with a comment) for all four door tile members; new exported `drawDoors(ctx, states, doorSheet, originX, originY)`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('tileSource-groundWood-topExposed-returnsExposedFrame', () => {
  it('picks the exposed-top frame when nothing solid is above', () => {
    const level = /* a level with a lone groundWood cell, empty above */;
    expect(tileSource(level, 'groundWood', 0, 0)).toEqual({ sx: 0, sy: 0 });
  });
});

describe('tileSource-groundWood-buried-returnsBuriedFrame', () => {
  it('picks the buried frame when solid terrain sits above', () => {
    const level = /* a level with solid groundWood above a groundWood cell */;
    expect(tileSource(level, 'groundWood', 0, 1)).toEqual({ sx: TILE_SIZE, sy: 0 });
  });
});

describe('tileSource-doorTileVariants-returnNullForCustomDraw', () => {
  it('returns null for every door tile — drawDoors owns their art', () => {
    for (const type of ['doorLeft', 'doorRight', 'doorLeftOpen', 'doorRightOpen'] as const) {
      expect(tileSource(makeLevel(), type, 0, 0)).toBeNull();
    }
  });
});

describe('drawDoors-nullSheet-returnsImmediately', () => {
  it('does nothing when the sheet is not loaded', () => {
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    drawDoors(ctx, [createDoorState(1, 1)], null, 0, 0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawDoors-closedDoor-drawsBothClosedLeaves', () => {
  it('draws both leaves at the door\'s two columns, bottom-anchored', () => {
    const ctx = { drawImage: vi.fn(), imageSmoothingEnabled: true } as unknown as CanvasRenderingContext2D;
    const sheet = {} as HTMLImageElement;
    drawDoors(ctx, [createDoorState(1, 1)], sheet, 0, 0);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });
});
```

Adjust the exact `makeLevel`/fixture helpers to match whatever pattern `Renderer.test.ts` already uses elsewhere in the file (it has one — follow it rather than inventing a new fixture shape).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL

- [ ] **Step 3: Add the `groundWood` case to `tileSource`**

Immediately after the existing `case 'groundRock':` block:

```ts
    case 'groundWood':
      return isTopExposed(level, col, row)
        ? { sx: 0, sy: 0 }
        : { sx: TILE_SIZE, sy: 0 };
```

(`GROUND_WOOD_SHEET` is its own dedicated file per Task 0/Task 10, addressed from `(0,0)`, never `world_tileset.png`'s coordinate space — `drawTerrain`'s groundWood branch, added in this same task, must pass the `groundWoodSheet` image, not `worldTilesetImage`, to whatever draws it.)

Add, immediately after the existing `blueprintConnectionPoint` case (grouped with the other "drawn by a dedicated pass" cases like `chain`):

```ts
    case 'doorLeft':
    case 'doorRight':
    case 'doorLeftOpen':
    case 'doorRightOpen':
      // Drawn by the dedicated drawDoors pass below — a leaf's art is
      // taller than its tile and bottom-anchored (bleeds upward into the
      // cell above, see design.md's "Rendering taller than the tile"),
      // which this shared single-cell lookup has no way to express.
      return null;
```

- [ ] **Step 4: Implement `drawDoors`**

Add near `drawDeployableLadders` (same file), following its `null`-sheet-guard and per-instance-draw shape:

```ts
import {
  DOOR_SHEET,
  DOOR_FRAME_CLOSED_LEFT,
  DOOR_FRAME_CLOSED_RIGHT,
  DOOR_FRAME_OPEN_LEFT,
  DOOR_FRAME_OPEN_RIGHT,
} from '../entities/sprites/sheets';
import { frameSource } from '../entities/sprites/SpriteSheet';
import type { DoorState } from './DoorState';

/**
 * Draws every door's two leaves. Each leaf's source frame (16x26,
 * `DOOR_SHEET`) is taller than RENDERED_TILE_SIZE, so it is drawn
 * BOTTOM-anchored to its own cell — the leaf's rendered bottom edge lines
 * up with the cell's bottom edge, and the excess height bleeds upward into
 * the cell above (design.md's "Rendering taller than the tile: bleed, not
 * squeeze" — the mirror of FloorSpike's downward bleed).
 * `imageSmoothingEnabled = false` matches every other pixel-art draw pass
 * in this file.
 */
export function drawDoors(
  ctx: CanvasRenderingContext2D,
  states: readonly DoorState[],
  doorSheet: HTMLImageElement | null,
  originX: number,
  originY: number,
): void {
  if (!doorSheet) return;
  ctx.imageSmoothingEnabled = false;
  for (const state of states) {
    const leftFrame = state.phase === 'open' ? DOOR_FRAME_OPEN_LEFT : DOOR_FRAME_CLOSED_LEFT;
    const rightFrame = state.phase === 'open' ? DOOR_FRAME_OPEN_RIGHT : DOOR_FRAME_CLOSED_RIGHT;
    drawBottomAnchoredLeaf(ctx, doorSheet, leftFrame, state.col, state.row, originX, originY);
    drawBottomAnchoredLeaf(ctx, doorSheet, rightFrame, state.col + 1, state.row, originX, originY);
  }
}

function drawBottomAnchoredLeaf(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  frameIndex: number,
  col: number,
  row: number,
  originX: number,
  originY: number,
): void {
  const { sx, sy } = frameSource(DOOR_SHEET, frameIndex);
  const width = DOOR_SHEET.frameWidth;
  const height = DOOR_SHEET.frameHeight;
  const destWidth = width * RENDER_SCALE;
  const destHeight = height * RENDER_SCALE;
  const cellBottomY = (row + 1) * RENDERED_TILE_SIZE;
  const destX = col * RENDERED_TILE_SIZE + originX;
  const destY = cellBottomY - destHeight + originY;
  ctx.drawImage(sheet, sx, sy, width, height, destX, destY, destWidth, destHeight);
}
```

- [ ] **Step 5: Wire the `groundWood` render into `drawTerrain`**

Find where `drawTerrain` handles `groundRock` (a plain `tileSource`-driven draw, no custom branch) and confirm `groundWood` needs no custom branch either **if** its sheet is registered as an additional optional image parameter thread through `drawTerrain` (mirroring how `staticObjects`/`decorations`/`torch`/`mushroom` images are already threaded — see `Terrain.md`'s "Adding a tile" step 3). Add `groundWoodImage` as a new trailing optional parameter, and extend the plain per-cell draw loop's sheet-selection logic to pick `groundWoodImage` when `type === 'groundWood'`. (Note: `crumblingFloor` is NOT this pattern — it's drawn by its own wholly separate top-level pass, same reason `drawDeployableLadders` is separate; don't follow it as a model here.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts
git commit -m "feat(O-029): render wood ground tiles and bottom-anchored door leaves"
```

---

## Task 10: Sprite Sheet Registration

**Files:**
- Modify: `src/themes/platformer/entities/sprites/sheets.ts`

**Interfaces:**
- Produces: `GROUND_WOOD_SHEET: SpriteSheet`; `BACKGROUND_TILES_WOOD_SHEET: SpriteSheet`.
- Door art has its own sheet, registered separately in Task 8 (`DOOR_SHEET`).

- [ ] **Step 1: Register the new sheets**

```ts
/** `ground_wood.png` — a 32x16 strip of two 16x16 frames (O-029): 0 =
 *  exposed-top wood plank, 1 = buried wood — the same two-frame shape as
 *  `groundRock`'s own lookup, addressed by `tileSource`'s sx/sy, not by
 *  frame index. PLACEHOLDER ART — its own dedicated file rather than a cell
 *  in `world_tileset.png` specifically so it can be swapped out later
 *  without touching that finished, shared sheet. */
export const GROUND_WOOD_SHEET: SpriteSheet = {
  src: '/sprites/ground_wood.png',
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  columns: 2,
};

/** `background_tiles_wood.png` — one material's 4x3 `BACKGROUND_ATLAS_STRIDE`
 *  block (O-029), the exact same per-material layout `background_tiles.png`
 *  uses, but in its OWN file: wood is PLACEHOLDER ART, deliberately kept out
 *  of the shared, finished `background_tiles.png` (see design.md's "Wood
 *  background: its own placeholder sheet, not a 7th row"). Addressed by
 *  `BackgroundAtlas.ts`'s own sx/sy lookup at materialIndex 0 (the only
 *  material this file holds), not by frame index — like
 *  `BACKGROUND_TILES_SHEET`, this registration exists for loading, not
 *  addressing. */
export const BACKGROUND_TILES_WOOD_SHEET: SpriteSheet = {
  src: '/sprites/background_tiles_wood.png',
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  columns: 4,
};
```

- [ ] **Step 2: No test needed**

This file's existing convention has no direct unit tests for sheet registration constants (confirm by checking whether `sheets.ts` has a `.test.ts` sibling; if it does, add assertions that each new sheet's `src` matches its file path and run it — otherwise skip, matching the file's established pattern).

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/entities/sprites/sheets.ts
git commit -m "feat(O-029): register the wood ground and wood background sprite sheets"
```

---

## Task 11: `BackgroundAtlas.ts` and `Renderer.ts` — Wood From Its Own Sheet

**Files:**
- Modify: `src/themes/platformer/engine/BackgroundAtlas.ts`
- Modify: `src/themes/platformer/engine/BackgroundAtlas.test.ts`
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `'wood'` `BackgroundMaterialId` from Task 1; `BACKGROUND_TILES_WOOD_SHEET` from Task 10.
- Produces: `backgroundAtlasCell('wood', mask)` returns entries relative to its OWN sheet's origin, not `BACKGROUND_TILES_SHEET`'s; `backgroundMaterialSheetSrc(material): string` (new) tells a caller which image a material's cells come from; `drawBackgroundTiles` gains a `woodBackgroundAtlas` parameter and picks the correct source image per cell.

Since wood lives in its own file (kept out of the shared, finished
`background_tiles.png` since it's placeholder art), the existing "every
material is just another row in one shared sheet" assumption
(`BACKGROUND_MATERIAL_ROW_INDEX`) no longer holds for wood alone. Wood is
addressed as materialIndex `0` within its own file (the only material that
file holds), and `drawBackgroundTiles` needs to know WHICH image to pull a
given material's cell from — the one piece of "which sheet" branching this
placeholder detour requires, isolated to these two files.

**Note on `BACKGROUND_MATERIAL_ROW_INDEX`**: Task 1 already added a
`wood: 0` entry to this Record — not optional scope creep, but a
TypeScript/eager-module-load requirement (see Task 1's Step 3a). Its value
is a placeholder and is never actually correct for wood; this task makes
that irrelevant by branching around it in `backgroundAtlasCell` (Step 3
below) rather than ever reading it for `wood`. **Do not edit or "fix" that
placeholder entry** — leave it exactly as Task 1 left it. This task adds a
genuinely separate, correct code path for wood; it does not correct the
placeholder value, because nothing ever reads it once this task's branch
exists.

- [ ] **Step 1: Write the failing tests**

```ts
// BackgroundAtlas.test.ts
describe('backgroundAtlasCell-woodEveryMask-returnsAValidEntryRelativeToItsOwnSheet', () => {
  it('wood resolves every one of the 16 masks, at materialIndex 0', () => {
    for (let mask = 0; mask < 16; mask++) {
      const entry = backgroundAtlasCell('wood', mask);
      expect(entry.sx).toBeGreaterThanOrEqual(0);
      expect(entry.sy).toBeGreaterThanOrEqual(0);
      // Materially different from the shared-sheet materials' own sy range
      // for the same mask, since wood's sheet starts a fresh materialIndex 0
      // rather than continuing the shared sheet's row stack:
      expect(entry.sy).toBeLessThan(BACKGROUND_ATLAS_ROW_PITCH);
    }
  });
});

describe('backgroundMaterialSheetSrc-wood-returnsTheDedicatedWoodSheet', () => {
  it('wood resolves to its own sheet src', () => {
    expect(backgroundMaterialSheetSrc('wood')).toBe(BACKGROUND_TILES_WOOD_SHEET.src);
  });
});

describe('backgroundMaterialSheetSrc-everyOtherMaterial-returnsTheSharedSheet', () => {
  it('every non-wood material resolves to the shared sheet src', () => {
    for (const material of ['dirt', 'rust', 'surfaceStone', 'charcoal', 'maroon', 'caveStone'] as const) {
      expect(backgroundMaterialSheetSrc(material)).toBe(BACKGROUND_TILES_SHEET.src);
    }
  });
});
```

```ts
// Renderer.test.ts
describe('drawBackgroundTiles-woodCell-drawsFromTheWoodSheetNotTheSharedOne', () => {
  it('picks woodBackgroundAtlas for a wood cell, backgroundAtlas for everything else', () => {
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    const sharedSheet = {} as HTMLImageElement;
    const woodSheet = {} as HTMLImageElement;
    const level = /* a level with background[0][0] = 'wood', background[0][1] = 'dirt' */;
    drawBackgroundTiles(ctx, level, sharedSheet, 0, 0, null, woodSheet);
    // Assert one drawImage call's image arg === woodSheet (the wood cell)
    // and another's === sharedSheet (the dirt cell).
  });

  it('skips a wood cell silently when woodBackgroundAtlas is null (not yet loaded)', () => {
    // Same fixture, woodBackgroundAtlas omitted/null — assert no throw and
    // the wood cell simply isn't drawn that frame (matches how every other
    // optional image param in this file already degrades).
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/BackgroundAtlas.test.ts src/themes/platformer/engine/Renderer.test.ts`
Expected: FAIL

- [ ] **Step 3: Add wood's own cell lookup and `backgroundMaterialSheetSrc`**

In `BackgroundAtlas.ts`, leave `BACKGROUND_MATERIAL_ROW_INDEX`'s `wood: 0` placeholder entry exactly as Task 1 left it (do not edit or remove it — see this task's opening note). Add wood's real lookup alongside it, addressed from its own sheet:

```ts
import { BACKGROUND_TILES_SHEET, BACKGROUND_TILES_WOOD_SHEET } from '../entities/sprites/sheets';

/** Wood's placeholder cell lookup — materialIndex 0 always, since
 *  `background_tiles_wood.png` holds exactly one material (see sheets.ts's
 *  doc comment and design.md's "Wood background: its own placeholder
 *  sheet"). Reuses the same MASK_SHAPE table every shared-sheet material
 *  already uses — only which FILE the coordinates address differs. */
const WOOD_MATERIAL_INDEX = 0;

function woodCell(gx: number, gy: number): { sx: number; sy: number } {
  return {
    sx: gx * BACKGROUND_ATLAS_STRIDE,
    sy: WOOD_MATERIAL_INDEX * BACKGROUND_ATLAS_ROW_PITCH + gy * BACKGROUND_ATLAS_STRIDE,
  };
}
```

Update `backgroundAtlasCell` to branch on `wood` before falling through to the existing shared-sheet table (find its current single-`return BACKGROUND_ATLAS[material][mask]`-style body and adjust):

```ts
export function backgroundAtlasCell(material: BackgroundMaterialId, mask: number): BackgroundAtlasEntry {
  if (material === 'wood') {
    const shape = MASK_SHAPE[mask];
    return { ...woodCell(shape.gx, shape.gy), rotation: shape.rotation };
  }
  return BACKGROUND_ATLAS[material][mask];
}
```

(Match this against the function's actual current body — the shape above assumes today's implementation is a direct table lookup; adapt only the wood branch, don't restructure the existing non-wood path.)

Add the new export:

```ts
/** Which sprite sheet a material's `backgroundAtlasCell` result should be
 *  drawn from — every material but `wood` shares `BACKGROUND_TILES_SHEET`;
 *  `wood` is the one placeholder exception (see this file's `woodCell`
 *  doc comment). `Renderer.ts`'s `drawBackgroundTiles` is the only
 *  consumer. */
export function backgroundMaterialSheetSrc(material: BackgroundMaterialId): string {
  return material === 'wood' ? BACKGROUND_TILES_WOOD_SHEET.src : BACKGROUND_TILES_SHEET.src;
}
```

- [ ] **Step 4: Thread a second image through `drawBackgroundTiles`**

In `Renderer.ts`, add a new optional trailing parameter and pick the source image per cell:

```ts
export function drawBackgroundTiles(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  backgroundAtlas: HTMLImageElement,
  originX = 0,
  originY = 0,
  decorations: HTMLImageElement | null = null,
  woodBackgroundAtlas: HTMLImageElement | null = null,
): void {
  const grid = level.background ?? [];
  for (let row = 0; row < grid.length; row++) {
    const gridRow = grid[row];
    for (let col = 0; col < gridRow.length; col++) {
      const material = gridRow[col];
      if (material === null || material === undefined) continue;

      const sourceImage = material === 'wood' ? woodBackgroundAtlas : backgroundAtlas;
      if (!sourceImage) continue; // placeholder sheet not loaded yet — skip silently, like every other optional image in this file

      const { x, y } = tileToPixel(col, row);
      const destX = x + originX;
      const destY = y + originY;
      const mask = backgroundNeighbourMask(level, col, row);
      const entry = backgroundAtlasCell(material, mask);
      drawRotatedTile(ctx, sourceImage, entry, destX, destY);

      if (decorations && mask === 15) {
        const rock = backgroundRockEntry(col, row);
        ctx.drawImage(
          decorations, rock.sx, rock.sy, TILE_SIZE, TILE_SIZE,
          destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
        );
      }
    }
  }
}
```

- [ ] **Step 5: Load and pass the second image at both call sites**

In `PlatformerPage.tsx`: alongside the existing `loadImage(BACKGROUND_TILES_SHEET.src)`, add `loadImage(BACKGROUND_TILES_WOOD_SHEET.src)` into a new ref (mirroring how every other optional sprite sheet in this file is loaded), and pass it as `drawBackgroundTiles`'s new trailing argument at its existing call site.

In `editor/EditorCanvasPane.tsx`: add `{ key: 'backgroundAtlasWood', src: BACKGROUND_TILES_WOOD_SHEET.src }` alongside the existing `backgroundAtlas` entry in whatever list feeds the editor's image loader.

In `editor/EditorCanvas.tsx`: pass the newly-loaded wood image through to its own `drawBackgroundTiles` call, same trailing position.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/BackgroundAtlas.test.ts src/themes/platformer/engine/Renderer.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/engine/BackgroundAtlas.ts src/themes/platformer/engine/BackgroundAtlas.test.ts src/themes/platformer/engine/Renderer.ts src/themes/platformer/engine/Renderer.test.ts src/themes/platformer/PlatformerPage.tsx src/themes/platformer/editor/EditorCanvasPane.tsx src/themes/platformer/editor/EditorCanvas.tsx
git commit -m "feat(O-029): address the wood background material from its own placeholder sheet"
```

---

## Task 12: Editor Palette — Wire Real Door/Wood Sprites Into the Palette

**Files:**
- Modify: `src/themes/platformer/editor/paletteTiles.ts`
- Modify: `src/themes/platformer/editor/paletteTiles.test.ts`

**Interfaces:**
- Consumes: `BackgroundChar` members from Task 1; sprite crops from Tasks 8/10.
- Note: Task 2 already added PLACEHOLDER `PALETTE_TILE_SPRITES`/`PALETTE_TILE_DESCRIPTIONS`/`PALETTE_TILE_LABELS` entries for `W`/`d`/`D` (same exhaustiveness reasoning as Task 1's Step 3a — see Task 2's note). This task REPLACES the placeholder `sx`/`sy`/`sheet` values in `PALETTE_TILE_SPRITES` with the real ones now that `GROUND_WOOD_SHEET`/`DOOR_SHEET` exist; it does not add new entries for these three chars, and the labels/descriptions Task 2 already wrote are real content, not placeholders — leave them as-is unless they need wording changes.

- [ ] **Step 1: Write the failing tests**

```ts
describe('PALETTE_TILE_SPRITES-woodAndDoorChars-useRealSheets', () => {
  it('W, d, D now point at the real dedicated sheets, not the placeholder terrain crops Task 2 used', () => {
    expect(PALETTE_TILE_SPRITES.W?.sheet).toBe(GROUND_WOOD_SHEET.src);
    expect(PALETTE_TILE_SPRITES.d?.sheet).toBe(DOOR_SHEET.src);
    expect(PALETTE_TILE_SPRITES.D?.sheet).toBe(DOOR_SHEET.src);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts`
Expected: FAIL — `W`/`d`/`D` still point at Task 2's placeholder `WORLD_TILESET` crops.

- [ ] **Step 3: Replace the placeholder sprite entries**

In `PALETTE_TILE_SPRITES` (`src/themes/platformer/editor/paletteTiles.ts`), replace the three placeholder entries Task 2 added with the real sheets (for `groundWood` use `GROUND_WOOD_SHEET`'s exposed-top frame; for `d`/`D` use `DOOR_SHEET`'s closed-left/closed-right frames via `frameSource`, Task 8):

```ts
  W: { sheet: GROUND_WOOD_SHEET.src, sheetWidth: 32, sheetHeight: 16, sx: 0, sy: 0, frameWidth: 16, frameHeight: 16 },
  d: { sheet: DOOR_SHEET.src, sheetWidth: 64, sheetHeight: 26, ...frameSource(DOOR_SHEET, DOOR_FRAME_CLOSED_LEFT), frameWidth: DOOR_SHEET.frameWidth, frameHeight: DOOR_SHEET.frameHeight },
  D: { sheet: DOOR_SHEET.src, sheetWidth: 64, sheetHeight: 26, ...frameSource(DOOR_SHEET, DOOR_FRAME_CLOSED_RIGHT), frameWidth: DOOR_SHEET.frameWidth, frameHeight: DOOR_SHEET.frameHeight },
```

Leave `PALETTE_TILE_DESCRIPTIONS`/`PALETTE_TILE_LABELS`'s `W`/`d`/`D` entries exactly as Task 2 wrote them — that content was already real and permanent, not placeholder.

`backgroundPaletteTiles.ts` needs no change at all in this task: Task 1's Step 3a already added `wood: 'Wood'` to `BACKGROUND_PALETTE_LABELS` (same exhaustiveness reasoning), and `BACKGROUND_PALETTE_SPRITES`, `BACKGROUND_MATERIAL_CHAR`, and `BACKGROUND_PALETTE_SECTIONS` all derive automatically from `BACKGROUND_MATERIAL_FAMILY`/`BACKGROUND_CHARS` — Tasks 1 and 1's Step 3a already made those complete for `wood`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/paletteTiles.ts src/themes/platformer/editor/paletteTiles.test.ts
git commit -m "feat(O-029): wire the real wood and door sprite sheets into the editor palette"
```

---

## Task 13: `PlatformerState.ts` — Door Placements, State Signal, `activeLevel`

**Files:**
- Modify: `src/themes/platformer/PlatformerState.ts`
- Modify: `src/themes/platformer/PlatformerState.test.ts`

**Interfaces:**
- Consumes: `DOOR_TILES` (Task 3), `createDoorState`/`applyOpenedDoors` (Task 7), `applyDeployedLadders` (existing, Task 6-refactored).
- Produces: `doorPlacements`, `doorStates` (signal), `activeLevel` now composes both overrides.

- [ ] **Step 1: Write the failing tests**

```ts
describe('doorPlacements-fromDoorTiles-oneEntryPerPair', () => {
  it('seeds one closed DoorState per DOOR_TILES entry', () => {
    // Arrange a level (via the existing test level-loading convention this
    // file's other tests already use) with two door pairs, then:
    expect(doorPlacements.value.length).toBe(2);
    expect(doorPlacements.value.every((d) => d.phase === 'closed')).toBe(true);
  });
});

describe('activeLevel-oneOpenDoor-reflectsInEffectiveGrid', () => {
  it('opening a door is visible in activeLevel but not currentLevel', () => {
    doorStates.value = doorStates.value.map((d, i) => (i === 0 ? toggleDoor(d) : d));
    const opened = doorPlacements.value[0];
    expect(activeLevel.value.terrain[opened.row][opened.col]).toBe('doorLeftOpen');
    expect(currentLevel.value.terrain[opened.row][opened.col]).toBe('doorLeft');
  });
});

describe('resetGameProgress-doorOpened-closesItAgain', () => {
  it('Reset Game returns every door to closed (spec FR-013)', () => {
    doorStates.value = doorStates.value.map(toggleDoor);
    resetGameProgress();
    expect(doorStates.value.every((d) => d.phase === 'closed')).toBe(true);
  });
});

describe('resetGame-doorOpened-staysOpen', () => {
  it('death/respawn does not close an opened door (spec FR-013)', () => {
    doorStates.value = doorStates.value.map(toggleDoor);
    resetGame();
    expect(doorStates.value.every((d) => d.phase === 'open')).toBe(true);
  });
});
```

Match whatever level-fixture/import convention this test file already uses for `chestPlacements`/`deployableLadderPlacements` tests — read the existing tests immediately around those before writing these.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: FAIL

- [ ] **Step 3: Add the wiring**

Add the import:

```ts
import { createDoorState, applyOpenedDoors, type DoorState } from './engine/DoorState';
```

Add, mirroring `deployableLadderPlacements`/`deployableLadderStates`:

```ts
/**
 * Every door pair in the level, placed once at module load from DOOR_TILES
 * — same non-reactive, marker-driven convention as chestPlacements/
 * deployableLadderPlacements above.
 */
export const doorPlacements = computed<DoorState[]>(() =>
  DOOR_TILES.value.map(({ col, row }) => createDoorState(col, row)),
);

/**
 * Live open/closed state for every door — mirrors deployableLadderStates.
 * Unlike a bundle's one-way deploy, a door toggles freely (spec FR-008);
 * unlike a chest, it is NOT reset by resetGameProgress() alone — wait, it
 * IS reset by resetGameProgress() (spec FR-013), same as chests and blocks,
 * but UNLIKE a bundle it survives resetGame() (death/respawn) exactly like
 * chests/blocks already do.
 */
export const doorStates = signal<DoorState[]>(doorPlacements.value);
```

Find the existing `activeLevel` computed (from O-011) and extend it:

```ts
export const activeLevel = computed<LevelDef>(() =>
  applyOpenedDoors(
    applyDeployedLadders(currentLevel.value, deployableLadderStates.value),
    doorStates.value,
  ),
);
```

In `resetGame()`, add nothing — doors must survive death/respawn untouched, exactly like `chestStates`/`blockStates` (confirm `resetGame()`'s doc comment/body doesn't already touch them; it shouldn't, since this is a brand new signal).

In `resetGameProgress()`, add:

```ts
  doorStates.value = doorPlacements.value.map((d) => ({ ...d }));
```

placed alongside the existing `chestStates.value = chestPlacements.value.map(toChestState);` line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerState.ts src/themes/platformer/PlatformerState.test.ts
git commit -m "feat(O-029): wire door placements, state, and activeLevel composition"
```

---

## Task 14: Enemies Read `activeLevel` (Doors Block/Admit Enemies Too)

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `activeLevel` from Task 13.
- Produces: enemy movement's `MovementContext.level` is now `activeLevel.value`, not `currentLevel.value`.

This is the change that makes FR-007/FR-009/FR-010 (enemies blocked/admitted by door state) actually true — everything before this task only affects the player.

- [ ] **Step 1: Write the failing test**

```ts
describe('enemyMovement-closedDoorBlocksPatrol-reversesLikeAWall', () => {
  it('a patrolling enemy reverses at a closed door', () => {
    // Render the platformer with a fixture level: a patrolling enemy a few
    // tiles from a closed door pair, patrol boundary beyond the door so the
    // ONLY thing that can turn it around before that boundary is the door.
    // Advance several ticks and assert the enemy's x never crosses the
    // door's column — it reverses at the door exactly as it would at a wall.
  });
});

describe('enemyMovement-openDoorAdmitsPatrol-enemyWalksThrough', () => {
  it('an opened door lets a patrolling enemy walk through it', () => {
    // Same fixture, but the door's DoorState starts 'open' (or is toggled
    // open before the tick). Advance ticks and assert the enemy's x DOES
    // cross the door's column.
  });
});
```

Match whatever level-fixture/enemy-seeding convention `PlatformerPage.test.tsx` already uses for its other patrol-reversal tests (it has some, from the base enemy-movement seam work) — read one of those before writing these, rather than inventing a new fixture shape.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL — enemy movement currently reads `currentLevel.value`, which never reflects door state.

- [ ] **Step 3: Change the one call site**

Find (per this plan's earlier investigation) the `movementCtx: MovementContext` object literal, which currently reads:

```ts
      const movementCtx: MovementContext = {
        level: currentLevel.value,
```

Change to:

```ts
      const movementCtx: MovementContext = {
        level: activeLevel.value,
```

`activeLevel` is already imported in this file (from Task 13's O-011 precedent, used for `stepPlayerPhysics`) — no new import needed. No other line in this block changes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS. Also re-run the FULL suite once here — this is the one line in the entire plan that changes behavior for every existing enemy in every existing level (they now also respect deployed-ladder-bundle overrides, which were already non-solid/climbable so this should be a no-op for them, but confirm no existing enemy test regresses):

Run: `npx vitest run src/themes/platformer`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(O-029): enemies read the same effective grid as the player, so doors gate them too"
```

---

## Task 15: `engine/Interact.ts` — Generic Interact Dispatch

**Files:**
- Create: `src/themes/platformer/engine/Interact.ts`
- Test: `src/themes/platformer/engine/Interact.test.ts`

**Interfaces:**
- Produces: `Interactable` interface (`kind: string`, `findCandidate(): string | null`, `applyInteract(candidateId: string): void`); `applyInteract(interactables: readonly Interactable[]): boolean`.

This module is deliberately generic and knows nothing about ladders, chests,
doors, or signs — see design.md's "`applyInteract`: one dispatch, not a
fourth hand-written block". Task 16 supplies the four real adapters.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { applyInteract, type Interactable } from './Interact';

function fakeInteractable(kind: string, candidateId: string | null): Interactable & { applyInteractMock: ReturnType<typeof vi.fn> } {
  const applyInteractMock = vi.fn();
  return {
    kind,
    findCandidate: () => candidateId,
    applyInteract: applyInteractMock,
    applyInteractMock,
  };
}

describe('applyInteract-noCandidates-returnsFalseAndCallsNothing', () => {
  it('does nothing when nothing is found', () => {
    const a = fakeInteractable('a', null);
    const b = fakeInteractable('b', null);
    expect(applyInteract([a, b])).toBe(false);
    expect(a.applyInteractMock).not.toHaveBeenCalled();
    expect(b.applyInteractMock).not.toHaveBeenCalled();
  });
});

describe('applyInteract-firstKindHasCandidate-appliesItAndStops', () => {
  it('applies the first match and never checks the rest', () => {
    const a = fakeInteractable('a', 'a-1');
    const b = fakeInteractable('b', 'b-1');
    expect(applyInteract([a, b])).toBe(true);
    expect(a.applyInteractMock).toHaveBeenCalledWith('a-1');
    expect(b.applyInteractMock).not.toHaveBeenCalled();
  });
});

describe('applyInteract-onlySecondKindHasCandidate-appliesTheSecond', () => {
  it('falls through to the next kind when the first has none', () => {
    const a = fakeInteractable('a', null);
    const b = fakeInteractable('b', 'b-1');
    expect(applyInteract([a, b])).toBe(true);
    expect(b.applyInteractMock).toHaveBeenCalledWith('b-1');
  });
});

describe('applyInteract-emptyList-returnsFalse', () => {
  it('handles an empty interactables list', () => {
    expect(applyInteract([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/Interact.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `Interact.ts`**

```ts
/**
 * One interact-key-triggered candidate kind — a ladder bundle, a chest, a
 * door, a sign. `findCandidate`/`applyInteract` close over whatever live
 * state and position that kind needs (PlatformerPage.tsx builds a fresh
 * array of these each tick); this module knows nothing about what any kind
 * actually is. See design.md's "applyInteract: one dispatch, not a fourth
 * hand-written block".
 */
export interface Interactable {
  kind: string;
  /** Returns the id of the thing the player could interact with right now,
   *  or null. Read-only — must not itself change any state. */
  findCandidate(): string | null;
  /** Applies this kind's own one-shot effect for the given candidate. */
  applyInteract(candidateId: string): void;
}

/**
 * Tries each interactable in order and applies the FIRST one with a
 * candidate, then stops — a direct data-driven replacement for a chain of
 * `if (interactPressed && !alreadyHandled) { ... }` blocks. Order is the
 * caller's priority list (PlatformerPage.tsx: ladder bundle, door, chest,
 * sign — see design.md). Returns whether anything was applied, so a caller
 * that needs to know (none currently do, but O-011's `bundleDeployedThisTick`
 * shows the shape) can react.
 */
export function applyInteract(interactables: readonly Interactable[]): boolean {
  for (const interactable of interactables) {
    const candidateId = interactable.findCandidate();
    if (candidateId !== null) {
      interactable.applyInteract(candidateId);
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/Interact.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/Interact.ts src/themes/platformer/engine/Interact.test.ts
git commit -m "feat(O-029): add generic interact dispatch"
```

---

## Task 16: Per-Kind `Interactable` Factories — Details Live in Each Tile's Own Module

**Files:**
- Modify: `src/themes/platformer/engine/DeployableLadder.ts` (+ `.test.ts`)
- Modify: `src/themes/platformer/engine/DoorState.ts` (+ `.test.ts`)
- Modify: `src/themes/platformer/engine/Collision.ts` (+ `.test.ts`)
- Modify: `src/themes/platformer/engine/HintTooltip.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `Interactable` (Task 15).
- Produces: `ladderBundleInteractable(states, level, player): Interactable`; `doorInteractable(states, player): Interactable`; `chestInteractable(states, keys, player, onReveal): Interactable`; `hintInteractable(tooltipState, overlappingHintId): Interactable`.

The generic `applyInteract` dispatcher (Task 15) is not where each kind's
candidate/effect logic should actually live — that would just relocate the
duplication into `PlatformerPage.tsx` as inline closures instead of removing
it. Each kind's own file already owns its pure logic
(`ladderBundleForPlayer`/`beginDeploy`, `doorPlayerIsAdjacentTo`/`toggleDoor`,
`chestPlayerIsStandingOn`/`openChest`, `startHintTooltip`) — this task adds
one small factory per file that adapts that existing logic to the
`Interactable` shape, so `PlatformerPage.tsx` (Task 17) only has to call four
factories and pass the result to `applyInteract`, exactly the way it already
only calls `BLOCK_TYPES`/`ENEMY_TYPES` entries rather than branching on kind
itself (see Entities.md: "adding a new enemy, interactable or block should
mean writing one module").

**Placement note — avoid a circular import**: `chestPlayerIsStandingOn`
already lives in `engine/Collision.ts`, which already imports from
`entities/Chest.ts` (for `isChestOpen`/`CHEST_TYPE`). Putting
`chestInteractable` in `Chest.ts` instead would need `Chest.ts` to import
back from `Collision.ts`, a cycle. `chestInteractable` therefore lives in
`Collision.ts` beside the geometry test it wraps, not in `Chest.ts`.

- [ ] **Step 1: Write the failing tests, one per factory**

```ts
// DeployableLadder.test.ts
describe('ladderBundleInteractable-groundedNearRolledBundle-candidateIsBundleId', () => {
  it('wraps ladderBundleForPlayer/beginDeploy as an Interactable', () => {
    const states = { value: [/* one rolled bundle state */] };
    const interactable = ladderBundleInteractable(states as any, level, player);
    expect(interactable.kind).toBe('ladderBundle');
    expect(interactable.findCandidate()).toBe(states.value[0].id);
    interactable.applyInteract(states.value[0].id);
    expect(states.value[0].phase).toBe('deploying');
  });
});
```

```ts
// DoorState.test.ts
describe('doorInteractable-adjacentClosedDoor-toggleFlipsPhase', () => {
  it('wraps doorPlayerIsAdjacentTo/toggleDoor as an Interactable', () => {
    const states = { value: [createDoorState(1, 1)] };
    const interactable = doorInteractable(states as any, adjacentPlayer);
    expect(interactable.findCandidate()).toBe(states.value[0].id);
    interactable.applyInteract(states.value[0].id);
    expect(states.value[0].phase).toBe('open');
  });
});
```

```ts
// Collision.test.ts
describe('chestInteractable-standingOnClosedChestWithKeys-opensAndSpendsAKey', () => {
  it('wraps chestPlayerIsStandingOn/openChest as an Interactable, spending a key', () => {
    const states = { value: [/* one closed chest */] };
    const keys = { value: 1 };
    const onReveal = vi.fn();
    const interactable = chestInteractable(states as any, keys as any, standingPlayer, onReveal);
    const id = interactable.findCandidate()!;
    interactable.applyInteract(id);
    expect(isChestOpen(states.value[0])).toBe(true);
    expect(keys.value).toBe(0);
    expect(onReveal).toHaveBeenCalledOnce();
  });
});

describe('chestInteractable-standingOnClosedChestWithZeroKeys-noCandidate', () => {
  it('returns no candidate when the visitor holds no keys', () => {
    const states = { value: [/* one closed chest */] };
    const keys = { value: 0 };
    const interactable = chestInteractable(states as any, keys as any, standingPlayer, vi.fn());
    expect(interactable.findCandidate()).toBeNull();
  });
});
```

```ts
// HintTooltip.test.ts
describe('hintInteractable-newHintId-startsTheTooltip', () => {
  it('starts a fresh tooltip for a new hint id', () => {
    const tooltipState = { value: null };
    const interactable = hintInteractable(tooltipState as any, 'chestNeedsKey');
    expect(interactable.findCandidate()).toBe('chestNeedsKey');
    interactable.applyInteract('chestNeedsKey');
    expect(tooltipState.value?.hintId).toBe('chestNeedsKey');
  });
});

describe('hintInteractable-currentlyExiting-restartsEntrance', () => {
  it('restarts the entrance when pressed again mid-exit', () => {
    const tooltipState = { value: { hintId: 'chestNeedsKey', phase: 'exiting', elapsed: 0.3 } };
    const interactable = hintInteractable(tooltipState as any, 'chestNeedsKey');
    interactable.applyInteract('chestNeedsKey');
    expect(tooltipState.value?.phase).toBe('entering');
    expect(tooltipState.value?.elapsed).toBe(0);
  });
});
```

Match whatever fake-signal shape (`{ value: T }`) each file's existing tests
already use for signals; adjust the `as any` casts to that file's actual
convention rather than introducing a new one.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/engine/DeployableLadder.test.ts src/themes/platformer/engine/DoorState.test.ts src/themes/platformer/engine/Collision.test.ts src/themes/platformer/engine/HintTooltip.test.ts`
Expected: FAIL — none of the four factories exist yet.

- [ ] **Step 3: Implement the four factories**

In `DeployableLadder.ts`:

```ts
import type { Interactable } from './Interact';

export function ladderBundleInteractable(
  states: Signal<DeployableLadderState[]>,
  level: LevelDef,
  player: PlayerState,
): Interactable {
  return {
    kind: 'ladderBundle',
    findCandidate: () => ladderBundleForPlayer(level, states.value, player)?.id ?? null,
    applyInteract: (id) => {
      states.value = states.value.map((s) => (s.id === id ? beginDeploy(s) : s));
    },
  };
}
```

In `DoorState.ts`:

```ts
import type { Interactable } from './Interact';

export function doorInteractable(states: Signal<DoorState[]>, player: PlayerState): Interactable {
  return {
    kind: 'door',
    findCandidate: () => doorPlayerIsAdjacentTo(states.value, player),
    applyInteract: (id) => {
      states.value = states.value.map((d) => (d.id === id ? toggleDoor(d) : d));
    },
  };
}
```

In `Collision.ts`:

```ts
import type { Interactable } from './Interact';
import { openChest, CHEST_CLOSED_OFFSET_X, type ChestState } from '../entities/Chest';

export function chestInteractable(
  states: Signal<ChestState[]>,
  keys: Signal<number>,
  player: PlayerState,
  onReveal: (fact: CollectedFact, effect: { x: number; y: number; effectId: string }) => void,
): Interactable {
  return {
    kind: 'chest',
    findCandidate: () => (keys.value > 0 ? chestPlayerIsStandingOn(player, states.value) ?? null : null),
    applyInteract: (id) => {
      const chest = states.value.find((c) => c.id === id)!;
      states.value = states.value.map((c) => (c.id === id ? openChest(c) : c));
      keys.value -= 1;
      onReveal(chest.fact, { x: chest.x + CHEST_CLOSED_OFFSET_X, y: chest.y, effectId: chest.id });
    },
  };
}
```

In `HintTooltip.ts`:

```ts
import type { Interactable } from './Interact';

/**
 * The interact-triggered half of hint/tooltip behavior — "start it on a
 * fresh press". `overlappingHintId` is computed by the caller each tick
 * exactly as today (the union of a sign overlap and a locked-chest-needs-
 * key case, PlatformerPage.tsx's existing logic, unchanged by this task);
 * this factory only owns what happens once interact fires for it. The
 * CONTINUOUS half — tickHintTooltip's per-frame advance, and the
 * not-overlapping exit branch — stays independent of this factory entirely,
 * same as DeployableLadder.ts's advanceDeployableLadder stays independent of
 * ladderBundleInteractable above.
 */
export function hintInteractable(
  tooltipState: Signal<HintTooltipState | null>,
  overlappingHintId: HintId | undefined,
): Interactable {
  return {
    kind: 'hint',
    findCandidate: () => overlappingHintId ?? null,
    applyInteract: (id) => {
      const current = tooltipState.value;
      if (!current || current.hintId !== id) {
        tooltipState.value = startHintTooltip(id as HintId);
      } else if (current.phase === 'exiting') {
        tooltipState.value = { ...current, phase: 'entering', elapsed: 0 };
      }
    },
  };
}
```

Import `Signal` from `@preact/signals-react` in each file that needs it (check the file's existing imports first — several already import other signal helpers from this package).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/DeployableLadder.test.ts src/themes/platformer/engine/DoorState.test.ts src/themes/platformer/engine/Collision.test.ts src/themes/platformer/engine/HintTooltip.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/DeployableLadder.ts src/themes/platformer/engine/DeployableLadder.test.ts src/themes/platformer/engine/DoorState.ts src/themes/platformer/engine/DoorState.test.ts src/themes/platformer/engine/Collision.ts src/themes/platformer/engine/Collision.test.ts src/themes/platformer/engine/HintTooltip.ts src/themes/platformer/engine/HintTooltip.test.ts
git commit -m "feat(O-029): add per-kind Interactable factories, keeping each kind's details in its own module"
```

---

## Task 17: `PlatformerPage.tsx` — Compose the Four Factories, Replace the Hand-Written Blocks

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `applyInteract` (Task 15); `ladderBundleInteractable`, `doorInteractable`, `chestInteractable`, `hintInteractable` (Task 16); `doorStates`/`doorPlacements` (Task 13); `GROUND_WOOD_SHEET` (Task 10).
- Produces: `PlatformerPage.tsx`'s tick calls four factories and `applyInteract` instead of four hand-written blocks; the door is now wired in and rendered; the wood ground tile finally renders (Step 5 below closes a gap left open since Task 9).

**⚠️ Higher regression risk than earlier tasks**: this touches the ladder
bundle's, chest's, and sign's ALREADY-SHIPPED interact call sites, not just
new door code — though Task 16 already moved and unit-tested the actual
logic, so this task is now closer to pure wiring than a rewrite. Every
existing test for those three must still pass, UNCHANGED, after this task.
If any existing assertion needs to change, stop and re-read the code being
replaced rather than editing the test.

- [ ] **Step 1: Read the current interact block in full before changing anything**

Re-read `PlatformerPage.tsx` from the `arrowUpPressed`/`wPressed` lines
through the end of the hint-tooltip block (the `bundleForPlayer`, chest-open,
`overlappingSignHintId`/`lockedChestHintId`/`overlappingHintId`, and
tooltip-phase sections) as it currently stands — O-011/S-007 code may have
shifted since this plan was written.

- [ ] **Step 2: Write the failing door tests (the only genuinely NEW behavior)**

```ts
describe('interact-standingNextToClosedDoor-opensIt', () => {
  it('Up next to a closed door opens it, costs nothing', () => {
    // Fixture: level with one door pair, player positioned one column left
    // of the left leaf, same row. Press ArrowUp, advance one tick.
    // Assert: doorStates reflects 'open'; collectedKeys unchanged;
    // collectedFacts unchanged.
  });
});

describe('interact-standingNextToOpenDoor-closesIt', () => {
  it('Up next to an open door closes it again', () => {
    // Same fixture, door pre-toggled open. Press ArrowUp, advance a tick.
    // Assert: doorStates reflects 'closed'.
  });
});

describe('interact-notAdjacentToDoor-doesNothing', () => {
  it('Up does nothing when not standing next to the door', () => {
    // Player two columns away. Press ArrowUp. Assert doorStates unchanged.
  });
});

describe('interact-ladderBundleCandidate-suppressesADoorCandidateSameTick', () => {
  it('preserves the existing "ladder bundle goes first" priority', () => {
    // Contrived fixture where both could match; assert only the bundle's
    // phase changes and doorStates is untouched.
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL for the four new door tests; every PRE-EXISTING test in this file should still be PASSING at this point (you haven't touched production code yet).

- [ ] **Step 4: Replace the hand-written blocks with the composed dispatch**

Import `applyInteract` from `./engine/Interact`, `ladderBundleInteractable` from `./engine/DeployableLadder`, `doorInteractable` from `./engine/DoorState`, `chestInteractable` from `./engine/Collision`, `hintInteractable` from `./engine/HintTooltip`, and `doorStates` per Task 13.

Replace the existing sequence — `bundleForPlayer` computation + its `if`
block, the chest `if (interactPressed && !bundleDeployedThisTick)` block,
and the interact-triggered half of the hint-tooltip block (the
`if (overlappingHintId && interactPressed && !bundleDeployedThisTick) { ... }`
branch specifically — with:

```ts
      if (interactPressed) {
        applyInteract([
          ladderBundleInteractable(deployableLadderStates, currentLevel.value, playerState.value),
          doorInteractable(doorStates, playerState.value),
          chestInteractable(chestStates, collectedKeys, playerState.value, revealFact),
          hintInteractable(hintTooltipState, overlappingHintId),
        ]);
      }
```

Keep `overlappingSignHintId`, `lockedChestHintId`, `overlappingHintId`,
`tickHintTooltip(dt)`, and the not-overlapping exit branch exactly where
they are today, unchanged — `overlappingHintId` must still be computed
BEFORE this block since `hintInteractable` reads it. Delete the now-dead
`bundleDeployedThisTick`/`bundleForPlayer` locals and the old inline chest
`if` block entirely — their logic now lives inside Task 16's factories.

- [ ] **Step 5: Wire the door render call**

Find where `drawChests`/`drawDeployableLadders` are called in the render pass and add, in the same area:

```ts
      drawDoors(ctx, doorStates.value, doorSheetRef.current, originX, originY);
```

Add a `doorSheetRef` + `loadImage(DOOR_SHEET.src)`, following the exact `ropeLadderRef`/`loadImage(ROPE_LADDER_SHEET.src)` pattern from O-011 (its own dedicated sheet per Task 8, not a shared one — no reuse to check for here).

**Also wire `groundWoodImage` here — this is the one remaining gap left by Task 9.** Task 9 added the `groundWoodImage` optional parameter to `drawTerrain`'s signature and the `groundWood` case to `tileSource`, but nothing in the plan ever loads `GROUND_WOOD_SHEET.src` or passes it at `drawTerrain`'s actual call site — Task 11 wired the analogous background-wood image through, but the *foreground* ground-wood image was never threaded anywhere. Without this fix, `groundWood` tiles render as nothing (the `if (!sheet) continue` guard silently skips them forever), which Task 18's manual check would otherwise catch far too late. Add a `groundWoodImageRef` + `loadImage(GROUND_WOOD_SHEET.src)`, same pattern as `doorSheetRef` above, and pass it as `drawTerrain`'s `groundWoodImage` argument at its existing call site (find where `drawTerrain` is currently called in this file's render pass).

- [ ] **Step 6: Run the full existing PlatformerPage test file**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS — every pre-existing ladder-bundle, chest, and sign/hint test
passes UNCHANGED, and the four new door tests from Step 2 now pass too. If
any pre-existing test fails, re-check that Task 16's factories faithfully
reproduce Step 1's original behavior — fix the factory, not the test.

- [ ] **Step 7: Run the full platformer suite**

Run: `npx vitest run src/themes/platformer`
Expected: PASS, no regressions anywhere else in the theme.

- [ ] **Step 8: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "refactor(O-029): compose ladder bundle, door, chest, and hint interactables in PlatformerPage.tsx"
```

---

## Task 18: Manual Browser Verification

**Files:** none (verification only — constitution requires a manual browser check for changes with visible behavior).

**Known limitation, not a bug to chase here**: the level editor's own canvas (`EditorCanvas.tsx`) never got `groundWoodImage`/`DOOR_SHEET` threaded into its live preview rendering — no task in this plan wires that up, only `PlatformerPage.tsx` (the live game, Task 17) and the background-wood image (Task 11, both editor and game). Placed `W`/`d`/`D` tiles will therefore look blank while editing (though still placeable via the Task 12 palette and correctly saved/loaded per FR-013) and only render with real art once the level is actually played. This is spec-compliant — FR-013 requires placement and persistence, not editor-canvas visual fidelity — and deliberately left as a follow-up rather than expanding this already-large plan further.

- [ ] **Step 1: Start the dev server and open the level editor**

Paint a small test level: a run of `W` tiles, a filled region of the `w` background material, and a `dD` door pair blocking a corridor with a patrolling enemy marker beyond it. Per the known limitation above, `W`/`d`/`D` may look blank on the editor's own canvas while painting — that's expected; verify the actual behavior once played (Step 2).

- [ ] **Step 2: Play the level**

Verify: the wood ground is solid and visually distinct and non-connecting; the wood backdrop reads as one continuous darker-wood mass; the closed door blocks the character and the enemy; pressing the interact key next to it opens it (both the character and the enemy can now pass); pressing it again closes it and blocks both again; opening/closing spends no key and reveals no fact (watch the HUD counters).

- [ ] **Step 3: Reset Game**

Verify every door returns to closed.

- [ ] **Step 4: Report results**

Take a screenshot of the rendered wood/door scene and share it — this step has no commit; it's the human-facing proof the constitution requires alongside the automated tests above.

---

## Self-Review Notes (for whoever executes this plan)

- **Task 0 is unusually load-bearing**: every later task's exact sprite coordinates depend on its output. Do not skip straight to Task 1 with guessed numbers.
- **Task 9's Step 5** (threading `groundWoodImage` through `drawTerrain`) is the one step in this plan described by pattern-reference rather than full code, because it depends on exactly how `drawTerrain`'s current parameter list is shaped at implementation time — read `Terrain.md`'s "Adding a tile" step 3 and the `crumblingFloor` sheet-threading precedent before writing it.
- **Task 17's exact `interactPressed` block ordering** depends on precisely which existing blocks precede it in the current `PlatformerPage.tsx` tick — re-read that function's current state before inserting, since O-011/S-007 code may have shifted since this plan was written.
- **Task 16 depends on Task 15's `Interactable` type existing first** — do not reorder these two; each factory imports `type { Interactable }` from `engine/Interact.ts`.
