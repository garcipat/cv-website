# Proposal: Entity / Actor split, and a shared type-module base

**Status:** proposal, not accepted. No implementation plan exists yet.

Companion to `2026-09-01-entity-architecture-design.md`. That document describes the
architecture as built; this one proposes a correction to its central abstraction.

## Two layers, and which one this proposal touches

Rendering is **not** part of an entity. The architecture has two parallel hierarchies,
joined only by the registry key:

| | Layer | Lives | Holds |
|---|---|---|---|
| **State** | per instance | in signals, plain immutable data | `x`, `y`, `hitPoints`, `animFrame`, … |
| **Type** | per type | a module constant | `SpriteDescriptor`, `draw()`, `box()`, behavior hooks |

Fifty coins share one `PICKUP_TYPES.coin` carrying a single sprite descriptor and a
single `draw`; each coin instance stores only its position. Putting rendering on the
instance would give every coin a function reference and a descriptor, and would stop
entity state being plain serializable data — which the level editor needs, and which
signals' reference-equality change detection depends on.

The animation split illustrates the boundary:

- **Instance:** `animFrame`, `animTimer` — where *this* slime is in its cycle. Two
  slimes animate out of phase, which is the stagger `reviveEnemy` preserves.
- **Type:** `ENEMY_ANIMATIONS` — which frames make up a walk. Shared by every slime.

This proposal changes both layers: `Entity`/`Actor` on the state side, `WorldType` on
the type side. They stay separate.

## The problem

`entities/Entity.ts` declares:

```ts
export interface Entity {
  type: string;
  x: number; y: number;
  vx: number; vy: number;
  direction: Direction;
  animState: string;
  animFrame: number;
  animTimer: number;
}
```

That is not a description of an entity. It is a description of **something that moves
and animates** — and it is adopted by exactly one family:

```
BaseEnemyState extends EnemyPlacement, Entity, Damageable   ← the only implementor
```

`BlockState`, `ChestState` and the pickup states all kept their own shapes. The design
doc's stated goal — *"make every world object share one entity model"* — was not met,
and the code was right not to meet it: a chest has no velocity, no facing and no
animation, so making it satisfy `Entity` would mean carrying five meaningless fields.

Two smaller symptoms of the same mis-naming:

- **The registry key has three names.** `EnemyDef.type`, `BlockDef.blockKind`,
  `CollectibleDef.spriteType` — one concept, three spellings — and chests have none at
  all, being a single kind.
- **Two hitboxes are still built in the engine.** `Collision.ts:257` constructs the
  chest's box inside `chestPlayerIsStandingOn` and `:282` constructs a sign's inside
  `checkSignOverlap`. Those are the only boxes left outside the generic overlap helper;
  pickups own theirs via `PickupType.box()` and enemies via `enemyHitbox`. `ChestType`
  simply has no `box()` — a leftover, not a decision.

## What the families actually are

Derived from what each type module turned out to need, not from a taxonomy chosen up
front:

| Category | Families | Box | Moves | Health | Distinguishing feature |
|---|---|---|---|---|---|
| **Actor** | player, enemies | ✅ | ✅ | ✅ | resolves contacts, animates, acts on its own |
| **Prop** | blocks, chests | ✅ | ❌ | partial | fixed, has visual state, responds to one stimulus |
| **Pickup** | coin, fruit, key, bonus fruit | ✅ | ❌ (one tweens) | ❌ | consumed on touch |
| **Marker** | signs | ✅ | ❌ | ❌ | pure placement; proximity triggers something elsewhere |

Signs are the clarifying case: `SignPlacement` is `{ id, hintId, x, y }` and nothing
else. A chest is barely more — one boolean. Neither is an entity in the sense `Entity`
currently describes, yet **both have a hitbox**, because everything the player can touch
needs one.

So "has a hitbox" is not the dividing line. What differs between categories is **what a
touch means and who decides it.**

## Proposal

### 1. Split the state interface

```ts
// entities/Entity.ts

/** Anything that occupies a place in the world. */
export interface Entity {
  x: number;
  y: number;
}

/** An entity that moves under its own power and animates while doing so. */
export interface Actor extends Entity {
  vx: number;
  vy: number;
  direction: Direction;
  animState: string;
  animFrame: number;
  animTimer: number;
}
```

`BaseEnemyState extends EnemyPlacement, Actor, Damageable`. `PlayerState` extends
`Actor` — it already has every one of those fields. `BlockState` and `ChestState`
already satisfy `Entity` structurally through their `Placement` types, so declaring it
costs nothing and documents intent.

