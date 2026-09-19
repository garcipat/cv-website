# Feature Specification: Platformer Wall Torches

**Feature Branch**: `O-013-platformer-wall-torches`  
**Created**: 2026-09-19  
**Status**: Draft  
**Input**: User description: "torches on the wall, tile animation for the torch — it should sparkle a little, about 3 or 4 frames, generated as 12–14px high pixel art, one image so the art is consistent"

## Clarifications

### Session 2026-09-19

- Q: Torch orientation & wall-mounting scope → A: Single fixed sprite (back-wall bracket + arm + flame). No wall-detection or orientation logic. A torch with no wall behind it draws the same sprite (no distinct "free-standing" art).
- Q: Multiple torch synchronization → A: Deterministic per-tile phase offset derived from grid position — torches are neither synchronized in unison nor independently timed, and their timing never changes over time.
- Q: Frame duration (sparkle pace) → A: ~200ms per frame (0.2s), giving a ~0.8s full loop for the default 4 frames.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Torch flame visibly sparkles on the wall (Priority: P1)

A visitor playing the platformer theme walks through cave areas and sees torches mounted on the walls. Each torch's flame gently flickers and sparkles as it burns, making the cave feel alive and warm.

**Why this priority**: The entire point of the feature is the animated, sparkling flame. Without it, a torch is just a static decoration with none of the atmosphere the feature exists to add.

**Independent Test**: Load a level containing a torch tile and observe it over a few seconds — the flame cycles through several visibly distinct frames on a continuous loop.

**Acceptance Scenarios**:

1. **Given** a torch is placed on a wall in a cave area, **When** the level renders, **Then** the torch's flame animates through at least 3 distinct frames so it reads as a gentle sparkle.
2. **Given** a rendered torch, **When** the animation reaches its last frame, **Then** it loops back to the first frame seamlessly with no visible jump or pause.
3. **Given** a rendered torch, **When** observed for several seconds, **Then** the flame never appears static or frozen.

---

### User Story 2 - Torch art is consistent across all frames (Priority: P2)

All frames of the torch animation come from a single image, so the flame keeps exactly the same size, style, and colors across every frame — no frame looks like it belongs to a different torch.

**Why this priority**: Consistent art is what makes the animation read as one torch flickering rather than several mismatched drawings flashing by. The user explicitly required one image for this reason.

**Independent Test**: Inspect the single torch image asset and confirm every frame shares the same dimensions and palette.

**Acceptance Scenarios**:

1. **Given** the torch sprite asset, **When** each animation frame is inspected, **Then** all frames are contained in a single image file.
2. **Given** the torch sprite asset, **When** frames are compared, **Then** every frame shares identical dimensions, palette, and drawing style.
3. **Given** two adjacent frames in the animation, **When** they are compared, **Then** the flame stays in the same position within the tile (no jumping or shifting between frames).

---

### User Story 3 - Torch sits on the wall as a decorative, non-blocking tile (Priority: P3)

The torch renders as a fixture mounted against a wall or backdrop, and — like other decorative cave dressing (cobwebs, crystals) — it does not block the player's movement or affect gameplay.

**Why this priority**: The torch is atmospheric dressing. It must look anchored to the wall and must never interfere with the player, but this is secondary to the flame animation itself.

**Independent Test**: Place a torch adjacent to a wall tile in a level, then walk the player through the torch's cell — the player passes freely and the torch stays visually attached to the wall.

**Acceptance Scenarios**:

1. **Given** a torch placed next to a wall or solid backdrop, **When** the level renders, **Then** the torch appears mounted against that wall.
2. **Given** a torch tile, **When** the player walks through its cell, **Then** the player movement is not blocked and no collision occurs.

---

### Edge Cases

