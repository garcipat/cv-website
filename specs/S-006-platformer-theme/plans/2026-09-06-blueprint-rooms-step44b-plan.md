# Blueprint Rooms — Step 44b (Connection Points) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a blueprint's author mark the spots on a room's border where other
blueprints may attach, by painting them. A new `TileType`/`TileChar` —
`'blueprintConnectionPoint'`, character `'+'` — becomes just another Palette entry,
offered **only while the blueprint canvas is active**, painted onto `blueprintGrid`
exactly like any other tile through the paint path that already exists. The editor draws
its own marker on every such cell (the tile is invisible in game, like `patrol`), so an
author can see what they painted.

**Architecture:** No new module, no new editor state, no new geometry. A connection point
is a *character in a layout*, nothing more — "border cell" is not stored, and neither is a
facing direction: step 44c derives a point's open side on the fly from whichever of its
4-neighbors falls outside the blueprint's own layout bounds. So this step is four small
edits along an existing seam: the character maps (`LevelParser.ts`) plus the tile-type
union (`LevelData.ts`); the three `Record<TileChar, …>` palette maps and `Renderer.ts`'s
exhaustive `tileSource` switch, all of which the compiler *forces* to gain an entry the
moment the union grows; a mode-conditional key in `Palette.tsx`'s existing `toolKeys` line
(the mirror image of step 44a's Spawn-only-in-level filter); and an editor-only marker in
`EditorCanvas.tsx` modelled on `drawPatrolMarkers`. `paintCell`/`growGrid`/
`exportLayout`/`cropLevelForExport`/`importLayout` are all reused verbatim — verified:
`paintCell` special-cases only `'S'`, the sign characters and the hazard characters, so
`'+'` falls through to a plain single-cell write, which is exactly what gives the design's
"two connection points can never occupy the same cell" for free.

**Tech Stack:** React 19 + TypeScript strict, Vitest + React Testing Library, Canvas 2D
rendering, `@preact/signals-react` for reactive editor state.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-06-blueprint-rooms-design.md` — its
"Data model" paragraph on `'blueprintConnectionPoint'` and its "Step 44b — Marking
connection points" section. Step 44c (real save endpoint, blueprint registry, placement
preview, the blue/red fit rule) is explicitly NOT in this plan: nothing here derives an
open side, checks adjacency, or validates a fit. `specs/S-006-platformer-theme/roadmap.md`
step 44b is the one-line pointer.

## Global Constraints

- TypeScript `strict: true`, no `any`, no `@ts-ignore` (constitution Principle I / III).
- Tests first (constitution Principle II — TDD, NON-NEGOTIABLE). New test names follow
  `{method}-{Condition}-{ExpectedResult}`, matching each target file's own house style.
  Two of the six test files this plan touches (`paletteTiles.test.ts`,
  `EditorCanvas.test.tsx`) use prose `it('draws …')` names for their existing marker
  tests; additions there follow the neighbouring convention in that file rather than
  importing a foreign one.
- Named arrow function exports for components with the props interface in the same file,
  no default exports (constitution Principle III).
- Relative imports (`./`, `../`) within `src/themes/platformer/`.
- No new dependencies, no new shadcn/ui components, no new files at all — this plan only
  modifies existing ones.
- **A connection point is purely editor-time.** Nothing added here is read by collision,
  physics, or `EnemyAI`. Two facts make that automatic rather than aspirational, both
  verified against the real files: `Terrain.ts`'s `isSolid` is a *whitelist*
  (`groundGrass`/`groundRock`/`wall`/`bridge`), so a new tile type is non-solid without
  touching that function; and `Renderer.ts`'s `tileSource` gets a `case` returning `null`,
  exactly like `'patrol'`.
- **`EditorCanvas.tsx` IS modified by this plan (Task 4)** — a deliberate departure from
  step 44a's "not modified at all" constraint, which applied to that step because it only
  ever needed to hand the canvas *different data through existing props*. 44b is the
  opposite kind of change: the new tile draws nothing in game by design, so without an
  editor-only marker the author paints cells they cannot see — precisely the problem
  `drawPatrolMarkers` already exists to solve for `patrol`. There is no prop-level way to
  express "draw a glyph on these cells"; the canvas owns its own rendering. Task 4 keeps
  the blast radius small by generalizing the existing patrol routine into one shared
  helper both markers call, adding no new `EditorCanvas` prop, so all ~30 existing render
  sites in `EditorCanvas.test.tsx` keep compiling untouched.
- **`editorLevelState.ts` is NOT modified by this plan.** Checked against the real file:
  it already carries `editorSelectedToolSignal` (the armed tool, shared by both canvases)
  and `editorCanvasModeSignal` (which canvas is active). A connection point needs no state
  beyond "which character is armed" and "which grid is being painted", both of which
  exist. If a task appears to need a new signal, stop — something has drifted from this
  design.
- **`blueprintStash.ts`, `BlueprintData.ts`, `BlueprintSelect.tsx`, `exportLayout.ts`,
  `cropLevelForExport.ts`, `importLayout.ts`, `paintCell.ts`, `growGrid.ts` are not
  modified either.** A connection point is an ordinary character inside `layout`, so the
  crop/export/import/save path carries it with no change (Task 5 pins that with a test).
- Legal layout characters are exactly `TileChar`'s union in `level/LevelParser.ts`. This
  plan adds exactly one: `'+'`. `LevelParser.ts` throws at import time if two char maps
  ever share a key — see the character-collision verification in Task 1 and again in
  Self-Review Notes.
- Three maps and one switch are **compile-enforced exhaustive** over the union and must be
  extended in the same task that widens it, or `tsc` fails:
  `PALETTE_TILE_SPRITES`, `PALETTE_TILE_DESCRIPTIONS`, `PALETTE_TILE_LABELS`
  (`Record<TileChar, …>`) and `Renderer.ts`'s `tileSource` (`default: const _exhaustive:
  never = type`). `PALETTE_TILE_GLYPHS` is `Partial<…>` and is extended by choice, not by
  the compiler.
- Vitest runs with `globals: true` (confirmed in `vitest.config.ts`), and the six test
  files this plan touches are NOT uniform about it — match each file's current style
  rather than adding an import it does not have:
  - `LevelParser.test.ts` and `Terrain.test.ts` import **none** of
    `describe`/`it`/`expect` (globals only); `LevelParser.test.ts`'s import block is
    value/type imports from `./LevelParser` alone.
  - `paletteTiles.test.ts` imports `describe`/`it`/`expect` but **not** `vi` (it needs
    none, and Task 1's additions need none either).
  - `Palette.test.tsx`, `EditorCanvas.test.tsx` and `LevelEditorPage.test.tsx` import
    `describe`/`it`/`expect`/`vi` explicitly — keep doing so there.

---

## File Structure

- **Modify** `src/themes/platformer/level/LevelData.ts` — the `blueprintConnectionPoint`
  member of `TileType`.
- **Modify** `src/themes/platformer/level/LevelParser.ts` — `TERRAIN_CHARS['+']` and the
  `TileChar` union.
- **Modify** `src/themes/platformer/level/LevelParser.test.ts`
- **Modify** `src/themes/platformer/engine/Renderer.ts` — one `case` in `tileSource`.
- **Modify** `src/themes/platformer/level/Terrain.test.ts` — non-solid/non-climbable
  guards.
- **Modify** `src/themes/platformer/editor/paletteTiles.ts` — the sprite-less entry, the
  glyph, the label, the description.
- **Modify** `src/themes/platformer/editor/paletteTiles.test.ts`
- **Modify** `src/themes/platformer/editor/Palette.tsx` — the tool, offered only in
  blueprint mode.
- **Modify** `src/themes/platformer/editor/Palette.test.tsx`
- **Modify** `src/themes/platformer/editor/EditorCanvas.tsx` — the editor-only marker.
- **Modify** `src/themes/platformer/editor/EditorCanvas.test.tsx`
- **Modify** `src/themes/platformer/editor/LevelEditorPage.tsx` — disarm the tool when the
  level canvas becomes active.
- **Modify** `src/themes/platformer/editor/LevelEditorPage.test.tsx`

Not modified: `editorLevelState.ts`, `paintCell.ts`, `growGrid.ts`, `importLayout.ts`,
`exportLayout.ts`, `cropLevelForExport.ts`, `BlueprintData.ts`, `blueprintStash.ts`,
`BlueprintSelect.tsx`, `gridRenderState.ts`, `Terrain.ts`, `EnemyAI.ts`.

---

### Task 1: The `blueprintConnectionPoint` tile type and its `'+'` character

**Files:**
- Modify: `src/themes/platformer/level/LevelData.ts`
- Modify: `src/themes/platformer/level/LevelParser.ts`
- Modify: `src/themes/platformer/level/LevelParser.test.ts`
- Modify: `src/themes/platformer/engine/Renderer.ts`
- Modify: `src/themes/platformer/editor/paletteTiles.ts`
- Modify: `src/themes/platformer/editor/paletteTiles.test.ts`

**Interfaces:**
- Produces: `TileType` gains `'blueprintConnectionPoint'`; `TileChar` gains `'+'`;
  `TERRAIN_CHARS['+'] === 'blueprintConnectionPoint'`; `CONNECTION_POINT_GLYPH` (new
  export from `paletteTiles.ts`, mirroring `PATROL_GLYPH`).
- Consumed by: Task 3 (`Palette.tsx`), Task 4 (`EditorCanvas.tsx`), Task 5
  (`LevelEditorPage.tsx`).

**Character choice — `'+'`, verified free.** Every character map in `LevelParser.ts` was
read and enumerated by hand:

| Map | Keys |
| --- | --- |
| `TERRAIN_CHARS` | `.` `G` `R` `#` `B` `H` `I` `P` `n` `N` |
| `ENTITY_CHARS` | `S` `M` `m` `o` `X` `Q` `F` `u` `p` `T` |
| `SIGN_CHARS` | `1` `2` `3` `4` `5` |
| `HAZARD_CHARS` | `^` `v` `<` `>` |

`'+'` appears in none of the four, and in none of the 29 members of today's `TileChar`
union. `'C'` was considered and rejected: it *is* free today, but only because step 39's
character remap moved the coin from `C` to `o`, and reusing a recently retired letter
invites "is this an old coin?" confusion in hand-read layouts — step 39's own stated rule
is that a character should visually suggest its element, and `'+'` reads as a joint/socket
where two rooms meet. Step 38's history (`I` reserved ahead of time, `W`→`#` moved out of
its way) is the precedent for picking deliberately rather than opportunistically.
`LevelParser.ts`'s module-load guard is the automated backstop: it throws if the four maps
ever share a key, so a mistake here fails every test file at import.

