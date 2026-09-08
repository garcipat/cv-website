# Design Notes: Platformer Hurt Feedback

Companion to [spec.md](spec.md). The spec says what the feature must do; this
records *why* the visual style was chosen and the exact tuning that was
approved against the real sprites, so that choice isn't lost or re-litigated
during implementation.

## How this was decided

Explored live in a browser mockup against the actual `knight.png` and
`slime_green.png` sprite sheets (canvas-based, no game code involved) rather
than in the abstract, because the whole question was "does this look right
next to what we already have". The three saved mockups under `mockups/` in
this folder are that exploration, in order:

1. **`mockups/1-hit-effect-style.html`** — four candidate styles side by side:
   a stylized spark burst (no red), a red flash tint on the sprite, a blood/goo
   splatter, and a burst+flash combo. **Blood/goo splatter was picked** — it
   read as "an impact happened here" more clearly than a flash, without
   needing a second effect layered on top like the combo did.
2. **`mockups/2-splatter-position.html`** — three anchor points for that
   splatter on the sprite: body center, the side contact came from, and
   ground/feet level. **Contact side was picked** — the splatter should
   appear wherever the hit actually landed, not at a fixed spot on the body.
3. **`mockups/3-final-look.html`** — the approved combination, tuned across
   several rounds of feedback: contact-anchored, colored per the entity that
   was hit, with the spread and droplet count widened twice (initial pass was
   too far from the sprite, then too clustered together, then too tight) until
   it read as a real spray rather than a floating clump next to the sprite.
   This file's numbers are the reference for the tuning below.

Open any of the three directly in a browser (they're self-contained, no
server needed) to see the actual motion — a static screenshot loses the burst
entirely, since most of what sells the effect is the droplets scattering and
falling over ~0.6s.

## Approved look, per entity

