# Entity Architecture — Design

**Status:** approved design, staged across three implementation plans.

**Goal:** Make every world object — enemies, the player, blocks, chests, pickups
— share one entity model, and make each concrete type fully self-contained: its
data, its mechanics, and its rendering all live in one module. Adding a new
enemy, block, or item becomes "one new file, one registry line, one sprite
asset."

## Problem

Two distinct defects, one of which causes the other.

### 1. Enemies have no persistent identity

`resetGame()` rebuilds the enemy array from scratch on every player death:

```ts
enemyStates.value = enemyPlacements.value.map((p, i) => toEnemyState(p, i));
```

and the game loop removes defeated enemies entirely:

```ts
enemyStates.value = enemyStates.value.filter((e) => !e.defeated);
```

An enemy therefore has no memory of anything that happened to it. Every fact
about an enemy's past — "this slime already paid out its key", "this slime
already banked its fact" — has to be stored somewhere else, keyed by id:

- `keyPickupStates` doubles as the drop ledger (`some((k) => k.id === enemy.id)`)
- `collectedFacts` doubles as the fact ledger (`some((f) => f.id === fact.id)`)
- `droppedKeyEnemyIds` is rebuilt as a `Set` inside the render path every frame,
  solely to decide whether to draw a held key

Three collections encode "what happened to enemy X", none of them owned by
enemy X. The guards work today, but every new per-enemy mechanic needs a fourth
such ledger, and each one is a place the dedup can be forgotten.

### 2. Per-type behavior is scattered across five files

A single enemy type's definition is spread over:

- `entities/Enemy.ts` — three parallel `Record<spriteType, number>` lookups
  (`ENEMY_RENDER_SCALE`, `ENEMY_PATROL_SPEED_MULTIPLIER`, `ENEMY_HIT_POINTS`)
  plus flat hitbox padding constants
- `engine/Renderer.ts` — a sprite-selection ternary, a `SPIKE_COLORS` record
  (whose `slimeGreen` entry is unreachable), and held-key drawing gated on
  `spriteType === 'slimePurple'`
- `engine/Collision.ts` — `enemy.spiked` read in four places across three
  functions that each re-derive the same overlap geometry
- `engine/EnemyAI.ts` — spike cooldown constants and `stepEnemySpikeCooldown`
- `PlatformerPage.tsx` — one sprite ref per type, plus a hardcoded
  `spriteType === 'slimePurple'` branch in the defeat handler

The spike mechanic belongs to one enemy but is mentioned in four modules.
`isSpikedTopLanding`'s own doc comment states the problem outright:
*"Deliberately re-derives the same geometry rather than having
`checkEnemySideCollisions` return richer per-hit metadata."*

## Decisions

| Decision | Choice |
|---|---|
| Behavior model | Plain immutable data + per-type modules exposing hook functions. Not classes. |
| Identity | Persistent fixed-length array; index-stable. No id is read by game logic. |
| State ownership | Stays in `@preact/signals-react` signals, updated immutably. |
| Scope | Enemies, player, pickups, blocks, chests. |
| Revive rule | A revived enemy returns to max HP and is killable, but never rewards twice. |

### Why data + modules rather than classes

Mutable class instances are invisible to signals, which compare by reference —
a mutation would notify no subscriber, so the signal would have to be reassigned
anyway. Beyond that, the ~2,850 lines of tests across `Enemy.test.ts`,
`EnemyAI.test.ts`, `Collision.test.ts`, and `Renderer.test.ts` are written as
"call a pure function, assert on the returned object"; methods on instances
would mean rewriting all of them for zero behavior change. Entity state also
stays plain serializable data, which the O-002 level editor needs.

Self-containment — the property that motivated wanting classes — is delivered
by putting each type's data *and* its hooks *and* its `draw` in one module,
indexed by a registry that is nothing more than a barrel file.

### Why identity is positional, not an id

Immutable updates replace the enemy object every tick, so identity cannot be
object reference. It does not need to be an id either: if the array is built
once and never has entries added or removed, index N is the same enemy for the
entire session. Removal is replaced by an `alive: false` flag.

## Architecture

### Entity base

```ts
// entities/Entity.ts
export type Direction = 'left' | 'right';
export interface Rect { x: number; y: number; width: number; height: number }

export interface Entity {
  /** Key into this family's type registry. */
  type: string;
  /** Render-slot top-left, world pixels. */
  x: number; y: number;
  vx: number; vy: number;
  direction: Direction;
  animState: string;
  animFrame: number;
  animTimer: number;
}

export interface Damageable {
  hitPoints: number;
  alive: boolean;
}
```

`hitbox(entity)` and `spriteBox(entity)` are **derived functions**, not stored
fields. A stored box is a second copy of the position that must be re-synced on
every position update, and a missed sync is a silent collision bug. Derived,
they are pure functions of `type + x + y` and cannot drift.

### Enemy state

