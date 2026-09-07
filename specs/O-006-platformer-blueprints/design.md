# Platformer Blueprint Rooms — Design Rationale

Why the blueprint feature is shaped the way [spec.md](./spec.md) describes. Behavior lives in the
spec; the file shape lives in
[LevelFormat.md](../../docs/themes/platformer/LevelFormat.md). What follows is only the reasoning.

## A blueprint is a small level, not a new format

A blueprint is authored on its own canvas rather than carved out of an existing level, and a canvas
is already a grid of level cells. Once that decision is made, the cheapest possible description of a
blueprint is the one a saved level already has: a cropped rectangle of rows plus an optional list of
background pieces.

Reusing that shape means the whole existing pipeline applies unchanged. Cropping to the tightest
painted bounding box, rebasing background pieces onto that origin, writing the file, reading it back
onto a canvas, and parsing it cell by cell for placement are all the operations levels already need,
so a blueprint gets them for free and gets them consistent — a room can never crop differently from
the level it will be stamped into. A sparse cell list or a bespoke room format would have bought
nothing in exchange for a second parser, a second crop rule and a second class of file to keep in
step with the character table.

It also keeps blueprints hand-editable. A saved blueprint reads like a saved level, so a developer
who can read one can read the other, and the same "skip anything malformed rather than break the
editor" rule protects both.

The one thing that does not carry over is the spawn point. A room has no spawn, so the tool is
absent while the blueprint canvas is active — offering it would only invite a marker that nothing
downstream expects to find outside a real level.

## Placement validates overlap, and only overlap

The rule is: a placement is valid when none of the cells it would write lands on a cell the level
already fills. There is no connection-point check, no adjacency check, no facing and no first-room
special case.

Connection points cannot support validation. A blueprint's markers describe attachment spots
relative to *that blueprint's* bounds, but the moment a room is stamped into a level its cells
become ordinary level cells: a marker sitting in the level grid carries no memory of which room it
came from or where that room's edges were. Validating a second placement against an already-placed
room's marker would therefore have to guess its facing — from whichever neighbour happens to be
empty, say — and a rule that guesses is worse than no rule, because it fails in ways the developer
cannot predict from what is on screen. Connection points stay an authoring and legibility aid, which
is a role that does not degenerate: a human, or a future generator reading blueprint files directly,
sees the marker in its own room's frame, where its meaning is intact.

Overlap-only is also the more useful rule for hand-assembly. It permits placing two rooms apart and
joining them with hand-painted terrain, or interlocking two irregular shapes so one fills the gaps in
the other's bounding box. A snap-together model would have forbidden both, and hand-assembly is what
the feature is actually for.

Two consequences follow from treating the blueprint's empty cells as bounding-box padding rather than
as "clear this cell". They are never checked for overlap, which is what makes interlocking possible;
and they are never written, which is what makes placement incapable of blanking out terrain the level
already had. Placement is additive by construction, not by a guard that could be forgotten.

Background pieces are appended without an overlap check because that is what painting the background
layer already does — placements there silently replace on overlap. Applying a stricter rule to a
placed room than to a paint stroke would be a surprise, not a safeguard.

Undo is scoped to placement alone because placement is the only editor action big enough to be worth
undoing: a stroke of paint is trivially repainted, but a misplaced room is dozens of cells in the
wrong spot. A single slot, cleared by any other edit, keeps the offer honest — it can only ever mean
"put back the room I just stamped", never a stale state from several actions ago that the developer
would have to reason about.

## The editor has no zoom

The canvas draws one screen tile per grid cell and pans; it does not scale. Blueprint rooms are small
by nature, and panning already gets the developer to any part of the level they need to line a room
up against. Zoom would buy a wider overview at the cost of introducing a scale factor into every
coordinate conversion in the editor — every draw call, every hit test, every pan clamp, every preview
anchor — and into the tests that cover them. That is a large, diffuse change for a convenience the
feature does not need, so the canvas stays at one-to-one and the idea is parked
(`docs/ideas/platformer-editor-zoom.md`).

## Blueprints are editor-time only

Nothing about a blueprint or a connection point exists at runtime. A placed room's cells are ordinary
level cells, and connection points are invisible and non-solid in the game, exactly like patrol
markers. This keeps the feature entirely inside the editor: the game needs no knowledge of blueprints
to play a level assembled from them, and a level file stamped together from rooms is indistinguishable
from one painted by hand. The cost of that choice is the open problem the spec records — an invisible
marker occupies the one tile kind a cell can hold, so marking a wall removes it.
