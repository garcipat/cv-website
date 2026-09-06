# Blueprint Rooms — Step 44c **Part 2** (Placement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **This plan is PART 2 OF TWO, and it is the last piece of step 44c.** Part 1
> (`2026-09-06-blueprint-rooms-step44c-part1-plan.md`) landed real persistence: saved
> blueprint files, `blueprintRegistry.ts`'s `BLUEPRINTS`/`findBlueprint`, the dev-server
> write endpoint and the `isDevEnvironmentSignal` gate. Part 2 spends that: the Palette's
> Blueprints section, arming a blueprint for placement, the two-click preview with its
> blue/red border, the overlap-only fit rule, and the commit that stamps a room into the
> level grid.
>
> **Scope check — this does not need a third split.** Part 1's Appendix A scoped Part 2 as
> one self-contained piece and that holds up against the current code: three small pure
> modules (parse, fit, commit), one persisted signal, one Palette section, two optional
> `EditorCanvas` props, and the page wiring that joins them. Nothing here mirrors an
> existing subsystem the way Part 1 did, and nothing here is independently shippable on its
> own — a fit rule with no way to arm a blueprint, or an arming mechanism with no commit,
> would be dead code at the end of a plan. Ten tasks, each 2–5 minutes.

**Goal:** A saved blueprint appears as a tile in the Level Editor's Palette. Clicking it
arms it. The first click on the level canvas previews the whole room anchored at that cell
— tinted, with a bounding-box border, blue when nothing it would write lands on occupied
terrain and red when something does. A second click on the same cell commits: every
non-`.` cell of the blueprint is written into the level grid through the same `growGrid`
path painting uses (so placing past the current edge grows the grid exactly as painting
there would), and the blueprint's own background placements are rebased onto the same
origin and appended to the level's. A click elsewhere re-previews there instead; a
right-click cancels and disarms.

