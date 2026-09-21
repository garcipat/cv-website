# Platformer Floor Spikes — Design Rationale

Why the floor spike feature is shaped the way [spec.md](./spec.md) describes. What follows is only
the reasoning; behavior lives in the spec.

## A hazard kind, not a new hazard concept

[O-005](../O-005-platformer-hazards/spec.md) already defines what a hazard is: static level content
that costs health on contact, never moves, never dies, is never defeated. The floor spike does not
change any of that — it is still a hand-placed, indestructible, non-solid, non-stomping piece of level
content that damages on contact. The only thing that changes is *when* contact is hazardous. That is
why this feature is a second `HazardKind` sibling to `spike` rather than a new subsystem: O-005's
extension point (one hazard-kind literal, one module, one registry line, per the comment already in
`LevelParser.ts`) was built for exactly this.

Keeping it a hazard kind also keeps the reuse honest. Damage amount, the invincibility window, no
knockback, no stomp outcome, no solidity — all of it comes from O-005 and F-016 unchanged. The floor
spike's entire contribution is a timeline that decides when its hazardous area exists at all, not a
new set of damage rules.

## Why a phase timeline instead of a simple two-state toggle

The simplest version of "delayed hazard" is a boolean: safe, then hazardous, flipped by a timer. That
was rejected because the issue's own goal is a hazard the player can learn to read, and a hard flip
with a static tell gives no moment where the *reaction* is visible — only the before and after states,
never the transition. The warning phase exists to make the cycle legible while it is happening, not
just at its endpoints: a player who is watching sees the tile *start* reacting before it becomes
dangerous, which is a stronger and fairer cue than a flat art tell alone.

A five-phase cycle (at rest, warning, full-extend, holding, retracting) was chosen over more states
because each phase maps to one observable thing: not-yet-dangerous variations get collapsed into "at
rest" and "warning," and dangerous variations get collapsed into "full-extend, holding." Nothing here
distinguishes, say, "just started extending" from "about to finish extending" — the phase list is as
short as it can be while still giving the warning pose its own readable step.

This is the same shape as the existing pre-detonation bomb fuse
(`engine/PlacedBomb.ts`'s `BOMB_FUSE_SEQUENCE`): a fixed sequence of named phases, each with its own
duration, advanced by a per-instance elapsed-time timer and never affected by anything except time
itself once started. The floor spike reuses that shape rather than inventing a different one, because
the bomb fuse already proves it out for "arm once, then run an unskippable timeline to a conclusion."

## The cycle cannot be re-triggered, paused or extended once armed

Letting contact during an active cycle do anything — reset the timer, hold a phase, skip ahead —
would make the tile's behavior depend on exactly how the player moves across it during phases that are
themselves reactions to movement. That circularity is why the bomb fuse also ignores everything once
lit: a timeline that can be perturbed by the thing it is timing stops being predictable, and
predictability is the entire value of a tell-driven hazard. A player who reads the tell and crosses
fast needs to know the tile's danger window is fixed, not something their own hesitation could
lengthen or shorten.

The corollary — the tile is only re-triggerable once it has fully returned to at-rest — is what keeps
"the cycle runs to completion" from meaning "the cycle runs once." A floor spike stays a reusable piece
of level furniture across an unlimited number of crossings, rather than degrading into a static spike
after its first use, which was explicitly considered and rejected (see the Clarifications section
of the spec: "stays up permanently once triggered" was the alternative, and it loses the repeatable-
trap use case).

## Floor-only, for now

The sprite is a single self-contained 16px tile, not a composite drawn across two cells: the
ground-level tell (the pair of small dark holes) is anchored to the bottom edge of the hazard's own
tile, and the spike art extends upward from there as its cycle progresses — the same edge-anchored-band
technique the static spike already uses for its own hazardous area
([Spike.ts](../../src/themes/platformer/entities/hazards/Spike.ts)'s `facingBox`). Nothing is drawn
into the neighbouring floor tile at runtime; that would mean the hazard's rendering reaching into a
cell it does not own, which the codebase has no precedent for and which would need the renderer to
know what ground art sits in that neighbour. Keeping the tell inside the hazard's own tile means it
composes with whatever ground tile happens to sit beneath it without the two ever needing to
coordinate.

This self-contained shape is also inherently a floor composition: the spike rises out of the ground
beneath the walkable surface, anchored to the bottom of its own tile. A ceiling or wall variant would
need its own trigger condition (a player does not "step on" a ceiling or a wall the way they step on a
floor) and, almost certainly, its own art rather than a rotation of this one. Neither is a small
addition, so both are left to a future feature rather than folded into this one's scope.
[O-005](../O-005-platformer-hazards/spec.md)'s static spike already covers every orientation for
hazards that do not need to be floor-triggered; this feature only adds the timed behavior, and only
where the trigger makes physical sense.

## Damage is a phase check, not a separate hazard-collision path

`checkHazardCollisions` already returns every hazard the player's hitbox overlaps, independent of
hazard kind. The floor spike does not need its own collision path or its own damage-application
branch in `PlatformerPage.tsx` — it only needs its hazardous area to be absent (rather than present but
harmless) outside the full-extend/holding phases. That keeps the existing one-hit-per-tick,
shared-invincibility-window logic exactly as O-005 already built it, and it is why the spec states
"hazardous only during full-extend/holding" as a property of the tile's own area rather than as a
special case damage rule layered on top of the shared hazard-contact path.