**Why the Renderer case is in this task:** `tileSource`'s `default` branch assigns `type`
to `const _exhaustive: never`, so widening `TileType` without a new `case` is a *compile
error*, not a silent gap. Same for `paletteTiles.ts`'s three `Record<TileChar, …>` maps.
They therefore land together with the union, or `npx tsc` is broken between tasks.

- [ ] **Step 1: Write the failing parser tests**

Append to `src/themes/platformer/level/LevelParser.test.ts`, next to the existing
`describe('patrol terrain character', …)` block it mirrors:

```typescript
describe('blueprint connection point terrain character', () => {
  it('plus-mapsToTheBlueprintConnectionPointTileType', () => {
    expect(TERRAIN_CHARS['+']).toBe('blueprintConnectionPoint');
  });

  it('parseLevel-connectionPointChar-keepsItAsItsOwnTileRatherThanEmpty', () => {
    // Same reason a patrol tile is not parsed to `empty`: the character has
    // to survive a parse/export round trip so a saved blueprint still knows
    // where its connection points are (step 44c reads them back out of the
    // layout).
    expect(parseLevel(['.+.'])).toEqual({
      terrain: [['empty', 'blueprintConnectionPoint', 'empty']],
      width: 3,
      height: 1,
    });
  });

  it('connectionPointChar-collidesWithNoOtherCharacterMap', () => {
    // The module-load guard in LevelParser.ts already throws on a shared
    // key; this names the invariant for '+' specifically, since 44b is the
    // step that claimed it.
    expect('+' in ENTITY_CHARS).toBe(false);
    expect('+' in SIGN_CHARS).toBe(false);
    expect('+' in HAZARD_CHARS).toBe(false);
  });
});
```

Also extend the drift guard at the bottom of the file — the literal array in
`describe('TileChar')`'s single test — by adding `'+'` after `'P'`:

```typescript
    const tileChars: readonly TileChar[] = [
      '.', 'G', 'R', '#', 'B', 'H', 'I', 'P', '+', 'S', 'M', 'm', 'o', 'X', 'Q', 'F', 'T', 'u', 'p',
      '1', '2', '3', '4', '5', 'n', 'N', '^', 'v', '<', '>',
    ];
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/LevelParser.test.ts`
Expected: FAIL — exactly two of the three new tests fail:
`plus-mapsToTheBlueprintConnectionPointTileType` (`TERRAIN_CHARS['+']` is `undefined`) and
`parseLevel-connectionPointChar-keepsItAsItsOwnTileRatherThanEmpty` (`parseLevel(['.+.'])`
throws `Unknown level tile character: "+"`).
`connectionPointChar-collidesWithNoOtherCharacterMap` passes trivially at this point —
it is a permanent invariant guard, not a RED test, and stays green forever.
The drift-guard array edit produces **no vitest failure at all**: vitest strips types
(esbuild, no typechecking), so `'+'` inside a `readonly TileChar[]` literal that `TileChar`
does not yet contain is a `tsc` error only, and the test body itself (`for key of allKeys:
expect(tileChars).toContain(key)`) still passes because `'+'` is not yet a map key. To see
its RED, run `npx tsc -b --noEmit` here as well and confirm it reports the `'+'` literal
as not assignable to `TileChar`; Step 4 is what clears it, and Step 11 re-runs the same
command green. Do not continue until you have seen the two vitest failures above.

- [ ] **Step 3: Add the tile type**

In `src/themes/platformer/level/LevelData.ts`, insert directly after the `'patrol'` member
(keeping its doc comment untouched):

```typescript
  /** An editor-only marker for a cell on a blueprint's border where another
   *  blueprint may attach (roadmap step 44b). Follows `'patrol'` above
   *  exactly — invisible in normal gameplay rendering, never solid, no
   *  collision behavior — and goes one step further: nothing in the running
   *  game reads it at all. Neither "is a border cell" nor "which way it
   *  opens" is stored; placement (step 44c) derives a point's open side from
   *  whichever of its 4-neighbors falls outside its own blueprint's layout
   *  bounds. */
  | 'blueprintConnectionPoint'
```

- [ ] **Step 4: Register the character**

In `src/themes/platformer/level/LevelParser.ts`, add to `TERRAIN_CHARS`, directly after
`P: 'patrol',`:

```typescript
  '+': 'blueprintConnectionPoint',
```

and add `| '+'` to the `TileChar` union, directly after `| 'P'`:

```typescript
  | 'P'
  | '+'
```

- [ ] **Step 5: Keep the game renderer exhaustive**

In `src/themes/platformer/engine/Renderer.ts`, add to `tileSource`'s switch, directly after
the `case 'patrol':` block:

```typescript
    case 'blueprintConnectionPoint':
      // Editor-only, exactly like 'patrol' above: only the Level Editor
      // draws anything for a connection point (EditorCanvas.tsx's
      // drawTileMarkers). It can reach a real level's terrain at all only
      // by way of a blueprint stamped down in the editor (step 44c), and
      // even then it must stay invisible in game.
      return null;
```

