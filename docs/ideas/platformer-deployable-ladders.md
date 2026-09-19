# Idea: Platformer Deployable Ladders (Curled-up Ladders)

## Status: Design Exploration

## Summary

A new interactable: a **curled-up ladder bundle** the player can press Up to deploy.
The ladder unrolls downward from the bundle and extends until it hits the next solid
tile, then behaves as a normal climbable ladder for the rest of the run. It is a
placement-flexibility tool — an author can put a bundle beside the top of a shaft,
or even at the same height as the player, and the ladder reaches whatever solid
ground is below.

## Placement

- A new **terrain tile** (character TBD, e.g. `%`) for the bundle.
- The bundle can be placed anywhere a ladder shaft would be useful:
  - hanging at the top of a tall shaft (like where a ladder's top tile would go), or
  - at the player's own height, extending down to the floor below.
- Only downward extension: the bundle is the shaft's top; it unrolls straight down.

## Interaction & deploy

- **Trigger**: press **Up** while in the bundle's own cell or the cell directly
  above it (standing on/against the bundle).
- **Deploy**: the ladder unrolls downward, filling tiles top-to-bottom one by one
  (an animated reveal, roughly 0.5 s), until its lowest rung lands on the first
  solid tile below — or the level's bottom — whichever comes first.
- Once deployed it **stays deployed** for the rest of the run. No rolling back up.
- Deployment needs no existing climbable tile beneath it: it fabricates the shaft
  between the anchor and the ground.

## State model

Tiles are stateless by design (pure `TileType` values in `LevelDef.terrain`), so the
bundle can't be modeled as two tile types swapped at runtime. Instead:

- `isDeployableLadder(tile)` — a new predicate in `Terrain.ts` identifying the
  bundle tile.
- Deploy state lives in a **runtime map** in `PlatformerState` keyed by `(col, row)`
  tracking the bundle's phase: `rolled` → `deploying` (with animation progress) →
  `deployed`.
- Physics/renderer consult the state map to decide whether a given bundle cell has
  finished deploying and is climbable.

## Climbing

- Deployed rungs become climbable exactly like `ladder`/`chain` — reusing
  `isClimbable` and the standable-top behavior via the runtime override, so no new
  climbing code is needed.
- While `deploying`, the partial shaft is **not** yet climbable; climbing starts the
  moment the ladder lands.

## Art

- New **rope-ladder** look: a rolled bundle that unrolls into vertical rope-ladder
  segments — visually distinct from the wooden `ladder` (`H`) and the `chain` (`I`).
- Single sprite sheet/strip so every frame shares the same style, dimensions, and
  palette (per repo sprite convention).

## Level editor

- Bundle appears as a palette tile with its own glyph, paintable like any tile.
- Level authors can preview the deployed length if cheap to add (a marker showing
  where the ladder would land) — optional.

## Scope note: no separate "animated tiles" system

Tiles are stateless by design in this codebase — everything that changes over time
lives in entities/effects driven by the `dt` clock. This feature is where that rule
first bends for a terrain tile: the bundle needs runtime deploy state. The runtime
state-map mechanism required here is **developed in-scope of this feature**, not as a
separate deliverable. It is deliberately a single interactable with a state map
(`rolled → deploying → deployed`), not a general per-tile animation framework. If a
later feature needs the same mechanism (e.g. torch flicker), it reuses this one.

## Open questions

- Exact terrain character for the bundle tile.
- Whether the deploy is cancellable mid-way (probably not — once started, it lands).
- Does the player need to be grounded, or can the deploy trigger while jumping too?