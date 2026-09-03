# Platformer Entity Architecture

How every drawable thing in the platformer — the player, enemies, blocks, chests,
pickups and signs — is modelled, and why it is modelled that way. A durable reference
for the system as it stands.

The goal the whole design serves: **adding a new enemy, interactable or block should
mean writing one module.** The shared interfaces should not have to change, and the new
thing's specifics should stay inside its own file.

## Two layers

Rendering is not part of an entity. There are two parallel hierarchies, joined only by
the registry key:

| | Layer | Lives | Holds |
|---|---|---|---|
| **State** | per instance | in signals, plain immutable data | `x`, `y`, `hitPoints`, `animFrame`, … |
| **Type** | per type | a module constant | `SpriteDescriptor`, `draw()`, `box()`, numbers, behavior hooks |

Fifty coins share one `PICKUP_TYPES.coin` carrying a single sprite descriptor and a
single `draw`; each coin instance stores only its position. Putting rendering on the
instance would give every coin a function reference and a descriptor, and would stop
entity state being plain serializable data — which the level editor needs, and which
signals' reference-equality change detection depends on.

The split recurs throughout: an instance stores *where it is in its cycle*, the type
stores *what the cycle is*; an instance stores `hitPoints`, the type stores
`maxHitPoints`.

### Why data and modules rather than classes

Mutable class instances are invisible to signals, which compare by reference — a
mutation notifies no subscriber, so the signal has to be reassigned anyway. The tests
are written as "call a pure function, assert on the returned object"; methods on
instances would mean rewriting them all for zero behavior change. And entity state
stays plain serializable data, which the level editor needs.

Self-containment — the property that motivates wanting classes — comes instead from
putting each type's data *and* its hooks *and* its `draw` in one module, indexed by a
registry that is nothing more than a barrel file:

```ts
// entities/enemies/index.ts — the whole registry
export const ENEMY_TYPES = { slimeGreen, slimePurple };
```

`PICKUP_TYPES` and `BLOCK_TYPES` are the same shape.

## Categories — vocabulary, not interfaces

Names for reasoning about the code. Deliberately **not** declared types; composition
happens through the capability interfaces below.

| Category | Family | Box | What the player's presence does to it |
|---|---|---|---|
| **Actor** | player | collision | damaged, then dies |
| | green slime, purple slime | collision | damaged, then dies |
| **Solid** | crate, question-mark, fragile rock | collision | struck from below → damaged → consumed (question-mark persists, spent) |
| **Trigger** | coin, fruit | trigger | consumed on overlap |
| | dropped key | trigger | consumed on overlap |
| | bonus fruit | trigger | consumed on overlap, once its rise finishes |
| | chest | trigger | permanent state flip; needs Up and a held key |
| | sign | trigger | nothing — the sign never changes; the UI does |

### Two kinds of box

Everything the player can touch has a rectangle, which is why a chest *feels* like an
entity. The rectangles do different jobs:

| Kind | Meaning | Who has it |
|---|---|---|
| **Collision box** | participates in movement resolution — the player cannot pass through it | terrain, blocks, player, enemies |
| **Trigger box** | never affects movement; only answers *"is the player overlapping?"* | chests, signs, pickups |

This is verifiable rather than a judgement call: `Physics.ts` takes block placements and
treats a block as terrain, while a chest does not appear in `Physics.ts` at all. That is
why a sign feels like a chest and a block does not — chests and signs are both triggers;
a block is solid geometry that happens to react to being struck.

A rectangle is geometry, not semantics, so `Boxed` is one interface rather than two; the
meaning lives in who calls it.

### Invariant: state is only for things that change

**Terrain must never become entities.** It is a character grid; `drawTerrain` iterates
that grid and `tileSource` derives each sprite from the grid plus its neighbours. A wall
costs one character, not an object.

Only markers that can *change* become stateful — the markers producing `blockStates`
entries with `hitsTaken`, `animState` and `animTimer`. In the current level that is
**six stateful blocks** against hundreds of terrain tiles.

This is what keeps a large map affordable: ten times the map is ten times the
*characters*, not ten times the *objects*. Two rules follow.

