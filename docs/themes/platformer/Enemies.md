# Platformer Enemies

The code reference for the enemy family: the `EnemyType` contract, how movement resolves,
how a player contact becomes a stomp or a hit, what an enemy drops, and what it costs to
add one.

Read [Entities.md](Entities.md) first for the architecture this sits inside — the
state/type split, the capability interfaces (`Moving`, `SelfAnimated`, `Damageable`,
`DamageableType`), and the contact-resolution protocol. Character-to-marker mappings live
in [LevelFormat.md](LevelFormat.md).

Everything type-specific lives under `src/themes/platformer/entities/enemies/`:

| File | Holds |
|---|---|
| `EnemyType.ts` | `BaseEnemyState`, `EnemyType<S>`, `ItemKind` |
| `EnemyAnimation.ts` | `EnemyAnimState`, `ENEMY_ANIMATIONS`, `resolveAnimation`, frame-index helpers |
| `shared.ts` | `baseEnemyState`, `takeHit`, `baseRevive`, `ENEMY_HIT_REACTION_SECONDS`, `EnemyBaseConfig` |
| `movement/MovementStrategy.ts` | `MovementContext`, `MovementStrategy<S>` |
| `movement/patrol.ts` | `patrolMovement`, the shared `stepHorizontal` helper |
| `movement/fly.ts` | `flyMovement` (horizontal patrol + vertical bob) |
| `movement/chase.ts` | `chaseMovement` (proximity pursuit; shipped tested, used by no kind) |
| `SlimeGreen.ts` | The `slimeGreen` type and `SlimeGreenState` |
| `SlimePurple.ts` | The `slimePurple` type, `SlimePurpleState`, the spike cooldown |
| `Bee.ts` | The `bee` type, `BeeState`, `BEE_ANIMATIONS`, `BEE_SPRITE` |
| `drawSpriteSheetEntity.ts` | The sprite blit every enemy's `draw` builds on |
| `spriteSheetHitbox.ts` | The inset collision box every enemy's `box` uses |
| `index.ts` | `ENEMY_TYPES`, `EnemyTypeKey`, `EnemyState`, `typeOf` |

Generic, type-independent behavior lives outside that folder: `entities/Enemy.ts`
(factory, revive, animation advance, per-type size/offset helpers),
`engine/EnemyAI.ts` (the patrol compatibility wrapper and the hit-reaction step),
`engine/Collision.ts` (`resolveEnemyContacts`), `engine/Renderer.ts` (`drawEnemies`), and
`level/EnemyMapper.ts` (CV mapping and marker placement).

---

## `BaseEnemyState` — the per-instance state

Declared in `entities/enemies/EnemyType.ts`. It extends `EnemyPlacement`
(`level/EnemyMapper.ts` — `id`, `type`, `fact`, `extraFacts`, `x`, `y`) and composes
three capabilities from `entities/capabilities.ts`: `Moving`, `SelfAnimated`,
`Damageable`.

| Field | Type | Controls |
|---|---|---|
| `id` | `string` | Instance identity; used as the effect id at defeat and to dedup processing |
| `type` | `EnemyDef['type']` | Registry key; each type module narrows it to its own literal |
| `x`, `y` | `number` | World-pixel position of the placement tile's top-left (not the sprite's visual centre) |
| `homeX`, `homeY` | `number` | Spawn position; `revive` restores `x`/`y` from these |
| `vx`, `vy` | `number` | Velocity. `vy` is never non-zero today — enemies never leave their patrol row |
| `direction` | `'left' \| 'right'` | Patrol facing; also mirrors the sprite when `'left'` |
| `animState` | `EnemyAnimState` | `'walk'` or `'hit'` — selects which frame list is playing |
| `animFrame` | `number` | Index into that state's frame list |
| `animTimer` | `number` | Seconds accumulated toward the next frame |
| `hitPoints` | `number` | Remaining hits. Starts at the type's `maxHitPoints`, decremented by `takeHit` |
| `alive` | `boolean` | False once defeated. A dead enemy stays in the array at its index |
| `hitTimer` | `number` | Seconds since the last hit landed; drives both the reaction animation and the refractory window |
| `fact` | `CollectedFact \| undefined` | The CV fact this enemy reveals on defeat, or undefined for a plain enemy |
| `extraFacts` | `CollectedFact[] \| undefined` | Further facts owned by this marker's pool slice (see *Drops*) |
| `rewardGiven` | `boolean` | True once this enemy's one payout happened. Survives death and revive; cleared only by `resetGameProgress()` |
| `deathEffectGiven` | `boolean` | True once THIS life's defeat puff fired. Reset by `revive`, unlike `rewardGiven` |

