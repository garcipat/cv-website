# Contract: mushroom terrain (types, characters, predicates)

This contract covers the two new terrain kinds and the one-way cap predicate.
It is pure, canvas-free and DOM-free (`level/`), unit-testable with Vitest
(constitution Principle II; [docs/TestingGuide.md](../../../docs/TestingGuide.md)).

## `level/LevelData.ts` — `TileType`

```ts
export type TileType =
  | /* ...existing... */
  /** The red bouncy mushroom. Non-solid and non-climbable: passable from the
   *  side and from below. Its top cap is one-way ground — standable from above
   *  only while the cell directly above is not solid (Terrain.ts's
   *  `isStandableMushroomCap`). Art role (only/top/middle/bottom) is derived
   *  from its vertical run by `verticalRunRole`, like `bush`. */
  | 'bouncyMushroom'
  /** The small non-solid dressing mushroom. No behaviour of any kind: never
   *  solid, never standable, never bounces. Art is a single fixed cell. */
  | 'decorativeMushroom'
  | 'empty';
```

## `level/LevelParser.ts` — characters

```ts
export const TERRAIN_CHARS: Record<string, TileType | undefined> = {
  // ...existing...
  '§': 'bouncyMushroom',
  s: 'decorativeMushroom',
};

export type TileChar =
  | /* ...existing... */
  | '§'
  | 's';
```

- `§` and `s` are unused by all four **foreground** maps
  (`TERRAIN_CHARS`/`ENTITY_CHARS`/`SIGN_CHARS`/`HAZARD_CHARS`); the module-load
  shared-key guard must still pass (FR-018). `§` is not a valid JS identifier,
  so its `TERRAIN_CHARS` key is quoted (`'§'`) and its `TileChar` member is
  `| '§'`; `s` stays unquoted. `s` also appears in `BACKGROUND_CHARS` as
  `surfaceStone`, which is allowed because the background is a separate layer
  whose characters may overlap the foreground ones (the existing `c` already
  means `crystalCluster` in the foreground and `charcoal` in the background).
- No new `find*` helper is added: a mushroom is terrain, not a marker, and
  nothing downstream needs a placement list.

## `level/Terrain.ts` — `isStandableMushroomCap`

```ts
export function isStandableMushroomCap(level: LevelDef, col: number, row: number): boolean {
  const above = tileAt(level, col, row - 1);
  return (
    tileAt(level, col, row) === 'bouncyMushroom' &&
    above !== 'bouncyMushroom' &&
    !isSolid(above)
  );
}
```

Behaviour:

- `true` for the **top** cell of a `bouncyMushroom` run (`only` or `top` role)
  when the cell above is not solid.
- `false` for `middle`/`bottom` cells (the cell above is the same kind), for a
  cap with a solid tile directly above, and for `decorativeMushroom`.
- Out-of-bounds above resolves to `'empty'` via `tileAt`, so a cap in the
  level's top row is standable.
- `isSolid` includes `bridge`, so a `bridge` directly above a cap makes it
  non-standable — matching `isStandableLadderTop`'s existing use of `isSolid`.
- `isSolid`/`isSolidExcludingBridge`/`isClimbable` are **not** changed: both
  mushroom kinds stay non-solid and non-climbable.
- Standability is evaluated per column — `Physics.ts`'s ground scan tests every
  column the hitbox spans, exactly as it does for a ladder top. The *bounce*,
  however, is defined by the player's **centre column** (see
  `playerOnMushroomCap` in mushroom-bounce.md and spec FR-007): a landing whose
  centre column is not over the cap — including a landing on the exact seam
  beside it — rests on the cap's corner without bouncing.

## `engine/Physics.ts` — ground term

In `stepPlayerPhysics`'s downward branch, `columnIsGround` gains one term:

```ts
const columnIsGround = (col: number): boolean =>
  groundIsSolid(tileAt(level, col, footRow)) ||
  isStandableLadderTop(level, col, footRow) ||
  isStandableLadderBundleTop(level, col, footRow) ||
  isStandableMushroomCap(level, col, footRow) ||
  isBlockOccupied(blockPlacements, col, footRow);
```

- The cap is ground **from above only**; it still blocks nothing horizontally
  and nothing while rising (the `vy < 0` branch never consults it), so side and
  underside contacts pass through (FR-004/FR-008).
- No `PlayerState` field is added (see D5).

## Tests

- `level/Terrain.test.ts` — `isStandableMushroomCap`: `only`/`top` true; a cap
  with a solid above false; `middle`/`bottom` false; a top-row cap true;
  `decorativeMushroom` false; `empty`/`groundGrass` false.
- `level/LevelParser.test.ts` — `§` → `bouncyMushroom`, `s` →
  `decorativeMushroom`; the existing "every map key is in `TileChar`" sync test
  covers the union.
- `engine/Physics.test.ts` — a falling player lands on an open-sky cap
  (`grounded`, feet on the cap's top); a covered cap does not catch the player
  (falls through); side/underside contact is unaffected.
