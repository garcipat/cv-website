# Bug Ticket: An oversized enemy squeezes through a one-tile slit

**Bug ID**: B-005
**Found In**: S-006 (Platformer theme), main level design
**Status**: Open
**Severity**: Major (an enemy walks through solid terrain, in plain sight)

## Description

A purple slime renders at 2x (`entities/enemies/SlimePurple.ts`'s `renderScale: 2`) and
is drawn bottom-anchored (`entities/enemies/drawSpriteSheetEntity.ts`:
`dy = enemy.y + (RENDERED_TILE_SIZE - size)`), so its body occupies **two** tile rows:
its anchor row and the row above it.

`engine/EnemyAI.ts`'s `stepEnemyPatrol` only ever tests one of them:

```ts
const row = Math.round(enemy.y / RENDERED_TILE_SIZE);
...
const wallAhead = isSolid(tileAt(level, leadingCol, row)) || isBlockedTile(leadingCol, row);
```

`row` is the anchor row — the slime's feet. Nothing consults `row - 1`, where its upper
half is. So an obstacle that occupies only the upper row — a one-tile-high slit, a wall
whose bottom tile has been broken away, a block sitting at head height — is invisible to
the patrol, and the slime walks straight through it with its top half inside solid
terrain.

The ledge check (`noGroundAhead`, testing `row + 1`) is correct and unaffected; this is
specifically about the rows the body itself spans.

Green slimes render at 1x and occupy a single row, so they are not affected. The bug is
latent for any enemy type whose `renderScale` exceeds 1 — today only `slimePurple`.

## Repro

1. Open the Platformer theme with a layout that puts a solid tile exactly one row above
   a purple slime's patrol floor, leaving its own row clear.
2. Watch the slime patrol into it.
3. It passes through, drawn half-buried in the obstacle, instead of reversing.

## Suggested Fix

Derive the rows an enemy's body spans from its sprite the way `attempt` already derives
its horizontal leading edge from `enemyRenderedSize`/`enemyHitboxSidePadding`, and test
`wallAhead` against every one of them rather than the anchor row alone:

```ts
const rowsSpanned = Math.ceil(enemyRenderedSize(enemy.type) / RENDERED_TILE_SIZE);
const wallAhead = Array.from({ length: rowsSpanned }, (_, i) => row - i).some(
  (r) => isSolid(tileAt(level, leadingCol, r)) || isBlockedTile(leadingCol, r),
);
```

Keep `noGroundAhead` testing `row + 1` only — the floor is under the feet regardless of
how tall the body is.

Note that widening the wall test makes purple slimes reverse earlier than they do today,
which tightens the clearance a patrol pocket needs. `level.ts`'s layout already reserves
headroom above every `M` marker (asserted by `level.test.ts`'s
`purpleSlimes-haveHeadroomAndRoomToTurnAround`), so no level change should be required —
but re-check the pockets in zone C's cave and zone E's galleries after the fix.

Add `EnemyAI.test.ts` cases for a 2x enemy with an obstacle at head height only
(must reverse) and with an obstacle at foot height only (must still reverse), written
first and confirmed failing against the current single-row check. The existing patrol
tests only ever place obstacles in the anchor row, which is why this slipped through.

## Related

- `src/themes/platformer/engine/EnemyAI.ts` — `stepEnemyPatrol`
- `src/themes/platformer/entities/enemies/SlimePurple.ts` — the only `renderScale: 2`
  enemy today
- `src/themes/platformer/level/level.ts` — the layout's purple-slime pockets