- [ ] **Step 6: Run the parser tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/LevelParser.test.ts`
Expected: PASS — the 3 new tests plus every pre-existing test in the file, including the
`TileChar` drift guard.

- [ ] **Step 7: Write the failing palette-map tests**

`paletteTiles.ts`'s three `Record<TileChar, …>` maps do not compile yet. Write the tests
that describe what the new entries must be — append to
`src/themes/platformer/editor/paletteTiles.test.ts`:

```typescript
describe('blueprint connection point marker', () => {
  it('maps "+" (Connection Point) to null — like the patrol tile, it has no in-game sprite', () => {
    expect(PALETTE_TILE_SPRITES['+']).toBeNull();
  });

  it('gives "+" a glyph, so it is not a second blank square next to the patrol tile', () => {
    expect(PALETTE_TILE_GLYPHS['+']).toBeTruthy();
    expect(PALETTE_TILE_GLYPHS['+']).not.toBe(PALETTE_TILE_GLYPHS.P);
  });

  it('labels "+" by what it is, not by its character', () => {
    expect(PALETTE_TILE_LABELS['+']).toBe('Connection Point');
  });

  it('describes "+" by where it belongs and what it is for', () => {
    expect(PALETTE_TILE_DESCRIPTIONS['+']).toBe(
      'Blueprint only; marks a border cell another blueprint can attach to',
    );
  });
});
```

and update the existing sprite-less assertion in
`it('gives every sprite-less tile a glyph so the palette never shows two blank squares')`
— there are now three such tiles, in `PALETTE_TILE_SPRITES`'s own key order:

```typescript
    // '.' (Eraser), 'P' (Patrol Boundary) and '+' (blueprint Connection
    // Point) are the tiles with no sprite; without a glyph to tell them
    // apart they would render as identical empty squares. The Eraser is the
    // deliberate exception — an empty square already reads as "erase".
    expect(spriteless).toEqual(['.', 'P', '+']);
    expect(PALETTE_TILE_GLYPHS['.']).toBeUndefined();
    expect(PALETTE_TILE_GLYPHS.P).toBeTruthy();
    expect(PALETTE_TILE_GLYPHS['+']).toBeTruthy();
```

and the `key === '.' || key === 'P'` skip in
`it('gives every non-sprite-less tile a spec with a positive frame size')`:

```typescript
      if (key === '.' || key === 'P' || key === '+') continue;
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts`
Expected: FAIL — no `'+'` entry exists in any of the four maps. Do not continue until you
have seen that failure output.

- [ ] **Step 9: Add the palette-map entries**

In `src/themes/platformer/editor/paletteTiles.ts`:

Widen the `PALETTE_TILE_SPRITES` doc comment's "the two tiles that have no sprite at all"
sentence and add the entry directly after `P: null,`:

```typescript
/**
 * One sprite spec per `TileChar`, or `null` for the three tiles that have no
 * sprite at all: `.` (the Eraser tool), `P` (the patrol boundary, which is
 * invisible in game by design) and `+` (the blueprint connection point,
 * likewise invisible — and editor-only besides). All three render as an
 * empty bordered square, told apart by `PALETTE_TILE_GLYPHS` below.
 */
```

```typescript
  P: null,
  '+': null,
```

Add the glyph constant next to `PATROL_GLYPH`:

```typescript
/** The socket character standing in for the blueprint connection point's
 *  missing sprite — in the palette button below, and on the tile itself in
 *  the editor canvas (`EditorCanvas.tsx` re-exports it as
 *  `CONNECTION_POINT_MARKER_GLYPH`), so both always show the same symbol.
 *  Deliberately distinct from `PATROL_GLYPH`: both tiles are sprite-less
 *  markers and would otherwise be indistinguishable on the canvas. */
export const CONNECTION_POINT_GLYPH = '⊕';
```

Extend `PALETTE_TILE_GLYPHS` (and its doc comment's "Only `P` needs one today" clause):

```typescript
/**
 * The character drawn inside a sprite-less tile's empty palette square, so
 * two of them are never indistinguishable. `P` and `+` need one; the
 * Eraser's empty square already reads as "erase", and giving it a glyph
 * would make it look like a tile you can paint.
 */
export const PALETTE_TILE_GLYPHS: Partial<Record<TileChar, string>> = {
  P: PATROL_GLYPH,
  '+': CONNECTION_POINT_GLYPH,
};
```

Add to `PALETTE_TILE_DESCRIPTIONS`, directly after the `P:` entry:

```typescript
  '+': 'Blueprint only; marks a border cell another blueprint can attach to',
```

Add to `PALETTE_TILE_LABELS`, directly after the `P:` entry:

```typescript
  '+': 'Connection Point',
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/paletteTiles.test.ts src/themes/platformer/level/LevelParser.test.ts`
Expected: PASS — the 4 new palette tests, the 3 new parser tests, and every pre-existing
test in both files (the three updated assertions included).

- [ ] **Step 11: Confirm the whole project still typechecks**

Run: `npx tsc -b --noEmit`
Expected: clean. This is the step that proves the exhaustive maps and the `tileSource`
switch were all covered — a missed one is a compile error, not a test failure.

- [ ] **Step 12: Commit**

```bash
git add src/themes/platformer/level/LevelData.ts src/themes/platformer/level/LevelParser.ts src/themes/platformer/level/LevelParser.test.ts src/themes/platformer/engine/Renderer.ts src/themes/platformer/editor/paletteTiles.ts src/themes/platformer/editor/paletteTiles.test.ts
git commit -m "feat(platformer): add the blueprintConnectionPoint tile type and its '+' character"
```

---

### Task 2: Physics leaves the connection point alone

**Files:**
- Modify: `src/themes/platformer/level/Terrain.test.ts`

**Interfaces:** none — this task adds no production code.

**Read this before writing the test.** `Terrain.ts`'s `isSolid` is a whitelist
(`groundGrass || groundRock || wall || bridge`) and `isClimbable` is another
(`ladder || chain`), so `'blueprintConnectionPoint'` is already non-solid and
non-climbable the moment Task 1 adds it — there is no implementation step here and no
honest way to make these tests fail first. They are regression guards, exactly like the
existing `isSolid-patrol-returnsFalse`: they exist so that a future refactor turning a
whitelist into a blacklist cannot silently make a connection point stop the player. This
is the one place in this plan where the RED-then-GREEN cycle does not apply, and it is
called out again in Self-Review Notes rather than dressed up.

- [ ] **Step 1: Add the guards**

In `src/themes/platformer/level/Terrain.test.ts`, directly after the existing
`it('isSolid-patrol-returnsFalse', …)`:

```typescript
  it('isSolid-blueprintConnectionPoint-returnsFalse', () => {
    // Editor-only marker (roadmap step 44b) — even if one ends up in a real
    // level's terrain via a placed blueprint (step 44c), the player must
    // walk straight through it, exactly like a patrol tile.
    expect(isSolid('blueprintConnectionPoint')).toBe(false);
  });
