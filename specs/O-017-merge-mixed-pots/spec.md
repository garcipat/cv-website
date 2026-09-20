# Feature Specification: Merge Pots of Different Colors

**Feature Branch**: `O-017-merge-mixed-pots`
**Created**: 2026-09-20
**Status**: Draft
**Input**: User description: "O-017 https://github.com/garcipat/cv-website/issues/56"

## Overview

[O-004](../O-004-platformer-containers/spec.md) introduced container blocks and the rule that
**adjacent coin pots render as one merged bunch**: each live tile shows one of three clay-pot
size variants, and a clay "filler" pot is drawn at every seam between tiles so a row of jars
reads as a single packed bunch rather than separate pots with visible gaps. That rule only knows
about the **coin pot**. A potion pot standing next to a coin pot renders as two unrelated
objects, and two adjacent potion pots do not merge at all.

This feature generalizes the mechanic to **pots of any kind**. A row of adjacent pots — coin pot,
potion pot, and (in a future release) bomb pot — reads as one merged bunch, with a neutral clay
filler pot at every internal seam, whatever the kinds on either side. The potion bottle keeps its
own fixed sprite inside a bunch; only the clay pots vary in size.

Behind the visible change, the pot kinds are modeled as one shared **pot** concept: breaking on a
landing, the bounce, the trigger side, removal and the merged-bunch rendering are common behavior,
while each kind contributes only its **registry key**, its **sprite**, the **pickup it drops**,
**how often it drops that pickup** (once, or on every break), whether it is **restored on
respawn**, and its **single-pot draw** function. The level marker letter that places a kind is a
separate `LevelParser`/`BlockMapper` edit, not part of the kind's declaration. Today there are two
kinds; a third (the bomb pot, O-012) must be addable without touching the shared behavior.

This is a **rendering and modeling** change only (FR-012); each pot remains its own solid tile with
its own hit and its own drop, exactly as in O-004.

## Clarifications

### Session 2026-09-20

- Q: Shared pot abstraction scope — how far does the refactor go? → A: Full shared abstraction:
  coin pot and potion pot are refactored onto one shared pot behavior; each kind contributes only
  its registry key, sprite, drop, drop policy, respawn flag and single-pot draw (its level marker
  letter is a separate `LevelParser`/`BlockMapper` edit). The bomb pot stays out of scope (O-012).
- Q: Should the shipped level place a mixed bunch? → A: No — the shipped level is left unchanged;
  potion pots stay authorable but unplaced, and the feature is proven by tests and the editor.
- Q: Clay size-variant stability across a break? → A: Stable per tile — each clay pot's size
  variant is a function of its own tile position, so a survivor keeps its size when a neighbour
  breaks. This deliberately replaces O-004's leftmost-seeded permutation, so parity (SC-006) is
  narrowed to exclude clay-size re-derivation.
- Q: Pot-kind extension point? → A: Reuse the existing block-kind registry; no new public
  registration API. SC-005's test-only kind uses the same registration path as a real kind.
- Q: Does a pot drop its pickup again when destroyed, or only the first time? → A: It is a
  property of the pot contract, and each kind's implementation decides it. The shared pot carries
  a **drop policy** (`'once'` or `'everyBreak'`); the shared behavior honors it. The coin pot is
  `'once'` (a coin is dropped only on its first destruction); the potion pot is `'everyBreak'` (a
  heart is dropped every time it is broken, i.e. once per restored life). The shared behavior
  remembers that a `'once'` pot has paid out, exactly as the slimes remember `rewardGiven`, so a
  `'once'` pot that is ever restored would still never drop a second pickup.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A Mixed Bunch Reads as One Bunch (Priority: P1)

A visitor comes across a cluster of pottery on a ledge: a clay coin pot with a potion bottle
nestled against it, packed together with a clay pot filling the seam so the two read as a single
bunch rather than two unrelated objects. The visitor lands on the coin pot. It shatters, the
character bounces, and a coin is left behind. The potion bottle beside it is untouched, and the
bunch immediately re-forms around the survivor.

**Why this priority**: This is the feature's headline — the visible change that makes different
pot kinds read as one object.

