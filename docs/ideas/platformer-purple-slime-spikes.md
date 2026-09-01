# Idea: Purple Slime Spike Cooldown

## Status: Design Exploration

## Summary

After a purple slime is stomped (but not yet defeated), spikes appear on its
top for a short cooldown. Landing on it again from above during that window
damages the player instead of registering as a stomp. Once the cooldown
expires, the spikes retract and it's stompable from the top again as normal.

Raised 2026-09-01 while reviewing roadmap step 30 (purple slime rework,
`specs/S-006-platformer-theme/plans/2026-08-31-purple-slime-key-mechanic.md`).
Not pursued as part of that PR — it's a distinct behavior change to the same
enemy, not a fix or extension of that work, so it gets its own step per the
roadmap's branch-strategy rule (one step = one plan).

## Confirmed design decisions

From clarifying questions asked when this idea came up:

- **Re-stomp while spiked → player takes damage.** Landing on the spiked top
  during the cooldown hurts the player, the same way touching an enemy from
  the side already does today (`checkEnemySideCollisions`) — not a harmless
  bounce-off.
- **"Go to the side" was shorthand, not a new attack type.** No new
  side-attack mechanic is needed. The spikes are purely temporary: wait out
  the cooldown, then the top is stompable again. (This was explicitly chosen
  over introducing a side-contact-defeats-enemy mechanic, which would have
  been substantially larger in scope.)

## Why this isn't trivial

The current implementation (`src/themes/platformer/entities/Enemy.ts`,
`src/themes/platformer/engine/Collision.ts`) has a **doc-commented, deliberate
design decision** that directly conflicts with this idea: a purple slime can
currently be chain-stomped 3 times in one bounce arc while still airborne
(`checkEnemyStompCollisions`'s doc comment calls this out explicitly as
intended, not a bug). This idea reverses that on purpose. Any implementation
must rewrite that comment's reasoning, not just the code path.

## Sketch of the change (for whoever picks this up — re-verify against the
code at that time, don't take this as gospel)

- `EnemyState` (`entities/Enemy.ts`): add `spiked: boolean` + a cooldown
  timer field (mirrors the existing `hitTimer`/`hit` reaction pattern already
  used for the stun animation).
- `applyStomp`: when the stomp isn't fatal (`hitPoints` still > 0 after
  decrementing), set `spiked: true` and reset the cooldown timer.
- `EnemyAI.ts`: new step function (same shape as `stepEnemyHitReaction`) that
  counts the cooldown down and clears `spiked` once it elapses.
- `Collision.ts`: `checkEnemyStompCollisions` must exclude `spiked` enemies
  from stomp registration; `checkEnemySideCollisions` (or a similar check)
  needs to catch a top-landing on a `spiked` enemy and treat it as player
  damage instead of a no-op.
- `Renderer.ts`: draw a spike overlay when `spiked` is true. **No existing
  spike asset** — needs either a new sprite (generated + chroma-keyed, same
  workflow used for `key.png`) or a simple drawn shape as a placeholder.
- Doc comments in `Enemy.ts`/`Collision.ts` that currently describe
  chain-stomping as intentional need rewriting to describe the new behavior.
- Tests: `Enemy.test.ts`, `Collision.test.ts`, `EnemyAI.test.ts`, and the
  `PlatformerPage.tsx` integration suite all assert today's chain-stomp
  behavior in places and will need new/updated cases (TDD, tests first, per
  the constitution).

Rough estimate given when this was scoped: half a day done properly (spec +
tests + implementation + comment rewrites + a real sprite), even though the
core logic change itself is small — most of the cost is the visual asset and
updating tests/comments that currently assert the opposite behavior on
purpose.

## Open questions (unresolved — needs a proper brainstorming pass)

- Cooldown duration — needs a number, playtested for feel.
- Does the cooldown reset on every additional stomp (even a fatal one, which
  doesn't matter since the enemy dies), or only apply after non-fatal stomps?
- Any player-facing tell besides the spike sprite (a color flash, a sound)?
- Does this apply only to `slimePurple`, or generically to any future
  enemy with `hitPoints > 1`?

## Next Step

Not yet a numbered roadmap step. When picked up: `brainstorming` first
(design choices above still need resolving), then `writing-plans` for a full
implementation plan (same shape as
`plans/2026-08-31-purple-slime-key-mechanic.md`), each on its own branch off
`S-006-platformer-theme` per the roadmap's branch strategy.
