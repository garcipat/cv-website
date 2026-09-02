# Bug Ticket: Defeat/break puff fires on the CV reward, not on the world event

**Bug ID**: B-003
**Found In**: S-006 (Platformer theme), entity architecture work
**Status**: Open
**Severity**: Minor (visual feedback missing in reachable cases)

## Description

The sparkle "puff" (`startFlightEffect`, drawn by `drawCollectionEffects`) is emitted
only on the code path that banks a CV fact into the journal. It is therefore missing
wherever something happens in the world without a fact attached:

- A **purple slime never puffs on defeat.** It drops a key pickup instead of carrying a
  fact, so the defeat handler in `PlatformerPage.tsx` takes the item-drop branch and
  `continue`s before any effect is started.
- A **green slime defeated a second time doesn't puff.** After a player death and
  respawn it is revived and killable again, but `rewardGiven` is already true, so it is
  not selected into `justDefeated` and no effect fires.

This is pre-existing behavior, not a regression from the entity refactor. Before
`rewardGiven` existed the guard was `if (!fact || newFacts.some(f => f.id === fact.id))
continue;`, which skipped the effect at the identical point.

The coupling has already forced one workaround: `fragileRock` blocks break with no fact
and no reward, so `PlatformerPage.tsx` gives them a hand-rolled puff — an empty-label
`startFlightEffect` with all coordinates equal, so nothing flies and only the sparkle
burst renders. That workaround existing is the evidence the abstraction is inverted.

## Suggested Fix

Bind the puff to the **world event**, not to the reward. One seam that emits a puff at
a world position, called wherever something happens — enemy defeated, block broken,
pickup collected, chest opened. The journal fact-flight stays a separate layer that
fires only when a fact is actually awarded, so a fact-bearing event shows both effects
and a factless one still puffs. The `fragileRock` special case then folds into the
general mechanism instead of being duplicated per case.

Notes for whoever picks this up:

- `startFlightEffect` and the effect model live in `src/themes/platformer/engine/CollectionEffects.ts`;
  rendering is `drawCollectionEffects` in `engine/Renderer.ts`, which reads
  `effect.startX`/`startY` independently of `effect.text`.
- Puffs should be centred on the entity, not its top-left corner. Enemies have per-type
  render scales — see `enemyRenderedSize` / `enemyTileOffsetX` / `enemyTileOffsetY` in
  `entities/Enemy.ts`. Pickups and blocks expose their own boxes via their type modules.
- A fact-bearing event must not end up with two overlapping bursts.
- Every family now has a type module with hooks to attach this to
  (`entities/enemies/`, `entities/pickups/`, `entities/blocks/`, `entities/chests/`),
  which makes this substantially cheaper than it would have been before that work.

This is a design change, so start with `superpowers:brainstorming` to agree the seam,
then a spec under `specs/S-006-platformer-theme/`. Follow the constitution: TDD with the
failing test first, TypeScript strict with no `any`.

## Related

- `docs/themes/platformer/EntityFollowUps.md` —
  listed there as the highest-value remaining item.