```ts
export interface BaseEnemyState extends Entity, Damageable {
  type: EnemyTypeKey;
  animState: EnemyAnimState;
  /** Spawn position; `revive` restores x/y from these. */
  homeX: number; homeY: number;
  hitTimer: number;
  fact?: CollectedFact;
  /** Persistent across death and respawn; cleared only by resetGameProgress().
   *  This is the ledger that previously lived in keyPickupStates and
   *  collectedFacts. */
  rewardGiven: boolean;
}
```

`defeated` is replaced by `alive`. `spiked` and `spikeTimer` are **not** here —
they belong to the one type that has spikes (see below).

### Lifecycle rules

1. `enemyStates` is built once at module load. Its length never changes again.
2. No `filter`. Dead enemies stay in the array with `alive: false`; render and
   collision skip them.
3. A reward fires exactly once, ever:
   ```ts
   const justDefeated = enemyStates.value.filter((e) => !e.alive && !e.rewardGiven);
   // run the type's onDefeat hook, then set rewardGiven = true
   ```
   A revived enemy stomped again has `alive: false, rewardGiven: true` and is
   not selected. No id lookup, no dedup set.
4. `resetGame()` (death) maps, never rebuilds:
   ```ts
   enemyStates.value = enemyStates.value.map(reviveEnemy);
   ```
   `reviveEnemy` restores `x/y` from `homeX/homeY`, `hitPoints` from the type's
   config, `alive` to `true`, and zeroes the animation and mechanic timers. It
   leaves `rewardGiven` alone.
5. `resetGameProgress()` (Reset Game button) is the only place a rebuild from
   placements is legal.

### Type modules and the registry

One file per concrete type. `entities/enemies/SlimePurple.ts` holds purple's
state shape, its numbers, its spike mechanic, and its rendering.

```ts
// entities/enemies/index.ts — the whole registry
export const ENEMY_TYPES = { slimeGreen, slimePurple };
```

```ts
export interface EnemyType<S extends BaseEnemyState> {
  // data
  maxHitPoints: number;
  renderScale: number;
  patrolSpeedMultiplier: number;
  hitboxPaddingNative: { side: number; top: number };
  spriteAssetPath: string;
  heldItem: ItemKind | null;

  // lifecycle
  create(placement: EnemyPlacement, index: number): S;
  revive(enemy: S): S;

  // behavior
  onTick?(enemy: S, dt: number): S;
  onPlayerCollide(enemy: S, player: PlayerState, contact: Contact): CollisionOutcome<S>;
  onDefeat?(enemy: S, world: WorldApi): void;

  // rendering
  draw(enemy: S, dc: DrawContext): void;
}
```

### Rendering owned by the type

`Renderer.ts` keeps only the iteration and the camera transform, handing each
entity a context:

```ts
export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  sprites: SpriteLookup;      // loaded images, keyed by type
  originX: number; originY: number;
  worldElapsed: number;       // drives bob/pulse effects
}
```

`SlimeGreen.draw` is one call to the shared `drawSpriteSheetEntity` helper.
`SlimePurple.draw` calls the same helper, then draws its spike overlay and
held-item shine on top. This removes the sprite ternary, `SPIKE_COLORS`, both
sprite refs in `PlatformerPage.tsx`, and the `droppedKeyEnemyIds` parameter.

### Contact resolution

The engine computes **geometry**; the type decides **consequences**.

```ts
// engine/Contact.ts
export type ContactSide = 'top' | 'side' | 'bottom';

export interface Contact {
  /** 'top' iff the player is falling and its hitbox bottom edge is at or above
   *  the entity hitbox's vertical midpoint — the exact rule today's three
   *  collision functions each re-derive independently. */
  side: ContactSide;
  playerVx: number; playerVy: number;
  playerBox: Rect; selfBox: Rect;
}

export interface CollisionOutcome<S> {
  self?: S;                 // replacement state — took damage, grew spikes, …
  damagePlayer?: number;    // half-hearts
  bouncePlayer?: boolean;   // successful stomp
  knockback?: 'none' | 'away' | 'awayAndUp';
}
```

Green slime, complete:

```ts
onPlayerCollide(enemy, _player, contact) {
  if (contact.side === 'top') return { self: takeHit(enemy), bouncePlayer: true };
  return { damagePlayer: 1, knockback: 'away' };
}
```

Purple slime, complete — the entire consequence of the spike mechanic:

```ts
onPlayerCollide(enemy, _player, contact) {
  if (enemy.spiked) {
    // a failed stomp should read as bouncing off the spikes, not a plain touch
    return { damagePlayer: 1, knockback: contact.side === 'top' ? 'awayAndUp' : 'away' };
  }
  if (contact.side === 'top') return { self: takeHit(enemy), bouncePlayer: true };
  return { damagePlayer: 1, knockback: 'away' };
}
```

`checkEnemyStompCollisions`, `checkEnemySideCollisions`, and
`isSpikedTopLanding` collapse into one `resolveEnemyContacts`. The word
"spiked" then appears in exactly one file.

Returning a description rather than mutating keeps the hook pure — trivially
testable, with no signals and no canvas — and keeps the engine the only thing
that writes to signals.

