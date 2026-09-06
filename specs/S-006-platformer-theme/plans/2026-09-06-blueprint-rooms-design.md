# Blueprint Rooms: Capture, Tag, and Place Reusable Level Chunks — Design

## Roadmap status

Slotted into `roadmap.md` as Iteration 4 steps **44a** (blueprint canvas), **44b**
(connection points), **44c** (placement), after step 43. Delivered in that order — 44b
depends on 44a's blueprint canvas existing to paint connection points onto. 44c does
**not** depend on 44b's connection points for validation (see the Placement section below
— that dependency was cut after a real design flaw surfaced): 44c only needs 44a's saved
`Blueprint` shape to place one.

## Goal and scope

Give the Level Editor a way to author a "room" on its own small canvas as a named,
reusable **blueprint**, tag spots on its border as connection points (an authoring/legibility
aid — see the note below), then stamp saved blueprints back into a level with placement
validated only against overlap with existing terrain. The immediate use is hand-assembling
a level from a library of rooms instead of painting every level from scratch; a stated
future goal (out of scope here) is generating levels by combining blueprints
automatically.

**Why placement validation dropped connection-point matching.** The original design had a
placed blueprint's connection point re-derive its "open side" from which neighbor fell
outside its *source* blueprint's bounds — but once a blueprint's cells are stamped into a
level, that information is gone: a `'+'` sitting in the level grid has no memory of which
blueprint it came from or what that blueprint's bounds were, so a *second* placement
validated against an *already-placed* blueprint's connection point had no sound way to
recover its facing. Rather than patch this with a heuristic (e.g. "whichever neighbor is
currently empty"), the simpler and more flexible rule below was chosen instead:
overlap-only validation, with connection points staying purely an authoring/legibility aid
(and, per the Goal above, useful to a future auto-generator working directly from
blueprint files, where the degenerate case above never arises — it never touches an
already-assembled level). Overlap-only is also strictly more flexible for hand-assembly:
it allows placing two blueprints apart and connecting them with hand-painted terrain in
between, rather than forcing a rigid snap-together model.

Purely an editor-time concept, like `patrol`: nothing about a blueprint or a connection
point changes runtime gameplay. A placed blueprint's cells become ordinary terrain/entity
tiles in the level the moment they're stamped down.

## Data model

A blueprint is authored on its own small grid, in its own editor mode — not carved out of
an existing level — so it needs no sparse cell list or capture algorithm: it's exactly a
level layout in miniature, reusing `exportLayout`/`importLayout`'s existing
`readonly string[]` shape (crop to the tightest non-`.` bounding box, one string per row),
plus an optional `background` list in exactly the shape `LevelDef.background` already
has, since blueprints support the same decorative background layer levels do:

```typescript
// src/themes/platformer/level/BlueprintData.ts
interface Blueprint {
  id: string;    // slug, also the filename stem — mirrors LevelEntry's id
  name: string;
  layout: readonly string[];
  background?: BackgroundPlacement[];
}
```

A blueprint's own interior `.` cells are captured too, since the crop only trims the
bounding box's *outer* empty rows/columns — an intentionally-empty patch in the middle of
a room (a floor gap, say) survives untouched. Placing a blueprint later (step 44c) stamps
every foreground cell of its `layout`, `.` included, into the target grid at the chosen
origin; its `background` placements are rebased onto that same origin and appended to the
target level's own background list.

A new `TileChar`/`TileType` — `'blueprintConnectionPoint'` — follows the `patrol`
precedent exactly: invisible in normal gameplay rendering, non-solid, no collision
behavior, just another character a blueprint's `layout` can contain. Connection points
are simply the layout's `blueprintConnectionPoint` cells — no separate list, no stored
facing direction, and (as of the Placement section below) no facing derivation of any
kind: placement validation never reads them. They remain purely an authoring/legibility
aid — marking, for a human (or a future auto-generator reading blueprint files directly),
where a room's intended attachment spots are — with zero effect on whether a placement is
considered valid.

## Step 44a — A dedicated Blueprint canvas

Blueprints are authored on their own small grid, in a distinct editor mode — not carved
out of an already-built level. A new **Level / Blueprint** toggle sits in
`LevelEditorPage`'s sidebar, in its own group alongside (not merged into) the existing
Foreground/Background toggle — these are two independent axes, not three options on one
switch: Foreground/Background says *which layer* of whichever canvas is active gets
painted; Level/Blueprint says *which canvas* — the level's `grid`, or a second,
independent `blueprintGrid` (with its own `blueprintBackgroundPlacements`) — is currently
active. Both stay visible and both keep working exactly as they do today, just
retargeted: with Blueprint selected, Foreground/Background still switches which of the
*blueprint's own* two layers is being painted, the same way it does for a level.

The Level Select dropdown and Save button below them become two pairs that swap with the
same toggle — only one pair showing at a time, not both stacked: **Level Select** +
**Save Level** (today's controls, unchanged) while Level is selected, **Blueprint
Select** + **Save Blueprint** while Blueprint is selected.

`blueprintGrid` starts empty (a single `.` cell, same as the existing `empty`/
`SCRATCH_LAYOUT` level entry) unless a saved blueprint has been loaded into it. While
this mode is active:

- Painting works exactly like painting a level — same `paintCell`/`growGrid`/
  `placeBackgroundPiece`/`eraseBackgroundCell` paths, same right-click-always-erases
  convention — just targeting `blueprintGrid`/`blueprintBackgroundPlacements` instead of
  the level's own. Every painted cell simply *is* part of the blueprint; there is no
  border to draw, no enclosed/leaking check, and no blue/red tint at this stage — those
  only matter later, at placement time (step 44c), once connection points exist to
  validate a fit against.
- The Palette drops the Spawn tool while blueprint mode is active — a blueprint has no
  concept of a spawn point, and offering the button would just invite a marker nothing
  downstream expects to find outside a real level's layout.
- A **Blueprint Select** dropdown, mirroring `LevelSelect` exactly, lists a blank `new`
  entry plus every saved blueprint (discovered the same way `levelRegistry.ts` discovers
  saved levels — see step 44c). Picking one loads its `layout`/`background` into
  `blueprintGrid`/`blueprintBackgroundPlacements`, so an already-saved blueprint can be
  reopened and edited, same as reopening a saved level.
- A **Save Blueprint** action, mirroring the Level Editor's own Save Level dialog, prompts
  for a name and exports the blueprint canvas via the existing `exportLayout`/
  `cropLevelForExport`-style cropping (tightest non-`.` bounding box, background
  placements rebased to the same origin) into `Blueprint.layout`/`Blueprint.background`.

## Step 44b — Marking connection points

`blueprintConnectionPoint` is just another Palette entry, available whenever blueprint
mode is active (alongside the normal foreground terrain/entity tools, minus Spawn) — the
author paints it directly onto `blueprintGrid`'s border cells exactly like any other
tile, no separate "marking mode" needed. "Border cell" isn't a stored property, and
(per the Goal section's note) nothing at placement time ever reads a connection point's
side/facing — it is purely an authoring/legibility marker, for a human (or a future
auto-generator reading blueprint files directly) to see where a room's intended
attachment spots are. No limit on how many per side; the only implicit constraint is the
one painting already gives for free (one tile type per cell, so two connection points can
never occupy the same cell).

## Step 44c — Saving and the palette library

Mirrors `saveLevelFile.ts`/`saveLevelEndpoint.ts` exactly:

- `saveBlueprintFile.ts`: `blueprintFileJson(name, layout, background)`,
  `blueprintFileName(name)`, `saveBlueprint` (POST, falling back to download),
  `downloadBlueprintFile` — the same four-function shape `saveLevelFile.ts` already has,
  since a `Blueprint` is now the same `{ name, layout, background? }` shape a saved level
  is.
- `saveBlueprintEndpoint.ts`: `BLUEPRINTS_FOLDER =
  'src/themes/platformer/level/blueprints/'`, `SAVE_BLUEPRINT_ENDPOINT =
  '/__save-blueprint'`.
- `vite/writeBlueprintFile.ts` + `vite/blueprintWritePlugin.ts` (`apply: 'serve'`): same
  validation shape as `writeLevelFile.ts` (slugified filename only, no path traversal,
  well-formed JSON with a non-empty `layout` array of strings).
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

Placing a blueprint parses its `layout` into absolute `{ row, col, tile }` cells via the
same per-character mapping `importLayout` already does:

- **1st click** on the grid with a blueprint armed: renders a preview of every non-`.`
  parsed cell anchored at the clicked cell (origin → clicked cell), overlaid on the
  canvas. Border tinted:
  - **Blue** (valid) if none of those cells lands on an already-occupied (non-`.`) cell
    in the live grid — overlap-only validation (see the Goal section's note on why
    connection-point matching was dropped: it degenerates once a blueprint's connection
    points are stamped into a level, since a placed `'+'` carries no memory of its source
    blueprint's bounds). `blueprintConnectionPoint` cells participate in the overlap check
    exactly like any other non-`.` cell — they still count as "occupied" once placed —
    but are never treated specially beyond that.
  - **Red** (invalid) otherwise.
  - Clicking elsewhere while still armed re-previews at the new position instead of
    committing.
  - **Right-click cancels** the armed placement entirely (no preview, blueprint disarmed)
    instead of committing anywhere — right-click has no "erase" meaning during a
    placement preview (nothing is being painted to erase), so repurposing it as an
    immediate cancel gesture costs nothing and needs no dropdown navigation back to the
    Palette.
- **2nd click on the same cell** (or an explicit confirm) commits: every non-`.` parsed
  cell is written into the live grid at its shifted position, through the same
  `growGrid` path normal painting uses, so placing near the current edge grows the grid
  exactly like painting there would. A blueprint's own `.` cells are never written — they
  are bounding-box padding around its shape, not "erase this spot," so placing a
  blueprint can never blank out terrain the target level already had there. Its
  `background` placements (if any) are rebased onto the same origin and appended to the
  target level's own background list, unconditionally (no overlap check — background
  placements already silently replace on overlap, matching how painting the background
  layer works today).

## Testing

Per the constitution, tests first:

- `BlueprintSelect` (44a) — mirrors `LevelSelect.test.tsx`'s coverage: loading an entry
  (including the blank `new` entry) replaces `blueprintGrid`/
  `blueprintBackgroundPlacements`; the Spawn tool is absent from the Palette while
  blueprint mode is active; Foreground/Background still switches which of the
  blueprint's own two layers is being painted.
- `blueprintFit.ts` (44c) — overlap detection only (see the Goal section's note on why
  connection-point matching was dropped from this check).
- `saveBlueprintFile.test.ts` / `blueprintRegistry.test.ts` — mirror the existing
  `saveLevelFile.test.ts`/`levelRegistry.test.ts` coverage exactly (naming, JSON shape,
  malformed-file skipping).
- `isDevEnvironmentSignal` — resolves `true` only when the ping endpoint answers,
  `false` on fetch failure/no route.

Manual verification: enter Draw Blueprint mode, paint a small irregular room (mixing
foreground terrain and a background piece or two), save it, reopen it via Blueprint
Select and confirm it's editable; place a second blueprint next to it and confirm the
border goes blue only when a connection point lines up and nothing overlaps.

## Out of scope

- Rotating or mirroring a blueprint before placement.
- Nesting — placing an already-saved blueprint while editing another blueprint's own
  canvas (a blueprint containing a blueprint). Placement (step 44c) targets the level
  grid only.
- Auto-generating a full level from a library of blueprints (the longer-term goal this
  feature is a building block for, not part of it).
- Any gameplay-visible behavior for connection points (no runtime transition/teleport —
  confirmed as pure editor-time sockets).
