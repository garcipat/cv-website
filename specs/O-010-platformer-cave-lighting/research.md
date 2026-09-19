# Phase 0 Research: Platformer Cave Lighting

Every NEEDS CLARIFICATION from the spec's Technical Context is resolved below.
The spec's own Clarifications session already settled the behavioral questions;
these decisions cover the remaining implementation choices.

## D1 — How the darkness and torch light are composited

**Decision**: Render the whole effect with a single reusable **offscreen
canvas** the same size as the play canvas:

1. When the eased darkness level is (near) zero, draw nothing at all.
2. Otherwise clear the offscreen canvas and fill it with
   `rgba(0, 0, 0, darknessLevel)` — the world-darkening layer.
3. For every torch on/near screen, set
   `globalCompositeOperation = 'destination-out'` and paint a soft radial
   gradient (opaque centre → transparent edge). This **punches light holes**
   through the darkness so the world underneath shows through.
4. Draw the offscreen canvas onto the main canvas with the default
   `source-over` — dark everywhere except the torch pools.
5. For every torch, paint a second, smaller **additive** radial gradient
   (`globalCompositeOperation = 'lighter'`) in warm orange/gold to tint the
   revealed pool warm. Its radius stays inside the erased hole so the warm
   tone never bleeds onto the darkened area.

**Rationale**: Punching holes requires the darkness to live on its own layer;
an offscreen canvas is the only canvas-2D way to subtract from a fill without
also erasing the world below it. The same offscreen canvas is reused every
frame (recreated only on resize), so there is no per-frame allocation. Work is
O(number of visible torches), which satisfies SC-006 and the 60 fps goal.

**Alternatives considered**:

- *Per-tile darkening of terrain/background sprites* — rejected: it cannot
  darken the player/enemies/pickups uniformly and would require touching every
  draw path.
- *A global `multiply` fill over the whole canvas* — rejected: `multiply`
  darkens the HUD too (violates FR-006) and provides no way to punch torch
  holes back through.
- *A WebGL shader* — rejected: adds a whole rendering stack and a dependency
  for one soft radial effect the 2D API already expresses, violating the
  no-feature-bloat and performance principles.

## D2 — Where the darkness level lives and how it fades

