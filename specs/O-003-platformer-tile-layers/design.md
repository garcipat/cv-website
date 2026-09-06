# O-003 Terrain Autotiling & Tile Layers — Design Rationale

Why the three visual layers are built the way they are. The mechanisms themselves — the
neighbour mask, the run classification, the piece catalogs, and the walkthrough for adding
a tile — are documented in
[`docs/themes/platformer/Terrain.md`](../../docs/themes/platformer/Terrain.md), with the
level character table and background placement shape in
[`docs/themes/platformer/LevelFormat.md`](../../docs/themes/platformer/LevelFormat.md).
This document explains the choices; that one explains the code.

## Grass is an overlay pass, not part of the ground tile

Grass and ground answer two different questions about a cell, and the answers do not line
up one-to-one.

The ground tile answers *what shape is this cell* — which of its edges face open space, and
therefore which edges carry a border. There are sixteen such shapes. Grass answers *where
in a horizontal stretch of exposed surface does this cell sit* — left end, middle, right
end, or alone. Baking grass into the ground artwork would multiply the two questions
together: every surface shape would need a variant for each run position, and the sprite
sheet would grow accordingly for art that differs only in its top nine pixels.

Keeping them separate also keeps them independently changeable. The brightness rule — which
edge closure makes a tile a bright surface — is expected to evolve; a two-cell bright band
or a depth-dependent ramp are both plausible. As a separate concern from the shape table
and from the draw loop, that rule can change without touching either. The dominant cost of
such a change is new artwork, not new code, which is the right place for the cost to land.

There is a second, subtler reason. Grass must stop where the terrain steps up, changes
material, or ends — and "steps up" is not a property of the ground tile's own shape, it is a
property of its neighbour's exposure. A decoupled pass can ask that question directly. A
baked tile would have to encode the answer in its shape selection, conflating two rules
that happen to agree in most cases and disagree at exactly the awkward ones.

## A bridge counts as open space

A bridge is a thin walkway the player can see past. Ground beside or beneath one must read
exactly as if it faced air, or the level looks like the bridge is embedded in a solid mass.

This is why the visual mask and the collision predicate deliberately disagree: collision
treats a bridge as solid because the character stands on it, while the mask treats it as
open because the eye sees through it. Both parts of the grass-ground path — the shape choice
and the grass pass alike — read exposure from the same mask, so the two stay consistent with
each other even though neither matches collision.

## The background layer is freeform placement, not autotiling

Autotiling suits a layer whose job is to be *correct*. The background layer's job is to be
*varied* — a jigsaw of chunks of different sizes and colour families that reads as
irregular natural mass. Those are opposite goals: an autotiler exists to make every tile
follow deterministically from its neighbours, which is exactly what makes a large painted
area read as a repeated texture.

That difference decides the data shape too. A dense per-cell grid works when every cell
holds one tile. Background pieces span multiple cells, so a grid would need either duplicate
entries across a piece's footprint or "covered by a neighbour" markers at every cell but
one — bookkeeping that exists only to work around the wrong container. A flat list of
placements, each naming a piece and the cell it is anchored at, stores exactly what was
painted and nothing else. It also makes the layer optional at zero cost: a level with no
list renders precisely as it did before the layer existed, so no level file needed
migrating.

The layer earns being purely visual. Solidity has exactly one source — the terrain grid — and
adding a second visual layer must not become a second answer to "can the character stand
here". Painting background fill changes what is drawn and nothing else, the same way the sky
does.

## Decoration tiles are ordinary terrain characters

A bush, a fence, a stalactite: each occupies exactly one grid cell, never moves, has no
state, and is placed by drawing on the level grid. That is precisely what a terrain
character already is. Making them a separate entity kind would mean a second placement
mechanism, a second editor painting path, a second save format, and a second thing to
consider whenever the level grid changes — all to model something with strictly less
behavior than the terrain characters that already exist.

Non-solidity comes free. The solidity and climbability rules enumerate the tiles that are
solid or climbable, so a tile that is neither needs no code at all to be walked through.
The invisible patrol marker had already established that a terrain character need not
render or collide.

The tree is the case that justifies the choice most clearly. A tree's height is unbounded,
so it cannot be a fixed-size sprite. Reading a cell's role from its immediate vertical
neighbours — nothing of its kind above or below is a bush, bottom of a stack is a root, top
is a canopy, between them is a trunk — makes every stack height a complete, valid shape.
That has a direct authoring payoff: there is no invalid intermediate state to guard against,
so painting a single tile finishes a bush rather than starting an unfinished tree, and
erasing any tile of a stack leaves complete shapes behind. The editor needs no
auto-completion logic, and the same run-classification idea the level already used for
horizontal bridge runs is simply read vertically.

Sprite variety is picked from the cell's position rather than at random for the same reason
autotiling is: a level must render identically on every load. Position-derived variety gives
a row of bushes or a tall trunk visible differences without making the level's appearance
depend on when it was loaded.

## Sky is viewport-fixed; water is level-anchored

The two bands frame the playfield from opposite ends and answer to different things.

Sky is the backdrop for the *screen*. It must cover the visible area whatever the camera is
doing, so it is drawn in viewport coordinates and ignores the camera entirely — the same
convention the heads-up display uses.

Water is the bottom of the *level*. It marks where the level ends, so it scrolls with the
terrain and stops drawing once the camera has risen above it. It overlaps the lower half of
the level's last terrain row rather than sitting beneath it, because the camera already
anchors that last row flush against the bottom of the canvas; a band drawn strictly below it
would always fall past the canvas edge and never be seen. Half a tile of overlap keeps that
row's grassed top edge readable while still reading as waves lapping in front of the ground
rather than submerging it.