- ✅ **Frame pacing**: The animation runs at ~200ms per frame (0.2s) — a calm, visible sparkle. Frames advancing much faster would strobe unpleasantly; much slower would make the sparkle imperceptible.
- ✅ **Torch without a wall**: If a torch is placed where no wall or solid tile is behind it, it must still render without errors — it draws the same single fixed sprite (bracket + arm + flame), just with nothing behind it. There is no distinct "free-standing" art and no wall-detection logic.
- ✅ **Multiple torches**: Several torches on screen at once must each animate correctly without slowing the game or desyncing in a jarring way — each torch's phase is fixed by its grid position (deterministic offset), so the pattern is stable and never drifts, with no per-tile runtime animation state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The torch MUST be a wall-mounted decorative tile in the platformer theme, intended for cave/underground areas.
- **FR-002**: The torch's flame MUST animate with a gentle sparkle/flicker effect, advancing one frame every ~200ms (0.2s) so the default 4-frame loop completes in ~0.8s.
- **FR-003**: The animation MUST consist of 3 to 4 distinct frames (default 4), cycling on a loop.
- **FR-004**: All animation frames MUST be authored in a single image (one sprite sheet) so that style, dimensions, and palette are guaranteed consistent.
- **FR-005**: The torch art MUST be flat 2D pixel art with a native height of 12–14px (maximum 14px), sized to sit within the game's 16px tile grid.
- **FR-006**: The animation MUST loop seamlessly — the final frame MUST transition back to the first frame with no visible jump.
- **FR-007**: The torch MUST render at a fixed size and position across all frames (no per-frame jitter or shifting).
- **FR-008**: The torch tile MUST be non-solid (decorative): it MUST NOT block the player's movement or participate in collision.
- **FR-009**: Multiple torch tiles on screen MUST animate without visual glitches, each with a deterministic phase offset derived from its grid position — so torches do not strobe in unison and their timing never changes over time.

### Key Entities _(include if feature involves data)_

- **Torch tile**: A decorative, non-solid tile placed in the level. Attributes: position (grid cell). The visible flame frame is derived (not stored) from the grid position and the shared world clock.
- **Torch animation frame set**: The ordered sequence of 3–4 flame frames that make up one sparkle loop, all drawn at a common size and palette in a single image.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The torch flame visibly sparkles — with frames advancing ~200ms apart, a viewer notices distinct frame changes within 3 seconds of watching, without any strobing effect.
- **SC-002**: The torch's entire animation is contained in exactly one image asset.
- **SC-003**: The torch sprite is no taller than 14px at native resolution, so it fits cleanly within the 16px tile.
- **SC-004**: The seamless loop required by FR-006 is achieved — no perceptible jump between the last frame and the first.
- **SC-005**: A player can walk through a torch's cell without any collision or gameplay effect (torch is purely decorative).

## Assumptions

- **Scope boundary**: This feature covers only the wall-torch tile and its sparkle animation. Light emission and radial glow (torches punching light through darkness) are out of scope and remain the concern of the separate **O-010 Platformer Cave Lighting** feature.
- **Frame count**: Defaults to **4 frames** (the upper end of the user's "3 or 4" range) for a smoother sparkle loop; 3 frames remains acceptable.
- **Frame duration**: Each frame is held for **~200ms** (0.2s), so the default 4-frame sparkle loop completes in ~0.8s — a calm, gentle flicker (slower than the coin's 0.12s spin and the player's 0.15s idle).
- **Torch height**: Defaults to **14px** (the maximum of the user's "12–14px" range) to maximize flame readability within the 16px tile.
- **Frame layout**: The single image is authored as a horizontal strip of equal-sized frames (one frame per column), consistent with the project's existing multi-frame sprite convention.
- **Tile behavior**: The torch follows the existing non-solid decorative-tile pattern (like cobwebs/crystals), so it needs no physics of its own.
- **Placement**: Torches are placed by level authors as a decorative tile, the same way existing cave dressing is placed.
- **Orientation**: The torch is a single fixed sprite (back-wall bracket + arm + flame) with no wall-detection or orientation logic — unlike cobwebs/spikes, it never auto-orients to nearby solid terrain.
- **Synchronization**: Each torch's animation phase is derived deterministically from its grid cell (position hash, like bush/stalactite variant picking), so torches are neither synchronized in unison nor independently timed.

## Dependencies

- **O-010 Platformer Cave Lighting** — a future feature that will reuse these torch tiles as light sources; this feature deliberately does not implement the lighting, but the two should stay visually compatible.
