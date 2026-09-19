# Phase 0 Research: Platformer Checkpoints

**Feature**: O-001 Platformer Checkpoints
**Spec**: [spec.md](./spec.md)
**Date**: 2026-09-19

All Technical Context unknowns were resolved by reading the existing Platformer
engine, its level pipeline, and the project conventions in
`docs/Architecture.md` / `docs/TestingGuide.md`. No external research was
required — every decision below is an application of an existing in-repo
pattern.

---

## R1. Where the checkpoint marker lives in the level format

**Decision**: Register the checkpoint as an **entity marker** — `C` →
`'checkpoint'` in `ENTITY_CHARS` (`level/LevelParser.ts`), with a
`findCheckpointTiles(layout)` finder and a `CHECKPOINT_TILES` computed in
`level/level.ts`. Add `'C'` to the hand-written `TileChar` union.

**Rationale**: The level format has exactly four marker maps
(`TERRAIN_CHARS`, `ENTITY_CHARS`, `SIGN_CHARS`, `HAZARD_CHARS`) and enforces
that a character means one thing (`LevelParser.ts`'s import-time overlap
guard). A checkpoint is a hand-placed, non-solid, CVData-free placement — the
same category as a sign or a spike, and it is placed via the editor's Entities
group. `ENTITY_CHARS` is the group the editor iterates to build its entity
palette buttons, so registering here makes the palette entry automatic.
`parseLevel` already resolves entity markers to `'empty'` terrain, satisfying
FR-002 and FR-018 with no parser change beyond the map entry.

**Alternatives considered**:
- *A `SIGN_CHARS`-style map of its own.* Rejected: a sign's character carries
  a `HintId`; a checkpoint's character carries nothing but "checkpoint". A
  whole fifth map for one fixed value is ceremony, and the editor would need a
  new group.
- *A block kind.* Rejected: blocks are solid geometry with hit state; a
  checkpoint is a non-solid floor trigger with no hit interaction.
- *A terrain tile.* Rejected by `Entities.md`'s invariant: terrain is a static
  character grid; a checkpoint changes state over time.

---

## R2. Checkpoint run state representation

**Decision**: A new `checkpointStates` signal in `PlatformerState.ts`, seeded
from `checkpointPlacements` via `toCheckpointState`, mirroring `chestStates` /
`blockStates`. Each `CheckpointState` carries its own `activated` flag and
raise-animation timer. The single live respawn target is a separate
`activeCheckpointId` signal.

**Rationale**: `Entities.md`'s rule is "state is only for things that change"
— a checkpoint raises and stays raised, so it is stateful, exactly like a
chest. The persistence rule (FR-015) also matches chests/blocks: the state
signal survives `resetGame()` (death/respawn) and is rebuilt from placements
only in `resetGameProgress()` (Reset Game / theme switch). Keeping "which one
is active" as one id signal encodes FR-007's "exactly one active respawn
target" in the type itself rather than as an invariant spread across N
booleans.

**Alternatives considered**:
- *An `active: boolean` per checkpoint.* Rejected: N booleans can hold 2
  active targets; the spec forbids that. A single id cannot.
- *A plain `activated` id Set outside the states.* Rejected: the raise
  animation needs a per-instance `activatedAt` timestamp, so the state object
  is needed anyway.

---

## R3. Activation detection and same-tick determinism

**Decision**: Reuse `overlappingTriggers` (`engine/Collision.ts`) with a
one-rendered-tile `checkpointBox`, filtered by "the cell directly below is
solid" (`isSolid(tileAt(level, col, row + 1))`). Resolve the tick in
`engine/CheckpointLogic.ts` as a pure function over reading-ordered
placements: if any entered checkpoint is dormant, the **first dormant in
reading order** becomes active; otherwise the **first entered raised** one
becomes active. Every entered dormant checkpoint is raised.

**Rationale**: FR-004's "footprint overlaps the tile" is the same player
hitbox every other trigger uses (`playerHitbox`), and FR-004's ground
requirement is one `isSolid` call. Reading order is the order
`findCheckpointTiles` already returns and the order `placeCheckpoints`
preserves, so "deterministic, by the level's reading order" (FR-009) is free
— no sorting, no tie-break code. The dormant-wins rule is one `??` branch.

**Alternatives considered**:
- *The character's own `grounded` flag.* Rejected by the spec's assumption:
  activation is a floor-trigger overlap, not a grounded state — the player
  may run across a checkpoint tile in the air above it.
- *Per-checkpoint independent activation with last-write-wins active.*
  Rejected: non-deterministic under a single tick; violates FR-009.

---

## R4. Activation moment: animation, burst, and label

**Decision**:
- **Flag raise** — a 4-frame animation derived from a write-once `activatedAt`
  snapshot on the state, measured against the shared world clock
  (`worldElapsed - activatedAt`), holding on frame 3 once the raise duration
  elapses. No per-frame tick and no separate effect object.
