# Feature Specification: Platformer Cave Lighting

**Feature Branch**: `O-010-cave-lighting`
**Created**: 2026-09-19
**Status**: Draft
**Input**: User description: "i want o specify the feature of background tiles that are inside and making the view dark when entering for example a cave and torches enlightening the view. maybe enemies need to be shown as small yellow eyes?"

## Clarifications

### Session 2026-09-19

- Q: How should a level author decide which background areas darken? → A: Darkening is an intrinsic property of the background piece itself — the charcoal (cave) family darkens, the dirt (surface) family does not. There is no per-placement flag; the editor's background palette is split into two sections (surface and cave) to keep them visually separate.
- Q: What exactly triggers the view to darken? → A: The single grid cell the player currently occupies. If a darkening background piece covers that cell, the view darkens; otherwise it does not.
- Q: Which on-screen things get the glowing yellow eyes in the dark? → A: Living enemies only. Hazards, pickups, blocks and other entities do not.
- Q: How bright is a torch's light pool? → A: A soft radial gradient — clear/bright right at the torch, falling off smoothly with distance until the glow blends into the surrounding darkness (not a hard-edged flat circle).
- Q: How should the background-tile rework be scoped? → A: The surface/cave palette split is part of O-010; the quieter, less-noisy background art and simplified footprints are a separate feature.
- Q: Does darkening apply only to background tiles, or to foreground tiles too? → A: Only background pieces decide whether an area darkens — foreground terrain tiles carry no darkening information and never act as darkness sources. The darkness overlay itself still dims the whole scene (background layers, foreground terrain, player, enemies, pickups).
- Q: Which point of the player decides the occupied cell that drives darkness? → A: The cell under the player's feet (bottom-center) — deterministic and matching the existing centered-on-a-tile player model.
- Q: Are the yellow eyes driven by the global darkness or by the enemy's own location? → A: The local darkness at the enemy's own position — an enemy standing in a torch's light pool (local darkness low) shows its normal sprite, not eyes.
- Q: Should a torch's light glow appear when no darkness is active? → A: No — the glow is drawn only while darkness is active; in fully lit areas a torch renders as its normal animated flame only.
- Q: Should the torch's light pool flicker with its flame? → A: Yes, but very mildly — the glow breathes slowly (a few seconds per cycle, independent of the flame's fast frame rate) and with very low amplitude, barely perceptible and never a nervous flicker or strobe.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Entering a cave darkens the view, leaving it brightens again (Priority: P1)

A visitor playing the platformer theme walks across open, sunlit ground and steps under a stone overhang into a cave. The view dims smoothly around them, and when they walk back out into the open the view brightens again just as smoothly. The darkness is tied to where the player actually is, so shallow shade reads as a mild dusk and deep underground reads as genuinely dark.

**Why this priority**: This is the foundation of the whole feature. Without the darkness there is no cave mood, and neither the torch light pools nor the enemy eyes have anything to stand out against.

**Independent Test**: Load a level containing a darkening background area next to open ground, walk the player in and out of that area, and observe the view dim and brighten gradually.

**Acceptance Scenarios**:

1. **Given** the player stands on open ground not covered by any darkening background piece, **When** the level renders, **Then** the view is fully bright with no darkening applied.
2. **Given** the player walks from open ground into a cell covered by a darkening background piece, **When** the transition happens, **Then** the view darkens gradually over a short fade rather than snapping instantly.
3. **Given** the player is standing inside a darkening area, **When** they walk back out to open ground, **Then** the view brightens gradually back to full brightness.
4. **Given** a level with no darkening background pieces at all, **When** the player moves anywhere in that level, **Then** the view never darkens.

---

### User Story 2 - Torches light the cave (Priority: P2)

Inside a dark cave, torches mounted on the walls glow and push warm pools of light back through the darkness, so cave interiors read as pockets of warm light on stone. The player can find their way by torchlight, and between torches the cave stays dark.

**Why this priority**: The torch light is what makes the darkness playable and atmospheric rather than simply dimming the game. It is the second half of the core cave experience the user asked for ("torches enlightening the view").

**Independent Test**: Stand the player in a dark cave area with a torch visible on screen and confirm a warm circular pool of light appears around the torch, brighter than the surrounding darkness.

**Acceptance Scenarios**:

1. **Given** a dark cave area containing a torch, **When** the level renders, **Then** a warm, roughly circular pool of light appears around the torch and is visibly brighter than the surrounding darkness.
2. **Given** two torches placed apart in the same dark area, **When** the level renders, **Then** each produces its own light pool and the pools combine cleanly where they overlap.
3. **Given** the player walks past a torch, **When** the camera scrolls, **Then** the light pool stays anchored to the torch's position in the world rather than staying fixed on the screen.
4. **Given** a torch's flame animation is running, **When** darkness is active, **Then** the flame still animates and stays visible inside its own light.
5. **Given** the player stands in a dark area with no torch nearby, **When** the level renders, **Then** the area is dark but not pitch black — the ground and the player remain faintly readable.