- A new **static decorative** tile is a terrain character and a `tileSource` case, **not**
  a block type. The block registry is for things with state.
- A new **block kind** is only justified if instances genuinely differ over time. If
  every instance always looks and behaves identically, it is terrain.

## The state layer: capability interfaces

`entities/capabilities.ts` declares three independent capabilities that a family
composes as applicable. There is no single `Entity` base — bundling position, movement
and animation into one shape produced dead members on every family that only wanted part
of it.

```ts
/** Moves under its own power. */
export interface Moving { vx: number; vy: number; direction: Direction }

/** Advances its own animation on a per-instance timer, so two instances of one
 *  type can be out of phase. */
export interface SelfAnimated { animState: string; animFrame: number; animTimer: number }

/** Takes damage and is gone at zero. `hitTimer` counts seconds since the last
 *  hit landed. */
export interface Damageable { hitPoints: number; alive: boolean; hitTimer: number }
```

Composition per family:

| Family | Moving | SelfAnimated | Damageable | Its own fields |
|---|---|---|---|---|
| player | ✅ | ✅ | ✅ | `grounded`, `climbing`, `knockbackTimer`, … |
| enemies | ✅ | ✅ | ✅ | `homeX`/`homeY`, `rewardGiven`; purple adds `spiked`/`spikeTimer` |
| blocks | ❌ | ❌ | ❌ | `hitsTaken`, plus its own `animState`/`animTimer` |
| chests | ❌ | ❌ | ❌ | open-or-closed state |
| coin, fruit, key | ❌ | ❌ | ❌ | key adds `collected` |
| bonus fruit | ❌ | ❌ | ❌ | `elapsed`, `startY`, `restY`, `iconIndex` |
| signs | ❌ | ❌ | ❌ | `hintId` |

Position (`x`, `y`) stays declared by each family's placement type. An interface for two
fields every family has would be ceremony.

**No capability stores a `hitbox` or `spriteBox` field.** Both are derived functions of
`type` + `x` + `y`. A stored box is a second copy of position needing re-sync on every
one of the ~60 position updates a second a moving entity gets, and a missed sync is a
silent collision bug.

### Animated is not one concept

`SelfAnimated` is for things that advance their own animation on a per-instance timer. A
type whose frames come from the shared world clock — a spinning coin, a bobbing key —
needs none of it: its `frameIndex` reads `elapsed` instead. Both are animated; only one
stores state.

**Blocks compose no capability at all.** No block cycles sprite frames — two
`frameIndex` implementations are constants and the third is a function of `hitsTaken`,
not of time. A block's `animTimer` drives only a y-offset and an alpha: transforms on a
static sprite. And its `hitsTaken` counts *up* to a per-kind maximum rather than down to
zero, with a spent question-mark staying solid in the world, so `alive` has no meaning
for it. Blocks keep their own fields.

### The player is `Damageable`

The player's health is `hitPoints` on the player like any other damageable thing, not a
standalone signal. Health was already tracked in half-heart integers, so the player has
**6 hit points displayed as 3 hearts** — the three-heart display was always pure
presentation, it simply was not labelled as such. The heart helpers take a plain number
and are unchanged.

The unit is a per-type concern, exactly as `maxHitPoints` already was for enemies:

| | `hitPoints` counts | max on the type | presented as |
|---|---|---|---|
| enemy | stomps | `maxHitPoints` | the hit reaction |
| player | half-hearts | `maxHitPoints` = 6 | three heart sprites |

### One refractory window

The player's invincibility and an enemy's post-hit stun were the same concept in two
encodings — one counting down from a constant, one counting up and gating indirectly
through its animation state. They are unified as `Damageable.hitTimer`, **counting up**,
with the duration on the type and one shared predicate:

```ts
isInvulnerable(state, type.hitReactionSeconds)
```

**Counting up is the load-bearing detail.** Counting down bakes the duration into the
initial value, so every instance carries a copy; counting up leaves it on the type,
which is what lets a new damageable thing get its refractory window by declaring one
number. Every call site takes the duration from the type, never from a shared constant.

