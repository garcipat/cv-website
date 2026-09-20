# Feature Specification: Platformer Background Tile Rework

**Feature Branch**: `O-014-platformer-background-tiles`
**Created**: 2026-09-20
**Status**: Draft
**Input**: GitHub Issue [garcipat/cv-website#52](https://github.com/garcipat/cv-website/issues/52) — "Replace the freeform, busy background pieces with a flat, autotiled background mass built the same way as the foreground terrain, so the backdrop reads as one smooth piece and stops competing with the foreground."

## Clarifications

### Session 2026-09-20

- Q: Should the flat background mass get a subtle lit top edge (like the foreground's bright/dark ground tiles), or stay fully flat? → A: Fully flat — no brightness split by neighbour mask; every cell of a material uses the same tone regardless of what's above it.
- Q: Should O-014 add background materials beyond the family mapping O-010 depends on? → A: Materials are an open set defined by the art sheet, not hardcoded to two — see below. Family (`surface` | `cave`) stays the fixed two-value axis O-010 reads.
- Q: How should rock/decoration accents be picked? → A: A new small background-decor catalog, mirroring `StaticObjectsCatalog`'s position-hashed `pickVariant(col, row)` mechanism, scoped to background decor only.
- Q: Final material set and family assignment, after hand-tuning the art (`public/sprites/background_tiles.png`) → A: Six materials — **surface**: `dirt`, `rust`, `surfaceStone`; **cave**: `charcoal`, `maroon`, `caveStone`.
- Q: Migration of existing `BackgroundPlacement[]` level data → A: Dropped, not migrated. Saved levels simply load with an empty background grid.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The background reads as one continuous mass, not scattered pieces (Priority: P1)

A player moving through a level sees the background as a single coherent wall of material behind the terrain — its edges are clean where it meets open space, and there are no gaps, seams, or repeated blobby chunks breaking up the surface. Behind that flat mass, the existing parallax backdrop is no longer visible through it (no gaps to show through).

**Why this priority**: This is the entire point of the rework — the current freeform stamped pieces read as busy and incoherent, competing visually with the foreground terrain. Fixing that is the feature's sole reason to exist.

**Independent Test**: Paint a filled rectangular region of one background material in the level editor and view it in the rendered level — the region reads as one continuous, gapless mass with correctly closed edges on every side that borders open space.

**Acceptance Scenarios**:

1. **Given** a rectangular region of background cells painted with the same material, **When** the level renders, **Then** interior cells show a seamless middle texture and boundary cells show closed edge/corner art with no gaps.
2. **Given** a single isolated background cell with no same-material neighbours, **When** the level renders, **Then** it renders as a self-contained bordered tile (not a fragment expecting neighbours).
3. **Given** a one-cell-wide vertical or horizontal run of background cells, **When** the level renders, **Then** it renders as a capped strip (distinct end pieces, repeating body) rather than a corner/edge tile that assumes a wider mass.

---

### User Story 2 - Different background materials never visually blend together (Priority: P1)

An author places two different background materials (e.g. `dirt` next to `charcoal`) adjacent to each other. Each material's mass renders as a fully independent, self-closed shape — the tiling logic never treats a differently-materialed neighbour (or empty space) as "connected."

**Why this priority**: Without this, adjacent materials would autotile into each other, producing nonsensical seams and defeating the purpose of having distinct materials at all. This is a correctness requirement for the autotiling itself, not a polish item.

**Independent Test**: Paint two adjacent regions of different materials sharing a border and view the render — each region's edge art faces the boundary as if it were open space, not merged with its neighbour.

**Acceptance Scenarios**:

1. **Given** a `dirt` cell directly adjacent to a `charcoal` cell, **When** neighbour connectivity is computed for either cell, **Then** the other material's cell counts as a non-connecting neighbour (same as empty space).
2. **Given** two adjacent same-family materials (e.g. `charcoal` next to `maroon`, both `cave`), **When** the level renders, **Then** they still render as two independently-edged masses, not one merged shape.

---

### User Story 3 - Cave materials still darken the player's view (Priority: P2)

A player walking through a cave area — now defined by the new per-cell background grid instead of the old placement list — still experiences the existing cave-darkness effect exactly as before: standing over any cell whose background material belongs to the `cave` family darkens the view.

**Why this priority**: This preserves an existing, already-shipped feature (O-010 Platformer Cave Lighting) through the data-model change. It's not new functionality, but breaking it would be a regression, so it's tested explicitly rather than assumed.

**Independent Test**: Place a `cave`-family material (e.g. `charcoal`) under the player's path and a `surface`-family material (e.g. `dirt`) elsewhere; walk the player over each and confirm the darkening effect toggles correctly.

**Acceptance Scenarios**:

1. **Given** a background cell of a `cave`-family material at the player's foot position, **When** darkness is evaluated, **Then** the view darkens.
2. **Given** a background cell of a `surface`-family material (or an empty cell) at the player's foot position, **When** darkness is evaluated, **Then** the view does not darken.

---

### User Story 4 - Rocks decorate the flat mass without looking stamped (Priority: P3)

A level author viewing a large flat background mass sees occasional rock accents scattered across its interior, breaking up what would otherwise be a perfectly uniform repeating texture — the same kind of deterministic, position-based variety the foreground's bushes and stalactites already have.

**Why this priority**: This is a visual polish pass on top of the core autotiling work (User Stories 1–2) and the preserved gameplay behaviour (User Story 3). The mass reads correctly without it; rocks only make it read less repetitive.

**Independent Test**: Render a large filled region of one material and confirm rock decorations appear at deterministic positions (same level always renders the same rocks in the same places) only on fully-interior cells.

**Acceptance Scenarios**:

1. **Given** a large filled region of background cells, **When** the level renders, **Then** a subset of fully-interior cells (mask = fully connected on all four sides) show a rock decoration on top of the flat middle texture.
2. **Given** the same level rendered twice, **When** rock placement is compared, **Then** the same cells show the same rock variant both times (deterministic from grid position).
3. **Given** an edge, corner, or strip-cap cell, **When** the level renders, **Then** no rock decoration is drawn there (rocks are restricted to interior middle cells so they never overlap a border sprite).

---

### User Story 5 - Authors paint the background the same way they paint terrain (Priority: P2)

A level author switches to the background layer in the editor and paints/erases material directly on the cell grid — clicking a cell sets it to the selected material, right-click (or the erase tool) clears it — with no footprint/overlap reasoning required, exactly like painting foreground terrain.

**Why this priority**: The old footprint-stamping editor UX (pick a multi-tile piece, place it, overlaps silently replace) is a direct consequence of the old freeform data model and must be replaced for the new per-cell grid to be usable at all. Without it, the new data model has no way to be authored.

**Independent Test**: Open the editor, switch to the background layer, paint a material across several cells, then erase a subset — the grid updates cell-by-cell with no residual multi-cell footprints.

**Acceptance Scenarios**:

1. **Given** the background layer is active with a material selected, **When** the author clicks a cell, **Then** that single cell is set to the selected material (growing the grid if the cell is outside its current bounds, matching terrain painting).
2. **Given** a painted background cell, **When** the author erases that cell, **Then** only that cell clears — neighbouring painted cells are unaffected.
3. **Given** the background palette, **When** the author opens it, **Then** materials are grouped into Surface and Cave sections derived from each material's family (not a hand-maintained list).

---

### Edge Cases

- **Fully isolated single cell**: A background cell with no same-material neighbour on any side renders as a self-bordered single tile (all four sides closed), not a fragment of a larger shape.
- **Stale/unknown material in saved data**: A background cell referencing a material id the current catalog doesn't recognize is skipped when rendering (drawn as empty) rather than crashing, consistent with the old catalog's `undefined`-not-throw behaviour.
- **Old saved levels**: A level saved under the old `BackgroundPlacement[]` format loads with an empty background grid (no attempt to convert placements to cells).
- **Background grid smaller/larger than terrain grid**: Background grid dimensions follow the same grow-on-paint behaviour as terrain; a background cell outside the current terrain bounds is not a defined scenario the editor needs to support (painting only happens within/growing the shared grid, matching how terrain painting already works).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The level format MUST represent the background layer as a dense per-cell grid aligned to the terrain grid, where each cell is either empty or holds one background material id — replacing the freeform `BackgroundPlacement[]` list.
- **FR-002**: Each background material MUST belong to exactly one family, `surface` or `cave`, as an intrinsic property of the material (not a per-cell flag) — preserving the existing rule O-010 depends on.
- **FR-003**: The six shipped materials MUST be: `dirt`, `rust`, `surfaceStone` (family `surface`) and `charcoal`, `maroon`, `caveStone` (family `cave`).
- **FR-004**: Rendering MUST compute, for each non-empty background cell, a 4-bit neighbour mask (up/right/down/left) counting only cells of the **same material** as connected; a different material or an empty/out-of-bounds cell MUST always count as a non-connecting (closed) neighbour.
- **FR-005**: A `BackgroundAtlas` MUST map every value of the 16-entry neighbour mask to a sprite + rotation, per material, covering: fully-isolated (mask 0), the four corner shapes, the four edge shapes, the fully-interior middle shape, and the four one-wide-strip shapes (cap and body) — mirroring `GroundAtlas`'s approach of reusing a small set of source tiles via 90°/180°/270° rotation rather than authoring all 16 as distinct art.
- **FR-006**: The background render MUST NOT vary a cell's sprite by brightness/lighting kind (no bright/dark split by mask, unlike `GroundAtlas`'s grass tiles) — every cell of a given material and mask renders identically regardless of what's above it.
- **FR-007**: Background rendering MUST draw a continuous mass with no gaps between adjacent same-material cells and no visible seam at the boundary between two different materials or between a material and empty space.
- **FR-008**: A new background-decor catalog MUST place rock decorations on a deterministic, position-hashed subset of fully-interior (mask = middle) background cells, using the same `pickVariant(col, row)`-style mechanism `StaticObjectsCatalog` uses for foreground decor. Rocks MUST NOT be placed on corner, edge, strip-cap, strip-body, or isolated cells.
- **FR-009**: `Lighting.isCellDarkening` (or its direct replacement) MUST determine darkening by looking up the background material at the given cell and checking its family, as a direct grid lookup — replacing the old AABB placement-footprint scan.
- **FR-010**: The editor's background layer MUST support single-cell paint and erase (selecting a material, then clicking/right-clicking a cell), growing the grid the same way terrain painting does, with no footprint/overlap concept.
- **FR-011**: The editor's background palette MUST be split into "Surface" and "Cave" sections whose membership is derived from each material's family, not a hand-maintained list.
- **FR-012**: A background cell referencing an unrecognized material id MUST be skipped (rendered as empty) rather than causing a render error.
- **FR-013**: Old saved levels using the previous `BackgroundPlacement[]` format MUST load successfully with an empty background grid; no conversion from placements to cells is required.
- **FR-014**: `docs/themes/platformer/LevelFormat.md` MUST be updated to document the new per-cell background grid format, replacing the freeform-placement description.

### Key Entities _(include if feature involves data)_

- **Background cell**: One entry in the per-cell background grid, aligned 1:1 with the terrain grid. Either empty or holds a material id. No footprint, no anchor — every cell is independently addressable, mirroring how terrain cells work today.
- **Background material**: A named texture family member (`dirt`, `rust`, `surfaceStone`, `charcoal`, `maroon`, `caveStone`) with an intrinsic `surface`/`cave` family. Defines which sprites in `BackgroundAtlas` it maps to.
- **Background neighbour mask**: A 4-bit value (up/right/down/left) computed per cell from same-material adjacency, driving which `BackgroundAtlas` sprite and rotation is drawn.
- **Background decoration**: A rock accent drawn on top of a fully-interior background cell, chosen deterministically from the cell's grid position, purely visual with no effect on the background grid's own data.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A filled region of one background material renders with zero visible gaps between cells and correctly closed edges on every boundary, at any size from a single cell up to a full-screen mass.
- **SC-002**: Two adjacent regions of different materials never merge visually — each always shows fully-closed edge/corner art at the shared boundary.
- **SC-003**: The cave-darkening effect (O-010) continues to trigger correctly for all three `cave`-family materials and never triggers for `surface`-family materials or empty cells, with no regression in existing darkening test coverage.
- **SC-004**: An author can paint or erase any single background cell in the editor in one click, with no footprint/overlap side effects on neighbouring cells.
- **SC-005**: Every one of the 16 neighbour-mask values has a defined sprite for every material — no mask value is left unhandled.

## Assumptions

- **Art asset**: The rework's art (`public/sprites/background_tiles.png`) was authored during spec development by cropping and rotating pieces from the existing `terrain_.png`/`docs/assets/tilesets/terrain_.png` sheet (reusing the `GroundAtlas`-style rotation-reuse trick: corner, edge, middle, strip-cap, strip-body, and a composited isolated tile, per material) and is treated as the finished, settled asset for this feature — not a placeholder.
- **No lit top edge**: Per the clarification above, the background mass is fully flat with no bright/dark brightness split — simpler than `GroundAtlas`, which does need that split for its grass-topped ground tiles.
- **Rock mechanism**: Rocks are a new, small, background-scoped catalog rather than an extension of `StaticObjectsCatalog`, keeping that catalog focused on foreground terrain decor.
- **No migration**: Existing levels with `BackgroundPlacement[]` data lose their background layer on load (renders empty); this was an explicit, deliberate choice, not an oversight.
- **Editor UX**: The background layer's paint/erase interaction mirrors the existing foreground `paintCell`/`eraseCell` pattern exactly (single-cell writes), replacing all footprint/overlap logic in the editor.

## Dependencies

- **O-003 Platformer Tile Layers** — established the background layer as freeform placement and the editor's layer-switching UI; this feature supersedes O-003's freeform-placement decision specifically (see O-003's own still-open "visual clarity" requirement, which named this exact problem) while keeping the rest of the layer system (layer switching, terrain grid conventions) intact.
- **O-010 Platformer Cave Lighting** — depends on the background layer to determine which cells darken the view via material family; this feature must preserve that behaviour through the data-model change (User Story 3, FR-009).
- **O-009 Platformer Background Image Layers** — the separate illustrated parallax backdrop (sky/clouds/treeline/river), unaffected by this feature; the two "background" concepts are distinct and this feature does not touch O-009's layer.
