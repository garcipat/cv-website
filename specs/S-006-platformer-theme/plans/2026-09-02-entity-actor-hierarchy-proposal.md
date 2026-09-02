# Proposal: capability interfaces, one type base, unified triggers

**Status:** proposal, not accepted. No implementation plan exists yet.

Companion to `2026-09-01-entity-architecture-design.md`. That document describes the
architecture as built; this proposes a correction to its central abstraction.

**Goal it serves:** adding a new enemy, interactable or block should mean writing one
implementation module. The shared interfaces should not have to change, and the new
thing's specifics should stay inside its own file.

## Two layers

Rendering is not part of an entity. There are two parallel hierarchies, joined only by
the registry key:

| | Layer | Lives | Holds |
|---|---|---|---|
| **State** | per instance | in signals, plain immutable data | `x`, `y`, `hitPoints`, `animFrame`, … |
| **Type** | per type | a module constant | `SpriteDescriptor`, `draw()`, `box()`, behavior hooks |

Fifty coins share one `PICKUP_TYPES.coin` carrying a single sprite descriptor and a
single `draw`; each coin instance stores only its position. Putting rendering on the
instance would give every coin a function reference and a descriptor, and would stop
entity state being plain serializable data — which the level editor needs, and which
signals' reference-equality change detection depends on.

The animation split shows the boundary: an instance stores `animFrame`/`animTimer`
(where *this* slime is in its cycle — two slimes animate out of phase), while the type
stores `ENEMY_ANIMATIONS` (which frames make up a walk).

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

That is not a description of an entity. It bundles three independent capabilities —
position, movement, animation — into one shape, and is adopted by exactly one family:

```
BaseEnemyState extends EnemyPlacement, Entity, Damageable   ← the only implementor
```

`BlockState`, `ChestState` and the pickup states kept their own shapes and were right
to. A chest has no velocity, facing or animation; satisfying `Entity` would mean
carrying five meaningless fields. A block is the sharper case: it **animates without
moving**, so it wants half of `Entity` and not the other half — which no single
interface can express.

Two smaller symptoms of the same mis-naming:

- **The registry key has three names.** `EnemyDef.type`, `BlockDef.blockKind`,
  `CollectibleDef.spriteType` — one concept, three spellings — and chests have none,
  being a single kind.
- **Two hitboxes are still built in the engine.** `Collision.ts:257` constructs the
  chest's box inside `chestPlayerIsStandingOn`, and `:282` a sign's inside
  `checkSignOverlap`. Those are the only boxes left outside the generic overlap helper.

## Two kinds of box

Everything the player can touch has a rectangle, which is why a chest *feels* like an
entity. But the rectangles do different jobs:

| Kind | Meaning | Who has it |
|---|---|---|
| **Collision box** | participates in movement resolution — the player cannot pass through it | terrain, blocks, player, enemies |
| **Trigger box** | never affects movement; only answers *"is the player overlapping?"* | chests, signs, pickups |

Verifiable, not a judgement call:

```
Physics.ts:71    blockPlacements: readonly BlockPlacement[] = NO_BLOCKS,
Physics.ts:393   const solid = isSolidExcludingBridge(tileAt(level, col, headRow)) || blockId !== undefined;
```

A **block is solid** — physics takes block placements and treats a block as terrain
during collision resolution. A **chest does not appear in `Physics.ts` at all**. That is
why a sign feels like a chest and a block does not: chests and signs are both triggers;
a block is solid geometry that happens to react to being struck.

## Categories — vocabulary, not interfaces

These names are for reasoning about the code. They are deliberately **not** declared
types; composition happens through the capability interfaces below.

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
so they sit outside this discussion. Blocks are the bridge: solid like terrain, stateful
like an object.

Inside **Trigger**, the sub-axis is what happens to the trigger itself, and it maps
exactly onto how the current code differs:

| Sub-shape | Families | Eligibility rule |
|---|---|---|
| disappears | coin, fruit, key, bonus fruit | "not yet collected" — recorded three different ways |
| changes state permanently | chest | "not already open" |
| never changes | sign | none — there is nothing to exhaust |

