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
a fog shape per cave-family cell (see "Soft, drifting puffs" below for what that shape is),
gated by that cell's own material family. `drawFog` iterates
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

## A distinct tint, not a reuse of darkness's black

Painting fogged cells with the same neutral black `drawDarkness` uses, just at a different
alpha, would make the two effects easy to confuse — a partially-fogged view and a
partially-dark cave would look like the same phenomenon at different strengths, when they are
actually opposite states (outside vs. inside) that happen to share a mechanism. A distinct,
cool, muted tone (`FOG_TINT_RGB`, exact value tunable, per spec Assumptions) keeps the two
readable as different things: black reads as "no light here," the fog tone reads as
"something's blocking the view."

## Soft, drifting puffs, not a flat per-cell fill

The first pass painted each cave-family cell as one flat, hard-edged rect at `fogLevel`'s
alpha — cheap and spec-compliant, but it read as artificial: every cell was the exact same
single color, stamped precisely to the grid, with a hard cut at the cell boundary and no
motion at all. That's a defensible *literal* reading of "flat, near-opaque tint" (spec
Clarifications), but not what fog actually looks like.

`drawFog` now paints one soft radial-gradient "puff" per cave-family cell instead
(`fogPuffAt`): opaque out to `FOG_PUFF_PLATEAU` of its radius, then a smooth fade to fully
transparent by the rim. Three things fall out of that shape change directly:

- **Bleeding into the surroundings**: `FOG_PUFF_RADIUS_PX` is well over a full tile, so a
  puff's soft rim extends past its own cell into whatever neighbours it — a clear cell next
  to a fogged one gets a gentle wash rather than a hard line, and the "cover a little of the
  surrounding, since it's clear it's fog" read the flat rect couldn't produce falls out of the
  gradient shape for free.
- **Not grid-stamped**: a puff's centre isn't pinned to its cell's centre — it's offset by a
  small jitter, deterministically hashed from the cell's own `(col, row)` (`cellHash01`, the
  same `Math.imul` position-hash `Torch.ts`'s `torchPhase` already uses). Two neighbouring
  cave cells' puffs land at different offsets, so a fog bank's outline is irregular rather than
  a row of identical stamped squares.
- **Not static**: each puff's radius breathes gently over time (`FOG_PULSE_AMPLITUDE`,
  `FOG_PULSE_PERIOD_SECONDS`) — the same shape as the torch's own pulse (`TORCH_PULSE_*`), kept
  as separate constants since fog and torch light are unrelated effects that happen to share a
  technique. Each cell's phase is its own hash output, so neighbouring puffs never breathe in
  unison, mirroring `torchPulseScale`'s per-torch phase offset.

This is still no new art: `fogPuffAt` is a pure function of a cell's position and the world
clock, and `drawFog` draws it with the canvas's own gradient API — the same
`createRadialGradient`/`addColorStop` machinery `drawDarkness`'s torch glow already uses, not a
sprite sheet. A puff's radius is generous enough that overlapping puffs across several
cave-family cells merge into one continuous bank rather than reading as separate blobs.

## No new terrain or background data

This feature adds no `TileType`, no `BackgroundMaterialId`, and no editor authoring surface —
it is a pure render-time consequence of the `BackgroundMaterialFamily` O-014 already assigns
to every background material. A level author does nothing differently; fog simply appears
wherever a cave-family background piece is already placed, the same way darkness already does
today.

## Solid terrain is exempt, via a declared table, not a reused collision check

Fog originally covered *every* cell whose background was cave-family, terrain included — the
literal reading of FR-002's "everything on that cell." In practice that meant a cave's own
walls and floor, which are just rock, got hidden along with its actual contents, so the fog
read as an unbroken block rather than something that let a visitor see the cave's shape while
still hiding what's inside it (FR-002a).

The fix isn't "skip fog wherever `Terrain.ts`'s `isSolid` says a tile is solid" — reusing that
check directly would tie fog exemption to collision, a different concern that happens to
agree with it today but has no reason to keep agreeing as new tile kinds are added (a future
solid trap tile that should stay hidden, or a non-solid tile that should still show through,
would both be wrong under `isSolid` and invisible as bugs). Instead, `level/LevelData.ts`
declares `TILE_FOG_EXEMPT: Record<TileType, boolean>` — an exhaustive table over every
`TileType`, the same pattern `BACKGROUND_MATERIAL_FAMILY` already uses for
`BackgroundMaterialId`. Today it agrees with `isSolid` (`groundGrass`/`groundRock`/`wall`/
`bridge` exempt, everything else fogged), but it's its own declared fact about a tile, not a
side effect of another module's answer to a different question — and because `Record` is
exhaustive, adding a new `TileType` member is a compile error until its fog-exemption is
decided, rather than a silent default.

A block is never exempt under this table: a block occupies an otherwise-open cell (its
solidity is its own hitbox, not a terrain tile), so `TILE_FOG_EXEMPT` never sees it and a
fogged cell with a block on it stays fogged, per FR-002.

## A peek radius, reusing the player's own carried-light technique

A visitor approaching a fogged cell had no warning before actually crossing into it — the
first cell they'd see anything of was the one they'd already stepped onto. FR-011 fixes this
with a peek radius: fog within `FOG_PEEK_RADIUS_PX` of the player's own position thins
smoothly (`fogPeekStrengthAt`), reaching fully clear right at the player and fading back to
the puff's normal alpha by the radius's edge.

This is deliberately not a new mechanic — it's `playerGlowStrengthAt` (O-010's player-carried
torch light, which already thins *darkness* locally around the player) applied to fog
instead: same smoothstep falloff shape, same "distance from player to a point" input, just a
different radius constant and a different thing it's thinning. Reusing the shape rather than
inventing a new one means the two effects — the player's glow pushing back darkness, and the
player's presence pushing back fog — read as the same idea (a visitor's own space around them
stays visible) applied on both sides of the cave boundary, which the mirror-image spirit of
this whole feature already asks for.

Crucially, peek strength is *stateless*: `drawFog` recomputes it every frame from the
player's current position and a puff's position, nothing more. There is no "has this cell
been peeked" flag anywhere. A cell the player walked past and left thins while they're near
it and fogs right back in the moment they're not — it is advance warning for the cell you're
about to enter, not memory of what you've already seen (which FR-008 and the spec's
Clarifications explicitly rule out as a separate, larger feature).

## A smaller plateau, so a puff reads as haze rather than painted gray

`FOG_PUFF_PLATEAU` started at `0.55` — a puff's inner 55% of its radius was flat, fully-opaque
color, with only the outer 45% carrying any gradient. At the puff's overlap-generous radius
(`FOG_PUFF_RADIUS_PX`), that flat core was wide enough that most of what a visitor actually
saw, most of the time, was the plateau — which is indistinguishable from the original flat
per-cell rect this feature moved away from. Dropping the plateau to `0.3` keeps the same
puff shape and radius (so it still bleeds into neighbours and merges into one bank exactly as
before) but gives most of a puff's radius to the gradient, so what a visitor actually sees is
mostly soft falloff with only a small solid heart — which is what reads as mist rather than a
disc of color, without touching the fog's own opacity (`fogLevel`) at all, so a fogged cell's
contents stay exactly as hidden as FR-002 requires.
