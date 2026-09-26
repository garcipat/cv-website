# Quickstart — R-010 Platformer Mapper & Editor Unification

**Feature**: `R-010-platformer-mapper-editor-unification`
**Purpose**: runnable checks that prove the unification landed **and** that behaviour is
byte-for-byte preserved. Details live in [data-model.md](./data-model.md) and
[contracts/](./contracts/); this guide only tells you what to run and what to expect.

---

## Prerequisites

- Node ≥ 24, npm ≥ 10.
- Dependencies installed: `npm install`.
- A clean working tree is not required (this refactor is intentionally left uncommitted), but run
  the guard greps against the **working tree** to check the single-implementation invariants.

## 1. Automated suite + build (SC-007)

```bash
npm test        # full Vitest suite, including the FR-017 guard
npm run build   # tsc -b && vite build — must succeed
npm run lint    # eslint — must pass
```

Expected: all existing mapper/editor/registry tests pass with assertions preserved (only the
sanctioned preview-id assertions are updated), the new `editor/editorStructure.test.ts` passes, and
the build succeeds. No new dependency.

## 2. Structural invariants (SC-001–SC-006, SC-009)

The `editor/editorStructure.test.ts` guard is the automated authority; the greps below are a quick
manual cross-check (run from the repo root). Each must print the stated result.

```bash
# SC-001: the parallel preview pipeline is gone
rg "findAllPositions|synthesizeCollectiblePlacements|synthesizeEnemyStates|synthesizeBlockStates|synthesizeChestStates|synthesizeCheckpointStates|synthesizeSignPlacements|synthesizeHazardPlacements|synthesizeRopeLadderBundleStates" src/themes/platformer/editor
# → no matches (only the renamed player-preview helper remains)

# SC-002: one place helper + one ids home + no cross-mapper slugify
rg "function placeAtMarkers|function placeWithFactPool" src/themes/platformer/level          # → one each
rg "function slugify" src/themes/platformer/level                                             # → only level/ids.ts
rg "from '\./CollectibleMapper'" src/themes/platformer/level                                   # → no slugify import

# SC-003: one palette descriptor, no parallel tables, R-015 consumed
rg "PALETTE_TILE_SPRITES|PALETTE_TILE_GLYPHS|PALETTE_TILE_DESCRIPTIONS|PALETTE_TILE_LABELS" src/themes/platformer/editor
# → no matches
rg "PALETTE_TOOLS" src/themes/platformer/editor                                                # → one declaration

# SC-004: one paint / walk / crop / save
rg "function stampGridCells|function paintGridCell" src/themes/platformer/editor               # → one paint primitive
rg "function walkLayout" src/themes/platformer/level                                           # → one walk
rg "function cropLayoutToBox" src/themes/platformer/editor                                     # → one crop
rg "function saveFile" src/themes/platformer/editor                                            # → one saver

# SC-005: one LayoutFile; LevelEntry/Blueprint extend it
rg "interface LayoutFile|type LayoutFile" src/themes/platformer/level                          # → exactly one

# SC-006: editor/ops + editor/dev exist, no React inside
rg "from 'react'|@preact/signals-react" src/themes/platformer/editor/ops src/themes/platformer/editor/dev
# → no matches; and no .tsx files under ops/ or dev/

# FR-018 / SC-008: R-001 forbidden edges still absent
rg "from '(\.\./)+engine/" src/themes/platformer/level
rg "PlatformerState|from '.*state/" src/themes/platformer/engine
rg "from '(\.\./)+((engine|entities|level|state|editor|components)/|PlatformerState|PlatformerPage)" src/themes/platformer/contracts
# → all empty
```

## 3. Behavioural parity, unit level (FR-015)

- **Preview == runtime chain**: extend/replace `gridRenderState.test.ts` so, for a grid containing
  every entity/hazard/marker character, each `ops/previewPlacements.ts` builder's output equals the
  corresponding runtime finder + mapper chain for `gridToLayout(grid)` — same kinds, positions and
  appearance fields.
- **Paint/erase**: `paintCell`/`paintBackgroundCell`/`paintMarkerCell` tests still assert the
  exact resulting cells for foreground/background/markers, including the hazard facing cycle, the
  single-spawn rule, the sign/torch cycle and the "clear marker on repaint" set.
- **Import/export/crop**: `importLayout`/`exportLayout`/`cropLevelForExport` tests still assert the
  exact output strings for jagged, legacy-marker and all-empty inputs.
- **Save**: `saveLevelFile`/`saveBlueprintFile` tests still assert the exact JSON and the
  POST-with-download fallback for both targets.
- **Palette**: `paletteTiles`/`Palette`/`PaletteTile` tests still assert every label, description,
  sprite spec, glyph and grouping; add a check that terrain entries' `char`/`fogExempt`/`drawBand`
  resolve from `TILE_MODULES`.
- **`LayoutFile`**: type-level test/compile that `LevelEntry` and `Blueprint` satisfy `LayoutFile`
  without redeclaring its fields.

> **OQ-1 (resolved 2026-09-27)**: `main.json` has 7 `$` markers but 5 experience entries. The editor
> pads the chest-def list so all 7 still preview (a marker must stay visible to be deletable), while
> the game places 5. See [research.md OQ-1](./research.md). This is the one deliberate preview-input
> difference and it preserves FR-015/SC-007.

## 4. Manual browser check (SC-007, constitution)

Because the change is visible-behaviour-preserving, the suite alone is not sufficient. With the
pre-refactor build available for comparison:

1. `npm run dev`, open the level editor.
2. **Preview**: load the shipped level and confirm every enemy, block, chest, checkpoint, coin,
   sign, hazard and rope-ladder bundle appears at the same position with the same appearance as
   before (all 7 `$` markers still preview as chests, per OQ-1).
3. **Palette**: open every group and confirm the same tools with the same icons, labels, tooltips
   and grouping.
4. **Paint/erase**: paint and erase foreground, background and markers (including the hazard facing
   cycle, the single-spawn rule, the sign hint cycle and the torch strength cycle) and confirm the
   same cells.
5. **Save/export**: save a level and a blueprint and diff the JSON against the pre-refactor output;
   use **Try** and confirm the game behaves identically.
6. Confirm the editor looks and behaves identically in both light and dark appearance.

## 5. Done-when checklist

- [ ] `npm test`, `npm run build` and `npm run lint` pass.
- [ ] §2 greps show single implementations and no forbidden edges.
- [ ] §3 parity tests pass and §4 manual check is clean.
- [ ] FR-017 guard fails when an invariant is deliberately regressed (spot-check once).
- [ ] No commit is made; changes remain in the working tree for review.
