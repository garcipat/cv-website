# Platformer Crumbling Floor Blocks — Design Rationale

Why the crumbling floor feature is shaped the way [spec.md](./spec.md) describes. What follows is only
the reasoning; behavior lives in the spec.

## A terrain kind, not a hazard and not a block

Two existing extension points could have fit: `HazardKind` (Floor Spikes' route) or `BlockType` (crates,
mushroom caps). Neither is right. A hazard deals damage; this tile never does — falling through it is
exactly as dangerous as any other gap in the floor, no more. A block is something the character *hits*
from below or the side to consume it; this tile is something the character *stands on* and it gives way
under weight, which is a terrain solidity question, not a hit-reaction question. That makes it closer in
shape to Bouncy Mushroom Blocks' `bouncyMushroom` — a new `TileType` with its own standability rule
alongside `isStandableLadderTop`/`isStandableMushroomCap` in `level/Terrain.ts` — than to either
`HazardKind` or `BlockType`.

## Reusing the phase-timeline shape from Floor Spikes

Floor Spikes already established the right shape for "a tile whose functional state changes on a fixed,
uninterruptible timeline, with a purely visual tell before the functional change." A crumbling floor tile
copies that shape directly: at-rest → cracking (tell, no functional change) → broken (functional change)
→ reforming (tell, no functional change) → at-rest again. The phase names differ but the rule — once
started, a cycle runs to completion regardless of further contact — is identical, for the same reason: a
player standing still through the whole cracking phase would otherwise get an inconsistent or exploitable
result (breaking immediately vs. never breaking, depending on exactly when a second contact re-evaluates
the timer).

The one structural difference from Floor Spikes is that this cycle also runs the *reverse* direction
(reforming) on its own timer, rather than snapping back to at-rest instantly. That mirrors the *shape* of
the break half — a tell (growing) before a functional change (becoming solid) — rather than introducing a
new pattern.

## Shape as the primary tell, cracks as a layered overlay

The tile deliberately does not reuse a full-height ground block re-skinned with cracks. It renders as a
half-height ledge — a shape no ordinary ground tile uses — so unstable ground reads as visually distinct
from solid ground even before a visitor is close enough to see a crack. The crack progression is a
second, separate sprite (`crumble_cracks.png`) composited on top of that ledge, the same layering
`Crate.ts` already uses for `crack_overlay.png` over `WORLD_TILESET_SHEET`. Keeping the cracks as their
own overlay — rather than baking three fully-colored crack states into the ledge art — means a future
color variant only needs new base-ledge art; the crack overlay is reused unchanged.

## Collision matches the art's height, not the full cell

The ledge art top-aligns within its cell, so standing on it from above needs no new rule at all — the
stand surface is at the ordinary tile-top line, exactly where every other solid tile's is, so
`Physics.ts`'s normal landing logic already does the right thing.

Where this tile does need something new is the vertical extent of its solid region: it is only as thick
as the rendered art (the top half of the cell), not the full 16px cell `groundGrass`/`groundRock`/`wall`
use. This is the vertical counterpart to `hitboxInsetX` (`docs/themes/platformer/Blocks.md`'s "Sprites
and crack stages" section) — that inset shrinks a block's *horizontal* hitbox to match art narrower than
its tile; this tile needs the same idea on the *vertical* axis; matters for anything that can be beneath
it in the same column and approach from underneath, which is common here since a crumbling floor tile's
whole point is to eventually open onto a gap below it. No `hitboxInsetY` exists yet in `Terrain.ts`/
`Physics.ts` — this is the first tile that needs one, rather than reusing `isSolid`'s plain per-cell
boolean unchanged.

## Where the ledge art comes from

`spring_.png` — a terrain tileset previously moved out of `public/sprites/` into `docs/assets/tilesets/`
as a retired reference when an earlier terrain rework shipped — pairs a half-height ledge row with a
full-height block row for each ground color. It is being reinstated into `public/sprites/` for this
feature. Group C (the salmon/red-clay row) is the variant in use, chosen to match the level's current
ground palette; the other three color groups it ships with are left unused for now (see spec's Out of
Scope) rather than wiring up a color-selection mechanism this feature doesn't need.

## The crack overlay's frames

`crumble_cracks.png` is a new 48×8px sheet: three 16×8 frames (light/medium/heavy), matching the
half-height ledge's own height rather than a full 16×16 tile. Cracks are thin, single-pixel-wide,
sparse lines in the same dark near-black tone `crack_overlay.png` already uses, rather than thick or
filled marks — at 16×8px, anything bolder reads as noise rather than a crack once composited over the
ledge's own busy dirt texture.

## Breaking is debris, not a fade

`Crate.ts`'s shatter is an opacity fade to nothing, and `PuffEffect` is a sparkle-dot burst — neither
looks like a chunk of floor giving way. The break instead spawns four falling pieces, each animated with
simple gravity and a short fade, matching the shape of a small, self-contained transient visual effect
(same family as `PuffEffect`/`FlightEffect` in `CollectionEffects.ts`) without needing new sprite work.

The four pieces are cropped as the quadrants of the tile's own **composited** appearance at the moment it
breaks — the ledge art with the heavy-crack frame drawn over it — not the crack overlay alone. The crack
overlay by itself is mostly transparent (thin sparse lines over empty space); quartering just that layer
would produce debris that is almost entirely invisible. Quartering the composited image gives four
solid, ledge-colored chunks with crack lines running through them, which is what "a chunk of floor
breaking apart" needs to look like. Each piece is a fixed-duration decorative effect — falls a short
distance under simple gravity and fades out — with no collision, damage or persistence of its own, per
the spec's Out of Scope.

## Regrowing is a scale animation, not new art

The "small square growing to full size" reform sequence is a runtime scale-up of the same intact ledge
sprite already used for the at-rest state, not a separate set of drawn growth frames. This keeps the
asset list to exactly two new sprites (the ledge, reused from `spring_.png`, and the crack overlay) while
still giving the reform its own readable animation.