**`vy` stays on `Actor`.** A flying or jumping enemy is entirely plausible, so vertical
velocity is a category-level capability, not dead weight. This is a different case from
`spiked`, which was one *type's* mechanic sitting on a shared shape.

**`Damageable` stays orthogonal — do not fold health into `Actor`.** The player's health
is not on `PlayerState` at all; it is the module-level `healthState` signal in
half-hearts, deliberately kept apart from position and animation, so that
full-heal-on-death touches one signal. An `Actor` that mandated `hitPoints` would be
immediately wrong for the one player it exists to accommodate. "Moves and animates" and
"can be hurt" are independent axes.

### 2. A shared type-module base

This is the second layer described at the top — appearance and behavior, per type, not
per instance. All four type modules already have `draw`; three have `box`, and the
fourth's absence is the leftover named above.

```ts
export interface WorldType<S> {
  key: string;
  box(state: S): Rect;
  draw(state: S, dc: DrawContext): void;
}
```

`EnemyType`, `PickupType`, `BlockType` and `ChestType` extend it. That formalises what
is already true and makes the chest's missing `box()` a compile error rather than an
oversight.

### 3. Move the last two boxes out of the engine

Give `ChestType` a `box()` returning the closed-chest footprint it currently builds
inline, and give signs an equivalent. `chestPlayerIsStandingOn` and `checkSignOverlap`
then read geometry from the modules instead of constructing it.

Result: **zero hitboxes constructed inside `Collision.ts` outside the generic overlap
helper** — the property this architecture has been reaching for, with the chest as its
one remaining hole.

## What this deliberately does not do

- **No universal behavior base.** There is no shared `onHit` / `onDeath` / movement
  contract across categories. Player and enemy damage models are genuinely different:
  half-hearts in a separate signal versus stomp counts on the state; invincibility and
  knockback versus stun and spike growth; a lifecycle iris transition versus a flag and
  a once-ever reward. Merging them would unify names, not behavior.
- **No change to how blocks or chests are triggered.** A block is struck from below via
  `player.hitBlockIds` from ceiling collision; a chest opens on standing plus Up plus a
  held key. Routing either through `Contact`/`CollisionOutcome` would require
  `Physics.ts` to emit contacts and the outcome type to carry input state.
- **No renaming of the three registry-key fields.** `type` / `blockKind` / `spriteType`
  is a real inconsistency but touching it means touching level parsing, the mappers and
  the editor. Worth doing on its own terms, not smuggled into this.

## Risk, stated plainly

Every time this codebase has shared behavior through a **base interface**, it grew dead
members: `spiked` sat on every enemy including one that could never spike, and `vy` sat
on enemies before it was justified as a category capability. Every time it shared
through **functions and data models** — `overlappingPickups`, `SpriteSheet` /
`SpriteDescriptor`, `DrawContext` — it worked without residue.

`WorldType` is proposed only because `box` and `draw` are genuinely universal across all
four categories. **If it starts accumulating optional members, that is the signal it was
the wrong tool** and it should be dissolved back into helpers.

The `Entity`/`Actor` split carries less of that risk, since `Entity` shrinks to two
fields that every family already has.

## Rough shape of the work

Not a plan — a sketch, to convey size. Each would be a task with tests first.

1. Split `Entity` into `Entity` + `Actor`; point `BaseEnemyState` at `Actor`. Type-level
   only; no behavior.
2. Declare `Entity` on `BlockState` and `ChestState`. Documentation value; both already
   satisfy it.
3. Add `WorldType`; have the four type modules extend it. Compile-error-driven.
4. Give `ChestType` a `box()`; repoint `chestPlayerIsStandingOn`. Behavior must be
   identical — the box it returns has to match the one built inline today, including
   `CHEST_CLOSED_OFFSET_X`.
5. Same for signs and `checkSignOverlap`.
6. Optionally, `PlayerState extends Actor` — free, since it already has the fields, and
   it is the smallest possible first step toward the player family without touching
   `Physics.ts`.

Steps 4 and 5 are the only ones with behavioral risk, and both are pinned by existing
tests plus a browser check (standing on a chest must still offer to open it; walking
past a sign must still show its hint).

## Open questions

- Is `Entity` at two fields worth naming at all, or should `Actor` simply stand alone
  and the others declare `x`/`y` themselves? Naming it gives `WorldType<S extends Entity>`
  something to constrain against, which is the main argument for keeping it.
- Should `Prop` and `Pickup` become declared interfaces too, or stay as informal
  categories? They currently share nothing beyond `WorldType`, so declaring them may be
  taxonomy for its own sake.
