# Feature Specification: Platformer Cave Fog

**Feature Branch**: `O-028-platformer-cave-fog`
**Created**: 2026-09-23
**Status**: Draft
**Input**: [Issue #79](https://github.com/garcipat/cv-website/issues/79) — when the player is
not in a cave, tiles whose background is cave-family should be covered in fog so their
contents aren't visible, mirroring how Cave Lighting (O-010) hides everything outside when
the player is in a cave.

## Clarifications

### Session 2026-09-23

- Q: What is the fog for — fog-of-war/discovery, or a plain visual rule? → A: **A plain
  visual rule.** A cave-family cell is fogged whenever the player is currently outside a
  cave, every time, with no memory of what has previously been seen or entered — there is
  no "discovered" state to track.
- Q: Which content on a cave-family cell should the fog hide — just the background art, or
  everything on that cell? → A: **Everything on that cell** — background, terrain, blocks
  and entities alike. A fogged cell shows nothing of what it contains.
- Q: Should the fog fade in and out, or apply instantly? → A: **A smooth fade**, on the same
  timescale as Cave Lighting's existing darkness fade, so the two transitions read as one
  continuous effect rather than two independently-timed ones.
- Q: What should the fog look like? → A: **A flat, near-opaque tint** — not a textured mist
  sprite, and not simply cave darkness's own black reused at a lighter shade; a tone that
  reads as fog rather than as shadow.
- Q: A flat per-cell fill read as artificial — grid-stamped, one uniform color, static. What
  should replace it? → A: **Soft, overlapping, gently drifting puffs** — no new art (still no
  textured mist sprite), but each cave-family cell's fog is now a soft-edged radial gradient
  (opaque core, faded rim) sized larger than the cell so neighbouring puffs merge into one
  bank and bleed into an adjacent clear cell rather than stopping at the grid line, with a
  slow per-cell "breathing" pulse so it reads as alive rather than static.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Cave Interiors Stay Hidden From Outside (Priority: P1)

A visitor walking across open ground approaches a cave mouth or looks across a gap into a
cave interior visible elsewhere on screen. Instead of seeing the cave's stone, ledges,
blocks and any enemies inside it fully lit, that area reads as an opaque bank of fog — the
same way that, from inside a cave, the visitor cannot see the sunlit world outside. As the
visitor actually steps into the cave, the fog ahead of them clears in the same smooth fade
that the cave's own darkness uses to close in behind them; walking back out, the fog returns
over what they leave behind just as smoothly.

**Why this priority**: This is the entire feature. Without it, cave interiors are fully
visible from the surface, undermining the "you can't see in until you're in" read that Cave
Lighting already establishes in the other direction.

**Independent Test**: Load a level with a cave area visible from open ground (e.g. a cave
mouth in view, or a gap looking into a cave chamber). Confirm the cave-family cells read as
fogged while the player is outside, and that walking the player into the cave clears the fog
on the cells they enter, in a smooth fade rather than a snap.

**Acceptance Scenarios**:

1. **Given** the player is outside a cave, **When** a cave-family background cell is on
   screen, **Then** that cell — including anything on it — is covered by an opaque fog and
   none of its contents are legible.
2. **Given** the player is standing inside a cave (Cave Lighting's darkness is active),
   **When** the level renders, **Then** no fog is drawn anywhere — darkness and fog are
   mutually exclusive.
3. **Given** the player walks from open ground into a cave, **When** the crossing happens,
   **Then** the fog on the cells around them fades out smoothly, on the same pacing as Cave
   Lighting's darkness fading in.
4. **Given** the player walks from inside a cave back out to open ground, **When** the
   crossing happens, **Then** fog returns smoothly over the cave-family cells behind them, on
   the same pacing as Cave Lighting's darkness fading out.
5. **Given** a cave-family cell scrolls into view while the player's own fog/darkness state
   is not currently transitioning, **When** it appears on screen, **Then** it shows the fog
   level already in effect immediately — cells do not fade in individually as the camera
   scrolls past them.
6. **Given** a level with no cave-family background cells at all, **When** the player moves
   anywhere in that level, **Then** no fog is ever drawn.

---

### Edge Cases

- **A cave-family cell right next to the player's own cell**: still fully fogged while the
  player's own cell is not cave-family — proximity does not make a neighboring cave cell any
  more visible; only actually standing on a cave-family cell clears it.
- **A fogged cell containing an enemy, block, or hazard**: none of it is visible or hinted at
  through the fog; the fog is opaque, not a translucent haze (Acceptance Scenario 1).
- **Torches or other light sources on a fogged cell**: render exactly as they do today
  because fog and Cave Lighting's darkness never coexist — a torch is only ever seen either
  glowing through darkness (player inside) or not at all (player outside, cell fogged).
- **A level entirely made of cave-family background**: darkness (O-010) applies the whole
  time the player is anywhere in it, so no fog is ever drawn — fog only exists on cells the
  player has not currently darkened into.
- **Paused / dead / restart screen**: the current fog level freezes with the rest of the
  world, matching Cave Lighting's own freeze behavior, and never keeps animating or flickers.
- **Many fogged cells on screen at once**: rendering stays smooth with no perceptible
  stutter, matching Cave Lighting's own performance bar for a screen full of darkness and
  light pools.
- **Full-brightness / no-cave regression**: in any level or area with no cave-family
  background, the rendered view is indistinguishable from before this feature.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every on-screen background cell whose material belongs to the cave family
  MUST be covered by an opaque fog whenever the player's own current cell is not
  cave-family.
- **FR-002**: Fog on a cell MUST cover everything on that cell — its background, terrain,
  blocks and entities alike — so none of it is legible while fogged.
- **FR-003**: Fog and Cave Lighting's darkness MUST share one continuous crossfade: as the
  player's own cell crosses the cave/surface boundary, one effect fades out exactly as the
  other fades in, so the two never both sit at their full, steady-state value at the same
  time. During the crossfade itself (see FR-004), both may be partially present together —
  that overlap is what makes the transition read as smooth rather than a snap.
- **FR-004**: Fog MUST fade in and out smoothly as the player's own cell crosses the
  cave/surface boundary, never snapping instantly, and MUST use the same pacing as Cave
  Lighting's existing darkness fade so the two transitions read as one continuous effect.
- **FR-005**: The fog level in effect MUST apply immediately to any cave-family cell as it
  scrolls into view — fading is driven only by the player's own boundary crossing, not by
  cells entering or leaving the viewport.
- **FR-006**: Fog MUST be purely visual. It MUST NOT alter collision, hitboxes, triggers, or
  any other gameplay logic for whatever is underneath it.
- **FR-007**: Fog MUST NOT change how torches or any other light source render — light
  sources continue to behave exactly as Cave Lighting (O-010) already defines.
- **FR-008**: A level containing no cave-family background cells MUST never show any fog.
- **FR-009**: The fog's tint MUST be visually distinct from Cave Lighting's neutral-black
  darkness, so a visitor can tell "fogged from outside" apart from "dark because I'm inside."
- **FR-010**: Fog MUST NOT be drawn over HUD elements or UI overlays (hearts, counters, hint
  bubbles, journal, collection popups), matching Cave Lighting's own exclusion.

### Key Entities

- **Fog level**: a single world value describing how present the fog currently is (none to
  fully opaque). It is derived from whether the player's own cell is cave-family — the
  inverse of Cave Lighting's own trigger — and animated smoothly over time rather than
  stored per cell or per level.
- **Fogged cell**: any on-screen cell whose background material belongs to the cave family,
  while the fog level is above zero. Carries no state of its own beyond its material's
  intrinsic family, already defined by O-014.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Cave contents are hidden from outside**: while the player is outside a cave,
  nothing on a visible cave-family cell (terrain, blocks, enemies) is legible. Verified by
  automated tests and manual inspection.
- **SC-002 — Fog and darkness share one crossfade**: outside a crossfade, either fog is
  present and Cave Lighting's darkness is fully off, or darkness is active and no fog is
  drawn anywhere — never both at full/steady-state, never neither when a cave-family cell
  is or isn't on screen appropriately. While the player's cell is actively crossing the
  cave/surface boundary, fog and darkness may briefly both be partially present, one rising
  as the other falls — this is the intended crossfade (FR-003/FR-004), not an overlap bug.
  Verified by automated tests.
- **SC-003 — Transitions feel continuous**: crossing the cave boundary in either direction
  fades fog and darkness on the same timescale, with no visible snap. Verified by automated
  tests asserting matching fade pacing, and by manual inspection.
- **SC-004 — No gameplay change**: adding fog changes nothing about collision, damage,
  triggers or scoring. Verified by the existing gameplay test suite passing unchanged.
- **SC-005 — Full-brightness regression**: in any level or area with no cave-family
  background, the rendered view is indistinguishable from the pre-feature view.
- **SC-006 — Still smooth**: a screen full of fogged cells renders with no perceptible
  stutter.

## Assumptions

- **[O-010](../O-010-platformer-cave-lighting/spec.md) is complete**: the player-cell trigger
  and the fade pattern this feature mirrors, and stays mutually exclusive with, already
  exist.
- **[O-014](../O-014-platformer-background-tiles/spec.md) is complete**: the surface/cave
  background material family this feature keys off already exists; this feature adds no new
  material and no new palette section.
- **Fog can be fully opaque**: unlike Cave Lighting's darkness — which is capped below full
  opacity so the player's own character always stays discernible — fog never covers the
  player's own current cell (it is, by definition, not cave-family whenever fog is active),
  so there is no equivalent readability floor to protect.
- **Fog tint, puff size, and pulse timing are tunable during implementation**: the requirement
  is only that the tint is near-opaque at a fogged cell's centre, visually distinct from Cave
  Lighting's neutral black, and rendered as soft-edged, gently animated puffs rather than a
  flat, static, grid-aligned fill.
- **No editor-time preview**: the level editor does not need to render fog while authoring,
  matching Cave Lighting's own original scope. (The editor's separate dark-mode toggle,
  O-015, is an unrelated manual preview and is unaffected by this feature.)
- **No discovery / fog-of-war memory**: a cell's fog state depends only on the player's
  current position, never on what has previously been seen or visited.

## Dependencies

- **O-010 Platformer Cave Lighting** — provides the player-cell cave/surface trigger this
  feature inverts, and the darkness this feature stays mutually exclusive with and paces its
  own fade against.
- **O-014 Platformer Background Tile Rework** — provides the surface/cave background
  material family this feature keys off.

## Out of Scope

- Fog-of-war or discovery/memory of previously-seen cave areas.
- Any interaction with torches or other light sources beyond their existing Cave Lighting
  behavior.
- A textured or hand-authored mist sprite — the fog's soft, animated look is generated from
  gradients and a deterministic per-cell pulse, not new art.
- Showing fog in the level editor's preview.
- Any new background material, palette section, or authoring surface — this feature reuses
  the existing surface/cave family as-is.
- Any gameplay effect: nothing about fog blocks, damages, reveals, or otherwise changes what
  a fogged cell does.
- A broader notion of "in a cave" than the single player-foot cell check O-010 already uses.