A type module extends this with its own fields — `SlimePurpleState` adds `spiked` and
`spikeTimer`.

`hitTimer` is seeded to the type's own `hitReactionSeconds` at spawn and at revive, not
to `0`: `isInvulnerable` asks `hitTimer < reactionSeconds`, so a `0` seed would make
every enemy spawn harmless and unstompable.

---

## `EnemyType<S>` — the per-type contract

Also in `EnemyType.ts`. It extends `DamageableType<S>` (`entities/capabilities.ts`),
`WorldType<S>` and `Boxed<S>` (`entities/WorldType.ts`).

### Data fields

| Field | Type | Controls |
|---|---|---|
| `key` | `string` | Must equal this module's slot in `ENEMY_TYPES` and the state's `type` literal. Asserted by `index.test.ts` |
| `maxHitPoints` | `number` | Hits needed to defeat one (from `DamageableType`) |
| `hitReactionSeconds` | `number` | Length of the post-hit reaction *and* refractory window (from `DamageableType`) |
| `movement` | `MovementStrategy<S>` | The kind's own movement rule (see *Movement is a per-kind choice*). Required for every registered kind; the shared loop applies it and never branches on kind |
| `defaultAnimState` | `string` | The state shown at spawn, after a `hit` reaction, and whenever a requested state is missing from the kind's own table. MUST exist in `sprite.animations` (asserted by `movement/contract.test.ts`) |
| `hitboxPaddingNative` | `{ side: number; top: number; bottom: number }` | Transparent margin inside the native frame, in pre-scale pixels; insets the collision box, the movement leading edge, and the held-key/spike placement. `bottom` pulls the box's bottom edge up to the visible art's bottom and anchors the draw on the placement row; a bottom-anchored sheet declares `0` |
| `sprite` | `SpriteDescriptor` | Sheet, render scale, animation table (`entities/sprites/SpriteSheet.ts`) |
| `heldItem` | `ItemKind \| null` | What a finishing stomp drops. `ItemKind` is currently `'key'`; `null` means the enemy carries a CV fact instead |

### Function members

| Member | Signature | Responsibility |
|---|---|---|
| `create` | `(placement, index) => S` | Builds the initial live state. `index` staggers the starting resting-state frame and timer so enemies do not animate in lockstep |
| `revive` | `(enemy: S) => S` | Resets to spawn state, preserving `rewardGiven` and the animation stagger |
| `box` | `(enemy: S) => Rect` | Collision box — the visible silhouette, inset from the render slot |
| `draw` | `(enemy: S, dc: DrawContext) => void` | Renders the enemy. `Renderer.ts`'s `drawEnemies` never branches on type |
| `onPlayerCollide` | `(enemy, player, contact) => CollisionOutcome<S>` | Decides what a contact *means*. Never applies consequences |
| `onDamaged?` | `(state: S, amount: number) => S` | What a landed hit costs this type beyond the decrement. Optional |
| `onTick?` | `(enemy: S, dt: number) => S` | Per-tick state this type owns beyond patrol and hit reaction. Optional |

The two hooks are deliberately separate: `onPlayerCollide` decides meaning, `onDamaged`
pays for a hit that is already a fact. `engine/Collision.ts` calls the second only when
the first returned a `self` with fewer hit points.

### Shared helpers

`shared.ts` supplies what every type reuses:

- `ENEMY_HIT_REACTION_SECONDS = 0.4` — matches the four-frame `hit` animation at 0.1 s
  per frame. Both slimes use it as their `hitReactionSeconds`; a type wanting a longer
  stun sets a different value on its own field.
- `EnemyBaseConfig` — the per-kind numbers a life is seeded from: `maxHitPoints`,
  `hitReactionSeconds`, `defaultAnimState` and the kind's own `animations` table.
- `baseEnemyState(placement, index, config)` — everything in `BaseEnemyState` except
  `type`. Seeds `animState` from `config.defaultAnimState` and staggers `animFrame` /
  `animTimer` from **that state's own** frame count and duration.
- `takeHit(enemy)` — decrements `hitPoints`, zeroes `vx`, enters `animState: 'hit'` at
  frame 0, and zeroes `hitTimer`. It does not gate re-entry and does not decide defeat.
- `baseRevive(enemy, config)` — restores `homeX`/`homeY`, full hit points and `alive`,
  re-seeds `animState` from `config.defaultAnimState`, keeps `rewardGiven` and the
  animation stagger, and clears `deathEffectGiven`.

