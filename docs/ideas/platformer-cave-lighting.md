# Idea: Platformer Cave Lighting (Torches & Darkness)

## Status: Design Exploration

## Summary

Cave areas of the platformer get a darkening effect: when the player stands over a
cave background tile, the canvas darkens. Torches placed in the cave punch radial
light back through the darkness, so cave interiors read as pools of warm light on
stone. This is atmospheric only — no gameplay is gated behind light.

## How the darkness is decided

Darkness is not geometric or world-wide. It is keyed to a per-tile flag:

- `BackgroundPlacement` gains an optional `darkens?: boolean` field. Background
  pieces that shade — the charcoal/stone family — set it; dirt and everything else
  default to non-darkening.
- Every frame the game probes the **player's current cell** with a helper
  `darkeningAt(level, col, row)`: is this cell covered by a darkening background
  placement? That is the target darkness.
- A persistent `currentDarkness` value in `PlatformerState` **lerps toward the
  target** each frame, so entering and leaving a cave fades smoothly instead of
  snapping.

## How torches override it

- A new **terrain tile `¥` → `torch`**: non-solid, decorative physics (it appears
  in no solidity predicate — the cobweb pattern). In the editor palette it behaves
  like any decorative tile.
- Torches are static light sources. Each torch in the visible viewport contributes a
  radial light.
- Rendering order, after terrain/entities/sprites:
  1. Draw a full-canvas dark overlay at `alpha = currentDarkness`.
  2. Punch a radial-gradient light circle out of that overlay around every `torch`
     cell in view using `destination-out`, so the glow wins over the darkness.
- Light passes through walls by design — no occlusion raycasting. This keeps it a
  single compositing pass, cheap and simple.

## What it looks like

- Open sky: fully bright, no overlay.
- Shallow cave: a mild dusk tint that fades in as the player walks under stone.
- Deep cave: noticeably dark between torches; each torch renders a warm pool of
  light around it.
- The player's own surroundings stay reasonably readable at the darkest setting so
  the game never becomes unplayable.

## Level editor

- Torch is a normal palette tile (Terrain/decorations group), paintable like any
  other tile.
- Background pieces that darken need a visible marker or toggle in the editor so an
  author can tell at a glance which pieces shade the area.

## Open questions

- Torch flicker: animate the flame by frame-picking per tick (cheap) or keep it
  static? If it needs a time-based frame pick on a tile, that's the one mechanism the
  deployable ladder introduces in-scope — see its [scope note](platformer-deployable-ladders.md).
- Brightness floor: how readable must the player stay at full darkness?
- Does the warm torch glow tint the light (warm orange) or stay neutral?

## Related work

The cave run (`cave-run` level) and the `groundRock`/cobweb/crystal/stalactite/
stalagmite cave dressing already establish the cave aesthetic; this adds the light
and shadow that makes them read as underground.