What stays type-specific is what *happens* during and after the window — the player
blinks then becomes vulnerable; an enemy plays its hit animation then reverts or dies.
That is `onTick` business, not interface business.

## The type layer

The type layer composes the same way the state layer does, rather than inflating one
base.

```ts
/** Every drawable world object's type. Both members are genuinely universal. */
export interface WorldType<S> {
  key: string;
  draw(state: S, dc: DrawContext): void;
}

/** Has a rectangle in world space. */
export interface Boxed<S> {
  box(state: S): Rect;
}

/** The type-side half of `Damageable`. */
export interface DamageableType<S extends Damageable> {
  maxHitPoints: number;
  hitReactionSeconds: number;
  onDamaged?(state: S, amount: number): S;
}
```

| Family type | Composes |
|---|---|
| `EnemyType` | `WorldType` + `Boxed` + `DamageableType` |
| `PickupType` | `WorldType` + `Boxed` |
| `ChestType` | `WorldType` + `Boxed` |
| `BlockType` | `WorldType` only |

**`BlockType` composes `WorldType` alone, deliberately.** Physics locates blocks by grid
cell — `isBlockOccupied` and `blockIdAt` — and never computes a block rectangle, so a
required `box()` there would be a member with no consumer. That is precisely the
dead-member failure this architecture exists to remove.

Behavior hooks live on the family interface that needs them, not on `WorldType`:
`EnemyType` declares `onPlayerCollide` (required) and `onTick` (optional, implemented
only by the purple slime). Keeping them off `WorldType` is what lets a new kind of thing
join without the shared interface changing.

`onDamaged` is separate from `onPlayerCollide` on purpose: deciding what a touch *means*
and paying for a landed hit are different jobs, and only the second is the type's
business once a hit is a fact.

### Type variance

Per-type state — `spiked`/`spikeTimer` on the purple slime — is declared in that type's
own module, so `EnemyState` is a discriminated union over its type key. TypeScript
cannot prove a dispatch over a registry of differing state types sound, so there is
**one generic dispatcher containing a single documented cast**, confined to a few lines.
It is a cast, not `any`.

## Identity and lifecycle

Identity is **positional**. Immutable updates replace the enemy object every tick, so
identity cannot be object reference — and it does not need to be an id either. If the
array is built once and never has entries added or removed, index N is the same enemy
for the whole session.

This replaced three id-keyed collections that each encoded "what happened to enemy X"
without being owned by enemy X. Every new per-enemy mechanic would have needed a fourth,
and each is a place a dedup can be forgotten.

1. The enemy array is built once. Its length never changes again.
2. **No `filter`.** Dead enemies stay in the array with `alive: false`; render and
   collision skip them.
3. A reward fires exactly once, ever, via a `rewardGiven` flag on the enemy. A revived
   enemy stomped again is `alive: false, rewardGiven: true` and is not selected. No id
   lookup, no dedup set.
4. Death maps rather than rebuilds: `revive` restores position from `homeX`/`homeY`,
   `hitPoints` from the type, `alive` to `true`, and zeroes the timers. It leaves
   `rewardGiven` alone — so a revived enemy is killable again but never pays out twice.
5. **Reset Game is the only place a rebuild from placements is legal.**

## Sprites

Sprites come in **groups**, and the group is the sheet. One sheet backs however many
things draw from it — `world_tileset.png` serves terrain, crates, question-mark blocks
and fragile rocks at once.

```ts
export interface SpriteSheet {
  src: string;
  frameWidth: number;
  frameHeight: number;
  /** Frames are addressed by index, left-to-right then top-to-bottom;
   *  `columns` turns an index into sx/sy. */
  columns: number;
}
```

`columns` is the **addressing stride**, not the image width. A standalone single image
is a one-frame sheet, so it stops being a special case with its own drawing path.

A type declares which group it draws from and which frame indices within it, via a
`SpriteDescriptor`. An animation may span a row boundary — the enemy walk loop
deliberately does.

