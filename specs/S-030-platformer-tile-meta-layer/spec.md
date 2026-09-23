# Feature Specification: Platformer Tile Meta Layer

**Feature Branch**: `S-030-platformer-tile-meta-layer`
**Created**: 2026-09-23
**Status**: Draft
**Input**: Issue [#47](https://github.com/garcipat/cv-website/issues/47) — a level cell holds exactly one tile kind, so painting an invisible, editor-only marker onto a cell replaces whatever terrain was there. A dedicated tile meta layer, independent of the terrain layer, lets a marker and a tile occupy the same cell. The same layer then carries the per-cell content that layout characters used to encode: a sign's hint and whether a stalactite falls.

## Clarifications

### Session 2026-09-23

- Q: Can a marker share a cell with an entity, sign or hazard marker (which also occupy foreground cells)? → A: Yes — the tile meta layer is orthogonal to all foreground content.
- Q: Does painting a marker past the canvas edge grow the canvas? → A: No — markers can only be placed within the existing canvas extent.
- Q: Which term is canonical for the layer? → A: "Tile meta layer" (individual entries remain "markers").
- Q: What should a meta-layer value hold? → A: A typed discriminated union; each marker kind declares its own value shape.
- Q: What should a sign's metadata hold? → A: The `hintId` key, resolved through the active locale at runtime — never literal translated text.
- Q: How is the falling stalactite modeled? → A: A presence-only `fallingStalactite` marker on the `⊤` tile; the separate `T` hazard character is removed.
- Q: How is a sign represented? → A: One `T` layout character for every sign, plus `{ hintId }` metadata.
- Q: How does the author set the hint and choose falling vs decorative? → A: Keep the palette tools and the sign re-click cycle; no inspector.
- Q: How is the metadata shown in the editor? → A: A corner badge on signs showing a short hint code, the falling stalactite's existing red tint, and a hover tooltip naming the marker and its value.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Mark a room's border without punching a hole (Priority: P1)

A developer authoring a blueprint paints a connection point onto a cell of the room's border. That cell is a wall. Today the marker replaces the wall, leaving an invisible, non-solid gap the game will happily let the player walk through. After this feature the wall is untouched: the canvas shows the wall with the connection-point glyph over it, and the running game treats the cell as the solid wall it always was. Erasing the marker gives the wall back with nothing else changed.

**Why this priority**: This is the problem the feature exists to solve. A room that can only be marked by destroying its own border is a room that cannot safely ship a marker.

**Independent Test**: On the blueprint canvas, paint a wall cell and a connection point on it, stamp the room into a level, play it and confirm the cell blocks the player and renders as a wall, then erase the marker and confirm the wall is still there.

**Acceptance Scenarios**:

1. **Given** a cell holding a solid tile, **When** the developer paints a marker onto it, **Then** the cell keeps its tile and now also carries the marker.
2. **Given** a cell carrying both a tile and a marker, **When** the level is played, **Then** the tile behaves exactly as it would unmarked — solid stays solid, empty stays empty — and the marker renders nothing and collides with nothing.
3. **Given** a cell carrying both, **When** the developer erases the marker, **Then** the tile is left exactly as it was and the cell is no longer marked.
4. **Given** a cell carrying both, **When** the developer paints a different tile over the cell, **Then** the tile is replaced and the marker stays.

---

### User Story 2 - Save, reload and stamp rooms with their markers (Priority: P1)

Markers are part of what a level and a blueprint *are*, not a transient editor decoration. A blueprint saved with connection points on its border reopens with them, and stamping that room into a level carries its markers across. A level saved with patrol boundaries reopens with them and plays identically. Levels and blueprints authored before this feature — which store markers inside the terrain layout — keep loading with their markers intact and their terrain unchanged.

**Why this priority**: A layer that does not survive save, reload and placement is not part of the format; and a format change that breaks every existing level and blueprint is not shippable.

**Independent Test**: Save a blueprint with a marker on a wall, reload it, stamp it into a level, save the level, reload it, and play it — the wall is solid at the marked cell and the marker is still shown in the editor.

**Acceptance Scenarios**:

1. **Given** a blueprint whose border carries markers, **When** it is saved and reopened, **Then** every marker is back on the same cell as before.
2. **Given** a blueprint with markers, **When** it is stamped into a level, **Then** its markers are written into the level's tile meta layer at the placement's position.
3. **Given** a level carrying markers, **When** it is saved and reopened, **Then** the markers are unchanged.
4. **Given** a level or blueprint saved before this feature, **When** it is loaded, **Then** any marker characters stored in its terrain layout are still present as markers and the terrain is otherwise unchanged.
5. **Given** a marker sitting on a cell that holds no terrain, **When** the room or level is saved, **Then** the marker is still part of the saved content rather than cropped away.

---

### User Story 3 - Bound a patrol without losing the terrain (Priority: P2)

A developer paints a patrol boundary on a cell that also holds terrain, so the boundary can sit exactly where an enemy should turn without carving the ground out from under it. An enemy still reverses when its leading edge reaches the boundary, the player still passes through it, and the terrain under it is untouched.

**Why this priority**: It is the same defect as the connection point, ranked lower because a patrol boundary is almost always painted over open air — so the loss is rare in practice, not because the loss is acceptable.

**Independent Test**: Paint a solid tile, paint a patrol boundary on it, run a level with an enemy patrolling toward it, and confirm the enemy turns at exactly the marked cell while the player still walks through it.

**Acceptance Scenarios**:

1. **Given** a cell holding a solid tile and a patrol boundary, **When** an enemy reaches the marked cell, **Then** it reverses exactly as it would at an unmarked boundary.
2. **Given** the same cell, **When** the player moves through it, **Then** the player is blocked or passes according to the tile alone, never the marker.

---

### User Story 4 - A sign shows its hint without needing its own character (Priority: P2)

A developer places a sign. Every sign is now the same `T` in the layout; which hint it shows lives in the tile meta layer. The editor badges the sign's corner with the hint's short code and shows the hint's own text on hover, so the author can still tell signs apart at a glance. In the game the sign shows the same translated hint it always did. A level authored before this feature, whose signs are `1`–`6`, loads unchanged.

**Why this priority**: The sign hint is the clearest proof that the layer carries real per-cell content, not just invisible markers; it also removes the artificial ceiling of nine distinct hints.

**Independent Test**: Place a sign, cycle it to a hint, save and reload, hover it to read the hint, then play the level and interact with it — the badge, the tooltip and the in-game text all agree.

**Acceptance Scenarios**:

1. **Given** the sign tool is selected, **When** the developer clicks an empty cell, **Then** a sign is placed showing the default hint.
2. **Given** a placed sign, **When** the developer clicks it again with the sign tool, **Then** its hint cycles to the next registered hint and its corner badge updates.
3. **Given** a sign showing a hint, **When** the level is saved and reloaded, **Then** the sign still shows that hint.
4. **Given** a sign on the canvas, **When** the developer hovers it, **Then** a tooltip names the hint's own text.
5. **Given** a level saved before this feature with `1`–`6` sign characters, **When** it loads, **Then** each becomes a `T` sign carrying the same hint.

---

### User Story 5 - The falling stalactite stops needing its own character (Priority: P2)

A developer makes a stalactite fall by painting the falling-stalactite tool, which places the ordinary `⊤` tile and marks that cell as falling; the editor tints it red exactly as it does today. The game shakes and drops it exactly as before. A level authored before this feature, whose falling stalactites are `T`, loads unchanged.

**Why this priority**: It is a small, self-contained demonstration that a *variant of a tile* can live in metadata instead of consuming a character, which is the pattern the sign then reuses.

**Independent Test**: Paint a falling stalactite, confirm the `⊤` art with the red tint, play the level, walk beneath it and confirm it shakes and drops.

**Acceptance Scenarios**:

1. **Given** the falling-stalactite tool is selected, **When** the developer clicks a cell under a ceiling, **Then** a `⊤` tile carrying the falling marker is placed and shown tinted.
2. **Given** the decorative-stalactite tool is selected, **When** the developer clicks a cell, **Then** a `⊤` tile with no marker is placed and shown untinted.
3. **Given** a placed falling stalactite, **When** the level is saved and reloaded, **Then** it is still a falling stalactite.
4. **Given** a level saved before this feature with a `T` falling stalactite, **When** it loads, **Then** it becomes a `⊤` tile carrying the falling marker and behaves identically.

---

### Edge Cases

- ✅ **Marker painted in an empty cell**: legal and unchanged — the cell is simply empty terrain plus a marker, which is the common case for a patrol boundary.
- ✅ **Two markers on one cell**: a cell carries at most one marker; painting a second kind replaces the first.
- ✅ **The tile under a marker is removed**: erasing the terrain under a marker leaves the marker in place.
- ✅ **A marker outside the painted bounding box**: a marker in a cell that holds no terrain must still be part of the content's extent and must survive the export crop, or a room could silently lose a marker on save.
- ✅ **A marker character the level no longer recognises**: ignored without breaking the load, matching the existing forgiving-load policy for terrain and background.
- ✅ **Stale editor state in a browser profile**: an editor grid persisted before this feature holds marker characters inside the terrain grid; consistent with the existing policy, no migration is attempted for local working state — the affected keys can be cleared.
- ✅ **Overlapping markers on placement**: when a stamped room's marker lands on a cell the level already marks, the stamped room's marker replaces the existing one, matching how painting over a cell already behaves.
- ✅ **A blueprint's markers and the placement overlap check**: the check stays terrain-only, so a marker alone never blocks a placement.
- ✅ **A marker on a cell carrying an entity, sign or hazard**: legal — the tile meta layer is orthogonal to all foreground content, so a marker may share a cell with an entity, sign or hazard marker, all of which sit on empty terrain.
- ✅ **A marker painted past the canvas edge**: the canvas does not grow; markers can only be placed within the existing extent, so the author extends the canvas with terrain first.
- ✅ **Erasing or replacing a sign or falling-stalactite tile**: the tile's marker goes with it — right-click (or the eraser, or painting another tile over it) removes both, so the tile can always be cleared. A patrol boundary or connection point is unaffected by terrain changes (FR-002).
- ✅ **An old `1`–`6` sign character or a `T` falling stalactite**: migrated at load to a `T` sign carrying the hint, or a `⊤` tile carrying the falling marker; the next save writes the new shape.
- ✅ **A `T` with no sign marker** (a hand-edited file): loads as a sign showing the default hint rather than failing or drawing nothing.
- ✅ **A sign whose hint key is unknown**: the sign loads with the default hint; the load never fails.
- ✅ **Reading a marker's content in the editor**: a sign's badge shows a short hint code and hovering it shows the hint's own text; a falling stalactite keeps its tint — so no marker's content is invisible.

## Requirements _(mandatory)_

### Functional Requirements

#### The tile meta layer

- **FR-001**: A level and a blueprint MUST each be able to carry a tile meta layer that is independent of the terrain layer. The layer MUST be the home of the markers that occupy terrain cells or are encoded in layout characters today — the enemy patrol boundary, the blueprint connection point, a sign's hint, and the falling-stalactite variant — so that none of them is stored in the terrain grid or encoded in a character any more.
- **FR-002**: A cell MUST be able to hold a terrain tile and a marker at the same time, and a marker MUST also be able to share a cell with an entity, sign or hazard marker. Painting a marker MUST NOT change, remove or replace anything in that cell. Painting or placing foreground content MUST NOT remove a terrain-independent marker (a patrol boundary or a connection point); a marker that describes its own terrain tile (a sign on `T`, a falling stalactite on `⊤`) MUST be removed when that tile is erased or replaced, so the tile can never be left unremovable.
- **FR-003**: A cell MUST carry at most one marker. Painting a marker onto an already-marked cell MUST replace that cell's marker.
- **FR-004**: The tile meta layer MUST be aligned to the terrain grid: at most one marker per cell, always addressable by the cell it sits on. Alignment is an editor and runtime property; the layer need not be stored as a dense per-cell grid (see FR-014).
- **FR-005**: Every marker MUST render nothing in the running game and MUST never be solid, standable or climbable, whatever the terrain under it is.
- **FR-006**: A patrol boundary marker MUST still reverse an enemy's patrol when the enemy's visible leading edge reaches it, exactly as a patrol boundary does today.
- **FR-007**: A blueprint connection point MUST remain editor-only: nothing in the running game reads it and it has no gameplay effect. It MUST be available only on the blueprint canvas, as it is today.
- **FR-008**: The editor MUST show every marker on the canvas as a distinct glyph and tint drawn over the terrain, so a marker is never mistaken for the terrain under it or for another marker kind.

#### Marker kinds and their content

- **FR-023**: A marker's value MUST be a typed discriminated union — each kind declares its own value shape — so a kind carries exactly the data it needs and nothing is untyped. The union today has four kinds: `patrolBoundary` (no value), `connectionPoint` (no value), `fallingStalactite` (no value), and `sign` (a `hintId`). Adding a kind MUST be one union member plus its own editor presentation.
- **FR-024**: A sign's value MUST be a `hintId` key resolved through the active locale at runtime, never literal translated text, so a level file stays language-neutral and adding a language needs no level edits.
- **FR-025**: Every sign MUST use one and the same layout character (`T`); the specific hint MUST never be encoded in the character. The character marks that a sign stands on the cell and resolves to empty terrain, exactly as sign characters do today.
- **FR-026**: The falling stalactite MUST stop being its own hazard character. The decorative `⊤` MUST be the only stalactite tile, and a `fallingStalactite` marker on that cell MUST be what makes it fall. The freed `T` becomes the sign character (FR-025).
- **FR-027**: A `T` cell carrying no `sign` marker MUST load as a sign showing the default hint, rather than failing or drawing nothing.

#### The editor

- **FR-009**: The editor MUST let the author place and remove markers through the foreground canvas by selecting the marker's own tool, with no separate tile-meta-layer mode and no way to select the tile meta layer as a canvas. A marker tool MUST write to the tile meta layer whatever the active terrain layer is.
- **FR-010**: While a marker tool is selected, a click MUST set that marker on the clicked cell and the eraser MUST clear the cell's marker, in both cases leaving the cell's foreground content untouched. Selecting a terrain, entity, sign, hazard or background tool MUST NOT place a marker, and the palette MUST offer no marker tool on a canvas where that marker does not apply. A marker tool MUST NOT grow the canvas: markers can only be placed within the existing extent.
- **FR-011**: Markers MUST remain visible on the canvas regardless of which layer is active, so an author cannot unknowingly paint terrain over a marker.
- **FR-012**: The editor MUST persist the tile meta layer the same way it persists the terrain and background layers, so an authoring session survives a reload.
- **FR-013**: No editor tool may write a marker of a kind other than its own. A spawn point, entity, non-variant hazard or background tool MUST write no marker at all; a pure marker tool (FR-009) and the two variant tools (the sign tool and the falling-stalactite tool, FR-030/FR-031) write only their own marker.
- **FR-028**: The editor MUST show each marker's *content*, not just its kind: a sign MUST carry a corner badge showing a short code for its hint, and a falling stalactite MUST keep its existing tint. This extends FR-008.
- **FR-029**: The editor MUST provide a hover tooltip on a marked cell naming the marker and its value — for a sign, the hint's own text — so no marker's content is unreadable from the canvas.
- **FR-030**: The sign tool MUST paint a `T` with the default hint and, clicked again on an already-placed sign, MUST cycle that sign's `hintId` in the meta layer — the existing sign cycle, now writing metadata instead of a character.
- **FR-031**: The palette MUST keep a decorative-stalactite tool (paints `⊤` alone) and a falling-stalactite tool (paints `⊤` plus the `fallingStalactite` marker), so the author chooses the variant with the tool.

#### Format, crop and placement

- **FR-014**: Saved level and blueprint files MUST carry only the markers that are actually present, not a dense per-cell grid in which almost every entry is empty, and MUST omit the marker data entirely when there are none — so an unmarked level's file is unchanged from before this feature and a single marker does not bloat a file with empty cells.
- **FR-015**: Loading a level or blueprint whose layout still encodes this data MUST, at load time, lift it into the tile meta layer and leave the terrain there empty: `P` → a patrol boundary, `+` → a connection point, a `1`–`6` sign digit → a `T` sign carrying that hint, and the `T` falling-stalactite hazard → a `⊤` tile carrying the falling marker. An existing file loads with the same content and the same effective gameplay; the next save writes the new shape.
- **FR-016**: An unrecognised marker character MUST be ignored without failing the load, matching the existing forgiving-load policy.
- **FR-017**: The export crop for a level or a blueprint MUST include every marker within the content's extent, and a marker on a cell that holds no terrain MUST be part of that extent, so a save never silently drops a marker.
- **FR-018**: Stamping a blueprint into a level MUST write the blueprint's markers into the level's tile meta layer, positioned relative to the placement's anchor, so a placed room's markers travel with it.
- **FR-019**: The blueprint placement overlap check MUST continue to consider terrain only. A marker on its own MUST NOT make a placement invalid, and a placement MUST NOT be blocked by, or remove, terrain because of a marker.
- **FR-020**: Where a stamped room's marker lands on an already-marked cell, the stamped room's marker MUST replace the existing one.

#### Export

- **FR-033**: The editor's Export control MUST display the complete level JSON — the same shape a saved level file has: the foreground `layout`, the `background` when it holds content, and the `markers` when the level has markers — rather than a layout-only rendering, and its copy control MUST copy that exact JSON. This amends the editor's existing export display ([F-019](../F-019-platformer-level-editor/spec.md) FR-019), which showed the layout rows alone and cannot represent markers.
- **FR-034**: The exported JSON MUST be produced by the same serializer the Save path uses, so the exported text and the written file can never drift apart.
- **FR-035**: The platformer format documentation MUST include a worked recipe for adding a new marker kind — the union member, its storage shape, any load-time migration for a replaced character, its runtime consumer, its editor tool and presentation, and its tests — so a future tile can gain metadata without reverse-engineering the layer.

#### Runtime

- **FR-021**: The running game MUST read patrol boundaries from the tile meta layer rather than from the terrain grid. A marked cell's gameplay MUST be decided by its terrain tile alone.
- **FR-022**: A level's effective gameplay MUST be identical whether its markers were authored on the tile meta layer or migrated from an older file's terrain layout.
- **FR-032**: The running game MUST read a sign's `hintId` and a falling stalactite's presence from the tile meta layer rather than from a layout character, with the same in-game behavior — the same hint text, the same shake-and-drop — as before.

### Key Entities

- **Tile meta layer** — a layer aligned to the terrain grid and independent of it, holding the level's markers. A cell carries at most one marker; it is stored sparsely, only where a marker exists.
- **Marker** — an invisible, non-solid datum on the tile meta layer, separate from terrain. It renders nothing and collides with nothing. A marker's value is a typed discriminated union (FR-023).
- **Patrol boundary** — a marker that bounds enemy movement: an enemy reverses when its leading edge reaches it. Read by the running game; invisible to the player.
- **Connection point** — a marker on a blueprint's border marking where another room may attach. Editor-only; read by nothing in the running game.
- **Sign** — a marker whose value is the `hintId` it shows. Its layout character is a uniform `T`; the hint lives only on the layer and is resolved through the active locale at runtime.
- **Falling stalactite** — a presence-only marker on a `⊤` tile that makes that decorative stalactite shake and drop. Replaces the former `T` hazard character.
- **Terrain tile** — a cell's gameplay-defining content, which a marker no longer replaces.

## Success Criteria _(mandatory)_

- **SC-001 — Marking is non-destructive**: a marker can be placed on any cell without changing what that cell does in the game. Verified by marking a wall, a floor and an empty cell, then playing the level.
- **SC-002 — Existing content survives**: every level and blueprint that loaded before this feature loads after it with the same terrain and the same markers. Verified by loading each saved file and the shipped level.
- **SC-003 — Markers are invisible at runtime**: nothing renders for any marker, and the player's movement through a marked cell is decided by the tile alone. Verified by playing a marked level.
- **SC-004 — Patrol behavior is unchanged**: an enemy turns at exactly the same cells after the change as before it. Verified by the existing enemy-movement tests and a manual play-through.
- **SC-005 — Markers round-trip**: a marker painted in the editor survives save, reload and — for a blueprint — placement into a level. Verified by a full round trip.
- **SC-006 — A marked room is still a room**: a blueprint whose border carries markers stamps into a level with a solid, unbroken border at every marked cell.
- **SC-007 — A sign's hint round-trips**: a sign's hint survives save, reload and placement, and the game shows the same translated text it showed before the change. Verified by a full round trip and an in-game interaction.
- **SC-008 — A stalactite's variant round-trips**: a falling stalactite stays a falling stalactite across save and reload, and a decorative one never falls. Verified by a full round trip and a play-through.
- **SC-009 — Metadata is legible while authoring**: a sign's hint code is visible on its tile and its full text on hover, and a falling stalactite is visibly tinted — verified by authoring without playing the level.
- **SC-010 — Export shows the whole level**: the Export control displays the complete JSON a save would write — foreground `layout`, `background`, and `markers` — and copying it yields exactly that text. Verified by exporting a level with all three layers and diffing against the saved file.
- **SC-011 — Adding a kind is a documented, bounded recipe**: the format doc explains how to add a new marker kind and names every file it touches, so a future tile's metadata is an extension of the layer rather than a new mechanism. Verified by following the recipe to add a throwaway kind.

## Assumptions

- **[F-019](../F-019-platformer-level-editor/spec.md) and [O-006](../O-006-platformer-blueprints/spec.md) exist**: this feature extends the editor's layer handling and the blueprint format; it does not recreate them.
- **Alignment, not storage, follows the background layer**: the tile meta layer is aligned to the grid and cropped and validated as forgivingly as the background layer, but — unlike the background's dense `string[]` layout — it is stored sparsely, because all but a handful of its cells are empty.
- **Four marker kinds today**: the layer ships with the kinds that exist now; adding a fifth is a separate feature.
- **Metadata is typed**: every marker value is part of a discriminated union; no `any` and no free-form per-cell JSON.
- **Signs keep one character**: the sign's layout character is the uniform `T`; the hint lives only on the layer. The former digits `1`–`6` are no longer layout characters.
- **No runtime behavior for connection points**: they remain an authoring and legibility aid, as recorded in O-006's open requirement.
- **Local editor state is not migrated**: consistent with the project's existing policy, a stale persisted editor grid is cleared by the author rather than converted.
- **Placement validity stays terrain-only**: the existing overlap rule is unchanged; markers are additive metadata.

## Out of Scope

- Any runtime transition, teleport or trigger driven by a connection point.
- Auto-generating a level from blueprints, or validating a placement against another room's markers.
- A general-purpose per-cell metadata editor for arbitrary author key/value pairs beyond the four marker kinds.
- Storing literal translated text in a level file instead of a `hintId` key.
- Rotating or mirroring a blueprint's markers independently of its terrain.
- Migrating a browser profile's persisted editor state.
