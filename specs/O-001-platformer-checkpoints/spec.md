# Feature Specification: Platformer Checkpoints

**Feature Branch**: `O-001-platformer-checkpoints`
**Created**: 2026-09-19
**Status**: Planned
**Input**: A placeable checkpoint tile for the Platformer theme — a flag the character steps on to memorize that spot as the active respawn point for the current run, so dying returns the character there instead of to the level's spawn. Built so harder sections can be added later. Session-scoped (survives death and respawn, cleared only by Reset Game), visual-only activation feedback, and shipped as a tile plus level-editor support.
**Clarifications session**: 2026-09-19 — 5 questions answered (see ## Clarifications).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Activating a Checkpoint (Priority: P1)

A visitor reaches a resting spot marked by a flag standing limp and grey. Walking the character onto it activates the flag: it snaps upright and turns warm gold, a one-shot burst of particles plays at the tile, and a short "Checkpoint" label fades out in place. The spot now clearly reads as the visitor's safe point. Nothing is awarded, no counter changes, and no fact is revealed — the flag and its label are the whole feedback.

**Why this priority**: A respawn point the visitor cannot see is indistinguishable from no respawn point at all. The activation moment is how the visitor learns the mechanic exists and confirms that it worked.

**Independent Test**: Walk the character onto a dormant checkpoint tile. Verify the dormant art raises to the activated art, that the activation burst plays exactly once, and that the flag stays raised for the rest of the run.

**Acceptance Scenarios**:

1. **Given** a dormant checkpoint tile with solid ground directly below it, **When** the character stands on it and presses the interaction key (Up/W), **Then** the checkpoint activates. Walking over it without pressing the key does nothing.
2. **Given** a dormant checkpoint activates, **When** the transition happens, **Then** the flag raises from its dormant look to its activated look, a one-shot activation burst plays at the tile, and a short "Checkpoint" label appears and fades out in place.
3. **Given** the activation burst and label are playing, **When** they finish, **Then** both are removed and neither loops, lingers, or replays while the character remains standing on the checkpoint.
4. **Given** a checkpoint is already raised and is the active respawn target, **When** the character steps on it again, **Then** nothing happens — no raise animation, no second burst, and no change to which checkpoint is active.
5. **Given** a checkpoint has been activated, **When** play continues, **Then** its flag stays raised until the deliberate Reset Game action.

---

### User Story 2 - Dying Returns You to the Last Checkpoint (Priority: P1)

The visitor loses the last heart deep into a difficult stretch. After the death transition and the restart prompt, the character reappears standing on the last checkpoint — not back at the level's start — with all three hearts full. Every fact collected, every key found and every chest opened is still there.

**Why this priority**: This is the entire reason checkpoints exist. In a long level, respawning at the start turns one hard section into a slog and makes the game hostile to the visitor's time.

**Independent Test**: Activate a checkpoint, move the character away from it, reduce health to zero, restart, and verify the character spawns on the checkpoint with full health and the camera there.

**Acceptance Scenarios**:

1. **Given** a checkpoint is active and the character dies, **When** the run restarts, **Then** the character appears standing on the active checkpoint with all three hearts full.
2. **Given** no checkpoint has been activated this run, **When** the character dies and restarts, **Then** it appears at the level's spawn point exactly as before — checkpoints change nothing until one is touched.
3. **Given** the character respawns at a checkpoint, **When** the restart transition begins, **Then** the camera is positioned at the checkpoint rather than the level start, including the vertical camera snap used on respawn.
4. **Given** the visitor collected facts, found keys or opened chests before dying, **When** they respawn at a checkpoint, **Then** all of that progress is preserved exactly as it is by today's death restart.
5. **Given** the character respawns at a checkpoint, **When** it spawns, **Then** defeated enemies are revived at their placements and every other respawn rule is unchanged.
6. **Given** the character respawns at a checkpoint, **When** it spawns, **Then** it is immediately vulnerable — a checkpoint respawn grants no protective window.

---

### User Story 3 - Visited Flags Stay Raised, the Latest Twinkles (Priority: P2)

A long level holds several checkpoints. Every checkpoint the visitor activates keeps its flag raised, a record of the safe points they have reached. The most recently activated one is the active respawn point and twinkles, so the visitor can always tell where a death will take them without the earlier flags dropping back down.

**Why this priority**: The core loop works with a single checkpoint. This story is what makes checkpoints safe to scatter through a long level: raised flags show progress, and the single twinkling flag removes any guess about which one is live.

**Independent Test**: Activate checkpoint A, then checkpoint B, and verify both flags stay raised, B twinkles, and a death respawns at B.

**Acceptance Scenarios**:

1. **Given** checkpoint A is raised, **When** the character activates dormant checkpoint B, **Then** B raises, plays its activation moment once, and becomes the twinkling active checkpoint, while A stays raised but stops twinkling.
2. **Given** B is now the twinkling active checkpoint and A is raised, **When** the character dies and restarts, **Then** it respawns at B, never at A.
3. **Given** A is raised and B is the twinkling active checkpoint, **When** the character presses the interaction key on A again, **Then** A becomes the twinkling active checkpoint again, with no raise animation and no burst replay, since A is already raised.
4. **Given** two dormant checkpoints are activated in the same instant, **When** the tick resolves, **Then** exactly one becomes the twinkling active checkpoint, deterministically, using the level's reading order so the outcome is reproducible, and both are raised.
5. **Given** a run with raised checkpoints, **When** the visitor chooses Reset Game, **Then** every checkpoint returns to dormant and none twinkles.

---

### User Story 4 - Placing Checkpoints in the Level Editor (Priority: P2)

A level author opens the editor palette, finds the checkpoint tile alongside the other tiles, reads its tooltip to confirm what it does, and paints it into the grid. The tile saves with the level and appears in the game at that cell when the level is played.

**Why this priority**: The checkpoint is a level-design tool. Without editor placement, harder sections cannot actually be given safe points, and the tile is unreachable in play.

**Independent Test**: Open the editor, find the checkpoint in the palette, paint one into a level, save and reload, then play and verify a checkpoint exists and activates at that cell.

**Acceptance Scenarios**:

1. **Given** the level editor palette, **When** it renders, **Then** it includes a checkpoint button with a human-readable name, a tooltip describing what the tile does in the finished level, and a preview showing the raised (activated) flag.
2. **Given** the checkpoint tool is selected, **When** the author paints a cell, **Then** the checkpoint's marker character is written to the grid like any other tile, and the Eraser clears it like any other tile.
3. **Given** a level containing checkpoint markers is saved and later loaded, **When** the level is played, **Then** a dormant checkpoint is placed at each marked cell and activates on contact.
4. **Given** the blueprint canvas, **When** the author paints a checkpoint, **Then** it is treated like any other tile — a stamped blueprint places its checkpoint normally, with no special blueprint-only handling.

---

### Edge Cases

- ✅ **Checkpoint painted into mid-air**: a checkpoint only activates when there is solid ground directly below its cell. A checkpoint with no solid ground beneath it is inert — pressing the interaction key while on it does nothing — so a death can never respawn the character into a pit. Mid-air activation is not allowed; the author places the marker in the air directly above a floor.
- ✅ **Checkpoint painted over ground**: like every other marker, the checkpoint cell becomes empty terrain, so painting one on a ground tile leaves a one-tile hole. This matches how spawn, enemy, coin and sign markers already behave; the author places the marker in the air above a floor.
- ✅ **Checkpoint under a ceiling or in a cave**: works normally, provided the cell is reachable and has solid ground below it.
- ✅ **Death on the checkpoint tile itself**: the visitor respawns on that same checkpoint, since it is the active one.
- ✅ **Death with no checkpoint active**: unchanged — the character returns to the level's spawn point.
- ✅ **Checkpoint and pit fall**: a pit fall still costs half a heart and returns the character to the last safe ground it stood on. The active checkpoint has no effect on pit-fall recovery; only death uses it. Because every respawn — checkpoint or level spawn — makes its own position the new last-safe-ground anchor, a pit fall immediately after a checkpoint respawn recovers at that checkpoint rather than back toward the level start.
- ✅ **Reset Game versus death**: a death/respawn preserves the active checkpoint (and everything else already discovered); Reset Game clears it along with collected facts, chests, keys and block progress, so a fresh run has no active checkpoint.
- ✅ **Checkpoint after the ending screen**: once every chest is opened the run is over; Reset Game returns all checkpoints to dormant alongside the rest of the level.
- ✅ **Activation during a paused or dying phase**: the game loop is paused outside `playing`, so no checkpoint activates until play resumes.
- ✅ **Two checkpoints activated in one tick**: resolved to one deterministic twinkling active checkpoint (see User Story 3, scenario 4); both are raised, but the run never holds two active respawn targets. If one of the overlapped checkpoints is already raised but not the active respawn target and the other is dormant, the dormant activation wins. This case is not expected to arise from sensible level design, but the rule is defined so behavior is deterministic.
- ✅ **Respawning into a revived enemy**: defeated enemies are revived at their placements on respawn and the character is immediately vulnerable, exactly as at the level's spawn. A level author must not place an enemy directly on or next to a checkpoint; the game grants no protection.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The game MUST provide a checkpoint element placed into a level by a hand-authored marker — the uppercase `C` character, distinct from every terrain, entity, sign and hazard character — rather than baked into terrain, visually distinct from terrain and from every other marker.

- **FR-002**: A checkpoint MUST be non-solid: the character passes through it and stands over it, and a checkpoint cell MUST be empty terrain, exactly like every other marker cell.

- **FR-003**: A checkpoint MUST have two flag states — dormant and activated — that are clearly distinguishable at a glance. The dormant state shows a limp, grey flag; the activated state shows the flag raised and warm gold. The checkpoint that is currently the active respawn target MUST be additionally distinguished by subtle pixel-art twinkles, so it reads apart from other raised flags. The flag art MUST be flat 2D pixel-art sprites, exactly 16px wide and no more than 24px tall — small, front-facing, hard-edged pixels — matching the existing platformer sprites, not a large illustration or a 3D/shaded render. They MUST be delivered as a single horizontal animation strip of 4 frames (each 16px wide, max 24px tall): frame 0 is the dormant look and the final frame is the activated look.

- **FR-004**: Pressing the interaction key (Up, or W as the alternate) while the character's footprint overlaps a dormant checkpoint MUST activate it, provided the cell directly below holds solid ground. Walking over a checkpoint without pressing the interaction key MUST do nothing. A checkpoint with no solid ground beneath its cell is inert and never activates, so a death can never respawn the character into a pit.

- **FR-005**: Activating a checkpoint MUST play a one-shot activation moment at the tile — a 4-frame flag-raise animation (from the limp dormant frame through to the raised activated frame), a short burst of particles, and a short fading label (see FR-022) — that reads as a distinct event. The animation holds on its final activated frame, and the particle burst is removed when it finishes.

- **FR-006**: The activation moment MUST play exactly once per dormant-to-activated transition. It MUST NOT loop, persist on screen, or replay while the character stays on or re-enters an already-raised checkpoint.

- **FR-007**: Every checkpoint the character activates MUST stay raised for the rest of the run; activating a later checkpoint MUST NOT lower the earlier ones. Exactly one checkpoint at a time MUST be the active respawn target — the most recently activated checkpoint — and that checkpoint MUST be the one that twinkles.

- **FR-008**: Pressing the interaction key on an already-raised checkpoint MUST NOT replay its raise animation or burst. If it is not the current respawn target, that press MUST make it the active respawn target again, moving the twinkles to it, still with no raise animation or burst.

- **FR-009**: When more than one dormant checkpoint is entered in the same tick, the game MUST settle on exactly one active respawn target, deterministically, by the level's reading order — so the same play-through always produces the same result. All entered checkpoints become raised. If an already-raised checkpoint that is not the active respawn target and a dormant checkpoint are entered in the same tick, the dormant activation MUST win and become the active respawn target.

- **FR-010**: On death, the restart MUST place the character at the active respawn target when one exists, and at the level's spawn point when none does. A checkpoint respawn MUST NOT place the character at the level start.

- **FR-011**: A checkpoint respawn MUST place the character standing on the checkpoint's cell — horizontally centered and with its feet resting on the solid surface directly below that cell (which FR-004 guarantees exists) — with its motion cleared and its grounded state restored, matching how the level's spawn marker places the character. The respawn position MUST also become the character's new last-safe-ground anchor (see FR-020).

- **FR-012**: A checkpoint respawn MUST position the camera at the checkpoint rather than the level start, including the vertical camera snap used on respawn, and the restart transition MUST be centered on the respawn point.

- **FR-013**: A checkpoint respawn MUST restore full health, revive defeated enemies at their placements, and preserve every collected fact, found key, opened chest and block/container progress — identical to today's death restart except for the location.

- **FR-014**: A respawned character MUST be immediately vulnerable; a checkpoint respawn MUST NOT grant a protective window, matching the existing spawn rule.

- **FR-015**: The active respawn target and every raised flag MUST persist across death and respawn — using a checkpoint does not consume it or lower it. They MUST be cleared only by the deliberate Reset Game action, exactly as collected facts, chests, keys and block progress are.

- **FR-016**: Reset Game — the Reset Game button in the journal — MUST return every checkpoint to its dormant state and clear the active respawn target, so a fresh run begins with no flag raised and the character returns to the level's spawn point on its first death. This is the same full reset that already clears collected facts, chests, keys and block progress, and it is also what runs when the run is reset by a theme switch.

- **FR-017**: A checkpoint MUST be available as a tile in the level editor palette, with a human-readable name and a tooltip describing what it does in the finished level, and it MUST be paintable and erasable on the editor grid like any other tile, writing the uppercase `C` marker to the grid. The palette preview MUST show the raised (activated) flag rather than the dormant one, so the tile is recognizable at a glance.

- **FR-018**: A level's checkpoint markers MUST be read from the layout when the level loads — the uppercase `C` character mapping to the checkpoint entity kind (whose cell is empty terrain, per FR-002) — so any saved level containing them places dormant checkpoints at those cells with no further authoring.

- **FR-019**: The activation moment MUST be visual only. It MUST NOT produce sound, since the project's audio feature is not committed.

- **FR-020**: A checkpoint MUST NOT affect pit-fall recovery. A pit fall still costs half a heart and returns the character to the last safe ground it stood fully on, regardless of which checkpoint is the active respawn target. Every respawn — checkpoint or level spawn — MUST make the respawn position the new last-safe-ground anchor, so a pit fall after a respawn recovers at that respawn point rather than back toward the level start.

- **FR-021**: The pixel-art twinkles that mark the active respawn target (FR-007) MUST persist while that checkpoint is the active respawn target and MUST move off a checkpoint the moment another becomes the active respawn target. They MUST be visual only — no sound — and MUST NOT be a one-shot effect like the activation moment.

- **FR-022**: Activating a checkpoint MUST show a short label reading the localized word for "checkpoint" at the tile, appearing with the activation moment and fading out in place. The label MUST NOT travel or fly to the HUD or journal the way a collected fact does, MUST be localized for both supported languages (English and German), and MUST NOT replay on re-entering an already-raised checkpoint.

### Key Entities

- **Checkpoint**: A hand-placed, non-solid marker tile (the uppercase `C` layout character) with two flag states, dormant and activated (raised). It activates only when solid ground sits directly below its cell. Its identity is its cell in the level grid; a level may hold any number of them.

- **Activated checkpoint**: A checkpoint whose flag has been raised by touching it. It stays raised for the rest of the run; any number may exist at once.

- **Active respawn target**: The single checkpoint (at most one) whose cell the character respawns at after death — the most recently activated checkpoint, marked by pixel-art twinkles. Absent until a checkpoint is first activated this run, and cleared by Reset Game.

- **Activation moment**: The one-shot visual event — a 4-frame flag-raise animation, a short particle burst, and a short fading "Checkpoint" label — played on the dormant-to-activated transition, holding on the raised frame. Carries no fact, no counter change and no sound, and is never replayed for an already-raised checkpoint.

- **Run state**: The session-scoped, in-memory progress a play-through accumulates — collected facts, chests, keys, block and container progress, the raised flags, and the active respawn target. It survives death and respawn and is cleared only by Reset Game. It does not survive a page reload or a theme switch.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Activation is visible and happens once**: pressing the interaction key on a dormant checkpoint raises the flag and plays the burst exactly once; pressing it on an already-raised flag replays nothing. Verified by a unit test over the activation state and effect lifecycle plus a browser check.

- **SC-002 — Death returns the visitor to the last checkpoint**: with a checkpoint active, dying restarts the character on that checkpoint with full health and the camera there. Verified by a component test driving activation, death and restart.

- **SC-003 — No checkpoint means no behavior change**: with none active, death restarts at the level spawn exactly as before. Verified by a regression test.

- **SC-004 — A checkpoint respawn costs nothing discovered**: facts, keys, opened chests and block progress are identical before and after a checkpoint respawn. Verified by test.

- **SC-005 — Checkpoint memory has the same lifetime as the rest of the run**: the active checkpoint survives death and respawn, and Reset Game clears it and returns every checkpoint to dormant. Verified by unit test.

- **SC-006 — Visited flags stay raised, exactly one twinkles**: activating a later checkpoint keeps the earlier flags raised and moves the twinkles to the newly activated one, and no play-through ever holds two active respawn targets. Verified by unit test.

- **SC-007 — Checkpoints are authorable**: the palette offers the checkpoint with a name, tooltip and the raised-flag preview, a painted checkpoint round-trips through save/load, and a level containing one runs with a checkpoint at that cell. Verified by editor tests plus a browser check.

- **SC-008 — Pit falls are unchanged**: a pit fall still costs half a heart and returns the character to the last safe ground regardless of the active checkpoint. Verified by regression test.

## Assumptions

- **[F-015](../F-015-platformer-theme/spec.md) is complete**: the Platformer theme's game loop, rendering, physics, level-marker format, HUD and journal all exist. This feature adds a marker and a respawn destination into those systems; it does not create them.

- **[F-016](../F-016-platformer-health/spec.md) is complete**: the health model, death lifecycle, restart-on-input, pit-fall recovery to last safe ground, and the rule that a respawn preserves collected facts are all in place. This feature changes only *where* a post-death respawn happens, and leaves pit-fall recovery alone.

- **[F-019](../F-019-platformer-level-editor/spec.md) is complete**: the editor palette, tile painting, save/load and the game's marker-driven level loading all exist, so the checkpoint enters the palette the same way every other tile does.

- **Session-scoped run state**: the project keeps run progress in in-memory signals only — there is no `localStorage` persistence for collected facts, chests, keys or block progress, and a page reload or theme switch re-runs module top-level code and resets the run. The raised flags and the active respawn target therefore live exactly as long as that run state does: they survive death and respawn, and are cleared only by Reset Game. They are not expected to survive a page reload or theme switch.

- **The checkpoint is an interaction trigger with solid ground required**: activation requires the interaction key (Up/W) to be pressed while the character's footprint overlaps the checkpoint cell, provided the cell directly below holds solid ground — not the character's own grounded state alone. A marker with no solid ground beneath it is inert.

- **The activation moment reuses the existing effect vocabulary**: the particle burst follows the same one-shot, world-anchored, deterministic pattern as the game's existing collection and destruction effects; it does not introduce a new effect framework.

- **The activation label is localized and fades in place**: the short word shown on activation is a UI string translated for English and German, following the project's existing localization. Unlike a collected fact's text, it does not fly to the HUD or journal — it fades out where it appears.

- **New two-state art with a raise animation**: the flag tile needs a dormant look, an activated (raised) look, and the frames between them, authored as flat 2D pixel art and delivered as one horizontal animation strip of 4 frames (each exactly 16px wide and no more than 24px tall) on the game's 16px source grid, scaled with nearest-neighbor like every other sprite. The strip's first frame is the dormant look, its last frame the activated look, and the middle frames depict the flag rising. They must be small, tile-scale game sprites — not large illustrations or 3D renders. The art is flat 2D: no 2.5D/3D shading such as cylindrical highlights, gradients, or perspective. All four frames are authored in the one strip so they share a single style and palette. The active respawn target's pixel-art twinkles are a separate rendered pass, not an extra sprite frame. The activation burst is likewise drawn as small pixel-art squares (checkpoint-only), not the soft dots other puffs use. Exact pixels remain an implementation detail; the pixel-art style, frame count and dimensions are fixed.

- **The checkpoint respawns, it does not reward**: reaching a checkpoint grants no fact, no counter change, no healing beyond the full-health reset every respawn already gives, and no item.

- **No sound**: audio is the uncommitted O-008 feature, so the activation moment is visual only.

## Clarifications

Record of the clarification sessions. Each answer is encoded into the relevant sections above.

### Session 2026-09-19

| # | Question | Choice | Impact |
|---|---|---|---|
| 1 | What is the "last safe ground" anchor after a checkpoint respawn? | **Respawn position becomes the anchor** — after any respawn (checkpoint or level spawn), `lastGroundedX/Y` is set to the respawn position, exactly as `spawnPlayerState` seeds them, so a pit fall right after a checkpoint respawn recovers at that checkpoint. | Added the anchor rule to FR-011 and FR-020; extended the pit-fall edge case. |
| 2 | May a checkpoint activate with no solid ground below its cell? | **No — solid ground required** — a checkpoint with no solid ground beneath its cell is inert and never activates, preventing respawns into a pit. | Added the ground requirement to FR-004 and FR-011; rewrote the mid-air edge case; updated the floor-trigger assumption. |
| 3 | Is a respawn into a revived enemy protected? | **No protection** — enemies are revived at their placements and the character is immediately vulnerable, same as at the level spawn; level design must not place an enemy on or next to a checkpoint. | Kept FR-014; added the respawn-into-enemy edge case. |
| 4 | Same tick: an already-raised (non-active) checkpoint and a dormant checkpoint? | **Dormant activation wins** — the dormant checkpoint becomes the active respawn target; both end up raised. | Added the rule to FR-009 and the same-tick edge case. |
| 5 | Which level-format marker character does a checkpoint use? | **Uppercase `C`** (U+0043 letter C, not the copyright symbol) — unused by the terrain/entity/sign/hazard maps and mnemonic. | Added `C` to FR-001 and FR-018; the editor writes `C` per FR-017. |

### Session 2026-09-19b (post-implementation review)

| # | Question | Choice | Impact |
|---|---|---|---|
| 1 | Should a checkpoint activate automatically on contact? | **No — require the interaction key** — standing on a dormant checkpoint and pressing Up/W activates it (the same gesture chests use); walking over one is inert. | Rewrote FR-004; updated US1, FR-008, and the trigger assumption. |
| 2 | How is the active checkpoint marked? | **Small pixel-art twinkles**, not a soft radial glow — the glow read as too big/bright and not pixel-art. The activation burst is also drawn as small pixel-art squares (checkpoint-only). | Rewrote FR-003 and FR-021; updated US3, SC-006, and the art assumption. |

## Out of Scope

- **Cross-reload and cross-theme-switch persistence**: saving the active checkpoint and collected facts to `localStorage` so a visitor can close the tab or switch themes and resume later is not part of this feature. This specification covers only the in-run checkpoint respawn, whose memory has the same lifetime as the rest of the run state. If cross-reload persistence is pursued later, it is a new feature in its own right.

- **Placing many checkpoints in the shipped level**: the shipped level authors a single checkpoint near the start so the mechanic is reachable in play; scattering further checkpoints through harder sections remains the level author's job via the editor.

- **Audio**: an activation sound effect belongs to **O-008 Platformer Audio**, which is not committed.

- **Checkpoint interaction beyond the single interaction key**: no menu, confirmation prompt, fast-travel, or checkpoint selection UI. Activation uses the same Up/W interaction gesture chests already use.

- **Checkpoint effects beyond respawn position**: no healing, item granting, shop, healing station, or safe-zone behavior.

- **Changing pit-fall recovery**: the "last safe ground" return is unchanged and is not replaced by, or redirected to, the active checkpoint. (A respawn updating the last-safe-ground anchor is existing respawn behavior, not a change to pit-fall recovery — see FR-020.)

- **Multiple simultaneous active respawn targets**: exactly one checkpoint is the active respawn target at a time. Several flags may be raised at once, but there is no notion of several live respawn points or choosing among them.

- **Lives, score, save slots, or run history**: checkpoints are position memory only.

- **Blueprint-specific checkpoint semantics**: a checkpoint painted into a blueprint is treated as an ordinary tile when the blueprint is stamped; no special handling is specified here.
