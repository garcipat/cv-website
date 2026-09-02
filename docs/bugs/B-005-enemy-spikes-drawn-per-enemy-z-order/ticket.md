# Bug Ticket: Enemy spikes can be overlapped by a later enemy's body

**Bug ID**: B-005
**Found In**: S-006 (Platformer theme), entity architecture work
**Status**: Open
**Severity**: Trivial (not reachable in the shipped level)

## Description

A purple slime that survives a stomp grows spikes that make its top un-stompable until
they retract. Those spikes are drawn inside that enemy's own `draw`
(`src/themes/platformer/entities/enemies/SlimePurple.ts`), which runs during the single
enemy loop in `engine/Renderer.ts`'s `drawEnemies`.

Previously spikes were a separate pass that ran after every enemy body had been drawn,
so they always composited on top of all of them. Now a slime drawn later in the array
can paint its body over an earlier slime's spikes.

**Not reachable in the current level.** Its enemy markers sit at columns 28, 38 and 47,
separated by a wall at column 31 and a three-tile ground gap at columns 40-42; the
closest two hitbox edges are roughly 1292 and 1364 world pixels apart. Two enemies
cannot overlap on screen, so the ordering never shows. This is filed because a future
level with adjacent enemies would expose it, and the cause would be non-obvious by then.

## Suggested Fix

If it ever becomes visible, the fix is a second pass: keep bodies in the existing loop
and let types contribute an optional overlay drawn after all bodies — e.g. an optional
`drawOverlay(enemy, dc)` on `EnemyType` that `drawEnemies` calls in a second loop.

Do **not** revert to a `drawEnemySpikes` function in `Renderer.ts`. That would put the
spike mechanic back in the shared renderer, which is exactly what the entity refactor
removed — "spike" currently appears in one non-test file, and that property is worth
keeping.

Weigh the cost first: a second loop over every enemy each frame, to fix something no
shipped level can show. Leaving this open and documented may stay the right call.

## Related

- `specs/S-006-platformer-theme/plans/2026-09-02-entity-architecture-followups.md` —
  listed under "Known and accepted", with the reachability arithmetic.