The sign is the cleanest evidence for the model: `SignPlacement` is `{ id, hintId, x, y }`
and nothing else. A taxonomy that cannot place a sign comfortably is wrong, and
"entity" could not.

## Proposal

### 1. Replace `Entity` with capability interfaces

Delete `Entity`. Its three capabilities become independent interfaces a family composes:

```ts
// entities/capabilities.ts

/** Moves under its own power. */
export interface Moving {
  vx: number;
  vy: number;
  direction: Direction;
}

/** Carries its own animation state, advancing on its own timer. */
export interface Animated {
  animState: string;
  animFrame: number;
  animTimer: number;
}

/** Has hit points that count down, and is gone at zero. */
export interface Damageable {
  hitPoints: number;
  alive: boolean;
}
```

Position (`x`, `y`) stays declared by each family's `Placement` type, as it already is.
An interface for two fields every family already has would be ceremony.

Composition per family:

| Family | Moving | Animated | Damageable | Its own fields |
|---|---|---|---|---|
| player | ✅ | ✅ | ❌ *(see below)* | `grounded`, `climbing`, `invincibleTimer`, `knockbackTimer`, … |
| enemies | ✅ | ✅ | ✅ | `homeX/homeY`, `hitTimer`, `rewardGiven`; purple adds `spiked`/`spikeTimer` |
| blocks | ❌ | ✅ | ❌ *(see below)* | `hitsTaken` |
| chests | ❌ | ❌ | ❌ | `state: 'closed' \| 'open'` |
| coin, fruit, key | ❌ | ❌ *(see below)* | ❌ | — (key adds `collected`) |
| bonus fruit | ❌ | ❌ | ❌ | `elapsed`, `startY`, `restY`, `iconIndex` |
| signs | ❌ | ❌ | ❌ | `hintId` |

Three details this table settles deliberately:

- **`vy` stays on `Moving`.** A flying or jumping enemy is plausible, so vertical
  velocity is a capability of moving things, not dead weight. This differs from
  `spiked`, which was one *type's* mechanic on a shared shape.
- **The player is not `Damageable`, and blocks are not either.** The player's health is
  the module-level `healthState` signal in half-hearts, deliberately apart from position
  and animation so full-heal-on-death touches one signal. A block's `hitsTaken` counts
  *up* to a per-kind max rather than *down* to zero, and a spent question-mark stays in
  the world, so `alive` has no meaning for it. Three families take damage in three
  genuinely different shapes; `Damageable` describes only the enemy one, and that is
  correct rather than incomplete.
- **Coins are animated but not `Animated`.** They spin and bob off the shared
  `worldElapsed` clock with no per-instance state — `Coin.ts` says so explicitly.
  `Animated` means "carries its own animation state", not "moves visually". A family
  animating off the world clock needs no capability at all.

### 2. One type base, with optional hooks

The universal capability — *has a box and can be drawn* — belongs on the type layer:

```ts
export interface WorldType<S> {
  key: string;
  box(state: S): Rect;
  draw(state: S, dc: DrawContext): void;

  /** Optional behavior. A type implements only what applies to it, so adding a
   *  new kind of thing never requires changing this interface. */
  onPlayerCollide?(state: S, player: PlayerState, contact: Contact): CollisionOutcome<S>;
  onTick?(state: S, dt: number): S;
}
```

`EnemyType`, `PickupType`, `BlockType` and `ChestType` extend it. All four already have
`draw`; three have `box`, and `ChestType`'s absence becomes a compile error rather than
an oversight.

**Optional hooks are what serve the extensibility goal.** `EnemyType` already works this
way — `onTick` is optional and only the purple slime implements it. A new type opts into
the hooks it needs; the base does not grow.

### 3. Unify the triggers

Chests, signs and pickups share one shape: a trigger box, an eligibility rule, and an
effect on overlap. These three functions are already the same function:

```ts
overlappingPickups(player, items, boxOf, eligible)   // all matches
chestPlayerIsStandingOn(player, chests)              // first match's id
checkSignOverlap(player, signs)                      // first match's payload
```

Collapsing them onto one helper also moves the chest's and sign's geometry into their
own modules, leaving **zero hitboxes constructed inside `Collision.ts` outside the
shared helper**.

Keep the eligibility predicate caller-supplied, as `overlappingPickups` already does.
The pickup families record "collected" three different ways; unifying that is a separate
decision (see the follow-ups document), and the mechanism unifies without it.

## What this deliberately does not do

- **No universal behavior base.** No shared damage or death contract. Three families take
  damage three different ways, as above; merging them would unify names, not behavior.
- **No declared `Actor` / `Solid` / `Trigger` types.** They are vocabulary. Beyond
  `WorldType` they share no members, so declaring them would be taxonomy for its own
  sake — and a family's membership is already evident from which capabilities it
  composes.
- **No change to how blocks or chests are triggered.** A block is struck from below via
  `player.hitBlockIds` from ceiling collision; a chest opens on standing plus Up plus a
  held key.
- **No renaming of the three registry-key fields.** Real inconsistency, but changing it
  touches level parsing, the mappers and the editor. Worth doing on its own terms.

## What still blocks the extensibility goal

Worth stating plainly: **the interfaces are not the remaining friction.** Adding an
enemy or block already costs one module plus one registry line, with no edit to
`Renderer.ts`, `Collision.ts` or `EnemyAI.ts`, and the loader discovers the sprite by
itself.

What still forces edits to shared code when adding a thing is the **placement pipeline**:

- `types.ts`'s unions — `EnemyDef.type`, `BlockDef.blockKind`, `CollectibleDef.spriteType`
- `LevelParser.ts` — a marker character
- the relevant `*Mapper.ts` — hardcoded marker keys, and for collectibles a two-way
  `isCoin` branch
- the editor — `LevelEditorPage.tsx`, `paletteTiles.ts`, `editor/gridRenderState.ts`

A new placed collectible costs roughly nine files, almost none of it interface design.
If "adding content should be cheap" is the goal, that pipeline is the higher-value
target than anything in this proposal.

## Risk, stated plainly

Every time this codebase shared behavior through a **base interface**, it grew dead
members: `spiked` on every enemy including one that could never spike; `Entity` itself
is the larger instance. Every time it shared through **functions and data models** —
`overlappingPickups`, `SpriteSheet`/`SpriteDescriptor`, `DrawContext` — it worked without
residue.

This proposal therefore removes a base, replaces it with small capability interfaces a
family opts into, adds exactly one type base whose two required members are genuinely
universal, and puts its real weight on a shared *function*. **If `WorldType` starts
accumulating required members, that is the signal it was the wrong tool.**

## Rough shape of the work

Not a plan — a sketch, to convey size. Each would be a task with tests first.

1. Add `Moving` / `Animated` / `Damageable`; point `BaseEnemyState` at them; delete
   `Entity`. Type-level only.
2. `PlayerState implements Moving, Animated`. Free — it already has the fields.
3. `BlockState implements Animated`. Also free.
4. Add `WorldType`; have the four type modules extend it. Compile-error-driven.
5. Give `ChestType` a `box()` and repoint `chestPlayerIsStandingOn`.
6. Give signs a `box()` and repoint `checkSignOverlap`.
7. Collapse the three overlap functions onto one trigger helper.

Steps 5–7 carry the only behavioral risk. The boxes must come out byte-identical — the
chest's includes `CHEST_CLOSED_OFFSET_X` — so they need a browser check alongside tests:
standing on a chest must still offer to open it, and walking past a sign must still show
its hint.

## Open question

Should signs get a full type module, or is a `box()` helper enough? A sign has no state
and no per-type variation beyond its `hintId`. Step 6 assumes a module for symmetry with
the other triggers; the cheaper alternative is a bare `signBox(sign)` function next to
the placement type.
