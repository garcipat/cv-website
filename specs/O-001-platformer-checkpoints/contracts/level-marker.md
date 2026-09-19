# Contract: `C` Level Marker

**Feature**: O-001 Platformer Checkpoints
**Consumers**: `level/LevelParser.ts`, `level/level.ts`,
`editor/paintCell.ts`, `editor/Palette.tsx`, `editor/gridRenderState.ts`,
`editor/EditorCanvas.tsx`, saved-level JSON files.

This is the external, author-facing interface of the feature: a level author
writes a character, the game reads it. It must hold for the shipped layout,
for any saved level under `src/themes/platformer/level/levels/`, and for any
blueprint that contains one.

---

## 1. Character registration

| Property | Value |
| --- | --- |
| Character | `C` (U+0043 LATIN CAPITAL LETTER C) |
| Owner map | `ENTITY_CHARS` (`level/LevelParser.ts`) |
| `EntityKind` | `'checkpoint'` |
| `TileChar` | `'C'` added to the union |
| Terrain | resolves to `'empty'` |
| Solidity | non-solid; the player passes through |
| Reserved | `C` must not appear in `TERRAIN_CHARS`, `SIGN_CHARS`, or `HAZARD_CHARS` (enforced by the import-time overlap guard) |

`parseLevel` accepts `C` because `ENTITY_CHARS` holds it; any other character
still throws `Unknown level tile character`. A level containing `C` therefore
parses unchanged by every other consumer.

## 2. Reading

```ts
findCheckpointTiles(layout: readonly string[]): { col: number; row: number }[]
```

Returns every `C` cell in **reading order** (top→bottom, left→right). This
order is the contract the deterministic same-tick rule (FR-009) depends on:
the first dormant checkpoint in this order wins a tie, and the first entered
raised checkpoint wins a tie when no dormant one was entered. Consumers must
not reorder the result.

## 3. Placement

```ts
placeCheckpoints(markers): CheckpointPlacement[]
// id: `checkpoint-${col}-${row}`, x/y: tileToPixel(col, row)
```

## 4. Editor round-trip

| Operation | Contract |
| --- | --- |
| Palette | `C` appears as an Entities button; label `Checkpoint`; tooltip describing the finished-level behaviour; preview crops the **raised** frame (FR-017) |
| Paint | writes the literal `C` into the grid cell, replacing whatever was there |
| Erase | the Eraser clears a `C` cell to `'.'` like any other marker |
| Export | `exportLayout` serializes `C` verbatim, since it crops by `!== '.'` |
| Import | `importLayout` accepts `C` as a `TileChar` |
| Editor preview | the canvas draws a dormant checkpoint at each `C` cell |
| Blueprint | `C` is an ordinary tile when a blueprint is stamped; no special handling (spec Out of Scope) |

## 5. Saved-level files

A saved level / blueprint is `{ name?, layout, background? }` where `layout` is
the string array. A `C` in `layout` is valid with no schema change; the
filename stem remains the id. Existing files without `C` load unchanged.

## 6. Shipped level

`LEVEL_1_LAYOUT` (and therefore the default `main` level) gains **no** `C`.
Checkpoints are authorable, not shipped (spec Out of Scope). A test must
assert the shipped layout contains no checkpoint marker, so an accidental
addition is caught.

## 7. Backward compatibility

- No character is remapped; existing layouts are unaffected.
- The editor's `localStorage` grid may already contain `C` from a prior
  session; it parses once this contract lands. No migration is required.
- A layout authored with `C` before the game code ships will throw on parse;
  this is the normal spec-first ordering and not a supported state.