**Independent Test**: Place a coin pot directly beside a potion pot. Verify they render as one
continuous bunch with a clay filler pot centered on the seam. Land on the coin pot: verify it
breaks, a coin appears, the potion bottle is unchanged, and the remaining bottle plus filler
re-form as a smaller bunch.

**Acceptance Scenarios**:

1. **Given** a coin pot and a potion pot occupy adjacent tiles in the same row, **When** they
   render, **Then** they form one merged bunch with a clay filler pot on the seam between them.
2. **Given** that mixed bunch, **When** the character lands on the coin pot, **Then** only the
   coin pot breaks, a coin is dropped, and the potion bottle remains intact and solid.
3. **Given** the coin pot in a mixed bunch has been broken, **When** the next frame renders,
   **Then** the potion bottle is isolated (or re-merged with whatever live pot neighbours remain)
   with no stale filler at the removed pot's seam.
4. **Given** the potion bottle sits inside a bunch, **When** the bunch renders, **Then** the
   bottle shows its fixed potion sprite and is never swapped for a clay size variant.

---

### User Story 2 - Any Pot Kind Merges (Priority: P1)

A visitor finds a row of three pots in which the kinds vary along the row — a coin pot, a potion
pot, and a coin pot. The whole row reads as one bunch: every tile shows a pot, and a clay filler
sits at each of the two seams. The sizes along the bunch never repeat between two neighbouring
clay pots.

**Why this priority**: The mechanic must be kind-agnostic, not "coin pot plus one special case".
Without this the shared abstraction is not real.

**Independent Test**: Place rows mixing coin and potion pots in several orders, including two
potion pots adjacent. Verify each row renders as one bunch with a filler at every internal seam
and no two adjacent clay pots share a size.

**Acceptance Scenarios**:

1. **Given** a row of adjacent pots of any kinds, **When** it renders, **Then** it forms one bunch
   with a clay filler at every internal seam.
2. **Given** two potion pots are adjacent, **When** they render, **Then** they merge with a clay
   filler on the seam and neither bottle is replaced by a clay variant.
3. **Given** any bunch, **When** it renders, **Then** no two neighbouring clay pots (base or
   filler) share a size variant.
4. **Given** a pot with no live pot neighbour in its row, **When** it renders, **Then** it draws as
   a single isolated pot.

---

### User Story 3 - A New Pot Kind Drops In (Priority: P2)

A maintainer adds the bomb pot from O-012. They write the kind's own module — its registry key,
its sprite, the bomb it drops, its drop policy, its respawn flag and its single-pot draw — add its
level marker letter to `LevelParser.ts`/`BlockMapper.ts`, and register it. Breaking, bouncing, trigger sides and bunch
merging all work already; no shared rendering or physics code is edited, and a bomb pot placed next
to a coin pot merges into the bunch with a clay filler between them.

**Why this priority**: This is the issue's architectural goal. It does not change what a visitor
sees today, but it is what keeps the two existing kinds from being the ceiling of the mechanic.

**Independent Test**: Add a test-only pot kind through the same extension points a real kind uses,
place it in a row with coin and potion pots, and verify it merges, breaks and drops exactly like
the built-in kinds without editing shared code.

**Acceptance Scenarios**:

1. **Given** a new pot kind is registered with only its registry key, sprite, drop, drop policy,
   respawn flag and single-pot draw declared (its level marker letter added to
   `LevelParser.ts`/`BlockMapper.ts`), **When** it is placed, **Then** it breaks on a landing,
   bounces the character, and drops its pickup with no shared-code change.
2. **Given** a new pot kind is placed adjacent to an existing pot kind, **When** the row renders,
   **Then** the two merge into one bunch with a clay filler on the seam.

---

### User Story 4 - A Mixed Bunch Across a Respawn (Priority: P2)

A visitor breaks the coin pot half of a mixed bunch, leaves the coin behind, and then dies. On
respawn, the potion pot is standing again, the coin pot is still broken, and the restored potion
bottle re-forms a bunch with whatever live pots remain around it. The uncollected heart from an
earlier potion pot is gone.

**Why this priority**: The potion pot's existing respawn exception has to keep working when its
neighbours are other pot kinds.

