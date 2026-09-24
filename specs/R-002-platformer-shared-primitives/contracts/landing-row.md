# Contract — `findLandingRow` (`engine/Standable.ts`)

## Signature

```ts
export type LandingSolidPredicate = (level: LevelDef, col: number, row: number) => boolean;

export function findLandingRow(
  level: LevelDef,
  col: number,
  fromRow: number,
  isSolidForKind: LandingSolidPredicate,
): number | null;
```

## Semantics

Returns the **first row strictly below `fromRow`** (`fromRow + 1 … level.height - 1`) at which
`isSolidForKind(level, col, row)` is `true`, or `null` when no such row exists before the level's
bottom.

> Note: spec FR-007 words this "at or below `fromRow`"; the existing scans all start at `fromRow + 1`.
> The contract is "strictly below" to preserve byte-for-byte behavior (see research.md R2.2).

## Invariants

1. **Parameterized predicate, not one rule** — each caller's standability rule differs
   (`isStandableCell` vs `isSolid || isBlockOccupied` vs `isSolid`); the helper never hardcodes one
   (spec Assumptions).
2. **Returns `null`, never clamps** — the bomb and stalactite depend on `null` (bomb falls out,
   stalactite goes `gone`). The ladder maps `null` back to its own fallback (spec edge case).
3. **Off-by-one is the caller's** — the bomb/ladder return `firstSolid - 1`; the stalactite returns
   `firstSolid` itself. The helper returns the solid row; each caller applies its own adjustment
   (spec Assumptions).

## Caller contract

| Caller | Predicate | Result mapping |
| --- | --- | --- |
| `FallingStalactite.fallingStalactiteLandingRow` | `(l,c,r) => isStandableCell(l, blocks, crumblingFloorStates, c, r)` | return as-is |
| `PlacedBomb.bombLandingRow` | `(l,c,r) => tileGround(l,c,r) \|\| isBlockOccupied(blocks, c, r)` | `null → null`; else `row - 1` |
| `DeployableLadder.ladderLandingRow` | `(l,c,r) => isSolid(tileAt(l, c, r))` | `null → level.height - 1`; else `row - 1` |

(`tileGround` in the bomb predicate keeps the crumbling-floor special case: a `crumblingFloor` tile
counts as solid only while not broken/reforming.)