```

and directly after the existing `expect(isClimbable('patrol')).toBe(false);` assertion, in
that same test body:

```typescript
    expect(isClimbable('blueprintConnectionPoint')).toBe(false);
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/themes/platformer/level/Terrain.test.ts`
Expected: PASS immediately, including the new guard — and you should be able to say why
(both functions are whitelists). If either fails, Task 1 registered the character wrongly.

- [ ] **Step 3: Commit**

```bash
git add src/themes/platformer/level/Terrain.test.ts
git commit -m "test(platformer): guard that a blueprint connection point is never solid or climbable"
```

---

### Task 3: The Palette offers the tool only on the blueprint canvas

**Files:**
- Modify: `src/themes/platformer/editor/Palette.tsx`
- Modify: `src/themes/platformer/editor/Palette.test.tsx`

**Interfaces:**
- Consumes: the existing `canvasMode?: 'level' | 'blueprint'` prop (added by step 44a's
  Task 4 — **no new prop is needed**, and none is added).
- Produces: no new exports.

**The conditional is the mirror image of the Spawn filter, and is built the same way.**
Step 44a's Task 4 filtered a key OUT of an existing key list when `canvasMode !==
'level'`; 44b filters a key IN when `canvasMode === 'blueprint'`. Both are one expression
inside the key-list computation that already exists — no parallel mechanism, no second
prop, no early return.

Two placement decisions, both settled by the file's own precedent:

1. The tool goes in the **Tools** group, not Terrain. `Palette.tsx`'s comment above
   `toolKeys` already states the rule: patrol "lives here rather than in 'Terrain': it's
   an invisible marker, not physical ground". A connection point is the same kind of
   thing, only more so. That means `terrainKeys` must filter `'+'` out *unconditionally* —
   otherwise it would appear twice in blueprint mode and, worse, appear in Terrain while
   editing a level.
2. It sits between Patrol and the Eraser, so the Eraser stays last in the group in both
   modes and the group does not visually reshuffle when the canvas toggles.

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/editor/Palette.test.tsx` (it already imports
`describe`/`it`/`expect`/`vi`, `render`, `screen`, `within`, `userEvent` and defines
`defaultProps` at the top — reuse those):

```tsx
describe('Palette — blueprint connection point tool', () => {
  const toolsGroup = () => {
    const heading = screen.getByText('Tools');
    return heading.closest('section') ?? heading.parentElement!;
  };

  it('blueprintCanvasMode-offersTheConnectionPointToolInTheToolsGroup', () => {
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    expect(
      within(toolsGroup()).getByRole('button', { name: 'Connection Point' }),
    ).toBeInTheDocument();
  });

  it('levelCanvasMode-doesNotOfferTheConnectionPointToolAtAll', () => {
    // A connection point only means something on a blueprint's border — on a
    // level it would be an inert marker nothing downstream reads (step 44b).
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(screen.queryByRole('button', { name: 'Connection Point' })).not.toBeInTheDocument();
  });

  // Deliberately NOT named `omittedCanvasMode-behavesLikeLevelMode`: that exact
  // name is already taken by step 44a's Spawn test in the
  // `Palette — blueprint canvas mode` describe above, and a duplicate would
  // make `vitest -t` ambiguous and the two indistinguishable in the reporter.
  it('omittedCanvasMode-offersNoConnectionPointToolEither', () => {
    render(<Palette {...defaultProps} />);

    expect(screen.queryByRole('button', { name: 'Connection Point' })).not.toBeInTheDocument();
  });

  it('blueprintCanvasMode-keepsTheConnectionPointOutOfTheTerrainGroup', () => {
    // It is an invisible marker, not physical ground — same reason the
    // patrol boundary lives in Tools rather than Terrain.
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    const terrainHeading = screen.getByText('Terrain');
    const terrainGroup = terrainHeading.closest('section') ?? terrainHeading.parentElement!;
    expect(
      within(terrainGroup).queryByRole('button', { name: 'Connection Point' }),
    ).not.toBeInTheDocument();
  });

  it('blueprintCanvasMode-clickingTheConnectionPointTool-armsItsCharacter', async () => {
    const onSelectTool = vi.fn();
    render(<Palette {...defaultProps} canvasMode="blueprint" onSelectTool={onSelectTool} />);

    await userEvent.click(screen.getByRole('button', { name: 'Connection Point' }));

    expect(onSelectTool).toHaveBeenCalledWith('+');
  });

  it('blueprintCanvasMode-theEraserStaysTheLastToolInTheGroup', () => {
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    const buttons = within(toolsGroup()).getAllByRole('button');
    expect(buttons.at(-1)).toHaveAccessibleName('Eraser');
  });
});
```

Also update the button-count test at the top of the file — `'+'` is now a `TERRAIN_CHARS`
key but is never rendered from the terrain list, and is absent entirely in the default
(level) mode this test renders in:

```tsx
  it('renders one tile for every terrain char (excluding "."), every entity char, one representative Sign tile, one representative Hazard tile, and the Eraser', () => {
    render(<Palette {...defaultProps} />);
    // '.' is the Eraser, counted separately below; '+' is the blueprint
    // connection point, offered only on the blueprint canvas (step 44b) and
    // never from the Terrain group in either mode.
    const terrainCount = Object.keys(TERRAIN_CHARS).filter((k) => k !== '.' && k !== '+').length;
    const entityCount = Object.keys(ENTITY_CHARS).length;
    // +1 for the single representative Sign tile, +1 for the single
    // representative Hazard tile, +1 for the Eraser tile.
    expect(screen.getAllByRole('button')).toHaveLength(terrainCount + entityCount + 1 + 1 + 1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/Palette.test.tsx`
Expected: FAIL. Be precise about *which* fail, because Task 1 already made `'+'` a
`TERRAIN_CHARS` key, so a "Connection Point" button **does** render today — in the wrong
group, in both modes:
- The updated button-count test: off by one (it now excludes `'+'` from `terrainCount`,
  but the Terrain group still renders it). FAIL.
- `blueprintCanvasMode-offersTheConnectionPointToolInTheToolsGroup`: the button exists,
  but scoped `within(toolsGroup())` finds nothing. FAIL.
- `levelCanvasMode-doesNotOfferTheConnectionPointToolAtAll` and
  `omittedCanvasMode-offersNoConnectionPointToolEither`: both query globally and find the
  Terrain-group button. FAIL.
- `blueprintCanvasMode-keepsTheConnectionPointOutOfTheTerrainGroup`: finds one there.
  FAIL.