**Independent Test**: Build a mixed bunch, break the coin pot, break the potion pot and leave its
heart, die, respawn. Verify the potion pot is intact, the coin pot is still broken, the heart is
gone, and the bunch rendering reflects the restored potion pot.

**Acceptance Scenarios**:

1. **Given** a mixed bunch in which a potion pot was broken, **When** the character respawns,
   **Then** the potion pot is restored to intact.
2. **Given** a coin pot in that bunch was broken, **When** the character respawns, **Then** it
   remains broken.
3. **Given** a potion pot is restored beside a still-broken pot, **When** the level renders,
   **Then** the restored bottle is isolated rather than re-merging across the gap.
4. **Given** the restored potion pot, **When** the character lands on it again, **Then** it breaks
   and drops a fresh heart (its `'everyBreak'` drop policy), while a `'once'` pot such as the coin
   pot never drops a second pickup.

---

### User Story 5 - The Editor Previews Mixed Bunches (Priority: P3)

A level author paints a coin pot and a potion pot next to each other in the editor. The editor
canvas previews them as one merged bunch with a clay filler on the seam, exactly as the game will
render them.

**Why this priority**: The editor is how levels get built; a preview that disagrees with the game
is misleading, but the game experience is the priority.

**Independent Test**: Paint a mixed row in the editor and compare the canvas preview with the same
row played in the game.

**Acceptance Scenarios**:

1. **Given** a mixed row of pots is painted in the editor, **When** the canvas renders, **Then**
   it merges them into one bunch exactly as the game does.

---

### Edge Cases

- ✅ **A potion bottle at either end of a bunch**: the bottle shows its fixed sprite at the end
  tile; the clay alternation continues along the remaining clay slots, with a filler still drawn
  on the bottle/clay seam (per US1 scenario 1).
- ✅ **Two potion bottles adjacent**: a clay filler merges the seam; neither bottle is replaced.
- ✅ **Breaking the middle of a mixed run**: the survivors stop reading as one bunch if they are no
  longer adjacent, and re-form if they still are; any surviving clay pot keeps its size variant
  (per-tile stability, FR-010).
- ✅ **Breaking a pot mid-animation**: the hit pot drops out of the bunch immediately (before its
  break animation finishes), so neighbours re-form on the next frame while keeping their own size
  variants.
- ✅ **A restored potion pot beside a broken coin pot**: the gap between them means no filler is
  drawn; the restored bottle renders isolated.
- ✅ **A very long mixed run**: the clay-size alternation continues with no two neighbouring clay
  pots repeating a size, however long the run.
- ✅ **A bunch of exactly one potion bottle**: renders as a lone bottle, no filler.
- ✅ **A pickup dropped above a gap**: the pickup appears at the pot's own position, as in O-004.

## Requirements _(mandatory)_

### Functional Requirements

#### Shared pot behavior

- **FR-001**: All pot kinds MUST share one common behavior definition covering: solid tile
  collision, break only when landed on from above, the upward bounce, single-hit destruction,
  removal, the shared destruction effect, and merged-bunch rendering.
- **FR-002**: Each pot kind MUST contribute only its registry key, its sprite, the pickup it
  drops, its drop policy (whether that pickup drops once or on every break), whether it is
  restored on respawn, and its single-pot draw function; no pot kind may need its own copy of the
  break, bounce, trigger or merge logic. The level marker letter that places the kind is a
  separate `LevelParser.ts`/`BlockMapper.ts` edit, not part of the kind's declaration.
- **FR-003**: Registering a new pot kind MUST NOT require changes to the shared pot behavior or the
  bunch-rendering logic, and MUST use the existing block-kind registration path; no new public
  registration API is introduced.
- **FR-004**: A pot kind placed next to any other pot kind MUST merge into the same bunch,
  including a future bomb pot, with no merge-specific code added for that kind.

#### Mixed-kind bunch rendering

- **FR-005**: Two or more pot blocks occupying adjacent tiles in the same row (no gap) MUST render
  as one merged bunch, regardless of their individual pot kinds.
