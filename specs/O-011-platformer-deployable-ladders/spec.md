# Feature Specification: Platformer Deployable Ladders

**Feature Branch**: `O-011-platformer-deployable-ladders`
**Feature ID**: O-011
**Created**: 2026-09-19
**Status**: Draft
**Input**: User description: "A curled-up ladder bundle the player can press Up to deploy — it unrolls downward until it lands on the next solid tile, then behaves as a normal climbable ladder for the rest of the run."

## Clarifications

### Session 2026-09-19

- Q: When can the visitor deploy a bundle? → A: Only while grounded, occupying the bundle's own cell or the cell directly above it, and pressing Up.
- Q: How does the rolled bundle behave physically? → A: Standable from above only (like a ladder's top rung) — otherwise non-solid and not climbable.
- Q: Which cells become the climbable ladder once deployed? → A: The bundle cell itself becomes the shaft's top rung; every empty cell below it, down to the first solid tile (or the level's bottom), becomes a rung.
- Q: What if there is no space below the bundle? → A: It still completes the unroll with zero rungs, its sprite changes to the deployed top-rung state, and the bundle cell becomes a lone climbable/standable rung.
- Q: How long does a deployed ladder stay deployed? → A: It survives a death/respawn; it re-rolls only when the visitor clicks Reset Game.
- Q: Should the level editor preview where a ladder will land? → A: Yes — a faint landing marker, shown in the editor only.
- Q: Does the unroll stop at a `bridge`? → A: Yes — a bridge counts as solid, so the unroll lands on top of it rather than passing through.
- Q: How is the step-by-step unroll timed? → A: A fixed short reveal of about half a second regardless of shaft length; a longer shaft reveals faster per step rather than taking proportionally longer.
- Q: Does deployment survive switching themes? → A: It shares the lifetime of the game's other session state (blocks, chests) — surviving a death/respawn, and cleared by Reset Game, the editor's Try, and the theme-switch remount (and a page reload).
- Q: What level character places a bundle? → A: `@` — unused by every existing level map; documented in `LevelFormat.md`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Deploy a Curled-up Ladder Bundle (Priority: P1)

A level author places a curled-up rope-ladder bundle where a shaft would be useful. The visitor stands on top of it, or stands on the ground in the same cell it occupies, and presses Up. The bundle unrolls downward — a short, visible reveal that fills the column beneath it — until its lowest rung lands on the first solid ground below, or the level's bottom, whichever comes first. From that moment the column is an ordinary climbable ladder for the rest of the run.

The bundle is a placement-flexibility tool: it can hang where a ladder's top tile would go, or sit at the visitor's own height, and it reaches whatever solid ground is below without the author having to know the shaft's length in advance. Deployment fabricates the shaft — no existing climbable tile is needed beneath it.

**Why this priority**: This is the feature. Without the deploy there is no bundle, no shaft, and nothing for climbing or authoring to build on.

**Independent Test**: Place a bundle above a drop with solid ground below, stand on it, press Up, and observe the rope ladder unroll downward until it reaches the ground and then be climbable.

**Acceptance Scenarios**:

1. **Given** a rolled bundle with empty space below it and solid ground further down, **When** the visitor is grounded on top of the bundle or in the bundle's own cell and presses Up, **Then** the ladder unrolls downward and stops at the first solid tile below.
2. **Given** a rolled bundle in a column with no solid tile beneath it before the level's bottom, **When** it is deployed, **Then** the ladder unrolls all the way to the level's bottom and stops there.
3. **Given** a rolled bundle with a solid tile directly beneath it (or sitting on the level's floor), **When** it is deployed, **Then** the unroll completes with zero rungs, the bundle's sprite changes to its deployed top-rung appearance, and the bundle cell becomes a lone climbable rung.
4. **Given** a bundle that has already been deployed, **When** the visitor presses Up on it again, **Then** nothing further happens — it stays deployed and is not re-deployed.
5. **Given** the visitor is not grounded, or is grounded but not in the bundle's cell or the cell directly above it, **When** the visitor presses Up, **Then** the bundle does not deploy.

---

### User Story 2 - Climb the Deployed Ladder (Priority: P1)

Once the ladder has landed, every cell it filled — including the bundle cell at the top — is climbable exactly like an authored `ladder` or `chain`. The visitor can ascend and descend it, hang in place, shimmy sideways off it, jump off it, and stand on its topmost rung when nothing sits above that rung. While the ladder is still unrolling it is not yet climbable, so the visitor cannot ride a half-formed shaft.

**Why this priority**: A deployed ladder that could not be climbed would be useless. This is the payoff of User Story 1 and the reason the feature reuses the existing climbing behavior rather than inventing a second movement mode.

**Independent Test**: Deploy a ladder, then run every existing ladder-climbing interaction against it — climb up, climb down, hang, walk off the side, jump off, and stand on its top rung — and confirm each behaves as it does on an authored ladder.

**Acceptance Scenarios**:

1. **Given** a deployed ladder, **When** the visitor climbs it in either direction, **Then** it behaves exactly like an authored ladder — fixed climb speed, gravity suspended, horizontal movement unchanged, jump cancels into an ordinary jump.
2. **Given** a deployed ladder whose topmost rung has nothing solid or climbable directly above it, **When** the visitor climbs to the top, **Then** the climb ends with the visitor standing on that rung.
3. **Given** a ladder is mid-unroll, **When** the visitor overlaps the partially-filled column, **Then** the partial rungs are not climbable and the visitor passes through them as if they were air.
4. **Given** a bundle whose cell has solid or climbable terrain directly above it, **When** the visitor climbs the deployed shaft, **Then** the bundle cell is not standable — the visitor climbs until its feet leave the ladder and then falls, exactly as with an authored shaft whose top is blocked.

---

### User Story 3 - Deployment Is Permanent and One-Way (Priority: P2)

Once the unroll begins it always finishes, and once it finishes it stays finished. The visitor cannot cancel a deploy partway, cannot roll a deployed ladder back up, and cannot un-deploy it. A deployed ladder is progress, not a transient effect: it survives the visitor's death and respawn, and only the deliberate Reset Game action rolls the bundle back up.

**Why this priority**: The permanence rule is what makes a deployed ladder safe to rely on for traversal — the visitor is never stranded because a ladder retracted. It is P2 because the basic deploy-and-climb loop is already useful without a settled reset story.

**Independent Test**: Deploy a ladder, die, respawn, and confirm it is still deployed; then click Reset Game and confirm the bundle is rolled up again.

**Acceptance Scenarios**:

1. **Given** a ladder is mid-unroll, **When** the visitor moves away or presses any key, **Then** the unroll continues uninterrupted and still lands.
2. **Given** a deployed ladder, **When** the visitor dies and respawns, **Then** the ladder is still deployed and climbable.
3. **Given** a deployed ladder, **When** the visitor clicks Reset Game, **Then** the bundle returns to its rolled state and the fabricated shaft is gone.
4. **Given** several bundles in a level, **When** one is deployed, **Then** the others are unaffected and remain rolled until their own triggers are met.

---

### User Story 4 - Author Bundles with a Landing Preview (Priority: P3)

In the level editor a bundle appears as a palette tile with its own glyph and description, paintable like any other tile. To help authors place one confidently, the editor draws a translucent preview of the fully-deployed ladder below the curled bundle — every step down to the lowest rung — so the author sees the shaft's reach before ever running the level. The preview is an authoring aid only — it never appears during play.

**Why this priority**: The gameplay works without it, but a bundle's whole value is reaching the ground below, and without a preview the author is guessing at the drop. It is P3 because it is an editor convenience rather than a player-facing behavior.

**Independent Test**: In the editor, paint a bundle above a shaft and confirm a translucent ladder preview appears below it, reaching the first solid cell below, then remove the solid tile and confirm the preview extends to the level's bottom.

**Acceptance Scenarios**:

1. **Given** the level editor, **When** the author selects the bundle tile, **Then** it appears in the palette with a readable label and description of what it does.
2. **Given** a bundle painted in the editor with solid ground below it, **When** the canvas draws, **Then** a translucent preview of the deployed ladder is drawn below the bundle, reaching the lowest rung above that ground.
3. **Given** a bundle with no solid ground below it before the level's bottom, **When** the canvas draws, **Then** the preview reaches the level's bottom cell.
4. **Given** a bundle with a solid tile directly beneath it, **When** the canvas draws, **Then** the preview is a zero-length ladder on the bundle's own cell.
5. **Given** a level being played, **When** the bundle renders in game, **Then** no ladder preview is drawn — only the bundle and any deployed shaft.

---

### User Story 5 - The Rope Ladder Reads Distinctly from Ladder and Chain (Priority: P3)

A bundle and its deployed shaft are drawn as a rope ladder — a rolled bundle that unrolls into vertical rope-and-rung segments — visually distinct from both the wooden `ladder` and the `chain`. As the ladder unrolls, the bundle keeps its rolled appearance while the rope segments appear progressively down the column; when the unroll completes, the bundle cell's sprite changes to its deployed top-rung appearance.

**Why this priority**: Pure readability. The feature is playable with any placeholder art, but a rope ladder that looked identical to a wooden ladder would make the deployed shaft indistinguishable from authored terrain.

**Independent Test**: Place a bundle and an authored ladder side by side, deploy the bundle, and confirm the two shafts are visually distinguishable at a glance.

**Acceptance Scenarios**:

1. **Given** a rolled bundle in play, **When** it renders, **Then** it shows the rolled bundle sprite.
2. **Given** a bundle mid-unroll, **When** it renders, **Then** the bundle keeps its rolled sprite while the rope-ladder segments appear progressively from the top down.
3. **Given** a completed unroll, **When** the bundle cell renders, **Then** it shows the shaft's top rung (the top cap) rather than the rolled bundle, and the steps below sit at the same rows they did during the unroll.
4. **Given** a deployed rope ladder beside an authored wooden ladder and an authored chain, **When** both render, **Then** the three are visually distinguishable.
5. **Given** the rope ladder's frames and states, **When** the art is produced, **Then** they come from a single sprite sheet sharing one style, dimensions, and palette.

---

### Edge Cases

- **A bundle at the level's bottom row**: there are no cells below it, so the unroll completes with zero rungs and the bundle cell becomes a lone rung — the same outcome as a bundle resting on solid ground.
- **A bundle with a solid ceiling directly above it**: the bundle cell is not a standable top after deploy, so climbing ends by the feet leaving the ladder and the visitor falls, matching the authored-ladder rule.
- **A bundle placed over existing non-solid terrain** (decorations or another climbable tile): only solid terrain stops the unroll, so the fabricated rungs fill the empty cells and may overlap those non-solid tiles without changing their behavior. A `bridge` is solid, so it stops the unroll instead.
- **A bundle placed over an existing authored ladder or chain**: the deployed rope rungs and the authored climbable tiles overlap and both are climbable, so the shaft still climbs continuously.
- **Up is also the climb, chest, bridge-drop, and hint key**: a rolled bundle whose trigger conditions are met takes the Up press; in every other situation Up behaves exactly as it does today.
- **The visitor stands on top of the bundle when it deploys**: the bundle cell remains standable from above throughout the unroll, so the visitor keeps standing rather than falling.
- **The game is paused mid-unroll**: the unroll holds its progress and resumes when play resumes.
- **Two bundles in the same column**: each deploys independently from its own cell; neither affects the other's state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The bundle MUST be a terrain tile that level authors can place in a level layout, with a palette entry, a readable label, and a description of its behavior.
- **FR-002**: A rolled bundle MUST be standable from above only — it supports a character standing on its top edge, is otherwise non-solid, and is not climbable.
- **FR-003**: The bundle MUST deploy when the character is grounded, occupies the bundle's own cell or the cell directly above it, and the visitor presses Up.
- **FR-004**: Deploying MUST play a short, visible unroll animation that reveals the ladder from the bundle cell downward. The reveal MUST take a fixed time of about half a second regardless of the shaft's length — a longer shaft reveals faster per step rather than taking proportionally longer.
- **FR-005**: The unroll MUST fill the bundle's own cell and every empty cell below it, stopping at the first solid tile below or the level's bottom, whichever comes first. A `bridge` counts as solid here — the unroll lands on top of one rather than passing through it.
- **FR-006**: On completion, the bundle cell and every cell the unroll filled MUST behave exactly like an authored `ladder`/`chain` in every respect — entering and leaving the climb, fixed climb speed, gravity suspension, horizontal movement, jump cancel, and the standable-top rule.
- **FR-007**: While an unroll is in progress, the partially-filled column MUST NOT be climbable; the character passes through the unfilled and partially-filled cells as if they were air.
- **FR-009**: The bundle cell MUST remain standable from above throughout the unroll, so a character standing on the bundle when it deploys does not fall.
- **FR-010**: When a bundle has no empty cell below it, the unroll MUST still complete with zero rungs, the bundle's sprite MUST change to its deployed top-rung appearance, and the bundle cell MUST become a lone climbable rung.
- **FR-011**: Deployment MUST be one-way: an unroll in progress cannot be cancelled, and a deployed ladder cannot be rolled back up or un-deployed.
- **FR-012**: Each bundle MUST carry its own deployment state; deploying one bundle MUST NOT affect any other bundle.
- **FR-013**: A deployed ladder MUST share the lifetime of the game's other session state (blocks, chests) — surviving the character's death and respawn, and rolled back to its bundle by Reset Game, the editor's Try, and the theme-switch remount (and a page reload).
- **FR-014**: While unrolling, the bundle MUST keep its rolled appearance in its own cell while the rope-ladder steps appear progressively below it. When the unroll completes, the bundle cell MUST become the shaft's top rung (the top cap plus a step), with the steps below at exactly the rows the unroll revealed them at, so nothing shifts.
- **FR-015**: The bundle and its deployed shaft MUST be drawn as a rope ladder visually distinct from the wooden `ladder` and the `chain`, from a single sprite sheet sharing one style, dimensions, and palette. The deployed shaft MUST be built from a repeatable half-tile **step** (16×8) carrying one wooden rung cord-lashed to the side ropes, so a 16px tile is two stacked steps and the unroll reveals the shaft one step at a time. See the sprite sheet note below.
- **FR-016**: The level editor MUST draw a translucent preview of the fully-deployed shaft below each bundle — the ladder's steps from the bundle down to its lowest rung — so an author sees how far it will reach, alongside the opaque curled bundle. This preview MUST NOT render during play.
- **FR-017**: When a rolled bundle's deploy conditions are met, the Up press MUST deploy it rather than performing any other Up behavior.

### Key Entities

- **Bundle**: a placeable terrain tile in its rolled state. Standable from above only, otherwise non-solid, not climbable, and the trigger and top rung for a future shaft.
- **Deployment state**: the per-bundle runtime state — rolled, unrolling (with progress), or deployed — tracked for each bundle cell. Tiles themselves carry no state, so this lives in the running game alongside the existing per-instance state.
- **Deployed shaft**: the bundle cell plus every filled cell below it, treated as climbable for the rest of the run. Its length is decided at deploy time by the first solid tile below, not by the author.

How tiles are declared, classified, and drawn — and how a tile's runtime override is resolved — is code knowledge and lives in [`docs/themes/platformer/Terrain.md`](../../docs/themes/platformer/Terrain.md). The level character that places a bundle is listed in [`docs/themes/platformer/LevelFormat.md`](../../docs/themes/platformer/LevelFormat.md).

### Sprite sheet

The art is one sheet, `public/sprites/rope_ladder.png`, 32×32:

| Region | Size | Contents |
|---|---|---|
| (0,0) | 16×16 | Rolled bundle — rope hank bound by two cinching straps, wooden rung ends poking out |
| (16,0) | 16×8 | Top cap — frayed rope ends |
| (16,8) | 16×8 | **Step** — one wooden rung cord-lashed (X) to the side ropes; the repeat unit |
| (16,16) | 16×8 | Step — same unit |
| (16,24) | 16×8 | Bottom cap — rung and knotted rope ends |

A 16px tile is two stacked 8px steps, so rungs stay evenly spaced at any shaft length, and the unroll animation reveals the shaft one step at a time. The rungs are wooden, tied to the rope sides with a cord X; the sheet is hand-authored flat 2D pixel art, not derived from a larger image.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 — Bundles reach the ground**: from any rolled bundle with open space below, deploying produces a shaft whose lowest rung rests on the first solid tile below (or the level's bottom).
- **SC-002 — Deployed shafts are indistinguishable in behavior**: every scenario in the ladders feature produces the same result on a deployed shaft as on an authored ladder shaft.
- **SC-003 — Deployment never traps**: from any point before, during, or after a deploy, the visitor can always leave the bundle or shaft using ordinary movement.
- **SC-004 — The unroll is visible**: a deploy is observably animated end-to-end and completes in about half a second, whether the shaft is one tile or twenty.
- **SC-005 — Zero-length bundles still work**: a bundle with no space below still deploys into a lone usable rung rather than failing.
- **SC-006 — Authors can predict landings**: in the editor, a bundle's landing cell is visible before the level is played.

## Assumptions

- **[S-008](../S-008-platformer-ladders/spec.md) is complete**: climbable terrain, the climb state, the standable shaft top, and vertical camera follow all exist. O-011 adds a bundle whose deployed cells become climbable through the same behavior, plus a per-bundle runtime state.
- **Up is the shared interact key**: Up already climbs, opens chests, drops through bridges, and reveals hints. A rolled bundle's deploy takes precedence only when its own trigger conditions are met.
- **Level authors place bundles deliberately**: nothing validates that a bundle reaches useful ground or leads anywhere. A bundle that lands on a one-tile ledge, or that overlaps authored terrain, is a level-design choice rather than an error the game reports.
- **Session-scoped**: deployment state shares the lifetime of the game's other session state (blocks, chests) — it survives a death/respawn and is cleared by Reset Game, the editor's Try, and the theme-switch remount (and a page reload).
- **The bundle is a single interactable, not a framework**: the runtime state this feature needs is deliberately scoped to bundles rather than introduced as a general per-tile animation system. A later feature that needs the same mechanism reuses this one.

## Out of Scope

- Rolling a deployed ladder back up, or un-deploying it by any means other than Reset Game
- Cancelling an unroll once it has started
- Deploying a ladder upward, sideways, or to a chosen length
- A general per-tile animation or state framework beyond the bundle's own deployment state
- Bundles that are solid walls, or that block movement in any direction
- Bundles that deploy automatically on contact, without an Up press
- Sound effects for deploying or climbing — see [O-008](../O-008-platformer-audio/spec.md)
- Extending, shortening, or re-deploying a shaft that is already deployed
