# Platformer Background Image Layers — Design Rationale

Why the backdrop is composed the way it is. The behavior itself is in
[spec.md](./spec.md).

## An illustrated scene rather than a procedural sky

The backdrop is a hand-authored illustration cropped into depth bands, not colour rows
generated at runtime.

A procedural sky can only express what its generator was written to express: a few flat
colour rows and one repeated cloud shape. That is enough to say "this is up" and nothing
more. The level itself is illustrated pixel art, so a generated sky behind it reads as a
placeholder — the one part of the frame that is obviously not drawn by hand. It also has
no depth to give: with a single band there is nothing to move at different speeds, so no
parallax is possible at all.

Cropping bands out of one illustrated scene solves both at once. The art carries the
detail — cloud shapes, hills, a pine treeline, a village, a river — and splitting it into
horizontal bands is exactly what parallax needs, because depth in a side-scrolling scene
is stratified by height anyway: sky is farthest, hills are far, the treeline is middle
distance, the ground is here. The bands fall out of the illustration along the same lines
that the depth does.

The cost is that the scene is fixed: one backdrop, no runtime variation, and changing it
means preparing new art. For a single-theme CV site with one level style that is the
right trade — variety is not a goal, and a generated sky would buy variety only in the
dimension nobody looks at.

## Clouds draw once with a flat fill, not tiled vertically

The vertical distance between the sky band and the treeline is not fixed — it grows and
shrinks with the play area's height. Something has to fill it.

Repeating the clouds band down that gap is the obvious answer and the wrong one. The band
contains recognizable shapes: distinct cloud puffs over a hill wave. Repeating a
recognizable shape vertically does not read as "more sky", it reads as a stack of
identical cloud rows — and the taller the window, the more copies, so the defect gets
worse exactly where there is more room to notice it. Horizontal tiling of the same band is
fine because the camera only ever shows a moving window of it; vertical tiling puts every
repeat on screen at once, side by side, where the eye compares them directly.

So the band draws exactly once and the remaining gap is a flat colour sampled from the
sky art's own light blue. A flat fill has no shape to repeat, so it extends to any height
without reading as anything but sky. The same reasoning applies below the grass band,
which fills down to the bottom of the play area with a flat colour taken from the grass
art's own solid rows.

Drawing the clouds once means choosing where the one copy goes. It is anchored a small
fixed distance above the treeline rather than directly beneath the sky, so that on a tall
window the extra height becomes open sky above the clouds — clouds floating over a
treeline — instead of a widening void between clouds and trees. The small deliberate gap
between them is filled with sky colour so the clouds read as floating above the treeline
rather than resting on it.

## Every band at the foreground's scale

All bands render at the same uniform scale as the foreground terrain's rendered tile
size.

Pixel art advertises its own resolution. Two elements in one frame drawn at different
pixel sizes do not read as "one is farther away" — they read as one of them being wrong,
because in a real scene distance changes an object's size, not the size of the pixels it
is made of. Scaling only some layers, or leaving the backdrop at its native size behind
2x foreground terrain, produces a frame with two visibly different pixel grids in it.

Matching the foreground's scale exactly keeps a single pixel grid across the whole frame.
Depth is then carried entirely by the thing that actually carries depth here: how fast
each band moves. The river overlay inherits the same scale, since it is positioned
relative to the village band and has to line up with art already drawn into it.

## Grass is a standalone swatch, not a crop of the scene

The scene's own grass band is not used for the grass layer. A small dedicated tileable
swatch is.

The scene's grass band is illustration: it has a river and bushes drawn into it. Those are
features, and features are exactly what must not repeat. Tiled horizontally across a
scrolling viewport, a baked-in bush becomes a row of identical bushes at a fixed
interval — the repeat becomes the thing the eye tracks, which is the opposite of what a
receding ground plane should do. The band was drawn to be seen once, in place, as part of
a composed picture.

A small swatch chosen for seamless repetition has no features to give the repeat away: it
is texture, and texture is what a ground plane should be. The scene's detailed grass art
is not lost — it survives in the village band, where it is drawn once and reads as part
of the scene rather than as a pattern.

## Grass draws last

The grass band is drawn after the village band rather than before it.

The village crop ends at a hard horizontal edge — the boundary of the crop, not a boundary
the artwork was designed around. Left visible, that edge is a straight line across the
frame where the illustration simply stops. There are two ways to hide it: prepare the
village asset so its bottom edge is designed to be seen, or draw something over it.

Drawing the grass over it costs nothing. The grass has to occupy that region anyway, it is
already positioned at the village band's bottom edge, and nudging it up slightly so it
overlaps the band covers the seam completely. The alternative puts a constraint on the
asset — every future backdrop scene would need its village band's bottom edge authored to
be presentable — in exchange for a draw order that is no simpler. Draw order is free;
asset constraints are paid again on every asset.

## Parallax by scroll factor alone

Each band's horizontal offset is the camera's position multiplied by a per-band factor,
wrapped to the band's own width. Zero pins a band to the viewport; one matches the
foreground exactly.

This is the whole depth model, and it is deliberately not more than that. There is no
perspective projection, no per-band vertical parallax, and no camera-relative vertical
placement — each band's height is a function of the play area alone. A side-scrolling
scene composed of horizontal strips gets essentially all of its perceived depth from
relative horizontal speed; the rest would add machinery to the composition without adding
anything a player would notice.

One consequence is worth stating: because the offsets are products of a camera position
with a fractional factor, they are rarely whole numbers, and with image smoothing off a
fractional destination puts adjacent repeats of a band on different sub-pixel boundaries —
a hairline seam that flickers as the camera moves. Rounding each band's offset to a whole
pixel removes it. The cost is that a slow band advances in whole-pixel steps rather than
continuously, which at these speeds is invisible.

## The river as an overlay, not a layer

The river animates as a two-drawing flipbook composited onto the village band at that
band's own position and speed, rather than as a depth band of its own.

It is not at its own depth — it is water inside the village scene, already drawn into that
art. Giving it an independent speed would make it slide against the art it belongs to.
Sharing the treeline's speed and scale, and offsetting it vertically so its water line
lands on the river already drawn into the band, makes the animation read as that river
moving rather than as a strip laid over it.
