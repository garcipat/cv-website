# Proposal: drop `Entity`, name the three categories, unify triggers

**Status:** proposal, not accepted. No implementation plan exists yet.

Companion to `2026-09-01-entity-architecture-design.md`. That document describes the
architecture as built; this one proposes a correction to its central abstraction.

## Two layers, and which one this touches

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

This proposal changes both layers, and they stay separate.

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

That is not a description of an entity. It describes **something that moves and
animates**, and it is adopted by exactly one family:

```
BaseEnemyState extends EnemyPlacement, Entity, Damageable   ← the only implementor
```

`BlockState`, `ChestState` and the pickup states kept their own shapes, and were right
to: a chest has no velocity, no facing and no animation, so satisfying `Entity` would
mean carrying five meaningless fields.

Two smaller symptoms of the same mis-naming:

- **The registry key has three names.** `EnemyDef.type`, `BlockDef.blockKind`,
  `CollectibleDef.spriteType` — one concept, three spellings — and chests have none,
  being a single kind.
- **Two hitboxes are still built in the engine.** `Collision.ts:257` constructs the
  chest's box inside `chestPlayerIsStandingOn`, and `:282` a sign's inside
  `checkSignOverlap`. Those are the only boxes left outside the generic overlap helper.

## The distinction that actually organises this: two kinds of box

Everything the player can touch has a rectangle, which is why a chest *feels* like an
entity. But the rectangles do different jobs:

| Kind | Meaning | Who has it |
|---|---|---|
| **Collision box** | participates in movement resolution — the player cannot pass through it | terrain, blocks, player, enemies |
| **Trigger box** | never affects movement; only answers *"is the player overlapping?"* | chests, signs, pickups |

This is verifiable, not a judgement call:

```
Physics.ts:71    blockPlacements: readonly BlockPlacement[] = NO_BLOCKS,
Physics.ts:393   const solid = isSolidExcludingBridge(tileAt(level, col, headRow)) || blockId !== undefined;
```

A **block is solid** — physics takes block placements and treats a block as terrain
during collision resolution. A **chest does not appear in `Physics.ts` at all**; you
walk straight through it.

That is why a sign feels like a chest and a block does not. A chest and a sign are both
triggers. A block is solid geometry that happens to react to being struck.

## The categories

| Category | Family | Box | What the player's presence does to it |
|---|---|---|---|
| **Actor** | player | collision | — |
| | green slime, purple slime | collision | damaged, then dies |
| **Solid** | crate, question-mark, fragile rock | collision | struck from below → damaged → consumed (question-mark persists, spent) |
| **Trigger** | coin, fruit | trigger | consumed on overlap |
| | dropped key | trigger | consumed on overlap |
| | bonus fruit | trigger | consumed on overlap, once its rise finishes |
| | chest | trigger | permanent state flip; needs Up and a held key |
| | sign | trigger | nothing — the sign never changes; the UI does |

Terrain tiles are solid too, but they are a character grid with no per-instance state,
so they sit outside this discussion entirely. Blocks are the bridge: solid like terrain,
stateful like an object.

Inside **Trigger** the sub-axis is *what happens to the trigger itself* — and it is not
cosmetic, it is exactly where the current code differs:

| Sub-shape | Families | Eligibility rule |
|---|---|---|
| disappears | coin, fruit, key, bonus fruit | "not yet collected" — recorded three different ways |
| changes state permanently | chest | "not already open" |
| never changes | sign | none — there is nothing to exhaust |

The sign is the cleanest evidence for the model: `SignPlacement` is `{ id, hintId, x, y }`
and nothing else. A taxonomy that cannot place a sign comfortably is wrong, and
"entity" could not.

## Proposal

### 1. Drop `Entity`; rename it `Actor`

Not a split — a removal. `Entity` shrunk to its honest content would be `{ x, y }`,
which is too thin to earn a name, and nothing outside the Actor category wants the rest
of it.

```ts
// entities/Actor.ts

/** Something that moves under its own power and animates while doing so. */
export interface Actor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: Direction;
  animState: string;
  animFrame: number;
  animTimer: number;
}
```

`BaseEnemyState extends EnemyPlacement, Actor, Damageable`. `PlayerState` extends
`Actor` — it already has every one of those fields, so this is free and is the smallest
possible step toward the player family without touching `Physics.ts`.

**`vy` stays.** A flying or jumping enemy is entirely plausible, so vertical velocity is
a category-level capability, not dead weight. This differs from `spiked`, which was one
*type's* mechanic sitting on a shared shape.