| | Player (blood) | Green slime (goo) | Purple slime (goo) |
|---|---|---|---|
| Color | red (`#a30f1f` in the mockup) | green (`#3ddc55` in the mockup) | purple — same mechanics as green slime's goo, shifted to a purple palette (not separately mocked; see Assumptions below) |
| Anchor | contact side, roughly torso height | top of the sprite, where the stomp landed | top of the sprite, where the stomp landed |
| Droplet count | fewer (mockup used 7) | more — a bigger burst for "stomped into goo" (mockup used 13, roughly double the player's) | same as green slime |
| Spread | tight to the body — wide enough to read as a spray, not a clump, but should not fly off-sprite | wider than the player's, scaled up alongside the higher droplet count so more droplets don't just overlap each other | same as green slime |
| Fall behavior | scatters outward from the anchor, pulled down by gentle gravity, fading over the back ~30% of a sub-second burst | same fall/fade curve as the player's | same fall/fade curve as the player's |

The exact pixel numbers (spread radius, droplet counts, offset from the
sprite's center) live as constants in `mockups/3-final-look.html`'s script —
treat that file as the tuning reference to translate into the real effect's
constants, not as a spec to satisfy exactly. It was tuned against a
mockup-scale sprite (5x the sheet's native 32px/24px frame size); the real
game's own render scale may need the same *relative* proportions rather than
the same literal pixel values.

## Alternatives considered and rejected

- **Stylized spark burst (no red)** — reads as "something happened" but not
  specifically as *damage*; less immediately readable than red/goo.
- **Red flash tint on the sprite** — cheapest option, but on its own reads as
  a palette glitch more than an impact, and doesn't scale to giving each enemy
  its own identity the way a colored splatter does.
- **Burst + flash combo** — more "juicy" but was two effects to tune in
  lockstep for a marginal gain over the splatter alone; dropped once the
  splatter alone read well.
- **Body-center anchor** — simplest to implement (no directional input
  needed) but read as disconnected from where the hit actually happened,
  especially once the mockup showed it side by side with the contact-anchored
  version.
- **Ground/feet anchor** — kept the character's face clear, but for a side
  hit it reads as unrelated to where contact happened; contact-side won for
  the same reason body-center lost.

## Implementation approach: code, not an image asset

Every existing effect in this theme — the destroy/defeat puff, the
fact-reveal sparkles, the heal aura — is drawn procedurally: a small set of
pure functions that hand the renderer offsets/opacities to draw with
`ctx.fillRect` each frame, not an SVG, GIF, or sprite-sheet asset. Nothing in
the game's render pipeline draws anything but that one canvas, so the hit
splatter should follow the exact same shape: a pure function (or two — one
per damage direction, mirroring `sparkleParticles`/`PuffEffect`'s split)
that the renderer calls, parameterized by color so the same code produces
red for the player and green/purple for an enemy without duplicating it
three times the way three separate image assets would require.

**The mockups' randomness must not carry over.** `mockups/*.html` seed each
droplet with `Math.random()` — acceptable for a few minutes of live visual
tuning, but wrong for the real effect: it means the same hit produces a
different-looking burst every time, which is neither testable nor
reproducible. Every existing effect in `CollectionEffects.ts` instead derives
each particle's position **deterministically from its index** — see
`sparkleParticles`, which places particle `i` of `count` at a fixed angle
(`(i / count) * Math.PI * 2`) rather than a random one. The real hit-splatter
implementation must do the same: each droplet's offset should be a fixed
function of its index (and, if directionality matters, of the contact side),
so calling it twice with the same inputs always draws the same burst. That
determinism is also what makes it unit-testable to the coverage bar the
constitution sets for `src/lib`/`src/themes` effect code.

## Approved parameters (from `mockups/3-final-look.html`)

Pulled out explicitly so they survive even if the mockup file itself is ever
deleted. Coordinates are in the mockup's own screen space (sprite drawn at
5x its native 32px/24px frame size) — scale proportionally, not literally,
to whatever the real render scale turns out to be.

| Parameter | Player (blood) | Enemy — green/purple slime (goo) |
|---|---|---|
| Droplet count | 7 | 13 |
| Color | `#a30f1f` | green `#3ddc55`; purple not mocked — pick its own goo tone the same way green's was chosen (matches that enemy's body color), confirm visually once implemented |
| Directional bias | +14px toward the contact side (mirror the sign for a left-side hit) | −45px upward (stomp always comes from above) |
| Scatter spread | ±42px horizontal, ±30px vertical | ±64px horizontal, ±44px vertical |
| Anchor offset from entity center | (+28, +6) — torso height, contact side | (0, −55) — top of the sprite |
| Gravity pull | `+60 * t²` added to vertical offset | same |
| Duration | 0.6s total | same |
| Fade curve | opaque until 70% elapsed, then linear fade to 0 | same |

## Reference implementation sketch

Not final code — a determinism-fixed translation of the mockup's math into
the same shape as `sparkleParticles`/`PuffEffect` in `CollectionEffects.ts`,
so the approach isn't lost between now and implementation. The mockup's
`Math.random()` calls are replaced with formulas keyed off each droplet's
index `i`, so `hitSplatterDroplets(0.3, 7, ...)` always returns the exact
same seven points:

```ts
interface HitSplatterDroplet { dx: number; dy: number; opacity: number }

// dirBiasX/dirBiasY: which way the burst leans (e.g. +14/0 for a right-side
// hit on the player, 0/-45 for a stomp on an enemy). spreadX/spreadY: how
// wide the scatter is. count: droplet total (7 player, 13 enemy).
function hitSplatterDroplets(
  progress: number, // 0..1 through the burst's 0.6s duration
  count: number,
  dirBiasX: number,
  dirBiasY: number,
  spreadX: number,
  spreadY: number,
): HitSplatterDroplet[] {
  return Array.from({ length: count }, (_, i) => {
    // Evenly spaced across the spread so the count/spread relationship
    // stays exact and reproducible (no clumping from unlucky random draws).
    const spreadFracX = count === 1 ? 0 : i / (count - 1) - 0.5;
    // A shuffled index (stride 3 has no common factor with either droplet
    // count used here — 7 or 13 — so it visits every index exactly once
    // instead of collapsing; a stride that shared a factor with `count`,
    // e.g. 7 against a 7-droplet burst, would map every `i` to the same
    // shuffled value and cancel the shuffle entirely) so the vertical
    // position isn't just a straight diagonal line paired 1:1 with the
    // horizontal position.
    const shuffled = (i * 3) % count;
    const spreadFracY = count === 1 ? 0 : shuffled / (count - 1) - 0.5;

    const dx = dirBiasX + spreadFracX * spreadX;
    const dy = dirBiasY + spreadFracY * spreadY - 6;
    return {
      dx: dx * progress,
      dy: dy * progress + 60 * progress * progress, // gravity, matches the mockup
      opacity: progress < 0.7 ? 1 : Math.max(0, 1 - (progress - 0.7) / 0.3),
    };
  });
}
```

The renderer would call this once per active hit-splatter effect per frame
(same calling convention as `sparkleParticles`), draw each returned point as
a small filled square at `anchorX + dx`, `anchorY + dy` with the entity's
splatter color, and drop the effect once `progress` reaches 1 — mirroring how
`PuffEffect`/`tickPuffEffect` already manage the destroy/defeat puff's
lifecycle.

## Assumptions carried into the spec

- The purple slime's goo color was not mocked separately — it follows
  directly from "green slime gets green goo" generalizing to "each enemy
  splatters its own color", which the user confirmed in words rather than in
  a second mockup. If the purple tone needs its own tuning pass once it's
  actually on screen, that's a small follow-up, not a re-open of this design.
- The mockups reuse the sprite sheets' existing idle/hit-reaction frames as a
  backdrop for the splatter — they do not depict any new character animation.
  The spec's own Out of Scope section already excludes adding a dedicated
  player hit pose; the mockups just needed *some* frame to draw the splatter
  over.