**Decision**: Add a module-level `darknessLevel` signal (0 … `MAX_DARKNESS`)
to `PlatformerState.ts`. Each game-loop tick computes the *target* (max
darkness when the player's foot cell is covered by a cave piece, else 0) and
eases the current value toward it with a pure `nextDarknessLevel(current,
target, dt, fadeSeconds)` helper in `engine/Lighting.ts` (linear
move-toward-target over `DARKNESS_FADE_SECONDS ≈ 0.4 s`, per the spec's
0.3–0.6 s assumption). `resetGame()` sets it to 0.

**Rationale**: The tick only runs in the `playing` phase, so darkness
automatically freezes with the world during pause/death (spec Edge Case and
Assumption "Freeze with the world") — no extra freeze logic. A signal keeps it
observable/testable and consistent with every other piece of platformer state
(Architecture: "Signals over Context"). Easing the value rather than the
overlay alpha keeps the transition logic pure and unit-testable.

**Alternatives considered**:

- *A component-local `useRef`* — rejected: the module-level signals survive a
  theme-switch unmount/remount, which is the established convention here (see
  `endingScreenShown`).
- *An instant snap with a CSS/canvas fade* — rejected: FR-003 requires a
  gradual fade and the spec's edge cases require no rapid on/off flicker at
  boundary cells; a per-tick eased value is deterministic and testable.

## D3 — How a piece declares that it darkens

**Decision**: Make it an **intrinsic property of the piece family** carried on
the typed `BackgroundCatalogEntry` as `family: 'surface' | 'cave'`. The
existing `block(...)` helper already takes a `Variant` of `'dirt' |
'charcoal'`; map `dirt → 'surface'` and `charcoal → 'cave'`. Add a
`backgroundPieceFamily(pieceId)` accessor. A cell darkens iff at least one
cave-family placement's footprint contains it. Because the result is a
boolean, overlapping cave pieces can never compound (FR-007 falls out for
free).

**Rationale**: FR-001/FR-021 require the distinction to be intrinsic and
follow the piece's own family, with no per-placement flag. The catalog already
knows each piece's variant; surfacing it as a typed field is the smallest
change and keeps the editor and the renderer reading one source of truth.

**Alternatives considered**:

- *A separate `pieceId → family` map* — rejected: two sources of truth that
  can drift; the catalog entry is already the natural home.
- *A per-placement `darkens` flag* — explicitly rejected by the spec
  (FR-001/FR-021).
- *Reading the tile's color/brightness at runtime* — rejected: fragile,
  expensive, and not typed.

## D4 — How torches become light sources

**Decision**: Add `findTorchTiles(layout)` to `LevelParser.ts` (mirroring the
other `findXTiles` helpers) and a `TORCH_TILES` computed in `level/level.ts`. Derive
a `torchPositions` computed in `PlatformerState.ts` that maps each torch cell
to its world-space centre via `tileToPixel`. The lighting pass and the enemy
eye pass read this list.

**Rationale**: The torch is already a `TileType` and a `TERRAIN_CHARS` entry
(O-013); every other placement kind in this codebase is discovered through a
`findXTiles` helper plus a `computed`, so this is the established pattern and
keeps the editor's "Try" button reactive. No new asset or per-torch state is
introduced — the torch stays stateless (see `engine/Torch.ts`).

**Alternatives considered**:

- *Scanning `currentLevel.terrain` inline in the render loop* — rejected:
  duplicates discovery logic and bypasses the `currentLayout` reactivity every
  other placement list uses.
- *A separate authorable "torch" list* — rejected: torches are already terrain
  tiles; a parallel list would let the two disagree.

## D5 — Which point of the player decides the cell

**Decision**: The player's **bottom-centre** point:
`col = floor((player.x + PLAYER_RENDERED_SIZE / 2) / RENDERED_TILE_SIZE)` and
`row = floor((player.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING) /
RENDERED_TILE_SIZE)`. Expose it as a pure `playerOccupiedCell(player)` helper.

**Rationale**: The spec clarification chose "the cell under the player's feet
(bottom-centre) — deterministic and matching the existing centered-on-a-tile
player model". `PLAYER_RENDERED_SIZE`/`PLAYER_FOOT_PADDING` are the existing
source of truth for where the feet actually are inside the render slot.

**Alternatives considered**:

- *The sprite's geometric centre* — rejected by the spec clarification; it
  would also darken while the player's body is still over open ground.
- *A collision-box top-left* — rejected: not the feet, and sensitive to
  transparent padding.

## D6 — How the torch glow pulses

**Decision**: A smooth, low-amplitude sine over the torch's own flame loop.
Compute the loop phase from the shared world clock and the torch's existing
position-hash phase (`torchPhase`), then scale the light radius/alpha by
`1 + TORCH_PULSE_AMPLITUDE * sin(phase)` with `TORCH_PULSE_AMPLITUDE ≈ 0.06`.

**Rationale**: FR-013 wants the pulse "in sync with that animation" but
"barely perceptible and never a nervous flicker or strobe". Reusing the flame
loop's period and per-torch phase keeps torches out of unison (consistent with
O-013) and a 6% amplitude reads as steady warmth. A smooth sine avoids the
visible stepping a per-frame (4-step) pulse would produce.

**Alternatives considered**:

- *Stepping the radius with the 4 frame indices* — rejected: a discrete 4-step
  jump at 0.2 s intervals can read as a nervous flicker, which SC-007 forbids.
- *An independent random flicker timer* — rejected: would desync from the
  flame, add per-torch state, and risk strobing.

## D7 — How enemy eyes are rendered