**`Damageable` stays orthogonal.** The player's health is not on `PlayerState` at all —
it is the module-level `healthState` signal in half-hearts, deliberately apart from
position and animation so that full-heal-on-death touches one signal. An `Actor` that
mandated `hitPoints` would be immediately wrong for the one player it exists to
accommodate. "Moves and animates" and "can be hurt" are independent axes.

### 2. `WorldType` on the type layer — the real universal

The only thing all three categories share is *has a position, a box, and a sprite*. That
is a set of **capabilities**, not a kind of thing, and it belongs on the type layer:

```ts
export interface WorldType<S> {
  key: string;
  box(state: S): Rect;
  draw(state: S, dc: DrawContext): void;
}
```

`EnemyType`, `PickupType`, `BlockType` and `ChestType` extend it. All four already have
`draw`; three have `box`. `ChestType`'s absence becomes a compile error rather than an
oversight.

### 3. Unify the triggers — the actual simplification

Chests, signs and pickups share one shape: a trigger box, an eligibility rule, and an
effect on overlap. The codebase has already half-discovered this — these three
functions are the same function:

```ts
overlappingPickups(player, items, boxOf, eligible)   // all matches
chestPlayerIsStandingOn(player, chests)              // first match's id
checkSignOverlap(player, signs)                      // first match's payload
```

Each builds a box, tests it against the player hitbox, and hands the caller an
identifier to act on. Collapsing them onto one helper also moves the chest's and sign's
geometry into their own modules, leaving **zero hitboxes constructed inside
`Collision.ts` outside the shared helper**.

Keep the eligibility predicate caller-supplied, as `overlappingPickups` already does.
The three pickup families record "collected" three different ways and unifying that is
a separate decision (see the follow-ups document); the *mechanism* unifies without it.

## What this deliberately does not do

- **No universal behavior base.** No shared `onHit` / `onDeath` / movement contract
  across categories. Player and enemy damage models are genuinely different: half-hearts
  in a separate signal versus stomp counts on the state; invincibility and knockback
  versus stun and spike growth; a lifecycle iris transition versus a flag and a
  once-ever reward. Merging them would unify names, not behavior.
- **`Solid` and `Trigger` stay informal categories, not declared interfaces.** They are
  vocabulary for reasoning about the code. Beyond `WorldType` they share no members, so
  declaring them would be taxonomy for its own sake.
- **No change to how blocks or chests are triggered.** A block is struck from below via
  `player.hitBlockIds` from ceiling collision; a chest opens on standing plus Up plus a
  held key.
- **No renaming of the three registry-key fields.** `type` / `blockKind` / `spriteType`
  is a real inconsistency, but changing it touches level parsing, the mappers and the
  editor. Worth doing on its own terms, not smuggled in here.

## Risk, stated plainly

Every time this codebase has shared behavior through a **base interface**, it grew dead
members: `spiked` sat on every enemy including one that could never spike, and `Entity`
itself is the larger instance of the same mistake. Every time it shared through
**functions and data models** — `overlappingPickups`, `SpriteSheet` / `SpriteDescriptor`,
`DrawContext` — it worked without residue.

That is why this proposal removes a base interface, adds only one (`WorldType`, whose
two members are genuinely universal), and puts its real weight on a shared *function*.
**If `WorldType` starts accumulating optional members, that is the signal it was the
wrong tool** and it should dissolve back into helpers.

## Rough shape of the work

Not a plan — a sketch, to convey size. Each would be a task with tests first.

1. Rename `Entity` → `Actor`, shrink to the moving/animating fields, point
   `BaseEnemyState` at it. Type-level only.
2. `PlayerState extends Actor`. Free — it already has the fields.
3. Add `WorldType`; have the four type modules extend it. Compile-error-driven.
4. Give `ChestType` a `box()` and repoint `chestPlayerIsStandingOn`.
5. Give signs a type module with a `box()` and repoint `checkSignOverlap`.
6. Collapse the three overlap functions onto one trigger helper.

Steps 4–6 are the only ones with behavioral risk. The boxes must come out byte-identical
— the chest's includes `CHEST_CLOSED_OFFSET_X` — so they need a browser check alongside
tests: standing on a chest must still offer to open it, and walking past a sign must
still show its hint.

## Open question

Should signs get a full type module, or is a `box()` helper enough? A sign has no state
and no per-type variation beyond its `hintId` payload, so a module may be more structure
than it earns. Step 5 assumes a module for symmetry with the other triggers; the cheaper
alternative is a bare `signBox(sign)` function next to the placement type.
