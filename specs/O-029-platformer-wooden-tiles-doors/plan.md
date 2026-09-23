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
- Modify: `public/sprites/background_tiles.png` (append a 7th material row)
- Verify: `public/sprites/staticObjects.png` (door leaf crops already exist per design.md's "Open art already exists")

**Interfaces:**
- Produces: the exact native-pixel `sx`/`sy` coordinates every later task's `StaticObjectEntry`/`tileSource` values need.

- [ ] **Step 1: Finalize and place `ground_wood.png`**

A single 32×16 image, two 16×16 frames side by side: frame 0 (x=0..15) is the exposed-top wood plank sprite, frame 1 (x=16..31) is the buried wood sprite — mirrors `crumble_floor.png`'s multi-frame-strip convention (see `sheets.ts`'s `CRUMBLE_FLOOR_SHEET`). Use the palette established in this feature's brainstorming session (`.generated/wood_ground_fg.png`'s left tile) as the exposed-top frame; author a buried variant (same palette, slightly less detail is fine, matching how `groundRock`'s buried frame is plainer than its exposed one). Save to `public/sprites/ground_wood.png`.

- [ ] **Step 2: Append the wood material row to `background_tiles.png`**

Append a 7th 4-column×3-row block (same `BACKGROUND_ATLAS_STRIDE`/`BACKGROUND_ATLAS_ROW_PITCH` layout every existing material uses — see `BackgroundAtlas.ts`) below the existing six, using the darker wood palette from `.generated/wood_ground_fg.png`'s right tile. Row index will be `6` (0-indexed, after `caveStone` at `3`... — record the actual row index chosen; it must be a value not already used in `BACKGROUND_MATERIAL_ROW_INDEX`).

- [ ] **Step 3: Record the door leaf crop rectangles**

Run this once against the current `public/sprites/staticObjects.png` to print exact bounding boxes, and note the four results (closed-left, closed-right, open-left, open-right) for Task 4:

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
print('closed pair:', bbox(60, 66, 105, 100))
print('open leaf A:', bbox(29, 62, 52, 98))
"
```

Cross-check each printed box against the spec's Clarifications (each leaf 16×26 native px) and design.md's "Open art already exists" section before using the numbers in Task 4 — if a box doesn't match that shape, widen the search window and re-run rather than guessing.

- [ ] **Step 4: Commit the art**

```bash
git add public/sprites/ground_wood.png public/sprites/background_tiles.png
git commit -m "art(O-029): add wood ground and wood background material sprites"
```

---

## Task 1: Foundational Types — `TileType`, Fog Exemption, Background Material

**Files:**
- Modify: `src/themes/platformer/level/LevelData.ts`
- Test: `src/themes/platformer/level/LevelData.test.ts` (create if it doesn't exist; otherwise extend)

**Interfaces:**
- Produces: `TileType` members `'groundWood'`, `'doorLeft'`, `'doorRight'`, `'doorLeftOpen'`, `'doorRightOpen'`; `BackgroundMaterialId` member `'wood'`.

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/level/LevelData.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/LevelData.ts src/themes/platformer/level/LevelData.test.ts
git commit -m "feat(O-029): add wood/door TileType members and wood background material"
```

---

## Task 2: Level Format — Characters, `TileChar`/`BackgroundChar`, `findDoorTiles`

**Files:**
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Modify: `src/themes/platformer/level/LevelParser.test.ts`

**Interfaces:**
- Consumes: `TileType`/`BackgroundMaterialId` members from Task 1.
- Produces: `findDoorTiles(layout): { col: number; row: number }[]` (one entry per matched pair, positioned at the **left** leaf's cell).

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

describe('BACKGROUND_CHARS-w-mapsToWood', () => {
  it('w maps to the wood background material', () => {
    expect(BACKGROUND_CHARS.w).toBe('wood');
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

In `BACKGROUND_CHARS`, add `w: 'wood',` and add `'w'` to the `BackgroundChar` union.

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/LevelParser.test.ts`
Expected: PASS. Also confirm the existing map/`TileChar` sync assertion (search the test file for it) still passes — it should, since `W`/`d`/`D` were added to both places together.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts
git commit -m "feat(O-029): add level-format characters for wood ground, wood background, and doors"
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

describe('doorPlayerIsAdjacentTo-playerOneColumnLeftOfLeftLeaf-returnsDoorId', () => {
  it('matches standing immediately left of the left leaf, same row', () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(0 * RENDERED_TILE_SIZE, 1 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBe(state.id);
  });
});

describe('doorPlayerIsAdjacentTo-playerOneColumnRightOfRightLeaf-returnsDoorId', () => {
  it('matches standing immediately right of the right leaf, same row', () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(3 * RENDERED_TILE_SIZE, 1 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBe(state.id);
  });
});

describe('doorPlayerIsAdjacentTo-playerTwoColumnsAway-returnsNull', () => {
  it('does not match from two columns away', () => {
    const state = createDoorState(1, 1);
    const player = makePlayer(-1 * RENDERED_TILE_SIZE, 1 * RENDERED_TILE_SIZE);
    expect(doorPlayerIsAdjacentTo([state], player)).toBeNull();
  });
});

describe('doorPlayerIsAdjacentTo-playerDifferentRow-returnsNull', () => {
  it('does not match a different row', () => {
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
import { RENDERED_TILE_SIZE, PLAYER_RENDERED_SIZE } from '../level/Terrain';
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
 * hitbox sits in the column immediately left of the left leaf OR
 * immediately right of the right leaf. Mirrors `ladderBundleForPlayer`'s
 * shape (a plain scan + column/row arithmetic), not Collision.ts's generic
 * overlappingTriggers (which only tests actual box overlap).
 */
export function doorPlayerIsAdjacentTo(
  states: readonly DoorState[],
  player: PlayerState,
): string | null {
  const playerRow = Math.floor(player.y / RENDERED_TILE_SIZE);
  const playerLeftCol = Math.floor(player.x / RENDERED_TILE_SIZE);
  const playerRightCol = Math.floor((player.x + PLAYER_RENDERED_SIZE - 1) / RENDERED_TILE_SIZE);
  for (const state of states) {
    if (state.row !== playerRow) continue;
    const leftOfDoor = state.col - 1;
    const rightOfDoor = state.col + 2;
    if (playerRightCol === leftOfDoor || playerLeftCol === rightOfDoor) {
      return state.id;
    }
  }
  return null;
}
```

Check `entities/Player.ts` for the exact `PlayerState` field names (`x`, `y`) and `PLAYER_RENDERED_SIZE`'s exact export name before finalizing this file — adjust the import only if a name differs from what's used above; the logic itself does not change.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/engine/DoorState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/DoorState.ts src/themes/platformer/engine/DoorState.test.ts
git commit -m "feat(O-029): add pure door state module (toggle, effective grid, adjacency)"
```

---

## Task 8: `StaticObjectsCatalog.ts` — Door Leaf Sprite Crops

**Files:**
- Modify: `src/themes/platformer/engine/StaticObjectsCatalog.ts`
- Modify: `src/themes/platformer/engine/StaticObjectsCatalog.test.ts`

**Interfaces:**
- Consumes: the four crop rectangles recorded in Task 0, Step 3.
- Produces: `DOOR_LEAF_CLOSED_LEFT`, `DOOR_LEAF_CLOSED_RIGHT`, `DOOR_LEAF_OPEN_LEFT`, `DOOR_LEAF_OPEN_RIGHT: StaticObjectEntry`.

- [ ] **Step 1: Write the failing test**

```ts
describe('doorLeafEntries-everyEntry-stayInsideStaticObjectsSheetBounds', () => {
  it('every door leaf crop is inside the 288x145 sheet', () => {
    const SHEET_WIDTH = 288;
    const SHEET_HEIGHT = 145;
    for (const entry of [
      DOOR_LEAF_CLOSED_LEFT,
      DOOR_LEAF_CLOSED_RIGHT,
      DOOR_LEAF_OPEN_LEFT,
      DOOR_LEAF_OPEN_RIGHT,
    ]) {
      expect(entry.sx + (entry.width ?? 16)).toBeLessThanOrEqual(SHEET_WIDTH);
      expect(entry.sy + (entry.height ?? 16)).toBeLessThanOrEqual(SHEET_HEIGHT);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/StaticObjectsCatalog.test.ts`
Expected: FAIL — the four exports don't exist.

- [ ] **Step 3: Add the entries**

Using Task 0 Step 3's recorded values (example shape below — replace `sx`/`sy`/`width`/`height` with the actual recorded numbers, each leaf ~16 wide × ~26 tall per the spec's Clarifications):

```ts
/**
 * The wooden double door's four leaf crops (O-029), from `staticObjects.png`
 * — closed-left/closed-right sit flush together forming the shut door;
 * open-left/open-right are the same leaves swung apart. Named individually
 * rather than through `pickVariant` (no position-hashed variation — a door
 * leaf is always exactly one of these four, chosen by `DoorState.phase` and
 * which side, not by cell position) — same convention as
 * `COBWEB_CORNER_ENTRY`/`COBWEB_FLAT_ENTRY`.
 */
export const DOOR_LEAF_CLOSED_LEFT: StaticObjectEntry = { sx: 0, sy: 0, width: 16, height: 26 };
export const DOOR_LEAF_CLOSED_RIGHT: StaticObjectEntry = { sx: 0, sy: 0, width: 16, height: 26 };
export const DOOR_LEAF_OPEN_LEFT: StaticObjectEntry = { sx: 0, sy: 0, width: 16, height: 26 };
export const DOOR_LEAF_OPEN_RIGHT: StaticObjectEntry = { sx: 0, sy: 0, width: 16, height: 26 };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/engine/StaticObjectsCatalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/StaticObjectsCatalog.ts src/themes/platformer/engine/StaticObjectsCatalog.test.ts
git commit -m "feat(O-029): add door leaf sprite crop entries"
```

---

## Task 9: `Renderer.ts` — Draw Wood Ground, Bleed-Rendered Doors

**Files:**
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/engine/Renderer.test.ts`

**Interfaces:**
- Consumes: `GROUND_WOOD_SHEET` (registered in Task 10), `DOOR_LEAF_*` entries from Task 8, `DoorState` from Task 7.
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

(These `sx`/`sy` assume `GROUND_WOOD_SHEET` is its own dedicated sheet per Task 10, addressed from `(0,0)`, not `world_tileset.png`'s coordinate space — `drawTerrain`'s groundWood branch, added in this same task, must pass the `groundWoodSheet` image, not `worldTilesetImage`, to whatever draws it. If Task 0 instead placed the art into free `world_tileset.png` cells, use that sheet's actual coordinates here instead and update this comment.)

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
import { DOOR_LEAF_CLOSED_LEFT, DOOR_LEAF_CLOSED_RIGHT, DOOR_LEAF_OPEN_LEFT, DOOR_LEAF_OPEN_RIGHT } from './StaticObjectsCatalog';
import type { DoorState } from './DoorState';

/**
 * Draws every door's two leaves. Each leaf's source art is taller than
 * RENDERED_TILE_SIZE, so it is drawn BOTTOM-anchored to its own cell — the
 * leaf's rendered bottom edge lines up with the cell's bottom edge, and the
 * excess height bleeds upward into the cell above (design.md's "Rendering
 * taller than the tile: bleed, not squeeze" — the mirror of FloorSpike's
 * downward bleed). `imageSmoothingEnabled = false` matches every other
 * pixel-art draw pass in this file.
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
    const leftEntry = state.phase === 'open' ? DOOR_LEAF_OPEN_LEFT : DOOR_LEAF_CLOSED_LEFT;
    const rightEntry = state.phase === 'open' ? DOOR_LEAF_OPEN_RIGHT : DOOR_LEAF_CLOSED_RIGHT;
    drawBottomAnchoredLeaf(ctx, doorSheet, leftEntry, state.col, state.row, originX, originY);
    drawBottomAnchoredLeaf(ctx, doorSheet, rightEntry, state.col + 1, state.row, originX, originY);
  }
}

function drawBottomAnchoredLeaf(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  entry: StaticObjectEntry,
  col: number,
  row: number,
  originX: number,
  originY: number,
): void {
  const width = entry.width ?? TILE_SIZE;
  const height = entry.height ?? TILE_SIZE;
  const destWidth = width * RENDER_SCALE;
  const destHeight = height * RENDER_SCALE;
  const cellBottomY = (row + 1) * RENDERED_TILE_SIZE;
  const destX = col * RENDERED_TILE_SIZE + originX;
  const destY = cellBottomY - destHeight + originY;
  ctx.drawImage(sheet, entry.sx, entry.sy, width, height, destX, destY, destWidth, destHeight);
}
```

- [ ] **Step 5: Wire the `groundWood` render into `drawTerrain`**

Find where `drawTerrain` handles `groundRock` (a plain `tileSource`-driven draw, no custom branch) and confirm `groundWood` needs no custom branch either **if** its sheet is registered as an additional optional image parameter thread through `drawTerrain` (mirroring how `staticObjects`/`decorations` images are already threaded — see `Terrain.md`'s "Adding a tile" step 3). Add `groundWoodImage` as a new optional parameter, and extend the plain per-cell draw loop's sheet-selection logic to pick `groundWoodImage` when `type === 'groundWood'`. Follow the exact pattern `crumblingFloor`'s dedicated sheet threading already established, rather than inventing a new one.

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
- Produces: `GROUND_WOOD_SHEET: SpriteSheet`.
- Door art reuses the already-registered `STATIC_OBJECTS_SHEET` — no new sheet needed for it.

- [ ] **Step 1: Register the new sheet**

```ts
/** `ground_wood.png` — a 32x16 strip of two 16x16 frames (O-029): 0 =
 *  exposed-top wood plank, 1 = buried wood — the same two-frame shape as
 *  `groundRock`'s own lookup, addressed by `tileSource`'s sx/sy, not by
 *  frame index. */
export const GROUND_WOOD_SHEET: SpriteSheet = {
  src: '/sprites/ground_wood.png',
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  columns: 2,
};
```

- [ ] **Step 2: No test needed**

This file's existing convention has no direct unit tests for sheet registration constants (confirm by checking whether `sheets.ts` has a `.test.ts` sibling; if it does, add one assertion that `GROUND_WOOD_SHEET.src === '/sprites/ground_wood.png'` and run it — otherwise skip, matching the file's established pattern).

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/entities/sprites/sheets.ts
git commit -m "feat(O-029): register the wood ground sprite sheet"
```

---

## Task 11: `BackgroundAtlas.ts` — Wood Material Row

**Files:**
- Modify: `src/themes/platformer/engine/BackgroundAtlas.ts`
- Modify: `src/themes/platformer/engine/BackgroundAtlas.test.ts`

**Interfaces:**
- Consumes: `'wood'` `BackgroundMaterialId` from Task 1; the row index recorded in Task 0 Step 2.
- Produces: `backgroundAtlasCell('wood', mask)` returns valid entries for every mask 0-15.

- [ ] **Step 1: Write the failing test**

```ts
describe('backgroundAtlasCell-woodEveryMask-returnsAValidEntry', () => {
  it('wood resolves every one of the 16 masks', () => {
    for (let mask = 0; mask < 16; mask++) {
      const entry = backgroundAtlasCell('wood', mask);
      expect(entry.sx).toBeGreaterThanOrEqual(0);
      expect(entry.sy).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/engine/BackgroundAtlas.test.ts`
Expected: FAIL — `wood` is missing from `BACKGROUND_MATERIAL_ROW_INDEX`, so `BACKGROUND_ATLAS`'s `Object.keys` derivation won't include it (TypeScript will also flag the `Record<BackgroundMaterialId, number>` as incomplete).

- [ ] **Step 3: Add the row index**

Using the row index recorded in Task 0, Step 2 (example uses `6`, i.e. the 7th row):

```ts
const BACKGROUND_MATERIAL_ROW_INDEX: Record<BackgroundMaterialId, number> = {
  dirt: 0,
  rust: 1,
  surfaceStone: 2,
  caveStone: 3,
  maroon: 4,
  charcoal: 5,
  wood: 6,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/engine/BackgroundAtlas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/engine/BackgroundAtlas.ts src/themes/platformer/engine/BackgroundAtlas.test.ts
git commit -m "feat(O-029): add the wood background material's atlas row"
```

---

## Task 12: Editor Palette — Wood Ground, Wood Background, Doors

**Files:**
- Modify: `src/themes/platformer/editor/paletteTiles.ts`
- Modify: `src/themes/platformer/editor/paletteTiles.test.ts`
- Modify: `src/themes/platformer/editor/backgroundPaletteTiles.ts`

**Interfaces:**
- Consumes: `TileChar`/`BackgroundChar` members from Task 2; sprite crops from Tasks 8/10.

- [ ] **Step 1: Write the failing tests**

```ts
describe('PALETTE_TILE_SPRITES-woodAndDoorChars-haveEntries', () => {
  it('W, d, D each have a sprite spec', () => {
    expect(PALETTE_TILE_SPRITES.W).not.toBeNull();
    expect(PALETTE_TILE_SPRITES.d).not.toBeNull();
    expect(PALETTE_TILE_SPRITES.D).not.toBeNull();
  });
});

describe('PALETTE_TILE_LABELS-woodAndDoorChars-haveReadableNames', () => {
  it('each has a non-empty label', () => {
    expect(PALETTE_TILE_LABELS.W.length).toBeGreaterThan(0);
    expect(PALETTE_TILE_LABELS.d.length).toBeGreaterThan(0);
    expect(PALETTE_TILE_LABELS.D.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts`
Expected: FAIL

- [ ] **Step 3: Add the entries**

In `PALETTE_TILE_SPRITES` (`src/themes/platformer/editor/paletteTiles.ts`), following the `groundRock` entry's shape (a direct sheet+sx/sy+frame size, the "at rest" appearance — for `groundWood` use `GROUND_WOOD_SHEET`'s exposed-top frame; for `d`/`D` use `DOOR_LEAF_CLOSED_LEFT`/`DOOR_LEAF_CLOSED_RIGHT` from Task 8):

```ts
  W: { sheet: GROUND_WOOD_SHEET.src, sheetWidth: 32, sheetHeight: 16, sx: 0, sy: 0, frameWidth: 16, frameHeight: 16 },
  d: { sheet: STATIC_OBJECTS_SHEET.src, sheetWidth: 288, sheetHeight: 145, sx: DOOR_LEAF_CLOSED_LEFT.sx, sy: DOOR_LEAF_CLOSED_LEFT.sy, frameWidth: DOOR_LEAF_CLOSED_LEFT.width ?? 16, frameHeight: DOOR_LEAF_CLOSED_LEFT.height ?? 16 },
  D: { sheet: STATIC_OBJECTS_SHEET.src, sheetWidth: 288, sheetHeight: 145, sx: DOOR_LEAF_CLOSED_RIGHT.sx, sy: DOOR_LEAF_CLOSED_RIGHT.sy, frameWidth: DOOR_LEAF_CLOSED_RIGHT.width ?? 16, frameHeight: DOOR_LEAF_CLOSED_RIGHT.height ?? 16 },
```

In `PALETTE_TILE_DESCRIPTIONS`:

```ts
  W: 'Solid wood ground. Does not connect to neighbouring wood tiles.',
  d: 'Left panel of a wooden double door — always place its right panel (D) immediately to its right.',
  D: 'Right panel of a wooden double door — always place its left panel (d) immediately to its left.',
```

In `PALETTE_TILE_LABELS`:

```ts
  W: 'Wood Ground',
  d: 'Door (Left)',
  D: 'Door (Right)',
```

Do **not** add `d`/`D` to `DECORATION_CHARS` in `Palette.tsx` — they are structural terrain, not decoration, and fall into the Terrain group automatically per that file's existing rule. `W` needs no `Palette.tsx` change either, for the same reason.

In `backgroundPaletteTiles.ts`, add to `BACKGROUND_PALETTE_LABELS`:

```ts
  wood: 'Wood',
```

(`BACKGROUND_PALETTE_SPRITES`, `BACKGROUND_MATERIAL_CHAR`, and `BACKGROUND_PALETTE_SECTIONS` all derive automatically from `BACKGROUND_MATERIAL_FAMILY`/`BACKGROUND_CHARS` — Tasks 1 and 2 already made those complete for `wood`, so no other edit is needed here.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/paletteTiles.ts src/themes/platformer/editor/paletteTiles.test.ts src/themes/platformer/editor/backgroundPaletteTiles.ts
git commit -m "feat(O-029): add editor palette entries for wood ground, wood background, and door panels"
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

## Task 15: `PlatformerPage.tsx` — Interact Key Toggles a Door

**Files:**
- Modify: `src/themes/platformer/PlatformerPage.tsx`
- Modify: `src/themes/platformer/PlatformerPage.test.tsx`

**Interfaces:**
- Consumes: `doorStates`/`doorPlacements` (Task 13), `doorPlayerIsAdjacentTo`/`toggleDoor` (Task 7), `interactPressed`/`bundleDeployedThisTick` (existing, Task 3 area of O-011's tick).
- Produces: pressing the interact key next to a door toggles it, spending no key and revealing no fact.

- [ ] **Step 1: Write the failing tests**

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

describe('interact-doorAndChestBothStandable-existingPrecedenceApplies', () => {
  it('does not crash and resolves deterministically when both are candidates', () => {
    // Out of scope to arbitrate per spec.md's Edge Cases — this test only
    // guards against a crash/undefined-behavior regression, not a specific
    // winner.
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Add the toggle wiring**

Import `doorStates`, `doorPlayerIsAdjacentTo`, `toggleDoor` (from `./PlatformerState` and `./engine/DoorState` respectively — `PlatformerState.ts` already re-exports most signals this file consumes; add `doorStates` to whatever existing destructured import block brings in `chestStates`).

Immediately after the existing chest-open block (`if (interactPressed && !bundleDeployedThisTick) { ... }` — the one opening `standingChestId`), add a parallel block for the door, guarded the same way so a door toggle and a chest open never both fire from one press:

```ts
      const adjacentDoorId = interactPressed ? doorPlayerIsAdjacentTo(doorStates.value, playerState.value) : null;
      if (interactPressed && !bundleDeployedThisTick && adjacentDoorId) {
        doorStates.value = doorStates.value.map((d) => (d.id === adjacentDoorId ? toggleDoor(d) : d));
      }
```

Place this block so it does not also consume the same `interactPressed` in a way that double-triggers the chest block above — since `chestPlayerIsStandingOn` and `doorPlayerIsAdjacentTo` test disjoint geometries (chest = overlap, door = adjacent-but-not-overlapping, because a closed door is solid and the player physically cannot overlap it), a single tick can satisfy at most one of the two in practice; no additional guard is needed beyond the existing `!bundleDeployedThisTick`.

- [ ] **Step 4: Wire the render call**

Find where `drawChests`/`drawDeployableLadders` are called in the render pass and add, in the same area:

```ts
      drawDoors(ctx, doorStates.value, doorSheetRef.current, originX, originY);
```

Add a `doorSheetRef` following the exact `ropeLadderRef`/`loadImage(ROPE_LADDER_SHEET.src)` pattern from O-011 (Task 10 of this plan didn't register a new sheet for doors — doors reuse `STATIC_OBJECTS_SHEET`, which this file should already be loading for the other static-objects decorations; if it is, reuse that existing loaded image ref directly instead of creating a new one).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/PlatformerPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/PlatformerPage.tsx src/themes/platformer/PlatformerPage.test.tsx
git commit -m "feat(O-029): wire the interact key to toggle an adjacent door, and render doors"
```

---

## Task 16: Manual Browser Verification

**Files:** none (verification only — constitution requires a manual browser check for changes with visible behavior).

- [ ] **Step 1: Start the dev server and open the level editor**

Paint a small test level: a run of `W` tiles, a filled region of the `w` background material, and a `dD` door pair blocking a corridor with a patrolling enemy marker beyond it.

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
- **Task 15's exact `interactPressed` block ordering** depends on precisely which existing blocks precede it in the current `PlatformerPage.tsx` tick — re-read that function's current state before inserting, since O-011/S-007 code may have shifted since this plan was written.