---

### User Story 3 - Enemies are revealed as glowing yellow eyes in the dark (Priority: P3)

In a dark cave the player cannot clearly see the slimes ahead of them, but each living enemy gives itself away as a small pair of glowing yellow eyes floating in the darkness. As the player brings light to the area, the eyes fade and the enemy's normal sprite takes over.

**Why this priority**: The eyes solve the fairness problem the darkness creates — enemies would otherwise be invisible hazards — while reinforcing the cave atmosphere. They are a visibility aid on top of the darkness and torches, so they come after them.

**Independent Test**: Place a living enemy inside a dark cave area with no torch, and confirm the enemy is visible as a pair of small glowing yellow eyes; then brighten the area and confirm the eyes disappear and the normal sprite returns.

**Acceptance Scenarios**:

1. **Given** a living enemy is on screen in a dark cave area, **When** the level renders, **Then** the enemy is marked by a small pair of glowing yellow eyes that remain visible through the darkness.
2. **Given** darkness is fading as the player moves into light, **When** the view brightens, **Then** the eyes fade out and the enemy's normal sprite becomes clearly visible again.
3. **Given** a living enemy stands inside a torch's light pool while the rest of the cave is dark, **When** the level renders, **Then** that enemy shows no eye marker and renders with its normal sprite.
4. **Given** the view is at full brightness, **When** the level renders, **Then** enemies render exactly as before, with no eye marker at all.
5. **Given** an enemy has been defeated and removed from play, **When** the level renders, **Then** no eyes are shown for it.
6. **Given** several enemies are on screen in a dark area, **When** the level renders, **Then** each living enemy shows its own eye marker, aligned to its own position.

---

### User Story 4 - Level authors can tell cave pieces from surface pieces (Priority: P4)

While building a cave, a level author opens the background palette and finds it split into two sections — surface pieces and cave pieces — so they can tell at a glance which pieces shade the area and which do not, and shape the light and shadow of a cave deliberately. Torches can be painted into the cave as light sources.

**Why this priority**: The feature is useless if authors cannot author dark areas, but it is authoring support rather than the player-facing experience, so it comes last.

**Independent Test**: Open the level editor, inspect the background palette, and confirm it presents surface and cave pieces as two clearly separate sections; place a cave piece and confirm the area darkens in play, then place a torch and confirm it is available as a decorative tile.

**Acceptance Scenarios**:

1. **Given** the level editor's background palette, **When** an author inspects it, **Then** the pieces are grouped into two clearly labelled sections — surface pieces (which do not darken) and cave pieces (which do).
2. **Given** an author places a cave background piece, **When** the player later walks over that cell, **Then** the view darkens; placing a surface piece does not darken.
3. **Given** the level editor's palette, **When** an author looks for a torch, **Then** the torch is available as a paintable decorative tile.

---

### Edge Cases

- **Boundary cells**: When the player stands on a cell at the edge of a darkening area, the darkness must not flicker rapidly on and off — the fade smooths the transition, and a cell is either covered by a darkening piece or it is not.
- **Overlapping darkening pieces**: Two or more darkening pieces covering the same cell must not stack into a darker-than-maximum result — darkness is capped once.
- **No torches in a cave**: A darkening area with no torches must still leave the player faintly visible and the ground readable, so the game never becomes unplayable.
- **Torch partially off-screen**: A torch at the edge of the viewport still lights the visible part of its pool correctly, and a torch scrolled fully off-screen contributes nothing.
- **Mild light pulse**: Several torches pulsing together must never produce a busy, strobing scene — the pulse is slow and low-amplitude enough that a viewer reads the light as steady warmth, not as flickering.
- **Paused / dead**: Darkness must freeze with the rest of the world while paused, dying, or on the restart screen — it must not keep animating or flicker.
- **UI readability**: The heart HUD, counters, hint bubbles, journal, and collection popups must stay fully readable regardless of how dark the world is.
- **Enemy during a hit reaction**: An enemy reacting to a stomp keeps its eye marker consistent with its current on-screen position.
- **Level with many torches and enemies**: A cave with several torches and enemies on screen must keep the frame rate smooth.
- **Full-brightness regression**: In any level or area without darkening pieces, the rendered view must be indistinguishable from before this feature.

## Requirements _(mandatory)_

### Functional Requirements

**Darkness**