**There is no enum listing every sprite.** The loader walks the type registries,
collects the distinct `sheet.src` values, and loads each exactly once — so a shared
sheet loads once no matter how many types reference it, and adding a type touches no
sprite registry at all.

## Rendering owned by the type

`Renderer.ts` keeps only the iteration and the camera transform, handing each entity a
`DrawContext` (the canvas context, the sheet lookup keyed by `src`, the camera origin,
and the world clock for bob and pulse effects). It never branches on type.

A simple type's `draw` is one call to the shared sprite-sheet helper. The purple slime's
calls the same helper, then draws its spike overlay and held-item shine on top.

## Contact resolution

The engine computes **geometry**; the type decides **consequences**.

```ts
export interface Contact {
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

Returning a description rather than mutating keeps the hook pure — trivially testable,
with no signals and no canvas — and keeps the engine the only thing that writes to
signals.

**The engine retains three responsibilities, deliberately not delegated:**

- **Invulnerability.** `damagePlayer` is dropped while the player is inside its
  refractory window. No type ever knows this exists.
- **Multi-contact aggregation.** Touching two enemies in one tick applies at most one
  damage, applies a bounce if any outcome requests one, and merges every returned
  `self`.
- **Dead entities are not consulted.**

Blocks and chests do **not** go through this model. A block is struck from below,
detected during ceiling collision, which records the hit on the player; there is no
player-versus-block overlap test. A chest opens on standing on it *and* pressing Up
*and* holding a key. Unifying them would require physics to emit contacts and
`CollisionOutcome` to carry input state, which is deliberately not done.

## Triggers

Chests, signs and pickups share one shape: a trigger box, an eligibility rule, and an
effect on overlap. One helper resolves all of them:

```ts
overlappingTriggers(player, items, boxOf, eligible)
```

**No hitbox is constructed inside `Collision.ts` except the player's own.** Every other
box comes from its own module — or, for signs, from a bare `signBox` helper next to the
placement type: a sign has no state and no per-type variation beyond its `hintId`, so a
full type module would be structure it has not earned.

The eligibility predicate stays caller-supplied. The pickup families record "collected"
three different ways, and the mechanism unifies without unifying that policy — which is
a separate decision with real behavioral risk, tracked in the follow-ups.

## Constraints to hold

Three places where this design can decay, each worth checking against.

- **`CollisionOutcome` must not sprawl.** It grows fields as families join — spawning an
  item, consuming a key, collecting, granting a fact. That object is the shared
  vocabulary of everything that can happen in the world. Past roughly half a dozen
  fields it has become the scattered conditionals again in a different shape; anything
  exotic should go through a hook receiving a narrow world API instead.
- **`WorldType` must not accumulate required members.** Its two are genuinely universal.
  If a third becomes required, that is the signal a base interface was the wrong tool.
- **Terrain must not become entities.** See the invariant above.

The underlying pattern: every time this codebase shared behavior through a **base
interface**, it grew dead members — `spiked` on every enemy including one that could
never spike, and the old `Entity` base itself. Every time it shared through **functions
and data models** — the overlap helper, the sprite sheet and descriptor, `DrawContext` —
it worked without residue.

## What adding a type costs

"One module, one registry line, one sprite asset" holds for the **appearance, geometry
and rendering** axis. Reaching the rest of the game costs more.

**A new enemy type:** its module, one line in `enemies/index.ts`, its literal in the
enemy definition union, a sheet constant, the PNG. `Collision.ts`, `Renderer.ts`,
`EnemyAI.ts` and `DebugOverlay.ts` need no edit.

**A new block kind:** its module, one registry line, its frame index inside its own
module — plus its literal in two parallel unions to be reachable.

**A new placed-collectible variant:** about nine files, almost none of it interface
design — the union, the mapper's hardcoded marker keys and its two-way branch, the level
parser's marker character, and three editor files.

**The interfaces are not the remaining friction.** What still forces edits to shared code
is the **placement pipeline** — the unions in `types.ts`, `LevelParser.ts`, the mappers,
and the editor. If "adding content should be cheap" is the goal, that pipeline is the
higher-value target than anything in the entity model.