- `blueprintCanvasMode-clickingTheConnectionPointTool-armsItsCharacter` already PASSES
  (its global `getByRole` hits the Terrain-group button, which also calls
  `onSelectTool('+')`), and `blueprintCanvasMode-theEraserStaysTheLastToolInTheGroup`
  already PASSES (today's Tools group is Sign/Patrol/Eraser). Both are placement guards
  that must stay green through the change, not RED cycles — five of the seven test cases
  this step touches (6 new + 1 edited) are the RED that matters.

Do not continue until you have seen those five failures.

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/editor/Palette.tsx`, add the character constant next to
`SPAWN_CHAR`:

```typescript
const CONNECTION_POINT_CHAR: TileChar = '+';
```

Extend the `terrainKeys` filter so the marker never appears as terrain, in either mode:

```typescript
  const terrainKeys = allTerrainKeys.filter(
    (key) =>
      !DECORATION_CHARS.includes(key) && key !== PATROL_CHAR && key !== CONNECTION_POINT_CHAR,
  );
```

and replace the `toolKeys` line (keeping the existing comment above it) with:

```typescript
  // Patrol lives here rather than in "Terrain": it's an invisible marker, not
  // physical ground, so it reads more like a level-authoring tool (same
  // category as the Eraser and Sign) than like grass/rock/wall. The blueprint
  // connection point is the same kind of marker and joins it — but only while
  // the blueprint canvas is active (roadmap step 44b), the mirror image of the
  // Spawn filter on `entityKeys` above: a connection point marks a spot on a
  // ROOM's border, so on a level it would be an inert character nothing reads.
  // It stays ahead of the Eraser so the Eraser is last in the group either way.
  const toolKeys: TileChar[] = [
    ...(firstSignKey ? [firstSignKey] : []),
    PATROL_CHAR,
    ...(canvasMode === 'blueprint' ? [CONNECTION_POINT_CHAR] : []),
    EMPTY_CHAR,
  ];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/Palette.test.tsx`
Expected: PASS — the 6 new tests plus every pre-existing test in the file, including step
44a's three `canvasMode` tests and the corrected button count.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/Palette.tsx src/themes/platformer/editor/Palette.test.tsx
git commit -m "feat(platformer): offer the Connection Point tool on the blueprint canvas only"
```

---

### Task 4: The editor draws a marker on every connection point

**Files:**
- Modify: `src/themes/platformer/editor/EditorCanvas.tsx`
- Modify: `src/themes/platformer/editor/EditorCanvas.test.tsx`

**Interfaces:**
- Consumes: `CONNECTION_POINT_GLYPH` (Task 1's `./paletteTiles`).
- Produces: `CONNECTION_POINT_MARKER_GLYPH` (new export, mirroring the existing
  `PATROL_MARKER_GLYPH` re-export). **No new `EditorCanvas` prop** — the marker is derived
  from the `grid` prop the canvas already receives.

**Why this file is modified at all** (step 44a's constraint deliberately lifted, see
Global Constraints): the tile renders nothing in game by design, so without an
editor-only marker the author paints invisible cells. `drawPatrolMarkers` already solves
exactly this for `patrol`, so rather than copy it, Step 3 generalizes it into one
`drawTileMarkers(ctx, grid, char, glyph, tint, glyphColor, originX, originY)` helper and
has both markers call it. The existing patrol tests assert only on `fillText`/`fillRect`
arguments, so the extraction is behavior-preserving and they stay untouched — which is
also the check that it really was.

Colors: the patrol marker is red-tinted; the connection point gets a blue tint with a dark
navy glyph, so the two are distinguishable at a glance and the connection point reads as
"blueprint". This does not collide with step 44c's blue/red *preview border*, which is a
rectangle around a whole placement preview, not a per-cell tint.

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/editor/EditorCanvas.test.tsx`, directly after the
`describe('EditorCanvas patrol markers', …)` block it mirrors, and extend the file's
existing `EditorCanvas` import to
`import { EditorCanvas, PATROL_MARKER_GLYPH, CONNECTION_POINT_MARKER_GLYPH } from './EditorCanvas';`:

```tsx
describe('EditorCanvas blueprint connection point markers', () => {
  it('draws an editor-only marker over every connection point tile, which the game itself never shows', () => {
    const ctx = stubCanvasContext() as unknown as {
      fillText: ReturnType<typeof vi.fn>;
      fillRect: ReturnType<typeof vi.fn>;
    };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['+']]}
        selectedTool="+"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    const glyphCalls = ctx.fillText.mock.calls.filter(
      (call: unknown[]) => call[0] === CONNECTION_POINT_MARKER_GLYPH,
    );
    expect(glyphCalls).not.toHaveLength(0);
    // Tinted cell behind the glyph, at the tile's own top-left corner.
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  });

  it('offsets the connection point marker by the pan offset, like every other drawn layer', () => {
    const ctx = stubCanvasContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['+']]}
        selectedTool="+"
        panOffset={{ x: 100, y: 40 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    expect(ctx.fillRect).toHaveBeenCalledWith(100, 40, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
  });

  it('draws no connection point marker for a grid without any connection point tile', () => {
    const ctx = stubCanvasContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['G']]}
        selectedTool="G"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    const glyphCalls = ctx.fillText.mock.calls.filter(
      (call: unknown[]) => call[0] === CONNECTION_POINT_MARKER_GLYPH,
    );
    expect(glyphCalls).toHaveLength(0);
  });

  it('gives the patrol tile and the connection point tile their own distinct glyphs in one grid', () => {
    // Both are sprite-less markers; one shared symbol would make a room's
    // border unreadable.
    const ctx = stubCanvasContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    expect(CONNECTION_POINT_MARKER_GLYPH).not.toBe(PATROL_MARKER_GLYPH);

    render(
      <EditorCanvas
        {...BACKGROUND_LAYER_DEFAULT_PROPS}
        grid={[['P', '+']]}
        selectedTool="+"
        panOffset={{ x: 0, y: 0 }}
        images={EMPTY_IMAGES}
        onPaint={() => {}}
        onPan={() => {}}
      />,
    );

    const drawn = ctx.fillText.mock.calls.map((call: unknown[]) => call[0]);
    expect(drawn).toContain(PATROL_MARKER_GLYPH);
    expect(drawn).toContain(CONNECTION_POINT_MARKER_GLYPH);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: FAIL — `CONNECTION_POINT_MARKER_GLYPH` is not exported from `./EditorCanvas`, so
the missing named import takes the **whole file** down at module-link time rather than
failing four tests individually. That is why this step runs the file unfiltered: a `-t`
filter would report a collection error with no useful per-test detail, and the
pre-existing patrol tests going red here is expected and transient (Step 4 is where their
staying green becomes the proof the extraction was behavior-preserving). Do not continue
until you have seen that failure output.

- [ ] **Step 3: Generalize the marker routine and add the second marker**

In `src/themes/platformer/editor/EditorCanvas.tsx`, extend the `paletteTiles` import:

```typescript
import { PATROL_GLYPH, CONNECTION_POINT_GLYPH } from './paletteTiles';
```

add the character constant next to the existing `PATROL_CHAR` declaration near the top:

```typescript
const CONNECTION_POINT_CHAR: TileChar = '+';
```

and replace the whole block from the `/** The character drawn on a patrol tile … */` doc
comment that sits directly ABOVE `export const PATROL_MARKER_GLYPH = PATROL_GLYPH;` (start
at the comment, not at the `export` line — the replacement below reproduces that comment,
so starting one line lower leaves a duplicate) down to and including
`drawPatrolMarkers`'s closing brace, with:

```typescript
/** The character drawn on a patrol tile in the editor — the same one its
 *  palette button shows, so a placed tile is recognizable as the tool that
 *  painted it. */
export const PATROL_MARKER_GLYPH = PATROL_GLYPH;

/** Same idea for the blueprint connection point (roadmap step 44b): the tile
 *  is invisible in game, so the editor draws its palette glyph on it. */
export const CONNECTION_POINT_MARKER_GLYPH = CONNECTION_POINT_GLYPH;

const PATROL_MARKER_TINT = 'rgba(255, 96, 96, 0.35)';
const PATROL_MARKER_GLYPH_COLOR = '#3d0a0a';
// Blue, so a connection point is never mistaken for a patrol boundary at a
// glance — both are tinted, sprite-less marker cells. Unrelated to step 44c's
// blue/red PLACEMENT PREVIEW border, which outlines a whole pending placement
// rather than tinting one cell.
const CONNECTION_POINT_MARKER_TINT = 'rgba(96, 168, 255, 0.4)';
const CONNECTION_POINT_MARKER_GLYPH_COLOR = '#0a2a4d';
const MARKER_FONT_SIZE = 18;
// The glyph is drawn as a dark core inside a light halo rather than in one
// flat color: a marker tile can sit over anything the editor draws — pale
// sky, dark ground, a ladder — and the editor itself renders in both a light
// and a dark theme, so no single fill stays legible everywhere.
const MARKER_HALO_COLOR = 'rgba(255, 255, 255, 0.9)';
const MARKER_HALO_WIDTH = 3;

/** Draws a tinted cell with `glyph` on every `char` tile. Editor-only,
 *  exactly like drawSignBadges above: both markers that use this — the patrol
 *  boundary and the blueprint connection point — are invisible in the real
 *  game by design (Renderer.ts's tileSource returns null for both), which
 *  would otherwise leave an author painting tiles they cannot see. */
function drawTileMarkers(
  ctx: CanvasRenderingContext2D,
  grid: TileChar[][],
  char: TileChar,
  glyph: string,
  tint: string,
  glyphColor: string,
  originX: number,
  originY: number,
): void {
  ctx.save();
  ctx.font = `${MARKER_FONT_SIZE}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] !== char) continue;
      const { x, y } = tileToPixel(col, row);
      const destX = x + originX;
      const destY = y + originY;
      ctx.fillStyle = tint;
      ctx.fillRect(destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE);
      const centerX = destX + RENDERED_TILE_SIZE / 2;
      const centerY = destY + RENDERED_TILE_SIZE / 2;
      ctx.lineWidth = MARKER_HALO_WIDTH;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = MARKER_HALO_COLOR;
      ctx.strokeText(glyph, centerX, centerY);
      ctx.fillStyle = glyphColor;
      ctx.fillText(glyph, centerX, centerY);
    }
  }
  ctx.restore();
}
```

Then replace the single `drawPatrolMarkers(...)` call inside the draw effect with both
calls:

```typescript
      drawTileMarkers(
        ctx,
        grid,
        PATROL_CHAR,
        PATROL_MARKER_GLYPH,
        PATROL_MARKER_TINT,
        PATROL_MARKER_GLYPH_COLOR,
        panOffset.x,
        panOffset.y,
      );
      drawTileMarkers(
        ctx,
        grid,
        CONNECTION_POINT_CHAR,
        CONNECTION_POINT_MARKER_GLYPH,
        CONNECTION_POINT_MARKER_TINT,
        CONNECTION_POINT_MARKER_GLYPH_COLOR,
        panOffset.x,
        panOffset.y,
      );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/EditorCanvas.test.tsx`
Expected: PASS — the 4 new tests plus every pre-existing test in the file. The three
`EditorCanvas patrol markers` tests are the load-bearing ones: they were not edited, so
their passing is what proves the `drawTileMarkers` extraction preserved the patrol
marker's behavior exactly.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/EditorCanvas.tsx src/themes/platformer/editor/EditorCanvas.test.tsx
git commit -m "feat(platformer): draw an editor-only marker on blueprint connection points"
```

