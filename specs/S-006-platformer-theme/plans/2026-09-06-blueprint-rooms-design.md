# Blueprint Rooms: Capture, Tag, and Place Reusable Level Chunks — Design

## Roadmap status

Slotted into `roadmap.md` as Iteration 4 steps **44a** (capture), **44b** (connection
points), **44c** (placement), after step 43. Delivered in that order — 44b depends on
44a's captured region existing to mark points on; 44c depends on 44b's connection points
existing to validate fit against.

## Goal and scope

Give the Level Editor a way to capture an arbitrary-shaped, already-built region of the
grid — a "room" — as a named, reusable **blueprint**, tag spots on its border where
other blueprints can attach, then stamp saved blueprints back into a level with
placement validated against those attachment spots. The immediate use is hand-assembling
a level from a library of rooms instead of painting every level from scratch; a stated
future goal (out of scope here) is generating levels by combining blueprints
automatically.

Purely an editor-time concept, like `patrol`: nothing about a blueprint or a connection
point changes runtime gameplay. A placed blueprint's cells become ordinary terrain/entity
tiles in the level the moment they're stamped down.

## Data model

A blueprint is a sparse list of cells relative to a local origin — not a bounding-box
grid — since captured shapes are freeform, not rectangles:

```typescript
// src/themes/platformer/level/BlueprintData.ts
interface BlueprintCell {
  row: number;
  col: number;
  tile: TileChar;
}

interface Blueprint {
  id: string;    // slug, also the filename stem — mirrors LevelEntry's id
  name: string;
  cells: BlueprintCell[];
}
```

A new `TileChar`/`TileType` — `'blueprintConnectionPoint'` — follows the `patrol`
precedent exactly: invisible in normal gameplay rendering, non-solid, no collision
behavior. It's just a tile like any other, so "two connection points on one cell" is
already impossible (painting one overwrites the other) and needs no extra validation.
Connection points are simply the cells in `Blueprint.cells` whose `tile ===
'blueprintConnectionPoint'` — no separate list, no stored facing direction. A point's
open side is derived at placement time (see Fit rule) from which neighbor of that cell
falls outside the blueprint's shape.

## Step 44a — Capturing a region

New editor mode, "Draw Blueprint" (a `Palette` toggle alongside the existing
Foreground/Background tabs). While active:

- The user paints border tiles with the normal palette/paint tool — any solid terrain
  works as a wall, exactly like painting the level itself.
- The user then clicks once **inside** the drawn loop to say "flood from here." A flood
  fill runs outward from that cell, treating any solid tile (`isSolid`) as a boundary it
  cannot cross.
  - **Enclosed**: the flood never reaches the edge of the currently-grown grid. Every
    reached cell, plus the solid cells that stopped it, is the captured region —
    highlighted with a blue tint (fill + border) over the canvas.
  - **Not enclosed**: the flood escapes to the grid's edge. Nothing is captured; the
    attempted region is tinted red instead, and the user keeps painting/closing the gap
    and re-clicking inside.
- With a valid (blue) capture showing, a "Save as Blueprint" action prompts for a name
  and writes every reached cell (including untouched `.` cells inside the loop — "filling
  in the holes" — and the solid border cells themselves) as `Blueprint.cells`, relative to
  the capture's own top-left bounding cell as origin.
- Capturing a blueprint does not remove or alter the source cells in the main grid —
  it's a copy, like export is a copy of the whole level.

## Step 44b — Marking connection points

After a capture, "Mark Connection Points" mode lets the user click any of the captured
region's border cells (a cell in `cells` with at least one 4-neighbor outside the
captured set) to toggle it to `blueprintConnectionPoint`, overwriting whatever tile was
there — same silent-overwrite convention as normal painting. No limit on how many per
side; the only implicit constraint is the one painting already gives for free (one tile
type per cell).

This mode operates on the in-progress capture, before "Save as Blueprint" — the saved
`Blueprint.cells` already reflects any connection points marked.

## Step 44c — Saving and the palette library

Mirrors `saveLevelFile.ts`/`saveLevelEndpoint.ts` exactly:

- `saveBlueprintFile.ts`: `blueprintFileJson(name, cells)`, `blueprintFileName(name)`,
  `saveBlueprint` (POST, falling back to download), `downloadBlueprintFile`.
- `saveBlueprintEndpoint.ts`: `BLUEPRINTS_FOLDER =
  'src/themes/platformer/level/blueprints/'`, `SAVE_BLUEPRINT_ENDPOINT =
  '/__save-blueprint'`.
- `vite/writeBlueprintFile.ts` + `vite/blueprintWritePlugin.ts` (`apply: 'serve'`): same
  validation shape as `writeLevelFile.ts` (slugified filename only, no path traversal,
  well-formed JSON with a non-empty `cells` array).
- `blueprintRegistry.ts` (mirrors `levelRegistry.ts`): `import.meta.glob`s
  `blueprints/*.json` at build time into `Blueprint[]`, skipping any file that isn't a
  well-formed `Blueprint`.
- `Palette.tsx` gains a Blueprints section listing every registry entry. Selecting one
  arms "Place Blueprint" mode (Step 44c placement, below).

### Hiding dev-only actions when there's no dev server

Today, `saveLevel`'s POST silently falls back to a browser download when
`SAVE_LEVEL_ENDPOINT` doesn't answer (a built/statically-served site) — the Save button
itself always renders. This design changes that: a new tiny endpoint,
`/__dev-environment`, served by a Vite plugin the same `apply: 'serve'` way, answers a
fixed `{ isDev: true }`. On mount, the app pings it once and stores the result in a new
`isDevEnvironmentSignal` (`false` until/unless the ping succeeds — never true on a built
site, since the route doesn't exist there). Both the existing "Save Level" control and
the new "Save as Blueprint" control render only while that signal is `true`. Placing an
already-saved blueprint needs no server (the registry is a static import) and stays
visible regardless.

## Step 44c — Placement

- **1st click** on the grid with a blueprint armed: renders a preview of `cells` anchored
  at the clicked cell (origin → clicked cell), overlaid on the canvas. Border tinted:
  - **Blue** (valid) if no `cells` entry lands on an already-occupied (non-`.`) cell in
    the live grid, **and** either the grid has no `blueprintConnectionPoint` cell at all
    yet, or at least one of the preview's connection points is orthogonally adjacent to
    an existing `blueprintConnectionPoint` cell with both cells' open side (the
    4-neighbor that falls outside their own blueprint's shape) facing each other.
  - **Red** (invalid) otherwise.
  - Clicking elsewhere while still armed re-previews at the new position instead of
    committing.
- **2nd click on the same cell** (or an explicit confirm) commits: every `cells` entry is
  written into the live grid at its shifted position, through the same `growGrid` path
  normal painting uses, so placing near the current edge grows the grid exactly like
  painting there would.

## Testing

Per the constitution, tests first:

- `floodFillRegion.ts` (44a) — enclosed vs. leaking shapes, including one with an
  interior `.` gap that must still be included in the captured set.
- `blueprintCapture` → `Blueprint.cells` — origin normalization (top-left of the
  captured set becomes `{row: 0, col: 0}`).
- `blueprintFit.ts` (44c) — overlap detection; adjacent-facing-connection-point
  detection; the "no connection points exist yet" unconstrained case.
- `saveBlueprintFile.test.ts` / `blueprintRegistry.test.ts` — mirror the existing
  `saveLevelFile.test.ts`/`levelRegistry.test.ts` coverage exactly (naming, JSON shape,
  malformed-file skipping).
- `isDevEnvironmentSignal` — resolves `true` only when the ping endpoint answers,
  `false` on fetch failure/no route.

Manual verification: draw an irregular (non-rectangular) border, confirm the flood-fill
correctly tints blue only once closed; save it; place a second blueprint next to it and
confirm the border goes blue only when a connection point lines up and nothing overlaps.

## Out of scope

- Rotating or mirroring a blueprint before placement.
- Nesting — capturing a region that contains an already-placed blueprint's connection
  points as a blueprint of its own.
- Auto-generating a full level from a library of blueprints (the longer-term goal this
  feature is a building block for, not part of it).
- Any gameplay-visible behavior for connection points (no runtime transition/teleport —
  confirmed as pure editor-time sockets).
