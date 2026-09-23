# Platformer Cave Fog — Design Rationale

Why the cave fog feature is shaped the way [spec.md](./spec.md) describes. What follows is
only the reasoning; behavior lives in the spec.

## Per-cell masking, not a second screen-wide overlay

Cave Lighting (O-010) hides the outside world from inside a cave with one full-canvas
`rgba(0, 0, 0, darknessLevel)` rect (`drawDarkness`, `engine/Renderer.ts`) — a single overlay
is correct there because when the player's own cell is cave-family, the *entire* visible
scene is meant to read as dark. The outside-in case is not the mirror image of that: when the
player is on the surface, most of what's on screen is legitimately surface and must render
exactly as it always has. Only the specific cells whose background is cave-family need
hiding. That rules out reusing `drawDarkness`'s technique as-is; this feature instead paints
a fog rect per on-screen cell, gated by that cell's own material family. `drawFog` iterates
the level's full background grid every frame, the same loop shape `drawBackgroundTiles`
already uses — there is no separate visible-tile-range computation to reuse here; no pass
in this codebase culls terrain/background rendering to the viewport, so this doesn't
introduce a new pattern.

## Reusing O-010's trigger and fade shape, inverted

`PlatformerState.ts`'s `tickDarkness` already computes, every frame, whether the player's
own foot cell is cave-family (`isCellDarkening`) and eases a single `darknessLevel` signal
toward `MAX_DARKNESS` or `0` over `DARKNESS_FADE_SECONDS` (`nextDarknessLevel`,
`engine/Lighting.ts`). Fog needs exactly the same shape with the condition inverted: a single
`fogLevel`-style signal that eases toward its own maximum when the player's cell is *not*
cave-family, and toward `0` when it is. Deriving fog from the identical trigger (rather than
introducing a second notion of "am I in a cave") is what guarantees FR-003's mutual
exclusion for free — the two signals are driven by the same boolean, just opposite targets —
and reusing the same fade-seconds constant is what FR-004 asks for: the two transitions
read as one continuous effect because they *are* timed by the same underlying mechanism,
not two independently-tuned ones that happen to look similar.

## One global level, not independent per-cell fades

A per-cell fade (each fogged cell easing in on its own clock as it becomes fogged) would mean
a cave-family cell scrolling onto screen while the player is already settled outside would
visibly fade in from clear — which reads as broken, since nothing about that cell just
changed. FR-005 is deliberately in the spec to rule that out: exactly one fog level exists,
identical in shape to `darknessLevel`, and every fogged cell on screen is painted at that same
current value. A cell that's already fogged when it scrolls into view is drawn fully fogged
immediately; only the player's own boundary crossing animates anything.

## Why fog can afford full opacity where darkness can't

`MAX_DARKNESS` is capped at 0.97, not 1.0, because the darkness overlay covers the player's
own character too — SC-003 of O-010 requires the player to remain discernible even in the
darkest cave. Fog has no equivalent constraint: by construction, a fogged cell is never the
player's own current cell (if it were, the player would be on cave-family background and
darkness — not fog — would be active instead). There's nothing under the fog that fairness
requires to stay readable, so the tint can go fully opaque without reproducing O-010's
readability floor.

## Flat tint, not a reuse of darkness's black

Painting fogged cells with the same neutral black `drawDarkness` uses, just at a different
alpha, would make the two effects easy to confuse — a partially-fogged view and a
partially-dark cave would look like the same phenomenon at different strengths, when they are
actually opposite states (outside vs. inside) that happen to share a mechanism. A distinct,
cool, muted tone (exact value tunable during implementation, per spec Assumptions) keeps the
two readable as different things: black reads as "no light here," the fog tone reads as
"something's blocking the view."

## No new terrain or background data

This feature adds no `TileType`, no `BackgroundMaterialId`, and no editor authoring surface —
it is a pure render-time consequence of the `BackgroundMaterialFamily` O-014 already assigns
to every background material. A level author does nothing differently; fog simply appears
wherever a cave-family background piece is already placed, the same way darkness already does
today.