**Decision**: A drawn **primitive**, not sprite art: a separate
`drawEnemyEyes(ctx, enemies, darknessLevel, torches, worldElapsed, dc)` pass
that runs *after* the darkness overlay. For each living enemy, compute the
local darkness at its own anchor (`localDarknessAt`), convert it to an eye
opacity (`enemyEyeOpacity`), and draw two small integer-aligned yellow pixel
squares near the top of the enemy's collision box. No eye is drawn at or below
the low-darkness threshold.

**Rationale**: The spec assumption says the eyes are "a small drawn overlay
(like the existing checkpoint twinkles), generated for every enemy type
generically, so no per-enemy art is required". Drawing after the overlay is
what lets them stay visible *through* the darkness (FR-015), and using the
per-type `box()`/`enemyEffectAnchor` keeps them aligned to each enemy (FR-018/
FR-019) without new sprite assets.

**Alternatives considered**:

- *Tinting or replacing each enemy's sprite* — rejected: per-type work,
  invisible through the overlay, and would obscure the normal sprite.
- *Adding eyes to each enemy sheet* — rejected: new art per type for a generic
  marker; violates "no per-enemy bespoke eye art".

## D8 — Where the overlay sits in the render order

**Decision**: Insert the darkness + torch pass (and then the enemy-eye pass)
immediately **after `drawWaterForeground`** and **before** the hint tooltip,
collection effects, counter popups, debug overlay, and HUD. Torches' warm
glow is part of that same pass.

**Rationale**: FR-006 requires darkness over the world (background layers,
terrain, player, enemies, pickups, water) but not over HUD/UI (hearts,
counters, hint bubbles, journal, collection popups). Drawing after the
water — the last world element — and before every UI/feedback pass satisfies
both, and matches the existing "world, then UI" ordering.

**Alternatives considered**:

- *Drawing before collectibles/enemies* — rejected: enemies and pickups would
  be drawn on top of the darkness, breaking the mood and FR-006.
- *Drawing after the HUD and re-drawing the HUD* — rejected: needless
  duplication and fragile.

## D9 — Editor palette surface/cave split

**Decision**: Group the background layer's palette into two collapsible
`PaletteGroup` sections — **Surface** (`dirt` family) and **Cave**
(`charcoal` family) — using the catalog's `family`. Expose the section
membership from `backgroundPaletteTiles.ts` (e.g. a
`BACKGROUND_PALETTE_SECTIONS` list) so the component and its tests share one
definition.

**Rationale**: FR-020 requires the palette to be split into two clearly
labelled sections; the existing `PaletteGroup` already gives collapsible,
labelled groups and is used by the foreground palette. The torch already
appears in the Decoration group as `¥`, satisfying FR-022 with no change.

**Alternatives considered**:

- *Prefixing each label with "Surface"/"Cave"* — rejected: labels alone do not
  produce a *section* and read worse in a 3-column icon grid.
- *A new dropdown/filter* — rejected: more UI than the requirement asks for
  and inconsistent with the rest of the palette.

## D10 — Full-brightness fast path and regression safety

**Decision**: When `darknessLevel <= 0`, the overlay and eye passes draw
nothing at all. Because the darkness value only becomes non-zero through the
eased tick, a level with no cave pieces never darkens (FR-004), and at full
brightness the rendered frame is byte-for-byte the pre-feature frame (SC-005).

**Rationale**: Guarantees the "indistinguishable from before" success
criterion by construction rather than by tuning, and skips all overlay work in
the common (surface) case.

**Alternatives considered**:

- *Always drawing a zero-alpha overlay* — rejected: needless work and a real
  risk of a residual 1/255 tint on some browsers.

## Dependencies (existing code this builds on)

- **O-013 Platformer Wall Torches** — supplies the `torch` tile and its
  stateless flame animation (`engine/Torch.ts`), reused as the light source
  and its pulse phase.
- **O-009 Background Image Layers / O-003 Tile Layers** — supply the
  `BackgroundPlacement` system and `BackgroundCatalog`, which gain the family
  field.
- **F-017 Platformer Enemies** — supplies living-enemy state the eye marker
  reads.
- **F-019 Platformer Level Editor** — the `Palette` background layer gains the
  two sections.
