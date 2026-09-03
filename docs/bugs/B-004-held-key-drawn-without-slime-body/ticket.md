# Bug Ticket: Held key can draw with no slime body during asset load

**Bug ID**: B-004
**Found In**: S-006 (Platformer theme), entity architecture work
**Status**: Resolved
**Severity**: Trivial (visible for at most a frame or two, only on first load)

## Description

A purple slime that has not yet paid out its reward draws a key "shining through" its
body. In `src/themes/platformer/entities/enemies/SlimePurple.ts`, that overlay is gated
on the KEY sheet being loaded and on `!enemy.rewardGiven`, but **not** on the slime's own
body sheet being loaded.

`slime_purple.png` and `key.png` are fetched as two independent promises, so there is a
reachable window where the key image has resolved and the body image has not. In that
window the overlay renders a floating key with no slime under it.

Bounded to the first-mount asset-load race — at most a frame or two, and only before
both images resolve. It cannot recur once loaded.

## Suggested Fix

Gate the held-key overlay on the body sheet as well, so the overlay never draws without
the sprite it is supposed to shine through. The body blit already returns early when
its image is null (`entities/enemies/drawSpriteSheetEntity.ts`); the overlay needs the
same condition.

Add a `Renderer.test.ts` case covering the mixed-load state — key sheet present, body
sheet null — asserting no key `drawImage` call. The existing tests cover both sheets
present and both absent, but not the mixed case, which is why this slipped through.

## Resolution

`SlimePurple.ts`'s `showsHeldKey` now also requires `dc.sprites[SLIME_PURPLE_SHEET.src]
!= null`, matching the suggested fix exactly — the overlay no longer draws until both
the key sheet and the slime's own body sheet have loaded. Added
`keySpriteLoadedBeforeBodySprite-purpleSlimeDrawsNoFloatingKey` to `Renderer.test.ts`
covering the mixed-load state (key sheet present, body sheet absent), asserting zero
`drawImage` calls; written first and confirmed failing against the old gate before the
fix landed.