- **FR-001**: Whether a background piece darkens MUST be an intrinsic property of the piece itself, not a per-placement flag. Pieces representing cave/underground interiors (the charcoal family) darken the view; surface pieces (the dirt family) do not. Foreground terrain tiles MUST NOT carry any darkening information and MUST never act as darkness sources.
- **FR-002**: The current darkness MUST be driven by the single cell under the player's feet (bottom-center) — entering a cell covered by a darkening background piece darkens the view, and leaving it brightens the view.
- **FR-003**: Darkness changes MUST be gradual (a smooth fade), never an instantaneous snap.
- **FR-004**: When the player is not over any darkening piece, darkness MUST be zero (fully bright).
- **FR-005**: Darkness MUST be capped below full opacity so the scene stays faintly readable and the player character is always discernible; the game MUST never become unplayable.
- **FR-006**: The darkness MUST cover the game world (background layers, terrain, player, enemies, pickups, water) but MUST NOT cover HUD elements or UI overlays (hearts, counters, hint bubbles, journal, collection popups).
- **FR-007**: Overlapping darkening pieces MUST NOT compound — the darkest possible state is a single cap.

**Torch light**

- **FR-008**: Existing torch tiles MUST act as light sources: every torch in view casts a warm, soft radial glow through the darkness. The glow MUST be drawn only while darkness is active; in fully lit areas a torch renders as its normal animated flame only.
- **FR-009**: Torch light MUST fall off as a gradient — the area immediately around the torch is clear and bright, and brightness decreases smoothly with distance until the glow blends into the surrounding darkness. The glow MUST NOT be a hard-edged flat circle.
- **FR-010**: Multiple torches MUST each contribute their own light, and overlapping pools MUST combine without visual artifacts.
- **FR-011**: Torch light MUST pass through walls and terrain by design — there is no shadow casting or occlusion.
- **FR-012**: Light pools MUST be anchored to the torch's world position and scroll with the camera.
- **FR-013**: The torch's existing flame animation MUST continue to play and stay visible inside its own light pool, and the light pool MUST breathe slowly and gently — a very low-amplitude change over a few seconds, not locked to the flame's fast frame rate — so the pulse is barely perceptible and never reads as a nervous flicker or strobe.
- **FR-014**: Torch light MUST use a warm tone (orange/gold), visually distinct from the neutral darkness.

**Enemy eyes**

- **FR-015**: Every living enemy whose own position is above a low darkness threshold MUST be marked by a small pair of glowing yellow eyes that stays visible through the darkness. An enemy standing where local darkness is low — for example inside a torch's light pool — MUST NOT show the marker.
- **FR-016**: The eye marker MUST fade with the local darkness at the enemy's position — fading in as that spot darkens and fading out as it is lit — so at full brightness, or in torch light, enemies render normally with no marker.
- **FR-017**: Defeated or removed enemies MUST NOT show an eye marker.
- **FR-018**: The eye marker MUST be small and anchored to the enemy (moving and scrolling with it), MUST NOT obscure the enemy's normal sprite when that sprite is visible, and MUST bob gently up and down (a few rendered pixels, driven by the shared world clock) so it reads as alive rather than as a static dot.
- **FR-019**: The eye marker MUST stay aligned to the enemy as it moves and scrolls with the camera.

**Level authoring**

- **FR-020**: The level editor's background palette MUST be split into two clearly labelled sections — surface pieces and cave pieces — so an author can tell at a glance which pieces darken.
- **FR-021**: A piece's section MUST follow the piece's own family, so placing or removing a piece never requires the author to set a separate darkening flag.
- **FR-022**: The torch MUST remain available as a paintable decorative tile in the editor.

### Key Entities _(include if feature involves data)_

- **Darkening background piece**: A background placement whose piece family shades the view (charcoal/cave darkens; dirt/surface does not). Key attributes: which piece it is, its anchor position, its footprint, and its family (which decides whether it darkens).
- **Darkness level**: A single world value describing how dark the view currently is (bright to maximum dark). It is derived from the cell under the player's feet and animated smoothly over time rather than stored per area.
- **Light source (torch)**: A torch tile in the world. It contributes a warm radial glow with a soft gradient falloff that pulses with its flame, anchored to its world position.
- **Enemy eye marker**: A derived visual attached to a living enemy, shown only while that enemy's own location is dark. It has no stored state of its own.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A player walking from open ground into a cave sees the view darken smoothly within about half a second, and sees it brighten equally smoothly on the way out — with no visible snap at either transition.
- **SC-002**: In a dark cave, every torch on screen is identifiable at a glance as a distinct warm glow that is clear near the flame and fades into the surrounding darkness.
- **SC-003**: In the darkest areas, the player character remains discernible at all times, and the ground stays readable enough to move on — play never becomes impossible.
- **SC-004**: In the darkest areas, every living enemy on screen is identifiable by its glowing yellow eyes, and defeated enemies show none.
- **SC-005**: At full brightness, the rendered view is indistinguishable from the pre-feature view — no residual darkening and no eye markers.
- **SC-006**: A cave with several torches and enemies on screen runs without perceptible stutter.
- **SC-007**: Watching a cave with several torches for several seconds never feels busy or flickery — the light reads as steady, gentle warmth, and no pulse is distracting enough to draw the eye away from play.

