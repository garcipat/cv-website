# Contract — Layer Invariants & FR-017 Guard

**Feature**: `R-010-platformer-mapper-editor-unification`
**Enforced by**: `src/themes/platformer/editor/editorStructure.test.ts` (FR-017).

This contract fixes the structural invariants R-010 creates and the exact checks the guard test
performs so a regression fails the suite rather than drifting silently (SC-009). It extends —
and must not weaken — [R-001 layer-boundaries](../../R-001-platformer-core-contracts/contracts/layer-boundaries.md)
and [R-015 layer-invariants](../../R-015-platformer-tile-module-registry/contracts/layer-invariants.md).

---

## 1. Permitted dependency direction (unchanged)

```text
contracts/            (leaf — imported by everyone, imports no higher folder)
shared/               (leaf)
tiles/                imports { contracts/, shared/, level/ } only
level/                imports { contracts/, shared/, tiles/, entities/ }   (NOT engine/, NOT React)
engine/               imports { contracts/, shared/, level/, tiles/, entities/ }   (NOT state/)
entities/             imports { contracts/, shared/, level/, tiles/, engine/ }
editor/ state/ page   import anything below them
```

New R-010 edges that must hold:

| Source | May import |
| --- | --- |
| `level/layoutChars.ts`, `level/ids.ts`, `level/cvFacts.ts`, `level/placement.ts`, `level/rawLayoutFile.ts` | `level/**`, `tiles/` (reads), `shared/`, `contracts/`, `@/types` only |
| `editor/ops/**` | anything below `editor/` **except** React and `editor/**/*.tsx` UI modules |
| `editor/dev/**` | anything below `editor/` **except** React and `editor/**/*.tsx` UI modules |

## 2. Forbidden edges (must stay absent)

| Edge | Owner of the rule |
| --- | --- |
| `contracts/ → engine/ entities/ level/ tiles/ state/` | R-001 (leaf) |
| `level/ → engine/` | R-001 |
| `engine/ → state/` | R-001 |
| `tiles/ → entities/`, `tiles/ → engine/` | R-015 |
| `level/ → React` (any `from 'react'`, `@preact/signals-react`, or `.tsx` import) | R-010 FR-018 |
| `editor/ops/` or `editor/dev/` → React / UI modules | R-010 FR-014 |

## 3. FR-017 guard checks

`editor/editorStructure.test.ts` runs under Vitest (jsdom config; `node:fs` + `node:path`
available, test-only) and asserts each check with a frozen expectation so it is non-vacuous:

1. **No editor-local finder/synthesizer pipeline** — `editor/gridRenderState.ts` no longer exists;
   no source module defines `findAllPositions`; no `synthesize*` symbol survives at all. The one
   sanctioned editor-only player-preview helper is `previewPlayerState`, which MUST call the shared
   `findOptionalSpawnTile` rather than a local scan.
2. **One palette descriptor** — exactly one `PALETTE_TOOLS` declaration and zero
   `PALETTE_TILE_SPRITES` / `PALETTE_TILE_GLYPHS` / `PALETTE_TILE_DESCRIPTIONS` /
   `PALETTE_TILE_LABELS` declarations; every `EditorTool` key present; every terrain char in
   `TERRAIN_CHARS` maps to a descriptor and its `char`/`fogExempt`/`drawBand` resolve from
   `TILE_MODULES`; grouping matches today's split (`'.'` stays in `tools`, the eight decoration chars
   in `decoration`, and no terrain entry is a non-placeable kind).
3. **One mapper-placement contract** — exactly one `placeAtMarkers` and one `placeWithFactPool`
   definition; every `level/*Mapper.ts` imports at least one of them; no `markers.map(` /
   `markers.forEach(` placement loop remains in a mapper (excluding the shared helper itself);
   `slugify` is declared only in `level/ids.ts`; no mapper imports `slugify` from another mapper.
4. **One paint / walk / crop / save** — exactly one `stampGridCells`/`paintGridCell` definition
   (paint); one `walkLayout` definition (layout-character walk); one `cropLayoutToBox` definition
   (grid-crop); one `saveFile` definition. `cropLevelForExport` obtains **both** `layout` and
   `background` from `cropLayoutToBox` (no character/background row-serialization loop of its own;
   its marker-collection walk is allowed).
5. **One `LayoutFile`** — exactly one `interface/type LayoutFile`; `LevelEntry` and `Blueprint`
   extend it and declare no `layout`/`background`/`markers` field of their own.
6. **`editor/` concern split** — `editor/ops/` and `editor/dev/` exist; no `.tsx` or React import
   under either; the D11 pure-transform modules all live under `ops/` and none remain at the editor
   root (the root holds only `.tsx` UI + `editorState.ts` + `editorActions.ts`).
7. **Layer edges** — scanning every `src/themes/platformer/**/*.ts(x)` import specifier enforces §2.
8. **Shared apply-tool op** — `EditorCanvas`'s `applyToolAt` holds no per-tool placement semantics
   (no `sign` / `fallingStalactite` / `torch` branch and no marker-removal set); those rules live in
   `editor/ops/applyTool.ts` (FR-012).

The guard uses `{method}-{condition}-{expected-result}` naming and fails the build/suite on any
regression.

## 4. Test-migration rule

Every existing behavioural test moves to the module's new home and keeps its assertions (FR-016).
Only import-path/module-home edits and the sanctioned internal-preview-id updates are permitted
(spec Edge Case). No test may be deleted, skipped or weakened. Tests for a symbol folded into a
generic helper (e.g. per-mapper place loops) are rewritten against the generic form.
