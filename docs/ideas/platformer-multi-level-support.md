# Idea: Platformer Multi-Level Support + Readable Level Format

## Status: Design Exploration

## Summary

Raised during S-006 roadmap step 16 (enemy render) implementation: the current
single hand-crafted level (`level1.ts`) mixes level *data* (the ASCII terrain
layout) with level *parsing* (`parseLevel`, `findSpawnTile`, `TILE_CHARS`) in
one file, and only encodes terrain — entities (player spawn, coins, enemies,
blocks) are either a single special character (`S`) or not represented in the
ASCII art at all (coins/enemies are placed programmatically from CV data,
independent of the letter grid). The idea: make level files pure, readable
data; move parsing into a shared module; support multiple levels; and let the
visitor switch between them via a dropdown.

Explicitly out of scope for S-006 v1 (see `specs/S-006-platformer-theme/spec.md`'s
Out of Scope section: "Multiple levels", "Level editor or user-created
content") — this idea is a deliberate v2+ candidate, not part of the current
enemy-render work.

---

## Motivation

- **Readability**: `level1.ts`'s ASCII layout is already fairly dense; adding
  more levels by hand is easier if a level file is *just* the layout, with no
  parsing logic to scroll past.
- **Reuse**: `parseLevel`/`findSpawnTile`/`TILE_CHARS` are generic — every
  future level needs the same parsing, so it belongs in one shared module
  (e.g. `level/LevelParser.ts`), not duplicated or left attached to `level1.ts`
  specifically.
- **Trying layouts quickly**: the user wants to iterate on level design by
  eye — a level-select dropdown (à la the existing theme/locale
  `FloatingControls`) would let different hand-crafted layouts be compared
  without editing code between attempts.

---

## Open Design Question: Entities in an ASCII Grid

A single-character-per-cell grid can only hold **one symbol per cell** — so if
level authors want to *see* spawn points, enemies, coins, etc. directly in the
ASCII art (not just terrain), two entities can't share a cell the way "an
enemy standing at the player's spawn point" implicitly can today (since today
neither is encoded as a grid character at all — see below).

Two directions surfaced in discussion, not yet decided:

1. **Multiple parallel character grids** — one grid for terrain (as today),
   a second grid (same dimensions) for entity markers (`S` for spawn, `E` for
   a hand-placed enemy start, etc.). A cell's terrain character and its entity
   character are independent, so a spawn marker and an enemy marker *could*
   both resolve to the same `(col, row)` — solving the immediate question —
   but two different entities still can't occupy the exact same cell *within
   the entity grid itself* without a further rule (e.g. only single-instance
   markers like spawn go in the character grid; multi-instance entities like
   enemies/coins stay data-driven, listed separately with explicit
   coordinates rather than characters).
2. **Keep entity placement fully data-driven** (current approach, extended) —
   the terrain grid stays visual/readable; entity positions (spawn, and any
   future hand-authored enemy/collectible positions) are a plain list of
   `{col, row, type, ...}` records alongside the layout, not embedded in the
   ASCII art at all. Less "see the whole level at a glance" but avoids the
   one-cell-one-meaning constraint entirely, and matches how
   `CollectibleMapper`/`EnemyMapper` already auto-place coins/enemies today.

Whichever direction is chosen needs to also cover: how roadmap step 17's
hand-placed patrol test cases (an enemy walled between two tiles, an enemy on
an open ledge) get authored — that's the first real case needing an *explicit*
enemy position rather than an auto-placed one.

---

## Proposed Shape (not yet a spec)

- `src/themes/platformer/level/LevelParser.ts` (or similar) — owns
  `parseLevel`, `findSpawnTile`, `TILE_CHARS`, and whatever entity-grid
  parsing direction 1 above ends up needing. Generic across all levels.
- `src/themes/platformer/level/level1.ts`, `level2.ts`, ... — pure data: the
  ASCII layout (and, if direction 1 is chosen, a parallel entity-marker
  layout), nothing else.
- A `levels` registry (id → `LevelDef` or id → raw layout + parse-on-demand)
  that a new dropdown control reads from, mirroring `ThemeSelect`/
  `LanguageSelect`'s pattern — likely another `FloatingControls` entry.
- Switching levels resets game state the same way a theme switch already does
  (fresh session, no collected facts) — consistent with the existing
  "switching themes always resets" behavior.

---

## Open Questions

- Does every level need to independently satisfy FR-013 (every non-empty CV
  item has a collectible/enemy somewhere), or is that only guaranteed across
  levels collectively?
- Should level choice persist (`localStorage`, like `currentTheme`/
  `currentLocale`) or always reset to a default on reload?
- Is a level-select dropdown a permanent visitor-facing feature, or a
  dev/debug-only convenience (like the existing `?debug=hitboxes` panel) for
  comparing layouts while designing them?

---

## Next Step

Brainstorm this properly (architectural path — new subsystem, changes the
level-authoring interface) once S-006 roadmap step 16 lands: clarify the
entity-grid question above, propose 2-3 concrete approaches, and write it up
as its own spec before any implementation.
