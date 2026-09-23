# Contract: the crouched hit reaction (FR-011 / FR-016 / SC-009)

A directional hit taken while crouched must cost health and read as a hit, but
must not move the character and must never force it to stand into a ceiling.
The red reaction is shown on the crouch pose by a reusable render-time tint, not
by new red-tinted art, and the standing hit's baked red frame is left unchanged.

This contract is the single reference for the three requirements; the mechanics
are also covered from the physics side
([crouch-physics.md](./crouch-physics.md)) and the rendering side
([rendering-animation.md](./rendering-animation.md)).

## 1. Damage and the invulnerability window (unchanged mechanics)

- Damage is still `takeDamage(player.hitPoints, amount)` at the caller
  (`PlatformerPage.tsx`), exactly as for a standing hit; a crouched hit costs
  health (SC-009).
- The refractory window is still `hitTimer`, set to `0` by the helper, so
  `isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)` is true immediately and
  further hits are dropped for the window (FR-011).

## 2. No knockback (FR-011, SC-009)

`applyHitReaction(player)` (`entities/Player.ts`) returns:

```ts
{ ...player, hitTimer: 0, animState: 'hit', animFrame: 0, animTimer: 0 }
```

It deliberately leaves `vx`, `direction`, `knockbackTimer`, `vy` and
`bounceAscending` untouched. Consequences:

- The hit imparts no horizontal or vertical displacement; the character's
  position at the moment of the hit is unchanged.
- The enemy contact's `awayAndUp` branch (which sets `vy` +
  `bounceAscending`) is skipped while crouched, so there is no vertical push
  either.
- A held crawl key still drives `PHYSICS_CONFIG.crouchSpeed` on later ticks
  (`knockbackTimer` is 0, so input is not overridden) — "no knockback" is not a
  movement lock.

The three directional sites branch on `player.crouching`:

| Site | Standing (unchanged) | Crouched |
| --- | --- | --- |
| Enemy contact (`PlatformerPage.tsx` ~L1741) | `applyHitReaction(player, knockback)` (+ `awayAndUp` `vy`) | `applyHitReaction(player)` (no `vy`) |
| Non-floor-spike hazard (~L1819) | `applyHitReaction(player, knockback)` | `applyHitReaction(player)` |
| Bomb blast (~L2163) | `applyHitReaction(player, knockback)` | `applyHitReaction(player)` |

The floor-spike hazard also uses `applyHitReaction(player)` — the same red
reaction with no knockback (FR-006). The transparent blink is pit falls only
(`beginPitFallReaction`).

## 3. The one-tile box for the whole reaction (FR-011)

`resolveCrouching` returns `currentlyCrouching` unchanged while
`inHitReaction` is true (`isInvulnerable(player, PLAYER_HIT_REACTION_SECONDS)`).
Because the helper sets `hitTimer` to 0, that window is exactly the reaction,
so the crouched box can never be forced open into a ceiling by a hit — even
though the character may be moving or the space above may be occupied.

## 4. The red reaction on the crouch pose (FR-016)

- `animState` is set to `'hit'`, so the reaction is visible (a `hit` state is
  never blinked) and the sticky-hit derivation still holds.
- `Renderer.drawPlayer` detects `player.crouching && player.animState ===
  'hit'` and draws the **crouch** pose (`playerFrameSource('crouch', ...)`,
  DUCK row), tinted red by `drawTintedSprite` (`source-atop` over a caller-owned
  offscreen layer).
- **No new red-tinted crouch sprite art is authored.** `ANIM_CONFIG.crouch` is
  unchanged by the tint.
- The **standing** hit reaction is unchanged: with `crouching: false`,
  `drawPlayer` still draws the baked red frame at `sy = PLAYER_FRAME_SIZE * 6`
  from `hitFrameFromTimer`. The two are deliberately not unified (FR-016).

## Invariants (asserted by `Player.test.ts` / `Renderer.test.ts` / `PlatformerPage.test.tsx`)

1. `applyHitReaction` leaves `vx`, `direction`,
   `knockbackTimer`, `vy` and `bounceAscending` identical to the input, and sets
   `hitTimer: 0`, `animState: 'hit'`, `animFrame: 0`, `animTimer: 0`.
2. After the helper, `isInvulnerable(result, PLAYER_HIT_REACTION_SECONDS)` is
   true and `resolveCrouching` returns the pre-hit crouch value.
3. A crouched enemy/hazard/blast hit does not change `x`, `y`, `vx`, `direction`
   or `vy` at the moment it lands; a standing one still applies `vx`/`vy`.
4. A crouched `awayAndUp` contact sets no `vy` and no `bounceAscending`; a
   standing one still does.
5. `drawPlayer` with `crouching: true, animState: 'hit'` and a tint layer draws
   the `crouch` row through the tinted layer; with `crouching: false,
   animState: 'hit'` it draws the baked `hit` frame directly and never calls the
   layer.
6. The floor-spike hit also shows the red reaction (`applyHitReaction(player)`,
   no knockback) — only a pit fall blinks (`beginPitFallReaction`).