`spriteSheetHitbox(enemy, sprite, paddingNative)` and
`drawSpriteSheetEntity(enemy, dc, sprite, fallbackState, bottomPad?, bodyAlpha?)` are the
shared `box` and `draw` implementations. Both compute size and offsets from the
`SpriteDescriptor` directly rather than importing `entities/Enemy.ts` — `Enemy.ts`
depends on this directory through `ENEMY_TYPES`, so importing it back would create a
load-order cycle. The hitbox is bottom-anchored and horizontally centred over the
placement tile, inset by `paddingNative` scaled the same way the frame is (so a bigger
slime gets a proportionally bigger inset). Its bottom edge is pulled up to the visible
art's bottom by the `bottom` inset, and the draw's `dy` is shifted down by the same
amount (`bottomPad`) so the visible art rests on the placement row; a bottom-anchored
sheet declares `bottom: 0` and is bit-for-bit unchanged. `drawSpriteSheetEntity` resolves
the frame through `enemyFrameIndex(sprite, enemy.animState, enemy.animFrame,
fallbackState)` — a state the kind does not declare falls back to its `defaultAnimState`
(FR-009) — blits at `SLIME_BODY_ALPHA = 0.78` by default (a kind may pass `bodyAlpha: 1`,
as the bee does), and mirrors left-facing enemies with `translate`/`scale(-1, 1)`.

### The registry

`entities/enemies/index.ts`:

```ts
export const ENEMY_TYPES = { slimeGreen, slimePurple, bee };
```

`typeOf(enemy)` returns the module owning an enemy. It contains the design's single
cast: `ENEMY_TYPES` is heterogeneous, so TypeScript cannot prove that indexing by
`enemy.type` yields the entry whose state parameter matches. The invariant is guaranteed
by each module declaring `type` and `key` identically, which `index.test.ts` asserts for
every entry.

### The current three types

| | `slimeGreen` (`SlimeGreen.ts`) | `slimePurple` (`SlimePurple.ts`) | `bee` (`Bee.ts`) |
|---|---|---|---|
| `maxHitPoints` | 1 | 3 | 1 |
| `movement` | `patrol` (`speedMultiplier: 1`) | `patrol` (`speedMultiplier: 0.7`) | `fly` (speed 70, bob 6 px / 1.4 s) |
| `defaultAnimState` | `'walk'` | `'walk'` | `'fly'` |
| `sprite.renderScale` | 1 | 2 | 1 |
| `hitboxPaddingNative` | `{ side: 5, top: 9, bottom: 0 }` | `{ side: 5, top: 9, bottom: 0 }` | `{ side: 3, top: 7, bottom: 5 }` |
| `heldItem` | `null` (carries a CV fact) | `'key'` | `null` (carries nothing) |
| Extra state | — | `spiked`, `spikeTimer` | — |
| Extra hooks | — | `onTick`, `onDamaged` | — |

The slimes draw from 96×72 sheets of 24×24 frames (`SLIME_GREEN_SHEET`,
`SLIME_PURPLE_SHEET` in `entities/sprites/sheets.ts`); the bee draws from the 192×168
`BEE_SHEET` (8×7 grid of 24×24 cells), using row 5 (frames 32–39) as its flight loop.

---

## Movement is a per-kind choice

Movement is no longer one shared routine. Each kind declares a `movement:
MovementStrategy<S>` (`entities/enemies/movement/MovementStrategy.ts`):

```ts
export interface MovementContext {
  level: LevelDef;
  blockedTiles: readonly { col: number; row: number }[];
  player: { x: number; y: number; width: number; height: number } | null;
  elapsed: number;
}

export interface MovementStrategy<S extends BaseEnemyState> {
  readonly kind: 'patrol' | 'fly' | 'chase';
  step(enemy: S, ctx: MovementContext, dt: number): S;
}
```

Every strategy is a pure function of `(enemy, ctx, dt)`: it never mutates its inputs,
returns the same state shape, sets `animState` explicitly, is deterministic, treats
`dt <= 0` as a no-op, does O(1) work, and never imports `entities/Enemy.ts` or
`ENEMY_TYPES` — geometry (rendered size, tile offsets, insets) arrives through the
strategy's own config, computed from the kind's `SpriteDescriptor` + padding. That is
what keeps "add a kind" a local change.

`PlatformerPage.tsx` builds one `MovementContext` per tick (`player` from
`playerState.value`, `elapsed` from the shared `worldAnimElapsed` clock, which freezes
with the world on pause/death) and applies `typeOf(enemy).movement.step(...)`.

### `patrol` — the ground behavior

