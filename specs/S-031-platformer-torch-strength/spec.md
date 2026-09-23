# Feature Specification: Platformer Torch Strength

**Feature Branch**: `S-031-platformer-torch-strength`
**Created**: 2026-09-23
**Status**: Implemented
**Input**: A wall torch currently lights a fixed radius. Give each torch a light **strength** (0–9) carried as a tile-meta-layer marker, shown as a corner number in the editor and raised by clicking the torch again — the same shape as a sign's hint.

**Depends on**: [S-030](../S-030-platformer-tile-meta-layer/spec.md) (the tile meta layer this extends).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A stronger torch lights more of the cave (Priority: P1)

A developer drops a torch in a dark room and clicks it again to raise its strength; the torch's warm light pool grows. Setting it to `0` leaves almost no light; `9` reaches roughly twice the old radius. An untouched torch, and every level authored before this feature, still lights exactly as before.

**Independent Test**: Place a torch, play the level, note the pool; raise the strength in the editor, play again, and confirm the pool grew. Set it to `0` and confirm the pool is gone.

**Acceptance Scenarios**:

1. **Given** a torch with no marker, **When** the level is played, **Then** it lights at the default strength (`5`, today's radius).
2. **Given** a torch whose strength is raised, **When** the level is played, **Then** its light radius scales with the strength (`0` = none, `9` ≈ twice the default).
3. **Given** a level authored before this feature, **When** it loads, **Then** every torch lights exactly as it did.

---

### User Story 2 - Set a torch's strength while authoring (Priority: P1)

The developer selects the torch tool, clicks an empty cell (a default torch appears with a `5` in its corner), then clicks the torch again and again: the number steps up `6, 7, 8, 9, 0, 1, …`, wrapping, and every torch's corner shows its current strength. Right-clicking the torch removes it entirely.

**Independent Test**: Place a torch, re-click it through a full `0`–`9` cycle and back, watching the corner number; then right-click and confirm the torch and its number are gone.

**Acceptance Scenarios**:

1. **Given** the torch tool, **When** the developer clicks an empty cell, **Then** a default torch (strength `5`, no marker) is placed.
2. **Given** a placed torch, **When** the developer clicks it again, **Then** its strength steps to the next value and the corner number updates; a torch at `4` steps to the default and stores no marker.
3. **Given** any torch, **When** the canvas is drawn, **Then** its strength (the marker's value, or `5`) shows in the tile's corner.
4. **Given** a torch, **When** the developer right-clicks it (or erases it, or paints another tile over it), **Then** the torch and its strength marker are both removed.
5. **Given** a torch, **When** the developer hovers it, **Then** a tooltip names it and its strength.

---

### Edge Cases

- ✅ **A torch at the default strength**: stored as no marker at all, so an unadjusted level is unchanged and its file stays sparse.
- ✅ **Raising past `9`**: wraps to `0`; one below the default (`4`) wraps to `5`, which clears the marker.
- ✅ **A stored strength outside `0`–`9`**: ignored at load and replaced by the default.
- ✅ **Erasing or replacing a torch tile**: its strength marker goes with the tile.
- ✅ **A torch and a sign in the same level**: their corner badges are on different tiles, so they never collide.
- ✅ **The editor's dark preview**: a torch's preview pool scales with its strength, like the running game.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A wall torch MUST be able to carry a light strength `0`–`9` as a `torch` marker on the tile meta layer, and MUST NOT encode it in a terrain character.
- **FR-002**: A torch with no marker MUST light at the default strength, `5`, which MUST be calibrated to the pre-feature fixed radius so existing levels are unchanged.
- **FR-003**: A torch's light radius MUST scale linearly with its strength — `0` no light, `5` the default, `9` roughly double — in both the running game and the editor's dark preview.
- **FR-004**: The editor MUST show every torch's strength as a corner number, derived from the marker or the default.
- **FR-005**: The torch tool MUST place a default torch on a fresh cell and, clicked again on a placed torch, MUST step the strength to the next value in the `0`–`9` cycle, wrapping at `9`; the step that reaches the default MUST clear the marker.
- **FR-006**: Right-clicking a torch, erasing it, or painting another tile over it MUST remove both the tile and its strength marker.
- **FR-007**: A stored strength that is not an integer in `0`–`9` MUST be ignored and replaced by the default on load, without failing.
- **FR-008**: A torch's strength marker MUST survive save, reload and blueprint placement like every other marker.

### Key Entities

- **Torch strength** — a `torch` marker's value, an integer `0`–`9`; the default `5` is stored as no marker.
- **Torch light** — a light source derived from a `torch` terrain tile, whose radius scales with the tile's strength.

## Success Criteria _(mandatory)_

- **SC-001 — Existing lighting is unchanged**: every level authored before this feature lights exactly as it did, because an unmarked torch is the default.
- **SC-002 — Strength is visible and settable**: the developer can read every torch's strength at a glance and step it through `0`–`9` by clicking.
- **SC-003 — Strength survives a round trip**: a raised torch's strength is the same after save, reload and placement.
- **SC-004 — A torch is removable**: erasing a torch removes its marker too, leaving no orphan.

## Assumptions

- **[S-030](../S-030-platformer-tile-meta-layer/spec.md) exists**: this feature adds one marker kind to that layer; it does not recreate it.
- **The held torch is out of scope**: only hand-placed wall torches (`¥`) carry a strength; the player's carried light is unchanged.
- **No new character**: the torch stays one `¥` terrain character; the strength is metadata.

## Out of Scope

- Varying the held torch's light.
- Per-torch colour or flicker variation.
- A torch whose strength changes during play.