---

### Task 5: The Level Editor disarms the tool when the level canvas becomes active

**Files:**
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`

**Interfaces:**
- Consumes: nothing new — `canvasMode` is already passed to `Palette`, and
  `editorSelectedToolSignal` already exists.
- Produces: no new exports, no new props, no new signal.

**Why this task exists at all.** It is the exact counterpart of step 44a's design note 4,
running the other way. `selectedTool` is persisted (`editorSelectedToolSignal`) and shared
by both canvases, so an author who arms Connection Point on the blueprint canvas and then
clicks **Level** would face a palette with nothing selected while every click painted a
`'+'` into the real level — an inert character no level consumer reads, sitting in a
layout that may then be exported and saved. Task 3 removes the *button*; this removes the
*armed tool*, in the two places 44a already established: inside `setCanvasMode`, and once
at mount (the mode is persisted, so the editor can come back up on the level canvas with
`'+'` still armed and no toggle click ever happening).

`BLUEPRINT_FALLBACK_TOOL` is renamed to `FALLBACK_TOOL` in the same edit: with two mirrored
disarms it is no longer the blueprint's fallback, it is the fallback. It is module-private
and unexported, with exactly two call sites today (`setCanvasMode`'s Spawn branch and the
mount effect) becoming four after this task — all in `LevelEditorPage.tsx`, none in any
test.

- [ ] **Step 1: Write the failing tests**

Append to `src/themes/platformer/editor/LevelEditorPage.test.tsx`, reusing
`paintBlueprintCell`, `renderEditorInBlueprintMode` and `saveBlueprintAs` from the step 44a
tests already in this file:

```tsx
describe('LevelEditorPage — blueprint connection points (step 44b)', () => {
  it('blueprintMode-thePaletteOffersTheConnectionPointTool', () => {
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.getByRole('button', { name: 'Connection Point' })).toBeInTheDocument();
  });

  it('levelMode-thePaletteDoesNotOfferTheConnectionPointTool', () => {
    render(<LevelEditorPage />);

    expect(screen.queryByRole('button', { name: 'Connection Point' })).not.toBeInTheDocument();
  });

  it('paintingWithTheConnectionPointTool-writesItsCharacterIntoTheBlueprintGrid', async () => {
    renderEditorInBlueprintMode();
    fireEvent.click(screen.getByRole('button', { name: 'Connection Point' }));

    paintBlueprintCell(2, 1);

    await waitFor(() => {
      expect(editorBlueprintSignal.value[1][2]).toBe('+');
    });
  });

  it('savingABlueprintWithAConnectionPoint-keepsTheCharacterInTheStoredLayout', async () => {
    // The crop/export path carries '+' like any other character — nothing in
    // saveBlueprintToStash/cropLevelForExport knows about connection points,
    // which is exactly what step 44c relies on to read them back.
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Connection Point' }));
    paintBlueprintCell(3, 1);

    await saveBlueprintAs('Test Room');

    expect(readSavedBlueprints()).toEqual([
      { id: 'test-room', name: 'Test Room', layout: ['G+'] },
    ]);
  });

  it('connectionPointArmed-switchingToLevel-disarmsItSoClicksCannotPaintOneIntoTheLevel', () => {
    // The palette merely stops OFFERING the tool (Task 3). `selectedTool` is
    // persisted and shared by both canvases, so without an explicit disarm a
    // session that left '+' armed would paint inert markers into a real
    // level through a palette showing nothing selected.
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = '+';
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Level' }));

    expect(editorSelectedToolSignal.value).not.toBe('+');
    expect(screen.getByRole('button', { name: 'Ground Grass' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('mountedInLevelModeWithTheConnectionPointArmed-disarmsItWithoutAnyToggleClick', () => {
    // Both the mode and the tool are persisted, so the editor can come back
    // up on the level canvas with '+' selected and no toggle click to
    // trigger the other disarm path.
    editorCanvasModeSignal.value = 'level';
    editorSelectedToolSignal.value = '+';

    render(<LevelEditorPage />);

    expect(editorSelectedToolSignal.value).not.toBe('+');
    expect(screen.queryByRole('button', { name: 'Connection Point' })).not.toBeInTheDocument();
  });

  it('blueprintModeWithTheConnectionPointArmed-keepsItArmedAcrossAMountInThatMode', () => {
    // The mirror case must NOT be disarmed: '+' is a perfectly valid armed
    // tool on the blueprint canvas.
    editorCanvasModeSignal.value = 'blueprint';
    editorSelectedToolSignal.value = '+';

    render(<LevelEditorPage />);

    expect(editorSelectedToolSignal.value).toBe('+');
    expect(screen.getByRole('button', { name: 'Connection Point' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
```

`fireEvent`, `screen`, `waitFor`, `render`, `editorCanvasModeSignal`,
`editorSelectedToolSignal`, `editorBlueprintSignal` and `readSavedBlueprints` are all
already imported by this test file (step 44a's Tasks 6 and 7) — no import additions are
needed.

**Coordinate arithmetic for the save test, hand-verified:** the blueprint canvas starts as
`[['.']]` at pan `{ x: 0, y: 0 }`. `paintBlueprintCell(2, 1)` grows it to 3×2 with
`colShift = rowShift = 0` and writes `'G'` at `grid[1][2]`; `paintBlueprintCell(3, 1)` then
grows it to 4×2 (again growing right only, no shift) and writes `'+'` at `grid[1][3]`.
`cropLevelForExport`'s tightest non-`.` bounding box is `minRow = maxRow = 1`,
`minCol = 2`, `maxCol = 3` → `layout = ['G+']`, and with no background pieces the stored
entry omits `background` entirely, exactly as step 44a's own save test asserts.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx -t "connection points"`
Expected: FAIL — the two disarm tests find `'+'` still armed (the palette-only change from
Task 3 does not touch the signal). The four tests that only exercise painting/saving may
already pass; the disarm pair is the RED that matters here. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the implementation**

In `src/themes/platformer/editor/LevelEditorPage.tsx`, replace the two module constants
above the component:

```typescript
// Blueprint mode has no Spawn tool and level mode has no Connection Point
// tool (Palette.tsx), so an already-armed one of either is swapped for this
// when the canvas it does not belong to becomes active.
const SPAWN_CHAR: TileChar = 'S';
const CONNECTION_POINT_CHAR: TileChar = '+';
const FALLBACK_TOOL: TileChar = 'G';
```

In `setCanvasMode`, replace the Spawn branch with the mirrored pair (the centering branch
below it is untouched):

```typescript
    if (mode === 'blueprint' && selectedTool === SPAWN_CHAR) {
      setSelectedTool(FALLBACK_TOOL);
    }
    if (mode === 'level' && selectedTool === CONNECTION_POINT_CHAR) {
      setSelectedTool(FALLBACK_TOOL);
    }
```

and in the mount-only effect, extend its comment and its body:

```typescript
  // Mount-time counterpart of setCanvasMode's two disarms: the mode and the
  // tool are both persisted, so the editor can come back up on either canvas
  // with the other canvas's exclusive tool still armed, without any toggle
  // click ever happening. Deliberately mount-only — a later mode switch is
  // the other handler's job.
  useEffect(() => {
    // Deliberate one-shot mount-time correction of persisted state (see
    // comment above), not a render derived from a prop/state change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isBlueprintMode && selectedTool === SPAWN_CHAR) setSelectedTool(FALLBACK_TOOL);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isBlueprintMode && selectedTool === CONNECTION_POINT_CHAR) setSelectedTool(FALLBACK_TOOL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: PASS — the 7 new tests plus every pre-existing test in the file, including step
44a's two Spawn-disarm tests (unchanged behavior after the constant rename).

- [ ] **Step 5: Run the full suite, the typechecker and the linter**

```bash
npm test
npx tsc -b --noEmit
npm run lint
```

Expected: tests PASS with a total count equal to the baseline recorded before this plan
started, plus the **25** tests this plan adds (7 in Task 1 — 3 parser + 4 palette-map; 1 in
Task 2; 6 in Task 3; 4 in Task 4; 7 in Task 5 — 7 + 1 + 6 + 4 + 7 = 25; the several
*edited* existing assertions add no new test cases, including Task 2's extra
`isClimbable('blueprintConnectionPoint')` line, which lands inside the existing
`everyOtherTile-returnsFalse` body). Typecheck: clean. Lint: zero errors and zero warnings — do not skip
it, it is the run that catches this repo's non-type rules (an unused import left behind by
the `drawPatrolMarkers` extraction would surface here, not in `tsc`).

- [ ] **Step 6: Manual browser check**

Start the dev server and open `/platformer/editor`. Confirm, in order:

1. In **Level** mode the Palette's **Tools** group shows Sign, Patrol Boundary and Eraser
   — and no Connection Point.
2. Click **Blueprint**: **Connection Point** appears in Tools, between Patrol Boundary and
   Eraser, as a bordered square with the ⊕ glyph (no sprite), and its tooltip reads
   "Blueprint only; marks a border cell another blueprint can attach to".
3. Paint a small room, then select **Connection Point** and paint two or three cells on
   its border — each shows a blue-tinted cell with the ⊕ glyph, clearly different from a
   red patrol marker. Paint one in the middle of the room too: it is accepted (44b stores
   no notion of "border"; the open side is derived at placement time in 44c).
4. Paint a connection point onto a cell that already holds one: nothing changes — one tile
   per cell means two can never share a cell. Right-click erases it back to empty.
5. **Save Blueprint** under a name, pick **new** to blank the canvas, then reopen the saved
   entry: every connection point comes back where it was.
6. In devtools, `localStorage.getItem('platformer-editor-saved-blueprints')` shows `+`
   characters inside the stored `layout` rows.
7. With Connection Point still armed, click **Level**: the tool button disappears *and*
   Ground Grass is now shown selected — clicking the level canvas paints ground, never a
   `+`. Reload the page while in Level mode with a connection point last armed: same
   result, no `+` in the palette and Ground Grass armed.
8. Click **Try** on a level: the game runs exactly as before (no connection point exists in
   the shipped level, and the tile is invisible and non-solid regardless).

- [ ] **Step 7: Commit**

```bash
git add src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx
git commit -m "feat(platformer): disarm the Connection Point tool on the level canvas"
```

- [ ] **Step 8: Update `docs/Features.md` if step 44b is tracked there**

Per `CLAUDE.md`'s Feature Completion Tracking. **Already checked against the real file:**
`docs/Features.md` has no blueprint-rooms entry of its own. Its only relevant row is
`S-006 | 2D Platformer theme | 📋 Planned` (bullet line 25, status table line 54, diagram
node `S006` line 92) — the *whole* platformer theme, of which 44b is one roadmap step
among many still open (44c alone is unstarted). So this step does **not** complete
`S-006`, and the correct action is to change nothing: do not tick the bullet, do not flip
the status row, do not mark the node done. Re-confirm that `S-006` is still the only
matching entry (someone may have added one since), then say "nothing to update" rather
than inventing an entry or ticking a feature that is not finished.

---

## Self-Review Notes

- **Spec coverage.** The design doc's "Data model" paragraph on
  `'blueprintConnectionPoint'` maps to Task 1 (a new `TileChar`/`TileType` following the
  `patrol` precedent — invisible in gameplay rendering, non-solid, no collision behavior)
  and Task 2 (the non-solid/non-climbable guards). The "Step 44b — Marking connection
  points" section maps to Task 3 ("just another Palette entry, available whenever
  blueprint mode is active", painted "directly onto `blueprintGrid`'s border cells exactly
  like any other tile, no separate marking mode"), Task 4 (making a painted cell visible)
  and Task 5 (keeping the tool off the level canvas). Nothing here derives an open side,
  counts points per side, checks adjacency, or tints a placement preview — all of that is
  44c, as the design says.
- **Character-collision check, hand-verified.** Every key of all four maps was read out of
  the real `LevelParser.ts` and listed in Task 1's table: terrain `. G R # B H I P n N`,
  entity `S M m o X Q F u p T`, sign `1 2 3 4 5`, hazard `^ v < >` — 29 characters, which
  is exactly the length of today's `TileChar` union (counted: `.` `G` `R` `#` `B` `H` `I`
  `P` `S` `M` `m` `o` `X` `Q` `F` `T` `u` `p` `n` `N` `1` `2` `3` `4` `5` `^` `v` `<` `>`
  = 29). `'+'` is in none of them. Three independent backstops confirm it after the fact:
  `LevelParser.ts`'s module-load guard throws on any shared key (so a mistake fails every
  suite at import), the `TileChar` drift-guard test asserts every map key is in the union,
  and Task 1's own explicit `'+' in ENTITY_CHARS/SIGN_CHARS/HAZARD_CHARS` assertions.
  `'C'` was the other real candidate and was rejected deliberately (step 39 retired it from
  "coin"; reusing a recently-freed letter is the kind of thing step 38/39's history shows
  this project avoids).
- **Deviation, deliberate — `EditorCanvas.tsx` IS modified.** Step 44a's plan forbade it;
  that constraint was about *that* step, where the canvas only needed different data
  through existing props. Here the requirement is new *rendering*: the tile is invisible in
  game by design, so an author would be painting cells they cannot see. There is no
  prop-shaped way to say "draw a glyph on these cells" — the canvas owns its own drawing,
  and `drawPatrolMarkers` is the in-repo precedent for exactly this problem. Mitigations:
  no new prop (so all ~30 existing render sites in `EditorCanvas.test.tsx` compile
  unchanged), and the patrol routine is generalized rather than duplicated, with the three
  untouched patrol tests standing as the proof that the extraction changed nothing.
- **Deviation, deliberate — Task 2 has no RED.** `isSolid`/`isClimbable` are whitelists, so
  the new tile is non-solid and non-climbable the moment the union grows; a failing-first
  test is not constructible without first breaking the production code. The tests are kept
  anyway as regression guards (the design doc explicitly calls out non-solid as a
  requirement), and the task says plainly that it is a guard, not a cycle.
- **Which new tests are actually RED, spelled out per task.** "Run tests to verify they
  fail" does not mean *every* test added in that step fails, and pretending otherwise is
  how an implementer talks themselves past a broken RED step. Verified case by case:
  Task 1 — 2 of 3 parser tests fail; `connectionPointChar-collidesWithNoOtherCharacterMap`
  is green from the start (an invariant guard), and the `TileChar` drift-guard edit is a
  `tsc` failure only, never a vitest one, because vitest strips types. All 4 palette-map
  tests fail. Task 2 — nothing fails, by construction (whitelists). Task 3 — 5 of the 7
  touched cases fail; the click-arms and Eraser-is-last cases already pass because Task 1
  temporarily renders `'+'` in the **Terrain** group, which is itself the bug Task 3
  fixes. Task 4 — all 4 fail (`CONNECTION_POINT_MARKER_GLYPH` is not exported yet, so the
  file will not even resolve the import). Task 5 — only the 2 disarm tests fail; the other
  5 already pass on Task 3's palette change alone. Each step's "Expected: FAIL" text now
  names exactly those, so a step that fails differently is a real signal.
- **No broken intermediate commit.** Checked by hand: after Task 1's commit (before Task 3
  lands) `Palette.test.tsx`'s un-edited button-count test still passes, because it derives
  `terrainCount` from `Object.keys(TERRAIN_CHARS)` and `'+'` is genuinely rendered in the
  Terrain group at that point — the count grows on both sides of the assertion together.
  Task 1 can therefore be committed on its own without a red suite.
- **Deviation, deliberate — the tool lives in Tools, not Terrain.** The design doc calls it
  "just another Palette entry, alongside the normal foreground terrain/entity tools". It
  is registered in `TERRAIN_CHARS` (that is where a non-entity character has to live for
  `parseLevel` to resolve it to a tile type), but grouping it visually under "Terrain"
  would put an invisible marker next to grass and rock. `Palette.tsx`'s own comment already
  established the rule for `patrol`; this follows it, and Task 3 pins the placement with a
  test in both directions.
- **Deviation, deliberate — the tool is disarmed, not merely hidden (Task 5).** The design
  doc only says the entry is "available whenever blueprint mode is active". Because
  `editorSelectedToolSignal` is persisted and shared, hiding the button alone would leave
  `'+'` armed on the level canvas. This mirrors step 44a's identical decision for Spawn,
  including its two trigger points (toggle handler + mount effect), and adds the
  "blueprint mode keeps `'+'` armed" test so the correction cannot overreach.
- **No new editor state, confirmed by reading the file.** `editorLevelState.ts` already
  has `editorSelectedToolSignal` and `editorCanvasModeSignal`; 44b needs nothing else, so
  it is not touched. Likewise `paintCell.ts`: its only character-specific branches are the
  single-spawn enforcement (`tool === 'S'`), sign cycling (`SIGN_KEYS`) and hazard facing
  cycling (`HAZARD_KEYS`), so `'+'` takes the plain "write this character into this cell"
  path — which is precisely what gives the design's "one tile type per cell, so two
  connection points can never occupy the same cell" for free, with no new code.
- **Compile-enforced surfaces, all four accounted for.** Widening `TileType` breaks
  `Renderer.ts`'s `tileSource` (`default: const _exhaustive: never = type`), and widening
  `TileChar` breaks `PALETTE_TILE_SPRITES`, `PALETTE_TILE_DESCRIPTIONS` and
  `PALETTE_TILE_LABELS` (all `Record<TileChar, …>`). A repo-wide grep for
  `Record<TileChar` / `Record<string, TileType` found no others. All four are handled
  inside Task 1, which is why that task is the largest, and Task 1 ends with an explicit
  `npx tsc -b --noEmit` step rather than relying on a later run to notice.
- **Type/character threading, checked end to end.** `'blueprintConnectionPoint'` is
  produced in Task 1 (`LevelData.ts`) and consumed as a `TERRAIN_CHARS` value (Task 1),
  a `tileSource` case (Task 1) and two `Terrain` guards (Task 2) — spelled identically
  everywhere, never abbreviated. The character `'+'` is declared once per consuming module
  as a named `TileChar` constant — `CONNECTION_POINT_CHAR` in `Palette.tsx` (Task 3),
  `EditorCanvas.tsx` (Task 4) and `LevelEditorPage.tsx` (Task 5) — following the file-local
  `PATROL_CHAR`/`SPAWN_CHAR` convention each of those files already uses, so no bare `'+'`
  literal appears in production code. The glyph has exactly one definition,
  `CONNECTION_POINT_GLYPH` in `paletteTiles.ts`, re-exported by `EditorCanvas.tsx` as
  `CONNECTION_POINT_MARKER_GLYPH` the same way `PATROL_GLYPH`/`PATROL_MARKER_GLYPH` already
  pair up — so the palette button and the canvas cell can never show different symbols, and
  the Task 4 tests assert through the constant rather than the literal `'⊕'`.
  `canvasMode: 'level' | 'blueprint'` is reused verbatim from step 44a; no new prop, no new
  union, no renamed one.
- **Rename audit.** Task 4 renames three module-private constants
  (`PATROL_MARKER_FONT_SIZE`/`_HALO_COLOR`/`_HALO_WIDTH` → `MARKER_*`) and Task 5 renames
  one (`BLUEPRINT_FALLBACK_TOOL` → `FALLBACK_TOOL`). None is exported, none is referenced
  by any test, and each has exactly the call sites shown in its task. `PATROL_MARKER_GLYPH`
  — the one export a test imports — keeps its name.
- **Test-runner facts confirmed against the repo.** `src/test/setup.ts`'s canvas mock
  already provides `strokeText` *because* of the patrol marker's halo, so the second marker
  needs no setup change. `EditorCanvas.test.tsx`'s own `stubCanvasContext()` likewise
  already stubs `fillText`/`strokeText`/`fillRect`/`save`/`restore`, and its
  `EMPTY_IMAGES`/`BACKGROUND_LAYER_DEFAULT_PROPS` fixtures exist and are reused verbatim by
  Task 4. `LevelEditorPage.test.tsx`'s `beforeEach` resets `editorCanvasModeSignal`,
  `editorSelectedToolSignal`, `editorBlueprintSignal`, `editorBlueprintBackgroundSignal`,
  `editorLoadedBlueprintNameSignal` and `savedBlueprintsSignal` (step 44a added the
  selected-tool reset), so Task 5's tests that write `'+'` into the tool signal cannot leak
  into later tests. `Palette.test.tsx` already imports `within` and `userEvent`, both of
  which Task 3's tests use.
- **Placeholder scan.** No TBDs, no "similar to the above", no vague prose standing in for
  code. Every code block is complete and was written against the real file it edits, read
  in full first: `LevelData.ts`, `LevelParser.ts`, `Terrain.ts`, `Renderer.ts`'s
  `tileSource`, `paletteTiles.ts`, `Palette.tsx`, `EditorCanvas.tsx`,
  `editorLevelState.ts`, `paintCell.ts`, `importLayout.ts`, `exportLayout.ts`,
  `cropLevelForExport.ts`, `growGrid.ts`, `BlueprintData.ts`, and the six test files
  touched. The only conditional instruction in the plan is Task 5's Step 8, which is
  conditional by nature (update `docs/Features.md` only if it tracks this step).