`movement/patrol.ts`'s `patrolMovement({ speedMultiplier, sprite, hitboxPaddingNative,
animState? })` is the pre-seam `stepEnemyPatrol` body, extracted verbatim so the slimes'
results are bit-for-bit unchanged (SC-001). Speed is
`PHYSICS_CONFIG.enemyPatrolSpeed * speedMultiplier`; movement is horizontal only and the
patrol row is derived once from `enemy.y` and never changes.

`engine/EnemyAI.ts` still exports `stepEnemyPatrol(enemy, level, dt, blockedTiles)` with
its exact old signature — a thin adapter that builds a `MovementContext` (`player: null`,
`elapsed: 0`) and delegates to the kind's strategy. Its only purpose is to let the
pre-seam `engine/EnemyAI.test.ts` characterization pass unedited; the game loop no
longer calls it.

### The shared horizontal helper

`patrol` and `fly` share `stepHorizontal({ x, direction, speed, checkLedges, sprite,
hitboxPaddingNative, anchorY, level, blockedTiles, dt })`. `anchorY` is the world Y whose
row the blocking test anchors on, so patrol (`anchorY: enemy.y`, `checkLedges: true`) and
fly (`anchorY: enemy.homeY`, `checkLedges: false`) share the same reversal/snapping logic
despite the bee's bob.

### The leading edge

The turn test is applied to the sprite's *visible* leading edge, not to the tile-anchor
`x` and not to the full render frame. The frame is inset by
`hitboxPaddingNative.side * RENDER_SCALE * sprite.renderScale`, the same inset the
collision box uses, so a scaled-up enemy turns where its body reaches the obstacle rather
than where its transparent margin does.

### What counts as a wall

For the tile column the leading edge is about to enter, checked at every row the
sprite's silhouette spans (`ceil((size - topPadding - bottomPadding) / RENDERED_TILE_SIZE)`
rows upward from the anchor row — a purple slime spans two, so an obstacle at head height
stops it):

1. `isSolid(tileAt(level, col, row))` — static terrain.
2. The tile is `'patrol'` — an invisible, non-solid boundary tile the player walks
   straight through, whose only effect is to turn enemies around. It has to be checked
   by name because it is never solid. It bounds only the row it is painted on.
3. `blockedTiles` contains that cell — the currently-live
   `crate`/`questionMark`/`fragileRock` blocks, which the static grid resolves to
   `'empty'` because they are a separate dynamic layer.

### What counts as a ledge

When `checkLedges` is true (patrol only), testing the anchor row alone:
`!isSolid(tileAt(level, col, row + 1))` and that cell is not in `blockedTiles`. A
patrolling enemy never walks off a platform edge.

### How turning resolves

`attempt(fromX, direction)` returns `{ blocked, nextX, snapX }`, where `snapX` is the
tile-anchor position at which the visible leading edge exactly touches the obstacle.

- Not blocked → move to `nextX`, set `vx` from the direction.
- Blocked → snap to `snapX`, then re-run `attempt` in the reversed direction:
  - the reversal is also blocked (the lane is narrower than the sprite needs on both
    sides at once) → stand still at `snapX` with `vx: 0` and the direction unchanged,
    rather than flipping every frame;
  - otherwise → adopt the reversed direction and its `vx`.

### `fly` — the bee

`movement/fly.ts`'s `flyMovement({ speed, bobAmplitude, bobPeriod, sprite,
hitboxPaddingNative, animState? })` is horizontal patrol with **no ledge check** plus a
vertical bob around the placement row. It crosses a gap a patrol reverses at, and its
height is a pure function of the shared clock:

```text
y  = homeY + bobAmplitude * sin(2π * elapsed / bobPeriod)
vy = bobAmplitude * (2π / bobPeriod) * cos(2π * elapsed / bobPeriod)
```

so at `elapsed = 0` and every whole period `y = homeY`, and `|y - homeY| <=
bobAmplitude` always. The blocking test anchors on `homeY`, not the bobbed `y`, so the
bob never changes which tiles block the bee.

### `chase` — shipped tested, used by no kind

`movement/chase.ts`'s `chaseMovement({ speed, detectRange, activeAnimState,
idleAnimState })` pursues the player box when one is in range, and idles (`vx = vy = 0`,
`idleAnimState`, direction unchanged) when `ctx.player` is `null` or out of range. No
registered kind uses it — its value is proving the seam supports a behavior that reads
the character's position (`movement/chase.test.ts`,
`movement/contract.test.ts`).

### The hit reaction step

`stepEnemyHitReaction(enemy, dt)` is a no-op for an enemy not in `'hit'`. For one in
`'hit'`, it accumulates `hitTimer`; once the type's `hitReactionSeconds` has elapsed it
either flags the enemy `alive: false` in place (no hit points left) or reverts to the
kind's own `defaultAnimState` at frame 0. It deliberately leaves `hitTimer` at its
accumulated value on revert — the same timer answers "is this enemy still untouchable?".

`PlatformerPage.tsx` picks per enemy per tick: `stepEnemyHitReaction` when
`animState === 'hit'`, `typeOf(enemy).movement.step(...)` otherwise, then the type's
`onTick`, then `advanceEnemyAnimation`.

---

## Contact classification

The geometry is computed once, by the engine, in `engine/Collision.ts`'s
`resolveEnemyContacts(player, enemies)`. Dead enemies are skipped; the player's hitbox
is tested against `typeOf(enemy).box(enemy)` with `aabbOverlap`.

The `Contact` (`engine/Contact.ts`) handed to the type carries `side`, `playerVx`,
`playerVy`, `playerBox`, `selfBox`. `ContactSide` is `'top' | 'side' | 'bottom'`; the
enemy path produces only the first two:

```ts
const landsOnUpperHalf = playerBox.y + playerBox.height <= selfBox.y + selfBox.height / 2;
const side: ContactSide = player.vy > 0 && landsOnUpperHalf ? 'top' : 'side';
```

That is: a stomp requires the player to be *falling* AND their hitbox bottom edge to be
at or above the enemy hitbox's vertical midpoint. Everything else — walked into, jumped
into from below — is `'side'`.

The type returns a `CollisionOutcome<S>` (`self?`) extending `PlayerEffects`
(`engine/Outcome.ts`: `damagePlayer?`, `bounceVelocity?`, `knockback?`).

### The outcomes the slimes and the bee produce

`slimeGreen` and `bee` are identical here (the bee is stompable like a green slime); the
purple slime adds the spike branch described later.

| Condition | Outcome |
|---|---|
| `isInvulnerable(enemy, hitReactionSeconds)` or `hitPoints <= 0` | `{}` — harmless in every way, not merely unstompable. Without this, bouncing off a stomp while still overlapping registers as a spurious side hit against the enemy just stomped |
| `contact.side === 'top'` | `{ self: takeHit(enemy), bounceVelocity: PHYSICS_CONFIG.stompBounceVelocity }` (−330 px/s) |
| any other side | `{ damagePlayer: 1, knockback: 'away' }` |

`damagePlayer` is in half-heart units and matches `SIDE_HIT_DAMAGE` in
`entities/Health.ts` (1 of `MAX_HALF_HEARTS = 6`). No enemy knows the player's
invincibility window exists — the engine drops the damage while the player is
invulnerable.

### Aggregation

Owned by `resolveEnemyContacts` and nowhere else:

- at most one damage per tick regardless of how many enemies are touched (max, not sum);
- the strongest requested bounce wins (`strongerBounce` — most negative, not last), so
  the result does not depend on array order;
- knockback ranks `'awayAndUp' > 'away' > 'none'`;
- `knockbackDirection` (−1 left, 1 right) comes from the first damaging contact's
  hitbox centres.

When a returned `self` has fewer hit points than the input, the engine then applies the
type's `onDamaged` to it.

---

## Hit counts and multi-hit enemies

`maxHitPoints` on the type is the whole mechanism. `create` seeds `hitPoints` from it;
`takeHit` decrements it; `stepEnemyHitReaction` reads it once the reaction animation
finishes and only then decides defeat. The player therefore always sees the same brief
stunned reaction whether or not the hit was the finishing blow.

A green slime has 1 hit point, so it can never survive a stomp. A purple slime has 3,
which is what makes the spike cooldown reachable at all.

During the reaction, `isInvulnerable` (`hitTimer < hitReactionSeconds`) makes the enemy
both unhittable and harmless, so a stomp followed immediately by the bounce cannot
register as a second contact. `takeHit` also zeroes `vx`, freezing the enemy for the
reaction.

---

## Drops

An enemy pays out exactly once per session. The defeat handler lives in
`PlatformerPage.tsx`, selecting `!alive && !deathEffectGiven` each tick.

### A key

Declared by `heldItem: 'key'` on the type. The handler branches on
`typeOf(enemy).heldItem === 'key'`: it always emits a puff, and spawns a key pickup at
the enemy's position (`spawnKeyPickup`, `entities/KeyPickup.ts`) only when
`rewardGiven` is still false. A purple slime carries no CV fact at all.

While a purple slime still holds its key (`!rewardGiven`), `SlimePurple.ts`'s `draw`
composites `KEY_SHEET` inside the slime's body before blitting the body — sized to
`SLIME_PURPLE_HELD_KEY_HEIGHT_RATIO` (0.5) of the silhouette height, at the key
sprite's native aspect ratio, nudged down from centre by
`SLIME_PURPLE_HELD_KEY_Y_NUDGE`. It is centred against the *silhouette* (the
padding-inset box), not the mostly-transparent render square. The body's 0.78 alpha is
what lets the key show through.

### A CV fact

Declared by `heldItem: null`; the fact rides on the state (`fact`, `extraFacts`).
`level/EnemyMapper.ts` owns the mapping:

- `mapCVDataToEnemies(cv)` produces one green-slime `EnemyDef` per `cv.courses` entry,
  each with a `CollectedFact` of `sectionId: 'courses'`, `sourceType: 'enemy'`.
- `placeEnemies(defs, markers)` places markers. `placeGreenSlimes` gives each green
  marker a **fixed, position-based slice** of the course pool via
  `revealedFactCountFor` (`level/SkillFactPacing.ts`) — the same proportional formula
  coins use. One marker and several courses means that marker owns the whole pool
  (`fact` plus the rest in `extraFacts`); more markers than courses means some markers
  own nothing and are fully functional, killable enemies with no reward. The assignment
  is load-time, not play-order dependent.
- `placePurpleSlimes` produces plain, position-derived placements with no fact.

Certificates and Projects come from question-mark blocks, not enemies.

At defeat, a fresh green-slime kill emits a puff and calls the shared reveal trigger
(`engine/RewardReveal.ts`'s `createRewardReveal`) once per fact, with a per-fact
`effectId` of `` `${enemy.id}-${index}` ``. That trigger is the one place that turns a
reveal into `collectedFacts`, a flight effect and a counter popup — every fact-revealing
site in the game routes through it. The enemy site passes **no** `counterKey`: the
`enemies` counter popup is bumped separately, once per tick in which any **green slime**
was defeated (the bump is gated on `type === 'slimeGreen'`), so slimes carrying zero
facts still produce "defeated / total" feedback while a defeated bee — which pays nothing
— never bumps it. `enemiesDefeated` (`PlatformerState.ts`) counts green slimes with
`rewardGiven`, and `levelTotals.enemies` counts green placements; bees count toward
neither (FR-013/SC-008).

### Nothing at all

A bee declares `heldItem: null` and carries no `fact`. It still emits its defeat puff
(a defeat is a world event regardless of reward), but banks no fact, drops no item, and
moves neither the enemies counter nor completion.

### Once-per-life versus once-ever

`rewardGiven` is permanent (only the Reset Game button clears it, by rebuilding the
array from placements) and is set for *every* defeated enemy, including plain ones and
key droppers — the drop is that enemy's one payout. `deathEffectGiven` is reset by
`revive`, so a revived-and-redefeated enemy still gets a defeat puff while giving
nothing further.

---

## The spike cooldown

`SlimePurple.ts` only. A temporary state that inverts the stomp outcome for a window.

State: `spiked: boolean` and `spikeTimer: number` on `SlimePurpleState`.

**Set** in `onDamaged`, which runs after a landed hit:

```ts
onDamaged: (enemy) => ({ ...enemy, spiked: enemy.hitPoints > 0, spikeTimer: 0 }),
```

Surviving a hit grows spikes; any fresh hit restarts the cooldown; a finishing hit grows
nothing, so a corpse never shows spikes.

**Read** in `onPlayerCollide`, ahead of the side test — while `spiked`, *every* contact
damages the player, and a top contact asks for `knockback: 'awayAndUp'` rather than
`'away'` so a failed stomp reads as bouncing off the spikes rather than as an ordinary
side touch:

```ts
if (enemy.spiked) {
  return { damagePlayer: 1, knockback: contact.side === 'top' ? 'awayAndUp' : 'away' };
}
```

**Cleared** in `onTick`, which is a no-op (same reference) while not `spiked` and
otherwise accumulates `spikeTimer` until `SPIKE_COOLDOWN_DURATION_SECONDS`. This timer
runs independently of `animState`/`hitTimer` — the slime keeps counting toward the
cooldown's end while patrolling normally.

The duration is the sum of three explicit phases, not an independent value, so the slime
becomes stompable again exactly when the retract animation finishes:

| Constant | Value | Phase |
|---|---|---|
| `SPIKE_GROW_DURATION_SECONDS` | 0.25 | Spikes pop out, scale 0 → 1 |
| `SPIKE_HOLD_DURATION_SECONDS` | 0.25 | Held fully extended at scale 1 |
| `SPIKE_RETRACT_DURATION_SECONDS` | 0.4 | Retract, scale 1 → 0 (slower than the grow, deliberately) |
| `SPIKE_COOLDOWN_DURATION_SECONDS` | 0.9 | The sum — how long `spiked` lasts |

`spikeGrowthScale(spikeTimer)` returns that 0–1–0 curve, clamped to 0 at or past the
total. `drawSpikes` renders four `SPIKE_COLORS`-tinted triangles — two out of the top
edge at `TOP_SPIKE_FRACTIONS` (0.3, 0.7) and one out of each side edge — positioned
against the padding-inset silhouette, with each triangle's base sunk into the box so the
visible part reads as breaking the surface. It is called from `draw` only while
`alive && spiked`.

Only `slimePurple` ever spikes: a green slime has 1 hit point and so never survives a
stomp to reach the state.

Behavior is covered by `SlimePurple.test.ts`.

---

## Sprites and animation states

A sheet is registered once in `entities/sprites/sheets.ts` as a `SpriteSheet`
(`src`, `frameWidth`, `frameHeight`, `columns`). A type points at one through its
`sprite: SpriteDescriptor` — `{ sheet, renderScale, animations }`. Frames are **indices**
into the sheet, resolved by `frameSource`, so an animation crossing a row boundary needs
no special handling.

`entities/enemies/EnemyAnimation.ts` declares the table the slimes share and the
resolver every kind goes through:

```ts
export type EnemyAnimState = string; // widened: each kind names its own states