- **Particle burst** — reuse the existing `PuffEffect`
  (`engine/CollectionEffects.ts`), started once on the dormant→activated
  transition, so the burst is removed when it finishes and never replays
  (FR-005/FR-006).
- **Fading text** — a new, generically named `FadeOutTextEffect` type in
  `engine/CollectionEffects.ts` (its own array, its own tick, its own fade
  curve, its own draw pass), drawn in place at the tile. It carries its own
  already-localized `text`, so it is not checkpoint-specific and any future
  in-place fading text reuses it without a rename. Deliberately not a
  `FlightEffect`, which always flies to the journal/HUD.

**Rationale**: The project's effect vocabulary is "one shape per visual
behaviour, each with its own signal array and draw pass" (`activePuffs`,
`activeHealAuraEffects`, `activeHitSplatters`). A text that fades in place is
a genuinely different behaviour from a flying fact text, so it earns its own
small type rather than a degenerate `FlightEffect` — the same reasoning
`B-003` recorded for splitting `PuffEffect` out of `FlightEffect`. Naming it
for the behaviour (`FadeOutTextEffect`) rather than its first caller keeps that
vocabulary honest: the checkpoint label is a user of the shape, not its
definition.

**Alternatives considered**:
- *Reuse `FlightEffect` with equal start/mid/target.* Rejected for the same
  reason B-003 rejected it for puffs: a degenerate shape hides intent and
  drags flight-only fields along.
- *Reuse the sign speech bubble.* Rejected: the bubble is anchored to the
  player's head and interactive; the checkpoint label is a transient world
  label.
- *A per-frame `activationElapsed` advanced by `dt` each tick.* Rejected: it
  would rewrite the `checkpointStates` signal every frame during the raise for
  no benefit, where the shared world clock already provides the same timing for
  free and freezes consistently with coins during death/pause.

---

## R5. The active-target glow

**Decision**: A separate rendered draw pass (`drawCheckpointGlow`) — a subtle,
gently pulsing radial glow behind the active checkpoint's flag — read from
`activeCheckpointId`. It is not a sprite frame and not a one-shot effect.

**Rationale**: FR-021 requires the glow to persist while active and move the
moment another becomes active, and the spec's assumptions say the glow is a
rendered effect "like the game's existing auras". The engine already draws
non-sprite world effects (`drawHealAuraEffects`, `drawLowHealthGlow`), so this
fits. Because it is driven by `activeCheckpointId`, "moves off the moment
another becomes active" is automatic.

**Alternatives considered**:
- *A 5th sprite frame in the strip.* Rejected: the spec fixes the strip at 4
  frames and calls the glow a rendered effect, not sprite art.
- *A one-shot burst replayed on every activation.* Rejected by FR-021
  (must not be one-shot).

---

## R6. Respawn placement and camera

