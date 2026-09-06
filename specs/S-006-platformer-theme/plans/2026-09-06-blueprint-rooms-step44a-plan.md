# Blueprint Rooms — Step 44a (Blueprint Canvas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Level Editor a second, independent, initially-blank canvas on which a
"room" is painted as a reusable **blueprint**: a **Level / Blueprint** toggle picks which
canvas is being edited, the existing Foreground/Background toggle keeps switching which
layer of *that* canvas is painted, and the Select-plus-Save pair below them swaps between
**Level Select + Save** (today's controls, unchanged) and **Blueprint Select + Save
Blueprint**.

**Architecture:** No capture algorithm and no new canvas component. `LevelEditorPage`
gains a second set of grid/background state (`blueprintGrid`,
`blueprintBackgroundPlacements`) that is seeded from, and debounce-synced back to, its own
persisted signals exactly the way `grid`/`backgroundPlacements` already are. Which set is
handed to the single existing `<EditorCanvas>` is a plain ternary at the call site, so
`EditorCanvas` itself is **not modified at all** — every one of its ~30 existing render
sites in `EditorCanvas.test.tsx` keeps compiling untouched, and `paintCell`/`growGrid`/
`placeBackgroundPiece`/`eraseBackgroundCell` are reused verbatim because the canvas cannot
tell the two sets apart. Saving crops through the existing `cropLevelForExport` into a
`Blueprint { id, name, layout, background? }` — the same shape a saved level file already
has — and stores it in a `localStorage`-backed stash (`blueprintStash.ts`) that mirrors
`levelRegistry.ts`'s API surface, so step 44c can replace the stash with the real
dev-server save endpoint plus build-time registry without touching the UI.

**Tech Stack:** React 19 + TypeScript strict, Vitest + React Testing Library, Canvas 2D
rendering, `@preact/signals-react` for reactive editor state.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-06-blueprint-rooms-design.md` — its
"Data model" section and its "Step 44a — A dedicated Blueprint canvas" section. Steps 44b
(connection points) and 44c (real save endpoint, registry, placement) are explicitly NOT
in this plan. `specs/S-006-platformer-theme/roadmap.md` step 44a is the one-line pointer.

## Global Constraints

- TypeScript `strict: true`, no `any`, no `@ts-ignore` (constitution Principle I / III).
- Tests first (constitution Principle II — TDD, NON-NEGOTIABLE). New test names follow
  `{method}-{Condition}-{ExpectedResult}` (see `paintCell.test.ts`'s house style).
- Named arrow function exports for components with the props interface in the same file,
  no default exports (constitution Principle III). Pure helpers in `editor/` are plain
  `export function`/`export const` declarations, matching `exportLayout.ts`/
  `saveLevelFile.ts`.
- Relative imports (`./`, `../`) within `src/themes/platformer/`; `@/` for `src/lib`,
  `src/components`.
- No new dependencies. No new shadcn/ui components — `Select`, `Dialog` and `Button` are
  already in `src/components/ui/`.
- A blueprint is purely an editor-time concept: nothing added here is read by
  collision/physics or the real game's renderer.
- **`EditorCanvas.tsx` is not modified by this plan.** If a task appears to need a new
  `EditorCanvas` prop, stop — the intended design is that the page chooses which data to
  pass through the props that already exist.
- Vitest runs with `globals: true` (confirmed in `vitest.config.ts`). New test files may
  import `describe`/`it`/`expect`/`vi` explicitly (as `LevelSelect.test.tsx` does);
  additions to `editorLevelState.test.ts` must match that file's current style, which
  imports none of them.
- Legal layout characters are exactly `TileChar`'s union in `level/LevelParser.ts`. `.`
  is empty; `#` is wall (there is no `W`). Spawn is `'S'`, palette label `Spawn`.

---

## File Structure

- **Create** `src/themes/platformer/level/BlueprintData.ts` — the `Blueprint` type,
  `BLANK_BLUEPRINT`, `isBlueprint`.
- **Create** `src/themes/platformer/level/BlueprintData.test.ts`
- **Create** `src/themes/platformer/editor/blueprintStash.ts` — the placeholder
  `localStorage` blueprint store (step 44c replaces it with a real registry).
- **Create** `src/themes/platformer/editor/blueprintStash.test.ts`
- **Create** `src/themes/platformer/editor/BlueprintSelect.tsx` — mirrors `LevelSelect`.
- **Create** `src/themes/platformer/editor/BlueprintSelect.test.tsx`
- **Modify** `src/themes/platformer/editor/editorLevelState.ts` — four new persisted
  signals for the blueprint canvas.
- **Modify** `src/themes/platformer/editor/editorLevelState.test.ts`
- **Modify** `src/themes/platformer/editor/Palette.tsx` — optional `canvasMode` prop that
  drops the Spawn tool.
- **Modify** `src/themes/platformer/editor/Palette.test.tsx`
- **Modify** `src/themes/platformer/editor/LevelEditorPage.tsx` — the Level/Blueprint
  toggle, the retargeted canvas, the swapping Select+Save pair, the Save Blueprint dialog.
- **Modify** `src/themes/platformer/editor/LevelEditorPage.test.tsx`

Not modified: `EditorCanvas.tsx`, `paintCell.ts`, `growGrid.ts`, `paintBackgroundCell.ts`,
`exportLayout.ts`, `cropLevelForExport.ts`, `importLayout.ts`, `levelRegistry.ts`,
`saveLevelFile.ts`, `LevelSelect.tsx`.

---

### Task 1: `Blueprint` data model

**Files:**
- Create: `src/themes/platformer/level/BlueprintData.ts`
- Create: `src/themes/platformer/level/BlueprintData.test.ts`

**Interfaces:**
- Consumes: `BackgroundPlacement` (`./LevelData`).
- Produces: `interface Blueprint { id: string; name: string; layout: readonly string[]; background?: BackgroundPlacement[] }`, `BLANK_BLUEPRINT: Blueprint`, `isBlueprint(value: unknown): value is Blueprint`.

`isBlueprint` exists because the 44a store is `localStorage`, which a developer can
hand-edit or leave half-written from an older shape — the same "skip anything malformed
rather than take the editor down" rule `levelRegistry.ts`'s `parseLevelModules` already
applies to level JSON files. Step 44c reuses this guard for the real registry.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/level/BlueprintData.test.ts
import { describe, it, expect } from 'vitest';
import { BLANK_BLUEPRINT, isBlueprint } from './BlueprintData';

describe('BLANK_BLUEPRINT', () => {
  it('theBlankEntry-isASingleEmptyCellNamedNew', () => {
    expect(BLANK_BLUEPRINT).toEqual({ id: 'new', name: 'new', layout: ['.'] });
  });
});

describe('isBlueprint', () => {
  it('minimalWellFormedBlueprint-isAccepted', () => {
    expect(isBlueprint({ id: 'room', name: 'Room', layout: ['#'] })).toBe(true);
  });

  it('blueprintWithABackgroundList-isAccepted', () => {
    expect(
      isBlueprint({
        id: 'room',
        name: 'Room',
        layout: ['#'],
        background: [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }],
      }),
    ).toBe(true);
  });

  it('emptyLayoutArray-isRejected', () => {
    // parseLevel cannot represent a zero-row layout, and exportLayout never
    // produces one (it returns ['.'] for an empty grid instead).
    expect(isBlueprint({ id: 'room', name: 'Room', layout: [] })).toBe(false);
  });

  it('layoutRowThatIsNotAString-isRejected', () => {
    expect(isBlueprint({ id: 'room', name: 'Room', layout: ['#', 7] })).toBe(false);
  });

  it('missingIdOrName-isRejected', () => {
    expect(isBlueprint({ name: 'Room', layout: ['#'] })).toBe(false);
    expect(isBlueprint({ id: 'room', layout: ['#'] })).toBe(false);
  });

  it('backgroundThatIsNotAPlacementList-isRejected', () => {
    expect(isBlueprint({ id: 'r', name: 'R', layout: ['#'], background: [{ col: 0 }] })).toBe(
      false,
    );
  });

  it('nullOrNonObject-isRejected', () => {
    expect(isBlueprint(null)).toBe(false);
    expect(isBlueprint('room')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/BlueprintData.test.ts`
Expected: FAIL — `Cannot find module './BlueprintData'`. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/themes/platformer/level/BlueprintData.ts
import type { BackgroundPlacement } from './LevelData';

/**
 * A named, reusable room authored on the Level Editor's own blueprint canvas
 * (roadmap step 44a). Deliberately the SAME shape a saved level file has —
 * `layout` is `exportLayout`'s cropped `readonly string[]`, `background` is
 * `LevelDef.background` — so importLayout/parseLevel/cropLevelForExport all
 * apply unchanged and step 44c's placement can parse a blueprint with the
 * same per-character mapping it already uses for levels. Purely editor-time:
 * see `specs/S-006-platformer-theme/plans/2026-09-06-blueprint-rooms-design.md`.
 */
export interface Blueprint {
  /** Slug, also the filename stem once step 44c writes real files — mirrors
   *  `LevelEntry`'s id. */
  id: string;
  name: string;
  layout: readonly string[];
  background?: BackgroundPlacement[];
}

/** The blank entry the Blueprint Select dropdown offers, mirroring the level
 *  registry's built-in `empty`: one empty cell, nothing painted. Unlike
 *  `SCRATCH_LAYOUT` it carries no `S` — a blueprint has no spawn. */
export const BLANK_BLUEPRINT: Blueprint = { id: 'new', name: 'new', layout: ['.'] };

const isLayout = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((row) => typeof row === 'string');

const isBackgroundPlacement = (value: unknown): value is BackgroundPlacement =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { pieceId?: unknown }).pieceId === 'string' &&
  typeof (value as { col?: unknown }).col === 'number' &&
  typeof (value as { row?: unknown }).row === 'number';

/**
 * Whether `value` is a well-formed `Blueprint`. Same "skip anything
 * malformed" role `levelRegistry.ts`'s validation plays for level JSON: the
 * 44a store is hand-editable `localStorage`, and one bad entry must not take
 * the whole dropdown (or the editor) down with it.
 */
export function isBlueprint(value: unknown): value is Blueprint {
  if (value === null || typeof value !== 'object') return false;
  const { id, name, layout, background } = value as {
    id?: unknown;
    name?: unknown;
    layout?: unknown;
    background?: unknown;
  };
  if (typeof id !== 'string' || typeof name !== 'string') return false;
  if (!isLayout(layout)) return false;
  if (background !== undefined && !(Array.isArray(background) && background.every(isBackgroundPlacement)))
    return false;
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/BlueprintData.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/level/BlueprintData.ts src/themes/platformer/level/BlueprintData.test.ts
git commit -m "feat(platformer): add Blueprint data model for the editor's blueprint canvas"
```

---

### Task 2: `blueprintStash` — the placeholder saved-blueprint store

**Files:**
- Create: `src/themes/platformer/editor/blueprintStash.ts`
- Create: `src/themes/platformer/editor/blueprintStash.test.ts`

**Interfaces:**
- Consumes: `createLocalStorageSignal` (`@/lib/utils`), `Blueprint`/`isBlueprint` (Task 1's `../level/BlueprintData`), `BackgroundPlacement` (`../level/LevelData`).
- Produces: `BLUEPRINT_STASH_KEY`, `savedBlueprintsSignal: Signal<Blueprint[]>`, `blueprintId(name: string): string`, `readSavedBlueprints(): Blueprint[]`, `findSavedBlueprint(id: string): Blueprint | undefined`, `saveBlueprintToStash(name: string, layout: readonly string[], background: BackgroundPlacement[]): Blueprint`.

**Why a stash and not the real thing:** the design doc's "Step 44c — Saving and the
palette library" section is explicit that `saveBlueprintFile.ts`, the
`/__save-blueprint` Vite plugin and the `import.meta.glob` `blueprintRegistry.ts` are step
44c's job. 44a still needs somewhere to put a finished blueprint so "save it, reopen it
from the dropdown, keep editing" is real and testable end to end today, so this module
gives exactly `levelRegistry.ts`'s read shape (`readSavedBlueprints`/`findSavedBlueprint`)
plus `saveLevelFile.ts`'s slug rule, backed by `localStorage` instead of files. Step 44c
swaps the module's body; its callers (Tasks 5 and 6) do not change.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/editor/blueprintStash.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BLUEPRINT_STASH_KEY,
  blueprintId,
  findSavedBlueprint,
  readSavedBlueprints,
  saveBlueprintToStash,
  savedBlueprintsSignal,
} from './blueprintStash';

beforeEach(() => {
  savedBlueprintsSignal.value = [];
});

describe('blueprintId', () => {
  it('nameWithSpacesAndCaps-slugsToLowercaseHyphens', () => {
    expect(blueprintId('Cave Room Two')).toBe('cave-room-two');
  });

  it('nameWithNothingSlugWorthy-fallsBackToBlueprint', () => {
    expect(blueprintId('!!!')).toBe('blueprint');
  });
});

describe('saveBlueprintToStash', () => {
  it('savingABlueprint-storesItUnderItsSluggedId', () => {
    const saved = saveBlueprintToStash('Test Room', ['#G'], []);

    expect(saved).toEqual({ id: 'test-room', name: 'Test Room', layout: ['#G'] });
    expect(readSavedBlueprints()).toEqual([saved]);
  });

  it('emptyBackgroundList-isOmittedFromTheStoredEntry', () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);

    expect('background' in saved).toBe(false);
  });

  it('nonEmptyBackgroundList-isStoredAsGiven', () => {
    const background = [{ pieceId: 'dirtColumnTop1x1' as const, col: 1, row: 2 }];
    const saved = saveBlueprintToStash('Test Room', ['#'], background);

    expect(saved.background).toEqual(background);
  });

  it('savingTheSameNameTwice-replacesTheEntryRatherThanAppendingASecond', () => {
    saveBlueprintToStash('Test Room', ['#'], []);
    saveBlueprintToStash('Test Room', ['GG'], []);

    expect(readSavedBlueprints()).toHaveLength(1);
    expect(readSavedBlueprints()[0].layout).toEqual(['GG']);
  });

  it('severalBlueprints-areListedSortedById', () => {
    saveBlueprintToStash('Zeta', ['#'], []);
    saveBlueprintToStash('Alpha', ['#'], []);

    expect(readSavedBlueprints().map((entry) => entry.id)).toEqual(['alpha', 'zeta']);
  });

  it('savingABlueprint-persistsToLocalStorageUnderTheExpectedKey', () => {
    saveBlueprintToStash('Test Room', ['#'], []);

    expect(JSON.parse(localStorage.getItem(BLUEPRINT_STASH_KEY)!)).toEqual([
      { id: 'test-room', name: 'Test Room', layout: ['#'] },
    ]);
  });
});

describe('readSavedBlueprints', () => {
  it('malformedStoredEntry-isSkippedRatherThanReturned', () => {
    // A hand-edited (or older-shape) localStorage entry must not reach the
    // dropdown — same rule levelRegistry.ts applies to broken level JSON.
    savedBlueprintsSignal.value = [
      { id: 'good', name: 'Good', layout: ['#'] },
      { id: 'bad', name: 'Bad', layout: [] },
    ];

    expect(readSavedBlueprints().map((entry) => entry.id)).toEqual(['good']);
  });
});

describe('findSavedBlueprint', () => {
  it('knownId-returnsThatBlueprint', () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);

    expect(findSavedBlueprint('test-room')).toEqual(saved);
  });

  it('unknownId-returnsUndefined', () => {
    expect(findSavedBlueprint('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/blueprintStash.test.ts`
Expected: FAIL — `Cannot find module './blueprintStash'`. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/themes/platformer/editor/blueprintStash.ts
import { createLocalStorageSignal } from '@/lib/utils';
import { isBlueprint, type Blueprint } from '../level/BlueprintData';
import type { BackgroundPlacement } from '../level/LevelData';

export const BLUEPRINT_STASH_KEY = 'platformer-editor-saved-blueprints';

/**
 * Every blueprint saved in this browser so far — a PLACEHOLDER store for
 * roadmap step 44a only. Step 44c replaces this module's body with a real
 * `saveBlueprintFile.ts` (POST to the dev server, falling back to a
 * download) plus a build-time `blueprintRegistry.ts` glob, exactly the way
 * levels already work; the read/write functions below deliberately mirror
 * `levelRegistry.ts`/`saveLevelFile.ts`'s shape so that swap needs no
 * changes in `BlueprintSelect` or `LevelEditorPage`.
 */
export const savedBlueprintsSignal = createLocalStorageSignal<Blueprint[]>(
  BLUEPRINT_STASH_KEY,
  [],
);

/**
 * `'Cave Room Two'` → `'cave-room-two'`. The exact slug rule
 * `saveLevelFile.ts`'s `levelFileName` uses, minus the `.json` suffix, since
 * a blueprint's id is likewise its future filename stem. A name with nothing
 * slug-worthy in it still has to produce a usable id, hence the fallback.
 */
export const blueprintId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'blueprint' : slug;
};

/** Every well-formed stored blueprint. Anything malformed is skipped rather
 *  than thrown on (see `isBlueprint`). Order comes from the stored list,
 *  which `saveBlueprintToStash` keeps id-sorted on every write. */
export const readSavedBlueprints = (): Blueprint[] =>
  savedBlueprintsSignal.value.filter(isBlueprint);

export const findSavedBlueprint = (id: string): Blueprint | undefined =>
  readSavedBlueprints().find((entry) => entry.id === id);

/**
 * Stores `layout`/`background` (already cropped and rebased by
 * `cropLevelForExport`) under `name`, replacing any entry with the same
 * slugged id — saving under a name you already used overwrites it, the same
 * way saving a level file over its own filename does. `background` is
 * omitted entirely when empty, matching `levelFileJson`.
 */
export const saveBlueprintToStash = (
  name: string,
  layout: readonly string[],
  background: BackgroundPlacement[],
): Blueprint => {
  const blueprint: Blueprint = {
    id: blueprintId(name),
    name,
    layout,
    ...(background.length > 0 ? { background } : {}),
  };
  savedBlueprintsSignal.value = [
    ...savedBlueprintsSignal.value.filter((entry) => entry.id !== blueprint.id),
    blueprint,
  ].sort((a, b) => a.id.localeCompare(b.id));
  return blueprint;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/blueprintStash.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/blueprintStash.ts src/themes/platformer/editor/blueprintStash.test.ts
git commit -m "feat(platformer): add localStorage blueprint stash (placeholder for step 44c)"
```

---

### Task 3: Persisted blueprint-canvas signals

**Files:**
- Modify: `src/themes/platformer/editor/editorLevelState.ts`
- Modify: `src/themes/platformer/editor/editorLevelState.test.ts` (already exists — append
  a new `describe` block; the file relies on `globals: true` and imports no test helpers)

**Interfaces:**
- Consumes: `createLocalStorageSignal` (already imported at the top of `editorLevelState.ts`), `importLayout` (already imported), `BLANK_BLUEPRINT` (Task 1's `../level/BlueprintData`), `TileChar`/`BackgroundPlacement` (already imported).
- Produces: `editorCanvasModeSignal: Signal<'level' | 'blueprint'>`, `editorBlueprintSignal: Signal<TileChar[][]>`, `editorBlueprintBackgroundSignal: Signal<BackgroundPlacement[]>`, `editorLoadedBlueprintNameSignal: Signal<string>`.

The blueprint canvas gets the same persistence the level canvas has, for the same reason:
a half-painted room must still be there after a reload, exactly like a half-painted level.
This is in-progress *canvas* state and is separate from Task 2's stash of *saved*
blueprints.

- [ ] **Step 1: Write the failing test**

Extend the existing `'./editorLevelState'` import at the top of `editorLevelState.test.ts`
with the four new signals, add `import { BLANK_BLUEPRINT } from '../level/BlueprintData';`,
then append:

```typescript
describe('editorLevelState — blueprint canvas signals', () => {
  it('editorCanvasModeSignal-defaultsToLevel', () => {
    expect(editorCanvasModeSignal.value).toBe('level');
  });

  it('editorBlueprintSignal-defaultsToASingleEmptyCell', () => {
    expect(editorBlueprintSignal.value).toEqual(importLayout(BLANK_BLUEPRINT.layout));
  });

  it('editorBlueprintBackgroundSignal-defaultsToAnEmptyList', () => {
    expect(editorBlueprintBackgroundSignal.value).toEqual([]);
  });

  it('editorLoadedBlueprintNameSignal-defaultsToTheBlankEntrysName', () => {
    expect(editorLoadedBlueprintNameSignal.value).toBe(BLANK_BLUEPRINT.name);
  });

  it('writingTheBlueprintGrid-persistsToLocalStorageUnderTheExpectedKey', () => {
    const original = editorBlueprintSignal.value;
    try {
      const grid = importLayout(['##']);
      editorBlueprintSignal.value = grid;

      expect(JSON.parse(localStorage.getItem('platformer-editor-blueprint')!)).toEqual(grid);
    } finally {
      editorBlueprintSignal.value = original;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/themes/platformer/editor/editorLevelState.test.ts -t "blueprint canvas"`
Expected: FAIL — the four signals are not exported. Do not continue until you have seen
that failure output.

- [ ] **Step 3: Write the minimal implementation**

Add to `editorLevelState.ts`'s imports:

```typescript
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
```

Append at the end of the file, in the same shape as the signals above it:

```typescript
/**
 * Which canvas the editor is currently painting: the level's own `grid`, or
 * the separate blueprint canvas below. Independent of
 * `editorActiveLayerSignal` — that one says which LAYER (foreground or
 * background) of whichever canvas is active gets painted, and both toggles
 * keep working together (roadmap step 44a).
 */
export const editorCanvasModeSignal = createLocalStorageSignal<'level' | 'blueprint'>(
  'platformer-editor-canvas-mode',
  'level',
);

/**
 * The blueprint canvas's own foreground grid — a second, fully independent
 * grid, NOT a region of the level. Starts as one empty cell (the same blank
 * `BLANK_BLUEPRINT.layout` the Blueprint Select dropdown's `new` entry
 * loads) and is persisted exactly like `editorLevelSignal` above, so a room
 * half-painted yesterday is still there today.
 */
export const editorBlueprintSignal = createLocalStorageSignal<TileChar[][]>(
  'platformer-editor-blueprint',
  importLayout(BLANK_BLUEPRINT.layout),
);

/** The blueprint canvas's background-layer placements — the blueprint's
 *  counterpart of `editorBackgroundSignal`. Blueprints carry the same
 *  decorative background layer levels do. */
export const editorBlueprintBackgroundSignal = createLocalStorageSignal<BackgroundPlacement[]>(
  'platformer-editor-blueprint-background',
  [],
);

/** The name of the blueprint the canvas was last loaded from (or last saved
 *  as) — what the Blueprint Select trigger shows, mirroring
 *  `editorLoadedLevelNameSignal`. */
export const editorLoadedBlueprintNameSignal = createLocalStorageSignal<string>(
  'platformer-editor-loaded-blueprint',
  BLANK_BLUEPRINT.name,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/themes/platformer/editor/editorLevelState.test.ts`
Expected: PASS — the 5 new tests plus every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/editorLevelState.ts src/themes/platformer/editor/editorLevelState.test.ts
git commit -m "feat(platformer): add persisted blueprint-canvas editor signals"
```

---

### Task 4: `Palette` drops the Spawn tool in blueprint mode

**Files:**
- Modify: `src/themes/platformer/editor/Palette.tsx`
- Modify: `src/themes/platformer/editor/Palette.test.tsx`

**Interfaces:**
- Produces: `PaletteProps` gains `canvasMode?: 'level' | 'blueprint'` (OPTIONAL, defaulting to `'level'`). Consumed by Task 6's `LevelEditorPage`.

Optional, not required: `Palette.test.tsx` spreads a shared `defaultProps` at every render
site, but making it required would still force a value into that constant for a mode none
of its 13 existing tests care about, and `centerRequestId?: number` on `EditorCanvas` is the
existing precedent in this codebase for an opt-in editor capability. The Spawn filter
extends the existing `entityKeys` line — the same place `terrainKeys` already filters out
`PATROL_CHAR` and the decoration chars — rather than introducing any parallel mechanism.

- [ ] **Step 1: Write the failing tests**

Append to `Palette.test.tsx` (it already imports `describe`/`it`/`expect`/`vi`, `render`,
`screen`, and defines `defaultProps` at the top — reuse those):

```typescript
describe('Palette — blueprint canvas mode', () => {
  it('levelCanvasMode-stillOffersTheSpawnTool', () => {
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(screen.getByRole('button', { name: 'Spawn' })).toBeInTheDocument();
  });

  it('blueprintCanvasMode-dropsTheSpawnToolOnly', () => {
    // A blueprint has no spawn point, and offering the button would invite a
    // marker nothing downstream expects outside a real level's layout. Every
    // other entity tool stays.
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    expect(screen.queryByRole('button', { name: 'Spawn' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enemy Green' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coin' })).toBeInTheDocument();
  });

  it('omittedCanvasMode-behavesLikeLevelMode', () => {
    render(<Palette {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Spawn' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/Palette.test.tsx -t "blueprint canvas mode"`
Expected: FAIL — TypeScript rejects the unknown `canvasMode` prop and the
`blueprintCanvasMode` test finds a Spawn button. Do not continue until you have seen that
failure output.

- [ ] **Step 3: Write the minimal implementation**

In `Palette.tsx`, add to `PaletteProps` (after `onSelectBackgroundPiece`):

```typescript
  /** Which canvas the palette is arming tools for. Optional and defaulting to
   *  `'level'` so every existing render site is unaffected; `'blueprint'`
   *  drops the Spawn tool (roadmap step 44a). */
  canvasMode?: 'level' | 'blueprint';
```

Add the character constant next to `PATROL_CHAR`:

```typescript
const SPAWN_CHAR: TileChar = 'S';
```

Destructure the prop with its default in the component's parameter list:

```typescript
  canvasMode = 'level',
```

Replace the existing `entityKeys` line:

```typescript
  const entityKeys = Object.keys(ENTITY_CHARS) as TileChar[];
```

with:

```typescript
  // Spawn is dropped on the blueprint canvas: a blueprint has no spawn point
  // (roadmap step 44a), and offering the button would just invite a marker
  // nothing downstream expects to find outside a real level's layout.
  const entityKeys = (Object.keys(ENTITY_CHARS) as TileChar[]).filter(
    (key) => canvasMode === 'level' || key !== SPAWN_CHAR,
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/Palette.test.tsx`
Expected: PASS — the 3 new tests plus every pre-existing test in the file (in particular
the button-count test, which renders in the default level mode and so still counts every
entity char).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/Palette.tsx src/themes/platformer/editor/Palette.test.tsx
git commit -m "feat(platformer): drop the Spawn palette tool on the blueprint canvas"
```

---

### Task 5: `BlueprintSelect` — the blueprint dropdown

**Files:**
- Create: `src/themes/platformer/editor/BlueprintSelect.tsx`
- Create: `src/themes/platformer/editor/BlueprintSelect.test.tsx`

**Interfaces:**
- Consumes: `BLANK_BLUEPRINT`/`Blueprint` (Task 1), `readSavedBlueprints` (Task 2), `Select*` (`@/components/ui/select`), `Dialog*` (`@/components/ui/dialog`), `Button` (`@/components/ui/button`), `useSignals` (`@preact/signals-react/runtime`).
- Produces: `interface BlueprintSelectProps { loadedBlueprintName: string; isDirty: boolean; onLoadBlueprint: (blueprint: Blueprint) => void }`, `BlueprintSelect`.

A direct mirror of `LevelSelect.tsx`, including its two deliberate choices: the `Select` is
driven as an action menu (`value={null}`, loaded name shown as the trigger's own text) so
re-picking the open entry still reloads it, and a dirty canvas gets the same
discard-confirmation dialog. It differs in one way only: the entry list comes from a
signal rather than a build-time constant, so the component calls `useSignals()` (the
convention every signal-reading component in this repo follows, e.g.
`src/components/ThemeSelect.tsx`) and a blueprint saved moments ago appears without a
reload.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/themes/platformer/editor/BlueprintSelect.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlueprintSelect } from './BlueprintSelect';
import { savedBlueprintsSignal, saveBlueprintToStash } from './blueprintStash';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';

const openDropdown = () => fireEvent.click(screen.getByRole('combobox'));

beforeEach(() => {
  savedBlueprintsSignal.value = [];
});

describe('BlueprintSelect', () => {
  it('open-listsTheBlankNewEntry', () => {
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(screen.getByRole('option', { name: 'new' })).toBeInTheDocument();
  });

  it('open-listsEverySavedBlueprint', () => {
    saveBlueprintToStash('Test Room', ['#'], []);
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(screen.getByRole('option', { name: 'Test Room' })).toBeInTheDocument();
  });

  it('namesTheLoadedBlueprintOnTheTriggerSoItIsVisibleWithoutOpening', () => {
    render(
      <BlueprintSelect loadedBlueprintName="Test Room" isDirty={false} onLoadBlueprint={vi.fn()} />,
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Test Room');
  });

  it('notDirty-selectingASavedBlueprint-loadsItWithNoConfirmation', async () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));

    expect(onLoadBlueprint).toHaveBeenCalledWith(saved);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('notDirty-selectingTheBlankEntry-loadsTheBlankBlueprint', async () => {
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="Test Room" isDirty={false} onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'new' }));

    expect(onLoadBlueprint).toHaveBeenCalledWith(BLANK_BLUEPRINT);
  });

  it('dirty-selectingAnotherBlueprint-doesNotLoadItYet', async () => {
    saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));

    expect(onLoadBlueprint).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('dirty-confirmingTheDialog-loadsTheSelectedBlueprint', async () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));

    expect(onLoadBlueprint).toHaveBeenCalledWith(saved);
  });

  it('dirty-cancellingTheDialog-loadsNothing', async () => {
    saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onLoadBlueprint).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Reopening the blueprint you are already on is "start this room over",
  // exactly the reset case LevelSelect's own action-menu Select preserves.
  it('dirty-reselectingTheLoadedBlueprint-reloadsItAfterConfirmation', async () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="Test Room" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));

    expect(onLoadBlueprint).toHaveBeenCalledWith(saved);
  });

  it('malformedStoredEntry-isNotOfferedAsAnOption', () => {
    savedBlueprintsSignal.value = [{ id: 'bad', name: 'Bad', layout: [] }];
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(screen.queryByRole('option', { name: 'Bad' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/BlueprintSelect.test.tsx`
Expected: FAIL — `Cannot find module './BlueprintSelect'`. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// src/themes/platformer/editor/BlueprintSelect.tsx
import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BLANK_BLUEPRINT, type Blueprint } from '../level/BlueprintData';
import { readSavedBlueprints } from './blueprintStash';

export interface BlueprintSelectProps {
  /** Name of the blueprint currently open — shown on the dropdown's trigger. */
  loadedBlueprintName: string;
  /** Whether the blueprint canvas has unsaved edits, i.e. whether loading has
   *  to ask first. */
  isDirty: boolean;
  onLoadBlueprint: (blueprint: Blueprint) => void;
}

/**
 * The editor's blueprint dropdown (roadmap step 44a) — the blueprint canvas's
 * counterpart of `LevelSelect`, deliberately built the same way: `value` is
 * pinned to `null` and the loaded name is shown as the trigger's own text, so
 * re-picking the entry you are already on still reloads it ("I've made a mess
 * of this room, give me it back") instead of being swallowed as an
 * already-selected no-op.
 *
 * Unlike `LevelSelect`'s build-time `LEVELS` constant, the entries come from
 * a signal (`blueprintStash.ts` — a placeholder store step 44c replaces with
 * a real registry), hence `useSignals()`: a blueprint saved moments ago has
 * to appear without a reload.
 */
export const BlueprintSelect = ({
  loadedBlueprintName,
  isDirty,
  onLoadBlueprint,
}: BlueprintSelectProps) => {
  useSignals();
  const [pendingBlueprint, setPendingBlueprint] = useState<Blueprint | null>(null);

  const entries: Blueprint[] = [BLANK_BLUEPRINT, ...readSavedBlueprints()];

  const handleSelect = (value: string | null) => {
    if (value === null) return;
    const blueprint = entries.find((entry) => entry.id === value);
    if (blueprint === undefined) return;

    if (isDirty) {
      setPendingBlueprint(blueprint);
      return;
    }
    onLoadBlueprint(blueprint);
  };

  const confirmPendingBlueprint = () => {
    if (pendingBlueprint !== null) onLoadBlueprint(pendingBlueprint);
    setPendingBlueprint(null);
  };

  const items = Object.fromEntries(entries.map((entry) => [entry.id, entry.name]));

  return (
    <>
      <Select value={null} onValueChange={handleSelect} items={items}>
        <SelectTrigger className="w-full" aria-label="Blueprint">
          <SelectValue placeholder={loadedBlueprintName} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {entries.map((entry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {entry.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog
        open={pendingBlueprint !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBlueprint(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes to “{loadedBlueprintName}”?</DialogTitle>
            <DialogDescription>
              Loading “{pendingBlueprint?.name}” replaces the blueprint canvas and discards your
              unsaved edits to “{loadedBlueprintName}”. Save it first if you want to keep it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="button" variant="destructive" onClick={confirmPendingBlueprint}>
              Discard and load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/BlueprintSelect.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/BlueprintSelect.tsx src/themes/platformer/editor/BlueprintSelect.test.tsx
git commit -m "feat(platformer): add BlueprintSelect dropdown mirroring LevelSelect"
```

---

### Task 6: `LevelEditorPage` — the Level/Blueprint toggle and the retargeted canvas

**Files:**
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`

**Interfaces:**
- Consumes: the four signals from Task 3, `BLANK_BLUEPRINT` (Task 1 — in the TEST file only, for the signal resets; the page itself never names it), `Palette`'s `canvasMode` prop (Task 4).
- Produces: no new exports — this wires the page's own state and JSX. `<EditorCanvas>` gains **no new props**.

**Design notes (read before writing the code):**

1. `EditorCanvas` is untouched. In blueprint mode the page simply passes
   `grid={blueprintGrid}` and `backgroundPlacements={blueprintBackgroundPlacements}` into
   the props that already exist, and routes `onPaint`/`onPaintBackground` to the blueprint
   setters. `paintCell`/`growGrid`/`placeBackgroundPiece`/`eraseBackgroundCell` therefore
   run verbatim, on the blueprint's data, with no branch anywhere inside the canvas.
2. **Each canvas keeps its own pan offset.** The level view is spawn-centered (often
   thousands of pixels off origin); reusing that offset for a one-cell blueprint would put
   the blueprint's only cell far outside the viewport, making blueprint mode look broken.
   Two `PanOffset` states with an active-one ternary keeps each view where its author left
   it — and, as a bonus, pins the blueprint canvas's pan at `{ x: 0, y: 0 }` in tests, so
   `clientX = col * RENDERED_TILE_SIZE + 1` maps to exactly `col`.
3. The dirty flags stay separate too (`isDirty` for the level, `blueprintDirty` for the
   blueprint): painting a room must not make the *level* dropdown warn about discarding
   work, and vice versa.
4. **Dropping Spawn from the palette is not enough on its own.** `selectedTool` is
   persisted (`editorSelectedToolSignal`) and shared by both canvases, so a session that
   left `'S'` armed and then switches to Blueprint would show a palette with nothing
   selected while every click still painted an `'S'` marker into a blueprint that has no
   concept of a spawn — exactly what Task 4 removes the button to prevent. The page
   therefore also disarms the tool: on entering blueprint mode, and on mounting already in
   it (the mode is persisted too).
5. **The one-shot spawn-centering has to stay a level concern.** `EditorCanvas`'s
   `centerRequestId` effect fires exactly once per request and disarms itself
   (`pendingCenterRef`), and the page's `centerRequestId` starts at `1` so opening the
   editor is itself a request. Mounting already in blueprint mode would let the blueprint
   canvas consume that one request — `centerPanOnSpawn` returns `{ x: 0, y: 0 }` for a
   spawn-less grid, so it is a no-op there — and the level would then never be centered on
   its spawn at all, silently regressing today's "the view starts where the level starts"
   behavior. A ref tracks that debt and spends it on the *first* switch back to Level, and
   only that one: re-requesting on every toggle would yank a hand-panned level view back to
   the spawn, which point 2's per-canvas pan exists to avoid. `EditorCanvas` still needs no
   change — this is entirely the page deciding when to bump the request id it already owns.

**Test-determinism notes:**

- `editorSelectedToolSignal` is NOT reset by the suite's `beforeEach` today and other tests
  write to it, so Step 1 below adds that reset, and the blueprint helper still sets the
  tool explicitly before `render()` (the page seeds its `selectedTool` `useState` from that
  signal at mount, so writing it after `render()` would have no effect).
- The blueprint canvas starts at `[['.']]` with pan `{ x: 0, y: 0 }`, so painting at
  `clientX = 2 * RENDERED_TILE_SIZE + 1, clientY = RENDERED_TILE_SIZE + 1` targets
  `(col 2, row 1)`, which `growGrid` reaches by growing right/down only —
  `colShift`/`rowShift` are both 0 and no coordinate is remapped.
- Both grid syncs are debounced by 400 ms, so assertions on the signals go inside
  `waitFor`, matching the existing background-layer tests.

- [ ] **Step 1: Write the failing tests**

First extend the suite's shared `beforeEach` in `LevelEditorPage.test.tsx` — these are
module-level persisted signals, so without resetting them a blueprint test would seed the
next one:

```typescript
  editorCanvasModeSignal.value = 'level';
  editorBlueprintSignal.value = importLayout(BLANK_BLUEPRINT.layout);
  editorBlueprintBackgroundSignal.value = [];
  editorLoadedBlueprintNameSignal.value = BLANK_BLUEPRINT.name;
  savedBlueprintsSignal.value = [];
  // Not reset by the suite today, and the new Spawn-disarm test writes 'S'
  // into it — without this, that write would leak into every test that runs
  // after it and silently change which tool their clicks paint.
  editorSelectedToolSignal.value = 'G';
```

Extend the existing `'./editorLevelState'` import with `editorCanvasModeSignal`,
`editorBlueprintSignal`, `editorBlueprintBackgroundSignal` and
`editorLoadedBlueprintNameSignal` (one import statement, not a second one), and add:

```typescript
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import { savedBlueprintsSignal, readSavedBlueprints } from './blueprintStash';
```

Then append at the end of the file:

```tsx
// The blueprint canvas starts as one empty cell at pan {0,0}, so a click at
// col * RENDERED_TILE_SIZE + 1 lands on exactly that column (see the
// test-determinism notes in the plan).
function paintBlueprintCell(col: number, row: number) {
  const canvas = document.querySelector('canvas')!;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
  fireEvent.mouseDown(canvas, {
    button: 0,
    clientX: col * RENDERED_TILE_SIZE + 1,
    clientY: row * RENDERED_TILE_SIZE + 1,
  });
}

function renderEditorInBlueprintMode() {
  editorSelectedToolSignal.value = 'G';
  render(<LevelEditorPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));
}

describe('LevelEditorPage — Level/Blueprint canvas toggle (step 44a)', () => {
  it('onMount-theLevelCanvasIsActiveAndTheLayerToggleIsStillThere', () => {
    render(<LevelEditorPage />);

    expect(screen.getByRole('button', { name: 'Level' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Blueprint' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Two independent axes: picking a canvas never removes the layer toggle.
    expect(screen.getByRole('button', { name: 'Foreground' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Background' })).toBeInTheDocument();
  });

  it('clickingBlueprint-marksTheBlueprintCanvasActiveAndPersistsTheMode', () => {
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.getByRole('button', { name: 'Blueprint' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(editorCanvasModeSignal.value).toBe('blueprint');
  });

  it('blueprintModeActive-thePaletteDropsTheSpawnTool', () => {
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.queryByRole('button', { name: 'Spawn' })).not.toBeInTheDocument();
  });

  it('backToLevelMode-thePaletteOffersSpawnAgain', () => {
    render(<LevelEditorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    fireEvent.click(screen.getByRole('button', { name: 'Level' }));

    expect(screen.getByRole('button', { name: 'Spawn' })).toBeInTheDocument();
  });

  it('paintingInBlueprintMode-writesToTheBlueprintGridAndLeavesTheLevelGridAlone', async () => {
    const levelGridBefore = editorLevelSignal.value;
    renderEditorInBlueprintMode();

    paintBlueprintCell(2, 1);

    await waitFor(() => {
      expect(editorBlueprintSignal.value[1][2]).toBe('G');
    });
    expect(editorLevelSignal.value).toEqual(levelGridBefore);
  });

  it('paintingInBlueprintMode-doesNotMarkTheLevelDirty', async () => {
    renderEditorInBlueprintMode();

    paintBlueprintCell(2, 1);

    await waitFor(() => expect(editorBlueprintSignal.value[1][2]).toBe('G'));
    expect(editorDirtySignal.value).toBe(false);
  });

  it('paintingTheBackgroundLayerInBlueprintMode-writesToTheBlueprintBackgroundOnly', async () => {
    renderEditorInBlueprintMode();
    // The Foreground/Background toggle keeps switching LAYERS, now on the
    // blueprint's own two layers.
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));

    paintBlueprintCell(0, 0);

    await waitFor(() => expect(editorBlueprintBackgroundSignal.value).toHaveLength(1));
    expect(editorBackgroundSignal.value).toEqual([]);
  });

  it('blueprintCanvasContent-survivesSwitchingToTheLevelAndBack', async () => {
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    await waitFor(() => expect(editorBlueprintSignal.value[1][2]).toBe('G'));

    fireEvent.click(screen.getByRole('button', { name: 'Level' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(editorBlueprintSignal.value[1][2]).toBe('G');
  });

  it('spawnToolStillArmed-switchingToBlueprint-disarmsItSoClicksCannotPaintASpawn', () => {
    // The palette merely stops OFFERING Spawn (Task 4). `selectedTool` is
    // persisted and shared by both canvases, so without an explicit disarm a
    // session that left 'S' armed would paint spawn markers into a blueprint
    // through a palette showing nothing selected (design note 4).
    editorSelectedToolSignal.value = 'S';
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(editorSelectedToolSignal.value).not.toBe('S');
    expect(screen.getByRole('button', { name: 'Ground Grass' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('mountedInBlueprintModeWithSpawnArmed-disarmsItWithoutAnyToggleClick', () => {
    // Both the mode and the tool are persisted, so the editor can come back
    // up already on the blueprint canvas with 'S' selected and no toggle
    // click to trigger the other disarm path.
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = 'S';

    render(<LevelEditorPage />);

    expect(editorSelectedToolSignal.value).not.toBe('S');
    expect(screen.queryByRole('button', { name: 'Spawn' })).not.toBeInTheDocument();
  });

  it('mountedInBlueprintMode-firstSwitchToLevel-centersTheLevelOnItsSpawn', async () => {
    // Mounting in blueprint mode lets the blueprint canvas consume the
    // editor's one-shot centering request, which is a no-op on a spawn-less
    // grid — the level must still get centered when it first becomes active
    // (design note 5), rather than sitting unpanned at its top-left corner.
    editorCanvasModeSignal.value = 'blueprint';
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Level' }));

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const expected = centerPanOnSpawn(
      importLayout(LEVEL_1_LAYOUT),
      canvas.width,
      canvas.height,
    );
    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      const [, , , , originX, originY] = calls[calls.length - 1];
      expect({ x: originX, y: originY }).toEqual(expected);
    });
  });

  it('switchingBackToLevelASecondTime-doesNotYankAHandPannedViewBackToTheSpawn', async () => {
    render(<LevelEditorPage />);
    await waitFor(() => expect(drawTerrain).toHaveBeenCalled());
    // Pan the level view away from where it opened (middle-button drag).
    const canvas = document.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
    fireEvent.mouseDown(canvas, { button: 1, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 0 });
    fireEvent.mouseUp(canvas);
    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[calls.length - 1][4]).not.toBe(
        centerPanOnSpawn(importLayout(LEVEL_1_LAYOUT), canvas.width, canvas.height).x,
      );
    });
    const pannedX = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls.at(-1)![4];

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Level' }));

    await waitFor(() => {
      const calls = (drawTerrain as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[calls.length - 1][4]).toBe(pannedX);
    });
  });
});
```

`drawTerrain`, `centerPanOnSpawn`, `LEVEL_1_LAYOUT` and `editorSelectedToolSignal` are all
already imported by this test file — no import additions beyond the ones listed above.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx -t "canvas toggle"`
Expected: FAIL — there is no "Blueprint" button yet. Do not continue until you have seen
that failure output.

- [ ] **Step 3: Implement the state and the toggle**

Widen `LevelEditorPage.tsx`'s existing React import (do NOT add a second `from 'react'`
line) to:

```typescript
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
```

and, inside the existing `'./editorLevelState'` import block, add
`editorCanvasModeSignal`, `editorBlueprintSignal`, `editorBlueprintBackgroundSignal` and
`editorLoadedBlueprintNameSignal`. Nothing else is imported here — in particular NOT
`BLANK_BLUEPRINT`: the page never names it (the signal's own default carries it), and an
unused import fails `@typescript-eslint/no-unused-vars`.

Add the spawn constant next to the file's other module constants (above the component):

```typescript
// Blueprint mode has no Spawn tool (Task 4), so an already-armed Spawn is
// swapped for this when the blueprint canvas becomes active.
const SPAWN_CHAR: TileChar = 'S';
const BLUEPRINT_FALLBACK_TOOL: TileChar = 'G';
```

Leave the existing `selectedTool` `useState` initializer alone — the mount case is covered
by a one-shot effect further down instead, so the disarm always goes through
`setSelectedTool`, which writes local state *and* `editorSelectedToolSignal` together. A
corrected initializer would fix local state only and leave the signal still saying `'S'`,
which is exactly the double-source-of-truth this file's `set*` wrappers exist to avoid.

Add the state, right after the existing `selectedBackgroundPiece` block and before
`panOffset`:

```typescript
  // Which canvas is being edited (roadmap step 44a). Orthogonal to
  // `activeLayer` above: that one picks foreground/background WITHIN
  // whichever canvas this one selects, and both toggles stay visible and
  // keep working together.
  const [canvasMode, setCanvasModeState] = useState<'level' | 'blueprint'>(
    () => editorCanvasModeSignal.value,
  );
  // Whether the level canvas still owes itself a spawn-centering. Mounting
  // already in blueprint mode lets that canvas consume EditorCanvas's
  // one-shot centering request (a no-op on a spawn-less grid), so the debt
  // is tracked here and spent on the FIRST switch back to Level — never on
  // later ones, which would yank a hand-panned view back to the spawn
  // (design note 5).
  const levelCenterPendingRef = useRef(editorCanvasModeSignal.value === 'blueprint');
  const setCanvasMode = (mode: 'level' | 'blueprint') => {
    setCanvasModeState(mode);
    editorCanvasModeSignal.value = mode;
    if (mode === 'blueprint' && selectedTool === SPAWN_CHAR) {
      setSelectedTool(BLUEPRINT_FALLBACK_TOOL);
    }
    if (mode === 'level' && levelCenterPendingRef.current) {
      levelCenterPendingRef.current = false;
      requestCenterOnSpawn();
    }
  };
  const isBlueprintMode = canvasMode === 'blueprint';
  // NOTE: `setCanvasMode` closes over `requestCenterOnSpawn`, which is
  // declared a few lines below (with `centerRequestId`). That is safe — the
  // only caller is the toggle's `onClick`, which cannot run until the whole
  // component body has evaluated — and keeps the two toggle-related blocks
  // together instead of interleaving them with the pan/center declarations.
  // The blueprint canvas's own grid/background/name — a second, fully
  // independent canvas, not a region of the level. Same
  // seeded-from-a-persisted-signal, debounce-synced-back pattern as `grid`
  // and `backgroundPlacements` above.
  const [blueprintGrid, setBlueprintGrid] = useState<TileChar[][]>(
    () => editorBlueprintSignal.value,
  );
  const [blueprintBackgroundPlacements, setBlueprintBackgroundPlacements] = useState<
    BackgroundPlacement[]
  >(() => editorBlueprintBackgroundSignal.value);
  const [loadedBlueprintName, setLoadedBlueprintNameState] = useState(
    () => editorLoadedBlueprintNameSignal.value,
  );
  const setLoadedBlueprintName = (name: string) => {
    setLoadedBlueprintNameState(name);
    editorLoadedBlueprintNameSignal.value = name;
  };
  // Deliberately separate from the level's `isDirty`: painting a room must
  // not make the LEVEL dropdown warn about discarding work, and editing the
  // level must not make the blueprint dropdown warn either. Not persisted —
  // unlike the level's flag it guards nothing across reloads, since a
  // freshly reopened blueprint canvas is whatever was last painted on it.
  const [blueprintDirty, setBlueprintDirty] = useState(false);
```

Give the blueprint canvas its own pan, replacing the single `panOffset` declaration:

```typescript
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  // Each canvas keeps its own view. The level's pan is spawn-centered and
  // typically thousands of pixels from the origin; reusing it for a
  // one-cell blueprint would park that cell far outside the viewport and
  // make blueprint mode look broken.
  const [blueprintPanOffset, setBlueprintPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const activePanOffset = isBlueprintMode ? blueprintPanOffset : panOffset;
  const setActivePanOffset = isBlueprintMode ? setBlueprintPanOffset : setPanOffset;
```

Add the shared growth-compensation helper next to `saveCurrentLevel`, so both canvases
handle a grown grid identically:

```typescript
  /**
   * What both canvases do when a paint grew their grid: a cell at index i
   * draws at i * RENDERED_TILE_SIZE + pan, and growth increases every
   * existing index by colShift/rowShift, so the active pan moves by the
   * negative of that to cancel it out (spec FR-020/SC-006) and every
   * background placement shifts with it, since `growGrid` never touches that
   * separate list (Task 20 gap #1).
   */
  const applyGrowthShift = (
    colShift: number,
    rowShift: number,
    setPlacements: Dispatch<SetStateAction<BackgroundPlacement[]>>,
  ) => {
    if (colShift === 0 && rowShift === 0) return;
    setActivePanOffset((prev) =>
      updatePanOffset(prev, -colShift * RENDERED_TILE_SIZE, -rowShift * RENDERED_TILE_SIZE),
    );
    setPlacements((prev) =>
      prev.map((placement) => ({
        ...placement,
        col: placement.col + colShift,
        row: placement.row + rowShift,
      })),
    );
  };
```

Add the two debounced sync effects, directly below the existing `backgroundPlacements`
one:

```typescript
  // Mount-time counterpart of setCanvasMode's Spawn disarm: the mode is
  // persisted, so the editor can come back up already on the blueprint
  // canvas with 'S' still armed, without any toggle click ever happening
  // (design note 4). Deliberately mount-only — a later mode switch is the
  // other handler's job, and re-running this on every `selectedTool` change
  // would fight the (currently impossible, but not worth wiring a trap for)
  // case of Spawn being selected some other way.
  useEffect(() => {
    if (isBlueprintMode && selectedTool === SPAWN_CHAR) setSelectedTool(BLUEPRINT_FALLBACK_TOOL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same debounced localStorage sync the level's own grid/background get
  // above — the blueprint canvas is persisted for exactly the same reason: a
  // half-painted room must still be there after a reload.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      editorBlueprintSignal.value = blueprintGrid;
    }, EDITOR_LEVEL_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [blueprintGrid]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      editorBlueprintBackgroundSignal.value = blueprintBackgroundPlacements;
    }, EDITOR_LEVEL_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [blueprintBackgroundPlacements]);
```

Add the toggle JSX immediately after the closing `</div>` of the existing
`role="group" aria-label="Layer"` group, mirroring its markup exactly:

```tsx
          <div className="flex gap-2" role="group" aria-label="Canvas">
            <button
              type="button"
              aria-pressed={!isBlueprintMode}
              className={cn('rounded px-2 py-1 text-sm', !isBlueprintMode && 'bg-muted font-medium')}
              onClick={() => setCanvasMode('level')}
            >
              Level
            </button>
            <button
              type="button"
              aria-pressed={isBlueprintMode}
              className={cn('rounded px-2 py-1 text-sm', isBlueprintMode && 'bg-muted font-medium')}
              onClick={() => setCanvasMode('blueprint')}
            >
              Blueprint
            </button>
          </div>
```

Pass the mode to the palette — replace `<Palette ... />`'s prop list's last line by adding:

```tsx
            canvasMode={canvasMode}
```

Finally, retarget the canvas. Replace the `grid`, `backgroundPlacements`, `panOffset`,
`onPaintBackground`, `onPaint` and `onPan` props of `<EditorCanvas>` with:

```tsx
          grid={isBlueprintMode ? blueprintGrid : grid}
          panOffset={activePanOffset}
          backgroundPlacements={isBlueprintMode ? blueprintBackgroundPlacements : backgroundPlacements}
          onPaintBackground={(next) => {
            if (isBlueprintMode) {
              setBlueprintBackgroundPlacements(next);
              setBlueprintDirty(true);
              return;
            }
            setBackgroundPlacements(next);
            // Same dirty-flag bookkeeping as the foreground onPaint below —
            // painting the background layer also leaves the loaded level
            // behind, so switching levels afterward must still ask before
            // discarding it (see LevelSelect's isDirty prop).
            if (!isDirty) setDirty(true);
            if (saveResult !== null) setSaveResult(null);
          }}
          onPaint={({ grid: nextGrid, colShift, rowShift }) => {
            // The blueprint canvas paints through the exact same
            // paintCell/growGrid path — only the state it lands in differs.
            if (isBlueprintMode) {
              setBlueprintGrid(nextGrid);
              setBlueprintDirty(true);
              applyGrowthShift(colShift, rowShift, setBlueprintBackgroundPlacements);
              return;
            }
            setGrid(nextGrid);
            // Every paint and erase goes through here, so this is the one
            // place the grid can start differing from the loaded level. The
            // "saved to ..." line goes with it: the file on disk no longer
            // matches what is on screen.
            if (!isDirty) setDirty(true);
            if (saveResult !== null) setSaveResult(null);
            applyGrowthShift(colShift, rowShift, setBackgroundPlacements);
          }}
          onPan={setActivePanOffset}
```

The `centerRequestId`, `images`, `activeLayer`, `selectedTool` and
`selectedBackgroundPiece` props are passed exactly as they are today — `centerRequestId`
included, unconditionally. Making it mode-dependent (e.g. `undefined` in blueprint mode)
would look tempting but is wrong: flipping it back to a number on the next switch to Level
re-arms `pendingCenterRef` and re-centers the level on *every* toggle. The mount-in-
blueprint case is instead handled by `levelCenterPendingRef` above, which bumps the request
id exactly once. A spawn-less blueprint grid makes `centerPanOnSpawn` return
`{ x: 0, y: 0 }` (see `EditorPan.ts`), which is already where the blueprint pan starts, so
the mount request being consumed there changes nothing visible.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: PASS — the 11 new tests plus every pre-existing test in the file. Two
pre-existing tests are the load-bearing regression guards here: "shifts existing
backgroundPlacements by colShift/rowShift…" proves the `applyGrowthShift` extraction
preserved the level path's behavior exactly, and
"selectingMain-recentersTheViewOnTheShippedLayoutsSpawn" proves the centering request id is
still spent the way it always was in the ordinary level-only flow.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx
git commit -m "feat(platformer): add the Level/Blueprint canvas toggle to the Level Editor"
```

---

### Task 7: `LevelEditorPage` — swapping Select+Save pair and the Save Blueprint dialog

**Files:**
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`

**Interfaces:**
- Consumes: `BlueprintSelect` (Task 5), `saveBlueprintToStash` (Task 2), `Blueprint` (Task 1; `BLANK_BLUEPRINT` only in the test file), `cropLevelForExport` and `importLayout` (already imported by the page).
- Produces: no new exports.

Only one Select+Save pair renders at a time, never both stacked — which also keeps the
suite's many unqualified `getByRole('combobox')` / `getByRole('button', { name: 'Save' })`
queries unambiguous, since those all run in the default level mode.

**Query convention for the new tests:** exactly one `combobox` exists in either mode, so
the tests below use the suite's existing unqualified `getByRole('combobox')` rather than
naming it. Do NOT reach for `getByRole('combobox', { name: 'Blueprint' })`: whether Base
UI's `Select.Trigger` surfaces the `aria-label` as its accessible name, or overrides it
with an `aria-labelledby` pointing at the value span, is an implementation detail of the
vendored `src/components/ui/select.tsx` that no existing test depends on — and
`getByRole('combobox')` throwing on a second match is itself the assertion that the pairs
never render stacked. Which pair is showing is asserted through the Save buttons, whose
names (`Save` vs `Save Blueprint`) are ours.

- [ ] **Step 1: Write the failing tests**

Append to `LevelEditorPage.test.tsx`, reusing `paintBlueprintCell` and
`renderEditorInBlueprintMode` from Task 6:

```tsx
async function saveBlueprintAs(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Save Blueprint' }));
  const nameField = await screen.findByLabelText(/blueprint name/i);
  await userEvent.clear(nameField);
  await userEvent.type(nameField, name);
  await userEvent.click(screen.getByRole('button', { name: 'Save blueprint' }));
}

describe('LevelEditorPage — blueprint select and save (step 44a)', () => {
  it('levelMode-showsTheLevelSelectAndSaveButOfferNoBlueprintPair', () => {
    render(<LevelEditorPage />);

    // Exactly one combobox — getByRole throws on a second, so this is also
    // the "never both pairs stacked" assertion.
    expect(screen.getByRole('combobox')).toHaveTextContent('main');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Blueprint' })).not.toBeInTheDocument();
  });

  it('blueprintMode-swapsInTheBlueprintPairAndHidesTheLevelPair', () => {
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.getByRole('combobox')).toHaveTextContent('new');
    expect(screen.getByRole('button', { name: 'Save Blueprint' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    // Export serializes the level grid and Try boots the game from it —
    // both meaningless for a spawn-less blueprint, so they go with the
    // level pair rather than staying visible and broken.
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try' })).not.toBeInTheDocument();
  });

  it('savingTheBlueprintCanvas-storesItCroppedToItsPaintedCells', async () => {
    renderEditorInBlueprintMode();
    // One cell painted at (col 2, row 1) of an otherwise-empty canvas: the
    // crop's tightest non-'.' bounding box is that single cell, so the
    // stored layout is exactly ['G'].
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    expect(readSavedBlueprints()).toEqual([
      { id: 'test-room', name: 'Test Room', layout: ['G'] },
    ]);
  });

  it('savingTheBlueprintCanvas-namesItOnTheDropdownTriggerAndClosesTheDialog', async () => {
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    expect(screen.getByRole('combobox')).toHaveTextContent('Test Room');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('savingTheBlueprintCanvas-writesNoLevelFileAndLeavesTheLevelUntouched', async () => {
    const levelGridBefore = editorLevelSignal.value;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    // Step 44a's stash is localStorage-only; the dev-server write endpoint
    // belongs to step 44c.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(editorLevelSignal.value).toEqual(levelGridBefore);
  });

  it('savingABlueprintWithBackgroundPieces-storesThemRebasedOntoTheSameOrigin', async () => {
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    // The foreground crop's origin is (col 2, row 1) — the only painted
    // cell — so a background piece placed on that same cell rebases to
    // (col 0, row 0).
    expect(readSavedBlueprints()[0].background).toEqual([
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
    ]);
  });

  it('reopeningASavedBlueprint-loadsItsLayoutBackOntoTheCanvas', async () => {
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    await saveBlueprintAs('Test Room');

    // Load the blank entry first, then the saved one back — proving the
    // dropdown really replaces the canvas both ways.
    fireEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'new' }));
    await waitFor(() =>
      expect(editorBlueprintSignal.value).toEqual(importLayout(BLANK_BLUEPRINT.layout)),
    );

    fireEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'Test Room' }));

    await waitFor(() => expect(editorBlueprintSignal.value).toEqual(importLayout(['G'])));
  });

  it('loadingABlueprintWithUnsavedEdits-asksBeforeDiscardingThem', async () => {
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    // Wait for the debounced sync FIRST. Without it the signal would still
    // hold the pre-paint blank canvas, and the "was not replaced" assertion
    // below would pass for the wrong reason (or fail, depending on timing) —
    // the blank canvas is exactly what loading would have written.
    await waitFor(() => expect(editorBlueprintSignal.value[1][2]).toBe('G'));

    fireEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'new' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // `loadBlueprint` writes the signal directly (not only local state), so
    // the painted cell still being there proves nothing was loaded yet.
    expect(editorBlueprintSignal.value[1][2]).toBe('G');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx -t "blueprint select and save"`
Expected: FAIL — there is no "Save Blueprint" button and no blueprint combobox. Do not
continue until you have seen that failure output.

- [ ] **Step 3: Implement**

Add to `LevelEditorPage.tsx`'s imports:

```typescript
import { BlueprintSelect } from './BlueprintSelect';
import { saveBlueprintToStash } from './blueprintStash';
import type { Blueprint } from '../level/BlueprintData';
```

(`BLANK_BLUEPRINT` is deliberately NOT imported into the page — only into its test file,
by Task 6.) Add the dialog state next to `saveName`:

```typescript
  const [blueprintSaveDialogOpen, setBlueprintSaveDialogOpen] = useState(false);
  const [blueprintSaveName, setBlueprintSaveName] = useState(loadedBlueprintName);
```

Add the two handlers next to `loadLevel`/`saveCurrentLevel`:

```typescript
  /**
   * Loads a blueprint picked from the dropdown onto the blueprint canvas —
   * the blueprint counterpart of `loadLevel` above, including its reason for
   * writing the persisted signals directly and not only local state: without
   * that, the debounced sync effect would shortly overwrite the freshly
   * loaded canvas with the still-pending previous one. `BlueprintSelect` has
   * already confirmed the discard if there was anything to lose.
   */
  const loadBlueprint = (blueprint: Blueprint) => {
    const grid = importLayout(blueprint.layout);
    setBlueprintGrid(grid);
    editorBlueprintSignal.value = grid;
    const background = [...(blueprint.background ?? [])];
    setBlueprintBackgroundPlacements(background);
    editorBlueprintBackgroundSignal.value = background;
    setLoadedBlueprintName(blueprint.name);
    setBlueprintDirty(false);
  };

  /**
   * Saves the blueprint canvas under a name, cropped through the very same
   * `cropLevelForExport` a level save uses (tightest non-`.` bounding box,
   * background placements rebased onto that same origin) — a `Blueprint` is
   * deliberately the same `{ name, layout, background? }` shape a saved level
   * file is. Step 44a stores it in a `localStorage` stash; step 44c replaces
   * that with a real file written next to the levels, at which point only
   * `blueprintStash.ts` changes, not this call site.
   */
  const saveCurrentBlueprint = () => {
    const cropped = cropLevelForExport(blueprintGrid, blueprintBackgroundPlacements);
    saveBlueprintToStash(blueprintSaveName, cropped.layout, cropped.background);
    setLoadedBlueprintName(blueprintSaveName);
    setBlueprintDirty(false);
    setBlueprintSaveDialogOpen(false);
  };
```

Now swap the Select+Save pair. Wrap today's `<LevelSelect ... />` plus the Save
`<Button>`/`<Dialog>` pair in `{!isBlueprintMode && ( ... )}` and add the blueprint pair
beside it. Concretely, the sidebar between `<Palette ... />` and the `Try` button becomes:

```tsx
          {!isBlueprintMode && (
            <>
              <LevelSelect
                loadedLevelName={loadedLevelName}
                isDirty={isDirty}
                onLoadLevel={loadLevel}
              />
              {/* the existing Export Dialog, the existing Save Button and the
                  existing Save-level Dialog stay here, unchanged */}
            </>
          )}
          {isBlueprintMode && (
            <>
              <BlueprintSelect
                loadedBlueprintName={loadedBlueprintName}
                isDirty={blueprintDirty}
                onLoadBlueprint={loadBlueprint}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBlueprintSaveName(loadedBlueprintName);
                  setBlueprintSaveDialogOpen(true);
                }}
              >
                Save Blueprint
              </Button>
              <Dialog open={blueprintSaveDialogOpen} onOpenChange={setBlueprintSaveDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save this blueprint</DialogTitle>
                    <DialogDescription>
                      Stores the blueprint canvas in this browser, cropped to the cells you
                      painted. Step 44c replaces this with a real file written next to the
                      levels.
                    </DialogDescription>
                  </DialogHeader>
                  <label className="flex flex-col gap-1 text-sm" htmlFor="save-blueprint-name">
                    Blueprint name
                    <input
                      id="save-blueprint-name"
                      value={blueprintSaveName}
                      onChange={(event) => setBlueprintSaveName(event.target.value)}
                      className="rounded border px-2 py-1 font-mono text-xs"
                    />
                  </label>
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <Button type="button" onClick={saveCurrentBlueprint}>
                      Save blueprint
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
```

Keep the Export dialog and the `Try` button inside the level-only branch and outside it
respectively exactly as the snippet shows: Export serializes the level grid, while `Try`
is a level-only action too — leave `Try` where it is (below the pairs) but wrap it, and the
`saveResult` status paragraph, in the same `!isBlueprintMode` branch as the level pair so
blueprint mode does not offer to play a room. `Button`, `Dialog`, `DialogClose`,
`DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader` and `DialogTitle` are
all already imported by this file — no import changes are needed for the JSX above. The
`<label htmlFor>`/`<input id>` pairing is what makes `findByLabelText(/blueprint name/i)`
resolve, mirroring the existing "Level name" field.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: PASS — the 8 new tests plus every pre-existing test in the file. If a
pre-existing test now fails on an ambiguous `combobox`/`Save` query, the swap is rendering
both pairs at once — fix the condition, not the test.

- [ ] **Step 5: Run the full suite and the linter**

```bash
npm test
npm run lint
```

Expected: tests PASS with a total count equal to the baseline recorded before this plan
started, plus the 56 tests this plan adds (8 + 11 + 5 + 3 + 10 + 11 + 8 across Tasks 1-7).
Lint: zero errors and zero warnings. `npx tsc -b --noEmit` clean is implied by
`npm run build`, but the lint run is the one that catches this repo's non-type rules — do
not skip it.

- [ ] **Step 6: Manual browser check**

Start the dev server and open `/platformer/editor`. Confirm, in order:

1. Foreground/Background and Level/Blueprint both render, as two separate toggle groups.
2. Select the **Spawn** tile, then click **Blueprint**: the canvas blanks (one empty cell
   at the top-left), the Palette loses its **Spawn** tile *and* shows Ground Grass selected
   instead of nothing, and the sidebar now shows **Blueprint Select** + **Save Blueprint**
   instead of the level dropdown, Export, Save and Try.
3. Paint a small irregular room with the Wall/Ground tools, switch to **Background**, drop
   a background piece or two inside it, and switch back to **Foreground** — both layers
   paint on the blueprint, and right-click still erases.
4. Click **Level**: the level is exactly as it was, at its own pan position, with Spawn
   back in the palette. Click **Blueprint** again: the room is still there.
5. **Save Blueprint** under a name; the dialog closes and the dropdown trigger shows that
   name.
6. Pick **new** from Blueprint Select (confirming the discard if asked) to blank the
   canvas, then pick the saved name again — the room comes back, editable.
7. In devtools, `localStorage.getItem('platformer-editor-saved-blueprints')` holds the
   blueprint with both `layout` and `background`.
8. Still in **Blueprint** mode, reload the page (the mode is persisted, so the editor comes
   back on the blueprint canvas). Click **Level**: the level view must arrive centered on
   its spawn, not parked at its top-left corner. Toggle to Blueprint and back once more
   after hand-panning the level — that second return must leave the pan where you put it.

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx
git commit -m "feat(platformer): add Blueprint Select and Save Blueprint to the Level Editor"
```

---

## Self-Review Notes

- **Spec coverage.** The design doc's "Data model" section maps to Task 1 (the `Blueprint`
  type, verbatim as specified); "Step 44a" maps to Task 3 (the second canvas's state),
  Task 4 (Spawn dropped), Task 5 (Blueprint Select mirroring `LevelSelect`), Task 6 (the
  Level/Blueprint toggle, painting retargeted through the same
  `paintCell`/`growGrid`/`placeBackgroundPiece`/`eraseBackgroundCell` paths) and Task 7
  (Save Blueprint via `cropLevelForExport`). Nothing here paints, stores or validates a
  connection point (44b) and nothing places a blueprint into a level or tints anything
  blue/red (44c).
- **The stash decision, and why.** The design doc's "Step 44c — Saving and the palette
  library" section assigns `saveBlueprintFile.ts`, `saveBlueprintEndpoint.ts`, the
  `apply: 'serve'` Vite write plugin and the `import.meta.glob` `blueprintRegistry.ts` to
  step 44c. Building any of that now would duplicate work 44c must do properly (including
  the `/__dev-environment` gate that section adds), so 44a saves into a
  `localStorage`-backed `blueprintStash.ts` instead. It is deliberately shaped like the
  modules it stands in for — `blueprintId` is `levelFileName`'s slug rule minus the
  extension, `readSavedBlueprints`/`findSavedBlueprint` mirror `LEVELS`/`findLevel`,
  `isBlueprint` mirrors `parseLevelModules`'s skip-the-malformed validation — so 44c
  replaces one module's body and neither `BlueprintSelect` nor `LevelEditorPage` changes.
- **How the canvas renders either source, and why no new props.** `EditorCanvas` already
  takes `grid`, `backgroundPlacements`, `panOffset`, `onPaint`, `onPaintBackground` and
  `onPan` as plain props with no knowledge of where they come from, so the page choosing
  between two state sets at the call site is strictly simpler than a `source` prop, a
  generic, or a second component instance — and it is the only option that leaves
  `EditorCanvas.tsx` and all ~30 render sites in `EditorCanvas.test.tsx` untouched, with
  zero new optional props to keep in sync. Verified against the real file: the props are
  exactly `grid: TileChar[][]`, `selectedTool: TileChar`, `panOffset: PanOffset`,
  `images: EditorImages`, `centerRequestId?: number`,
  `backgroundPlacements: BackgroundPlacement[]`,
  `activeLayer: 'foreground' | 'background'`,
  `selectedBackgroundPiece: BackgroundPieceId | null`, `onPaint`, `onPaintBackground`,
  `onPan`. `EditorCanvasProps` is module-private, which is another reason not to try to
  extend it from the page. The one place where "just swap the data" is not quite enough is
  `centerRequestId`'s one-shot behavior — handled entirely inside the page, see the
  centering deviation below.
- **Deviation, deliberate — per-canvas pan offset.** The design doc says nothing about
  panning. Sharing one `panOffset` would open the blueprint canvas at the level's
  spawn-centered offset, putting its single starting cell far off-screen; the plan keeps
  one `PanOffset` per canvas and selects the active one. This also has no effect on the
  level path (`setPanOffset` still receives every level pan) and is what makes the
  blueprint tests' pixel→cell arithmetic exact.
- **Deviation, deliberate — the level's one-shot spawn-centering is preserved explicitly.**
  Stress-testing "`EditorCanvas` needs zero modification" turned up one case where handing
  it a different grid *does* change behavior: its centering effect fires exactly once per
  `centerRequestId` and disarms itself, and the page's id starts at `1`, so mounting with
  the persisted mode already set to `blueprint` spends that single request on a spawn-less
  grid (a no-op) and the level would then open unpanned at its top-left corner forever
  after. `levelCenterPendingRef` (Task 6) pays that debt back on the first switch to Level
  and never again — the canvas itself still needs no change, and two new tests pin both
  halves (it centers then; it does not re-center on later toggles).
- **Deviation, deliberate — Spawn is disarmed, not just hidden.** Task 4 removes the Spawn
  *button* in blueprint mode, but `selectedTool` is persisted and shared across both
  canvases, so a session with `'S'` armed would keep painting spawn markers into a
  blueprint through a palette showing no selection. Task 6 therefore also swaps the armed
  tool for Ground Grass when the blueprint canvas becomes active (and at mount, when the
  persisted mode is already `blueprint`). The design doc only asks for the button to go;
  leaving the tool armed would defeat the reason it does.
- **Deviation, deliberate — Export and Try hidden in blueprint mode.** The design doc only
  names the Select and Save controls as swapping. Export serializes `grid` and Try boots
  the game from it; both are meaningless for a spawn-less blueprint (Try would in fact
  throw at `findSpawnTile`). They are therefore grouped with the level-only pair rather
  than left visible and broken.
- **Deviation, deliberate — separate `blueprintDirty`, not persisted.** The level's
  `isDirty` is persisted because it guards a level's unsaved work across reloads. The
  blueprint canvas is itself fully persisted, so a reopened editor's blueprint canvas *is*
  whatever was last painted — a persisted flag would add nothing and would have to be reset
  on load anyway. Plain `useState` is the honest shape.
- **Coordinate and cropping arithmetic, hand-verified.**
  - Blueprint canvas starts as `importLayout(['.'])` = `[['.']]`, one cell, pan
    `{ x: 0, y: 0 }`. A click at `clientX = 2 * RENDERED_TILE_SIZE + 1`,
    `clientY = 1 * RENDERED_TILE_SIZE + 1` gives
    `col = floor((2·T + 1 − 0)/T) = 2`, `row = floor((1·T + 1 − 0)/T) = 1`.
  - `growGrid([['.']], 2, 1)`: `width = 1`, `height = 1`, so `growRight = 2 − 1 + 1 = 2`,
    `growBottom = 1 − 1 + 1 = 1`, `growLeft = growTop = 0` → a 3×2 grid with
    `colShift = rowShift = 0`. The painted cell is therefore `grid[1][2] = 'G'`, exactly
    what the Task 6 assertion reads, and no pan compensation or placement rebase runs.
  - `cropLevelForExport` on that 3×2 grid: the only non-`.` cell is (col 2, row 1), so
    `minRow = maxRow = 1`, `minCol = maxCol = 2` and `exportLayout` returns `['G']` — one
    row, one column. Its origin `(originCol 2, originRow 1)` rebases a background placement
    at (col 2, row 1) to `(col 0, row 0)`, which is the Task 7 background assertion.
  - `saveBlueprintToStash('Test Room', ['G'], [])` → `blueprintId('Test Room')` lowercases
    to `'test room'`, collapses the space to `-` → `'test-room'`, no leading/trailing
    hyphens to trim. `background` is empty, so the key is omitted, giving exactly
    `{ id: 'test-room', name: 'Test Room', layout: ['G'] }`.
  - `importLayout(['G'])` = `[['G']]`, which is what the reopen test compares against.
- **Type/prop threading, checked end to end.** `Blueprint` is produced in Task 1 and
  consumed unchanged by Task 2 (`saveBlueprintToStash`'s return, `readSavedBlueprints`),
  Task 5 (`BlueprintSelectProps.onLoadBlueprint`) and Task 7 (`loadBlueprint`) — same four
  fields, never renamed. `BLANK_BLUEPRINT` is produced in Task 1 and consumed by Task 3
  (the blueprint grid signal's default), Task 5 (the dropdown's first entry) and Task 6's
  test reset. `canvasMode: 'level' | 'blueprint'` is the one string union used by Task 3's
  signal, Task 4's Palette prop and Task 6's page state — spelled identically in all three
  (never `mode`, never `blueprintMode` as a boolean prop name on a component). The page's
  local `isBlueprintMode` boolean is derived, not passed anywhere. `BLUEPRINT_STASH_KEY`
  is the single source of the localStorage key and is asserted through the constant in
  Task 2's test, so the key can never drift from the assertion.
- **Import-cycle check.** `level/BlueprintData.ts` imports only `level/LevelData` (types).
  `editor/blueprintStash.ts` imports `@/lib/utils` and `level/*` — no `editor/` module.
  `editor/BlueprintSelect.tsx` → `blueprintStash`/`BlueprintData`/`components/ui`, and
  `LevelEditorPage` → `BlueprintSelect` follows the existing `LevelEditorPage` →
  `LevelSelect` direction. No cycle.
- **Test-runner facts confirmed against the repo.** `vitest.config.ts` sets
  `globals: true`; `editorLevelState.test.ts` therefore imports no test helpers and the
  appended block in Task 3 matches that, while the new files follow
  `LevelSelect.test.tsx`'s explicit-import style. `LevelEditorPage.test.tsx`'s `beforeEach`
  already stubs `HTMLCanvasElement.prototype.getContext` and mocks `../engine/Renderer` and
  `../engine/SpriteLoader`, so the blueprint tests need no rendering stubs of their own; it
  also resets every persisted editor signal EXCEPT `editorSelectedToolSignal`, which is why
  Task 6 extends that same block (adding that one reset) rather than adding a competing one.
  jsdom provides no `ResizeObserver`, so `EditorCanvas` treats its fallback 800×480 size as
  measured — the centering effect therefore runs on mount, which is what the two new
  centering tests exercise, and a spawn-less blueprint grid makes `centerPanOnSpawn` return
  `{ x: 0, y: 0 }`, matching the blueprint pan's initial value rather than fighting it.
  `EditorCanvas.test.tsx`'s own fixtures (`EMPTY_IMAGES`, `BACKGROUND_LAYER_DEFAULT_PROPS`)
  were checked and do exist, but nothing in this plan touches that file.
- **Placeholder scan.** No TBDs, no "similar to the above", no conditional or no-op
  assertions. Every code block is complete as written; the only elision is the explicitly
  marked "existing Export/Save JSX stays here, unchanged" comment in Task 7's structural
  snippet, which moves existing code rather than authoring new code.
