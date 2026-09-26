# Contract: Layer Invariants & FR-014 Guard

**Feature**: `R-015-platformer-tile-module-registry`
**Enforced by**: `tiles/registry.test.ts` (FR-014). R-014's lint guard is out of scope and later.

This contract fixes the structural invariants the tile layer must not widen, and the exact checks the
FR-014 guard test performs so a regression fails the suite rather than drifting silently.

---

## 1. Permitted dependency direction

```text
contracts/            (leaf — imported by everyone, imports no higher folder)
shared/               (leaf — imported by engine/ entities/ tiles/ state/ editor/)
tiles/                imports { contracts/, shared/, level/ } only
level/                imports { contracts/, shared/, tiles/, entities/ }   (NOT engine/)
engine/               imports { contracts/, shared/, level/, tiles/, entities/ }   (NOT state/)
entities/             imports { contracts/, shared/, level/, tiles/, engine/ }
editor/ state/ page   import anything below them
```

## 2. Forbidden edges (must stay absent)

| Edge | Owner of the rule |
| --- | --- |
| `contracts/ → engine/ entities/ level/ tiles/ state/` | R-001 (leaf) |
| `level/ → engine/` | R-001 |
| `engine/ → state/` | R-001 |
| `tiles/ → entities/` | R-015 FR-011 |
| `tiles/ → engine/` | R-015 FR-011 (keeps `level/ → tiles/ → engine/` from becoming a transitive `level/ → engine/`) |

## 3. Accepted mutual edges

- `level/ ↔ tiles/` — `level/` imports the registry (for `TileType`/`TERRAIN_CHARS` derivation and the
  generic rule helpers); `tiles/` imports the pure grid readers. This mirrors R-001's accepted
  `level/ ↔ entities/` and MUST NOT widen a forbidden edge.
- `entities/ → tiles/` — e.g. `entities/deployableItems/RopeLadder.ts` importing the moved rope art,
  `entities/hazards/FallingStalactite.ts` importing the stalactite twin geometry. Allowed (no rule
  forbids it, and R-008/R-004 already carried `entities/ → engine/` imports).

## 4. FR-014 guard checks

`tiles/registry.test.ts` runs under Vitest (jsdom config; `node:fs` + `node:path` are available) and
asserts:

1. **One module per kind** — `Object.entries(TILE_MODULES)` yields one distinct module object per
   `TileType`; the key set equals a **frozen list of the 19 shipped kind names** (and therefore the
   derived `TileType` set); no duplicate module references. Pinning the list is what makes the check
   non-vacuous, since `TileType` is derived from the registry.
2. **Exhaustive chars** — `TERRAIN_CHARS` maps every author-placeable kind exactly once; registry-only
   kinds (`ropeLadder`) never appear; every parsed char resolves to a real module.
3. **Rule-branch absence** — for each of `engine/Physics.ts`, `engine/Standable.ts`, `level/Terrain.ts`,
   the source contains no `=== '<tileType>'` / `!== '<tileType>'` comparison against a known `TileType`
   literal outside the registry-dispatch helpers. Comparisons against non-tile string literals (phase
   names, run positions) are permitted. The pure run classifiers `bridgeRunPosition` and
   `chainRunLength` in `level/Terrain.ts` are explicitly **exempt** — they compare `tileAt(...)` to
   `'bridge'`/`'chain'` to select run sprites, are not per-kind *rules*, and stay shared grid readers
   (research D4).
4. **Layer edges** — scanning every `src/themes/platformer/**/*.ts(x)` import specifier enforces
   §2's forbidden edges and §1's direction for `tiles/`, `level/`, `engine/`, `contracts/`.
5. **Fog exhaustiveness** — `TILE_FOG_EXEMPT` has a boolean entry for every `TileType`.

The guard uses the same `{method}-{condition}-{expected-result}` naming convention as the rest of the
suite (`docs/TestingGuide.md`) and fails the build/suite on any regression.

## 5. Test-migration rule

Every existing behavioural test moves to the module's new home and keeps its assertions. Only
import-path and module-home edits (and the renamed removed-predicate dispatcher, `isStandableTileAt`)
are permitted. No test may be deleted, skipped or weakened (FR-013, constitution Principle II).
