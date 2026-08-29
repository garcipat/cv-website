# Terrain Rework: Autotiled Ground + Cave Background — Research Notes

> **This is a notes/findings document, not an implementation plan.** It exists so the
> investigation behind roadmap step 32 doesn't have to be redone, not to be executed
> task-by-task. Once roadmap step 31 (Level Selection) is done and step 32 is actually
> about to be implemented, run `writing-plans` fresh against the codebase as it exists
> at that point — `PlatformerPage.tsx` in particular will very likely have changed
> substantially by then (steps 20–30 all touch it) and needs re-reading, not blind
> reuse of anything written here.

## Goal (unlikely to change)

Re-theme `groundGrass` from a single fixed 16×16 sprite per tile (today: one "top"
sprite, one "under" sprite, no horizontal awareness) to a properly autotiled look using
the `spring_.png` tileset — tiles connect based on horizontal neighbors, with a distinct
sprite for an isolated single-tile-wide column vs. a continuous run. Add a new non-solid
`caveBackground` tile type, autotiled the same way from `terrain_.png`, for cave-style
background dressing behind the playable terrain. `groundRock`, `platform`, `wall`, and
`bridge` are unaffected — they keep drawing from `world_tileset.png` exactly as today
(confirmed explicitly with the user — only `groundGrass` moves).

## Confirmed tileset coordinates (the expensive-to-redo part)

Decoded directly from the sprite sheets by overlaying a labeled 16px grid and reading
pixel offsets (see the brainstorming session — same technique as how the crack-overlay
and sign-tile coordinates were pinned in earlier steps). Re-verify visually once actually
wired up (that's what the future test level, described below, is for), but these should
be correct:

- **`spring_.png`**, first/tan-dirt material band (rows 0–4 of the sheet, 0-indexed from
  the top; rows 0–1 are a decorative overhang/root prop, not used):
  - Fill (multi-tileable — used for any non-isolated tile, i.e. `'left'`/`'middle'`/
    `'right'`): grass-top `sx=48, sy=32`; plain-dirt-under `sx=48, sy=64`.
  - Single (isolated column, no matching neighbor either side): grass-top
    `sx=160, sy=32`; plain-dirt-under `sx=160, sy=64`.
- **`terrain_.png`**, first/brown material band:
  - Fill: `sx=16, sy=48`.
  - Single: `sx=112, sy=48`.

**Important finding that shaped the whole design**: neither sheet has directional
left-cap/right-cap art for its ground-fill tiles (unlike `world_tileset.png`'s `bridge`
tiles, which do have distinct ramp-down/ramp-up sprites) — just a plain multi-tileable
fill texture and a distinct "isolated single column" pillar. So the autotiling only ever
needs to distinguish **single vs. not-single**; `'left'`/`'middle'`/`'right'` all resolve
to the same fill sprite. This is simpler than a full blob/Wang tileset and should NOT be
over-engineered into one.

## Architecture sketch (stable, low risk of going stale)

- `Terrain.ts`'s existing `bridgeRunPosition` (single/left/middle/right based on
  left/right neighbor being the same type) generalizes cleanly into
  `horizontalRunPosition(level, col, row, matches)`, taking an arbitrary neighbor
  predicate; `bridgeRunPosition` becomes a one-line wrapper around it. This is additive
  to `Terrain.ts`, a file with no other in-flight work — low risk.
- New `TileType`: `'caveBackground'`, non-solid (simply omitted from `isSolid`'s list,
  same convention as `'empty'`). New level marker character: `%` (chosen as visually
  distinct from every existing/soon-to-exist marker letter). Additive to `LevelData.ts`/
  `LevelParser.ts` — low risk, though `LevelParser.ts` will likely have grown other
  entries (crate/question-mark/rock markers from step 20) by the time this lands; a
  one-line addition should merge in without real conflict.
- `groundGrass`'s tile-source logic combines `horizontalRunPosition` (single vs. fill)
  with the existing `isTopExposed` check (grass-top vs. plain-dirt-under, unchanged from
  today). `caveBackground` uses the same single-vs-fill logic with no top-exposed
  distinction (it's background dressing, not a walkable surface).
- `drawTerrain` needs a second tileset image parameter for `groundGrass` specifically,
  since it now sources from a different image (`spring_.png`) than the rest of solid
  terrain (`world_tileset.png`). A new `drawBackground` pass (for `caveBackground`,
  sourced from `terrain_.png`) runs before `drawTerrain` so real terrain draws on top
  wherever a cell has both.
- **This part (`Renderer.ts`) carries real staleness risk**: step 20/21 (destroyable
  blocks) is squarely a rendering change too, and will likely add new draw functions/
  cases to this same file before step 32 is implemented. The *shape* of the change
  described here (new tile-source helper functions, a new background-draw pass, a new
  trailing parameter on `drawTerrain`) should still be right, but expect to re-read the
  actual file rather than apply a stale diff.

## Explicitly out of scope / deferred

- `groundRock`, `platform`, `wall`, `bridge` stay on `world_tileset.png` — user was
  explicit about this (only dirt/grass tiles switch).
- A dedicated visual test level (varied terrain combinations: single-tile islands,
  2/3/5-wide runs, a grass/rock boundary, a two-row-deep stack, a cave-background section
  with varying-width gaps) is wanted, but **its actual shape depends entirely on step 31's
  still-undesigned level-selection architecture** (how levels get registered/selected,
  what interface a "level" needs beyond today's hardcoded `level1` import). Don't design
  this level's file structure until step 31 exists — only the *content* it should
  exercise (listed above) is decided.

## Hard dependency

**Do not implement this until roadmap step 31 (Level Selection) is done.** Rationale
(user's call): the test level should be addressable as one of the selectable levels from
the start, not bolted on behind a temporary dev-only flag and migrated later.

## Constraint to remember when implementation actually starts

Do not touch `src/themes/platformer/level/level1.ts`,
`src/themes/platformer/level/level1.test.ts`, or `public/sprites/platforms.png` without
first checking their current state — as of this writing they have uncommitted,
in-progress changes for roadmap step 20 (block markers) being worked on in parallel.
`level1`'s existing `G`/`R` characters will automatically pick up the new rendering once
this lands — no layout change needed there.