## Assumptions

- **Which pieces darken**: Darkening is intrinsic to the piece family — the charcoal (cave) family darkens, the dirt (surface) family does not. There is no per-placement darkening flag; the editor's background palette is split into surface and cave sections so the distinction is visible while authoring. The exact membership of each family can be tuned during implementation.
- **Trigger model**: Darkness is keyed to the single cell under the player's feet (bottom-center), not to a separately painted cave region or a global level setting. Walking under a darkening piece is what "entering the cave" means.
- **Fade duration**: The darkening/brightening fade is roughly 0.3–0.6 seconds (default ~0.4s), fast enough to feel responsive but slow enough to avoid a snap.
- **Maximum darkness**: Darkness is capped at roughly 97% (a brightness floor), tunable so playability always wins over mood.
- **Torch light radius and falloff**: A torch's glow is clear at the flame and fades out over roughly a 3.5 tile radius, blending into the surrounding darkness; the exact radius and gradient curve are tuned during implementation.
- **Torch light color**: Warm orange/gold, distinct from the neutral darkness overlay.
- **Torch glow only in darkness**: The glow is not drawn in fully lit areas, so torches never read as glowing orbs in daylight.
- **Torch glow breathes slowly**: The light pool breathes very mildly rather than sitting perfectly static — a slow cycle of a few seconds (≈2.6 s) with a radius change of only a couple of percent, deliberately decoupled from the flame's fast frame rate so it never reads as a flicker. Each torch keeps its own phase, so several torches never pulse in unison.
- **Enemy eyes are rendered, not new sprite art**: The eyes are a small drawn overlay (like the existing checkpoint twinkles), generated for every enemy type generically, so no per-enemy art is required.
- **Eye marker scope**: Only enemies receive the eye marker; hazards, pickups, blocks, and chests do not. It is driven by the local darkness at each enemy's own position, so an enemy inside a torch's light pool shows its normal sprite instead.
- **Eye marker bobs gently**: The marker drifts a few rendered pixels up and down on a slow cycle (≈1.5 s), driven by the shared world clock so it freezes with the world like every other animation.
- **No occlusion**: Light passes through walls and terrain by design — a deliberate simplicity tradeoff that keeps the effect cheap.
- **Atmospheric only**: Darkness gates no gameplay. No door, item, or enemy requires light to interact with.
- **Torch flame animation**: The existing torch sparkle animation is reused as-is; the light pool's very mild pulse follows that animation, per FR-013.
- **Editor preview**: The editor groups background pieces into surface and cave sections but does not need to render the full darkness effect while authoring.
- **Background art rework is separate**: The quieter, less-noisy background art and simplified footprints the user wants are a separate feature, not part of this one; O-010 relies on the existing piece families and only adds the surface/cave palette split.
- **Freeze with the world**: Darkness animation follows the same pause/death freezing as the rest of the game world.

## Dependencies

- **O-013 Platformer Wall Torches** — provides the torch tile and its flame animation, which this feature uses as light sources.
- **O-009 Platformer Background Image Layers** and **O-003 Platformer Tile Layers** — provide the background placement system and the piece families this feature treats as darkening (cave) or non-darkening (surface).
- **F-017 Platformer Enemies** — provides the living-enemy states the eye marker is attached to.
- **F-019 Platformer Level Editor** — provides the authoring surface where the surface/cave palette sections and torches are authored.

## Out of Scope

- Day/night cycles or time-of-day lighting.
- Dynamic light sources other than torches (projectiles, explosions, glowing pickups) — see Possible Extensions for the deferred player-carried light.
- Shadow casting, occlusion, or raycast lighting.
- Colored lighting beyond the warm torch tone.
- Light-gated gameplay (locked doors, dark-only enemies, light-based puzzles).
- Per-enemy bespoke eye art or enemy-specific darkness behavior.
- The rework of the background art itself (quieter, less-noisy pieces and simplified footprints) — tracked as a separate feature; this feature only adds the surface/cave palette split.

## Possible Extensions (Deferred)

Not required by this feature, but deliberately left open so it can be added later without reworking the lighting model:

- **Player-carried light**: a small soft glow around the player, and/or a small torch rendered in the player's hand, giving the player a faint light of their own in the dark. This feature's darkness, torch glow and enemy eyes are designed so the game is fully playable without it. If added, it would be a light source anchored to the player and would follow the same soft radial-gradient falloff as torches (FR-008/FR-009). It is intentionally not part of this specification's requirements.
