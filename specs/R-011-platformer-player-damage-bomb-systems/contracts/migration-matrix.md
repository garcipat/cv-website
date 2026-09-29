# Contract — Migration Matrix

**Feature**: `R-011-platformer-player-damage-bombs` | **Spec**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

Every pre-refactor site, its exact replacement, and the parity assertion that must hold (spec
FR-006…FR-013, SC-005). Coordinates, ids and velocities are byte-identical; only the _shape_ changes.
`resolveHitEffects(target, effects)` is the one entry point.

Notation: `dmg n` = `{ type:'damage', amount:n }`; `vel x/y/dur/pj` =
`{ type:'velocity', x?, y?, duration?, preserveJump? }`; `reac [blink]` = `{ type:'reaction', blinkOnly? }`.

---

## 1. Player sources (`PlatformerPage.tsx`)

| Site (old lines)               | Guard (kept verbatim)                                                          | New effect list                                                                   | Target                            | Splatter (R-004)                                                                    | Parity test                                                               |
| ------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Lethal spear `1567-1593`       | none (bypasses i-frames); sets `spearKilled`                                   | `dmg player.hitPoints`                                                            | `playerState.value` (pre-physics) | `startSpearBloodSplatter` at `playerEffectAnchor(...,'feet')`, id `spear-<n>`       | Spear fatal suite `4115+`                                                 |
| Enemy contact `1627-1678`      | `contacts.playerEffects.length>0 && !spearKilled && !isInvulnerable(...)`      | `contacts.playerEffects` (aggregated below)                                       | `playerState.value`               | if the hit survives: `startPlayerHitSplatter` at centre, side `-knockbackDirection` | Side-hit/knockback `3627+`; crouch `3874`; splatter `5664`                |
| Enemy stomp bounce `1621-1627` | none                                                                           | `vel y=contacts.bounceY pj` (applied unguarded)                                   | `playerState.value`               | —                                                                                   | Stomp `4669+`                                                             |
| Ordinary hazard `1680-1739`    | `hazardContacts.hazard`, `!spearKilled`, `!isInvulnerable(...)`                | `dmg n`, `reac`, `vel x=away-from-hazard dur` unless `!knocksBack \|\| crouching` | `playerState.value`               | if survives: centre, side `contactSide`                                             | Spike `3799`, `3828`; crouch `3897`,`3944`,`3995`; splatter `5690`,`5710` |
| Bomb blast `2033-2075`         | (in `BombSystem`) `!bombLatched`, `!isInvulnerable(...)`, `playerInBlast(...)` | `dmg 2`, `reac`, `vel x=away-from-centre dur` unless crouching                    | `next` (post-physics)             | if survives: centre, side from direction, id `blast.hitEffectId`                    | Bomb `6322`,`6343`,`6360`; crouch `3965`                                  |
| Pit fall `2108-2125`           | `!isInvulnerable(...)` gates damage/reaction; `resolvePitFall` always runs     | `dmg 1`, `reac blink`                                                             | `next` (post-physics)             | —                                                                                   | Pit `4903`,`4935`; splatter `5737` (none)                                 |
| Debug kill `525-542`           | dev-only                                                                       | unchanged                                                                         | `playerState.value`               | —                                                                                   | Debug Kill `3512`                                                         |

### Enemy-contact aggregation (`engine/Collision.ts`)

Each contacted enemy's `effects` is `HitEffect[]`. `resolveEnemyContacts` aggregates them into two
lists so the page can keep the two existing guards: **`bounceEffects`** (velocity-only impulses from
a stomp — applied unguarded, exactly as today's `contacts.bounceVelocity` write) and **`hitEffects`**
(damage + reaction + velocity — applied under the invulnerability/spear guard). Aggregation:
**damage = max**; **`velocity.x`/`duration` = the first contact achieving the max damage** (the
`awayDirection`-signed impulse); **`velocity.y` = the strongest (most negative)** across all contacts;
`preserveJump` true if any contributor sets it; a `reaction` present when damage > 0. It also returns
`knockbackDirection` (the page's splatter side) and `damagedEnemyIds`. This reproduces today's
max-damage / strongest-bounce / first-damaging-direction rules exactly.

## 2. Enemy path

| Old                                                                                                                                 | New                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SlimeGreen`/`Bee`/`SlimePurple.onPlayerCollide` returns `{ self: takeHit(enemy), bounceVelocity }` / `{ damagePlayer, knockback }` | top: `{ selfEffects:[dmg 1, reac], effects:[vel y=DEFAULT_STOMP_BOUNCE_VY pj] }`; side: `{ effects:[dmg 1, vel x=contact.awayDirection*DEFAULT_HIT_KNOCKBACK.vx, dur=DEFAULT_HIT_KNOCKBACK.duration] }`; purple top adds `vel y=SLIME_PURPLE_SPIKE_REBOUND_VY pj` |
| `resolveEnemyContacts` reads `outcome.self`/`damagePlayer`/`knockback`/`bounceVelocity`                                             | applies `selfEffects` via `resolveHitEffects`; `damagedEnemyIds` from `damaged`; aggregates `effects` as above                                                                                                                                                    |
| `applyEnemyDamage(enemy, amount)`                                                                                                   | the enemy adapter's `damage` (one `takeHit`/point + `onDamaged`); kept, not kind-called                                                                                                                                                                           |
| `takeHit` in `shared.ts`                                                                                                            | unchanged; **no kind imports it** (guard)                                                                                                                                                                                                                         |

## 3. Block path

| Old                                                                                                | New                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bump loop: `applyBlockHit` then `resolveBlockTerminalOutcome`; `outcome.bounceVelocity` aggregated | `resolveHitEffects(block, [dmg 1])`; the outcome's `effects` lift is aggregated (`strongerBounce`) and applied to `next` as `vel y pj`; terminal applier unchanged |
| Blast: drive to terminal then terminal applier                                                     | `BombSystem` passes `dmg maxHits`; page runs the same applier                                                                                                      |
| `pot.onHit` returns `{ bounceVelocity }`                                                           | returns `{ effects:[vel y=POT_BOUNCE_VY pj] }`                                                                                                                     |

## 4. Visuals (R-004, unchanged)

Player centre/feet via `playerEffectAnchor`; enemy top via `enemyEffectAnchor` + `box.y`; explosion at
the blast centre. Ids: `player-${effectCount}`, `spear-${effectCount}`, `${enemyId}-${effectCount}`,
`blast.hitEffectId`, `blast.effectId`. Variants/colours/lifetimes/layers unchanged.

## 5. Parity invariants (SC-005)

1. Every row's resulting player/enemy/block state equals the pre-refactor state, field for field.
2. Every spawned visual (kind, coordinates, id, side, layer) equals the pre-refactor value.
3. No row's guard, order or storage target changed.
4. No assertion is deleted: `self`-based enemy assertions are rewritten to the `selfEffects` form.