- **FR-006**: A clay filler pot MUST be drawn at every internal seam of a bunch, including seams
  between two different pot kinds.
- **FR-007**: Filler pots MUST reuse the existing three clay-pot size variants.
- **FR-008**: A potion pot MUST always render its own fixed bottle sprite inside a bunch; it MUST
  NOT be replaced by a clay size variant.
- **FR-009**: No two neighbouring rendered clay pots (base tile or filler) MUST share a size
  variant, for a bunch of any length, under the per-tile positional assignment of FR-010.
- **FR-010**: A bunch's membership MUST be derived fresh every frame from the pots still live, so
  breaking any pot immediately re-forms the bunches around it. A clay pot's size variant MUST be a
  deterministic function of its own tile position alone (and a filler's of its own seam position),
  so a surviving clay pot keeps its size when a neighbour breaks or a bunch re-forms.
- **FR-011**: A pot with no live pot neighbour in its row MUST render as a single isolated pot.
- **FR-012**: Merging MUST be a rendering concern only: each pot MUST remain its own solid tile
  with its own hit and its own drop.

#### Unchanged pot behavior

- **FR-013**: A coin pot MUST still always drop one coin, a potion pot MUST still always drop one
  heart, and each MUST still break on a single landing with the same bounce.
- **FR-014**: The potion pot MUST remain the only pot kind restored to intact on a respawn, and a
  respawn MUST still remove every uncollected heart.
- **FR-015**: Every other pot kind MUST remain in whatever state it was in across a respawn, and
  any coin already dropped MUST remain collectible.

#### Editor

- **FR-016**: The level editor's canvas preview MUST merge mixed-kind pot bunches exactly as the
  running game does.

#### Drop policy

- **FR-017**: The shared pot behavior MUST honor each kind's drop policy against a per-instance
  "has paid out" flag, exactly as the slimes track `rewardGiven`. A `'once'` pot MUST drop its
  pickup only while it has not yet paid out, and MUST be marked paid-out once it does, so it never
  drops a second pickup even if it is later restored; an `'everyBreak'` pot MUST drop its pickup on
  every destruction regardless of the flag. The coin pot's policy is `'once'`; the potion pot's is
  `'everyBreak'`, so a potion pot restored on respawn drops a fresh heart when it is broken again.

### Key Entities

- **Pot** — the shared concept behind coin pots, potion pots and future pot kinds. A solid
  tile-aligned block broken by being landed on, bouncing the character and leaving a pickup.
  Renders as part of a merged bunch when it has live pot neighbours.
- **Pot kind** — a concrete pot: its registry key, its sprite, the pickup it drops, its drop
  policy (`'once'` or `'everyBreak'`), whether it is restored on respawn, and its single-pot draw.
  Its level marker letter is declared separately in `LevelParser.ts`/`BlockMapper.ts`. Coin pot
  (drops a coin once, not restored), potion pot (drops a heart on every break, restored on
  respawn), bomb pot (future, O-012).
- **Bunch** (implemented as a run, `PotRun`) — a maximal run of adjacent live pots in one row,
  rendered as one merged object. Derived fresh each frame from the live pot list.
- **Filler pot** — a neutral clay pot drawn on an internal seam of a bunch so no gap shows. Always
  one of the three clay size variants, whatever the kinds on either side.
- **Clay size variant** — one of the three existing clay-pot sprites (small round jar, tall narrow
  urn, wide square urn). Only clay pots — base or filler — use these.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Mixed merge**: For any row of adjacent pots of any kinds, the row renders as one
  bunch with a clay filler at every internal seam. Verified by automated tests over mixed-kind
  orders.
- **SC-002 — Clay alternation**: In any bunch, no two neighbouring clay pots (base or filler)
  share a size variant, for runs of any length. Verified by automated tests.
- **SC-003 — Bottle preserved**: A potion bottle always renders its fixed sprite inside a bunch
  and is never replaced by a clay variant.
- **SC-004 — Live re-forming**: Breaking any pot re-forms the bunches around it on the next
  rendered frame; a pot with no live pot neighbour renders isolated.
- **SC-005 — Extensibility**: A test-only pot kind registered through the existing block-kind
  registration path (the same path a real kind uses) merges, breaks and drops with no edit to
  shared pot or merge code. Verified by an automated test.
- **SC-006 — Behavior parity**: Every existing coin-pot and potion-pot behavior (drop, bounce,
  trigger side, removal, respawn) is unchanged. Clay size-variant assignment is intentionally
  excluded from parity: it changes from O-004's leftmost-seeded permutation to the per-tile
  positional rule of FR-010, and the affected O-004 render-plan tests are updated to the new rule
  rather than required to pass unchanged.
- **SC-007 — Editor parity**: A mixed bunch painted in the editor previews identically to the same
  row in the game.
- **SC-008 — Variant stability**: A clay pot's rendered size variant depends only on its own tile
  position, so a surviving clay pot keeps its size when a neighbour breaks or a bunch re-forms.
  Verified by an automated test.
- **SC-009 — Drop policy**: A `'once'` pot (coin pot) drops its pickup exactly once and never
  again, even across a respawn; an `'everyBreak'` pot (potion pot) drops its pickup on every
  destruction, including after being restored on respawn. Verified by automated tests.

## Assumptions

- **[O-004](../O-004-platformer-containers/spec.md) (Container Blocks) is complete**: coin pot and
  potion pot exist as block kinds, the land-on-top trigger, bounce, drop and respawn rules are in
  place, and the coin-pot merge plan already computes runs, variants and fillers per frame.
- **The bomb pot is out of scope**: O-012 (Bombs) delivers the bomb pot itself. This feature only
  makes the pot concept generic enough that it drops in.
- **The shared pot abstraction is part of this feature**: confirmed in clarification
  (2026-09-20). Pot kinds share one behavior and differ only in registry key, sprite, drop, drop
  policy, respawn flag and single-pot draw. The coin pot and potion pot are refactored onto that
  shared concept, keeping their visible behavior identical. The bomb pot is not part of this
  refactor and remains deferred to O-012.
- **Rendering and modeling only**: as in O-004, merging changes appearance alone; each pot stays
  its own solid tile with its own hit and drop.
- **Variant assignment changes from O-004**: the leftmost-seeded permutation walk is replaced by
  per-tile positional assignment (FR-010). This is the one intentional visible-behavior difference
  and is explicitly excluded from the parity requirement (SC-006).
- **The shipped level is not modified**: confirmed in clarification (2026-09-20). Potion pots
  remain authorable but unplaced, consistent with O-004. This feature makes a mixed bunch merge
  wherever an author places one; whether to place one in the shipped level is a separate
  level-design decision.
- **Drop frequency is a per-kind contract property**: the shared pot carries a drop policy that
  the kind's implementation decides (confirmed in clarification, 2026-09-20). Coin pots are
  `'once'`, potion pots are `'everyBreak'`. The shared behavior gates a `'once'` drop on a
  per-instance "has paid out" flag carried on the block's live state (the same pattern the slimes
  use for `rewardGiven`, which survives death/respawn and is cleared only by Reset Game), so a
  future restored kind (e.g. the bomb pot) can choose either without changing shared behavior.
- **Marker letters are unchanged**: the existing `u` (coin pot) and `p` (potion pot) characters
  continue to place their kinds; no new level character is needed for this feature.
- **Only same-row adjacency merges**: as in O-004, runs are horizontal within one row; vertical or
  diagonal arrangements do not merge.
- **Pots do not merge with non-pot blocks**: a pot beside a crate, question-mark, fragile rock or
  terrain does not form a bunch.
- **The clay size variants are sufficient**: the three existing clay-pot sprites are the only
  filler/base clay art; no new pot art is introduced.
- **The potion bottle is exempt from size alternation**: it shows its fixed sprite; the clay
  variants alternate around it.

## Out of Scope

- The bomb pot and any other new pot kind (O-012, Bombs).
- Changing what any pot drops, its trigger side, its bounce strength, or its respawn rule.
- Merging pots with non-pot blocks, or across rows or diagonally.
- Any new clay-pot art or additional size variants.
- Generalizing bunch merging to non-pot blocks.
- Deciding where (or whether) to place potion pots or a mixed bunch in the shipped level.
