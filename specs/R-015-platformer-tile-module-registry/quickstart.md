# Quickstart: Validating R-015 Platformer Tile Module Registry

**Feature**: `R-015-platformer-tile-module-registry`
**Spec**: [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md) · **Research**: [`research.md`](./research.md)

This is a validation/run guide, not an implementation guide. It documents how to prove the
restructuring is behaviour-preserving and how to demonstrate the "one module + one registry line"
property. Implementation detail belongs in `tasks.md`.

## Prerequisites

- Node ≥ 24, npm ≥ 10 (`package.json#engines`).
- Branch `R-015-platformer-tile-module-registry` checked out.
- Dependencies installed: `npm install`.

## 1. The full safety net (must pass unchanged)

```bash
npm test        # vitest run — full suite, including the new FR-014 guard test
npm run build   # tsc -b && vite build — production build must succeed
npm run lint    # eslint .
```

Expected: all existing tests pass with only import-path / module-home edits; no test deleted, skipped
or weakened. The FR-014 guard (`tiles/registry.test.ts`) fails if any structural invariant regresses.

## 2. Structural proof — one module per kind, exhaustive registry

```bash
# Every TileType resolves to one module and one registry line; no second tile/palette table in tiles/.
npx vitest run src/themes/platformer/tiles/registry.test.ts
```

Manual inspection (should be empty of per-kind branches):

```bash
# No `tile === '<kind>'` rule comparisons remain in the rule/dispatch files.
rg "=== '|!== '" src/themes/platformer/engine/Physics.ts \
   src/themes/platformer/engine/Standable.ts \
   src/themes/platformer/level/Terrain.ts
```

Expect only comparisons against non-tile literals (e.g. phase names) or the two exempt run
classifiers `bridgeRunPosition`/`chainRunLength` in `level/Terrain.ts` (which select run sprites, not
rules); every tile-kind rule flows through `TILE_MODULES`.

Inspect `src/themes/platformer/tiles/` — one module per kind plus `registry.ts`/`TileModule.ts`.

## 3. The "adding a tile is one module + one line" demonstration (SC-002)

Follow the updated recipe in `docs/themes/platformer/Terrain.md`:

1. Add a throwaway module under `src/themes/platformer/tiles/` declaring `char`, `fogExempt`,
   `drawBand` and (optionally) rule/draw hooks.
2. Add one line to `TILE_MODULES` in `tiles/registry.ts`.
3. `npm run build` and `npm test`.

Expected: the tile parses, renders and reports its declared rules with **zero** edits to
`level/Terrain.ts`, `engine/Physics.ts`, `engine/Standable.ts`, `engine/Renderer.ts`,
`level/LevelParser.ts`, `level/LevelData.ts` or the editor palette. Revert the throwaway afterwards.

## 4. Behaviour-preservation manual browser check (SC-005)

Run the dev server and play a level that exercises every tile axis; compare against the pre-refactor
build (or `main`):

```bash
npm run dev
```

Check, with no visible or behavioural difference:

- grass autotiling (surface edges, buried cells, step-ups) and `groundRock` exposed/buried sprites;
- `wall`, `bridge` run sprites and bridge drop-through (Down while stood on it);
- `ladder`/`chain` climb, the standable shaft top, the rolled ladder bundle (`@`) deploy via Up and the
  deployed `ropeLadder` climb, and the bundle staying standable through the unroll;
- bouncy mushroom run art, the cap bounce launch and the cosmetic squash dip; the decorative mushroom;
- the crumbling-floor crack → break → reform cycle, including its half-height collision and shake;
- torches flickering out of phase and lighting the cave; cobweb corner orientation; crystal cluster;
  stalactite/stalagmite variants; fence and bush/tree runs;
- cave fog exemption and the editor preview/palette (behaviour must be unchanged; the palette is R-010's
  scope, not this feature).

## 5. Downstream consumability spot-check (SC-008)

Inspect the contract surfaces R-008 / R-009 / R-010 will consume (no competing registry exists):

- `TILE_MODULES[tile].draw` + `TileDrawContext` (R-009's static-tile registry half);
- `char`, `fogExempt` and appearance metadata on each module (R-010's palette read model);
- `tiles/ropeLadder.ts`'s art geometry imported by `entities/deployableItems/RopeLadder.ts` (R-008),
  whose lifecycle is unchanged.

## 6. Documentation check (SC-007)

- `docs/themes/platformer/Terrain.md`: the "Adding a tile" recipe is one module + one registry line,
  and the F-018 "terrain kinds still do not own their own rules" gap is recorded as closed.
- `docs/themes/platformer/LevelFormat.md` points at the terrain char table's new home.
- `docs/TransientEffectRecipe.md`'s reference to the mushroom squash path reads
  `tiles/bouncyMushroom.ts`; the note that it is a keyed timed tile (not an effect) is unchanged.