**Architecture:** Three pure modules and one new axis of editor state. `blueprintCells.ts`
turns a blueprint's `layout` into `{ row, col, char }` cells via the existing
`importLayout`, dropping `.` (bounding-box padding, never written, never checked).
`blueprintFit.ts` is the whole validation rule: overlap only. `placeBlueprint.ts` is the
commit, and it is deliberately **not** a loop over `paintCell` — each `paintCell` may call
`growGrid`, and a leftward/upward growth renumbers every existing index, so cells written
after the first growth would land in the wrong place. It grows twice (once for the
placement's minimum corner, once for its maximum), then bulk-writes, and returns exactly
the `GrowResult` shape `onPaint` already hands the page, so the page's existing
`applyGrowthShift` bookkeeping is reused verbatim. Arming is a **second, orthogonal piece
of state** (`editorArmedBlueprintIdSignal`), not a `TileChar`: the Palette's tool model is
`TileChar`-keyed with three compile-exhaustive `Record<TileChar, …>` maps and a
`LevelParser.ts` module-load collision guard, and a multi-cell object with an `id`, a
`name` and a `layout` has no character to give it. `EditorCanvas` gains one optional
`placement` prop carrying the preview, the place callback and the cancel callback
together; when it is non-null, `handleMouseDown` routes to placement ahead of its
background and paint branches, so an armed blueprint can never paint a tile *and* preview.

**Tech Stack:** React 19 + TypeScript strict, Vitest + React Testing Library, Canvas 2D
rendering, `@preact/signals-react` for reactive editor state.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-06-blueprint-rooms-design.md` — its
"Step 44c — Placement" section, the "`Palette.tsx` gains a Blueprints section" bullet of
its "Step 44c — Saving and the palette library" section, and the "Why placement validation
dropped connection-point matching" note in its Goal section (settled directly with the
project owner: validation is overlap-only; connection points stay a pure
authoring/legibility aid and are never read at placement time).
`specs/S-006-platformer-theme/roadmap.md` step 44c is the one-line pointer and is ticked by
Task 10, since this plan finishes it.

Part 1's **Appendix A** is this plan's design contract. It has been re-verified line by
line against the current source (Part 1 changed `LevelEditorPage.tsx` substantially and
added `BlueprintSelect`/the registry after Appendix A was written); the four places it had
gone stale, and what changed, are listed in Self-Review Notes.

## Global Constraints

- TypeScript `strict: true`, no `any`, no `@ts-ignore` (constitution Principle I / III).
- Tests first (constitution Principle II — TDD, NON-NEGOTIABLE). New test names follow
  `{method}-{Condition}-{ExpectedResult}`, matching each target file's own house style.
  Two of the files this plan touches use prose `it('draws …')` names for their existing
  render tests (`EditorCanvas.test.tsx`, `paletteTiles.test.ts`) — additions there follow
  the neighbouring convention in that file rather than importing a foreign one.
- Named arrow function exports for components with the props interface in the same file,
  no default exports (constitution Principle III). Pure helpers are plain
  `export const`/`export function`, matching `paintCell.ts`/`growGrid.ts`.
- Relative imports (`./`, `../`) within `src/themes/platformer/`; `@/` for `src/lib`,
  `src/components`.
- No new dependencies. No new shadcn/ui components.
- Vitest runs with `globals: true` (confirmed in `vitest.config.ts`) but the files here are
  **not uniform** about importing helpers — match each file as it stands today:
  - `editorLevelState.test.ts` imports **none** of `describe`/`it`/`expect`/`afterEach`.
  - `growGrid.test.ts`, `paintCell.test.ts`, `paletteTiles.test.ts` import
    `describe`/`it`/`expect` (no `vi`).
  - `Palette.test.tsx`, `EditorCanvas.test.tsx`, `LevelEditorPage.test.tsx` import
    `describe`/`it`/`expect`/`vi` explicitly.
- **`paintCell.ts`, `growGrid.ts`, `importLayout.ts`, `exportLayout.ts`,
  `cropLevelForExport.ts`, `LevelParser.ts`, `LevelData.ts`, `Terrain.ts`,
  `BlueprintData.ts`, `blueprintRegistry.ts`, `BlueprintSelect.tsx`, `saveBlueprintFile.ts`
  and everything under `vite/` are NOT modified by this plan.** Placement reuses them
  exactly as they are — verified against the real files (see Self-Review Notes). If a task
  appears to need one of them changed, stop: something has drifted from this design.
- **No new `TileChar`, and no character is reserved.** A blueprint is armed through its own
  state, not through the tool character (Task 4). `LevelParser.ts`'s import-time collision
  guard is therefore untouched.
- **Placement targets the level grid only.** The Palette's Blueprints section is hidden
  while the blueprint canvas is active, which is what keeps "nesting" (a blueprint
  containing a blueprint) out of scope for free, per the design's Out of scope list.
- **Connection points are stamped as ordinary `'+'` cells.** They are not stripped or
  converted on placement — the design says every non-`.` cell is written and that a placed
  `'+'` counts as occupied for any later overlap check. The roadmap's postponed "dedicated
  control/marker layer" idea is the place that question gets revisited; nothing in this
  plan pre-empts it.
- **Known pre-existing failures, out of scope — re-measured on this branch while writing
  this plan.** `npx tsc -b --noEmit` reports exactly **8** errors, all the same
  `BlockKind`/`potionPot` desync (`editor/gridRenderState.ts:140`,
  `entities/blocks/PotionPot.test.ts:31`, `level/BlockMapper.ts:213`,
  `PlatformerPage.test.tsx:167`, `PlatformerState.test.ts:497` and `:520`,
  `PlatformerState.ts:575` and `:576`). `npm run lint` reports exactly **1** error,
  `react-hooks/set-state-in-effect` at
  `src/themes/platformer/components/ControlsOverlay.tsx:125`. (Part 1's plan said 9 tsc
  errors; that counted a continuation line of the first error's multi-line message. The
  real count of `error TS` lines is 8.) They pre-date this work and **fixing them is not
  part of it**. Record both baselines at Step 0 and compare at Task 10 — the bar is "no NEW
  error", not "zero errors".
- **`src/themes/platformer/level/blueprints/` is a working folder, so no test may depend on
  what is in it.** As of this plan it holds only `.gitkeep` (verified), which is why the
  suite is green today — but it is exactly where Task 10's own manual check tells you to
  save a blueprint, and any saved file is untracked, present locally and absent in CI. So
  **any test that renders a component reading the registry must mock
  `../level/blueprintRegistry`** rather than rely on the folder being empty.
  `LevelEditorPage.test.tsx` and `BlueprintSelect.test.tsx` already do; `Palette.test.tsx`
  does not yet and gains the mock in Task 5. This is not optional tidiness — Task 5 makes
  `Palette.test.tsx`'s pre-existing button-count test (`screen.getAllByRole('button')`
  counted across the WHOLE palette, `Palette.test.tsx:28`) count one extra button per saved
  blueprint, so without the mock that assertion becomes machine-dependent the moment anyone
  saves a room. `App.test.tsx` also renders the real editor unmocked, but only asserts the
  toolbar exists, so it is unaffected either way.

---

## File Structure

- **Create** `src/themes/platformer/editor/blueprintCells.ts` — `BlueprintCell`,
  `blueprintCells(layout)`.
- **Create** `src/themes/platformer/editor/blueprintCells.test.ts`
- **Create** `src/themes/platformer/editor/blueprintFit.ts` — `blueprintFits(...)`.
- **Create** `src/themes/platformer/editor/blueprintFit.test.ts`
- **Create** `src/themes/platformer/editor/placeBlueprint.ts` — `PlacementResult`,
  `placeBlueprint(...)`, `rebaseBlueprintBackground(...)`.
- **Create** `src/themes/platformer/editor/placeBlueprint.test.ts`
- **Modify** `src/themes/platformer/editor/editorLevelState.ts` —
  `editorArmedBlueprintIdSignal`.
- **Modify** `src/themes/platformer/editor/editorLevelState.test.ts`
- **Modify** `src/themes/platformer/editor/paletteTiles.ts` — `BLUEPRINT_GLYPH`.
- **Modify** `src/themes/platformer/editor/paletteTiles.test.ts`
- **Modify** `src/themes/platformer/editor/Palette.tsx` — the Blueprints section.
- **Modify** `src/themes/platformer/editor/Palette.test.tsx` — plus the registry mock.
- **Modify** `src/themes/platformer/editor/EditorCanvas.tsx` — the `placement` prop: click
  routing (Task 6) and preview rendering (Task 7).
- **Modify** `src/themes/platformer/editor/EditorCanvas.test.tsx`
- **Modify** `src/themes/platformer/editor/LevelEditorPage.tsx` — arming and mutual
  exclusion (Task 8), preview and commit (Task 9).
- **Modify** `src/themes/platformer/editor/LevelEditorPage.test.tsx`
- **Modify** `specs/S-006-platformer-theme/roadmap.md` — tick 44c (Task 10 only).

Not modified: everything listed in Global Constraints above, plus `PaletteTile.tsx`
(placement reuses it as-is: `sprite={null}` + `glyph` is exactly the sprite-less-tool path
the Eraser, Patrol Boundary and Connection Point already take).

- [ ] **Step 0: Record the pre-existing failure baseline**

```bash
npx tsc -b --noEmit ; npm run lint
```

Save both outputs somewhere you can diff against at Task 10. Expected today: 8
`BlockKind`/`potionPot` type errors and one lint error in
`src/themes/platformer/components/ControlsOverlay.tsx`. Those are the baseline, not your
problem (see Global Constraints).

---

### Task 1: `blueprintCells` — a blueprint's layout as absolute-relative cells

**Files:**
- Create: `src/themes/platformer/editor/blueprintCells.ts`
- Create: `src/themes/platformer/editor/blueprintCells.test.ts`

**Interfaces:**
- Consumes: `importLayout` (`./importLayout`), `TileChar` (`../level/LevelParser`).
- Produces: `BlueprintCell`, `blueprintCells(layout)`.
- Consumed by: Task 2 (`blueprintFit`), Task 3 (`placeBlueprint`), Task 9
  (`LevelEditorPage`).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/editor/blueprintCells.test.ts
import { describe, it, expect } from 'vitest';
import { blueprintCells } from './blueprintCells';

describe('blueprintCells', () => {
  it('nonEmptyCells-areReturnedWithTheirRowColAndCharacter', () => {
    expect(blueprintCells(['#.', '.G'])).toEqual([
      { row: 0, col: 0, char: '#' },
      { row: 1, col: 1, char: 'G' },
    ]);
  });

  it('emptyCells-areDroppedBecauseTheyAreBoundingBoxPaddingNotContent', () => {
    // A blueprint's '.' cells are the crop's padding around its shape, never
    // "erase this spot" — placing a room must not blank out terrain the target
    // level already had there (design, Step 44c — Placement).
    expect(blueprintCells(['..', '..'])).toEqual([]);
  });

  it('cells-areReturnedInRowMajorOrder', () => {
    expect(blueprintCells(['##', '##']).map(({ row, col }) => `${row},${col}`)).toEqual([
      '0,0',
      '0,1',
      '1,0',
      '1,1',
    ]);
  });

  it('jaggedLayout-isRightPaddedLikeImportLayout-soAShortRowAddsNoCells', () => {
    // exportLayout can produce jagged rows; importLayout right-pads them with
    // '.', which this reuses rather than re-implementing — so the padded cell
    // at (1,1) is padding and contributes nothing.
    expect(blueprintCells(['##', '#'])).toEqual([
      { row: 0, col: 0, char: '#' },
      { row: 0, col: 1, char: '#' },
      { row: 1, col: 0, char: '#' },
    ]);
  });

  it('connectionPointCells-areReturnedLikeAnyOtherCharacter', () => {
    // Placement never treats '+' specially: it is written and it counts as
    // occupied, and nothing reads a facing off it (design, Goal section).
    expect(blueprintCells(['+'])).toEqual([{ row: 0, col: 0, char: '+' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/blueprintCells.test.ts`
Expected: FAIL — `Cannot find module './blueprintCells'`. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the implementation**

```typescript
// src/themes/platformer/editor/blueprintCells.ts
import { importLayout } from './importLayout';
import type { TileChar } from '../level/LevelParser';

/** One cell of a blueprint, positioned relative to the blueprint's own
 *  top-left corner — the anchor a placement adds to (see `placeBlueprint`). */
export interface BlueprintCell {
  row: number;
  col: number;
  char: TileChar;
}

const EMPTY_CHAR: TileChar = '.';

/**
 * Every cell of a blueprint's `layout` that actually holds something, parsed
 * through the same `importLayout` the editor already uses for a level (so a
 * jagged layout is right-padded with `'.'` exactly as `parseLevel` would pad
 * it, and this is well defined for anything `exportLayout` can produce).
 *
 * `'.'` cells are dropped rather than returned as "empty": they are the crop's
 * bounding-box padding around the room's shape, not an instruction to clear a
 * cell. They are therefore never checked for overlap (`blueprintFit.ts`) and
 * never written (`placeBlueprint.ts`), which is what makes placing a room
 * incapable of blanking out terrain the target level already had there.
 */
export const blueprintCells = (layout: readonly string[]): readonly BlueprintCell[] => {
  const grid = importLayout(layout);
  const cells: BlueprintCell[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const char = grid[row][col];
      if (char !== EMPTY_CHAR) cells.push({ row, col, char });
    }
  }
  return cells;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/blueprintCells.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/blueprintCells.ts src/themes/platformer/editor/blueprintCells.test.ts
git commit -m "feat(platformer): parse a blueprint layout into placeable cells"
```

---

### Task 2: `blueprintFit` — the whole validation rule, overlap only

**Files:**
- Create: `src/themes/platformer/editor/blueprintFit.ts`
- Create: `src/themes/platformer/editor/blueprintFit.test.ts`

**Interfaces:**
- Consumes: `BlueprintCell` (Task 1), `TileChar` (`../level/LevelParser`).
- Produces: `blueprintFits(grid, cells, anchorCol, anchorRow)`.
- Consumed by: Task 9 (`LevelEditorPage`, for the preview's blue/red and as the commit's
  guard).

**Why the rule is this small.** The design's original connection-point-matching rule was
dropped after a real flaw surfaced (raised to and settled with the project owner, design
doc updated): once a blueprint is stamped into a level, a `'+'` in the grid has no memory
of which blueprint it came from or what that blueprint's bounds were, so a second placement
validated against an already-placed one had no sound way to recover its facing. Overlap
only, with connection points counting as occupied like any other non-`.` cell and never
treated specially beyond that.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/editor/blueprintFit.test.ts
import { describe, it, expect } from 'vitest';
import { blueprintFits } from './blueprintFit';
import { blueprintCells } from './blueprintCells';
import type { TileChar } from '../level/LevelParser';

const EMPTY_3X3: TileChar[][] = [
  ['.', '.', '.'],
  ['.', '.', '.'],
  ['.', '.', '.'],
];

// Inferred as `readonly BlueprintCell[]` — no annotation, so this file never
// has to name a type it does not otherwise import.
const WALL = blueprintCells(['##']);

describe('blueprintFits', () => {
  it('everyTargetCellEmpty-fits', () => {
    expect(blueprintFits(EMPTY_3X3, WALL, 1, 1)).toBe(true);
  });

  it('aTargetCellHoldingTerrain-doesNotFit', () => {
    const grid: TileChar[][] = [
      ['.', '.', 'G'],
      ['.', '.', '.'],
      ['.', '.', '.'],
    ];

    // Anchored at (col 1, row 0) the two wall cells land on (0,1) and (0,2);
    // (0,2) already holds 'G'.
    expect(blueprintFits(grid, WALL, 1, 0)).toBe(false);
  });

  it('targetCellsEntirelyOutOfBounds-fitBecauseGrowthIsFree', () => {
    // Out of bounds is not a collision: committing grows the grid there,
    // exactly as painting there would (design, Step 44c — Placement).
    expect(blueprintFits(EMPTY_3X3, WALL, -5, -5)).toBe(true);
  });

  it('partlyOutOfBoundsWithTheInBoundsPartEmpty-fits', () => {
    // Anchored at (col -1, row 0): (0,-1) is out of bounds, (0,0) is empty.
    expect(blueprintFits(EMPTY_3X3, WALL, -1, 0)).toBe(true);
  });

  it('partlyOutOfBoundsWithTheInBoundsPartOccupied-doesNotFit', () => {
    const grid: TileChar[][] = [
      ['G', '.', '.'],
      ['.', '.', '.'],
      ['.', '.', '.'],
    ];

    expect(blueprintFits(grid, WALL, -1, 0)).toBe(false);
  });

  it('theBlueprintsOwnEmptyCells-areNeverChecked', () => {
    // The blueprint's (0,0) is '.', so the 'G' underneath it is irrelevant —
    // padding is not an overlap.
    const grid: TileChar[][] = [
      ['G', '.'],
      ['.', '.'],
    ];

    expect(blueprintFits(grid, blueprintCells(['.#']), 0, 0)).toBe(true);
  });

  it('aConnectionPointAlreadyInTheGrid-countsAsOccupiedLikeAnyOtherCell', () => {
    // A placed '+' is ordinary occupied terrain as far as the next placement is
    // concerned; nothing gives it special treatment (design, Goal section).
    expect(blueprintFits([['+']], blueprintCells(['#']), 0, 0)).toBe(false);
  });

  it('aBlueprintsOwnConnectionPoint-stillNeedsAnEmptyTargetCell', () => {
    expect(blueprintFits([['G']], blueprintCells(['+']), 0, 0)).toBe(false);
    expect(blueprintFits([['.']], blueprintCells(['+']), 0, 0)).toBe(true);
  });

  it('aBlueprintWithNoCellsAtAll-fitsAnywhere', () => {
    expect(blueprintFits([['G']], blueprintCells(['..']), 0, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/blueprintFit.test.ts`
Expected: FAIL — `Cannot find module './blueprintFit'`. Do not continue until you have seen
that failure output.

- [ ] **Step 3: Write the implementation**

```typescript
// src/themes/platformer/editor/blueprintFit.ts
import type { BlueprintCell } from './blueprintCells';
import type { TileChar } from '../level/LevelParser';

const EMPTY_CHAR: TileChar = '.';

/**
 * Whether a blueprint anchored so its own cell `(0,0)` lands on
 * `(anchorRow, anchorCol)` can be placed into `grid`.
 *
 * This is the ENTIRE validation rule: no cell the placement would write may
 * land on a cell the live grid already fills. Out of bounds counts as free,
 * because committing grows the grid there exactly the way painting there
 * would. There is no connection-point check, no adjacency check, no facing,
 * and no "first room" special case — see the design doc's Goal section for why
 * connection-point matching was dropped (it degenerates the moment a
 * blueprint's connection points are stamped into a level, since a placed `'+'`
 * carries no memory of its source blueprint's bounds). A
 * `blueprintConnectionPoint` cell, in the grid or in the blueprint, takes part
 * here exactly like any other non-`'.'` cell.
 *
 * `cells` are the blueprint's own `'.'`-free cells (`blueprintCells`), so its
 * padding is never checked: a room can be dropped over existing terrain that
 * only sits under the gaps in its bounding box.
 *
 * The `?.` reads `undefined` for "out of bounds" — which is sound here, and
 * only here, because every grid this ever sees is rectangular: `importLayout`
 * right-pads jagged layouts on the way in and `growGrid` builds a full
 * `newWidth × newHeight` grid on the way out, so `undefined` can only ever mean
 * "past an edge", never "a hole in a ragged row".
 */
export const blueprintFits = (
  grid: readonly TileChar[][],
  cells: readonly BlueprintCell[],
  anchorCol: number,
  anchorRow: number,
): boolean =>
  cells.every(({ row, col }) => {
    const existing = grid[anchorRow + row]?.[anchorCol + col];
    return existing === undefined || existing === EMPTY_CHAR;
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/blueprintFit.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/blueprintFit.ts src/themes/platformer/editor/blueprintFit.test.ts
git commit -m "feat(platformer): add the overlap-only blueprint placement fit rule"
```

---

### Task 3: `placeBlueprint` — two grows, then one bulk write

**Files:**
- Create: `src/themes/platformer/editor/placeBlueprint.ts`
- Create: `src/themes/platformer/editor/placeBlueprint.test.ts`

**Interfaces:**
- Consumes: `growGrid`/`GrowResult` (`./growGrid`), `BlueprintCell` (Task 1),
  `BackgroundPlacement` (`../level/LevelData`), `TileChar` (`../level/LevelParser`).
- Produces: `PlacementResult`, `placeBlueprint(grid, cells, anchorCol, anchorRow)`,
  `rebaseBlueprintBackground(background, colOffset, rowOffset)`.
- Consumed by: Task 9 (`LevelEditorPage`).

**Why not a loop over `paintCell`.** Every `paintCell` call may call `growGrid`, and a
leftward/upward growth prepends rows/columns, renumbering every existing index. Cells
written after the first such growth would land in the wrong place. Growing twice up front —
once for the placement's minimum corner, once for its maximum, in the already-grown grid's
coordinates — settles the geometry before a single character is written. The second call is
what makes a placement that extends past the right/bottom edge safe: after the first grow
those indices can still be out of bounds (Fixture C in the tests below is exactly that
case, and it index-errors without it).

`PlacementResult` is `GrowResult` — the same `{ grid, colShift, rowShift }` shape
`paintCell` returns and `LevelEditorPage`'s `onPaint` already consumes — so the page's
`applyGrowthShift` (which cancels the growth out of the pan and shifts every existing
background placement) is reused unchanged.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/editor/placeBlueprint.test.ts
import { describe, it, expect } from 'vitest';
import { placeBlueprint, rebaseBlueprintBackground } from './placeBlueprint';
import { blueprintCells } from './blueprintCells';
import type { TileChar } from '../level/LevelParser';

const EMPTY_3X3: TileChar[][] = [
  ['.', '.', '.'],
  ['.', '.', '.'],
  ['.', '.', '.'],
];

describe('placeBlueprint — fully in bounds', () => {
  // Fixture A: a 3x3 grid, the blueprint ['##','#.'] anchored at (col 1, row 1).
  // Its cells are (0,0), (0,1) and (1,0) — (1,1) is '.' and is not a cell.
  // Absolute targets are (1,1), (1,2) and (2,1), all inside 3x3, so both
  // growGrid calls are no-ops and both shifts are 0.
  const cells = blueprintCells(['##', '#.']);

  it('everyCellInBounds-writesThemAtTheAnchorWithNoShift', () => {
    const result = placeBlueprint(EMPTY_3X3, cells, 1, 1);

    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(0);
    expect(result.grid).toEqual([
      ['.', '.', '.'],
      ['.', '#', '#'],
      ['.', '#', '.'],
    ]);
  });

  it('theBlueprintsOwnEmptyCells-areNotWritten', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.'],
      ['.', '.', '.'],
      ['.', '.', 'G'],
    ];

    // The blueprint's (1,1) is '.', which lands on the 'G' at (2,2) — placing
    // must leave it exactly where it is.
    expect(placeBlueprint(grid, cells, 1, 1).grid[2][2]).toBe('G');
  });

  it('doesNotMutateTheGridItWasGiven', () => {
    const grid: TileChar[][] = [
      ['.', '.', '.'],
      ['.', '.', '.'],
      ['.', '.', '.'],
    ];

    placeBlueprint(grid, cells, 1, 1);

    expect(grid).toEqual(EMPTY_3X3);
  });
});

describe('placeBlueprint — growing left and up', () => {
  // Fixture B: a 1x1 grid holding 'G', the blueprint ['##'] anchored at
  // (col -1, row -1). Absolute cols -1..0, row -1.
  //   growGrid(grid, -1, -1) -> growLeft 1, growTop 1, growRight 0, growBottom 0
  //     -> a 2-wide x 2-high grid, colShift 1, rowShift 1.
  //   growGrid(that, maxCol + 1 = 0 + 1 = 1, maxRow + 1 = -1 + 1 = 0) -> both in
  //     bounds -> unchanged, shifts 0. Totals stay (1, 1).
  //   cell (0,0) -> (0 + -1 + 1, 0 + -1 + 1) = (0,0)
  //   cell (0,1) -> (0 + -1 + 1, 1 + -1 + 1) = (0,1)
  const cells = blueprintCells(['##']);

  it('anchoredPastTheTopLeftCorner-growsAndReportsBothShifts', () => {
    const result = placeBlueprint([['G']], cells, -1, -1);

    expect(result.colShift).toBe(1);
    expect(result.rowShift).toBe(1);
    expect(result.grid).toEqual([
      ['#', '#'],
      ['.', 'G'],
    ]);
  });
});

describe('placeBlueprint — growing right and down', () => {
  // Fixture C: a 1x1 grid holding 'G', the blueprint ['##'] anchored at
  // (col 1, row 1). Absolute row 1, cols 1..2.
  //   growGrid(grid, minCol 1, minRow 1) -> growRight 1-1+1 = 1,
  //     growBottom 1-1+1 = 1 -> 2 wide x 2 high, shifts 0.
  //   growGrid(that, maxCol + 0 = 2, maxRow + 0 = 1) -> width is 2, so
  //     growRight 2-2+1 = 1 -> 3 wide x 2 high, shifts 0.
  //   This second grow is the whole point: without it, column 2 is out of
  //   bounds and the bulk write index-errors.
  const cells = blueprintCells(['##']);

  it('anchoredPastTheBottomRightCorner-growsFarEnoughForTheWholeRoom', () => {
    const result = placeBlueprint([['G']], cells, 1, 1);

    expect(result.colShift).toBe(0);
    expect(result.rowShift).toBe(0);
    expect(result.grid).toEqual([
      ['G', '.', '.'],
      ['.', '#', '#'],
    ]);
  });
});

describe('placeBlueprint — characters', () => {
  it('connectionPointCells-areStampedAsOrdinaryCellsNotStripped', () => {
    // Design: every non-'.' cell is written, '+' included; a placed connection
    // point simply becomes ordinary occupied terrain.
    expect(placeBlueprint([['.']], blueprintCells(['+']), 0, 0).grid).toEqual([['+']]);
  });

  it('aBlueprintWithNoCells-leavesTheGridExactlyAsItWas', () => {
    const grid: TileChar[][] = [['G']];

    const result = placeBlueprint(grid, blueprintCells(['..']), 5, 5);

    expect(result).toEqual({ grid, colShift: 0, rowShift: 0 });
  });
});

describe('rebaseBlueprintBackground', () => {
  it('shiftsEveryPlacementOntoTheGivenOrigin', () => {
    expect(
      rebaseBlueprintBackground([{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }], 3, 2),
    ).toEqual([{ pieceId: 'dirtColumnTop1x1', col: 3, row: 2 }]);
  });

  it('keepsEveryOtherFieldOfThePlacement', () => {
    expect(
      rebaseBlueprintBackground([{ pieceId: 'dirtColumnTop1x1', col: 1, row: 1 }], -1, -1),
    ).toEqual([{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }]);
  });

  it('emptyBackground-staysEmpty', () => {
    expect(rebaseBlueprintBackground([], 3, 2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/placeBlueprint.test.ts`
Expected: FAIL — `Cannot find module './placeBlueprint'`. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the implementation**

```typescript
// src/themes/platformer/editor/placeBlueprint.ts
import { growGrid, type GrowResult } from './growGrid';
import type { BlueprintCell } from './blueprintCells';
import type { BackgroundPlacement } from '../level/LevelData';
import type { TileChar } from '../level/LevelParser';

/** Same shape `paintCell` returns, deliberately: a placement is just a bigger
 *  paint as far as `LevelEditorPage` is concerned, so it flows through the same
 *  grow/shift bookkeeping (`applyGrowthShift`) a single painted cell does. */
export type PlacementResult = GrowResult;

/**
 * Stamps a blueprint's `cells` into `grid`, anchored so the blueprint's own
 * cell `(0,0)` lands on `(anchorRow, anchorCol)`.
 *
 * Two grows, then one bulk write — NOT a loop over `paintCell`. Each
 * `paintCell` may grow the grid, and a leftward/upward growth prepends
 * rows/columns and renumbers every existing index, so cells written after the
 * first growth would land in the wrong place. Growing once for the placement's
 * minimum corner and once for its maximum (in the already-grown grid's own
 * coordinates) settles the geometry before anything is written. The second call
 * is not redundant: after the first, a placement extending past the right or
 * bottom edge is still out of bounds.
 *
 * The caller checks `blueprintFits` first — this function trusts its anchor and
 * overwrites whatever is there, exactly the way `paintCell` does.
 */
export const placeBlueprint = (
  grid: TileChar[][],
  cells: readonly BlueprintCell[],
  anchorCol: number,
  anchorRow: number,
): PlacementResult => {
  if (cells.length === 0) return { grid, colShift: 0, rowShift: 0 };

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const { row, col } of cells) {
    const absoluteCol = anchorCol + col;
    const absoluteRow = anchorRow + row;
    if (absoluteCol < minCol) minCol = absoluteCol;
    if (absoluteRow < minRow) minRow = absoluteRow;
    if (absoluteCol > maxCol) maxCol = absoluteCol;
    if (absoluteRow > maxRow) maxRow = absoluteRow;
  }

  const first = growGrid(grid, minCol, minRow);
  const second = growGrid(first.grid, maxCol + first.colShift, maxRow + first.rowShift);
  const colShift = first.colShift + second.colShift;
  const rowShift = first.rowShift + second.rowShift;

  const nextGrid = second.grid.map((row) => [...row]);
  for (const { row, col, char } of cells) {
    nextGrid[anchorRow + row + rowShift][anchorCol + col + colShift] = char;
  }

  return { grid: nextGrid, colShift, rowShift };
};

/**
 * A blueprint's own `background` placements moved onto the origin its
 * foreground cells were just written at — the mirror of the rebase
 * `cropLevelForExport` applies when the blueprint is saved.
 *
 * Appended to the target level's background list unconditionally, with no
 * overlap check: background placements already silently replace on overlap,
 * matching how painting the background layer works today (design, Step 44c —
 * Placement).
 */
export const rebaseBlueprintBackground = (
  background: readonly BackgroundPlacement[],
  colOffset: number,
  rowOffset: number,
): BackgroundPlacement[] =>
  background.map((placement) => ({
    ...placement,
    col: placement.col + colOffset,
    row: placement.row + rowOffset,
  }));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/placeBlueprint.test.ts`
Expected: PASS (10 tests — 3 in-bounds, 1 grow-left/up, 1 grow-right/down, 2 characters,
3 `rebaseBlueprintBackground`).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/placeBlueprint.ts src/themes/platformer/editor/placeBlueprint.test.ts
git commit -m "feat(platformer): stamp a blueprint into a level grid, growing it as needed"
```

---

### Task 4: `editorArmedBlueprintIdSignal` — arming as its own axis

**Files:**
- Modify: `src/themes/platformer/editor/editorLevelState.ts`
- Modify: `src/themes/platformer/editor/editorLevelState.test.ts`

**Interfaces:**
- Produces: `editorArmedBlueprintIdSignal: Signal<string | null>`, key
  `'platformer-editor-armed-blueprint'`, default `null`.
- Consumed by: Task 8 (`LevelEditorPage`).

**Why a separate signal rather than a `TileChar` or a union.** `selectedTool` is a
`TileChar` threaded through `Palette`, `EditorCanvas`, `paintCell` and ~30 existing
`EditorCanvas.test.tsx` render sites, and three `Record<TileChar, …>` maps the compiler
forces to stay exhaustive. A blueprint has an `id`, a `name` and a whole `layout` — there is
no character to give it, and inventing one would mean a `TileChar` `parseLevel` must never
see in a layout, precisely the inert marker steps 44a and 44b each went out of their way to
prevent. A union (`{ kind: 'tile' } | { kind: 'blueprint' }`) was considered and rejected:
rewriting all of that to express an invariant two setter lines can enforce is a bad trade.

Persisted like `editorSelectedToolSignal`, for the same reason: arming is a visible,
discrete Palette selection, and a reopened editor should still show what is armed. A
persisted id whose file has since been deleted degrades gracefully rather than needing a
mount-time correction — `findBlueprint` returns `undefined`, so no Palette tile shows as
pressed, no preview can be produced, and clicks paint normally (Task 8 pins this).

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/editor/editorLevelState.test.ts` (note: this file imports
none of `describe`/`it`/`expect` — it relies on `globals: true`; extend the existing import
list at the top of the file with `editorArmedBlueprintIdSignal`):

```typescript
describe('editorArmedBlueprintIdSignal', () => {
  const original = editorArmedBlueprintIdSignal.value;

  afterEach(() => {
    editorArmedBlueprintIdSignal.value = original;
  });

  it('initialValue-onModuleLoad-withNothingInLocalStorage-isNullSoNothingIsArmed', () => {
    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });

  it('writingValue-persistsToLocalStorageUnderTheExpectedKey', () => {
    editorArmedBlueprintIdSignal.value = 'cave-room';

    expect(JSON.parse(localStorage.getItem('platformer-editor-armed-blueprint')!)).toBe(
      'cave-room',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/editorLevelState.test.ts`
Expected: FAIL — `editorArmedBlueprintIdSignal` is not exported from `./editorLevelState`.
Do not continue until you have seen that failure output.

- [ ] **Step 3: Add the signal**

Append to `src/themes/platformer/editor/editorLevelState.ts`:

```typescript
/**
 * The id of the blueprint currently armed for placement, or `null` when none
 * is (roadmap step 44c). Deliberately a SECOND axis alongside
 * `editorSelectedToolSignal` rather than a value inside it: `selectedTool` is a
 * `TileChar`, and a blueprint is a multi-cell object with an id, a name and a
 * layout — there is no character to give it, and inventing one would mean a
 * `TileChar` `parseLevel` must never see in a layout.
 *
 * Mutual exclusion between the two is enforced by `LevelEditorPage`'s setters
 * (arming clears nothing, selecting a tile tool disarms), not by the type: that
 * keeps `selectedTool` available to restore the author's previous tool when
 * they disarm, instead of dumping them on a fallback.
 *
 * Persisted like the armed tool is, so reopening the editor still shows what is
 * armed. An id whose blueprint file has since been deleted simply resolves to
 * nothing through `findBlueprint`, which reads as "not armed" everywhere.
 */
export const editorArmedBlueprintIdSignal = createLocalStorageSignal<string | null>(
  'platformer-editor-armed-blueprint',
  null,
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/editorLevelState.test.ts`
Expected: PASS (the file's existing tests plus 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/editorLevelState.ts src/themes/platformer/editor/editorLevelState.test.ts
git commit -m "feat(platformer): persist which blueprint is armed for placement"
```

---

### Task 5: The Palette's Blueprints section

**Files:**
- Modify: `src/themes/platformer/editor/paletteTiles.ts`
- Modify: `src/themes/platformer/editor/paletteTiles.test.ts`
- Modify: `src/themes/platformer/editor/Palette.tsx`
- Modify: `src/themes/platformer/editor/Palette.test.tsx`

**Interfaces:**
- Consumes: `BLUEPRINTS` (`../level/blueprintRegistry`), `PaletteTile`.
- Produces: `BLUEPRINT_GLYPH`; `PaletteProps.armedBlueprintId?: string | null` and
  `PaletteProps.onArmBlueprint?: (id: string) => void`.
- Consumed by: Task 8 (`LevelEditorPage`).

**Verified against the current `Palette.tsx`.** Its `renderGroup` helper is `TileChar`-keyed
(it indexes `PALETTE_TILE_LABELS`/`_SPRITES`/`_GLYPHS`), so blueprints get their own
section rather than reusing it. `PaletteTile` already handles the sprite-less case
(`sprite={null}` renders a dashed square holding `glyph`) — exactly the path the Eraser,
Patrol Boundary and Connection Point take, so nothing about that component changes. The
section lives inside the existing `activeLayer === 'foreground'` branch, which gives
Appendix A.1's "foreground only" for free.

- [ ] **Step 1: Write the failing tests**

Add to `src/themes/platformer/editor/paletteTiles.test.ts` (extend its existing import
list with `BLUEPRINT_GLYPH`, `PATROL_GLYPH` and `CONNECTION_POINT_GLYPH` as needed):

```typescript
describe('BLUEPRINT_GLYPH', () => {
  // Prose `it(...)` name, matching every other test in this file (see the
  // `blueprint connection point marker` describe just above it) rather than
  // importing the camel-case convention from elsewhere.
  it('gives a blueprint tile its own glyph, distinct from the other sprite-less tools', () => {
    // A Blueprints tile is another empty bordered square; sharing a symbol with
    // the patrol boundary or a connection point would make the palette
    // unreadable.
    expect(BLUEPRINT_GLYPH).toBeTruthy();
    expect(BLUEPRINT_GLYPH).not.toBe(PATROL_GLYPH);
    expect(BLUEPRINT_GLYPH).not.toBe(CONNECTION_POINT_GLYPH);
  });
});
```

Then, in `src/themes/platformer/editor/Palette.test.tsx`, add the registry mock at the top
(directly after the existing imports) and a new describe block at the end:

```typescript
// The registry is a build-time glob of `level/blueprints/*.json`, and that
// folder can hold an untracked file left over from manual testing — so every
// test in this file, including the pre-existing button-count one, would
// otherwise pass or fail depending on the machine. A stable array the tests
// mutate is the same approach `BlueprintSelect.test.tsx` takes, and for the
// same reason: the component reads the module binding at render time.
const { registryEntries } = vi.hoisted(() => ({ registryEntries: [] as Blueprint[] }));

vi.mock('../level/blueprintRegistry', () => ({
  BLUEPRINTS: registryEntries,
  findBlueprint: (id: string) => registryEntries.find((entry) => entry.id === id),
}));

beforeEach(() => {
  registryEntries.length = 0;
});
```

(and extend the file's `vitest` import with `beforeEach`, plus
`import type { Blueprint } from '../level/BlueprintData';`)

```typescript
describe('Palette — blueprints section (step 44c placement)', () => {
  const CAVE: Blueprint = { id: 'cave-room', name: 'Cave Room', layout: ['##'] };

  const blueprintsSection = () => {
    const heading = screen.getByText('Blueprints');
    return heading.closest('section') ?? heading.parentElement!;
  };

  it('levelCanvasModeWithSavedBlueprints-listsOneTilePerRegistryEntry', () => {
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(
      within(blueprintsSection()).getByRole('button', { name: 'Cave Room' }),
    ).toBeInTheDocument();
  });

  it('noSavedBlueprints-rendersNoBlueprintsSectionAtAll', () => {
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(screen.queryByText('Blueprints')).not.toBeInTheDocument();
  });

  it('blueprintCanvasMode-offersNoBlueprintsSection', () => {
    // Placing a blueprint while editing another blueprint's canvas (nesting) is
    // explicitly out of scope; hiding the section is what enforces it.
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    expect(screen.queryByText('Blueprints')).not.toBeInTheDocument();
  });

  it('backgroundLayerActive-offersNoBlueprintsSection', () => {
    // Placement writes the foreground grid; the background layer's palette is a
    // different catalog entirely.
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="level" activeLayer="background" />);

    expect(screen.queryByText('Blueprints')).not.toBeInTheDocument();
  });

  it('clickingABlueprintTile-callsOnArmBlueprintWithItsId', async () => {
    registryEntries.push(CAVE);
    const onArmBlueprint = vi.fn();
    render(<Palette {...defaultProps} canvasMode="level" onArmBlueprint={onArmBlueprint} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cave Room' }));

    expect(onArmBlueprint).toHaveBeenCalledWith('cave-room');
  });

  it('theArmedBlueprint-isTheOnlyOneMarkedPressed', () => {
    registryEntries.push(CAVE, { id: 'hall', name: 'Hall', layout: ['##'] });
    render(<Palette {...defaultProps} canvasMode="level" armedBlueprintId="cave-room" />);

    expect(screen.getByRole('button', { name: 'Cave Room' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Hall' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('omittedArmedBlueprintId-marksNoBlueprintPressed', () => {
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(screen.getByRole('button', { name: 'Cave Room' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('blueprintTiles-stayOutOfTheTerrainAndToolsGroups', () => {
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="level" />);

    const terrainHeading = screen.getByText('Terrain');
    const terrain = terrainHeading.closest('section') ?? terrainHeading.parentElement!;
    const toolsHeading = screen.getByText('Tools');
    const tools = toolsHeading.closest('section') ?? toolsHeading.parentElement!;
    expect(within(terrain).queryByRole('button', { name: 'Cave Room' })).not.toBeInTheDocument();
    expect(within(tools).queryByRole('button', { name: 'Cave Room' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts src/themes/platformer/editor/Palette.test.tsx`
Expected: FAIL — `BLUEPRINT_GLYPH` is not exported, and the Blueprints section does not
render. Do not continue until you have seen that failure output.

- [ ] **Step 3: Add the glyph**

Append to `src/themes/platformer/editor/paletteTiles.ts`, next to the other two glyph
constants:

```typescript
/** The room character standing in for a saved blueprint's missing sprite in the
 *  Palette's Blueprints section (roadmap step 44c) — a room has no single tile
 *  to show. Deliberately distinct from `PATROL_GLYPH` and
 *  `CONNECTION_POINT_GLYPH`: all three render inside the same empty bordered
 *  square and would otherwise be indistinguishable. Not part of
 *  `PALETTE_TILE_GLYPHS`, which is keyed by `TileChar` — a blueprint is not a
 *  tile character (see `editorArmedBlueprintIdSignal`). */
export const BLUEPRINT_GLYPH = '▦';
```

- [ ] **Step 4: Render the section**

In `src/themes/platformer/editor/Palette.tsx`, add two imports:

```typescript
import { BLUEPRINTS } from '../level/blueprintRegistry';
```

and extend the existing `paletteTiles` import with `BLUEPRINT_GLYPH`.

Add to `PaletteProps`:

```typescript
  /** Id of the blueprint currently armed for placement, or `null`/omitted when
   *  none is (roadmap step 44c). A second axis alongside `selectedTool`, not a
   *  value inside it — see `editorArmedBlueprintIdSignal`. */
  armedBlueprintId?: string | null;
  /** Arms (or, when it is already armed, disarms) a blueprint for placement.
   *  Optional so every existing render site is unaffected. */
  onArmBlueprint?: (id: string) => void;
```

and to the destructured parameter list, after `canvasMode = 'level'`:

```typescript
  armedBlueprintId = null,
  onArmBlueprint,
```

Add, next to the other derived lists:

```typescript
  // Placement targets the level's own grid, so the section is hidden on the
  // blueprint canvas — which is what keeps nesting (a blueprint containing a
  // blueprint) out of scope for free. Nothing renders at all when no blueprint
  // has been saved yet, rather than an empty headed section.
  const showBlueprints = canvasMode === 'level' && BLUEPRINTS.length > 0;
```

and render it as the last child of the existing foreground `<div className="flex flex-col gap-3">`,
after `{renderGroup('Tools', toolKeys)}`:

```tsx
            {showBlueprints && (
              <section aria-label="Blueprints">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Blueprints</p>
                <div className="grid grid-cols-[repeat(3,max-content)] gap-2">
                  {BLUEPRINTS.map((blueprint) => (
                    <PaletteTile
                      key={blueprint.id}
                      label={blueprint.name}
                      description="Click the canvas to preview this room here, then click the same cell again to place it"
                      sprite={null}
                      glyph={BLUEPRINT_GLYPH}
                      selected={armedBlueprintId === blueprint.id}
                      onClick={() => onArmBlueprint?.(blueprint.id)}
                    />
                  ))}
                </div>
              </section>
            )}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts src/themes/platformer/editor/Palette.test.tsx`
Expected: PASS — 1 new `paletteTiles` test, 8 new `Palette` tests, and every pre-existing
test in both files unchanged (the button-count test in particular, which now runs against a
deterministically empty registry).

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/editor/paletteTiles.ts src/themes/platformer/editor/paletteTiles.test.ts src/themes/platformer/editor/Palette.tsx src/themes/platformer/editor/Palette.test.tsx
git commit -m "feat(platformer): list saved blueprints in the editor palette"
```

---

### Task 6: `EditorCanvas` routes clicks to placement when a blueprint is armed

**Files:**
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx`
- Modify: `src/themes/platformer/editor/EditorCanvas.test.tsx`

**Interfaces:**
- Produces: `PlacementPreview`, `PlacementMode`, `EditorCanvasProps.placement?: PlacementMode | null`.
- Consumed by: Task 7 (rendering), Tasks 8–9 (`LevelEditorPage`).

**One prop, not two.** Appendix A.5 named only a render-only `placementPreview` prop, but a
preview alone cannot get a click back out to the page, and a bare callback prop cannot
signal armed-ness (the page would pass a stable handler either way). One optional
`placement` object carries all three — the preview to draw, where to place, how to cancel —
and its non-null-ness *is* "a blueprint is armed". All ~30 existing render sites in
`EditorCanvas.test.tsx` keep compiling untouched because it is optional.

**Where it slots in, verified against the real `handleMouseDown`:** after the
`event.button === 1` middle-click pan branch (which must keep winning, so panning to line a
room up still works) and before both the `activeLayer === 'background'` branch and the
right-click-erases paint branch. `dragRef` is deliberately never set, so a placement click
starts no drag and `handleMouseMove` does nothing.

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/editor/EditorCanvas.test.tsx`:

```typescript
describe('EditorCanvas — placement clicks (step 44c)', () => {
  const placementProps = (overrides: Partial<Parameters<typeof EditorCanvas>[0]> = {}) => ({
    ...BACKGROUND_LAYER_DEFAULT_PROPS,
    grid: [['.', '.'], ['.', '.']] as TileChar[][],
    selectedTool: 'G' as TileChar,
    panOffset: { x: 0, y: 0 },
    images: EMPTY_IMAGES,
    onPaint: vi.fn(),
    onPan: vi.fn(),
    ...overrides,
  });

  const clickCanvas = (
    canvas: HTMLCanvasElement,
    col: number,
    row: number,
    button = 0,
  ) => {
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, {
      button,
      clientX: col * RENDERED_TILE_SIZE + 1,
      clientY: row * RENDERED_TILE_SIZE + 1,
    });
  };

  it('blueprintArmed-leftClick-reportsTheClickedCellInsteadOfPainting', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const onPlace = vi.fn();
    const { container } = render(
      <EditorCanvas
        {...placementProps({ onPaint })}
        placement={{ preview: null, onPlace, onCancel: vi.fn() }}
      />,
    );

    clickCanvas(container.querySelector('canvas')!, 1, 1);

    expect(onPlace).toHaveBeenCalledWith({ col: 1, row: 1 });
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('blueprintArmed-rightClick-cancelsInsteadOfErasing', () => {
    // Right-click has no erase meaning during a placement preview — nothing is
    // being painted — so it is repurposed as an immediate cancel, saving a trip
    // back to the palette (design, Step 44c — Placement).
    stubCanvasContext();
    const onPaint = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <EditorCanvas
        {...placementProps({ onPaint })}
        placement={{ preview: null, onPlace: vi.fn(), onCancel }}
      />,
    );

    clickCanvas(container.querySelector('canvas')!, 1, 1, 2);

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onPaint).not.toHaveBeenCalled();
  });

  it('blueprintArmed-middleClick-stillPansSoARoomCanBeLinedUp', () => {
    stubCanvasContext();
    const onPan = vi.fn();
    const onPlace = vi.fn();
    const { container } = render(
      <EditorCanvas
        {...placementProps({ onPan })}
        placement={{ preview: null, onPlace, onCancel: vi.fn() }}
      />,
    );
    const canvas = container.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);

    fireEvent.mouseDown(canvas, { button: 1, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 0 });

    expect(onPan).toHaveBeenCalledWith({ x: 40, y: 0 });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it('blueprintArmed-draggingAfterAPlacementClick-paintsNothing', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const { container } = render(
      <EditorCanvas
        {...placementProps({ onPaint })}
        placement={{ preview: null, onPlace: vi.fn(), onCancel: vi.fn() }}
      />,
    );
    const canvas = container.querySelector('canvas')!;

    clickCanvas(canvas, 0, 0);
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 40 });

    expect(onPaint).not.toHaveBeenCalled();
  });

  it('noPlacementProp-leftClickStillPaintsExactlyAsBefore', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const { container } = render(<EditorCanvas {...placementProps({ onPaint })} />);

    clickCanvas(container.querySelector('canvas')!, 1, 1);

    expect(onPaint).toHaveBeenCalledOnce();
  });

  it('placementPropExplicitlyNull-leftClickStillPaints', () => {
    stubCanvasContext();
    const onPaint = vi.fn();
    const { container } = render(
      <EditorCanvas {...placementProps({ onPaint })} placement={null} />,
    );

    clickCanvas(container.querySelector('canvas')!, 1, 1);

    expect(onPaint).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: FAIL — `placement` is not a known prop of `EditorCanvas`, and the armed clicks
still paint. Do not continue until you have seen that failure output.

- [ ] **Step 3: Add the prop and the click routing**

In `src/themes/platformer/editor/EditorCanvas.tsx`, add above `EditorCanvasProps`:

```typescript
/** The cells a pending placement would write, in absolute grid coordinates,
 *  and whether it currently fits (`blueprintFit.ts`) — blue when it does, red
 *  when it does not. */
export interface PlacementPreview {
  cells: readonly { row: number; col: number }[];
  valid: boolean;
}

/** Everything the canvas needs while a blueprint is armed for placement
 *  (roadmap step 44c). Its non-null-ness IS "a blueprint is armed": while it is
 *  set, clicks preview/place/cancel instead of painting. */
export interface PlacementMode {
  /** `null` until the first click has chosen an anchor. */
  preview: PlacementPreview | null;
  onPlace: (cell: { col: number; row: number }) => void;
  onCancel: () => void;
}
```

Add to `EditorCanvasProps`, after `selectedBackgroundPiece`:

```typescript
  /** Set while a blueprint is armed for placement; omitted/`null` otherwise, so
   *  every existing render site is unaffected. */
  placement?: PlacementMode | null;
```

Add `placement = null,` to the destructured parameter list (after
`selectedBackgroundPiece,`).

Insert into `handleMouseDown`, immediately after the `event.button === 1` block returns:

```typescript
    // An armed blueprint owns every remaining button, checked BEFORE the
    // background and paint branches so it can never paint a tile and preview at
    // the same time. Right-click cancels rather than erases: nothing is being
    // painted during a preview, so there is nothing to erase (design, Step 44c
    // — Placement). No `dragRef` is set, so a placement click starts no drag.
    if (placement) {
      if (event.button === 2) {
        placement.onCancel();
        return;
      }
      if (event.button !== 0) return;
      placement.onPlace(cellFromEvent(event.clientX, event.clientY));
      return;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: PASS — 6 new tests plus every pre-existing test in the file, unedited.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/EditorCanvas.tsx src/themes/platformer/editor/EditorCanvas.test.tsx
git commit -m "feat(platformer): route editor canvas clicks to placement while a blueprint is armed"
```

---

### Task 7: `EditorCanvas` draws the blue/red placement preview

**Files:**
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx`
- Modify: `src/themes/platformer/editor/EditorCanvas.test.tsx`

**Interfaces:**
- Produces: `PLACEMENT_VALID_COLOR`, `PLACEMENT_INVALID_COLOR` (exported so the tests can
  name them rather than duplicate hex strings).

**Two things to get right.** First, the preview is drawn **last**, after the
`ctx.restore()` that closes the foreground-alpha block — so it is never dimmed while the
background layer is active, and so it sits on top of everything. Second, it is a *tinted
area with a bounding-box border*, not a per-cell marker: 44b's connection point already
tints single cells blue (`rgba(96, 168, 255, 0.4)`), and a per-cell blue outline would read
as another one of those. A saturated stroke around the whole room is unmistakably a
different thing.

`stubCanvasContext` in the test file has no `strokeRect` — it must gain one, or the first
preview render throws.

- [ ] **Step 1: Write the failing tests**

In `src/themes/platformer/editor/EditorCanvas.test.tsx`, add `strokeRect: vi.fn(),` to the
object inside `stubCanvasContext`, extend the `./EditorCanvas` import with
`PLACEMENT_VALID_COLOR` and `PLACEMENT_INVALID_COLOR`, and append:

```typescript
describe('EditorCanvas — placement preview (step 44c)', () => {
  const previewProps = (preview: { cells: { row: number; col: number }[]; valid: boolean }) => ({
    ...BACKGROUND_LAYER_DEFAULT_PROPS,
    grid: [['.', '.'], ['.', '.']] as TileChar[][],
    selectedTool: 'G' as TileChar,
    images: EMPTY_IMAGES,
    onPaint: () => {},
    onPan: () => {},
    placement: { preview, onPlace: () => {}, onCancel: () => {} },
  });

  it('tints every previewed cell and strokes one border around the whole room', () => {
    const ctx = stubCanvasContext() as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
      strokeRect: ReturnType<typeof vi.fn>;
    };

    render(
      <EditorCanvas
        {...previewProps({
          cells: [
            { row: 0, col: 0 },
            { row: 1, col: 1 },
          ],
          valid: true,
        })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    expect(ctx.fillRect).toHaveBeenCalledWith(
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
    // One border around the 2x2 bounding box the two cells span — not one per
    // cell, which would read as another 44b-style cell marker.
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1);
    expect(ctx.strokeRect).toHaveBeenCalledWith(
      0,
      0,
      2 * RENDERED_TILE_SIZE,
      2 * RENDERED_TILE_SIZE,
    );
  });

  it('offsets the preview by the pan offset, like every other drawn layer', () => {
    const ctx = stubCanvasContext() as unknown as { strokeRect: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...previewProps({ cells: [{ row: 0, col: 0 }], valid: true })}
        panOffset={{ x: 100, y: 40 }}
      />,
    );

    expect(ctx.strokeRect).toHaveBeenCalledWith(100, 40, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  });

  it('handles a preview anchored at negative coordinates, where growth would happen', () => {
    const ctx = stubCanvasContext() as unknown as { strokeRect: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...previewProps({ cells: [{ row: -1, col: -1 }], valid: true })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );

    expect(ctx.strokeRect).toHaveBeenCalledWith(
      -RENDERED_TILE_SIZE,
      -RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  });

  it('borders a valid placement in blue and an invalid one in red', () => {
    // The preview is the LAST thing the draw effect does and the stubbed
    // save/restore are no-ops, so the context's strokeStyle still holds the
    // colour the preview chose.
    const validCtx = stubCanvasContext();
    render(
      <EditorCanvas
        {...previewProps({ cells: [{ row: 0, col: 0 }], valid: true })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );
    expect(validCtx.strokeStyle).toBe(PLACEMENT_VALID_COLOR);

    cleanup();

    const invalidCtx = stubCanvasContext();
    render(
      <EditorCanvas
        {...previewProps({ cells: [{ row: 0, col: 0 }], valid: false })}
        panOffset={{ x: 0, y: 0 }}
      />,
    );
    expect(invalidCtx.strokeStyle).toBe(PLACEMENT_INVALID_COLOR);
    expect(PLACEMENT_INVALID_COLOR).not.toBe(PLACEMENT_VALID_COLOR);
  });

  it('draws nothing extra while a blueprint is armed but no anchor has been clicked yet', () => {
    const ctx = stubCanvasContext() as unknown as { strokeRect: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['.']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
        placement={{ preview: null, onPlace: () => {}, onCancel: () => {} }}
      />,
    );

    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });
});
```

(extend the `@testing-library/react` import with `cleanup`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: FAIL — `PLACEMENT_VALID_COLOR` is not exported and `strokeRect` is never called.
Do not continue until you have seen that failure output.

- [ ] **Step 3: Draw the preview**

In `src/themes/platformer/editor/EditorCanvas.tsx`, add below the marker constants:

```typescript
/** Border colour of a placement preview that fits — a saturated stroke around
 *  the whole room, deliberately NOT the pale per-cell blue 44b tints a
 *  connection point with, so the two never read as the same thing. */
export const PLACEMENT_VALID_COLOR = '#1d4ed8';
/** Border colour of a placement that would overlap existing terrain. */
export const PLACEMENT_INVALID_COLOR = '#b91c1c';
const PLACEMENT_VALID_FILL = 'rgba(29, 78, 216, 0.28)';
const PLACEMENT_INVALID_FILL = 'rgba(185, 28, 28, 0.28)';
const PLACEMENT_BORDER_WIDTH = 3;

/**
 * The pending placement: every cell the blueprint would write, tinted, plus one
 * border around their bounding box — blue when the placement fits, red when it
 * overlaps something (`blueprintFit.ts`). One border rather than a per-cell
 * outline is deliberate: a per-cell blue would be indistinguishable from 44b's
 * connection-point tint at a glance.
 *
 * Coordinates are absolute grid cells and may be negative — a room anchored
 * past the grid's top-left corner previews exactly where committing would grow
 * the grid to put it.
 */
function drawPlacementPreview(
  ctx: CanvasRenderingContext2D,
  preview: PlacementPreview,
  originX: number,
  originY: number,
): void {
  if (preview.cells.length === 0) return;

  ctx.save();
  ctx.fillStyle = preview.valid ? PLACEMENT_VALID_FILL : PLACEMENT_INVALID_FILL;

  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const { col, row } of preview.cells) {
    const { x, y } = tileToPixel(col, row);
    ctx.fillRect(x + originX, y + originY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
    if (col < minCol) minCol = col;
    if (row < minRow) minRow = row;
    if (col > maxCol) maxCol = col;
    if (row > maxRow) maxRow = row;
  }

  const topLeft = tileToPixel(minCol, minRow);
  ctx.lineWidth = PLACEMENT_BORDER_WIDTH;
  ctx.strokeStyle = preview.valid ? PLACEMENT_VALID_COLOR : PLACEMENT_INVALID_COLOR;
  ctx.strokeRect(
    topLeft.x + originX,
    topLeft.y + originY,
    (maxCol - minCol + 1) * RENDERED_TILE_SIZE,
    (maxRow - minRow + 1) * RENDERED_TILE_SIZE,
  );
  ctx.restore();
}
```

In the draw effect, immediately after the `} finally { ctx.restore(); }` block that closes
the foreground-alpha section, add:

```typescript
    // Outside the alpha block on purpose: a pending placement is the thing the
    // author is looking at, so it is drawn last and at full opacity even while
    // the background layer dims everything else.
    if (placement?.preview) {
      drawPlacementPreview(ctx, placement.preview, panOffset.x, panOffset.y);
    }
```

and add `placement` to that effect's dependency array (it becomes
`[grid, panOffset, images, canvasSize, backgroundPlacements, activeLayer, placement]`).
When nothing is armed the page passes the literal `null`, a stable value, so the common
case redraws exactly as often as it does today.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: PASS — 5 new tests plus everything from Task 6 and every pre-existing test.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/EditorCanvas.tsx src/themes/platformer/editor/EditorCanvas.test.tsx
git commit -m "feat(platformer): draw the blue/red blueprint placement preview"
```

---

### Task 8: `LevelEditorPage` arms and disarms a blueprint

**Files:**
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`

**Interfaces:**
- Consumes: `editorArmedBlueprintIdSignal` (Task 4), `findBlueprint`
  (`../level/blueprintRegistry`), `blueprintCells` (Task 1), the new `Palette` props
  (Task 5).
- Produces: the page's `armedBlueprintId`/`pendingPlacement` state and its arming rules.

**The four mutual-exclusion rules, and why they are at the setters.**

1. `setSelectedTool(char)` also disarms any blueprint — clicking a tile tool is
   unambiguously "I want to paint again".
2. Arming a blueprint does **not** clear `selectedTool`, so disarming restores the author's
   previous tool instead of dumping them on a fallback.
3. Clicking the armed blueprint's own Palette tile again disarms it (the toggle).
4. Switching to the blueprint canvas disarms — placement targets the level grid only. The
   page's existing mount-time effect (which already corrects a persisted Spawn/Connection
   Point armed on the wrong canvas) gains the same correction, because both the mode and
   the armed id are persisted and can come back up mismatched with no toggle click.

**Declaration order matters, in both directions.** `setSelectedTool` calls the disarm, so
the armed state and its setter must be declared **above** `selectedTool` in the component
body — a forward reference is what this project's `react-hooks` lint rule flags (see the
existing comment above `centerRequestId`, which was moved for exactly this reason). The
same rule pushes `armedBlueprint`/`armedCells` into that same block rather than down next
to `exportedText`, because Task 9's `commitPlacement` — which lands *above* the `return`
but *below* `applyGrowthShift` — reads both. Every insertion point in Tasks 8 and 9 is
chosen so that nothing in this file ever names a `const` declared later in the component
body.

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/editor/LevelEditorPage.test.tsx`:

```typescript
const CAVE_ROOM: Blueprint = { id: 'cave-room', name: 'Cave Room', layout: ['##'] };

/**
 * A spawn-less 3x3 level. `centerPanOnSpawn` falls back to `{ x: 0, y: 0 }` on a
 * grid with no 'S', so the level canvas's pan is a known zero and a click at
 * `col * RENDERED_TILE_SIZE + 1` lands on exactly that column — the same
 * determinism trick `paintBlueprintCell` relies on for the blueprint canvas.
 */
function renderEditorWithBlueprints(...blueprints: Blueprint[]) {
  blueprintEntries.push(...blueprints);
  editorLevelSignal.value = importLayout(['...', '...', '...']);
  render(<LevelEditorPage />);
}

function clickLevelCell(col: number, row: number, button = 0) {
  const canvas = document.querySelector('canvas')!;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
  fireEvent.mouseDown(canvas, {
    button,
    clientX: col * RENDERED_TILE_SIZE + 1,
    clientY: row * RENDERED_TILE_SIZE + 1,
  });
}

describe('LevelEditorPage — arming a blueprint for placement (step 44c)', () => {
  it('levelMode-thePaletteListsTheSavedBlueprints', () => {
    renderEditorWithBlueprints(CAVE_ROOM);

    expect(screen.getByRole('button', { name: 'Cave Room' })).toBeInTheDocument();
  });

  it('blueprintMode-thePaletteListsNoBlueprintsToPlace', () => {
    // Nesting is out of scope: a blueprint cannot be placed into a blueprint.
    renderEditorWithBlueprints(CAVE_ROOM);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.queryByRole('button', { name: 'Cave Room' })).not.toBeInTheDocument();
  });

  it('clickingABlueprintTile-armsItAndPersistsThat', () => {
    renderEditorWithBlueprints(CAVE_ROOM);

    fireEvent.click(screen.getByRole('button', { name: 'Cave Room' }));

    expect(screen.getByRole('button', { name: 'Cave Room' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(editorArmedBlueprintIdSignal.value).toBe('cave-room');
  });

  it('clickingTheArmedBlueprintAgain-disarmsIt', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    fireEvent.click(screen.getByRole('button', { name: 'Cave Room' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cave Room' }));

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
    expect(screen.getByRole('button', { name: 'Cave Room' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('armingABlueprint-leavesTheSelectedTileToolAloneSoDisarmingRestoresIt', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    fireEvent.click(screen.getByRole('button', { name: 'Ground Rock' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cave Room' }));

    expect(editorSelectedToolSignal.value).toBe('R');
    expect(screen.getByRole('button', { name: 'Ground Rock' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('pickingATileTool-disarmsTheBlueprint', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    fireEvent.click(screen.getByRole('button', { name: 'Cave Room' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ground Rock' }));

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
    expect(screen.getByRole('button', { name: 'Cave Room' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('armedBlueprint-switchingToTheBlueprintCanvas-disarmsIt', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    fireEvent.click(screen.getByRole('button', { name: 'Cave Room' }));

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });

  it('mountedInBlueprintModeWithABlueprintArmed-disarmsItWithoutAnyToggleClick', () => {
    // Both the mode and the armed id are persisted, so the editor can come back
    // up on the blueprint canvas with a blueprint still armed — the mirror of
    // the Spawn and Connection Point mount-time corrections.
    blueprintEntries.push(CAVE_ROOM);
    editorCanvasModeSignal.value = 'blueprint';
    editorArmedBlueprintIdSignal.value = 'cave-room';

    render(<LevelEditorPage />);

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
  });

  it('aPersistedArmedIdWithNoBlueprintBehindIt-behavesAsNotArmedAndStillPaints', async () => {
    // The blueprint's file can be deleted between sessions. `findBlueprint`
    // returns undefined, which reads as "nothing armed" everywhere, so clicks
    // paint instead of silently doing nothing.
    editorArmedBlueprintIdSignal.value = 'deleted-room';
    editorLevelSignal.value = importLayout(['...', '...', '...']);
    render(<LevelEditorPage />);

    clickLevelCell(1, 1);

    expect(editorDirtySignal.value).toBe(true);
    await waitFor(() => expect(editorLevelSignal.value[1][1]).toBe('G'));
  });
});
```

(extend the file's `./editorLevelState` import with `editorArmedBlueprintIdSignal`, and add
`editorArmedBlueprintIdSignal.value = null;` to the top-level `beforeEach` alongside the
other signal resets.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: FAIL — no blueprint tiles render and `editorArmedBlueprintIdSignal` is never
written. Do not continue until you have seen that failure output.

- [ ] **Step 3: Wire the arming state into the page**

In `src/themes/platformer/editor/LevelEditorPage.tsx`, add the imports:

```typescript
import { findBlueprint } from '../level/blueprintRegistry';
import { blueprintCells } from './blueprintCells';
```

and extend the existing `./editorLevelState` import with `editorArmedBlueprintIdSignal`.

Insert immediately **after** the `grid` state and **before** the `selectedTool` state (the
order matters — `setSelectedTool` calls into this):

```typescript
  // Which saved blueprint is armed for placement (roadmap step 44c), and where
  // its pending preview is anchored. The armed id is persisted like the armed
  // tool; the pending anchor deliberately is NOT — a half-finished placement
  // must not survive a reload.
  const [armedBlueprintId, setArmedBlueprintIdState] = useState<string | null>(
    () => editorArmedBlueprintIdSignal.value,
  );
  const [pendingPlacement, setPendingPlacement] = useState<{ col: number; row: number } | null>(
    null,
  );
  const setArmedBlueprintId = (id: string | null) => {
    setArmedBlueprintIdState(id);
    editorArmedBlueprintIdSignal.value = id;
    // Any change of what is armed invalidates a preview anchored for the old
    // one.
    setPendingPlacement(null);
  };
  /** Clicking a blueprint's Palette tile arms it; clicking the armed one again
   *  disarms it, which restores the tile tool that was selected before. */
  const armBlueprint = (id: string) => {
    setArmedBlueprintId(armedBlueprintId === id ? null : id);
  };
  // A persisted id whose blueprint file has since been deleted resolves to
  // nothing here, which reads as "not armed" through the whole page: no Palette
  // tile is pressed, no preview is produced, and clicks paint as usual.
  // Derived HERE, in the same block, rather than further down next to
  // `exportedText`: Task 9's `commitPlacement` reads both, and this file's
  // house rule (see the comment above `centerRequestId`) is that nothing
  // forward-references a `const` declared later in the component body.
  const armedBlueprint =
    armedBlueprintId === null ? null : (findBlueprint(armedBlueprintId) ?? null);
  const armedCells = armedBlueprint === null ? null : blueprintCells(armedBlueprint.layout);
```

In `setSelectedTool`, add the disarm:

```typescript
  const setSelectedTool = (tool: TileChar) => {
    setSelectedToolState(tool);
    editorSelectedToolSignal.value = tool;
    // Picking a tile tool is unambiguously "I want to paint again". The reverse
    // is deliberately not true: arming a blueprint leaves `selectedTool` alone,
    // so disarming restores it rather than falling back to Ground Grass.
    setArmedBlueprintId(null);
  };
```

In `setCanvasMode`, add (alongside the existing Spawn/Connection Point corrections):

```typescript
    // Placement targets the level grid only — nesting a blueprint inside a
    // blueprint is out of scope.
    if (mode === 'blueprint') setArmedBlueprintId(null);
```

In the mount-time correction effect, inside the existing eslint-disabled region:

```typescript
    if (isBlueprintMode && armedBlueprintId !== null) setArmedBlueprintId(null);
```

Pass the two new props to `<Palette …>`:

```tsx
            armedBlueprintId={armedBlueprintId}
            onArmBlueprint={armBlueprint}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: PASS — 9 new tests plus every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx
git commit -m "feat(platformer): arm and disarm a blueprint for placement in the editor"
```

---

### Task 9: `LevelEditorPage` previews and commits a placement

**Files:**
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`

**Interfaces:**
- Consumes: `blueprintFits` (Task 2), `placeBlueprint`/`rebaseBlueprintBackground` (Task 3),
  `EditorCanvas`'s `placement` prop (Tasks 6–7).

**Three resolved behaviours the design left open, decided here:**

- **An invalid (red) placement never commits.** A second click on the same cell while the
  preview is red is a no-op: the preview stays, the blueprint stays armed. Committing a red
  placement would overwrite terrain, which is the exact thing the rule exists to prevent.
- **Committing keeps the blueprint armed.** The pending anchor clears, but the blueprint
  stays selected, so stamping several copies of the same room needs no re-arming — the same
  way a tile tool stays selected after painting. Right-click, or clicking the tile again,
  disarms.
- **Background placements are appended AFTER `applyGrowthShift`.** `applyGrowthShift` maps
  the *existing* placements by the growth shift; the blueprint's own are rebased with that
  shift already folded in, so appending them first would shift them twice. Both are
  functional updates on the same setter, so their order is their call order.

- [ ] **Step 1: Write the failing tests**

First, add `strokeRect: vi.fn(),` to the canvas-context stub in this file's top-level
`beforeEach` — without it the first rendered preview throws. Then append:

```typescript
describe('LevelEditorPage — placing a blueprint (step 44c)', () => {
  const armCaveRoom = () => fireEvent.click(screen.getByRole('button', { name: 'Cave Room' }));

  it('firstClick-previewsWithoutWritingAnythingOrDirtyingTheLevel', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    clickLevelCell(1, 1);

    // Painting sets the dirty flag synchronously, so this genuinely proves no
    // paint happened (the grid signal itself is debounced and would not have
    // changed yet either way).
    expect(editorDirtySignal.value).toBe(false);
  });

  it('secondClickOnTheSameCell-stampsEveryCellOfTheRoomIntoTheLevelGrid', async () => {
    // A 3x3 level, ['##'] anchored at (col 1, row 1): absolute (1,1) and (1,2),
    // both in bounds, so neither growGrid call grows anything and both shifts
    // are 0.
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    clickLevelCell(1, 1);
    clickLevelCell(1, 1);

    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(importLayout(['...', '.##', '...']));
    });
    expect(editorDirtySignal.value).toBe(true);
  });

  it('secondClickOnADifferentCell-movesThePreviewInsteadOfCommitting', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    clickLevelCell(1, 1);
    clickLevelCell(2, 2);

    expect(editorDirtySignal.value).toBe(false);
  });

  it('anchoredPastTheTopLeftCorner-growsTheGridTheSameWayPaintingThereWould', async () => {
    // Anchored at (col -1, row -1) on a 3x3 grid: growGrid(-1,-1) prepends one
    // column and one row (4 wide x 4 high, both shifts 1), the second grow is a
    // no-op, and the two cells land at (0,0) and (0,1) of the grown grid.
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    clickLevelCell(-1, -1);
    clickLevelCell(-1, -1);

    await waitFor(() => {
      expect(editorLevelSignal.value).toEqual(
        importLayout(['##..', '....', '....', '....']),
      );
    });
  });

  it('overlappingExistingTerrain-secondClickOnTheSameCell-writesNothing', async () => {
    blueprintEntries.push(CAVE_ROOM);
    editorLevelSignal.value = importLayout(['G..', '...', '...']);
    render(<LevelEditorPage />);
    armCaveRoom();

    // Anchored at (col 0, row 0) the room would land on (0,0), which holds 'G'.
    clickLevelCell(0, 0);
    clickLevelCell(0, 0);

    expect(editorDirtySignal.value).toBe(false);
    await waitFor(() => expect(editorLevelSignal.value).toEqual(importLayout(['G..', '...', '...'])));
  });

  it('committing-keepsTheBlueprintArmedSoAnotherCopyCanBePlaced', () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();

    clickLevelCell(1, 1);
    clickLevelCell(1, 1);

    expect(editorArmedBlueprintIdSignal.value).toBe('cave-room');
  });

  it('rightClickWhileArmed-cancelsThePlacementAndDisarmsWithoutErasingAnything', async () => {
    blueprintEntries.push(CAVE_ROOM);
    editorLevelSignal.value = importLayout(['G..', '...', '...']);
    render(<LevelEditorPage />);
    armCaveRoom();
    clickLevelCell(1, 1);

    clickLevelCell(0, 0, 2);

    expect(editorArmedBlueprintIdSignal.value).toBeNull();
    // Right-click normally erases, which would blank the 'G' and dirty the
    // level — during a placement it must do neither.
    expect(editorDirtySignal.value).toBe(false);
    await waitFor(() => expect(editorLevelSignal.value[0][0]).toBe('G'));
  });

  it('aBlueprintWithBackgroundPieces-appendsThemRebasedOntoTheAnchor', async () => {
    renderEditorWithBlueprints({
      id: 'cave-room',
      name: 'Cave Room',
      layout: ['##'],
      background: [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }],
    });
    armCaveRoom();

    // Anchor (col 1, row 1) with no growth, so the piece rebases to (1,1).
    clickLevelCell(1, 1);
    clickLevelCell(1, 1);

    await waitFor(() => {
      expect(editorBackgroundSignal.value).toEqual([
        { pieceId: 'dirtColumnTop1x1', col: 1, row: 1 },
      ]);
    });
  });

  it('growthOnCommit-shiftsTheLevelsOwnBackgroundButNotTheBlueprintsOwn', async () => {
    // The level already has a piece at (0,0); the placement grows one column and
    // one row, so that piece moves to (1,1). The blueprint's own piece is
    // rebased with the same shift already folded in — (0 + -1 + 1) = 0 on both
    // axes — and must not be shifted a second time.
    blueprintEntries.push({
      id: 'cave-room',
      name: 'Cave Room',
      layout: ['##'],
      background: [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }],
    });
    editorLevelSignal.value = importLayout(['...', '...', '...']);
    editorBackgroundSignal.value = [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }];
    render(<LevelEditorPage />);
    armCaveRoom();

    clickLevelCell(-1, -1);
    clickLevelCell(-1, -1);

    await waitFor(() => {
      expect(editorBackgroundSignal.value).toEqual([
        { pieceId: 'dirtColumnTop1x1', col: 1, row: 1 },
        { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
      ]);
    });
  });

  it('backgroundLayerActive-clicksStillPaintTheBackgroundEvenWithABlueprintArmed', async () => {
    renderEditorWithBlueprints(CAVE_ROOM);
    armCaveRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));

    clickLevelCell(1, 1);

    await waitFor(() => expect(editorBackgroundSignal.value).toHaveLength(1));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: FAIL — clicks still paint (the canvas is handed no `placement`). Do not continue
until you have seen that failure output.

- [ ] **Step 3: Wire the preview and the commit**

In `src/themes/platformer/editor/LevelEditorPage.tsx`, add the imports:

```typescript
import { blueprintFits } from './blueprintFit';
import { placeBlueprint, rebaseBlueprintBackground } from './placeBlueprint';
```

Add `setPendingPlacement(null);` to `loadLevel` (a pending anchor measured against the old
grid means nothing against a new one), next to its `setSaveResult(null)`.

Add **below `applyGrowthShift` and above `tryLayout`** — `commitPlacement` calls
`applyGrowthShift`, and Task 8 already put `armedBlueprint`/`armedCells`/`pendingPlacement`
near the top, so placing it here is what keeps this file free of forward references (see
Task 8's "Declaration order matters" note):

```typescript
  /**
   * Commits the pending placement: every non-`.` cell of the armed blueprint is
   * written into the level grid at the clicked anchor, through the same
   * `growGrid` path painting uses — so placing past the current edge grows the
   * grid exactly as painting there would (`placeBlueprint.ts` explains why this
   * is two grows and a bulk write rather than a loop over `paintCell`).
   *
   * A placement that does not fit is refused outright rather than committed:
   * the preview is already red, and writing it would overwrite terrain, which
   * is the one thing the rule exists to prevent. The blueprint stays armed
   * afterwards, so another copy of the same room can be stamped without going
   * back to the palette — the same way a tile tool stays selected after
   * painting.
   */
  const commitPlacement = (col: number, row: number) => {
    if (armedBlueprint === null || armedCells === null) return;
    if (!blueprintFits(grid, armedCells, col, row)) return;

    const result = placeBlueprint(grid, armedCells, col, row);
    setGrid(result.grid);
    if (!isDirty) setDirty(true);
    if (saveResult !== null) setSaveResult(null);
    // Order matters: this shifts the placements the level ALREADY had by the
    // growth, and the blueprint's own are rebased with that same shift already
    // folded in — appending them first would shift them twice.
    applyGrowthShift(result.colShift, result.rowShift, setBackgroundPlacements);
    const rebased = rebaseBlueprintBackground(
      armedBlueprint.background ?? [],
      col + result.colShift,
      row + result.rowShift,
    );
    if (rebased.length > 0) {
      setBackgroundPlacements((prev) => [...prev, ...rebased]);
    }
    setPendingPlacement(null);
  };

  /** First click anchors a preview; a second click on that same cell commits;
   *  a click anywhere else re-anchors instead of committing. */
  const handlePlacementClick = ({ col, row }: { col: number; row: number }) => {
    if (pendingPlacement !== null && pendingPlacement.col === col && pendingPlacement.row === row) {
      commitPlacement(col, row);
      return;
    }
    setPendingPlacement({ col, row });
  };
```

Add, immediately after `handlePlacementClick` (same reason — `placementPreview` is read by
the `<EditorCanvas>` props below it and reads `armedCells` from above it):

```typescript
  // Placement only makes sense on the level's foreground: the blueprint canvas
  // is excluded (no nesting) and the background layer paints a different
  // catalog entirely, so clicks there keep working exactly as they do today.
  const placementActive = !isBlueprintMode && activeLayer === 'foreground' && armedCells !== null;
  const placementPreview =
    placementActive && armedCells !== null && pendingPlacement !== null
      ? {
          cells: armedCells.map(({ row, col }) => ({
            row: row + pendingPlacement.row,
            col: col + pendingPlacement.col,
          })),
          valid: blueprintFits(grid, armedCells, pendingPlacement.col, pendingPlacement.row),
        }
      : null;
```

and pass to `<EditorCanvas …>`:

```tsx
          placement={
            placementActive
              ? {
                  preview: placementPreview,
                  onPlace: handlePlacementClick,
                  onCancel: () => setArmedBlueprintId(null),
                }
              : null
          }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: PASS — 10 new tests plus everything from Task 8 and every pre-existing test.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx
git commit -m "feat(platformer): preview and commit a blueprint placement in the level editor"
```

---

### Task 10: Full suite, typecheck, lint, the manual browser check, and tracking

**Files:** `specs/S-006-platformer-theme/roadmap.md` only — otherwise this task verifies.

- [ ] **Step 1: Run the full suite, the typechecker and the linter**

```bash
npm test
npx tsc -b --noEmit
npm run lint
```

Expected: tests PASS. The total is the baseline recorded before this plan started **plus**
the tests it adds: 5 (Task 1) + 9 (Task 2) + 10 (Task 3) + 2 (Task 4) + 9 (Task 5: 1
`paletteTiles` + 8 `Palette`) + 6 (Task 6) + 5 (Task 7) + 9 (Task 8) + 10 (Task 9) =
**65 added, 0 removed**. No test is deleted or rewritten by this plan: every change to an
existing test file is additive, apart from three mechanical edits (`strokeRect` added to two
context stubs, the registry mock added to `Palette.test.tsx`, and one extra signal reset in
`LevelEditorPage.test.tsx`'s `beforeEach`).

Typecheck and lint: **compare against the Step 0 baseline** — the bar is that no new error
appears, since the 8 `BlockKind`/`potionPot` type errors and the one
`components/ControlsOverlay.tsx` lint error pre-date this work and are out of scope.

- [ ] **Step 2: Manual browser check**

Start the dev server and open `/platformer/editor`. If
`src/themes/platformer/level/blueprints/` is empty, save one blueprint first (Blueprint mode
→ paint a small room with a couple of Connection Point cells on its border and a background
piece inside it → Save Blueprint → reload). Then, in Level mode, confirm in order:

1. The Palette has a **Blueprints** section listing every saved room, each an empty square
   holding the blueprint glyph, with the room's name as its tooltip. Switch to **Blueprint**:
   the section is gone. Switch back to **Level** and to the **Background** layer: gone
   again. Back to **Foreground**: there.
2. Click a blueprint tile: it shows as selected, and the previously selected tile tool stays
   selected too. Click a tile tool: the blueprint deselects. Re-arm the blueprint, click it
   again: it deselects and the tile tool is still the one that was selected before.
3. With a blueprint armed, click empty space on the level: the room previews there, tinted,
   with a **blue** border around the whole room — and nothing is painted. Click a different
   empty cell: the preview moves there.
4. Click a cell so the preview overlaps existing terrain: the border turns **red**. Click
   that same cell again: nothing happens — no cells are written, the preview stays red.
5. Move to a clear spot (blue) and click the same cell twice: the room is stamped in.
   Terrain, entities, connection-point markers and the background piece all appear, the
   background piece sitting where it did inside the room. Anything that was in a gap of the
   room's bounding box is still there, untouched.
6. The blueprint is still armed — place a second copy elsewhere without touching the
   palette.
7. Place a copy straddling the grid's left/top edge (middle-click-drag to pan out first).
   The grid grows, the view does not jump, and any background pieces the level already had
   stay where they were relative to the terrain.
8. With a preview pending, **right-click**: the preview vanishes, the blueprint disarms, and
   nothing is erased. Right-click again with nothing armed: it erases as usual.
9. Switch to Blueprint mode with a blueprint armed and back: it is disarmed, and the
   blueprint canvas paints normally.
10. Reload with a blueprint armed: it is still armed and still previews. Then delete that
    blueprint's JSON file, reload, and confirm the editor paints normally instead of getting
    stuck (the stale id resolves to nothing).
11. Export the level and confirm the placed room's characters are in the exported layout,
    then **Try** it and walk through the placed room in the game.

- [ ] **Step 3: Tick step 44c in the roadmap**

Step 44c is finished by this plan (Part 1 landed persistence, Part 2 placement), so change
its `- [ ]` to `- [x]` in `specs/S-006-platformer-theme/roadmap.md`. Its wording still
describes the old connection-point-matching fit rule ("blue = no overlap and, if any
connection points already exist in the level, at least one lines up facing an existing
one"); correct that clause to overlap-only, matching the design doc's Goal section.

Note while you are there, but **do not change**: step 44b's checkbox is still `- [ ]`
although 44b shipped. Raise that with the project owner rather than ticking someone else's
step from inside this plan.

The two "Unscheduled additions" entries that came out of designing this feature —
**Level Editor zoom** and **a dedicated control/marker layer** — stay unscheduled and
unimplemented. Both say to revisit only once placement is actually built and the problem
turns out to be real; that judgement is now possible, but it is a separate conversation, not
this plan's work.

- [ ] **Step 4: Update `docs/Features.md` if applicable**

Per `CLAUDE.md`'s Feature Completion Tracking. **Already checked against the real file:**
there is no blueprint-rooms entry. Two rows touch this area and neither should change —
`S-006 | 2D Platformer theme | 📋 Planned` (the whole theme, with many steps still open) and
`O-002 | Platformer Level Editor | ✅ Done` (already ticked; its bullet describes the level
dropdown and save button, not blueprints). Re-confirm those are still the only matching
entries, then say "nothing to update" rather than ticking a feature that is not finished.

- [ ] **Step 5: Commit**

```bash
git add specs/S-006-platformer-theme/roadmap.md
git commit -m "docs(platformer): mark roadmap step 44c done"
```

---

## Self-Review Notes

- **Where Appendix A had gone stale, and what changed.** Four places, all found by reading
  the current source rather than trusting the appendix:
  1. **A.5's single `placementPreview` prop is not enough.** A render-only prop cannot get
     the click back out to the page, and A.5's own cancel paragraph requires
     `handleMouseDown` to know a blueprint is armed. A bare callback prop cannot signal
     armed-ness either, because the page would pass a stable handler whether or not
     anything is armed. Task 6 uses one optional `placement` object carrying preview +
     `onPlace` + `onCancel`, whose non-null-ness is the armed flag. Still one new prop, so
     A.5's actual constraint (the ~30 existing `EditorCanvas.test.tsx` render sites keep
     compiling) holds.
  2. **A.1's Palette props needed a source for the list.** Part 1 landed
     `blueprintRegistry.ts` after A.1 was written; `BlueprintSelect.tsx` imports `BLUEPRINTS`
     directly, and `Palette.tsx` already imports `BACKGROUND_CATALOG`/`TERRAIN_CHARS`
     directly, so Task 5 follows that house style rather than threading a `blueprints` prop.
     The consequence is real and is handled: `Palette.test.tsx` currently does **not** mock
     the registry, and `level/blueprints/` is a working folder anyone can save an untracked
     room into (Task 10's manual check does exactly that) — so without the mock added in
     Task 5, that file's existing button-count assertion, which counts every button the
     palette renders, would start passing locally and failing in CI (or the reverse) the
     first time a blueprint is saved. `BlueprintSelect.test.tsx`'s
     `vi.hoisted` + stable-array pattern is copied verbatim.
  3. **A.1 said the section renders only while `activeLayer === 'foreground'`** as a
     condition to write. In the current `Palette.tsx` that comes free: the background layer
     renders an entirely separate branch, so the section just goes inside the foreground
     one. The page-side `placementActive` guard still checks `activeLayer` explicitly,
     because a blueprint can stay armed across a trip to the background layer and clicks
     there must keep painting the background (pinned by a test in Task 9).
  4. **A.1 said `EditorCanvas`'s armed check goes "before the paint path".** Verified against
     the real `handleMouseDown`, which has since gained a background-layer branch *between*
     the middle-click pan branch and the paint branch. The insertion point is therefore
     after the middle-click branch (panning must keep working — it is the only way to line a
     room up, given zoom was postponed) and before **both** the background and paint
     branches.

  Everything else in Appendix A survived verification unchanged: A.2's parse rule, A.3's
  overlap-only fit, A.4's two-grow arithmetic, the separate-signal decision, the
  mutual-exclusion-at-the-setters decision, and the right-click-cancel gesture.

- **Fixture arithmetic, re-derived by hand against the current `growGrid`, not copied.**
  `growGrid` computes `growLeft = col < 0 ? -col : 0`, `growTop = row < 0 ? -row : 0`,
  `growRight = col >= width ? col - width + 1 : 0`, `growBottom = row >= height ? row - height + 1 : 0`,
  with `width = grid[0]?.length ?? 0`, and returns `colShift = growLeft`,
  `rowShift = growTop`.
  - *Task 3, Fixture A (no growth).* 3×3 empty grid, cells of `['##','#.']` = (0,0), (0,1),
    (1,0) — (1,1) is `'.'` and is not a cell — anchored at (col 1, row 1). Absolutes:
    (1,1), (1,2), (2,1). min = (1,1), max = (2,2). First grow: 1 < 3 and 1 < 3 on both axes
    → unchanged, shifts 0. Second grow at (2, 2): 2 < 3 → unchanged, shifts 0. Writes land
    at exactly the absolutes. Result rows `...` / `.##` / `.#.` ✓.
  - *Task 3, Fixture B (grow left and up).* Grid `[['G']]` (width 1, height 1), cells of
    `['##']` = (0,0), (0,1), anchored at (-1, -1). min = (col -1, row -1), max = (col 0,
    row -1). First grow at (-1, -1): growLeft 1, growTop 1, growRight 0 (since -1 < 1),
    growBottom 0 → newWidth 1+1+0 = 2, newHeight 1+1+0 = 2, shifts (1, 1); `'G'` moves to
    [1][1]. Second grow at (maxCol + 1, maxRow + 1) = (0, 0): both in bounds of 2×2 →
    unchanged, shifts 0. Totals (1, 1). Writes: (0,0) → [-1+1][-1+1] = [0][0]; (0,1) →
    [0][-1+1+1] = [0][1]. Result `##` / `.G` ✓ — matching Appendix A.4's worked example's
    *shape*, re-derived on this fixture rather than reused.
  - *Task 3, Fixture C (grow right and down) — the one that proves the second grow is not
    redundant.* Grid `[['G']]`, same cells, anchored at (1, 1). min = (1, 1), max = (2, 1).
    First grow at (1, 1): growRight = 1 - 1 + 1 = 1, growBottom = 1 - 1 + 1 = 1 → 2 wide ×
    2 high, shifts 0. Column 2 is **still out of bounds** at this point. Second grow at
    (2, 1): growRight = 2 - 2 + 1 = 1 → 3 wide × 2 high, shifts 0. Writes at [1][1] and
    [1][2]. Result `G..` / `.##` ✓. A single grow at the minimum corner would have thrown
    here.
  - *Task 9, page-level growth test.* 3×3 grid, `['##']` anchored at (-1, -1). First grow:
    growLeft 1, growTop 1, growRight 0 (−1 < 3), growBottom 0 → newWidth 1+3+0 = 4,
    newHeight 1+3+0 = 4, shifts (1, 1). Second grow at (maxCol + 1, maxRow + 1) =
    (0 + 1, −1 + 1) = (1, 0): both inside 4×4 → unchanged. Writes at [0][0] and [0][1] →
    `##..` / `....` / `....` / `....` ✓. `applyGrowthShift(1, 1, …)` then moves the pan by
    −32 on each axis and adds 1 to every existing background placement's col/row, so the
    level's own piece at (0,0) becomes (1,1); the blueprint's own piece rebases to
    (0 + −1 + 1, 0 + −1 + 1) = (0,0) and is appended after, unshifted a second time ✓.
  - *Test determinism.* `centerPanOnSpawn` returns `{ x: 0, y: 0 }` for a grid with no `'S'`
    (read: it scans for `'S'` and falls through to the origin), so seeding
    `editorLevelSignal` with a spawn-less `['...','...','...']` before render pins the level
    canvas's pan at zero, and `clickLevelCell(col, row)` at `col * 32 + 1` lands on exactly
    that cell — the same trick step 44a's `paintBlueprintCell` already uses on the blueprint
    canvas, where the pan starts at zero for a different reason. Negative columns work
    unchanged: `Math.floor((-31 - 0) / 32) = -1`.
  - *Task 3's test count.* The three `placeBlueprint` describes plus the
    `rebaseBlueprintBackground` one hold 3 + 1 + 1 + 2 + 3 = **10** `it`s, not 9; Task 3's
    "Expected: PASS" line and Task 10's running total say 10 and 65 accordingly.
  - *Second `growGrid` call can never prepend.* After the first grow, `minCol + colShift ≥ 0`
    and `minRow + rowShift ≥ 0`, and `maxCol ≥ minCol`, `maxRow ≥ minRow`, so the second
    call's `growLeft`/`growTop` are always 0. Summing both calls' shifts is therefore
    defensive rather than load-bearing, and is kept because it costs nothing and documents
    the invariant.

- **Deliberate deviations from Appendix A / the design doc, and why.**
  - *One `placement` object instead of A.5's `placementPreview`* — reasoned above; the
    appendix's constraint (one new optional prop) is preserved.
  - *`Palette` reads `BLUEPRINTS` directly rather than taking it as a prop* — matches
    `BlueprintSelect.tsx` and `Palette.tsx`'s own existing direct catalog imports. Paid for
    with the registry mock in `Palette.test.tsx`, which that file needed anyway.
  - *Three resolved behaviours the design doc left open* (Task 9): a red placement never
    commits; committing keeps the blueprint armed; background is appended after
    `applyGrowthShift`, never before. Each is argued at its task.
  - *`editorArmedBlueprintIdSignal` is persisted, with graceful degradation instead of a
    mount-time repair.* A.1 said "joins the other persisted editor signals", which this
    follows. The failure mode it introduces — an armed id whose file was deleted — resolves
    to `undefined` through `findBlueprint`, and the page's `armedBlueprint`/`armedCells`
    derivation turns that into "nothing armed" everywhere at once, so no separate correction
    effect is needed. Pinned by
    `aPersistedArmedIdWithNoBlueprintBehindIt-behavesAsNotArmedAndStillPaints`.
  - *Connection points are stamped, not stripped.* The design says every non-`.` cell is
    written and that a placed `'+'` counts as occupied. The roadmap's postponed
    control/marker-layer entry is where the "invisible gap in a wall" question gets
    revisited; Task 10 explicitly leaves it unscheduled.
  - *No zoom.* Postponed per the roadmap; step 7 of the manual check leans on the existing
    middle-click pan instead, and Task 6 keeps the middle-click branch ahead of placement so
    that stays possible while a blueprint is armed.

- **Type, prop and name threading, checked end to end.** `Blueprint` (44a's type, unchanged)
  → `BLUEPRINTS`/`findBlueprint` (Part 1) → `Palette`'s section and the page's
  `armedBlueprint`. `BlueprintCell` has exactly one definition (`blueprintCells.ts`) and is
  consumed by `blueprintFit.ts`, `placeBlueprint.ts` and the page — same three fields,
  never renamed. `PlacementResult` is `GrowResult`, the same shape `paintCell`'s
  `PaintResult` aliases, which is what lets `applyGrowthShift` be reused with no changes.
  `PlacementPreview`/`PlacementMode` are defined once in `EditorCanvas.tsx` and produced
  once, in `LevelEditorPage.tsx`. `armedBlueprintId` is the same `string | null` in the
  signal, the page's state, and `PaletteProps`. Argument order is `(grid, cells, anchorCol,
  anchorRow)` in both `blueprintFits` and `placeBlueprint`, col-before-row, matching
  `paintCell(grid, col, row, tool)` and `growGrid(grid, col, row)`.
- **Second review pass (independent), and what it changed.** Every claim above was
  re-derived against the real files rather than re-read from this plan. Confirmed
  unchanged: the 8/1 tsc/lint baseline (both commands re-run — 8 `error TS` lines, all
  `BlockKind`/`potionPot`; one `react-hooks/set-state-in-effect` in `ControlsOverlay.tsx`);
  `growGrid`'s formulas and all four worked examples, including the never-prepends invariant
  (`minCol + colShift ≥ 0` and `maxCol ≥ minCol`, so the second call's `growLeft`/`growTop`
  are 0 by construction); `handleMouseDown`'s real branch order (middle-click pan →
  `activeLayer === 'background'` → right-click-erases paint), so Task 6's insertion point is
  correct; `centerPanOnSpawn`'s spawn-less `{0,0}` fallback and `Math.floor((-31)/32) = -1`;
  `PaletteTile`'s `aria-label`/`aria-pressed` (so `getByRole('button', { name })` resolves
  to a blueprint's `name`); `EditorCanvas.test.tsx`'s and `LevelEditorPage.test.tsx`'s
  context stubs both genuinely lacking `strokeRect`; `LevelEditorPage.test.tsx`'s existing
  `blueprintEntries` `vi.hoisted` mock; `createLocalStorageSignal`'s signature;
  `cropLevelForExport`'s save-time `- origin` rebase being the exact mirror of
  `rebaseBlueprintBackground`'s `+ anchor`; and `editorArmedBlueprintIdSignal` not already
  existing anywhere. Four things were wrong and are fixed in place:
  1. **Task 3's test count** was 9, actually 10 (and Task 10's total 64, actually 65).
  2. **Declaration order in `LevelEditorPage.tsx`.** Task 8 placed
     `armedBlueprint`/`armedCells` "just above the `return (` (next to `exportedText`)" —
     two different places, and both *below* Task 9's stated insertion point for
     `commitPlacement` ("above `applyGrowthShift`"), which reads them. `commitPlacement`
     also called `applyGrowthShift` from above it. Two forward references, in a file whose
     own `centerRequestId` comment says that is exactly what the lint rule flags. The
     derived values now sit in Task 8's block, and `commitPlacement`/`handlePlacementClick`/
     `placementActive`/`placementPreview` now go below `applyGrowthShift`.
  3. **The registry-mock rationale** leaned on an untracked `test.json` that no longer
     exists (folder verified: `.gitkeep` only). The requirement is real and stands — the
     button-count assertion at `Palette.test.tsx:28` counts every button in the palette, so
     one saved blueprint breaks it — so the constraint was rewritten to rest on the folder
     being a working folder (Task 10's own manual check writes into it) rather than on one
     specific stale file.
  4. **Two smaller ones:** `blueprintFit.test.ts`'s `WALL` carried a needlessly convoluted
     `readonly ReturnType<typeof blueprintCells>[number][]` annotation (now inferred), and
     the new `paletteTiles.test.ts` case used a camel-case name in a file whose every other
     test — and this plan's own Global Constraints — use prose names.
- **Import-direction check.** The three new modules live in `editor/` and import only
  `editor/` siblings plus `level/` types — the `editor → level` direction every other file
  follows. `Palette.tsx` gains an import of `level/blueprintRegistry`, the same edge
  `BlueprintSelect.tsx` already has. No cycle.
- **Every commit leaves the suite green.** Tasks 1–3 only add files. Task 4 adds an export
  and its tests together. Task 5 changes `Palette` and its test together, and its registry
  mock makes the file's pre-existing tests *more* deterministic, not less. Tasks 6 and 7
  each add an optional prop with a default, so every existing render site keeps compiling
  and behaving identically (pinned by `noPlacementProp-leftClickStillPaintsExactlyAsBefore`).
  Tasks 8 and 9 change the page and its test together.
- **Placeholder scan.** No TBDs, no vague prose standing in for code. Every code block was
  written against the real file it edits or mirrors, each read in full first:
  `LevelEditorPage.tsx` (+ its test), `EditorCanvas.tsx` (+ its test), `Palette.tsx` (+ its
  test), `PaletteTile.tsx`, `paletteTiles.ts` (+ its test), `editorLevelState.ts` (+ its
  test), `blueprintRegistry.ts`, `BlueprintData.ts`, `BlueprintSelect.tsx` (+ its test),
  `importLayout.ts`, `growGrid.ts` (+ its test), `paintCell.ts`, `cropLevelForExport.ts`,
  `EditorPan.ts`, `Terrain.ts`'s `tileToPixel`, and Part 1's plan including Appendix A in
  full. The baseline error counts in Global Constraints were measured by running both
  commands, not copied from Part 1 (which is why the tsc count reads 8 there and 9 in Part
  1 — Part 1 counted a continuation line).