export const ENEMY_ANIMATIONS = {
  walk: { frames: [3, 4, 5, 6, 7], frameDuration: 0.15 },
  hit:  { frames: [8, 9, 10, 11],  frameDuration: 0.1  },
};
```

There is no idle state for a slime — patrol is constant-slide movement, so an enemy is
always in motion, and the frames 3–7 loop reads fine as walking. The `hit` loop's four
frames at 0.1 s each is exactly `ENEMY_HIT_REACTION_SECONDS`. The bee authors its own
table instead (`BEE_ANIMATIONS` in `Bee.ts`): `fly` frames 32–39 at 0.12 s, and **no
`hit` row** — FR-009's fallback reuses `fly` during its reaction.

Animation is a per-kind choice, resolved through the kind's own `sprite.animations`:

- `resolveAnimation(sprite, state, fallbackState)` returns
  `sprite.animations[state] ?? sprite.animations[fallbackState]` — the resting-state
  fallback (FR-009). Never returns `undefined` for a kind whose `defaultAnimState` exists
  in its own table.
- `enemyFrameIndex(sprite, state, frame, fallbackState)` maps state plus counter to a
  sheet index, through the resolved animation.
- `advanceEnemyAnimation(enemy, dt)` (`entities/Enemy.ts`) reads
  `resolveAnimation(typeOf(enemy).sprite, enemy.animState, typeOf(enemy).defaultAnimState)`
  and advances the per-instance timer, wrapping at that animation's frame count.
- `baseEnemyState`/`baseRevive` seed `animState` from the kind's `defaultAnimState` and
  stagger from that state's own frame count/duration — not a hardcoded `walk`.

The fallback lives on the **draw** path too, not only the per-tick advance:
`drawSpriteSheetEntity(..., fallbackState, ...)` resolves the frame through the kind's
descriptor, so a freshly hit bee (whose table has no `hit` row) is drawn with `fly`
frames before any `advanceEnemyAnimation` runs. Each kind's `draw` passes its own
`defaultAnimState` as the fallback (slimes `'walk'`, bee `'fly'`).

Asset loading needs no edit: `collectSheetSources` walks `ENEMY_TYPES` and the other
registries and derives the image list from each type's `sprite.sheet`. A *secondary*
sheet that is no type's primary descriptor — `KEY_SHEET`, used by a purple slime's
held-key overlay — cannot be discovered that way and is hand-listed in
`PlatformerPage.tsx`'s loader.

Per-type geometry helpers in `entities/Enemy.ts` all derive from the descriptor and the
padding, so nothing hardcodes a size: `enemyRenderedSize`, `enemyTileOffsetX`,
`enemyTileOffsetY`, `enemyHitboxSidePadding`, `enemyHitboxTopPadding`,
`enemyHitboxBottomPadding`, and `enemyEffectAnchor` (the puff anchor, centred on the
collision box and scaled relative to a green slime's size).

---

## Adding an enemy

The design target is one new module plus one registry line. The rest of the list is the
level format and the editor, which are keyed by character rather than by type.

**Required — the enemy itself**

1. **`src/themes/platformer/entities/enemies/<Name>.ts`** — export a state interface
   extending `BaseEnemyState` with a narrowed `type` literal, and a
   `EnemyType<YourState>` constant. Reuse `baseEnemyState`, `baseRevive`, `takeHit` and
   `ENEMY_HIT_REACTION_SECONDS` from `shared.ts`, `spriteSheetHitbox` for `box` and
   `drawSpriteSheetEntity` for `draw`. `key` must equal the `type` literal. Declare
   `movement` (an existing strategy, configured, or a new module — never a branch in a
   shared file) and a `defaultAnimState` present in the kind's own `sprite.animations`.
2. **`src/themes/platformer/entities/enemies/index.ts`** — add the module to
   `ENEMY_TYPES`. `EnemyTypeKey`, `EnemyState` and `EnemyDef['type']` widen automatically.
3. **`src/themes/platformer/entities/sprites/sheets.ts`** — register the sheet if it is
   a new image. Put the asset in `public/sprites/`. No loader edit is needed as long as
   the sheet is the type's primary `sprite.sheet`.

A **new movement strategy** (only if none of `patrol`/`fly`/`chase` fits) is a new module
under `entities/enemies/movement/`, exporting a factory that returns a
`MovementStrategy<S>` — plus its own unit test. `types.ts` is **no longer** on the list:
`EnemyDef['type']` derives from `EnemyTypeKey`, so registering the kind widens the
placement union for free.

**Required — placing it in a level** (character table: [LevelFormat.md](LevelFormat.md))

5. **`src/themes/platformer/level/LevelParser.ts`** — add the literal to `EntityKind`,
   add the character to `ENTITY_CHARS` (a character already owned by the terrain, sign
   or hazard map throws at module load), add it to the `TileChar` union, and add a
   `find…EnemyTiles` finder alongside `findGreenEnemyTiles`/`findPurpleEnemyTiles`.
6. **`src/themes/platformer/level/level.ts`** — export a computed of the new marker
   positions from `currentLayout`.
7. **`src/themes/platformer/level/EnemyMapper.ts`** — add a key to
   `EnemyMarkerPositions` and a placement function, and call it from `placeEnemies`.
   Decide whether the type carries CV facts (a pool slice, like `placeGreenSlimes`) or
   nothing (like `placePurpleSlimes`).
8. **`src/themes/platformer/PlatformerState.ts`** — pass the new marker list into
   `placeEnemies`, and extend `levelTotals`/`enemiesDefeated` if the type should count
   toward the enemies HUD counter.

**Required — the editor palette**

9. **`src/themes/platformer/editor/paletteTiles.ts`** — add entries to
   `PALETTE_TILE_SPRITES`, `PALETTE_TILE_LABELS` and `PALETTE_TILE_DESCRIPTIONS`. All
   three are `Record<TileChar, …>`, so a missing entry is a compile error. The palette
   *button* itself needs no code: `Palette.tsx` derives its entity section from
   `ENTITY_CHARS`.
10. **`src/themes/platformer/editor/gridRenderState.ts`** — add a
    `synthesizeEnemyPlacements` call for the new character in `synthesizeEnemyStates`,
    so the marker previews as a real sprite on the editor canvas.
11. **`src/themes/platformer/editor/EditorCanvas.tsx`** and
    **`EditorCanvasPane.tsx`** — add the sheet to `EditorImages` and to `EMPTY_IMAGES`/
    `IMAGE_SOURCES`, and map it into the sprite lookup passed to the draw context.

**Not required.** `engine/Collision.ts`, `engine/Renderer.ts`, `engine/EnemyAI.ts` and
the enemy stepping in `PlatformerPage.tsx` all dispatch through `typeOf` and never
branch on type. The defeat handler branches only on `heldItem`, so an enemy that drops a
key or reveals a fact is already covered; a genuinely new drop kind means widening
`ItemKind` and adding a branch there. The `enemies` counter bump is gated on
`slimeGreen`, so a new fact-less kind counts toward nothing without editing it.

**Tests.** `index.test.ts` already asserts the `key`/`type` invariant for every registry
entry, `movement/contract.test.ts` asserts every kind declares a movement and a resting
state in its own table and drives a fixture kind end-to-end, and
`EnemyContact.contract.test.ts` (`src/themes/platformer/engine/`) holds the contact
contract every type must satisfy — all pick the new type up automatically.
Type-specific behavior gets its own file alongside the module, as `SlimePurple.test.ts`
and `Bee.test.ts` do. `shared.test.ts` covers the shared helpers.