**Decision**: Refactor the spawn maths in `PlatformerState.ts` into a pure
`playerStateAtTile(col, row)` helper; `spawnPlayerState()` becomes
`playerStateAtTile(SPAWN_TILE.col, SPAWN_TILE.row)`. Expose the respawn point
as **`computed` signals** — `activeRespawnPlacement` (from
`activeCheckpointId` + `checkpointStates`), `respawnPlayerState` (active
checkpoint's tile, else spawn) and `respawnCenter` — so it is derived reactive
state, consistent with the app's signals convention, rather than a plain
function recomputed ad hoc. `resetGame()` reads `respawnPlayerState.value` and
therefore places the character at the active checkpoint when one exists.
`resetGameProgress()` clears `activeCheckpointId` / `checkpointStates`
**before** calling `resetGame()`, so Reset Game returns to spawn. Add
`initialCameraX` (`engine/Camera.ts`) and extend the existing
`snapCameraYToSpawn` into `snapCameraToRespawn`, called from the restart,
debug-respawn and Reset Game paths; `introState` is centred on
`respawnCenter.value`.

**Rationale**: `spawnPlayerState` already computes exactly the geometry
FR-011 requires (horizontally centred, feet on the cell's bottom edge, motion
cleared, `lastGroundedX/Y` seeded) — parameterizing its tile reuses it
verbatim for a checkpoint cell. `resetGame()` is the single reset seam for
death/respawn (its own doc comment says so), so respawn location belongs
there; `resetGameProgress()` is the only place allowed to clear run state, so
clearing the active checkpoint before its `resetGame()` call keeps the two
paths distinct without a new parameter. `initialCameraY` already exists for
the same reason on the vertical axis; `initialCameraX` is its missing mirror
so FR-012's "camera at the checkpoint" holds during the iris transition, not
only from the first tick.

**Alternatives considered**:
- *Pass a target into `resetGame()`.* Rejected: it would make every caller
  responsible for deciding the target, and `resetGame` already owns "reset to
  the current respawn state".
- *Let the first game-loop tick re-frame the camera.* Rejected: the death
  iris is centred on the respawn point and starts before the first tick, so
  the camera must already be there (FR-012).

---

## R7. Art asset and palette preview

**Decision**: Use the existing `public/sprites/checkpoint-flag-strip.png`
(64×24 = four 16×24 frames) as the single source of truth. Register it as
`CHECKPOINT_FLAG_SHEET` (`entities/Checkpoint.ts`) with `columns: 4`,
`frameWidth: 16`, `frameHeight: 24`. Draw frames bottom-anchored and
horizontally centred in the cell. The palette preview
(`PALETTE_TILE_SPRITES.C`) crops frame 3 (the raised/gold frame), per FR-017.

**Rationale**: The asset already exists and matches the spec's fixed
dimensions exactly (16 wide, 24 tall, 4 frames, flat pixel art). The palette
sprite spec is a hand-picked crop of a sheet, so pointing it at frame 3 needs
no new rendering path. `RENDER_SCALE = 2` renders the frame 32×48, taller than
the 32px cell — bottom-anchoring keeps the pole base on the cell's floor.

**Alternatives considered**:
- *Two separate images (dormant/active).* Rejected: the spec mandates one
  horizontal strip so all frames share one palette; the asset is a strip.
- *A new glow frame in the strip.* Rejected (see R5).

---

## R8. Localization

**Decision**: Add `platformer.checkpoint.label` to `src/i18n/locales/en.json`
and `de.json` (`"Checkpoint"` / `"Kontrollpunkt"`). Draw it with the existing
canvas font (`RESTART_PROMPT_FONT_FAMILY`, ByteBounce) via the new label draw
pass.

**Rationale**: FR-022 requires the label localized for both supported
languages. `Translation` is `typeof enJson`, so adding the key to `en.json`
and mirroring it in `de.json` keeps the type exhaustive; the platformer
already reads UI strings from `currentUI.value.platformer.*` in
`PlatformerPage.tsx`.

**Alternatives considered**:
- *A new top-level `platformer.checkpoint` object with several fields.*
  Rejected for now: only one string is needed (the label). A nested object can
  be introduced when a second checkpoint string appears.

---

## R9. Documentation of the new marker

**Decision**: Update `docs/themes/platformer/LevelFormat.md` (Entity
characters table + `TileChar` count) and `docs/themes/platformer/LevelDesign.md`
(element table) with the `C` row, and update the marker inventory comment in
`level/level.ts`. On completion, update `docs/Features.md` per the project's
feature-completion rule.

**Rationale**: The project treats these docs as authoritative descriptions of
the level format and element set; a new marker that is not in them is a
documentation regression. `docs/Features.md` tracking is a constitutional
requirement (Principle IV and the completion-tracking rule in `AGENTS.md`).

**Alternatives considered**: none — this is required by project conventions.

---

## R10. Testing approach

**Decision**: TDD per `docs/TestingGuide.md` — write failing Vitest tests
first for every new pure module, then implement. New pure modules get unit
tests (`CheckpointLogic`, `CheckpointMapper`, `Checkpoint`, the new
`CollectionEffects` label, `initialCameraX`); behaviour gets integration
coverage through `PlatformerPage.test.tsx` (activation once, re-touch no
replay, death respawns at the active checkpoint, Reset Game clears). Naming
follows `{method}-{condition}-{expected-result}` with `// Arrange / Act /
Assert`.

**Rationale**: Constitution Principle II is NON-NEGOTIABLE: tests before
implementation, Vitest + RTL + jsdom, that naming pattern. The existing
`PlatformerPage.test.tsx` (3687 lines) is the established harness for
loop-level behaviour, so the death/respawn and Reset Game scenarios belong
there.

**Alternatives considered**: none — mandated by the constitution.

---

## Resolved Technical Context

- **Language/Version**: TypeScript 5.x (strict), React 19, Vite 6+
- **Primary Dependencies**: `@preact/signals-react`, Tailwind CSS 4 (UI
  palette only), shadcn/ui (unchanged)
- **Storage**: In-memory signals only; no `localStorage` for checkpoint state
  (session-scoped, per spec)
- **Testing**: Vitest + React Testing Library + jsdom
- **Target Platform**: Browser (static Vite build)
- **Project Type**: Single-project static web app
- **Performance Goals**: 60 fps game loop; one extra sprite draw per
  checkpoint plus one glow pass; no new dependency
- **Constraints**: No backend, no API, no sound (O-008 uncommitted); flat 2D
  pixel-art sprite; TypeScript strict with no `any`
- **Scale/Scope**: A handful of checkpoints per level; one new marker, one new
  entity module, one mapper, one logic module, one effect type