**The engine retains three responsibilities**, deliberately not delegated:

- **Invincibility.** `damagePlayer` is dropped while `player.invincibleTimer > 0`.
  No type ever knows this exists.
- **Multi-contact aggregation.** Touching two enemies in one tick applies at
  most one damage, applies a bounce if any outcome requests one, and merges
  every returned `self`.
- **`!alive` skip.** Dead entities are not consulted.

"Harmless while playing its hit reaction" is *not* an engine flag — that would
reintroduce the leak this design removes. It lives in a shared `stunnedGuard`
helper that type modules compose, so types opt into shared behavior rather than
the engine encoding it.

### Type variance

`spiked`/`spikeTimer` live in `SlimePurpleState`, declared in
`SlimePurple.ts` alongside the mechanic that uses them. `EnemyState` is a
discriminated union over `type`, which falls out naturally from
self-containment.

Dispatching over a registry whose entries have different state types cannot be
proven sound by TypeScript. Resolution: one generic dispatcher function
containing a single documented cast (`ENEMY_TYPES[e.type] as EnemyType<typeof e>`).
This is a cast, not `any`, and it is confined to one ~5-line function so that
adding a type stays "one file, one registry line."

### Other families

| Family | Modules | Contact | Data replacing today's lookups |
|---|---|---|---|
| Blocks | `blocks/Crate.ts`, `QuestionMark.ts`, `FragileRock.ts` | `side: 'bottom'` | `maxHits` replaces `maxHitsForBlock`'s ternary; `removeWhenUsedUp: false` replaces `isBlockRemoved`'s questionMark special-case; each module's `draw` absorbs its arm of `blockFrameSource`'s switch |
| Chests | `chests/Chest.ts` | standing-on | closed/open sprite pair and offsets |
| Pickups | `items/Key.ts`, `Coin.ts`, `Fruit.ts` | any side → collect | frame size, rendered size, offsets, bob behavior |
| Player | `Player.ts` | — | `PLAYER_TYPE` holds the three padding constants; `onDamage`/`onDeath` hooks |

**Constraint to hold deliberately:** `CollisionOutcome` grows fields as families
join — `spawnItem`, `consumeKey`, `collect`, `giveFact`. That object becomes the
shared vocabulary of everything that can happen in the world. If it sprawls past
roughly half a dozen fields it has become the scattered conditionals again in a
different shape; anything exotic must go through an `onDefeat(entity, world)`
style hook receiving a narrow `WorldApi` instead.

## Staging

Three plans. Each ends with the full suite green and the game playable — no
plan leaves a half-migrated world.

| Plan | Content | Ships |
|---|---|---|
| **1 — Lifecycle** (`2026-09-01-entity-lifecycle.md`) | Characterization tests, then `alive`/`rewardGiven`, revive-in-place, deletion of all three id-keyed ledgers. No abstraction. | The defect fix, independently |
| **2 — Enemy modules** (`2026-09-01-enemy-modules.md`) | `Entity` base, per-type enemy modules, type-owned rendering, contact resolution, spikes relocated into `SlimePurple.ts`. | The enemy architecture |
| **3 — Generalization** (not yet written) | Items, blocks, chests, then the player. | The remaining families |

Plan 3 is written via `superpowers:writing-plans` once Plan 2 lands, because its
task-level detail depends on the exact shapes Plan 2 produces — `DrawContext`,
`CollisionOutcome`, and the dispatcher — and writing it against a predicted
shape would produce a plan that silently disagrees with the code.

Plan 1 is worth doing even if Plans 2 and 3 are never picked up.

Each plan carries a **Model guidance** section and a per-task `**Model:**` line,
so an executor dispatching task-by-task picks the right model without needing
this document. Plan 1 is Sonnet 5 throughout; Plan 2 is mixed, with Opus on the
registry dispatcher and the contact-resolution tasks.

## Constitution check

| Principle | Outcome |
|---|---|
| I — Typed data architecture | Pass. No `any`. One documented cast in the dispatcher, justified above. Entity state stays plain serializable data. |
| II — Testing (non-negotiable) | Pass. Plan 1 Task 1 is characterization tests written before any source change; every subsequent task is test-first. |
| III — Code quality | Pass. Named exports, arrow-function components untouched, no shadcn/ui changes. |
| IV — No feature bloat | Pass. No new gameplay features. Behavior is preserved throughout; the only intended behavior change is the removal of a defect class. |
| V — Performance | Pass. Removes a per-frame `Set` allocation from the render path. Per-contact outcome objects are allocated only on actual contact, which is rare. |

## Risks

**Collapsing three collision functions into one is where a regression would
hide**, and `Collision.test.ts`'s 498 lines are written against the old function
names — so the safety net gets rewritten at the moment the risk peaks. This is
why Plan 1 Task 1 extracts the behavior into a name-independent truth table
first, verified against the existing code, before anything changes.

**The player migration is the highest-churn, lowest-payoff step**
(`Physics.test.ts` is 1,250 lines and there is only one playable character), so
it is sequenced last, after the pattern has been proven on six other types.
